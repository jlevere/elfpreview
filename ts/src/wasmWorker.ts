import { Connection } from "@vscode/wasm-component-model";
import { bininspect } from "./bininspect";

void (async () => {
  const conn = await Connection.createWorker(bininspect._);
  conn.listen();
})(); 