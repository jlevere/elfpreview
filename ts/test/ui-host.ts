import * as vscode from "vscode";
import { connect } from "node:net";
import { createInterface } from "node:readline";
import assert from "node:assert/strict";

type Command =
  | { action: "open"; uri: string }
  | { action: "close" | "finish" | "hide" };

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("jlevere.elfpreview");
  assert.ok(extension);
  await extension.activate();
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
  socket.end();
  lines.close();
}
