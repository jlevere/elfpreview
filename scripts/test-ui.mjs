import assert from "node:assert/strict";
import { createServer } from "node:net";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { _electron } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(
  path.join(
    process.platform === "darwin" ? "/tmp" : tmpdir(),
    "elfpreview-ui-",
  ),
);
const server = createServer();
let app;
let socket;
try {
  await mkdir(path.join(temporary, "profile/User"), { recursive: true });
  await writeFile(
    path.join(temporary, "profile/User/settings.json"),
    JSON.stringify({
      "telemetry.telemetryLevel": "off",
      "update.mode": "none",
      "extensions.autoUpdate": false,
      "workbench.startupEditor": "none",
      "window.restoreWindows": "none",
      "chat.disableAIFeatures": true,
      "workbench.editor.enablePreview": false,
    }),
  );
  await build({
    entryPoints: [path.join(root, "ts/test/ui-host.ts")],
    outfile: path.join(temporary, "suite.cjs"),
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["vscode"],
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const connected = once(server, "connection", {
    signal: AbortSignal.timeout(30_000),
  });
  app = await _electron.launch({
    executablePath: process.env.VSCODE_EXECUTABLE,
    args: [
      "--user-data-dir",
      path.join(temporary, "profile"),
      "--extensions-dir",
      path.join(temporary, "extensions"),
      "--extensionDevelopmentPath",
      root,
      "--extensionTestsPath",
      path.join(temporary, "suite.cjs"),
      "--disable-extensions",
      "--disable-workspace-trust",
      "--skip-welcome",
      "--skip-release-notes",
    ],
    env: { ...process.env, ELFPREVIEW_TEST_PORT: String(address.port) },
    timeout: 30_000,
  });
  [socket] = await connected;
  const messages = createInterface({ input: socket });
  // A queued async iterator preserves messages arriving during Electron startup.
  const replies = messages[Symbol.asyncIterator]();
  assert.deepEqual(JSON.parse((await replies.next()).value), { ready: true });
  const command = async (value) => {
    socket.write(JSON.stringify(value) + "\n");
    const reply = await replies.next();
    assert.ok(!reply.done, "Extension host disconnected");
    assert.deepEqual(JSON.parse(reply.value), { ok: true });
  };
  const page = await app.firstWindow();
  const frameReady = () =>
    new Promise((resolve, reject) => {
      const deadline = setTimeout(() => {
        cleanup();
        reject(new Error("ELF webview did not load"));
      }, 20_000);
      const cleanup = () => {
        clearTimeout(deadline);
        page.off("framenavigated", check);
      };
      const check = (frame) => {
        if (
          frame.url().includes("vscode-webview") &&
          frame.url().includes("id=")
        ) {
          // Only the inner webview contains the extension's document.
          frame
            .evaluate(() => document.getElementById("app") !== null)
            .then((found) => {
              if (found) {
                cleanup();
                resolve(frame);
              }
            })
            .catch(() => {});
        }
      };
      page.on("framenavigated", check);
      for (const frame of page.frames()) check(frame);
    });
  const settled = (frame) =>
    frame.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const deadline = setTimeout(() => {
            observer.disconnect();
            reject(new Error("Preview remained loading"));
          }, 20_000);
          const check = () => {
            if (document.querySelector(".basic-info, [role=alert]")) {
              clearTimeout(deadline);
              observer.disconnect();
              resolve(document.body.innerText);
            }
          };
          const observer = new MutationObserver(check);
          observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            characterData: true,
          });
          check();
        }),
    );
  for (const [fixture, expected] of [
    ["simple_test", "00000000000023d0"],
    ["simple_test2", "23328"],
    ["go-away", "Big Endian"],
    ["phdr.73prg.bin", "73"],
  ]) {
    const framePromise = frameReady();
    await command({
      action: "open",
      uri: pathToFileURL(path.join(root, "rust/tests/fixtures", fixture)).href,
    });
    const frame = await framePromise;
    const text = await settled(frame);
    assert.ok(text.includes(fixture));
    assert.ok(
      text.includes(expected),
      `${fixture}: expected ${expected}, got ${text}`,
    );
    console.log(`Rendered ${fixture} in VS Code`);
    await command({ action: "close" });
  }
  const malformed = path.join(temporary, "<img onerror=alert(1)>");
  await writeFile(malformed, "not an ELF");
  const framePromise = frameReady();
  await command({ action: "open", uri: pathToFileURL(malformed).href });
  const frame = await framePromise;
  assert.ok((await settled(frame)).includes("Unable to preview ELF"));
  assert.equal(await frame.locator("img").count(), 0);
  assert.equal(await frame.locator("[role=status]").count(), 0);
  console.log("Malformed ELF reaches a safe error view");
  await command({ action: "finish" });
  messages.close();
} finally {
  socket?.destroy();
  server.close();
  await app?.close();
  await rm(temporary, { recursive: true, force: true });
}
