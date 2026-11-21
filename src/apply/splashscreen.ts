import { promises as fs } from "fs";
import type { JellyfinClient } from "../api/jellyfin.types";

/**
 * Jellyfin keeps no hash of the custom splashscreen, but `GET /Branding/Splashscreen`
 * returns the stored file byte for byte (or a generated collage when none is set),
 * so comparing bytes is the idempotence signal: upload only when they differ.
 */
export async function calculateSplashscreenUpload(
  client: JellyfinClient,
  file: string,
): Promise<Uint8Array | undefined> {
  const wanted: Buffer = await fs.readFile(file);
  const current: Uint8Array = await client.getSplashscreen();
  return Buffer.from(current).equals(wanted) ? undefined : wanted;
}

export async function applySplashscreen(
  client: JellyfinClient,
  image: Uint8Array | undefined,
): Promise<void> {
  if (!image) return;
  await client.uploadSplashscreen(image);
}
