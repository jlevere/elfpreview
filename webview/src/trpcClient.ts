import { createTRPCProxyClient, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import superjson, { type SuperJSONResult } from "superjson";
import type { AppRouter } from "../../ts/src/trpc";

declare function acquireVsCodeApi(): { postMessage(data: unknown): void };

/**
 * Custom link that moves every tRPC operation over VS Code’s postMessage bridge.
 * Supports queries, mutations, and streaming subscriptions.
 */
const vsLink: TRPCLink<AppRouter> = () => {
  // link‑level init runs once
  const vscode = acquireVsCodeApi();

  return ({ op }) =>
    observable<unknown>((observer) => {
      // Re‑use the id tRPC generated for this op
      const { id } = op;

      type RpcEnvelope =
        | { __trpc: true; id: number; result: SuperJSONResult }
        | { __trpc: true; id: number; error: SuperJSONResult };

      const isMine = (m: unknown): m is RpcEnvelope => {
        if (typeof m !== "object" || m === null) return false;
        if (!("__trpc" in m) || !("id" in m)) return false;
        const e = m as { __trpc: unknown; id: unknown };
        return e.__trpc === true && e.id === id;
      };

      const listener = (ev: MessageEvent) => {
        if (!isMine(ev.data)) return;

        if ("error" in ev.data) {
          observer.error(superjson.deserialize<unknown>(ev.data.error));
          return;
        }

        observer.next(superjson.deserialize<unknown>(ev.data.result));

        // Close after first payload for non-streaming operations
        if (op.type !== "subscription") observer.complete();
      };

      window.addEventListener("message", listener);

      // Fire the request to the extension side
      vscode.postMessage({
        __trpc: true,
        id,
        type: op.type,
        path: op.path,
        input: superjson.serialize(op.input),
      });

      // Teardown / unsubscribe
      return () => {
        window.removeEventListener("message", listener);

        if (op.type === "subscription") {
          vscode.postMessage({ __trpc: true, id, type: "stop" });
        }
      };
    });
};

// Public client instance used inside the web‑view
export const trpc = createTRPCProxyClient<AppRouter>({
  links: [vsLink],
});
