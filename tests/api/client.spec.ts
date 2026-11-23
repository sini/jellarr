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
        'MediaBrowser Token="XYZ", Client="jellarr", Device="cli", DeviceId="jellarr", Version="0.5.0"',
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
        'MediaBrowser Client="jellarr", Device="cli", DeviceId="probe", Version="0.5.0"',
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

describe("api/client 503 retry", () => {
  const retry: { timeoutMs: number; firstDelayMs: number; maxDelayMs: number } =
    { timeoutMs: 200, firstDelayMs: 5, maxDelayMs: 10 };

  function stub(statuses: number[]): Mock {
    let i: number = 0;
    return vi
      .spyOn(globalThis as unknown as { fetch: typeof fetch }, "fetch")
      .mockImplementation(() =>
        Promise.resolve(
          new Response("{}", {
            status: statuses[Math.min(i++, statuses.length - 1)] ?? 200,
          }),
        ),
      );
  }

  it("retries 503 until the server answers", async () => {
    const spy: Mock = stub([503, 503, 200]);
    const jf: Client<paths> = makeClient("http://x", "T", "d", retry);
    const res: { response: Response } = await jf.GET("/System/Configuration");
    expect(res.response.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });

  it("fails with a clear error after the deadline", async () => {
    const spy: Mock = stub([503]);
    const jf: Client<paths> = makeClient("http://x", "T", "d", retry);
    await expect(jf.GET("/System/Configuration")).rejects.toThrow(
      /still answered 503.*waitTimeout/,
    );
    spy.mockRestore();
  });

  it.each([500, 401, 404])("does not retry %i", async (status: number) => {
    const spy: Mock = stub([status, 200]);
    const jf: Client<paths> = makeClient("http://x", "T", "d", retry);
    const res: { response: Response } = await jf.GET("/System/Configuration");
    expect(res.response.status).toBe(status);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("retries a POST with its body intact", async () => {
    const bodies: string[] = [];
    let n: number = 0;
    const spy: Mock = vi
      .spyOn(globalThis as unknown as { fetch: typeof fetch }, "fetch")
      .mockImplementation(async (req: unknown) => {
        bodies.push(await (req as Request).text());
        return new Response("{}", { status: n++ === 0 ? 503 : 200 });
      });
    const jf: Client<paths> = makeClient("http://x", "T", "d", retry);
    const res: { response: Response } = await jf.POST("/System/Configuration", {
      body: { ServerName: "a" } as never,
    });
    expect(res.response.status).toBe(200);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toBe(bodies[0]);
    expect(bodies[0]).toContain("ServerName");
    spy.mockRestore();
  });
});
