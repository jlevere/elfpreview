import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ElfParser } from "../src/parser";

const wasm = readFile("dist/elfpreview.wasm");

test("compiled Wasm parses fixtures and releases results after lifting", async () => {
  const parser = await ElfParser.create(await wasm);
  const data = await readFile("rust/tests/fixtures/simple_test2");
  const first = parser.parse(data);
  assert.equal(first.symbols.length, 23328);
  assert.equal(typeof first.info.entrypoint, "bigint");
  for (let i = 0; i < 3; i++) parser.parse(data);
  const warmMemory = parser.memoryBytes;
  for (let i = 0; i < 20; i++) {
    assert.equal(parser.parse(data).symbols.length, first.symbols.length);
    parser.header(data.subarray(0, 64));
    parser.validate(data.subarray(0, 64));
    assert.throws(() => parser.parse(new Uint8Array(64)));
  }
  assert.equal(parser.memoryBytes, warmMemory);
  assert.equal(
    first.info.entrypoint,
    0xa4c30n,
    "lifted results outlive guest allocation",
  );
});

test("header preserves all 64 entry-point bits", async () => {
  const parser = await ElfParser.create(await wasm);
  const data = await readFile("rust/tests/fixtures/simple_test");
  data.writeBigUInt64LE(0xfedcba9876543210n, 24);
  assert.equal(
    parser.header(data.subarray(0, 64)).entrypoint,
    0xfedcba9876543210n,
  );
});
