import { z } from "zod";

/** The id and client under which jellarr keeps its own markers; never declarable. */
export const RESERVED_DISPLAY_PREFERENCES: string = "jellarr";

/** The entry Jellyfin Web stores a user's settings under (id usersettings, client emby). */
export const DEFAULT_DISPLAY_PREFERENCES_ID: string = "usersettings";

export const DisplayPreferencesConfigType: z.ZodObject<
  {
    client: z.ZodString;
    id: z.ZodOptional<z.ZodString>;
    viewType: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodOptional<z.ZodString>;
    indexBy: z.ZodOptional<z.ZodString>;
    rememberIndexing: z.ZodOptional<z.ZodBoolean>;
    primaryImageHeight: z.ZodOptional<z.ZodNumber>;
    primaryImageWidth: z.ZodOptional<z.ZodNumber>;
    customPrefs: z.ZodOptional<
      z.ZodRecord<
        z.ZodString,
        z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>
      >
    >;
    scrollDirection: z.ZodOptional<
      z.ZodEnum<{ Horizontal: "Horizontal"; Vertical: "Vertical" }>
    >;
    showBackdrop: z.ZodOptional<z.ZodBoolean>;
    rememberSorting: z.ZodOptional<z.ZodBoolean>;
    sortOrder: z.ZodOptional<
      z.ZodEnum<{ Ascending: "Ascending"; Descending: "Descending" }>
    >;
    showSidebar: z.ZodOptional<z.ZodBoolean>;
  },
  z.core.$strict
> = z
  .object({
    client: z
      .string()
      .min(1)
      .refine((value: string) => value !== RESERVED_DISPLAY_PREFERENCES, {
        message: `client "${RESERVED_DISPLAY_PREFERENCES}" is jellarr's own marker store`,
      }),
    id: z
      .string()
      .min(1)
      .refine((value: string) => value !== RESERVED_DISPLAY_PREFERENCES, {
        message: `id "${RESERVED_DISPLAY_PREFERENCES}" is jellarr's own marker store`,
      })
      .optional(),
    viewType: z.string().optional(),
    sortBy: z.string().optional(),
    indexBy: z.string().optional(),
    rememberIndexing: z.boolean().optional(),
    primaryImageHeight: z.number().int().min(0).optional(),
    primaryImageWidth: z.number().int().min(0).optional(),
    customPrefs: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
    scrollDirection: z.enum(["Horizontal", "Vertical"]).optional(),
    showBackdrop: z.boolean().optional(),
    rememberSorting: z.boolean().optional(),
    sortOrder: z.enum(["Ascending", "Descending"]).optional(),
    showSidebar: z.boolean().optional(),
  })
  .strict();

export type DisplayPreferencesConfig = z.infer<
  typeof DisplayPreferencesConfigType
>;
