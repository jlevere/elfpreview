import * as vscode from 'vscode';
import * as path from 'node:path';
import { elfpreview, type Types } from './elfpreview';
import { ElfFileReader } from './fileReader';
import { RAL, Memory, WasmContext } from '@vscode/wasm-component-model';

class ElfPreviewExtension {
    private elfParser?: elfpreview.Exports;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async activate(): Promise<void> {
        console.log('ELF Preview extension is now active!');

        try {
            await this.initializeElfParser();

            this.registerElfPreviewProvider();

            this.registerElfPreviewCommand();
        } catch (error) {
            this.handleInitializationError(error);
        }
    }

    private async initializeElfParser(): Promise<void> {
        const wasmPath = vscode.Uri.file(
            path.join(this.context.extensionPath, './dist', 'elfpreview.wasm'),
        );

        try {
            const bits = await vscode.workspace.fs.readFile(wasmPath);
            const module = await WebAssembly.compile(bits);

            const wasmContext: WasmContext.Default = new WasmContext.Default();
            const imports = elfpreview._.imports.create({}, wasmContext);

            const instance = await RAL().WebAssembly.instantiate(
                module,
                imports,
            );
            wasmContext.initialize(new Memory.Default(instance.exports));

            this.elfParser = elfpreview._.exports.bind(
                instance.exports as elfpreview._.Exports,
                wasmContext,
            );

            console.log('ELF Parser WebAssembly module loaded successfully');
        } catch (error) {
            console.error('Failed to load WebAssembly module:', error);
            throw error;
        }
    }

    private registerElfPreviewProvider(): void {
        const elfPreviewProvider = new ElfPreviewProvider(
            this.context.extensionUri,
            this.elfParser,
        );

        this.context.subscriptions.push(
            vscode.window.registerCustomEditorProvider(
                'elfpreview.elfViewer',
                elfPreviewProvider,
                {
                    webviewOptions: {
                        // reparse every time it comes into view.
                        // This helps lower mem usage since we are fast enough to do it
                        retainContextWhenHidden: false,
                    },
                },
            ),
        );
    }

    private registerElfPreviewCommand(): void {
        const disposable = vscode.commands.registerCommand(
            'elfpreview.showPreview',
            async (fileUri?: vscode.Uri) => {
                const uri = fileUri || this.getCurrentFileUri();

                if (!uri) {
                    vscode.window.showInformationMessage(
                        'No ELF file selected.',
                    );
                    return;
                }

                await vscode.commands.executeCommand(
                    'vscode.openWith',
                    uri,
                    'elfpreview.elfViewer',
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
            error instanceof Error
                ? error.message
                : 'Unknown initialization error';

        vscode.window.showErrorMessage(
            `Failed to load ELF Preview: ${errorMessage}`,
        );
        console.error('ELF Preview initialization failed:', error);
    }
}

class ElfPreviewProvider implements vscode.CustomReadonlyEditorProvider {
    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly elfParser?: elfpreview.Exports,
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
            this.validateElfParser();

            const fileReader = new ElfFileReader(document.uri);
            const filename = this.extractFilename(document.uri);

            // First, validate the ELF file, only reads 64 bytes
            await this.validateElfFile(fileReader);

            // Read the entire file once
            const elfData = await vscode.workspace.fs.readFile(document.uri);

            // Get quick file info for initial hydration
            const fileInfo = this.getQuickFileInfo(elfData);

            // Setup webview with basic structure
            this.setupWebview(webviewPanel, filename, fileInfo);

            // Begin the async parsing process after sending initial data
            await this.startAsyncParsing(webviewPanel, elfData);
        } catch (error) {
            this.handleWebviewError(webviewPanel, error);
        }
    }
    private validateElfParser(): void {
        if (!this.elfParser) {
            throw new Error('ELF Parser not initialized');
        }
    }

    private setupWebview(
        webviewPanel: vscode.WebviewPanel,
        filename: string,
        fileinfo: Types.Fileinfo,
    ): void {
        const webviewScriptUri = this.getWebviewUri(webviewPanel.webview, [
            'dist',
            'webview.js',
        ]);

        const webviewStyleUri = this.getWebviewUri(webviewPanel.webview, [
            'dist',
            'webview.css',
        ]);

        webviewPanel.webview.html = this.generateWebviewHtml(
            webviewPanel.webview,
            webviewStyleUri,
            webviewScriptUri,
            filename,
            fileinfo,
        );
    }

    private async startAsyncParsing(
        webviewPanel: vscode.WebviewPanel,
        elfData: Uint8Array,
    ): Promise<void> {
        try {
            // Start full ELF parsing in the background
            const parsedData = await this.parseElfDataAsync(elfData);

            // quick update stripped tag
            if (parsedData.info) {
                webviewPanel.webview.postMessage({
                    type: 'strip-info',
                    data: this.replaceBigInts(String(parsedData.info.stripped)),
                });
            }

            // Send section headers first (relatively small)
            if (parsedData.sectionheaders) {
                webviewPanel.webview.postMessage({
                    type: 'section-info',
                    data: this.replaceBigInts(parsedData.sectionheaders),
                });
            }

            // Short delay to allow UI to process
            await new Promise((resolve) => setTimeout(resolve, 50));

            // Send program headers next (also relatively small)
            if (parsedData.programheaders) {
                webviewPanel.webview.postMessage({
                    type: 'program-info',
                    data: this.replaceBigInts(parsedData.programheaders),
                });
            }

            // Another short delay
            await new Promise((resolve) => setTimeout(resolve, 50));

            // Send symbols last (potentially very large)
            if (parsedData.symbols) {
                webviewPanel.webview.postMessage({
                    type: 'symbol-info',
                    data: this.replaceBigInts(parsedData.symbols),
                });
            }

            // Send a completion message
            webviewPanel.webview.postMessage({
                type: 'parse-complete',
                data: { loadState: 'complete' },
            });
        } catch (error) {
            console.error('Error during async parsing:', error);
            webviewPanel.webview.postMessage({
                type: 'error',
                error:
                    error instanceof Error
                        ? error.message
                        : 'Unknown parsing error',
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
        fileinfo: Types.Fileinfo,
    ): string {
        const nonce = this.getNonce();

        // hydate with minimal info
        const initialData = {
            filename,
            fileinfo,
        };

        /* eslint-disable @typescript-eslint/no-unsafe-return */
        const initialDataScript = /*html*/ `
        <script nonce="${nonce}">
          window.__INITIAL_DATA__ = ${JSON.stringify(initialData, (_, v) => (typeof v === 'bigint' ? v.toString(10) : v))};
        </script>
      `;
        /* eslint-enable @typescript-eslint/no-unsafe-return */ //TODO: fix this bigint stuff.  its complicated.

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

    private getQuickFileInfo(elfData: Uint8Array): Types.Fileinfo {
        if (!this.elfParser) {
            throw new Error('ELF Parser not initialized');
        }
        return this.elfParser.elfparser.quickparseelf(elfData);
    }

    private async parseElfDataAsync(
        elfData: Uint8Array,
    ): Promise<Types.Elfinfo> {
        if (!this.elfParser) {
            return Promise.reject(new Error('ELF Parser not initialized'));
        }

        return Promise.resolve().then(() => {
            try {
                const result = this.elfParser!.elfparser.parseelf(elfData);
                return result;
            } catch (error) {
                throw error instanceof Error
                    ? error
                    : new Error('An unexpected error occurred');
            }
        });
    }

    private extractFilename(uri: vscode.Uri): string {
        return uri.path.split('/').pop() || 'Unknown ELF File';
    }

    private async validateElfFile(fileReader: ElfFileReader): Promise<void> {
        const headerData = await fileReader.readChunk(0, 64);

        if (!this.elfParser?.elfparser.validateelf(headerData)) {
            throw new Error('File is not recognized as an ELF');
        }
    }

    private handleWebviewError(
        webviewPanel: vscode.WebviewPanel,
        error: unknown,
    ): void {
        const errorMessage =
            error instanceof Error
                ? error.message
                : 'Unknown error parsing ELF file';

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
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map((n) => chars[n % chars.length])
            .join('');
    }

    private replaceBigInts = (obj: unknown): unknown => {
        if (typeof obj === 'bigint') {
            return obj.toString(10);
        } else if (Array.isArray(obj)) {
            return obj.map(this.replaceBigInts);
        } else if (obj && typeof obj === 'object') {
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
