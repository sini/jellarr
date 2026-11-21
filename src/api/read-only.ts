import type { JellyfinClient } from "./jellyfin.types";

/** Methods that only issue GET requests with no server-side effect. */
const READ_ONLY: ReadonlySet<string> = new Set([
  "getServerVersion",
  "getPendingRestart",
  "getSystemConfiguration",
  "getEncodingConfiguration",
  "getNetworkingConfiguration",
  "getMetadataConfiguration",
  "getVirtualFolders",
  "getBrandingConfiguration",
  "getSplashscreen",
  "getLiveTvOptions",
  "getUsers",
  "getPlugins",
  "getPackages",
  "getPluginConfiguration",
  "getApiKeys",
  "getPublicSystemInfo",
]);

/**
 * Wraps a client so that anything outside the read-only allow-list throws.
 * Dry run is read-only by construction: signing in, writing and restarting
 * cannot be reached even by a call site that forgets to check.
 */
export function guardReadOnly(client: JellyfinClient): JellyfinClient {
  return new Proxy(client, {
    get(target: JellyfinClient, prop: string | symbol): unknown {
      const value: unknown = Reflect.get(target, prop) as unknown;
      if (typeof prop !== "string" || typeof value !== "function") return value;
      if (READ_ONLY.has(prop)) return value;
      return (): never => {
        throw new Error(`dry run: ${prop} is not allowed (read-only mode)`);
      };
    },
  });
}
