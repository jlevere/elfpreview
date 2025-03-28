import * as vscode from 'vscode';
import * as path from 'path';
import { elfpreview, Types } from './elfpreview';
import { ElfFileReader } from './fileReader';
import { RAL, Memory, WasmContext } from '@vscode/wasm-component-model';

let elfParser: elfpreview.Exports | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('ELF Preview extension is now active!');

    // Load and initialize the WebAssembly module
    try {
        // Get the path to the WebAssembly file
        const wasmPath = vscode.Uri.file(path.join(context.extensionPath, './dist', 'elfpreview.wasm'));

        // Load the WebAssembly module
        const bits = await vscode.workspace.fs.readFile(wasmPath);
        const module = await WebAssembly.compile(bits);

        // Create a memory and context for the WebAssembly module
        const wasmContext: WasmContext.Default = new WasmContext.Default();

        // Create the imports object (empty in this case as we don't have any imports)
        const imports = elfpreview._.imports.create({}, wasmContext);

        // Instantiate the WebAssembly module
        const instance = await RAL().WebAssembly.instantiate(module, imports);
        wasmContext.initialize(new Memory.Default(instance.exports));
        // Bind the exports to our interface
        elfParser = elfpreview._.exports.bind(instance.exports as elfpreview._.Exports, wasmContext);

        console.log('ELF Parser WebAssembly module loaded successfully');
    } catch (error) {
        console.error('Failed to load WebAssembly module:', error);
        vscode.window.showErrorMessage('Failed to load ELF Parser: ' + error);
    }

    // Register a custom editor provider for ELF files
    const elfPreviewProvider = new ElfPreviewProvider(context.extensionUri);
    context.subscriptions.push(
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

    // Register a custom command provider for ELF files
    const disposable = vscode.commands.registerCommand('elfpreview.showPreview', async (fileUri?: vscode.Uri) => {
        let uri: vscode.Uri | undefined = fileUri;

        if (!uri && vscode.window.activeTextEditor) {
            uri = vscode.window.activeTextEditor.document.uri;
        }

        if (!uri) {
            vscode.window.showInformationMessage('No ELF file selected.');
            return;
        }

        await vscode.commands.executeCommand(
            'vscode.openWith',
            uri,
            'elfpreview.elfViewer'
        );
    });

    context.subscriptions.push(disposable);
}

class ElfPreviewProvider implements vscode.CustomReadonlyEditorProvider {
    constructor(private readonly extensionUri: vscode.Uri) { }

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
            if (!elfParser) {
                throw new Error('ELF Parser not initialized');
            }

            const fileReader = new ElfFileReader(document.uri);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars 
            const filename = document.uri.path.split('/').pop() || "Unknown ELF File";


            const headerData = await fileReader.readChunk(0, 64);

            const isvalid = elfParser.elfparser.validateelf(headerData);
            if (!isvalid) {
                throw new Error(`File is not recognized as an elf`);
            };

            const elfData = await vscode.workspace.fs.readFile(document.uri);

            // eslint-disable-next-line @typescript-eslint/no-unused-vars 
            const parsedData = elfParser.elfparser.parseelf(elfData);


            // // Set up the webview HTML
            // webviewPanel.webview.html = this.getHtmlForWebview(
            //     parsedData,
            //     filename,
            // );

            const webviewScriptUri = webviewPanel.webview.asWebviewUri(vscode.Uri.joinPath(
                this.extensionUri,
                'dist',
                'webview.js'
            ));

            const webviewStyleUri = webviewPanel.webview.asWebviewUri(vscode.Uri.joinPath(
                this.extensionUri,
                'dist',
                'webview.css'
            ));


            // Generate HTML with the correct script source
            webviewPanel.webview.html = this.newgetHtmlForWebview(webviewPanel.webview, webviewStyleUri.toString(), webviewScriptUri.toString(), getNonce());


        } catch (error) {
            webviewPanel.webview.html = /*html*/  `<html><body>
                <div style="color: red; padding: 20px;">
                    <h1>Error parsing ELF file</h1>
                    <pre>${error}</pre>
                </div>
            </body></html>`; // TODO: break this out into jsx stuff
        }
    }

    private newgetHtmlForWebview(webview: vscode.Webview, styleUri: string, scriptUri: string, nonce: string): string {

        return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
        <html>
          <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

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


    // TODO: breakout into tsx/jsx stuff
    private getHtmlForWebview(data: Types.Elfinfo, filename: string): string {
        try {
            return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${filename}</title>
    <style>
        body {
            font-family: var(--vscode-editor-font-family);
            padding: 0;
            margin: 0;
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
        }
        
        .container {
            padding: 20px;
        }
        
        h1, h2, h3 {
            color: var(--vscode-editor-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 5px;
        }
        
        table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 20px;
        }
        
        th, td {
            border: 1px solid var(--vscode-panel-border);
            padding: 8px;
            text-align: left;
        }
        
        th {
            background-color: var(--vscode-panel-background);
        }
        
        tr:nth-child(even) {
            background-color: var(--vscode-list-inactiveSelectionBackground);
        }
        
        .tab {
            overflow: hidden;
            border: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-panel-background);
        }
        
        .tab button {
            background-color: inherit;
            color: var(--vscode-editor-foreground);
            float: left;
            border: none;
            outline: none;
            cursor: pointer;
            padding: 10px 16px;
            transition: 0.3s;
        }
        
        .tab button:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .tab button.active {
            background-color: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }

        .tabcontent {
            display: none;
            padding: 6px 12px;
            border: 1px solid var(--vscode-panel-border);
            border-top: none;
        }

        #symbolFilter {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            padding: 8px 12px;
            color: var(--vscode-editor-foreground);
            margin-bottom: 10px;
            border-radius: 4px;
        }

        .file-info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }

        .file-metadata {
            margin-bottom: 20px;
        }

        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            margin-left: 10px;
            font-size: 12px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${filename} 
            ${data.info.stripped ?
                    '<span class="badge" title="Debug symbols have been removed">Stripped</span>' :
                    '<span class="badge" style="color: black; background-color: var(--vscode-debugIcon-startForeground)">Debug Symbols</span>'}
        </h1>
        
       <div class="basic-info">
            <h2>File Information</h2>
            <div class="file-info-grid">
                <div class="file-metadata">
                    <table>
                        <tr>
                            <th>File Type:</th>
                            <td>${data.info.filetype}</td>
                        </tr>
                        <tr>
                            <th>Machine Architecture:</th>
                            <td>${data.info.machine}</td>
                        </tr>
                        <tr>
                            <th>Class:</th>
                            <td>${data.info.class}</td>
                        </tr>
                        <tr>
                            <th>Endianness:</th>
                            <td>${data.info.endianness}</td>
                        </tr>
                        <tr>
                            <th>OS ABI:</th>
                            <td>${data.info.osabi}</td>
                        </tr>
                    </table>
                </div>
                <div class="file-metadata">
                    <table>
                        <tr>
                            <th>Entry Point:</th>
                            <td>0x${data.info.entrypoint.toString(16)}</td>
                        </tr>
                        <tr>
                            <th>ELF Version:</th>
                            <td>${data.info.version}</td>
                        </tr>
                        <tr>
                            <th>Symbols:</th>
                            <td>${data.symbols.length}</td>
                        </tr>
                        <tr>
                            <th>Sections:</th>
                            <td>${data.sectionheaders.length}</td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>
        
        <div class="tab">
            <button class="tablinks active" onclick="openTab(event, 'Sections')">Sections</button>
            <button class="tablinks" onclick="openTab(event, 'Programs')">Program Headers</button>
            <button class="tablinks" onclick="openTab(event, 'Symbols')">Symbols</button>
        </div>
        
        <div id="Sections" class="tabcontent" style="display: block;">
            <h3>Section Headers</h3>
            <table>
                <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Address</th>
                    <th>Size</th>
                </tr>
                ${data.sectionheaders.map((section: Types.Sectioninfo) => `
                <tr>
                    <td>${section.name}</td>
                    <td>${section.typename}</td>
                    <td>0x${section.address.toString(16)}</td>
                    <td>${section.size}</td>
                </tr>
                `).join('')}
            </table>
        </div>
        
        <div id="Programs" class="tabcontent">
            <h3>Program Headers</h3>
            <table>
                <tr>
                    <th>Type</th>
                    <th>Flags</th>
                    <th>Virtual Address</th>
                    <th>Physical Address</th>
                    <th>File Size</th>
                    <th>Memory Size</th>
                </tr>
                ${data.programheaders.map((program: Types.Programinfo) => `
                <tr>
                    <td>${program.typename}</td>
                    <td>${program.flagstring}</td>
                    <td>0x${program.vaddr.toString(16)}</td>
                    <td>0x${program.paddr.toString(16)}</td>
                    <td>${program.filesz}</td>
                    <td>${program.memsz}</td>
                </tr>
                `).join('')}
            </table>
        </div>
        
        <div id="Symbols" class="tabcontent">
            <h3>Symbols</h3>
            <input type="text" id="symbolFilter" placeholder="Filter symbols..." onkeyup="filterSymbols()">
            <table id="symbolTable">
                <tr>
                    <th>Name</th>
                    <th>Value</th>
                    <th>Size</th>
                    <th>Type</th>
                </tr>
                ${data.symbols.map((symbol: Types.Symbolinfo) => `
                <tr>
                    <td>${symbol.name}</td>
                    <td>0x${symbol.value.toString(16)}</td>
                    <td>${symbol.size}</td>
                    <td>${symbol.isfunction ? 'FUNC' : 'OBJECT'}</td>
                </tr>
                `).join('')}
            </table>
        </div>
    </div>
    
    <script>
    function openTab(evt, tabName) {
        var i, tabcontent, tablinks;
        
        tabcontent = document.getElementsByClassName("tabcontent");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }
        
        tablinks = document.getElementsByClassName("tablinks");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }
        
        document.getElementById(tabName).style.display = "block";
        evt.currentTarget.className += " active";
    }
    
    function filterSymbols() {
        const input = document.getElementById("symbolFilter");
        const filter = input.value.toUpperCase();
        const table = document.getElementById("symbolTable");
        const tr = table.getElementsByTagName("tr");
        
        for (let i = 1; i < tr.length; i++) {
            const td = tr[i].getElementsByTagName("td")[0];
            if (td) {
                const txtValue = td.textContent || td.innerText;
                if (txtValue.toUpperCase().indexOf(filter) > -1) {
                    tr[i].style.display = "";
                } else {
                    tr[i].style.display = "none";
                }
            }
        }
    }
    </script>
</body>
</html>`;
        } catch (error) {
            return `<html><body>
                <div style="color: red; padding: 20px;">
                    <h1>Error rendering ELF data</h1>
                    <pre>${error}</pre>
                </div>
            </body></html>`;
        }
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function deactivate() { }