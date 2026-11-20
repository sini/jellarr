export const DEFAULT_WAIT_TIMEOUT_SECONDS: number = 300;

export interface WaitOptions {
  timeoutMs: number;
  intervalMs?: number;
  fetchFn?: typeof fetch;
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
  if (!Number.isFinite(seconds) || seconds < 0) {
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
    return res.status === 200;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve: () => void) => setTimeout(resolve, ms));
}

async function pollUntil(
  baseUrl: string,
  wanted: boolean,
  options: WaitOptions,
): Promise<boolean> {
  const fetchFn: typeof fetch = options.fetchFn ?? fetch;
  const intervalMs: number = options.intervalMs ?? 1000;
  const deadline: number = Date.now() + options.timeoutMs;
  for (;;) {
    if ((await isHealthy(baseUrl, fetchFn)) === wanted) return true;
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
  if (!(await pollUntil(baseUrl, true, options))) {
    throw new Error(
      `Jellyfin at ${baseUrl} did not report healthy on /health within ${(options.timeoutMs / 1000).toString()}s`,
    );
  }
}

/**
 * Waits for a restart requested over the API: first for /health to stop
 * answering, then for it to answer again. A restart quicker than the poll
 * interval is not observed going down; callers verify what they need from the
 * restarted server afterwards.
 */
export async function waitForRestart(
  baseUrl: string,
  options: WaitOptions,
): Promise<void> {
  const downWindowMs: number = Math.min(options.timeoutMs, 60_000);
  await pollUntil(baseUrl, false, { ...options, timeoutMs: downWindowMs });
  await waitForHealth(baseUrl, options);
}
