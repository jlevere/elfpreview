import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(
  path.join(
    process.platform === "darwin" ? "/tmp" : tmpdir(),
    "elfpreview-test-",
  ),
);
const profile = path.join(temporary, "profile");
await mkdir(path.join(profile, "User"), { recursive: true });
await writeFile(
  path.join(profile, "User/settings.json"),
  JSON.stringify({
    "telemetry.telemetryLevel": "off",
    "update.mode": "none",
    "extensions.autoUpdate": false,
    "workbench.startupEditor": "none",
    "window.restoreWindows": "none",
  }),
);
try {
  await build({
    entryPoints: [path.join(root, "ts/test/extension.test.ts")],
    outfile: path.join(temporary, "suite.cjs"),
    platform: "node",
    format: "cjs",
    bundle: true,
    external: ["vscode"],
  });
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.env.VSCODE_EXECUTABLE ?? "code",
      [
        "--user-data-dir",
        profile,
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
        path.join(root, "rust/tests/fixtures"),
      ],
      {
        stdio: "inherit",
        timeout: 60_000,
        env: {
          ...process.env,
          ELFPREVIEW_TEST_RESULT: path.join(temporary, "result"),
        },
      },
    );
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error("VS Code tests failed: " + (signal ?? code)));
    });
  });
  if ((await readFile(path.join(temporary, "result"), "utf8")) !== "passed")
    throw new Error("VS Code suite did not complete");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
