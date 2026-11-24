import { type XbmcMetadataConfig } from "../types/config/xbmc-metadata";
import { type XbmcMetadataOptionsSchema } from "../types/schema/xbmc-metadata";
import { withoutUndefined } from "../lib/objects";

export function mapXbmcMetadataConfigToSchema(
  desired: XbmcMetadataConfig,
): Partial<XbmcMetadataOptionsSchema> {
  return withoutUndefined({
    UserId: desired.userId,
    ReleaseDateFormat: desired.releaseDateFormat,
    SaveImagePathsInNfo: desired.saveImagePathsInNfo,
    EnablePathSubstitution: desired.enablePathSubstitution,
    EnableExtraThumbsDuplication: desired.enableExtraThumbsDuplication,
  }) as Partial<XbmcMetadataOptionsSchema>;
}
