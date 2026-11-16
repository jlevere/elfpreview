import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { watch } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import test from "node:test";
import { ParserService } from "../src/parser-service";

const workerPath = path.resolve("dist/worker.js");
const load = () => readFile("rust/tests/fixtures/simple_test2");

test("real worker returns exact metadata and reports malformed input", async () => {
  const parser = new ParserService(workerPath);
  const signal = new AbortController().signal;
  const data = await parser.parse(load, signal);
  assert.equal(data.symbols.length, 23328);
  assert.equal(data.info.entrypoint, String(0xa4c30));
  await assert.rejects(
    parser.parse(() => Promise.resolve(new Uint8Array(0)), signal),
  );
  assert.equal((await parser.parse(load, signal)).symbols.length, 23328);
});

test("cancellation releases queued capacity and cannot stop another document", async () => {
  const parser = new ParserService(workerPath);
  const first = new AbortController();
  const second = new AbortController();
  let release!: (data: Uint8Array) => void;
  let started!: () => void;
  const loading = new Promise<void>((resolve) => {
    started = resolve;
  });
  const held = parser.parse(() => {
    started();
    return new Promise((resolve) => {
      release = resolve;
    });
  }, first.signal);
  const rejected = assert.rejects(held);
  await loading;
  const survivor = parser.parse(load, second.signal);
  const cancelled = new AbortController();
  let read = false;
  const queued = parser.parse(() => {
    read = true;
    return load();
  }, cancelled.signal);
  const queuedRejected = assert.rejects(queued);
  cancelled.abort();
  first.abort();
  release(new Uint8Array());
  await Promise.all([rejected, queuedRejected]);
  assert.equal(read, false);
  assert.equal((await survivor).symbols.length, 23328);
});

test("aborting terminates a worker blocked in synchronous code", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "elfpreview-worker-"));
  try {
    const filename = path.join(temporary, "blocked.cjs");
    const marker = path.join(temporary, "started");
    await writeFile(
      filename,
      `require("node:worker_threads").parentPort.once("message", () => { require("node:fs").writeFileSync(${JSON.stringify(marker)}, "started"); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0); });`,
    );
    const watcher = watch(temporary);
    const started = once(watcher, "change", {
      signal: AbortSignal.timeout(10_000),
    });
    const parser = new ParserService(filename);
    const controller = new AbortController();
    const operation = parser.parse(
      () => Promise.resolve(new Uint8Array()),
      controller.signal,
    );
    const rejected = assert.rejects(operation, /cancelled/);
    try {
      await started;
    } finally {
      watcher.close();
    }
    controller.abort();
    await rejected;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("the bounded queue rejects excess work without reading more files", async () => {
  const parser = new ParserService(workerPath);
  const controllers = Array.from({ length: 11 }, () => new AbortController());
  const release: Array<(bytes: Uint8Array) => void> = [];
  const held = controllers
    .slice(0, 2)
    .map((controller) =>
      parser.parse(
        () => new Promise<Uint8Array>((resolve) => release.push(resolve)),
        controller.signal,
      ),
    );
  const heldRejected = held.map((operation) => assert.rejects(operation));
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  assert.equal(release.length, 2);
  let reads = 0;
  const queued = controllers.slice(2, 10).map((controller) =>
    assert.rejects(
      parser.parse(() => {
        reads++;
        return load();
      }, controller.signal),
    ),
  );
  await assert.rejects(parser.parse(load, controllers[10].signal), /Too many/);
  for (const controller of controllers) controller.abort();
  for (const resolve of release) resolve(new Uint8Array());
  await Promise.all([...heldRejected, ...queued]);
  assert.equal(reads, 0);
  assert.equal(
    (await parser.parse(load, new AbortController().signal)).symbols.length,
    23328,
  );
});

test("file size is rechecked after reading and an already cancelled job never reads", async () => {
  const parser = new ParserService(workerPath);
  await assert.rejects(
    parser.parse(
      () => Promise.resolve(new Uint8Array(64 * 1024 * 1024 + 1)),
      new AbortController().signal,
    ),
    /64 MiB/,
  );
  const controller = new AbortController();
  controller.abort();
  let reads = 0;
  await assert.rejects(
    parser.parse(() => {
      reads++;
      return load();
    }, controller.signal),
  );
  assert.equal(reads, 0);
});

test("repeated symbol names fail at the report limit without returning an expanded result", async () => {
  const bytes = await load();
  // Mutate the fixture's ELF64 little-endian symbol table, keeping its size unchanged.
  const sections = Number(bytes.readBigUInt64LE(40));
  const stride = bytes.readUInt16LE(58);
  const count = bytes.readUInt16LE(60);
  const table = Array.from(
    { length: count },
    (_, index) => sections + index * stride,
  ).find((offset) => bytes.readUInt32LE(offset + 4) === 2);
  assert.ok(table !== undefined);
  const offset = Number(bytes.readBigUInt64LE(table + 24));
  const size = Number(bytes.readBigUInt64LE(table + 32));
  const entrySize = Number(bytes.readBigUInt64LE(table + 56));
  const namesHeader = sections + bytes.readUInt32LE(table + 40) * stride;
  const namesStart = Number(bytes.readBigUInt64LE(namesHeader + 24));
  const namesSize = Number(bytes.readBigUInt64LE(namesHeader + 32));
  const names = bytes.subarray(namesStart, namesStart + namesSize);
  let longest = 0;
  let length = 0;
  for (let index = 0; index < size; index += entrySize) {
    const name = bytes.readUInt32LE(offset + index);
    const end = names.indexOf(0, name);
    if (end - name > length) {
      longest = name;
      length = end - name;
    }
  }
  assert.ok((length * size) / entrySize > 32 * 1024 * 1024);
  for (let index = 0; index < size; index += entrySize)
    bytes.writeUInt32LE(longest, offset + index);
  const parser = new ParserService(workerPath);
  await assert.rejects(
    parser.parse(() => Promise.resolve(bytes), new AbortController().signal),
    /32 MiB text limit/,
  );
});
