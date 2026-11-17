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
  const copyAndCheck = async (frame: Frame, button: string, text: string) => {
    const copied = frame.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const receive = (event: MessageEvent<unknown>) => {
            if (
              event.data &&
              typeof event.data === "object" &&
              "type" in event.data &&
              event.data.type === "copied"
            ) {
              clearTimeout(timer);
              window.removeEventListener("message", receive);
              resolve();
            }
          };
          const timer = setTimeout(() => {
            window.removeEventListener("message", receive);
            reject(new Error("Clipboard acknowledgment did not arrive"));
          }, 10_000);
          window.addEventListener("message", receive);
        }),
    );
    await Promise.all([
      copied,
      frame.getByRole("button", { name: button, exact: true }).click(),
    ]);
    await command({ action: "assertClipboard", text });
  };
  const navigateRow = async (frame: Frame, key: string, label: string) => {
    const focused = frame.evaluate(
      (expected) =>
        new Promise<void>((resolve, reject) => {
          const check = () => {
            if (
              document.activeElement?.getAttribute("aria-label") === expected
            ) {
              clearTimeout(timer);
              document.removeEventListener("focusin", check);
              resolve();
            }
          };
          const timer = setTimeout(() => {
            document.removeEventListener("focusin", check);
            reject(new Error("Keyboard row focus did not arrive: " + expected));
          }, 10_000);
          document.addEventListener("focusin", check);
          check();
        }),
      label,
    );
    await Promise.all([focused, page.keyboard.press(key)]);
  };
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
    await frame.locator(".file-properties > summary").click();
    const text = await settled(frame);
    assert.ok(text.includes(fixture));
    assert.ok(
      text.includes(expected),
      `${fixture}: expected ${expected}, got ${text}`,
    );
    await frame.locator(".file-properties > summary").click();
    if (fixture === "simple_test") {
      await frame
        .getByRole("tab", { name: "Dynamic Symbols", exact: true })
        .click();
      await textAppears(frame, "53 of 53 symbols");
      await frame
        .getByLabel("Filter dynamic symbols", { exact: true })
        .fill("free");
      await textAppears(frame, "1 of 53 symbols");
      await frame
        .getByRole("row", { name: "Inspect row 1", exact: true })
        .click();
      assert.ok(
        (
          await frame.getByRole("region", { name: "Row details" }).innerText()
        ).includes("UND"),
      );
      await frame
        .getByRole("tab", { name: "Relocations", exact: true })
        .click();
      await textAppears(frame, "66 of 66 relocations");
      await frame
        .getByLabel("Filter relocations", { exact: true })
        .fill("free");
      await textAppears(frame, "1 of 66 relocations");
      await frame
        .getByRole("row", { name: "Inspect row 1", exact: true })
        .click();
      const relocation = await frame
        .getByRole("region", { name: "Row details" })
        .innerText();
      assert.ok(relocation.includes("0x0000000000009000"));
      assert.ok(relocation.includes("R_X86_64_JUMP_SLOT"));
      const width = await frame.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      assert.ok(
        width.scroll <= width.viewport,
        "Relocation details must not overflow the page: " +
          JSON.stringify(width),
      );
      if (process.env.ELFPREVIEW_SCREENSHOT)
        await page.screenshot({
          path: process.env.ELFPREVIEW_SCREENSHOT.replace(
            ".png",
            "-relocation.png",
          ),
        });
      await frame
        .getByRole("tab", { name: "Dynamic Symbols", exact: true })
        .click();
      assert.equal(
        await frame
          .getByLabel("Filter dynamic symbols", { exact: true })
          .inputValue(),
        "free",
      );
      console.log(
        "Dynamic symbols, relocation details and independent filters passed",
      );
    }
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
      assert.deepEqual(await frame.locator(".column-sort").allTextContents(), [
        "Name",
        "Section",
        "Value",
        "Size",
        "Type",
      ]);
      assert.ok(
        await frame
          .locator(".table-scroll")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
        "Default symbol columns should fit the editor without configuration",
      );
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
      await frame.getByLabel("Demangle names", { exact: true }).check();
      await frame.locator(".column-picker > summary").click();
      for (const name of ["Index", "Type", "Bind", "Visibility"])
        await frame
          .locator(".column-menu")
          .getByLabel(name, { exact: true })
          .uncheck();
      await frame.locator(".column-picker > summary").click();
      assert.equal(await frame.getByRole("columnheader").count(), 4);
      const resize = frame.getByRole("slider", {
        name: "Resize Name column",
        exact: true,
      });
      await resize.focus();
      await page.keyboard.press("Home");
      assert.equal(Number(await resize.inputValue()), 380);
      await page.keyboard.press("ArrowRight");
      assert.equal(Number(await resize.inputValue()), 390);
      const handle = await resize.boundingBox();
      assert.ok(handle);
      await page.mouse.move(
        handle.x + handle.width / 2,
        handle.y + handle.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        handle.x + handle.width / 2 + 80,
        handle.y + handle.height / 2,
      );
      await page.mouse.up();
      assert.equal(Number(await resize.inputValue()), 470);
      const sizes = await frame.getByRole("row").allTextContents();
      assert.ok(sizes.length > 1);
      await frame
        .getByRole("row", { name: "Inspect row 1", exact: true })
        .click();
      const details = frame.getByRole("region", { name: "Row details" });
      const original = await details
        .locator("dl > div")
        .filter({ has: frame.locator("dt", { hasText: /^Original name$/ }) })
        .locator("dd")
        .innerText();
      const demangled = await details
        .locator("dl > div")
        .filter({ has: frame.locator("dt", { hasText: /^Demangled name$/ }) })
        .locator("dd")
        .innerText();
      assert.ok(original.startsWith("_Z"));
      assert.ok(demangled.includes("::"));
      assert.equal(
        await frame
          .getByRole("row", { name: "Inspect row 1", exact: true })
          .getByRole("cell")
          .first()
          .innerText(),
        demangled,
      );
      assert.ok((await details.innerText()).includes("(.text)"));
      // Sorting changes ordering without discarding the object being inspected.
      await frame.getByRole("button", { name: "Name", exact: true }).click();
      assert.equal(
        await details
          .locator("dl > div")
          .filter({ has: frame.locator("dt", { hasText: /^Original name$/ }) })
          .locator("dd")
          .innerText(),
        original,
      );
      await frame.getByRole("button", { name: "Size", exact: true }).click();
      await frame.getByRole("button", { name: "Size", exact: true }).click();
      await frame
        .getByRole("row", { name: "Inspect row 1", exact: true })
        .focus();
      await navigateRow(frame, "ArrowDown", "Inspect row 2");
      await navigateRow(frame, "End", "Inspect row 1939");
      assert.equal(await frame.locator('.table-row[tabindex="0"]').count(), 1);
      await navigateRow(frame, "Home", "Inspect row 1");
      assert.equal(
        await details
          .locator("dl > div")
          .filter({ has: frame.locator("dt", { hasText: /^Original name$/ }) })
          .locator("dd")
          .innerText(),
        original,
      );
      const value = await details
        .locator("dl > div")
        .filter({ has: frame.locator("dt", { hasText: /^Value$/ }) })
        .locator("dd")
        .innerText();
      await copyAndCheck(frame, "Copy Original name", original);
      await copyAndCheck(frame, "Copy Demangled name", demangled);
      await copyAndCheck(frame, "Copy Value", value);
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
      await copyAndCheck(frame, "Copy row", copied);
      if (process.env.ELFPREVIEW_SCREENSHOT)
        await page.screenshot({
          path: process.env.ELFPREVIEW_SCREENSHOT.replace(
            ".png",
            "-inspector.png",
          ),
        });
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
      assert.equal(await restored.getByRole("columnheader").count(), 4);
      assert.equal(
        Number(
          await restored
            .getByRole("slider", { name: "Resize Name column", exact: true })
            .inputValue(),
        ),
        470,
      );
      assert.ok(
        await restored
          .getByLabel("Demangle names", { exact: true })
          .isChecked(),
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
      if (process.env.ELFPREVIEW_SCREENSHOT) {
        await restored.locator(".column-picker > summary").click();
        await page.screenshot({
          path: process.env.ELFPREVIEW_SCREENSHOT.replace(
            ".png",
            "-columns.png",
          ),
        });
        await restored.locator(".column-picker > summary").click();
      }
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
      await restored.locator(".column-picker > summary").click();
      for (const name of ["Section", "Value", "Size"])
        await restored
          .locator(".column-menu")
          .getByLabel(name, { exact: true })
          .uncheck();
      assert.ok(
        await restored
          .locator(".column-menu")
          .getByLabel("Name", { exact: true })
          .isDisabled(),
      );
      await restored
        .getByRole("button", { name: "Reset columns", exact: true })
        .click();
      assert.equal(await restored.getByRole("columnheader").count(), 5);
      assert.equal(
        Number(
          await restored
            .getByRole("slider", { name: "Resize Name column", exact: true })
            .inputValue(),
        ),
        380,
      );
      await restored.locator(".column-picker > summary").click();
      // Rows are also operable without a pointer.
      const keyboardRow = restored
        .getByRole("row", { name: /^Inspect row / })
        .first();
      await keyboardRow.focus();
      await page.keyboard.press("Enter");
      assert.equal(
        await restored.getByRole("region", { name: "Row details" }).count(),
        1,
      );
      const closed = restored.evaluate(
        () =>
          new Promise<void>((resolve, reject) => {
            const check = () => {
              if (!document.querySelector(".row-details")) {
                clearTimeout(timer);
                observer.disconnect();
                resolve();
              }
            };
            const timer = setTimeout(() => {
              observer.disconnect();
              reject(new Error("Escape did not close the row inspector"));
            }, 10_000);
            const observer = new MutationObserver(check);
            observer.observe(document.body, { childList: true, subtree: true });
            check();
          }),
      );
      await Promise.all([closed, page.keyboard.press("Escape")]);
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
  await virtual.locator(".file-properties > summary").click();
  assert.ok((await settled(virtual)).includes("23328"));
  await virtual
    .getByRole("tab", { name: "Dynamic Symbols", exact: true })
    .click();
  await textAppears(virtual, "symbols");
  await virtual.getByRole("tab", { name: "Relocations", exact: true }).click();
  await textAppears(virtual, "relocations");
  const [split] = await Promise.all([
    frameReady(new Set(page.frames())),
    command({ action: "split" }),
  ]);
  await settled(split);
  await split.locator(".file-properties > summary").click();
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
  await elf32View.locator(".file-properties > summary").click();
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
