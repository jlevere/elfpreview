const marketplace = "https://marketplace.visualstudio.com";

async function requestJson(
  request: typeof fetch,
  url: string,
  init: RequestInit,
  operation: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await request(url, {
      ...init,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error(`${operation} could not connect`);
  }
  if (!response.ok)
    throw new Error(`${operation} failed: HTTP ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${operation} returned invalid JSON`);
  }
}

function tokenFrom(value: unknown, key: string): string {
  if (typeof value !== "object" || value === null)
    throw new Error("Publishing authentication returned an invalid response");
  const token = (value as Record<string, unknown>)[key];
  if (typeof token !== "string" || !token)
    throw new Error("Publishing authentication returned an invalid response");
  return token;
}

export async function verifyPublishingAccess(
  publisher: string,
  requestUrl: string,
  requestToken: string,
  request: typeof fetch = fetch,
): Promise<void> {
  const url = new URL(requestUrl);
  url.searchParams.set("audience", "marketplace.visualstudio.com");
  const identity = tokenFrom(
    await requestJson(
      request,
      url.href,
      {
        headers: {
          Authorization: `Bearer ${requestToken}`,
          Accept: "application/json",
        },
      },
      "GitHub identity request",
    ),
    "value",
  );
  // Only exchange credentials: this check must never upload or publish a package.
  // Protocol: https://github.com/microsoft/vscode-vsce/blob/main/src/oidc.ts
  tokenFrom(
    await requestJson(
      request,
      `${marketplace}/_apis/gallery/token?api-version=7.2-preview.1`,
      {
        method: "POST",
        headers: {
          Authorization: `FederatedToken ${identity}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ publisherName: publisher }),
      },
      "Marketplace authorization",
    ),
    "credential",
  );
}
