import * as vscode from "vscode";
import { ParserService } from "./parser-service";
import { ElfDocument } from "./document";
import { connectView, webviewHtml } from "./view";

const viewType = "elfpreview.elfViewer";

class ElfPreviewProvider
  implements vscode.CustomReadonlyEditorProvider<ElfDocument>
{
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly parser: ParserService,
    private readonly log: vscode.LogOutputChannel,
  ) {}

  openCustomDocument(
    uri: vscode.Uri,
    _context: vscode.CustomDocumentOpenContext,
    token: vscode.CancellationToken,
  ): ElfDocument {
    if (token.isCancellationRequested) throw new vscode.CancellationError();
    return new ElfDocument(uri, this.parser, this.log);
  }

  resolveCustomEditor(document: ElfDocument, panel: vscode.WebviewPanel): void {
    const connection = connectView(
      panel.webview,
      () => document.snapshot,
      document.onDidChange,
    );
    panel.onDidDispose(() => connection.dispose());
    const dist = vscode.Uri.joinPath(this.extensionUri, "dist");
    panel.webview.options = { enableScripts: true, localResourceRoots: [dist] };
    panel.webview.html = webviewHtml(
      panel.webview.cspSource,
      panel.webview
        .asWebviewUri(vscode.Uri.joinPath(dist, "webview.js"))
        .toString(),
      panel.webview
        .asWebviewUri(vscode.Uri.joinPath(dist, "webview.css"))
        .toString(),
    );
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel("ELF Preview", { log: true });
  const parser = new ParserService(
    vscode.Uri.joinPath(context.extensionUri, "dist", "worker.js").fsPath,
  );
  context.subscriptions.push(
    log,

    vscode.window.registerCustomEditorProvider(
      viewType,
      new ElfPreviewProvider(context.extensionUri, parser, log),
      { supportsMultipleEditorsPerDocument: true },
    ),
    vscode.commands.registerCommand(
      "elfpreview.showPreview",
      async (uri?: vscode.Uri) => {
        const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
        const current =
          input instanceof vscode.TabInputCustom
            ? input.uri
            : vscode.window.activeTextEditor?.document.uri;
        const target = uri ?? current;
        if (target)
          await vscode.commands.executeCommand(
            "vscode.openWith",
            target,
            viewType,
          );
        else void vscode.window.showInformationMessage("No ELF file selected.");
      },
    ),
  );
}
