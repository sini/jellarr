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
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(fetchFn.mock.calls[0]?.[0]).toBe("http://jf:8096/health");
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
    expect(fetchFn).toHaveBeenCalledTimes(3);
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
