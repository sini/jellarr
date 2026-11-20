import { z } from "zod";

export const StartupRemoteAccessConfigType: z.ZodObject<
  {
    enableRemoteAccess: z.ZodBoolean;
    enableAutomaticPortMapping: z.ZodBoolean;
  },
  z.core.$strict
> = z
  .object({
    enableRemoteAccess: z.boolean(),
    enableAutomaticPortMapping: z.boolean(),
  })
  .strict();

export type StartupRemoteAccessConfig = z.infer<
  typeof StartupRemoteAccessConfigType
>;

export const StartupUserConfigType: z.ZodObject<
  {
    name: z.ZodString;
    password: z.ZodOptional<z.ZodString>;
    passwordFile: z.ZodOptional<z.ZodString>;
  },
  z.core.$strict
> = z
  .object({
    name: z.string().min(1, "User name is required"),
    password: z.string().optional(),
    passwordFile: z.string().optional(),
  })
  .strict()
  .refine(
    (data: { password?: string; passwordFile?: string }) => {
      const hasPassword: boolean =
        data.password !== undefined && data.password.trim() !== "";
      const hasPasswordFile: boolean =
        data.passwordFile !== undefined && data.passwordFile.trim() !== "";
      return hasPassword !== hasPasswordFile;
    },
    {
      message: "Must specify exactly one of 'password' or 'passwordFile'",
      path: [],
    },
  );

export type StartupUserConfig = z.infer<typeof StartupUserConfigType>;

export const StartupConfigType: z.ZodObject<
  {
    serverName: z.ZodOptional<z.ZodString>;
    preferredMetadataLanguage: z.ZodOptional<z.ZodString>;
    metadataCountryCode: z.ZodOptional<z.ZodString>;
    uiCulture: z.ZodOptional<z.ZodString>;
    remoteAccess: z.ZodOptional<typeof StartupRemoteAccessConfigType>;
    user: z.ZodOptional<typeof StartupUserConfigType>;
    completeStartupWizard: z.ZodOptional<z.ZodBoolean>;
  },
  z.core.$strict
> = z
  .object({
    serverName: z.string().optional(),
    preferredMetadataLanguage: z.string().optional(),
    metadataCountryCode: z.string().optional(),
    uiCulture: z.string().optional(),
    remoteAccess: StartupRemoteAccessConfigType.optional(),
    user: StartupUserConfigType.optional(),
    completeStartupWizard: z.boolean().optional(),
  })
  .strict();

export type StartupConfig = z.infer<typeof StartupConfigType>;
