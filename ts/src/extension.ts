import * as vscode from "vscode";
import { ElfParser } from "./parser";
import { toWire, type PreviewState } from "./protocol";
import { connectView, webviewHtml } from "./view";

const viewType = "elfpreview.elfViewer";

class ElfPreviewProvider implements vscode.CustomReadonlyEditorProvider {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly parser: ElfParser,
  ) {}

  openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
    return { uri, dispose() {} };
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    panel: vscode.WebviewPanel,
  ): Promise<void> {
    const filename = document.uri.path.split("/").pop() ?? "ELF file";
    let state: PreviewState = { status: "loading", filename };
    const changes = new vscode.EventEmitter<PreviewState>();
    const connection = connectView(panel.webview, () => state, changes.event);
    let disposed = false;
    panel.onDidDispose(() => {
      disposed = true;
      connection.dispose();
      changes.dispose();
    });
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
    try {
      const bytes = await vscode.workspace.fs.readFile(document.uri);
      if (disposed) return;
      state = {
        status: "ready",
        filename,
        data: toWire(this.parser.parse(bytes)),
      };
    } catch (error) {
      state = {
        status: "error",
        filename,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    if (!disposed) changes.fire(state);
  }
}

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const parser = await ElfParser.create(
    await vscode.workspace.fs.readFile(
      vscode.Uri.joinPath(context.extensionUri, "dist", "elfpreview.wasm"),
    ),
  );
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      viewType,
      new ElfPreviewProvider(context.extensionUri, parser),
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
