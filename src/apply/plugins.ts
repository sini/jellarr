import { logger } from "../lib/logger";
import { say } from "../lib/mode";
import type { JellyfinClient } from "../api/jellyfin.types";
import type {
  PluginConfig,
  PluginConfigList,
  PluginConfigurationConfig,
} from "../types/config/plugins";
import type {
  PluginInfoSchema,
  PackageInfoSchema,
  VersionInfoSchema,
  BasePluginConfigurationSchema,
  PluginConfigurationSchema,
} from "../types/schema/plugins";
import { waitForRestart } from "../lib/health";
import { deepEqual } from "fast-equals";

function isPluginConfigurationMissingError(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "response" in error) {
    const responseStatus: number | undefined = (
      error as {
        response?: { status?: number };
      }
    ).response?.status;
    if (responseStatus === 404) return true;
  }

  return error instanceof Error && /failed:\s*404$/.test(error.message);
}

export interface PluginInstall {
  name: string;
  guid: string;
  version: string;
  repositoryUrl?: string;
  installedVersion?: string;
}

function normalizeGuid(guid: string): string {
  return guid.replace(/-/g, "").toLowerCase();
}

/**
 * Compares dotted numeric versions, treating missing components as zero so
 * that a manifest's "5.1.1" and an installed assembly's "5.1.1.0" are equal.
 */
export function compareVersions(a: string, b: string): number {
  const left: number[] = a.split(".").map(Number);
  const right: number[] = b.split(".").map(Number);
  const length: number = Math.max(left.length, right.length);
  for (let i: number = 0; i < length; i++) {
    const difference: number = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

/**
 * Jellyfin only loads a plugin whose target ABI is no newer than the server,
 * so versions built for a later server are never candidates.
 */
function isCompatible(
  version: VersionInfoSchema,
  serverVersion: string,
): boolean {
  return (
    !version.targetAbi || compareVersions(version.targetAbi, serverVersion) <= 0
  );
}

function findPackage(
  catalog: PackageInfoSchema[],
  desired: PluginConfig,
): PackageInfoSchema | undefined {
  return catalog.find((pkg: PackageInfoSchema) => pkg.name === desired.name);
}

/**
 * Finds the installed copies of a desired plugin. Jellyfin reports a plugin
 * under its assembly name, which often differs from its catalog name (the
 * catalog's "SSO Authentication" installs as "SSO-Auth"), so the catalog GUID
 * is matched first and the name only when the plugin isn't in any repository.
 */
function findInstalled(
  installed: PluginInfoSchema[],
  pkg: PackageInfoSchema | undefined,
  desired: PluginConfig,
): PluginInfoSchema[] {
  const guid: string | undefined = pkg?.guid;
  if (guid) {
    return installed.filter(
      (plugin: PluginInfoSchema) =>
        plugin.Id !== undefined &&
        normalizeGuid(plugin.Id) === normalizeGuid(guid),
    );
  }
  return installed.filter(
    (plugin: PluginInfoSchema) => plugin.Name === desired.name,
  );
}

function newestVersion(plugins: PluginInfoSchema[]): string | undefined {
  return plugins
    .map((plugin: PluginInfoSchema) => plugin.Version)
    .filter((version: string | undefined): version is string => !!version)
    .sort(compareVersions)
    .at(-1);
}

function chooseVersion(
  pkg: PackageInfoSchema,
  desired: PluginConfig,
  serverVersion: string,
): VersionInfoSchema | undefined {
  const versions: VersionInfoSchema[] = (pkg.versions ?? []).filter(
    (version: VersionInfoSchema) => isCompatible(version, serverVersion),
  );

  if (desired.version) {
    const pinned: string = desired.version;
    const match: VersionInfoSchema | undefined = versions.find(
      (version: VersionInfoSchema) =>
        version.version !== undefined &&
        compareVersions(version.version, pinned) === 0,
    );
    if (!match) {
      throw new Error(
        `Plugin "${desired.name}" has no version ${pinned} compatible with Jellyfin ${serverVersion}`,
      );
    }
    return match;
  }

  return versions
    .filter((version: VersionInfoSchema) => version.version !== undefined)
    .sort((a: VersionInfoSchema, b: VersionInfoSchema) =>
      compareVersions(a.version as string, b.version as string),
    )
    .at(-1);
}

/**
 * Works out which plugins to install or upgrade: missing plugins, and plugins
 * whose repositories offer a newer compatible version. A pinned version is
 * installed exactly and holds the plugin there.
 */
export function calculatePluginInstalls(
  installed: PluginInfoSchema[],
  catalog: PackageInfoSchema[],
  desired: PluginConfigList,
  serverVersion: string,
): PluginInstall[] | undefined {
  const installs: PluginInstall[] = [];

  for (const plugin of desired) {
    const pkg: PackageInfoSchema | undefined = findPackage(catalog, plugin);
    const installedVersion: string | undefined = newestVersion(
      findInstalled(installed, pkg, plugin),
    );

    if (!pkg?.guid) {
      if (installedVersion) {
        logger.warn(
          `Plugin "${plugin.name}" is not in any configured repository; leaving ${installedVersion} as is`,
        );
        continue;
      }
      throw new Error(
        `Plugin "${plugin.name}" is not in any configured repository`,
      );
    }

    const target: VersionInfoSchema | undefined = chooseVersion(
      pkg,
      plugin,
      serverVersion,
    );
    if (!target?.version) {
      if (installedVersion) {
        logger.warn(
          `Plugin "${plugin.name}" has no version compatible with Jellyfin ${serverVersion}; leaving ${installedVersion} as is`,
        );
        continue;
      }
      throw new Error(
        `Plugin "${plugin.name}" has no version compatible with Jellyfin ${serverVersion}`,
      );
    }

    if (installedVersion !== undefined) {
      const comparison: number = compareVersions(
        target.version,
        installedVersion,
      );
      if (comparison === 0) continue;
      if (comparison < 0) {
        if (plugin.version) {
          logger.warn(
            `Plugin "${plugin.name}" is pinned to ${plugin.version} but ${installedVersion} is installed; uninstall it to downgrade`,
          );
        }
        continue;
      }
    }

    logger.info(
      installedVersion
        ? say(
            `Upgrading plugin ${plugin.name}: ${installedVersion} -> ${target.version}`,
            `Would upgrade plugin ${plugin.name}: ${installedVersion} -> ${target.version}`,
          )
        : say(
            `Installing plugin: ${plugin.name} ${target.version}`,
            `Would install plugin: ${plugin.name} ${target.version}`,
          ),
    );
    installs.push({
      name: plugin.name,
      guid: pkg.guid,
      version: target.version,
      ...(target.repositoryUrl ? { repositoryUrl: target.repositoryUrl } : {}),
      ...(installedVersion ? { installedVersion } : {}),
    });
  }

  return installs.length > 0 ? installs : undefined;
}

/**
 * Finds declared plugins that are on disk but not loaded: an installed copy
 * whose Status is Restart (an interrupted install or upgrade), or a plugin
 * with no copy that is Active, Disabled, Malfunctioned or NotSupported (those
 * would not be fixed by another restart). Returns what to wait for after one
 * restart.
 */
export function calculatePendingPluginRestarts(
  installed: PluginInfoSchema[],
  catalog: PackageInfoSchema[],
  desired: PluginConfigList,
): PluginInstall[] | undefined {
  const pending: PluginInstall[] = [];

  for (const plugin of desired) {
    const copies: PluginInfoSchema[] = findInstalled(
      installed,
      findPackage(catalog, plugin),
      plugin,
    );
    const awaiting: PluginInfoSchema[] = copies.filter(
      (copy: PluginInfoSchema) => copy.Status === "Restart",
    );
    const settled: boolean = copies.some((copy: PluginInfoSchema) =>
      ["Active", "Disabled", "Malfunctioned", "NotSupported"].includes(
        copy.Status ?? "",
      ),
    );
    const candidates: PluginInfoSchema[] =
      awaiting.length > 0 ? awaiting : settled ? [] : copies;
    const newest: PluginInfoSchema | undefined = candidates
      .filter((copy: PluginInfoSchema) => copy.Id && copy.Version)
      .sort((a: PluginInfoSchema, b: PluginInfoSchema) =>
        compareVersions(a.Version as string, b.Version as string),
      )
      .at(-1);
    if (!newest) continue;

    logger.info(
      `Plugin ${plugin.name} ${newest.Version as string} is installed but not loaded; a restart is needed`,
    );
    pending.push({
      name: plugin.name,
      guid: newest.Id as string,
      version: newest.Version as string,
    });
  }

  return pending.length > 0 ? pending : undefined;
}

export async function installPlugins(
  client: JellyfinClient,
  installs: PluginInstall[] | undefined,
): Promise<void> {
  if (!installs) return;

  for (const install of installs) {
    await client.installPackage(install.name, {
      assemblyGuid: install.guid,
      version: install.version,
      ...(install.repositoryUrl
        ? { repositoryUrl: install.repositoryUrl }
        : {}),
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve: () => void) => setTimeout(resolve, ms));
}

/**
 * Restarts Jellyfin so it loads or unloads plugin assemblies, and waits
 * until /health answers again.
 */
export async function restartJellyfin(
  client: JellyfinClient,
  baseUrl: string,
  timeoutMs: number,
): Promise<void> {
  await client.restartServer();
  await waitForRestart(baseUrl, { timeoutMs });
}

/**
 * After a restart, waits until every plugin that was just installed has an
 * Active copy at the installed version. Adapted from Jampard's
 * waitForActivePlugins; the wait is bounded by the same timeout as /health.
 */
export async function waitForInstalledPluginsActive(
  client: JellyfinClient,
  installs: PluginInstall[],
  timeoutMs: number,
  intervalMs: number = 2000,
): Promise<PluginInfoSchema[]> {
  const deadline: number = Date.now() + timeoutMs;
  let lastError: unknown;
  for (;;) {
    try {
      const installed: PluginInfoSchema[] = await client.getPlugins();
      const pending: PluginInstall[] = installs.filter(
        (install: PluginInstall) =>
          !installed.some(
            (plugin: PluginInfoSchema) =>
              plugin.Id !== undefined &&
              normalizeGuid(plugin.Id) === normalizeGuid(install.guid) &&
              plugin.Status === "Active" &&
              plugin.Version !== undefined &&
              compareVersions(plugin.Version, install.version) === 0,
          ),
      );
      if (pending.length === 0) return installed;
      lastError = new Error(
        `not active: ${pending.map((install: PluginInstall) => install.name).join(", ")}`,
      );
    } catch (error) {
      lastError = error;
    }
    if (Date.now() >= deadline) break;
    await sleep(intervalMs);
  }
  throw new Error(
    `Plugins did not become active after the restart within ${(timeoutMs / 1000).toString()}s (${lastError instanceof Error ? lastError.message : String(lastError)})`,
  );
}

export interface PluginRemoval {
  name: string;
  id: string;
  version: string;
}

/**
 * Finds old copies of desired plugins left behind by an upgrade. Jellyfin
 * marks them Superseded but still loads their assemblies, so an old copy's
 * API controllers clash with the new one's. Only copies Jellyfin itself
 * reports as Superseded are removed, and only once a newer copy of the same
 * plugin is Active, so a pending upgrade never loses the running version and
 * a disabled, malfunctioning or not-yet-restarted older copy is left alone.
 */
export function calculatePluginRemovals(
  installed: PluginInfoSchema[],
  catalog: PackageInfoSchema[],
  desired: PluginConfigList,
): PluginRemoval[] | undefined {
  const removals: PluginRemoval[] = [];

  for (const plugin of desired) {
    const copies: PluginInfoSchema[] = findInstalled(
      installed,
      findPackage(catalog, plugin),
      plugin,
    );
    const newestActive: string | undefined = newestVersion(
      copies.filter((copy: PluginInfoSchema) => copy.Status === "Active"),
    );
    if (!newestActive) continue;

    for (const copy of copies) {
      if (!copy.Id || !copy.Version) continue;
      if (compareVersions(copy.Version, newestActive) === 0) continue;
      const superseded: boolean =
        copy.Status === "Superseded" || copy.Status === "Superceded";
      if (!superseded || compareVersions(copy.Version, newestActive) > 0) {
        continue;
      }
      if (
        removals.some(
          (removal: PluginRemoval) =>
            removal.id === copy.Id && removal.version === copy.Version,
        )
      ) {
        continue;
      }

      logger.info(
        say(
          `Removing plugin ${plugin.name} ${copy.Version}, superseded by ${newestActive}`,
          `Would remove plugin ${plugin.name} ${copy.Version}, superseded by ${newestActive}`,
        ),
      );
      removals.push({ name: plugin.name, id: copy.Id, version: copy.Version });
    }
  }

  return removals.length > 0 ? removals : undefined;
}

export async function removePlugins(
  client: JellyfinClient,
  removals: PluginRemoval[] | undefined,
): Promise<void> {
  if (!removals) return;

  for (const removal of removals) {
    await client.uninstallPlugin(removal.id, removal.version);
  }
}

/**
 * Renames desired plugins to the names Jellyfin reports for their installed
 * copies, so their configuration can be matched against installed plugins.
 */
export function resolveInstalledPluginNames(
  installed: PluginInfoSchema[],
  catalog: PackageInfoSchema[],
  desired: PluginConfigList,
): PluginConfigList {
  return desired.map((plugin: PluginConfig) => {
    const name: string | undefined = findInstalled(
      installed,
      findPackage(catalog, plugin),
      plugin,
    )[0]?.Name;
    return name ? { ...plugin, name } : plugin;
  });
}

/**
 * Fetches each installed plugin's configuration. A plugin with no readable
 * configuration (404) is skipped, unless `desired` declares a configuration
 * for it; then, like a declared plugin that is not installed at all, it is an
 * error rather than a silent no-op.
 */
export async function getPluginConfigurationSchemaByName(
  client: JellyfinClient,
  current: PluginInfoSchema[],
  desired: PluginConfigList = [],
): Promise<Map<string, PluginConfigurationSchema>> {
  const required: Set<string> = new Set(
    desired
      .filter((plugin: PluginConfig) => plugin.configuration !== undefined)
      .map((plugin: PluginConfig) => plugin.name),
  );
  const pluginConfigurationSchemaByName: Map<
    string,
    PluginConfigurationSchema
  > = new Map();

  for (const pluginInfo of current) {
    if (pluginInfo.Id && pluginInfo.Name) {
      try {
        pluginConfigurationSchemaByName.set(pluginInfo.Name, {
          id: pluginInfo.Id,
          configuration: await client.getPluginConfiguration(pluginInfo.Id),
        });
      } catch (error) {
        if (!isPluginConfigurationMissingError(error)) throw error;
        if (required.has(pluginInfo.Name)) {
          throw new Error(
            `Plugin "${pluginInfo.Name}" declares a configuration but it cannot be read (404): is the plugin enabled and loaded?`,
          );
        }
      }
    }
  }

  for (const name of required) {
    if (!pluginConfigurationSchemaByName.has(name)) {
      throw new Error(
        `Plugin "${name}" declares a configuration but is not installed and loaded`,
      );
    }
  }

  return pluginConfigurationSchemaByName;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * ${VAR} always yields strings, so a desired string is read as the type of
 * the current number or boolean when it parses exactly ("8096", "true").
 */
function coerce(current: unknown, desired: unknown): unknown {
  if (typeof desired !== "string") return desired;
  if (typeof current === "number") {
    const parsed: number = Number(desired);
    return desired.trim() !== "" && String(parsed) === desired
      ? parsed
      : desired;
  }
  if (typeof current === "boolean") {
    return desired === "true" ? true : desired === "false" ? false : desired;
  }
  return desired;
}

/**
 * Whether current already satisfies desired. Objects are compared as a
 * subset (fields desired omits, such as ones the server adds, are ignored);
 * arrays match when the lengths are equal and each declared element is
 * satisfied by the element at the same index. A desired null equals an
 * absent value.
 */
function satisfies(current: unknown, desired: unknown): boolean {
  if (Array.isArray(desired)) {
    return (
      Array.isArray(current) &&
      current.length === desired.length &&
      desired.every((item: unknown, index: number) =>
        satisfies(current[index], item),
      )
    );
  }
  if (isRecord(desired)) {
    return (
      isRecord(current) &&
      Object.entries(desired).every(
        ([key, value]: [string, unknown]) =>
          value === undefined || satisfies(current[key], value),
      )
    );
  }
  if (desired === null && current === undefined) return true;
  return deepEqual(current, coerce(current, desired));
}

/**
 * The value to write for desired over current. Objects merge key by key;
 * an array becomes the declared elements in the declared order, each object
 * element carrying the server fields of the first unused current element it
 * satisfies, so a reorder or an edit elsewhere never erases them.
 */
function mergeDeclared(current: unknown, desired: unknown): unknown {
  if (Array.isArray(desired)) {
    const source: unknown[] = Array.isArray(current) ? current : [];
    const used: Set<number> = new Set();
    return desired.map((item: unknown) => {
      if (!isRecord(item)) return item;
      const index: number = source.findIndex(
        (candidate: unknown, i: number) =>
          !used.has(i) && satisfies(candidate, item),
      );
      if (index < 0) return item;
      used.add(index);
      return mergeDeclared(source[index], item);
    });
  }
  if (isRecord(desired) && isRecord(current)) {
    const merged: Record<string, unknown> = { ...current };
    for (const [key, value] of Object.entries(desired)) {
      if (value !== undefined) merged[key] = mergeDeclared(current[key], value);
    }
    return merged;
  }
  return coerce(current, desired);
}

export function calculatePluginConfigurationDiff(
  current: BasePluginConfigurationSchema,
  desired: PluginConfigurationConfig,
): BasePluginConfigurationSchema | undefined {
  if (satisfies(current, desired)) return undefined;
  return mergeDeclared(current, desired) as BasePluginConfigurationSchema;
}

export function calculatePluginConfigurationsDiff(
  currentPluginConfigurationsByName: Map<string, PluginConfigurationSchema>,
  desired: PluginConfigList,
): Map<string, BasePluginConfigurationSchema> | undefined {
  if (desired.length === 0) return undefined;

  const pluginConfigurationsToUpdate: Map<
    string,
    BasePluginConfigurationSchema
  > = new Map();

  desired.forEach((desiredPluginConfiguration: PluginConfig) => {
    if (desiredPluginConfiguration.configuration) {
      const currentPluginConfiguration: PluginConfigurationSchema | undefined =
        currentPluginConfigurationsByName.get(desiredPluginConfiguration.name);

      if (currentPluginConfiguration) {
        const configurationDiff: BasePluginConfigurationSchema | undefined =
          calculatePluginConfigurationDiff(
            currentPluginConfiguration.configuration,
            desiredPluginConfiguration.configuration,
          );

        if (configurationDiff) {
          logger.info(
            say(
              `Updating plugin configuration: ${desiredPluginConfiguration.name}`,
              `Would update plugin configuration: ${desiredPluginConfiguration.name}`,
            ),
          );
          pluginConfigurationsToUpdate.set(
            currentPluginConfiguration.id,
            configurationDiff,
          );
        }
      }
    }
  });

  return pluginConfigurationsToUpdate.size > 0
    ? pluginConfigurationsToUpdate
    : undefined;
}

export async function applyPluginConfigurations(
  client: JellyfinClient,
  configurations: Map<string, BasePluginConfigurationSchema> | undefined,
): Promise<void> {
  if (!configurations) return;

  for (const [pluginId, config] of configurations) {
    await client.updatePluginConfiguration(pluginId, config);
  }
}
