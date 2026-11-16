import * as vscode from "vscode";
import { connect } from "node:net";
import { createInterface } from "node:readline";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type Command =
  | { action: "open"; uri: string }
  | { action: "theme"; theme: string }
  | { action: "assertClipboard"; text: string }
  | { action: "close" | "finish" | "hide" | "split" | "assertSingleRead" };

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("jlevere.elfpreview");
  assert.ok(extension);
  await extension.activate();
  assert.ok(process.env.ELFPREVIEW_FIXTURES);
  const bytes = await readFile(
    path.join(process.env.ELFPREVIEW_FIXTURES, "simple_test2"),
  );
  let reads = 0;
  const fileChanges = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  const readonly = () => {
    throw vscode.FileSystemError.NoPermissions();
  };
  const provider = vscode.workspace.registerFileSystemProvider(
    "elfpreview-test",
    {
      onDidChangeFile: fileChanges.event,
      watch: () => ({ dispose() {} }),
      stat: () => ({
        type: vscode.FileType.File,
        ctime: 0,
        mtime: 0,
        size: bytes.length,
      }),
      readFile: () => {
        reads++;
        return bytes;
      },
      readDirectory: () => [],
      writeFile: readonly,
      delete: readonly,
      rename: readonly,
      createDirectory: readonly,
    },
    { isReadonly: true },
  );
  const socket = connect(Number(process.env.ELFPREVIEW_TEST_PORT), "127.0.0.1");
  const lines = createInterface({ input: socket });
  socket.write(JSON.stringify({ ready: true }) + "\n");
  for await (const line of lines) {
    try {
      const command = JSON.parse(line) as Command;
      if (command.action === "open") {
        await vscode.commands.executeCommand(
          "vscode.openWith",
          vscode.Uri.parse(command.uri),
          "elfpreview.elfViewer",
        );
      } else if (command.action === "theme") {
        await vscode.workspace
          .getConfiguration("workbench")
          .update(
            "colorTheme",
            command.theme,
            vscode.ConfigurationTarget.Global,
          );
      } else if (command.action === "assertClipboard") {
        assert.equal(await vscode.env.clipboard.readText(), command.text);
      } else if (command.action === "split") {
        await vscode.commands.executeCommand(
          "workbench.action.splitEditorRight",
        );
      } else if (command.action === "assertSingleRead") {
        assert.equal(reads, 1, "Split views must reuse the document parse");
      } else if (command.action === "hide") {
        await vscode.window.showTextDocument(
          await vscode.workspace.openTextDocument({
            content: "ELF preview UI test",
          }),
        );
      } else {
        await vscode.commands.executeCommand(
          "workbench.action.closeAllEditors",
        );
      }
      socket.write(JSON.stringify({ ok: true }) + "\n");
      if (command.action === "finish") break;
    } catch (error) {
      socket.write(JSON.stringify({ error: String(error) }) + "\n");
    }
  }
  provider.dispose();
  fileChanges.dispose();
  socket.end();
  lines.close();
}
