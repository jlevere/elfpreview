import { copyFile, mkdir } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await copyFile(
  "target/wasm32-unknown-unknown/release/elfpreview.wasm",
  "dist/elfpreview.wasm",
);
