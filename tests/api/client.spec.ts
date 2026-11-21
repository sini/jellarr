import { describe, it, expect, vi, type Mock } from "vitest";
import { makeClient } from "../../src/api/client";
import { type paths } from "../../generated/schema";
import type { Client } from "openapi-fetch";

describe("api/client", () => {
  it("whenClientCreated_thenHeadersInjectedOnEachRequest()", async () => {
    // Arrange
    const spy: Mock = vi
      .spyOn(globalThis as unknown as { fetch: typeof fetch }, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    try {
      // Act
      const jf: Client<paths> = makeClient("http://example:8096", "XYZ");

      await jf.GET("/System/Info/Public");

      // Assert
      expect(spy).toHaveBeenCalledTimes(1);

      const req: Request = spy.mock.calls[0]?.[0] as Request;
      expect(req).toBeInstanceOf(Request);

      const h: Headers = req.headers;
      expect(h.get("Authorization")).toBe(
        'MediaBrowser Token="XYZ", Client="jellarr", Device="cli", DeviceId="jellarr", Version="0.3.1"',
      );
      expect(h.get("X-Emby-Token")).toBeNull();
      expect(h.get("X-Emby-Authorization")).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("whenNoTokenGiven_thenHeaderOmitsTokenAndCarriesDeviceId()", async () => {
    // Arrange
    const spy: Mock = vi
      .spyOn(globalThis as unknown as { fetch: typeof fetch }, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    try {
      // Act
      const jf: Client<paths> = makeClient(
        "http://example:8096",
        undefined,
        "probe",
      );
      await jf.GET("/System/Info/Public");

      // Assert
      const req: Request = spy.mock.calls[0]?.[0] as Request;
      expect(req.headers.get("Authorization")).toBe(
        'MediaBrowser Client="jellarr", Device="cli", DeviceId="probe", Version="0.3.1"',
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("whenTokenSourceIsFunction_thenLatestValueIsUsedPerRequest()", async () => {
    // Arrange
    const spy: Mock = vi
      .spyOn(globalThis as unknown as { fetch: typeof fetch }, "fetch")
      .mockImplementation(() =>
        Promise.resolve(new Response("{}", { status: 200 })),
      );
    let token: string = "one";

    try {
      const jf: Client<paths> = makeClient(
        "http://example:8096",
        (): string => token,
      );

      // Act
      await jf.GET("/System/Info/Public");
      token = "two";
      await jf.GET("/System/Info/Public");

      // Assert
      const auth: (call: number) => string | null = (call: number) =>
        (spy.mock.calls[call]?.[0] as Request).headers.get("Authorization");
      expect(auth(0)).toContain('Token="one"');
      expect(auth(1)).toContain('Token="two"');
    } finally {
      spy.mockRestore();
    }
  });
});
