import { describe, it, expect, vi } from "vitest";
import {
  applyXbmcMetadata,
  calculateXbmcMetadataDiff,
} from "../../src/apply/xbmc-metadata";
import { mapXbmcMetadataConfigToSchema } from "../../src/mappers/xbmc-metadata";
import { XbmcMetadataConfigType } from "../../src/types/config/xbmc-metadata";
import type { XbmcMetadataOptionsSchema } from "../../src/types/schema/xbmc-metadata";
import type { JellyfinClient } from "../../src/api/jellyfin.types";

vi.mock("../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const current: XbmcMetadataOptionsSchema = {
  UserId: null,
  ReleaseDateFormat: "yyyy-MM-dd",
  SaveImagePathsInNfo: false,
  EnablePathSubstitution: true,
  EnableExtraThumbsDuplication: false,
};

describe("xbmcmetadata (NFO options)", () => {
  it("whenEveryFieldIsDeclared_thenEveryFieldIsMapped", () => {
    expect(
      mapXbmcMetadataConfigToSchema({
        userId: "u1",
        releaseDateFormat: "yyyy",
        saveImagePathsInNfo: true,
        enablePathSubstitution: false,
        enableExtraThumbsDuplication: true,
      }),
    ).toEqual({
      UserId: "u1",
      ReleaseDateFormat: "yyyy",
      SaveImagePathsInNfo: true,
      EnablePathSubstitution: false,
      EnableExtraThumbsDuplication: true,
    });
  });

  it("whenOneFieldDiffers_thenOthersAreCarriedOver", () => {
    expect(
      calculateXbmcMetadataDiff(current, { saveImagePathsInNfo: true }),
    ).toEqual({ ...current, SaveImagePathsInNfo: true });
  });

  it("whenDeclaredEqualsCurrent_thenNothingChanges", () => {
    expect(
      calculateXbmcMetadataDiff(current, {
        releaseDateFormat: "yyyy-MM-dd",
        enablePathSubstitution: true,
        userId: null,
      }),
    ).toBeUndefined();
  });

  it("whenUserIdIsSetThenCleared_thenNullIsWritten", () => {
    expect(
      calculateXbmcMetadataDiff({ ...current, UserId: "u1" }, { userId: null }),
    ).toEqual(current);
  });

  it("whenNothingIsDeclared_thenNothingChanges", () => {
    expect(calculateXbmcMetadataDiff(current, {})).toBeUndefined();
  });

  it("whenApplied_thenTheNamedKeyIsWritten", async () => {
    const client: Pick<JellyfinClient, "updateXbmcMetadataConfiguration"> = {
      updateXbmcMetadataConfiguration: vi.fn().mockResolvedValue(undefined),
    };
    await applyXbmcMetadata(client as JellyfinClient, current);
    await applyXbmcMetadata(client as JellyfinClient, undefined);
    expect(client.updateXbmcMetadataConfiguration).toHaveBeenCalledTimes(1);
  });

  it("whenConfigHasUnknownKey_thenItIsRejected", () => {
    expect(XbmcMetadataConfigType.safeParse({ bogus: 1 }).success).toBe(false);
    expect(
      XbmcMetadataConfigType.safeParse({ releaseDateFormat: "" }).success,
    ).toBe(false);
  });
});
