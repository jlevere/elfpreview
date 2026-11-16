import { readFile } from "node:fs/promises";
const manifest: unknown = JSON.parse(await readFile("package.json", "utf8"));
if (
  typeof manifest !== "object" ||
  manifest === null ||
  !("version" in manifest) ||
  typeof manifest.version !== "string"
) {
  throw new Error("package.json must contain a version string");
}
const { version } = manifest;
const requested = process.env.RELEASE_VERSION;
if (!requested || !/^\d+\.\d+\.\d+$/.test(requested) || requested !== version) {
  throw new Error(`Release version must match package.json (${version})`);
}
