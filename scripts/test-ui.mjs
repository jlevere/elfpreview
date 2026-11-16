import assert from "node:assert/strict";
import { createServer } from "node:net";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
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
  let extensionPath = root;
  if (process.env.ELFPREVIEW_VSIX) {
    assert.ok(process.env.VSCODE_CLI, "Set VSCODE_CLI to install the VSIX");
    await promisify(execFile)(
      process.env.VSCODE_CLI,
      [
        "--user-data-dir",
        path.join(temporary, "profile"),
        "--extensions-dir",
        path.join(temporary, "extensions"),
        "--install-extension",
        path.resolve(process.env.ELFPREVIEW_VSIX),
        "--force",
      ],
      { timeout: 30_000 },
    );
    const installed = (await readdir(path.join(temporary, "extensions"))).find(
      (name) => name.startsWith("jlevere.elfpreview-"),
    );
    assert.ok(
      installed,
      "VSIX must be installed in the isolated extension directory",
    );
    extensionPath = path.join(temporary, "extensions", installed);
    console.log("Testing the installed VSIX");
  }
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
      extensionPath,
      "--extensionTestsPath",
      path.join(temporary, "suite.cjs"),
      "--disable-extensions",
      "--disable-workspace-trust",
      "--skip-welcome",
      "--skip-release-notes",
    ],
    env: {
      ...process.env,
      ELFPREVIEW_TEST_PORT: String(address.port),
      ELFPREVIEW_FIXTURES: path.join(root, "rust/tests/fixtures"),
    },
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
  const frameReady = (exclude = new Set()) =>
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
          !exclude.has(frame) &&
          frame.url().includes("vscode-webview") &&
          frame.url().includes("id=")
        ) {
          // Only the inner webview contains the extension's document.
          frame
            .evaluate(
              () =>
                new Promise((resolve) => {
                  const check = () => {
                    if (document.getElementById("app")) {
                      observer.disconnect();
                      resolve(true);
                    }
                  };
                  const observer = new MutationObserver(check);
                  observer.observe(document, {
                    childList: true,
                    subtree: true,
                  });
                  check();
                }),
            )
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
  const textAppears = (frame, text) =>
    frame.evaluate(
      (expected) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            observer.disconnect();
            reject(new Error("Missing UI text: " + expected));
          }, 10_000);
          const check = () => {
            if (document.body.innerText.includes(expected)) {
              clearTimeout(timer);
              observer.disconnect();
              resolve();
            }
          };
          const observer = new MutationObserver(check);
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
          });
          check();
        }),
      text,
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
    if (fixture === "simple_test2") {
      await frame.getByRole("tab", { name: "Sections", exact: true }).focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(
        await frame
          .getByRole("tab", { name: "Program Headers", exact: true })
          .getAttribute("aria-selected"),
        "true",
      );
      await page.keyboard.press("ArrowRight");
      await textAppears(frame, "23328 of 23328 symbols");
      assert.ok(
        (await frame.getByRole("row").count()) < 100,
        "Large symbol tables must remain virtualized",
      );
      await frame.getByLabel("Filter symbols", { exact: true }).fill("FMT");
      await textAppears(frame, "1939 of 23328 symbols");
      await frame
        .getByLabel("Filter symbols", { exact: true })
        .fill("no-symbol-with-this-name");
      await textAppears(frame, "0 of 23328 symbols");
      await frame.getByLabel("Filter symbols", { exact: true }).fill("fmt");
      await textAppears(frame, "1939 of 23328 symbols");
      await frame.locator(".vtlist").evaluate(
        (element) =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error("Scroll event was not delivered")),
              10_000,
            );
            element.addEventListener(
              "scroll",
              () => {
                clearTimeout(timer);
                queueMicrotask(resolve);
              },
              { once: true },
            );
            element.scrollTop = 500;
          }),
      );
      if (process.env.ELFPREVIEW_SCREENSHOT)
        await page.screenshot({ path: process.env.ELFPREVIEW_SCREENSHOT });
      const detached = page.waitForEvent("framedetached", {
        predicate: (candidate) => candidate === frame,
        timeout: 20_000,
      });
      await command({ action: "hide" });
      await detached;
      const restoredPromise = frameReady(new Set(page.frames()));
      await command({
        action: "open",
        uri: pathToFileURL(path.join(root, "rust/tests/fixtures", fixture))
          .href,
      });
      const restored = await restoredPromise;
      await textAppears(restored, "1939 of 23328 symbols");
      assert.equal(
        await restored
          .getByLabel("Filter symbols", { exact: true })
          .inputValue(),
        "fmt",
      );
      assert.equal(
        await restored
          .getByRole("tab", { name: "Symbols", exact: true })
          .getAttribute("aria-selected"),
        "true",
      );
      await restored.locator(".vtlist").evaluate(
        (element) =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              element.removeEventListener("scroll", check);
              reject(
                new Error(
                  "Scroll offset was not restored: " + element.scrollTop,
                ),
              );
            }, 10_000);
            const check = () => {
              if (element.scrollTop >= 490) {
                clearTimeout(timer);
                element.removeEventListener("scroll", check);
                resolve();
              }
            };
            element.addEventListener("scroll", check);
            check();
          }),
      );
      await page.setViewportSize({ width: 700, height: 900 });
      assert.ok(
        await restored.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        "Narrow layouts scroll tables rather than the whole page",
      );
      console.log(
        "Symbol filtering, keyboard tabs, virtualization, saved state and narrow layout passed",
      );
    }
    console.log(`Rendered ${fixture} in VS Code`);
    await command({ action: "close" });
  }
  const virtualPromise = frameReady();
  await command({ action: "open", uri: "elfpreview-test:/virtual-elf" });
  const virtual = await virtualPromise;
  assert.ok((await settled(virtual)).includes("23328"));
  const splitPromise = frameReady(new Set(page.frames()));
  await command({ action: "split" });
  assert.ok((await settled(await splitPromise)).includes("23328"));
  await command({ action: "assertSingleRead" });
  await command({ action: "close" });
  console.log("Virtual filesystem and split views share one document parse");
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
