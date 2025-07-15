import * as vscode from "vscode";
import * as path from "node:path";
import { bininspect } from "./bininspect";
import { WasmContext } from "@vscode/wasm-component-model";
import { Worker } from "node:worker_threads";
import { PartialFileReader } from "./fileReader";
import { attachPanelTransport, type PanelContext } from "./trpc";
import { EventEmitter } from "node:events";

class ElfPreviewExtension {
  private bininspect?: bininspect.Exports.Promisified;
  /** Background worker hosting the WebAssembly component */
  private worker?: Worker;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async activate(): Promise<void> {
    console.log("ELF Preview extension is now active!");

    try {
      await this.initializeParser();

      this.registerPreviewProvider();

      this.registerPreviewCommand();
    } catch (error) {
      this.handleInitializationError(error);
    }
  }

  /**
   * Loads the compiled WebAssembly module that implements the `bininspect` world and
   * binds the generated TypeScript interface so it can be used throughout the extension.
   */
  private async initializeParser(): Promise<void> {
    const wasmPath = vscode.Uri.file(
      path.join(this.context.extensionPath, "./dist", "bininspect.wasm"),
    );

    try {
      // Load the core-Wasm bytes and compile them once. The compiled
      // `WebAssembly.Module` travels to the worker thread where it is
      // instantiated (this avoids compiling twice).
      const bytes = await vscode.workspace.fs.readFile(wasmPath);
      const module = await WebAssembly.compile(bytes);

      // Spin up a dedicated worker that hosts the WebAssembly module. The path
      // targets the bundled worker script produced by esbuild (see esbuild.js).
      const workerPath = path.join(
        this.context.extensionPath,
        "dist",
        "wasmWorker.js",
      );
      const worker = new Worker(workerPath);
      // keep a reference so we can terminate it on deactivate
      this.worker = worker;

      const wasmContext: WasmContext.Default = new WasmContext.Default();

      // The async overload of `bind` accepts a pre-compiled module for core
      // Wasm + a `Worker` (MessagePort) and wires everything up asynchronously.
      this.bininspect = await bininspect._.bind(
        {},
        module,
        worker,
        wasmContext,
      );

      console.log("ELF Parser WebAssembly module loaded successfully");
    } catch (error) {
      console.error("Failed to load WebAssembly module:", error);
      throw error;
    }
  }

  private registerPreviewProvider(): void {
    const elfPreviewProvider = new PreviewProvider(
      this.context.extensionUri,
      this.bininspect,
    );

    this.context.subscriptions.push(
      vscode.window.registerCustomEditorProvider(
        "elfpreview.elfViewer",
        elfPreviewProvider,
        {
          webviewOptions: {
            retainContextWhenHidden: true,
          },
        },
      ),
    );
  }

  private registerPreviewCommand(): void {
    const disposable = vscode.commands.registerCommand(
      "elfpreview.showPreview",
      async (fileUri?: vscode.Uri) => {
        const uri = fileUri || this.getCurrentFileUri();

        if (!uri) {
          vscode.window.showInformationMessage("No ELF file selected.");
          return;
        }

        await vscode.commands.executeCommand(
          "vscode.openWith",
          uri,
          "elfpreview.elfViewer",
        );
      },
    );

    this.context.subscriptions.push(disposable);
  }

  private getCurrentFileUri(): vscode.Uri | undefined {
    return vscode.window.activeTextEditor?.document.uri;
  }

  private handleInitializationError(error: unknown): void {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown initialization error";

    vscode.window.showErrorMessage(
      `Failed to load ELF Preview: ${errorMessage}`,
    );
    console.error("ELF Preview initialization failed:", error);
  }

  dispose(): void {
    void this.worker?.terminate();
  }
}

class PreviewProvider implements vscode.CustomReadonlyEditorProvider {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly bininspect?: bininspect.Exports.Promisified,
  ) {}

  openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument> {
    return Promise.resolve({ uri, dispose: () => {} });
  }

  resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
  ): void {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    try {
      this.validateInspector();

      // Provide barebones HTML – the rest of the data flows via tRPC.
      this.setupWebview(webviewPanel, this.extractFilename(document.uri));

      // Create per-panel tRPC context & transport bridge.
      const ctx: PanelContext = {
        state: {
          fileKind: null,
          details: null,
          magicBytes: null,
          parseComplete: false,
          error: null,
        },
        events: new EventEmitter(),
      };

      attachPanelTransport(webviewPanel, ctx);

      // Start async parsing without blocking web-view initialisation.
      void this.startAsyncParsing(ctx, document);
    } catch (error) {
      this.handleWebviewError(webviewPanel, error);
    }
  }
  private validateInspector(): void {
    if (!this.bininspect) {
      throw new Error("ELF Parser not initialized");
    }
  }

  private setupWebview(
    webviewPanel: vscode.WebviewPanel,
    filename: string,
  ): void {
    const webviewScriptUri = this.getWebviewUri(webviewPanel.webview, [
      "dist",
      "webview.js",
    ]);

    const webviewStyleUri = this.getWebviewUri(webviewPanel.webview, [
      "dist",
      "webview.css",
    ]);

    webviewPanel.webview.html = this.generateWebviewHtml(
      webviewPanel.webview,
      webviewStyleUri,
      webviewScriptUri,
      filename,
    );
  }

  /**
   * Kick-off parsing in the background and expose results via the tRPC
   * `PanelContext`. Data becomes available incrementally so the client can
   * fetch what it needs when it needs it.
   */
  private async startAsyncParsing(
    ctx: PanelContext,
    document: vscode.CustomDocument,
  ): Promise<void> {
    try {
      const reader = new PartialFileReader(document.uri);
      const { size } = await vscode.workspace.fs.stat(document.uri);
      const header = await reader.readChunk(0, Math.min(size, 16));

      const fileKind = await this.bininspect!.inspector.identify(header);
      ctx.state.fileKind = fileKind;
      ctx.events.emit("update", { ...ctx.state });

      if (fileKind.isUnknown() || fileKind.isOther()) {
        ctx.state.error = "Unknown file format";
        ctx.state.parseComplete = true;
        ctx.events.emit("update", { ...ctx.state });
        return;
      }

      const data = await vscode.workspace.fs.readFile(document.uri);
      const details = await this.bininspect!.inspector.parse(data);
      ctx.state.details = details;
      ctx.state.parseComplete = true;
      ctx.events.emit("update", { ...ctx.state });
    } catch (err) {
      console.error("Error during async parsing:", err);
      ctx.state.error =
        err instanceof Error ? err.message : "Unknown parsing error";
      ctx.state.parseComplete = true;
      ctx.events.emit("update", { ...ctx.state });
    }
  }

  private getWebviewUri(
    webview: vscode.Webview,
    pathSegments: string[],
  ): vscode.Uri {
    return webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, ...pathSegments),
    );
  }

  private generateWebviewHtml(
    webview: vscode.Webview,
    styleUri: vscode.Uri,
    scriptUri: vscode.Uri,
    filename: string,
  ): string {
    const nonce = this.getNonce();

    const initialData = {
      filename,
    };

    const initialDataScript = /*html*/ `
        <script nonce="${nonce}">
          window.__INITIAL_DATA__ = ${JSON.stringify(initialData)};
        </script>
      `;

    return /*html*/ `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta http-equiv="Content-Security-Policy" content="
                default-src 'none'; 
                img-src ${webview.cspSource}; 
                style-src ${webview.cspSource}; 
                script-src 'nonce-${nonce}';">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <link href="${styleUri.toString()}" rel="stylesheet" />
              <title>ELF Preview</title>
            </head>
            <body>
              <div id="app"></div>
              ${initialDataScript}
              <script type="module" nonce="${nonce}" src="${scriptUri.toString()}"></script>
            </body>
          </html>
        `;
  }

  private extractFilename(uri: vscode.Uri): string {
    return uri.path.split("/").pop() || "Unknown ELF File";
  }

  private handleWebviewError(
    webviewPanel: vscode.WebviewPanel,
    error: unknown,
  ): void {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error parsing ELF file";

    webviewPanel.webview.html = /*html*/ `
          <html>
            <body>
              <div style="color: red; padding: 20px;">
                <h1>Error parsing ELF file</h1>
                <pre>${errorMessage}</pre>
              </div>
            </body>
          </html>
        `;
  }

  private getNonce(): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((n) => chars[n % chars.length])
      .join("");
  }

  // `replaceBigInts` helper no longer needed.
}

let extensionInstance: ElfPreviewExtension | undefined;

export function activate(context: vscode.ExtensionContext): Promise<void> {
  extensionInstance = new ElfPreviewExtension(context);
  return extensionInstance.activate();
}

export function deactivate() {
  extensionInstance?.dispose();
}
