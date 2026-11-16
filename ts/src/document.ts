import * as vscode from "vscode";
import { maxFileBytes, ParserService } from "./parser-service";
import type { PreviewState } from "./protocol";

export class ElfDocument implements vscode.CustomDocument {
  private readonly cancellation = new AbortController();
  private readonly changes = new vscode.EventEmitter<PreviewState>();
  readonly onDidChange = this.changes.event;
  private current: PreviewState;
  private readonly filename: string;

  constructor(
    readonly uri: vscode.Uri,
    parser: ParserService,
    log: vscode.LogOutputChannel,
  ) {
    this.filename = uri.path.split("/").pop() ?? "ELF file";
    this.current = { status: "loading", filename: this.filename };
    void parser
      .parse(async () => {
        const stat = await vscode.workspace.fs.stat(uri);
        this.cancellation.signal.throwIfAborted();
        if (stat.size > maxFileBytes)
          throw new Error("ELF previews are limited to 64 MiB per file.");
        return vscode.workspace.fs.readFile(uri);
      }, this.cancellation.signal)
      .then(
        (data) =>
          this.update({ status: "ready", filename: this.filename, data }),
        (error: unknown) => {
          if (this.cancellation.signal.aborted) return;
          const message =
            error instanceof Error ? error.message : String(error);
          log.error(`Cannot preview ${uri.toString()}: ${message}`);
          this.update({ status: "error", filename: this.filename, message });
        },
      );
  }

  get snapshot(): PreviewState {
    return this.current;
  }

  private update(state: PreviewState): void {
    if (this.cancellation.signal.aborted) return;
    this.current = state;
    this.changes.fire(state);
  }

  dispose(): void {
    this.cancellation.abort();
    this.changes.dispose();
    // Drop large arrays even if an already-disposed panel still references this document.
    this.current = { status: "loading", filename: this.filename };
  }
}
