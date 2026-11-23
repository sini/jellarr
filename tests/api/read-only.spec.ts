import { describe, it, expect, vi } from "vitest";
import { guardReadOnly } from "../../src/api/read-only";
import type { JellyfinClient } from "../../src/api/jellyfin.types";

describe("guardReadOnly", () => {
  it("blocks deleteSplashscreen but lets getSplashscreen through", async () => {
    const deleteSplashscreen: ReturnType<typeof vi.fn> = vi.fn();
    const getSplashscreen: ReturnType<typeof vi.fn> = vi
      .fn()
      .mockResolvedValue(new Uint8Array([1]));
    const guarded: JellyfinClient = guardReadOnly({
      deleteSplashscreen,
      getSplashscreen,
    } as unknown as JellyfinClient);

    expect(() => guarded.deleteSplashscreen()).toThrow(/read-only/);
    expect(deleteSplashscreen).not.toHaveBeenCalled();
    await expect(guarded.getSplashscreen()).resolves.toHaveLength(1);
  });

  it("blocks the display-preferences write but lets the read through", async () => {
    const updateDisplayPreferences: ReturnType<typeof vi.fn> = vi.fn();
    const getDisplayPreferences: ReturnType<typeof vi.fn> = vi
      .fn()
      .mockResolvedValue({});
    const guarded: JellyfinClient = guardReadOnly({
      updateDisplayPreferences,
      getDisplayPreferences,
    } as unknown as JellyfinClient);

    expect(() => guarded.updateDisplayPreferences("u", {})).toThrow(
      /read-only/,
    );
    expect(updateDisplayPreferences).not.toHaveBeenCalled();
    await expect(guarded.getDisplayPreferences("u")).resolves.toEqual({});
  });
});
