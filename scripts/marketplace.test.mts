import assert from "node:assert/strict";
import test from "node:test";
import { verifyPublishingAccess } from "./marketplace.mts";

const identityUrl =
  "https://token.actions.githubusercontent.com/example?existing=value";
const exchangeUrl =
  "https://marketplace.visualstudio.com/_apis/gallery/token?api-version=7.2-preview.1";

void test("publishing verification exchanges identity without uploading a package or returning credentials", async () => {
  const calls: string[] = [];
  const request: typeof fetch = (input, init) => {
    assert.ok(typeof input === "string");
    const url = input;
    calls.push(url);
    assert.ok(init?.signal instanceof AbortSignal);
    const headers = new Headers(init?.headers);
    if (calls.length === 1) {
      const identity = new URL(url);
      assert.equal(identity.origin, new URL(identityUrl).origin);
      assert.equal(identity.searchParams.get("existing"), "value");
      assert.equal(
        identity.searchParams.get("audience"),
        "marketplace.visualstudio.com",
      );
      assert.equal(headers.get("Authorization"), "Bearer request-token");
      return Promise.resolve(Response.json({ value: "github-identity" }));
    }
    assert.equal(url, exchangeUrl);
    assert.equal(init?.method, "POST");
    assert.equal(
      headers.get("Authorization"),
      "FederatedToken github-identity",
    );
    assert.equal(init?.body, JSON.stringify({ publisherName: "jlevere" }));
    return Promise.resolve(
      Response.json({ credential: "marketplace-credential" }),
    );
  };
  assert.equal(
    await verifyPublishingAccess(
      "jlevere",
      identityUrl,
      "request-token",
      request,
    ),
    undefined,
  );
  assert.equal(calls.length, 2);
});

void test("rejected GitHub identity stops before contacting Marketplace", async () => {
  let calls = 0;
  const request: typeof fetch = () => {
    calls++;
    return Promise.resolve(
      new Response("private server details", { status: 401 }),
    );
  };
  await assert.rejects(
    verifyPublishingAccess("jlevere", identityUrl, "request-token", request),
    { message: "GitHub identity request failed: HTTP 401" },
  );
  assert.equal(calls, 1);
});

void test("a rejected Marketplace policy fails without exposing response details", async () => {
  let calls = 0;
  const request: typeof fetch = () =>
    Promise.resolve(
      ++calls === 1
        ? Response.json({ value: "github-identity" })
        : new Response("private server details", { status: 403 }),
    );
  await assert.rejects(
    verifyPublishingAccess("jlevere", identityUrl, "request-token", request),
    { message: "Marketplace authorization failed: HTTP 403" },
  );
  assert.equal(calls, 2);
});

void test("malformed identity and missing Marketplace credentials fail closed", async () => {
  for (const identity of [true, false]) {
    let calls = 0;
    const request: typeof fetch = () => {
      calls++;
      return Promise.resolve(
        identity
          ? new Response("private invalid JSON")
          : Response.json(
              calls === 1 ? { value: "github-identity" } : { credential: "" },
            ),
      );
    };
    await assert.rejects(
      verifyPublishingAccess("jlevere", identityUrl, "request-token", request),
      {
        message: identity
          ? "GitHub identity request returned invalid JSON"
          : "Publishing authentication returned an invalid response",
      },
    );
    assert.equal(calls, identity ? 1 : 2);
  }
});

void test("connection failures do not retry or expose the underlying error", async () => {
  let calls = 0;
  const request: typeof fetch = () => {
    calls++;
    return Promise.reject(new Error("private request details"));
  };
  await assert.rejects(
    verifyPublishingAccess("jlevere", identityUrl, "request-token", request),
    { message: "GitHub identity request could not connect" },
  );
  assert.equal(calls, 1);
});
