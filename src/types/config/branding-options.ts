import { z } from "zod";

export const BrandingOptionsConfigType: z.ZodObject<{
  loginDisclaimer: z.ZodOptional<z.ZodString>;
  customCss: z.ZodOptional<z.ZodString>;
  splashscreenEnabled: z.ZodOptional<z.ZodBoolean>;
  splashscreenFile: z.ZodOptional<z.ZodString>;
  removeSplashscreen: z.ZodOptional<z.ZodBoolean>;
}> = z
  .object({
    loginDisclaimer: z.string().optional(),
    customCss: z.string().optional(),
    splashscreenEnabled: z.boolean().optional(),
    splashscreenFile: z.string().min(1).optional(),
    removeSplashscreen: z.boolean().optional(),
  })
  .strict()
  .refine(
    (config: { removeSplashscreen?: boolean; splashscreenFile?: string }) =>
      !(config.removeSplashscreen && config.splashscreenFile),
    {
      message: "removeSplashscreen cannot be combined with splashscreenFile",
      path: ["removeSplashscreen"],
    },
  );

export type BrandingOptionsConfig = z.infer<typeof BrandingOptionsConfigType>;
