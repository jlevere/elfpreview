import { readFile } from "node:fs/promises";
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const requested = process.env.RELEASE_VERSION;
if (!requested || !/^\d+\.\d+\.\d+$/.test(requested) || requested !== version) {
  throw new Error(`Release version must match package.json (${version})`);
}
