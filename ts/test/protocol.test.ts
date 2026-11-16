import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { ElfParser } from "../src/parser";
import { toWire, type HostMessage, type PreviewState } from "../src/protocol";
import { connectView, webviewHtml } from "../src/view";

test("ready handshake replays the current snapshot and disposes subscriptions", () => {
  const events = new EventEmitter();
  let state: PreviewState = {
    filename: "</script><img src=x>",
    status: "loading",
  };
  const sent: HostMessage[] = [];
  const connection = connectView(
    {
      onDidReceiveMessage(listener) {
        events.on("message", listener);
        return {
          dispose() {
            events.off("message", listener);
          },
        };
      },
      postMessage(message) {
        sent.push(message);
        return Promise.resolve(true);
      },
    },
    () => state,
    (listener) => {
      events.on("state", listener);
      return {
        dispose() {
          events.off("state", listener);
        },
      };
    },
    (error) => assert.fail(String(error)),
  );
  state = {
    filename: state.filename,
    status: "error",
    message: "<img onerror=alert(1)>",
  };
  events.emit("state", state);
  events.emit("message", null);
  assert.equal(sent.length, 0);
  events.emit("message", { type: "ready" });
  assert.deepEqual(sent, [{ type: "state", state }]);
  events.emit("message", { type: "ready" });
  assert.equal(sent.length, 2, "a recreated webview receives the snapshot");
  connection.dispose();
  assert.equal(events.listenerCount("state"), 0);
  assert.equal(events.listenerCount("message"), 0);
  const html = webviewHtml("vscode-resource:", "script.js", "style.css");
  assert.ok(html.includes("default-src 'none'"));
  assert.ok(!html.includes(state.filename));
  assert.ok(!html.includes(state.message));
});

test("wire data is JSON safe and retains exact 64-bit values", async () => {
  const parser = await ElfParser.create(await readFile("dist/elfpreview.wasm"));
  const bytes = await readFile("rust/tests/fixtures/simple_test");
  bytes.writeBigUInt64LE(0xfedcba9876543210n, 24);
  const wire = toWire(parser.parse(bytes));
  assert.equal(wire.info.entrypoint, "18364758544493064720");
  assert.doesNotThrow(() => JSON.stringify(wire));
  assert.equal(typeof wire.programheaders[0].vaddr, "string");
});

test("failed webview delivery is reported without an unhandled rejection", async () => {
  const events = new EventEmitter();
  const failure = new Error("Webview transport closed");
  let report!: (error: unknown) => void;
  const reported = new Promise<unknown>((resolve) => {
    report = resolve;
  });
  const connection = connectView(
    {
      onDidReceiveMessage(listener) {
        events.on("message", listener);
        return {
          dispose() {
            events.off("message", listener);
          },
        };
      },
      postMessage() {
        return Promise.reject(failure);
      },
    },
    () => ({ filename: "sample", status: "loading" }),
    () => ({ dispose() {} }),
    report,
  );
  events.emit("message", { type: "ready" });
  assert.equal(await reported, failure);
  connection.dispose();
});

test("clipboard requests require readiness and text and acknowledge completed writes", async () => {
  const events = new EventEmitter();
  const sent: HostMessage[] = [];
  const written: string[] = [];
  let acknowledge!: () => void;
  const copied = new Promise<void>((resolve) => {
    acknowledge = resolve;
  });
  const connection = connectView(
    {
      onDidReceiveMessage(listener) {
        events.on("message", listener);
        return {
          dispose() {
            events.off("message", listener);
          },
        };
      },
      postMessage(message) {
        sent.push(message);
        if (message.type === "copied") acknowledge();
        return Promise.resolve(true);
      },
    },
    () => ({ filename: "sample", status: "loading" }),
    () => ({ dispose() {} }),
    (error) => assert.fail(String(error)),
    (text) => {
      written.push(text);
      return Promise.resolve();
    },
  );
  events.emit("message", { type: "copy", text: "before readiness" });
  events.emit("message", { type: "ready" });
  for (const message of [
    { type: "copy" },
    { type: "copy", text: 1 },
    { type: "copy", text: "x".repeat(32 * 1024 * 1024 + 4097) },
  ])
    events.emit("message", message);
  events.emit("message", {
    type: "copy",
    text: "Name\tfull symbol\nValue\t0xffffffffffffffff",
  });
  await copied;
  assert.deepEqual(written, ["Name\tfull symbol\nValue\t0xffffffffffffffff"]);
  assert.equal(sent.at(-1)?.type, "copied");
  connection.dispose();
});
