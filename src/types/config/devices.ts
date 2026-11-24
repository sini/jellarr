import { z } from "zod";

export const DeviceConfigType: z.ZodObject<
  {
    id: z.ZodString;
    customName: z.ZodNullable<z.ZodString>;
  },
  z.core.$strict
> = z
  .object({
    id: z.string().min(1, "Device id cannot be empty"),
    customName: z.string().min(1).nullable(),
  })
  .strict();

export type DeviceConfig = z.infer<typeof DeviceConfigType>;

export const DeviceConfigListType: z.ZodArray<typeof DeviceConfigType> = z
  .array(DeviceConfigType)
  .refine(
    (devices: DeviceConfig[]) =>
      new Set(devices.map((device: DeviceConfig) => device.id)).size ===
      devices.length,
    { message: "devices must be unique by id" },
  );

export type DeviceConfigList = z.infer<typeof DeviceConfigListType>;
