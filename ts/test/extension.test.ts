import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import * as vscode from "vscode";
export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("jlevere.elfpreview");
  assert.ok(extension, "Development extension must be discoverable");
  await extension.activate();
  assert.ok(
    (await vscode.commands.getCommands(true)).includes(
      "elfpreview.showPreview",
    ),
  );
  try {
    for (const fixture of [
      "simple_test",
      "simple_test2",
      "go-away",
      "phdr.73prg.bin",
    ]) {
      const uri = vscode.Uri.joinPath(
        extension.extensionUri,
        "rust/tests/fixtures",
        fixture,
      );
      await vscode.commands.executeCommand("elfpreview.showPreview", uri);
      const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
      assert.ok(input instanceof vscode.TabInputCustom);
      assert.equal(input.viewType, "elfpreview.elfViewer");
      assert.equal(input.uri.toString(), uri.toString());
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor",
      );
    }
  } finally {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  }
  const resultPath = process.env.ELFPREVIEW_TEST_RESULT;
  assert.ok(resultPath);
  await writeFile(resultPath, "passed");
  console.log(
    "ELF Preview: activation and four fixture editor lifecycles passed",
  );
}
