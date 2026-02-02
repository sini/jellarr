import { z } from "zod";

export const FileRefType: z.ZodObject<{ _file: z.ZodString }, z.core.$strict> =
  z
    .object({
      _file: z.string().min(1, "File path cannot be empty"),
    })
    .strict();

export type FileRef = z.infer<typeof FileRefType>;
