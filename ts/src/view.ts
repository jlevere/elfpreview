import { randomBytes } from "node:crypto";
import {
  isReadyMessage,
  type HostMessage,
  type PreviewState,
} from "./protocol";

type Disposable = { dispose(): void };
type Subscribe<T> = (listener: (value: T) => void) => Disposable;

export function connectView(
  port: {
    onDidReceiveMessage: Subscribe<unknown>;
    postMessage(message: HostMessage): PromiseLike<boolean>;
  },
  snapshot: () => PreviewState,
  onChange: Subscribe<PreviewState>,
): Disposable {
  let ready = false;
  const send = (state: PreviewState) => {
    if (ready) void port.postMessage({ type: "state", state });
  };
  const messages = port.onDidReceiveMessage((message) => {
    if (isReadyMessage(message)) {
      ready = true;
      send(snapshot());
    }
  });
  const changes = onChange(send);
  return {
    dispose() {
      ready = false;
      messages.dispose();
      changes.dispose();
    },
  };
}

export function webviewHtml(
  source: string,
  script: string,
  style: string,
): string {
  const nonce = randomBytes(24).toString("base64");
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${source}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="${style}" rel="stylesheet">
<title>ELF Preview</title>
</head><body><div id="app"></div>
<script type="module" nonce="${nonce}" src="${script}"></script>
</body></html>`;
}
