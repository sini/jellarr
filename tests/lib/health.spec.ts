import { describe, it, expect, vi, type Mock } from "vitest";
import {
  waitForHealth,
  waitForRestart,
  resolveWaitTimeoutMs,
} from "../../src/lib/health";

const ENV_KEY: string = "JELLARR_WAIT_TIMEOUT";

describe("lib/health", () => {
  it("whenServerComesUpLate_thenWaitForHealthResolves", async () => {
    // Arrange
    const fetchFn: Mock = vi
      .fn()
      .mockRejectedValueOnce(new Error("refused"))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValue(new Response("Healthy", { status: 200 }));

    // Act
    await waitForHealth("http://jf:8096/", {
      timeoutMs: 5000,
      intervalMs: 1,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Assert
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(fetchFn.mock.calls[0]?.[0]).toBe("http://jf:8096/health");
    expect(fetchFn.mock.calls[3]?.[0]).toBe(
      "http://jf:8096/System/Info/Public",
    );
  });

  it("whenServerNeverHealthy_thenWaitForHealthThrowsClearError", async () => {
    // Arrange
    const fetchFn: Mock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response("", { status: 503 })),
      );

    // Act + Assert
    await expect(
      waitForHealth("http://jf:8096", {
        timeoutMs: 20,
        intervalMs: 5,
        fetchFn: fetchFn as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/did not report healthy on \/health within 0.02s/);
  });

  it("whenRestartRequested_thenWaitsForDownThenUp", async () => {
    // Arrange
    const fetchFn: Mock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockRejectedValueOnce(new Error("refused"))
      .mockResolvedValue(new Response("", { status: 200 }));

    // Act
    await waitForRestart("http://jf:8096", {
      timeoutMs: 5000,
      intervalMs: 1,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Assert
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it("whenHealthUpButApiStillStarting_thenWaitsForTheApi", async () => {
    // Arrange
    const fetchFn: Mock = vi.fn((url: string) =>
      Promise.resolve(
        new Response("", {
          status:
            url.endsWith("/health") || fetchFn.mock.calls.length > 4
              ? 200
              : 503,
        }),
      ),
    );

    // Act
    await waitForHealth("http://jf:8096", {
      timeoutMs: 5000,
      intervalMs: 1,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Assert
    const apiCalls: number = fetchFn.mock.calls.filter(
      (call: unknown[]) => call[0] === "http://jf:8096/System/Info/Public",
    ).length;
    expect(apiCalls).toBeGreaterThan(1);
  });

  it("whenApiNeverLeavesStartup_thenWaitForHealthThrowsClearError", async () => {
    // Arrange
    const fetchFn: Mock = vi.fn((url: string) =>
      Promise.resolve(
        new Response("", { status: url.endsWith("/health") ? 200 : 503 }),
      ),
    );

    // Act + Assert
    await expect(
      waitForHealth("http://jf:8096", {
        timeoutMs: 20,
        intervalMs: 5,
        fetchFn: fetchFn as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/\/System\/Info\/Public did not return 200/);
  });

  it("whenApiReturns500WhileConfigurationLoads_thenKeepsWaiting", async () => {
    // Arrange
    let apiCalls: number = 0;
    const fetchFn: Mock = vi.fn((url: string) => {
      if (url.endsWith("/health"))
        return Promise.resolve(new Response("Healthy", { status: 200 }));
      apiCalls += 1;
      return Promise.resolve(
        new Response("", { status: apiCalls < 3 ? 500 : 200 }),
      );
    });

    // Act
    await waitForHealth("http://jf:8096", {
      timeoutMs: 5000,
      intervalMs: 1,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Assert
    expect(apiCalls).toBe(3);
  });

  it("whenCliSecondsGiven_thenTheyBeatTheEnvVar", () => {
    expect(resolveWaitTimeoutMs(7, { [ENV_KEY]: "9" })).toBe(7000);
    expect(resolveWaitTimeoutMs(undefined, { [ENV_KEY]: "9" })).toBe(9000);
    expect(resolveWaitTimeoutMs(undefined, {})).toBe(300_000);
    expect(() =>
      resolveWaitTimeoutMs(undefined, { [ENV_KEY]: "soon" }),
    ).toThrow(/Invalid wait timeout/);
  });
});

describe("lib/health restart observation", () => {
  const healthy: () => Promise<Response> = (): Promise<Response> =>
    Promise.resolve(new Response("", { status: 200 }));

  it("whenTimeoutIsZero_thenItIsRejected", () => {
    expect(() => resolveWaitTimeoutMs(0, {})).toThrow(/Invalid wait timeout/);
    expect(() => resolveWaitTimeoutMs(undefined, { [ENV_KEY]: "0" })).toThrow(
      /Invalid wait timeout/,
    );
  });

  it("whenHealthNeverGoesDownButMarkerChanges_thenItIsObservedWithoutWarning", async () => {
    // Arrange
    const warn: Mock = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const readMarker: Mock = vi
      .fn()
      .mockResolvedValueOnce("true")
      .mockResolvedValue("false");

    // Act
    await waitForRestart("http://jf:8096", {
      timeoutMs: 5000,
      intervalMs: 1,
      readMarker,
      fetchFn: healthy as unknown as typeof fetch,
    });

    // Assert
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("whenNeitherDownNorMarkerChangeIsSeen_thenItWarnsAndContinues", async () => {
    // Arrange
    const warn: Mock = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    // Act
    await waitForRestart("http://jf:8096", {
      timeoutMs: 30,
      intervalMs: 5,
      readMarker: () => Promise.resolve("same"),
      fetchFn: healthy as unknown as typeof fetch,
    });

    // Assert
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("did not observe the restart"),
    );
    warn.mockRestore();
  });
});
