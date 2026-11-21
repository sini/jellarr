import { z } from "zod";

export const BrandingOptionsConfigType: z.ZodObject<{
  loginDisclaimer: z.ZodOptional<z.ZodString>;
  customCss: z.ZodOptional<z.ZodString>;
  splashscreenEnabled: z.ZodOptional<z.ZodBoolean>;
  splashscreenFile: z.ZodOptional<z.ZodString>;
}> = z
  .object({
    loginDisclaimer: z.string().optional(),
    customCss: z.string().optional(),
    splashscreenEnabled: z.boolean().optional(),
    splashscreenFile: z.string().min(1).optional(),
  })
  .strict();

export type BrandingOptionsConfig = z.infer<typeof BrandingOptionsConfigType>;
