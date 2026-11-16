import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "esbuild";
const directory = await mkdtemp(path.join(tmpdir(), "elfpreview-tests-"));
try {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error("Supply at least one test file");
  await build({
    entryPoints: files,
    outdir: directory,
    bundle: true,
    platform: "node",
    format: "cjs",
  });
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--test",
        ...files.map((file) =>
          path.join(directory, path.basename(file, ".ts") + ".js"),
        ),
      ],
      { stdio: "inherit" },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Node tests failed: " + code)),
    );
  });
} finally {
  await rm(directory, { recursive: true, force: true });
}
