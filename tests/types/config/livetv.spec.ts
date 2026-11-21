import { describe, it, expect } from "vitest";
import { LiveTvConfigType } from "../../../src/types/config/livetv";

describe("LiveTvConfig", () => {
  it("accepts options, tuner hosts and listing providers", () => {
    expect(
      LiveTvConfigType.safeParse({
        guideDays: 7,
        authoritative: true,
        tunerHosts: [{ type: "m3u", url: "http://tv/l.m3u", tunerCount: 2 }],
        listingProviders: [
          {
            type: "xmltv",
            path: "/g.xml",
            channelMappings: [{ name: "a", value: "b" }],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects a tuner host without a url and unknown keys", () => {
    expect(
      LiveTvConfigType.safeParse({ tunerHosts: [{ type: "m3u" }] }).success,
    ).toBe(false);
    expect(LiveTvConfigType.safeParse({ bogus: 1 }).success).toBe(false);
  });
});
