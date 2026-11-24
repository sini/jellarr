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

/** The connection was never established, so the request cannot have reached the server. */
const NEVER_CONNECTED: ReadonlySet<string> = new Set([
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
]);

/** The connection dropped, possibly after the request was sent. */
const DROPPED: ReadonlySet<string> = new Set([
  "ECONNRESET",
  "EPIPE",
  "UND_ERR_SOCKET",
]);

function causeCodes(error: unknown): string[] {
  if (!(error instanceof TypeError)) return [];
  const cause: unknown = error.cause;
  if (typeof cause !== "object" || cause === null) return [];
  const errors: unknown = (cause as { errors?: unknown }).errors;
  const nested: unknown[] = Array.isArray(errors) ? (errors as unknown[]) : [];
  return [cause, ...nested].flatMap((e: unknown): string[] => {
    const c: unknown = (e as { code?: unknown } | null)?.code;
    return typeof c === "string" ? [c] : [];
  });
}

/**
 * Whether a failed fetch is Jellyfin restarting. A read may retry any
 * connection failure; a write only when the connection was never made, since
 * a dropped one may have been processed and a retry could create twice.
 */
export function isRetryableConnectionError(
  error: unknown,
  method: string,
): boolean {
  const codes: string[] = causeCodes(error);
  if (codes.length === 0) return false;
  if (codes.every((c: string) => NEVER_CONNECTED.has(c))) return true;
  const read: boolean = method === "GET" || method === "HEAD";
  return (
    read && codes.every((c: string) => NEVER_CONNECTED.has(c) || DROPPED.has(c))
  );
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
      let response: Response | undefined;
      let failure: unknown;
      try {
        response = await globalThis.fetch(request.clone());
      } catch (error: unknown) {
        if (!isRetryableConnectionError(error, request.method)) throw error;
        failure = error;
      }
      if (response && response.status !== 503) return response;
      const what: string = response
        ? "answered 503"
        : "refused or dropped connections";
      const now: number = Date.now();
      streakStart ??= now;
      const deadline: number = streakStart + retry.timeoutMs;
      if (now >= deadline) {
        throw new Error(
          `Jellyfin still ${what} (starting up) for ${(retry.timeoutMs / 1000).toString()}s: ${request.method} ${request.url}; raise --waitTimeout / JELLARR_WAIT_TIMEOUT if it is migrating`,
          failure === undefined ? undefined : { cause: failure },
        );
      }
      if (now === streakStart) {
        logger.warn(
          `Jellyfin ${what} (still starting up); retrying until ${new Date(deadline).toISOString()}`,
        );
      }
      await response?.body?.cancel();
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
        `MediaBrowser ${tokenPart}Client="jellarr", Device="cli", DeviceId="${deviceId}", Version="0.5.1"`,
      );
      return new Request(request, { headers });
    },
  });

  return client;
}
