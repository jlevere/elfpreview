import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const temporary = await mkdtemp(path.join(tmpdir(), "elfpreview-wit-"));
try {
  execFileSync(
    "pnpm",
    ["exec", "wit2ts", "--outDir", temporary, "wit/elf-parser.wit"],
    { stdio: "inherit" },
  );
  // wit2ts 1.0.2 can exit zero on failure. Reading a fresh output is mandatory.
  let generated = await readFile(path.join(temporary, "elfpreview.ts"), "utf8");
  // Its world export signatures omit the namespace of imported record types.
  // Keep this bounded workaround here, never in hand-edited generated output.
  const start = generated.indexOf(
    "\n\texport type Exports = {",
    generated.indexOf("export namespace elfpreview._"),
  );
  if (start < 0) throw new Error("Unexpected wit2ts world layout");
  const prefix = generated.slice(0, start);
  const suffix = generated
    .slice(start)
    .replaceAll("ptr<result<Elfinfo,", "ptr<result<Types.Elfinfo,")
    .replaceAll("ptr<result<Fileinfo,", "ptr<result<Types.Fileinfo,");
  generated = prefix + suffix;
  const target = "ts/src/generated/elfpreview.ts";
  if (process.argv.includes("--check")) {
    if ((await readFile(target, "utf8")) !== generated)
      throw new Error("WIT bindings are stale; run pnpm generate:wit");
  } else {
    await writeFile(target, generated);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
