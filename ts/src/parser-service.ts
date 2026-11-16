import { Worker } from "node:worker_threads";
import type { ElfInfo } from "./protocol";
import type { WorkerResult } from "./worker";

export const maxFileBytes = 64 * 1024 * 1024;
const maxConcurrent = 2;
const maxQueued = 8;
const parseDeadlineMs = 30_000;

type Waiter = { start: () => void; cancel: () => void };

export class ParserService {
  private active = 0;
  private readonly waiting: Waiter[] = [];

  constructor(private readonly workerPath: string) {}

  private acquire(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (this.active < maxConcurrent) {
      this.active++;
      return Promise.resolve();
    }
    if (this.waiting.length >= maxQueued) {
      return Promise.reject(
        new Error(
          "Too many ELF previews are waiting. Close an existing preview and reopen this file.",
        ),
      );
    }
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        start: () => {
          signal.removeEventListener("abort", waiter.cancel);
          this.active++;
          resolve();
        },
        cancel: () => {
          this.waiting.splice(this.waiting.indexOf(waiter), 1);
          reject(new Error("ELF parsing cancelled"));
        },
      };
      this.waiting.push(waiter);
      signal.addEventListener("abort", waiter.cancel, { once: true });
    });
  }

  async parse(
    load: () => Promise<Uint8Array>,
    signal: AbortSignal,
  ): Promise<ElfInfo> {
    await this.acquire(signal);
    try {
      signal.throwIfAborted();
      const bytes = await load();
      signal.throwIfAborted();
      if (bytes.byteLength > maxFileBytes)
        throw new Error("ELF previews are limited to 64 MiB per file.");
      // A dedicated transferable buffer avoids detaching a provider's shared backing store.
      const data = Uint8Array.from(bytes);
      const worker = new Worker(this.workerPath);
      try {
        return await new Promise<ElfInfo>((resolve, reject) => {
          const abort = () => reject(new Error("ELF parsing cancelled"));
          const deadline = setTimeout(
            () =>
              reject(new Error("ELF parsing exceeded the 30 second limit.")),
            parseDeadlineMs,
          );
          const cleanup = () => {
            clearTimeout(deadline);
            signal.removeEventListener("abort", abort);
          };
          signal.addEventListener("abort", abort, { once: true });
          worker.once("message", (result: WorkerResult) => {
            cleanup();
            if (result.ok) resolve(result.data);
            else reject(new Error(result.message));
          });
          worker.once("error", (error) => {
            cleanup();
            reject(error);
          });
          worker.once("exit", (code) => {
            cleanup();
            reject(
              new Error(
                `ELF parser exited before returning a result (${code})`,
              ),
            );
          });
          worker.postMessage(data, [data.buffer]);
        });
      } finally {
        // Termination can interrupt synchronous Wasm; an abort message cannot.
        await worker.terminate();
      }
    } finally {
      this.active--;
      this.waiting.shift()?.start();
    }
  }
}
