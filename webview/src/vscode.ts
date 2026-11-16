import type { ViewMessage } from "../../ts/src/protocol";

declare function acquireVsCodeApi(): {
  postMessage(message: ViewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
};

export const vscode = acquireVsCodeApi();
