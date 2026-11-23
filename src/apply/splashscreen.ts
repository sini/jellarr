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

/**
 * The server serves a custom splashscreen only while splashscreenEnabled is
 * true and answers 404 otherwise, so a custom image can be seen, and removed,
 * only while enabled: removal is due when enabled and the GET returns an image.
 */
export async function calculateSplashscreenRemoval(
  client: JellyfinClient,
  enabled: boolean | undefined,
): Promise<boolean> {
  if (!enabled) return false;
  return (await client.getSplashscreen()).length > 0;
}

export async function applySplashscreenRemoval(
  client: JellyfinClient,
  remove: boolean,
): Promise<void> {
  if (remove) await client.deleteSplashscreen();
}

export async function applySplashscreen(
  client: JellyfinClient,
  image: Uint8Array | undefined,
): Promise<void> {
  if (!image) return;
  await client.uploadSplashscreen(image);
}
