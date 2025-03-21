import * as vscode from 'vscode';
import * as path from 'path';
import { elfpreview } from './elfpreview';
import { Types } from './elfpreview';


import { RAL, Memory, WasmContext, ResourceManagers } from '@vscode/wasm-component-model';


let elfParser: elfpreview.Exports | undefined;

export async function activate(context: vscode.ExtensionContext) {
    console.log('ELF Preview extension is now active!');

    // Load and initialize the WebAssembly module
    try {
        // Get the path to the WebAssembly file
        const wasmPath = vscode.Uri.file(path.join(context.extensionPath, 'target/wasm32-unknown-unknown/debug/', 'elfpreview.wasm'));
        const wasmUri = wasmPath.with({ scheme: 'vscode-resource' });

        // Load the WebAssembly module
        const wasmBytes = await vscode.workspace.fs.readFile(wasmPath);
        const wasmModule = await WebAssembly.compile(wasmBytes);

        // Create a memory and context for the WebAssembly module
        let memory: Memory | undefined;
        const wasmContext: WasmContext = {
            options: { encoding: 'utf-8' },
            resources: new ResourceManagers.Default(),
            getMemory: () => {
                if (memory === undefined) {
                    throw new Error('Memory not yet initialized');
                }
                return memory;
            }
        };

        // Create the imports object (empty in this case as we don't have any imports)
        const imports = elfpreview._.imports.create({}, wasmContext);

        // Instantiate the WebAssembly module
        const instance = await RAL().WebAssembly.instantiate(wasmModule, imports);
        memory = new Memory.Default(instance.exports);

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
                webviewOptions: { retainContextWhenHidden: true }
            }
        )
    );

    // Register the command to open an ELF file preview
    const disposable = vscode.commands.registerCommand('elfpreview.showPreview', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('Open an ELF file first.');
            return;
        }

        // Open the document with our custom editor
        await vscode.commands.executeCommand(
            'vscode.openWith',
            editor.document.uri,
            'elfpreview.elfViewer'
        );
    });

    context.subscriptions.push(disposable);
}

class ElfPreviewProvider implements vscode.CustomReadonlyEditorProvider {
    constructor(private readonly extensionUri: vscode.Uri) { }

    async openCustomDocument(
        uri: vscode.Uri,
        openContext: vscode.CustomDocumentOpenContext,
        token: vscode.CancellationToken
    ): Promise<vscode.CustomDocument> {
        return { uri, dispose: () => { } };
    }

    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        const uri = document.uri;
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        try {
            // Read the ELF file
            const fileData = await vscode.workspace.fs.readFile(uri);

            if (!elfParser) {
                throw new Error('ELF Parser not initialized');
            }

            // Parse the ELF data using our WebAssembly module
            const parsedData = elfParser.elfparser.parseelf(fileData);

            // Convert the parsed data to a format suitable for our HTML template
            const elfData = this.formatElfData(parsedData);

            // Set up the webview HTML
            webviewPanel.webview.html = this.getHtmlForWebview(
                webviewPanel.webview,
                elfData
            );
        } catch (error) {
            webviewPanel.webview.html = `<html><body>
                <div style="color: red; padding: 20px;">
                    <h1>Error parsing ELF file</h1>
                    <pre>${error}</pre>
                </div>
            </body></html>`;
        }
    }

    private formatElfData(elfInfo: Types.Elfinfo): string {

        const bigIntReplacer = (key: string, value: any) => {
            if (typeof value === 'bigint') {
                return value.toString();
            }
            return value;
        };

        return JSON.stringify({
            machine: elfInfo.machine,
            entry_point: elfInfo.entrypoint,
            section_headers: elfInfo.sectionheaders.map(section => ({
                name: section.name,
                type_name: section.typename,
                address: section.address,
                size: section.size
            })),
            program_headers: elfInfo.programheaders.map(program => ({
                type_name: program.typename,
                flags: program.flagstring,
                vaddr: program.vaddr,
                paddr: program.paddr,
                filesz: program.filesz,
                memsz: program.memsz
            })),
            symbols: elfInfo.symbols.map(symbol => ({
                name: symbol.name,
                value: symbol.value,
                size: symbol.size,
                is_function: symbol.isfunction
            }))
        }, bigIntReplacer);
    }

    private getHtmlForWebview(webview: vscode.Webview, elfDataJson: string): string {
        try {
            // Parse JSON data
            const data = JSON.parse(elfDataJson);

            // Check if there was an error
            if (data.error) {
                return `<html><body>
                    <div style="color: red; padding: 20px;">
                        <h1>Error parsing ELF file</h1>
                        <pre>${data.error}</pre>
                    </div>
                </body></html>`;
            }

            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ELF File Preview</title>
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
    </style>
</head>
<body>
    <div class="container">
        <h1>ELF File Preview</h1>
        
        <div class="basic-info">
            <h2>Basic Information</h2>
            <table>
                <tr>
                    <th>Machine:</th>
                    <td>${data.machine}</td>
                </tr>
                <tr>
                    <th>Entry Point:</th>
                    <td>0x${data.entry_point.toString(16)}</td>
                </tr>
            </table>
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
                ${data.section_headers.map((section: Types.Sectioninfo) => `
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
                ${data.program_headers.map((program: Types.Programinfo) => `
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

export function deactivate() { }