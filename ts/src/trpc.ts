import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { on, EventEmitter } from "node:events";
import type { WebviewPanel } from "vscode";
import { Types } from "./bininspect";

//──────────────────────── context ────────────────────────

/**
 * Defines the shared state and event hub for a single webview panel.
 * This context is the single source of truth for the backend.
 */
export interface PanelContext {
  state: {
    fileKind: Types.FileKind | null;
    details: Types.Details | null;
    magicBytes: string | null;
    parseComplete: boolean;
    error: string | null;
  };
  events: EventEmitter;
}

//──────────────────────── router ─────────────────────────

const t = initTRPC.context<PanelContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

/**
 * The tRPC router defining the API contract between the extension and the webview.
 */
export const appRouter = t.router({
  /**
   * A query to get the entire state at a single point in time.
   * Useful for when the webview first loads.
   */
  getInitialState: t.procedure.query(({ ctx }) => ctx.state),

  /**
   * A subscription that pushes the complete state object to the client
   * whenever a change occurs on the backend. This is the primary
   * reactive data-flow mechanism.
   */
  onStateChange: t.procedure.subscription(({ ctx }) => {
    return (async function* () {
      yield ctx.state;
      for await (const [newState] of on(ctx.events, "update")) {
        yield newState as PanelContext["state"];
      }
    })();
  }),
});

export type AppRouter = typeof appRouter;

//───────────────── webview transport bridge ──────────────

/**
 * Attaches a transport layer that bridges the tRPC router with a VS Code WebviewPanel,
 * handling queries and subscriptions over the `postMessage` API.
 *
 * @param panel The VS Code webview panel to communicate with.
 * @param ctx The panel's context, containing state and the event emitter.
 */
export function attachPanelTransport(panel: WebviewPanel, ctx: PanelContext) {
  const caller = appRouter.createCaller(ctx);
  const subs = new Map<number, () => void>();

  type Base = { __trpc: true; id: number };
  type QueryMsg = Base & {
    type: "query";
    path: "getInitialState";
    input: unknown;
  };
  type SubMsg = Base & {
    type: "subscription";
    path: "onStateChange";
    input: unknown;
  };
  type StopMsg = Base & { type: "stop" };
  type RpcRequest = QueryMsg | SubMsg | StopMsg;

  const isRpcRequest = (m: unknown): m is RpcRequest => {
    if (typeof m !== "object" || m === null) return false;
    const r = m as Partial<RpcRequest>;
    return (
      r.__trpc === true && typeof (r as { type?: unknown }).type === "string"
    );
  };

  const postResult = (id: number, type: string, data: unknown) => {
    panel.webview.postMessage({
      __trpc: true,
      id,
      type,
      result: superjson.serialize(data),
    });
  };
  const postError = (id: number, type: string, err: unknown) => {
    panel.webview.postMessage({
      __trpc: true,
      id,
      type,
      error: superjson.serialize(err),
    });
  };

  panel.webview.onDidReceiveMessage(async (raw) => {
    if (!isRpcRequest(raw)) {
      console.warn("Received non-RPC message or missing type field", raw);
      return;
    }

    const { id } = raw;

    switch (raw.type) {
      case "query":
        try {
          const result = await caller.getInitialState();
          postResult(id, raw.type, result);
        } catch (e) {
          postError(
            id,
            raw.type,
            String(
              e instanceof Error ? e.message : "An unknown error occurred",
            ),
          );
        }
        break;

      case "subscription": {
        const stream = await caller.onStateChange();

        const iter = stream[Symbol.asyncIterator]();

        subs.set(id, () => void iter.return?.());

        void (async () => {
          try {
            for await (const data of stream) {
              postResult(id, raw.type, data);
            }
          } catch (err) {
            postError(
              id,
              raw.type,
              String(err instanceof Error ? err.message : "Subscription error"),
            );
          }
        })();
        break;
      }

      case "stop":
        subs.get(id)?.();
        subs.delete(id);
        break;

      default: {
        function getType(val: unknown): string {
          if (
            val &&
            typeof val === "object" &&
            "type" in val &&
            typeof (val as { type: unknown }).type === "string"
          ) {
            return (val as { type: string }).type;
          }
          return "unknown";
        }
        const type = getType(raw);
        postError(
          id,
          type,
          String(`Unhandled message type: ${JSON.stringify(raw)}`),
        );
        break;
      }
    }
  });
}
