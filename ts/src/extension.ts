import * as vscode from "vscode";
import * as path from "node:path";
import { bininspect, Types } from "./bininspect";
import { ElfFileReader } from "./fileReader";
import { WasmContext } from "@vscode/wasm-component-model";
import { Worker } from "node:worker_threads";

class ElfPreviewExtension {
  private bininspect?: bininspect.Exports.Promisified;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async activate(): Promise<void> {
    console.log("ELF Preview extension is now active!");

    try {
      await this.initializeElfParser();

      this.registerElfPreviewProvider();

      this.registerElfPreviewCommand();
    } catch (error) {
      this.handleInitializationError(error);
    }
  }

  /**
   * Loads the compiled WebAssembly module that implements the `bininspect` world and
   * binds the generated TypeScript interface so it can be used throughout the extension.
   */
  private async initializeElfParser(): Promise<void> {
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
      // targets the *bundled* worker script produced by esbuild (see esbuild.js).
      const workerPath = path.join(this.context.extensionPath, "dist", "wasmWorker.js");
      const worker = new Worker(workerPath);

      const wasmContext: WasmContext.Default = new WasmContext.Default();

      // The async overload of `bind` accepts a pre-compiled module for core
      // Wasm + a `Worker` (MessagePort) and wires everything up asynchronously.
      this.bininspect = await bininspect._.bind({}, module, worker, wasmContext);

      console.log("ELF Parser WebAssembly module loaded successfully");
    } catch (error) {
      console.error("Failed to load WebAssembly module:", error);
      throw error;
    }
  }

  private registerElfPreviewProvider(): void {
    const elfPreviewProvider = new ElfPreviewProvider(
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

  private registerElfPreviewCommand(): void {
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
}

class ElfPreviewProvider implements vscode.CustomReadonlyEditorProvider {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly bininspect?: bininspect.Exports.Promisified,
  ) {}

  openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument> {
    return Promise.resolve({ uri, dispose: () => {} });
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    try {
      this.validateInspector();

      const fileReader = new ElfFileReader(document.uri);
      const filename = this.extractFilename(document.uri);

      // First, validate the ELF file, only reads 64 bytes
      await this.validateElfFile(fileReader);

      // Read the entire file once
      const elfData = await vscode.workspace.fs.readFile(document.uri);

      // Get quick container-identification info for initial SSR
      const basicInfo = await this.getQuickFileInfo(elfData);

      // Setup the webview with the initial (format-agnostic) data
      this.setupWebview(webviewPanel, filename, basicInfo);

      // Begin the async parsing process after sending initial data
      await this.startAsyncParsing(webviewPanel, elfData);
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
    basicInfo: Types.BasicInfo,
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
      basicInfo,
    );
  }

  private serializeDetails(details: Types.Details): {
    tag: string;
    value?: unknown;
  } {
    // Extract the discriminant in a robust way – depending on whether we still have the
    // prototype or it has been stripped off (clone, JSON-serialisation, etc.).
    const tag: string =
      (details as unknown as { tag?: string }).tag ??
      // Fallback to the private _tag used inside VariantImpl
      (details as unknown as { _tag?: string })._tag ??
      "unsupported";

    // `value` can contain BigInts which cannot be exchanged via postMessage. Re-encode them.
    const serialisedValue =
      (details as unknown as { value?: unknown }).value !== undefined
        ? this.replaceBigInts((details as unknown as { value: unknown }).value)
        : undefined;

    return { tag, value: serialisedValue };
  }

  private serializeBasicInfo(info: Types.BasicInfo): unknown {
    // BigInts in `entryPoint` must be stringified for structured-clone safety.
    // Reuse the generic helper which traverses the object.
    return this.replaceBigInts(info);
  }

  private async startAsyncParsing(
    webviewPanel: vscode.WebviewPanel,
    elfData: Uint8Array,
  ): Promise<void> {
    try {
      // Run identification & full parse in parallel for performance.
      const [basicInfo, details] = await Promise.all([
        this.bininspect!.inspector.identify(elfData),
        this.parseElfDataAsync(elfData),
      ]);

      // Push the generic container header information.
      webviewPanel.webview.postMessage({
        type: "basic-info",
        data: this.serializeBasicInfo(basicInfo),
      });

      // Push the full parse results (variant-tagged & bigint-free).
      webviewPanel.webview.postMessage({
        type: "details",
        data: this.serializeDetails(details),
      });

      // If the format is unsupported, still forward the first 16 bytes as hex for UX niceties.
      if (details.isUnsupported()) {
        const magic = Array.from(elfData.slice(0, 16))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" ");
        webviewPanel.webview.postMessage({
          type: "magic-bytes",
          data: magic,
        });
      }

      webviewPanel.webview.postMessage({
        type: "parse-complete",
        data: { loadState: "complete" },
      });
    } catch (error) {
      console.error("Error during async parsing:", error);
      webviewPanel.webview.postMessage({
        type: "error",
        error: error instanceof Error ? error.message : "Unknown parsing error",
      });
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
    basicInfo: Types.BasicInfo,
  ): string {
    const nonce = this.getNonce();

    const initialData = {
      filename,
      basicInfo,
    };

    const initialDataScript = /*html*/ `
        <script nonce="${nonce}">
          window.__INITIAL_DATA__ = ${JSON.stringify(this.replaceBigInts(initialData))};
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

  private async getQuickFileInfo(data: Uint8Array): Promise<Types.BasicInfo> {
    if (!this.bininspect) {
      throw new Error("ELF Parser not initialized");
    }
    return this.bininspect.inspector.identify(data);
  }

  private async parseElfDataAsync(elfData: Uint8Array): Promise<Types.Details> {
    if (!this.bininspect) {
      throw new Error("ELF Parser not initialized");
    }
    return this.bininspect.inspector.parse(elfData);
  }

  private extractFilename(uri: vscode.Uri): string {
    return uri.path.split("/").pop() || "Unknown ELF File";
  }

  private async validateElfFile(fileReader: ElfFileReader): Promise<void> {
    const headerData = await fileReader.readChunk(0, 64);

    const basicInfo = await this.bininspect?.inspector.identify(headerData);
    if (!basicInfo || basicInfo.format !== Types.Format.elf) {
      throw new Error("File is not recognized as an ELF");
    }
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

  private replaceBigInts = (obj: unknown): unknown => {
    if (typeof obj === "bigint") {
      return obj.toString(10);
    } else if (Array.isArray(obj)) {
      return obj.map(this.replaceBigInts);
    } else if (obj && typeof obj === "object") {
      const result: { [key: string]: unknown } = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          result[key] = this.replaceBigInts(
            (obj as { [key: string]: unknown })[key],
          );
        }
      }
      return result;
    }
    return obj;
  };
}

export function activate(context: vscode.ExtensionContext): Promise<void> {
  const extension = new ElfPreviewExtension(context);
  return extension.activate();
}

export function deactivate() {}
