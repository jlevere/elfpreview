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
