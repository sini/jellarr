import { logger } from "./logger";

export const DEFAULT_WAIT_TIMEOUT_SECONDS: number = 300;

export interface WaitOptions {
  timeoutMs: number;
  intervalMs?: number;
  fetchFn?: typeof fetch;
  /** Reads something that differs after a restart, such as a pending-restart flag. */
  readMarker?: () => Promise<string | undefined>;
}

export function resolveWaitTimeoutMs(
  cliSeconds?: number,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw: string | number | undefined =
    cliSeconds ?? env.JELLARR_WAIT_TIMEOUT;
  if (raw === undefined || raw === "") {
    return DEFAULT_WAIT_TIMEOUT_SECONDS * 1000;
  }
  const seconds: number = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(
      `Invalid wait timeout "${String(raw)}": expected a number of seconds`,
    );
  }
  return seconds * 1000;
}

async function isHealthy(
  baseUrl: string,
  fetchFn: typeof fetch,
): Promise<boolean> {
  try {
    const res: Response = await fetchFn(
      `${baseUrl.replace(/\/+$/, "")}/health`,
      { signal: AbortSignal.timeout(5000) },
    );
    await res.body?.cancel();
    return res.status === 200;
  } catch {
    return false;
  }
}

/**
 * Jellyfin answers /health before startup finishes. Until it does, API calls
 * return 503, or 500 while configuration is still loading, so readiness waits
 * for the public info endpoint to return 200.
 */
async function pollApiReady(
  baseUrl: string,
  options: WaitOptions,
  deadline: number,
): Promise<boolean> {
  const fetchFn: typeof fetch = options.fetchFn ?? fetch;
  const intervalMs: number = options.intervalMs ?? 1000;
  for (;;) {
    try {
      const res: Response = await fetchFn(
        `${baseUrl.replace(/\/+$/, "")}/System/Info/Public`,
        { signal: AbortSignal.timeout(5000) },
      );
      await res.body?.cancel();
      if (res.status === 200) return true;
    } catch {
      /* NOTE: a refused connection here means it restarted again; keep polling */
    }
    if (Date.now() >= deadline) return false;
    await sleep(intervalMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve: () => void) => setTimeout(resolve, ms));
}

async function pollUntil(
  baseUrl: string,
  wanted: boolean,
  options: WaitOptions,
  alsoDone?: () => Promise<boolean>,
): Promise<boolean> {
  const fetchFn: typeof fetch = options.fetchFn ?? fetch;
  const intervalMs: number = options.intervalMs ?? 1000;
  const deadline: number = Date.now() + options.timeoutMs;
  for (;;) {
    if ((await isHealthy(baseUrl, fetchFn)) === wanted) return true;
    if (alsoDone && (await alsoDone())) return true;
    if (Date.now() >= deadline) return false;
    await sleep(intervalMs);
  }
}

/**
 * Polls GET /health until it returns 200, so a Job that starts alongside
 * Jellyfin does not fail on the first connection refused.
 */
export async function waitForHealth(
  baseUrl: string,
  options: WaitOptions,
): Promise<void> {
  const deadline: number = Date.now() + options.timeoutMs;
  if (!(await pollUntil(baseUrl, true, options))) {
    throw new Error(
      `Jellyfin at ${baseUrl} did not report healthy on /health within ${(options.timeoutMs / 1000).toString()}s`,
    );
  }
  if (!(await pollApiReady(baseUrl, options, deadline))) {
    throw new Error(
      `Jellyfin at ${baseUrl} answered /health but /System/Info/Public did not return 200 within ${(options.timeoutMs / 1000).toString()}s`,
    );
  }
}

async function readMarker(options: WaitOptions): Promise<string | undefined> {
  try {
    return await options.readMarker?.();
  } catch {
    return undefined;
  }
}

/**
 * Waits for a restart requested over the API: first until /health stops
 * answering or the server's marker changes (a restart quicker than the poll
 * interval is only seen by the marker), then until it answers again. When
 * neither is seen the restart may not have happened, so it warns and still
 * waits for /health.
 */
export async function waitForRestart(
  baseUrl: string,
  options: WaitOptions,
): Promise<void> {
  const downWindowMs: number = Math.min(options.timeoutMs, 60_000);
  const before: string | undefined = await readMarker(options);
  const observed: boolean = await pollUntil(
    baseUrl,
    false,
    { ...options, timeoutMs: downWindowMs },
    async (): Promise<boolean> => {
      const now: string | undefined = await readMarker(options);
      return before !== undefined && now !== undefined && now !== before;
    },
  );
  if (!observed) {
    logger.warn(
      "jellarr did not observe the restart (/health stayed up and the server marker did not change); continuing to wait for /health",
    );
  }
  await waitForHealth(baseUrl, options);
}
