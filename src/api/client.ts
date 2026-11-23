import createClient, { type Client } from "openapi-fetch";
import { logger } from "../lib/logger";
import type { paths } from "../../generated/schema";

export type TokenSource = string | (() => string | undefined);

const FIRST_DELAY_MS: number = 1000;
const MAX_DELAY_MS: number = 10000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve: () => void) => setTimeout(resolve, ms));
}

export interface RetryOptions {
  /** Longest a streak of 503 answers is retried before the call fails. */
  timeoutMs: number;
  firstDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * Jellyfin's ServerStartupMessageMiddleware answers every request except
 * /System/Ping with 503 before any handler runs until startup (including
 * database migrations) completes, so retrying a 503 is safe for any method.
 */
function retryingFetch(retry: RetryOptions): typeof fetch {
  return async (
    input: Request | string | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const request: Request = new Request(input, init);
    let streakStart: number | undefined;
    let delay: number = retry.firstDelayMs ?? FIRST_DELAY_MS;
    for (;;) {
      const response: Response = await globalThis.fetch(request.clone());
      if (response.status !== 503) return response;
      const now: number = Date.now();
      streakStart ??= now;
      const deadline: number = streakStart + retry.timeoutMs;
      if (now >= deadline) {
        throw new Error(
          `Jellyfin still answered 503 (starting up) for ${(retry.timeoutMs / 1000).toString()}s: ${request.method} ${request.url}; raise --waitTimeout / JELLARR_WAIT_TIMEOUT if it is migrating`,
        );
      }
      if (now === streakStart) {
        logger.warn(
          `Jellyfin answered 503 (still starting up); retrying until ${new Date(deadline).toISOString()}`,
        );
      }
      await response.body?.cancel();
      await sleep(Math.min(delay, deadline - now));
      delay = Math.min(delay * 2, retry.maxDelayMs ?? MAX_DELAY_MS);
    }
  };
}

export function makeClient(
  baseUrl: string,
  token?: TokenSource,
  deviceId: string = "jellarr",
  retry?: RetryOptions,
): Client<paths> {
  const client: Client<paths> = createClient<paths>({
    baseUrl: baseUrl.replace(/\/+$/, ""),
    ...(retry ? { fetch: retryingFetch(retry) } : {}),
  });

  client.use({
    onRequest({ request }: { request: Request }): Request {
      const headers: Headers = new Headers(request.headers);
      const current: string | undefined =
        typeof token === "function" ? token() : token;
      const tokenPart: string = current ? `Token="${current}", ` : "";
      headers.set(
        "Authorization",
        `MediaBrowser ${tokenPart}Client="jellarr", Device="cli", DeviceId="${deviceId}", Version="0.5.0"`,
      );
      return new Request(request, { headers });
    },
  });

  return client;
}
