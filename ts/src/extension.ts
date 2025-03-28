import * as vscode from 'vscode';
import * as path from 'path';
import { elfpreview, Types } from './elfpreview';
import { ElfFileReader } from './fileReader';
import { SveltePanel } from './webview_inf';
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
            path.join(this.context.extensionPath, './dist', 'elfpreview.wasm')
        );

        try {
            const bits = await vscode.workspace.fs.readFile(wasmPath);
            const module = await WebAssembly.compile(bits);

            const wasmContext: WasmContext.Default = new WasmContext.Default();
            const imports = elfpreview._.imports.create({}, wasmContext);

            const instance = await RAL().WebAssembly.instantiate(module, imports);
            wasmContext.initialize(new Memory.Default(instance.exports));

            this.elfParser = elfpreview._.exports.bind(
                instance.exports as elfpreview._.Exports,
                wasmContext
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
            this.elfParser
        );

        this.context.subscriptions.push(
            vscode.window.registerCustomEditorProvider(
                'elfpreview.elfViewer',
                elfPreviewProvider,
                {
                    webviewOptions: {
                        // reparse every time it comes into view.
                        // This helps lower mem usage since we are fast enough to do it
                        retainContextWhenHidden: false
                    }
                }
            )
        );
    }

    private registerElfPreviewCommand(): void {
        const disposable = vscode.commands.registerCommand(
            'elfpreview.showPreview',
            async (fileUri?: vscode.Uri) => {
                const uri = fileUri || this.getCurrentFileUri();

                if (!uri) {
                    vscode.window.showInformationMessage('No ELF file selected.');
                    return;
                }

                await vscode.commands.executeCommand(
                    'vscode.openWith',
                    uri,
                    'elfpreview.elfViewer'
                );
            }
        );

        this.context.subscriptions.push(disposable);
    }

    private getCurrentFileUri(): vscode.Uri | undefined {
        return vscode.window.activeTextEditor?.document.uri;
    }

    private handleInitializationError(error: unknown): void {
        const errorMessage = error instanceof Error
            ? error.message
            : 'Unknown initialization error';

        vscode.window.showErrorMessage(`Failed to load ELF Preview: ${errorMessage}`);
        console.error('ELF Preview initialization failed:', error);
    }
}



class ElfPreviewProvider implements vscode.CustomReadonlyEditorProvider {
    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly elfParser?: elfpreview.Exports
    ) { }

    async openCustomDocument(
        uri: vscode.Uri,
    ): Promise<vscode.CustomDocument> {
        return { uri, dispose: () => { } };
    }


    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        try {
            this.validateElfParser();

            const fileReader = new ElfFileReader(document.uri);
            const filename = this.extractFilename(document.uri);

            await this.validateElfFile(fileReader);

            const elfData = await vscode.workspace.fs.readFile(document.uri);
            const parsedData = this.parseElfData(elfData);

            this.setupWebview(webviewPanel, parsedData, filename);
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
        parsedData: Types.Elfinfo,
        filename: string
    ): void {
        const webviewScriptUri = this.getWebviewUri(
            webviewPanel.webview,
            ['dist', 'webview.js']
        );

        const webviewStyleUri = this.getWebviewUri(
            webviewPanel.webview,
            ['dist', 'webview.css']
        );

        webviewPanel.webview.html = this.generateWebviewHtml(
            webviewPanel.webview,
            webviewStyleUri,
            webviewScriptUri
        );


        webviewPanel.webview.postMessage({
            type: 'initial-load',
            data: this.replaceBigInts(parsedData)
        });
    }

    private getWebviewUri(
        webview: vscode.Webview,
        pathSegments: string[]
    ): vscode.Uri {
        return webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, ...pathSegments)
        );
    }

    private generateWebviewHtml(
        webview: vscode.Webview,
        styleUri: vscode.Uri,
        scriptUri: vscode.Uri
    ): string {
        const nonce = this.getNonce();

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
              <link href="${styleUri}" rel="stylesheet" />
              <title>ELF Preview</title>
            </head>
            <body>
              <div id="app"></div>
              <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
            </body>
          </html>
        `;
    }

    private extractFilename(uri: vscode.Uri): string {
        return uri.path.split('/').pop() || "Unknown ELF File";
    }

    private async validateElfFile(fileReader: ElfFileReader): Promise<void> {
        const headerData = await fileReader.readChunk(0, 64);

        if (!this.elfParser?.elfparser.validateelf(headerData)) {
            throw new Error('File is not recognized as an ELF');
        }
    }

    private parseElfData(elfData: Uint8Array): Types.Elfinfo {
        if (!this.elfParser) {
            throw new Error('ELF Parser not initialized');
        }
        return this.elfParser.elfparser.parseelf(elfData);
    }

    private handleWebviewError(
        webviewPanel: vscode.WebviewPanel,
        error: unknown
    ): void {
        const errorMessage = error instanceof Error
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
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map((n) => chars[n % chars.length])
            .join('');
    }

    private replaceBigInts = (obj: unknown): unknown => {
        if (typeof obj === 'bigint') {
            return obj.toString();
        } else if (Array.isArray(obj)) {
            return obj.map(this.replaceBigInts);
        } else if (obj && typeof obj === 'object') {
            const result: { [key: string]: unknown } = {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    result[key] = this.replaceBigInts((obj as { [key: string]: unknown })[key]);
                }
            }
            return result;
        }
        return obj;
    }

}


export function activate(context: vscode.ExtensionContext): Promise<void> {
    const extension = new ElfPreviewExtension(context);
    return extension.activate();
}

export function deactivate() { }

