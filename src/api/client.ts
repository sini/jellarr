import createClient, { type Client } from "openapi-fetch";
import type { paths } from "../../generated/schema";

export type TokenSource = string | (() => string | undefined);

export function makeClient(
  baseUrl: string,
  token?: TokenSource,
  deviceId: string = "jellarr",
): Client<paths> {
  const client: Client<paths> = createClient<paths>({
    baseUrl: baseUrl.replace(/\/+$/, ""),
  });

  client.use({
    onRequest({ request }: { request: Request }): Request {
      const headers: Headers = new Headers(request.headers);
      const current: string | undefined =
        typeof token === "function" ? token() : token;
      const tokenPart: string = current ? `Token="${current}", ` : "";
      headers.set(
        "Authorization",
        `MediaBrowser ${tokenPart}Client="jellarr", Device="cli", DeviceId="${deviceId}", Version="0.1.0"`,
      );
      return new Request(request, { headers });
    },
  });

  return client;
}
