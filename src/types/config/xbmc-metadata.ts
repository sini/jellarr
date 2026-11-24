import { z } from "zod";

export const XbmcMetadataConfigType: z.ZodObject<{
  userId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  releaseDateFormat: z.ZodOptional<z.ZodString>;
  saveImagePathsInNfo: z.ZodOptional<z.ZodBoolean>;
  enablePathSubstitution: z.ZodOptional<z.ZodBoolean>;
  enableExtraThumbsDuplication: z.ZodOptional<z.ZodBoolean>;
}> = z
  .object({
    userId: z.string().min(1).nullable().optional(),
    releaseDateFormat: z.string().min(1).optional(),
    saveImagePathsInNfo: z.boolean().optional(),
    enablePathSubstitution: z.boolean().optional(),
    enableExtraThumbsDuplication: z.boolean().optional(),
  })
  .strict();

export type XbmcMetadataConfig = z.infer<typeof XbmcMetadataConfigType>;
