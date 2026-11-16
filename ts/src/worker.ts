import { parentPort } from "node:worker_threads";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ElfParser } from "./parser";
import { toWire, type ElfInfo } from "./protocol";

export type WorkerResult =
  | { ok: true; data: ElfInfo }
  | { ok: false; message: string };

const port = parentPort;
if (!port) throw new Error("Parser must run in a worker");
port.once("message", (bytes: Uint8Array) => {
  void (async () => {
    let result: WorkerResult;
    try {
      const parser = await ElfParser.create(
        await readFile(path.join(__dirname, "elfpreview.wasm")),
      );
      result = { ok: true, data: toWire(parser.parse(bytes)) };
    } catch (error) {
      result = {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    port.postMessage(result);
    port.close();
  })();
});
