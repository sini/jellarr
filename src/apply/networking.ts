import { logger } from "../lib/logger";
import type { JellyfinClient } from "../api/jellyfin.types";
import { mapNetworkingConfigToSchema } from "../mappers/networking";
import { type NetworkingConfig } from "../types/config/networking";
import { type NetworkConfigurationSchema } from "../types/schema/networking";
import { deepEqual } from "fast-equals";
import { overlaySupported } from "../lib/objects";

export function calculateNetworkingDiff(
  current: NetworkConfigurationSchema,
  desired: NetworkingConfig,
): NetworkConfigurationSchema | undefined {
  const next: Partial<NetworkConfigurationSchema> =
    mapNetworkingConfigToSchema(desired);

  const updated: NetworkConfigurationSchema = overlaySupported(
    "NetworkConfiguration",
    current,
    next,
    "networking",
  ) as NetworkConfigurationSchema;

  if (deepEqual(updated, current)) return undefined;

  logger.info(JSON.stringify(next));
  return updated;
}

export async function applyNetworking(
  client: JellyfinClient,
  updatedSchema: NetworkConfigurationSchema | undefined,
): Promise<void> {
  if (!updatedSchema) return;

  await client.updateNetworkingConfiguration(updatedSchema);
}

/**
 * Fields Jellyfin reads once at startup (Kestrel bind addresses and ports,
 * Startup.Configure's BaseUrl map and HTTPS redirection, the certificate load,
 * the forwarded-headers proxy list), so a change only takes effect after a
 * restart. Every other field is applied live by NetworkManager.UpdateSettings.
 * Sources, jellyfin release-10.11.z and master:
 * Jellyfin.Server/Extensions/WebHostBuilderExtensions.cs (SetupJellyfinWebServer),
 * Jellyfin.Server/Startup.cs (Configure),
 * Emby.Server.Implementations/ApplicationHost.cs (ports, certificate),
 * Jellyfin.Server/Extensions/ApiServiceCollectionExtensions.cs (KnownProxies),
 * src/Jellyfin.Networking/Manager/NetworkManager.cs (GetAllBindInterfaces).
 */
const RESTART_FIELDS: ReadonlyArray<
  readonly [string, keyof NetworkConfigurationSchema]
> = [
  ["baseUrl", "BaseUrl"],
  ["enableHttps", "EnableHttps"],
  ["requireHttps", "RequireHttps"],
  ["certificatePath", "CertificatePath"],
  ["certificatePassword", "CertificatePassword"],
  ["internalHttpPort", "InternalHttpPort"],
  ["internalHttpsPort", "InternalHttpsPort"],
  ["enableIPv4", "EnableIPv4"],
  ["enableIPv6", "EnableIPv6"],
  ["localNetworkAddresses", "LocalNetworkAddresses"],
  ["ignoreVirtualInterfaces", "IgnoreVirtualInterfaces"],
  ["virtualInterfaceNames", "VirtualInterfaceNames"],
  ["knownProxies", "KnownProxies"],
];

export function calculateNetworkRestartFields(
  current: NetworkConfigurationSchema,
  updated: NetworkConfigurationSchema,
): string[] {
  return RESTART_FIELDS.filter(
    ([, key]: readonly [string, keyof NetworkConfigurationSchema]) =>
      !deepEqual(current[key], updated[key]),
  ).map(([name]: readonly [string, string]) => name);
}

/**
 * Where to wait after the restart: the address the server will answer on once
 * the new BaseUrl and ports apply. A base_url that does not carry the old
 * port or path is left alone, since the user's address may be a proxy.
 */
export function networkRestartTarget(
  baseUrl: string,
  current: NetworkConfigurationSchema,
  updated: NetworkConfigurationSchema,
): string {
  const url: URL = new URL(baseUrl);
  const swap: (from: number | undefined, to: number | undefined) => void = (
    from: number | undefined,
    to: number | undefined,
  ): void => {
    if (from !== to && to !== undefined && url.port === String(from)) {
      url.port = String(to);
    }
  };
  swap(current.InternalHttpPort, updated.InternalHttpPort);
  swap(current.InternalHttpsPort, updated.InternalHttpsPort);
  const oldPath: string = (current.BaseUrl ?? "").replace(/\/+$/, "");
  const newPath: string = (updated.BaseUrl ?? "").replace(/\/+$/, "");
  if (oldPath !== newPath) {
    const path: string = url.pathname.replace(/\/+$/, "");
    const root: string = path.endsWith(oldPath)
      ? path.slice(0, path.length - oldPath.length)
      : path;
    url.pathname = `${root}${newPath}`;
  }
  return url.toString().replace(/\/+$/, "");
}
