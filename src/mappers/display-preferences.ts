import { withoutUndefined } from "../lib/objects";
import type { DisplayPreferencesConfig } from "../types/config/display-preferences";
import type { DisplayPreferencesDtoSchema } from "../types/schema/users";

/** Jellyfin stores every custom preference as a string. */
export function mapDisplayPreferencesConfigToSchema(
  desired: DisplayPreferencesConfig,
): Partial<DisplayPreferencesDtoSchema> {
  return withoutUndefined({
    ViewType: desired.viewType,
    SortBy: desired.sortBy,
    IndexBy: desired.indexBy,
    RememberIndexing: desired.rememberIndexing,
    PrimaryImageHeight: desired.primaryImageHeight,
    PrimaryImageWidth: desired.primaryImageWidth,
    CustomPrefs:
      desired.customPrefs === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(desired.customPrefs).map(
              ([key, value]: [string, string | number | boolean]): [
                string,
                string,
              ] => [key, String(value)],
            ),
          ),
    ScrollDirection: desired.scrollDirection,
    ShowBackdrop: desired.showBackdrop,
    RememberSorting: desired.rememberSorting,
    SortOrder: desired.sortOrder,
    ShowSidebar: desired.showSidebar,
  }) as Partial<DisplayPreferencesDtoSchema>;
}
