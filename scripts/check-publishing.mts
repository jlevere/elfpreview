import { readFile } from "node:fs/promises";
import { verifyPublishingAccess } from "./marketplace.mts";

const manifest: unknown = JSON.parse(await readFile("package.json", "utf8"));
if (
  typeof manifest !== "object" ||
  manifest === null ||
  !("publisher" in manifest) ||
  typeof manifest.publisher !== "string"
)
  throw new Error("package.json must identify the Marketplace publisher");
const {
  ACTIONS_ID_TOKEN_REQUEST_URL: url,
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: token,
} = process.env;
if (process.env.GITHUB_ACTIONS !== "true" || !url || !token)
  throw new Error(
    "Run the release workflow's verify operation with id-token: write",
  );
await verifyPublishingAccess(manifest.publisher, url, token);
console.log(
  `Marketplace authorized publishing for '${manifest.publisher}'. Nothing was published.`,
);
