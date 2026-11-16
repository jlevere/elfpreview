import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { _electron, type ElectronApplication, type Frame } from "playwright";
import type { Command } from "../ts/test/ui-host.ts";

async function withDeadline<T>(
  operation: Promise<T>,
  description: string,
): Promise<T> {
  let deadline: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        deadline = setTimeout(
          () => reject(new Error(description + " timed out after 30 seconds")),
          30_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(deadline);
  }
}

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(
  path.join(
    process.platform === "darwin" ? "/tmp" : tmpdir(),
    "elfpreview-ui-",
  ),
);
const server = createServer();
let app: ElectronApplication | undefined;
let socket: Socket | undefined;
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
  const connected = new Promise<Socket>((resolve) =>
    server.once("connection", (peer) => {
      socket = peer;
      resolve(peer);
    }),
  );
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
  const connection = await withDeadline(connected, "Extension host connection");
  const messages = createInterface({ input: connection });
  // A queued async iterator preserves messages arriving during Electron startup.
  const replies = messages[Symbol.asyncIterator]();
  const nextReply = () =>
    withDeadline(replies.next(), "Extension host response");
  const ready = await nextReply();
  assert.ok(!ready.done, "Extension host disconnected before readiness");
  assert.deepEqual(JSON.parse(ready.value), { ready: true });
  const command = async (value: Command) => {
    connection.write(JSON.stringify(value) + "\n");
    const reply = await nextReply();
    assert.ok(!reply.done, "Extension host disconnected");
    assert.deepEqual(JSON.parse(reply.value), { ok: true });
  };
  const page = await app.firstWindow();
  const frameReady = (exclude = new Set<Frame>()) =>
    new Promise<Frame>((resolve, reject) => {
      const deadline = setTimeout(() => {
        cleanup();
        reject(new Error("ELF webview did not load"));
      }, 20_000);
      const cleanup = () => {
        clearTimeout(deadline);
        page.off("framenavigated", check);
      };
      const check = (frame: Frame) => {
        if (
          !exclude.has(frame) &&
          frame.url().includes("vscode-webview") &&
          frame.url().includes("id=")
        ) {
          // Only the inner webview contains the extension's document.
          frame
            .evaluate(
              () =>
                new Promise<boolean>((resolve) => {
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
  const openView = async (uri: string, exclude = new Set<Frame>()) => {
    const [frame] = await Promise.all([
      frameReady(exclude),
      command({ action: "open", uri }),
    ]);
    return frame;
  };
  const settled = (frame: Frame) =>
    frame.evaluate(
      () =>
        new Promise<string>((resolve, reject) => {
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
  const textAppears = (frame: Frame, text: string) =>
    frame.evaluate(
      (expected) =>
        new Promise<void>((resolve, reject) => {
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
    const frame = await openView(
      pathToFileURL(path.join(root, "rust/tests/fixtures", fixture)).href,
    );
    await settled(frame);
    await frame.locator("summary").click();
    const text = await settled(frame);
    assert.ok(text.includes(fixture));
    assert.ok(
      text.includes(expected),
      `${fixture}: expected ${expected}, got ${text}`,
    );
    await frame.locator("summary").click();
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
      const renderedRows = await frame.getByRole("row").count();
      assert.ok(
        renderedRows > 1 && renderedRows < 100,
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
      await frame.getByRole("button", { name: "Size", exact: true }).click();
      await frame.getByRole("button", { name: "Size", exact: true }).click();
      assert.equal(
        await frame
          .getByRole("columnheader", { name: "Size" })
          .getAttribute("aria-sort"),
        "descending",
      );
      const sizes = await frame.getByRole("row").allTextContents();
      assert.ok(sizes.length > 1);
      await frame
        .getByRole("button", { name: "Inspect row 1", exact: true })
        .click();
      const details = frame.getByRole("region", { name: "Row details" });
      const copied = await details
        .locator("dl > div")
        .evaluateAll((items) =>
          items
            .map(
              (item) =>
                (item.querySelector("dt")?.textContent ?? "") +
                "\t" +
                (item.querySelector("dd")?.textContent ?? ""),
            )
            .join("\n"),
        );
      await frame
        .getByRole("button", { name: "Copy row", exact: true })
        .click();
      await textAppears(frame, "Row copied");
      await command({ action: "assertClipboard", text: copied });
      await frame
        .getByRole("button", { name: "Close details", exact: true })
        .click();
      const tableHeight = await frame
        .locator(".vtlist")
        .evaluate((element) => element.clientHeight);
      assert.ok(tableHeight > 350, "The table uses available editor height");
      await frame.locator(".vtlist").evaluate(
        (element) =>
          new Promise<void>((resolve, reject) => {
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
      // The normalized filter stays the same: preserve both visible and saved scroll.
      await frame.getByLabel("Filter symbols", { exact: true }).fill("FMT");
      assert.ok(
        (await frame
          .locator(".vtlist")
          .evaluate((element) => element.scrollTop)) >= 490,
      );
      if (process.env.ELFPREVIEW_SCREENSHOT)
        await page.screenshot({ path: process.env.ELFPREVIEW_SCREENSHOT });
      await Promise.all([
        page.waitForEvent("framedetached", {
          predicate: (candidate) => candidate === frame,
          timeout: 20_000,
        }),
        command({ action: "hide" }),
      ]);
      const restored = await openView(
        pathToFileURL(path.join(root, "rust/tests/fixtures", fixture)).href,
        new Set(page.frames()),
      );
      await textAppears(restored, "1939 of 23328 symbols");
      assert.equal(
        await restored
          .getByLabel("Filter symbols", { exact: true })
          .inputValue(),
        "FMT",
      );
      assert.equal(
        await restored
          .getByRole("tab", { name: "Symbols", exact: true })
          .getAttribute("aria-selected"),
        "true",
      );
      assert.equal(
        await restored
          .getByRole("columnheader", { name: "Size" })
          .getAttribute("aria-sort"),
        "descending",
      );
      await restored.locator(".vtlist").evaluate(
        (element) =>
          new Promise<void>((resolve, reject) => {
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
      for (const [theme, kind] of [
        ["Default Light Modern", "vscode-light"],
        ["Default High Contrast", "vscode-high-contrast"],
        ["Default Dark Modern", "vscode-dark"],
      ]) {
        const themed = restored.evaluate(
          (expected) =>
            new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => {
                observer.disconnect();
                reject(new Error("Theme did not apply: " + expected));
              }, 10_000);
              const check = () => {
                if (document.body.classList.contains(expected)) {
                  clearTimeout(timer);
                  observer.disconnect();
                  resolve();
                }
              };
              const observer = new MutationObserver(check);
              observer.observe(document.body, {
                attributes: true,
                attributeFilter: ["class"],
              });
              check();
            }),
          kind,
        );
        await Promise.all([themed, command({ action: "theme", theme })]);
        const colors = await restored.evaluate(() => ({
          background: getComputedStyle(document.body).backgroundColor,
          foreground: getComputedStyle(document.body).color,
          focus: getComputedStyle(document.body).getPropertyValue(
            "--vscode-focusBorder",
          ),
        }));
        assert.notEqual(colors.background, colors.foreground);
        assert.ok(colors.focus.trim());
        if (process.env.ELFPREVIEW_SCREENSHOT)
          await page.screenshot({
            path: process.env.ELFPREVIEW_SCREENSHOT.replace(
              ".png",
              "-" + kind + ".png",
            ),
          });
      }
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
  const virtual = await openView("elfpreview-test:/virtual-elf");
  await settled(virtual);
  await virtual.locator("summary").click();
  assert.ok((await settled(virtual)).includes("23328"));
  const [split] = await Promise.all([
    frameReady(new Set(page.frames())),
    command({ action: "split" }),
  ]);
  await settled(split);
  await split.locator("summary").click();
  assert.ok((await settled(split)).includes("23328"));
  await command({ action: "assertSingleRead" });
  await command({ action: "close" });
  console.log("Virtual filesystem and split views share one document parse");
  const elf32 = Buffer.alloc(52);
  elf32.set([0x7f, 0x45, 0x4c, 0x46, 1, 2, 1, 10]);
  elf32.writeUInt16BE(2, 16);
  elf32.writeUInt16BE(3, 18);
  elf32.writeUInt32BE(1, 20);
  elf32.writeUInt16BE(52, 40);
  const elf32Path = path.join(temporary, "elf32-big-endian");
  await writeFile(elf32Path, elf32);
  const elf32View = await openView(pathToFileURL(elf32Path).href);
  await settled(elf32View);
  await elf32View.locator("summary").click();
  const elf32Text = await settled(elf32View);
  for (const expected of ["ELF32", "Big Endian", "TRU64", "0x00000000"])
    assert.ok(elf32Text.includes(expected));
  assert.equal(await elf32View.getByRole("row").count(), 0);
  await command({ action: "close" });
  console.log(
    "ELF32 big-endian headers and zero entry points render correctly",
  );
  const malformed = path.join(temporary, "<img onerror=alert(1)>");
  await writeFile(malformed, "not an ELF");
  const frame = await openView(pathToFileURL(malformed).href);
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
