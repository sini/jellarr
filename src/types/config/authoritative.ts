import { z } from "zod";

const NamesType: z.ZodOptional<z.ZodArray<z.ZodString>> = z
  .array(z.string().min(1, "keep entries cannot be empty"))
  .optional();

export const AuthoritativeKeepType: z.ZodObject<{
  users: typeof NamesType;
  libraries: typeof NamesType;
  plugins: typeof NamesType;
  apiKeys: typeof NamesType;
}> = z
  .object({
    users: NamesType,
    libraries: NamesType,
    plugins: NamesType,
    apiKeys: NamesType,
  })
  .strict();

export const AuthoritativeConfigType: z.ZodObject<{
  users: z.ZodOptional<
    z.ZodUnion<
      readonly [
        z.ZodBoolean,
        z.ZodEnum<{ delete: "delete"; disable: "disable" }>,
      ]
    >
  >;
  libraries: z.ZodOptional<z.ZodBoolean>;
  plugins: z.ZodOptional<z.ZodBoolean>;
  apiKeys: z.ZodOptional<z.ZodBoolean>;
  livetv: z.ZodOptional<z.ZodBoolean>;
  keep: z.ZodOptional<typeof AuthoritativeKeepType>;
  allowMassDelete: z.ZodOptional<z.ZodBoolean>;
  deleteDisabledAfter: z.ZodOptional<z.ZodString>;
}> = z
  .object({
    users: z.union([z.boolean(), z.enum(["delete", "disable"])]).optional(),
    libraries: z.boolean().optional(),
    plugins: z.boolean().optional(),
    apiKeys: z.boolean().optional(),
    livetv: z.boolean().optional(),
    keep: AuthoritativeKeepType.optional(),
    allowMassDelete: z.boolean().optional(),
    deleteDisabledAfter: z.string().optional(),
  })
  .strict();

export type AuthoritativeConfig = z.infer<typeof AuthoritativeConfigType>;
