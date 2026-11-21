import { createHash } from "crypto";
import { describe, it, expect, vi } from "vitest";
import {
  calculateLiveTvDiff,
  applyLiveTv,
  type LiveTvDiff,
} from "../../src/apply/livetv";
import type { JellyfinClient } from "../../src/api/jellyfin.types";
import type { LiveTvConfig } from "../../src/types/config/livetv";
import type {
  LiveTvOptionsSchema,
  ListingsProviderInfoSchema,
  TunerHostInfoSchema,
} from "../../src/types/schema/livetv";

vi.mock("../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const sha1: (text: string) => string = (text: string): string =>
  createHash("sha1").update(text).digest("hex");

/** A fake server that behaves like Jellyfin: ids on create, replace on a known id, hashed listings passwords. */
function fakeServer(initial: LiveTvOptionsSchema): {
  client: JellyfinClient;
  state: LiveTvOptionsSchema;
  calls: string[];
} {
  const state: LiveTvOptionsSchema = structuredClone(initial);
  const calls: string[] = [];
  let next: number = 1;
  const upsert: <T extends { Id?: string | null }>(
    list: T[],
    entry: T,
  ) => T[] = <T extends { Id?: string | null }>(list: T[], entry: T): T[] => {
    const saved: T = { ...entry, Id: entry.Id ?? `id${(next++).toString()}` };
    return list.some((e: T) => e.Id === saved.Id)
      ? list.map((e: T) => (e.Id === saved.Id ? saved : e))
      : [...list, saved];
  };
  const client: JellyfinClient = {
    getLiveTvOptions: (): Promise<LiveTvOptionsSchema> =>
      Promise.resolve(structuredClone(state)),
    updateLiveTvOptions: (body: LiveTvOptionsSchema): Promise<void> => {
      calls.push("options");
      Object.assign(state, structuredClone(body));
      return Promise.resolve();
    },
    saveTunerHost: (body: TunerHostInfoSchema): Promise<void> => {
      calls.push(`host ${body.Url ?? ""}`);
      state.TunerHosts = upsert(state.TunerHosts ?? [], body);
      return Promise.resolve();
    },
    deleteTunerHost: (id: string): Promise<void> => {
      calls.push(`delete host ${id}`);
      state.TunerHosts = (state.TunerHosts ?? []).filter(
        (h: TunerHostInfoSchema) => h.Id !== id,
      );
      return Promise.resolve();
    },
    saveListingProvider: (
      body: ListingsProviderInfoSchema,
      password?: string,
    ): Promise<void> => {
      calls.push(`provider ${body.Type ?? ""}`);
      state.ListingProviders = upsert(state.ListingProviders ?? [], {
        ...body,
        ...(password === undefined ? {} : { Password: sha1(password) }),
      });
      return Promise.resolve();
    },
    deleteListingProvider: (id: string): Promise<void> => {
      calls.push(`delete provider ${id}`);
      state.ListingProviders = (state.ListingProviders ?? []).filter(
        (p: ListingsProviderInfoSchema) => p.Id !== id,
      );
      return Promise.resolve();
    },
  } as unknown as JellyfinClient;
  return { client, state, calls };
}

async function run(
  server: ReturnType<typeof fakeServer>,
  cfg: LiveTvConfig,
): Promise<LiveTvDiff | undefined> {
  const diff: LiveTvDiff | undefined = calculateLiveTvDiff(
    await server.client.getLiveTvOptions(),
    cfg,
  );
  await applyLiveTv(server.client, diff);
  return diff;
}

const config: LiveTvConfig = {
  guideDays: 7,
  saveRecordingNfo: true,
  tunerHosts: [
    { type: "m3u", url: "http://tv.example/list.m3u", tunerCount: 2 },
  ],
  listingProviders: [
    { type: "xmltv", path: "/guide.xml", enableAllTuners: true },
    {
      type: "SchedulesDirect",
      username: "me",
      listingsId: "lineup1",
      password: "hunter2",
    },
  ],
};

describe("livetv", () => {
  it("creates everything on the first run and changes nothing on the second", async () => {
    const server: ReturnType<typeof fakeServer> = fakeServer({
      GuideDays: 3,
      MediaLocationsCreated: ["keep"],
    });

    const first: LiveTvDiff | undefined = await run(server, config);
    const second: LiveTvDiff | undefined = await run(server, config);

    expect(first?.hosts).toHaveLength(1);
    expect(first?.providers).toHaveLength(2);
    expect(second).toBeUndefined();
    expect(server.state.GuideDays).toBe(7);
    expect(server.state.MediaLocationsCreated).toEqual(["keep"]);
    expect(server.calls[0]).toBe("options");
  });

  it("updates a changed host in place by its type and url, keeping the id", async () => {
    const server: ReturnType<typeof fakeServer> = fakeServer({
      TunerHosts: [
        {
          Id: "h1",
          Type: "m3u",
          Url: "http://tv.example/list.m3u",
          TunerCount: 1,
        },
      ],
    });

    await run(server, { tunerHosts: config.tunerHosts });

    expect(server.state.TunerHosts).toEqual([
      {
        Id: "h1",
        Type: "m3u",
        Url: "http://tv.example/list.m3u",
        TunerCount: 2,
      },
    ]);
  });

  it("is additive by default: entries the config does not declare survive", async () => {
    const server: ReturnType<typeof fakeServer> = fakeServer({
      TunerHosts: [{ Id: "old", Type: "m3u", Url: "http://old.example/" }],
      ListingProviders: [{ Id: "oldp", Type: "xmltv", Path: "/old.xml" }],
    });

    const diff: LiveTvDiff | undefined = await run(server, config);

    expect(diff?.hostsToDelete).toEqual([]);
    expect(server.state.TunerHosts).toHaveLength(2);
    expect(server.state.ListingProviders).toHaveLength(3);
  });

  it("deletes undeclared entries only when authoritative, and only in a declared list", async () => {
    const server: ReturnType<typeof fakeServer> = fakeServer({
      TunerHosts: [{ Id: "old", Type: "m3u", Url: "http://old.example/" }],
      ListingProviders: [{ Id: "oldp", Type: "xmltv", Path: "/old.xml" }],
    });
    const cfg: LiveTvConfig = {
      authoritative: true,
      tunerHosts: config.tunerHosts,
    };

    await run(server, cfg);

    expect(server.state.TunerHosts).toHaveLength(1);
    expect(server.state.TunerHosts?.[0]?.Url).toBe(
      "http://tv.example/list.m3u",
    );
    expect(server.state.ListingProviders).toHaveLength(1);
    expect(await run(server, cfg)).toBeUndefined();
  });

  it("treats a stored hash or plain text as a matching password, and re-sends a different one", () => {
    const provider: ListingsProviderInfoSchema = {
      Id: "p",
      Type: "SchedulesDirect",
      Username: "me",
      ListingsId: "lineup1",
      Password: sha1("hunter2"),
    };
    const cfg: (password: string) => LiveTvConfig = (
      password: string,
    ): LiveTvConfig => ({
      listingProviders: [
        {
          type: "SchedulesDirect",
          username: "me",
          listingsId: "lineup1",
          password,
        },
      ],
    });

    expect(
      calculateLiveTvDiff({ ListingProviders: [provider] }, cfg("hunter2")),
    ).toBeUndefined();
    const changed: LiveTvDiff | undefined = calculateLiveTvDiff(
      { ListingProviders: [provider] },
      cfg("other"),
    );
    expect(changed?.providers[0]?.password).toBe("other");
    expect(changed?.providers[0]?.next.Password).toBe(sha1("hunter2"));
  });

  it("rejects two declared entries with the same identity", () => {
    expect(() =>
      calculateLiveTvDiff(
        {},
        {
          tunerHosts: [
            { type: "m3u", url: "http://a" },
            { type: "m3u", url: "http://a" },
          ],
        },
      ),
    ).toThrow(/duplicate tuner host/);
  });
});
