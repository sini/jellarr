import { promises as fs } from "fs";
import YAML from "yaml";
import { calculateSystemDiff, applySystem } from "../apply/system";
import {
  calculateEncodingDiff,
  applyEncoding,
} from "../apply/encoding-options";
import {
  calculateLibraryDiff,
  applyLibrary,
  type LibraryDiff,
} from "../apply/library";
import {
  calculateBrandingOptionsDiff,
  applyBrandingOptions,
} from "../apply/branding-options";
import {
  calculateSplashscreenUpload,
  applySplashscreen,
} from "../apply/splashscreen";
import { calculateNetworkingDiff, applyNetworking } from "../apply/networking";
import {
  calculateNewUsersDiff,
  calculateUserPoliciesDiff,
  applyUserPolicies,
  createNewUsers,
  calculateUserConfigurationsDiff,
  applyUserConfigurations,
  reconcileUserPasswords,
} from "../apply/users";
import type { VirtualFolderInfoSchema } from "../types/schema/library";
import { type ServerConfigurationSchema } from "../types/schema/system";
import { type EncodingOptionsSchema } from "../types/schema/encoding-options";
import { type BrandingOptionsDtoSchema } from "../types/schema/branding-options";
import { type NetworkConfigurationSchema } from "../types/schema/networking";
import type {
  UserConfigurationSchema,
  UserDtoSchema,
  UserPolicySchema,
} from "../types/schema/users";
import type { UserConfig } from "../types/config/users";
import { createJellyfinClient } from "../api/jellyfin_client";
import { type JellyfinClient } from "../api/jellyfin.types";
import { RootConfigType, type RootConfig } from "../types/config/root";
import { type ZodSafeParseResult, type z } from "zod";
import {
  type PluginInfoSchema,
  type PackageInfoSchema,
  type BasePluginConfigurationSchema,
} from "../types/schema/plugins";
import {
  calculatePluginInstalls,
  installPlugins,
  calculatePluginRemovals,
  removePlugins,
  resolveInstalledPluginNames,
  calculatePluginConfigurationsDiff,
  applyPluginConfigurations,
  getPluginConfigurationSchemaByName,
  restartJellyfin,
  calculatePendingPluginRestarts,
  waitForInstalledPluginsActive,
  type PluginInstall,
  type PluginRemoval,
} from "../apply/plugins";
import type { PluginConfigList } from "../types/config/plugins";
import { calculateApiKeysToCreate, createApiKeys } from "../apply/api-keys";
import type { AuthenticationInfoSchema } from "../types/schema/api-keys";
import type { ApiKeyConfig } from "../types/config/api-keys";
import { calculateMetadataDiff, applyMetadata } from "../apply/metadata";
import type { MetadataConfigurationSchema } from "../types/schema/metadata";
import {
  authenticateAsAdmin,
  isUnauthorized,
  type AdminCredentials,
} from "../apply/auth";
import { applyStartupWizard } from "../apply/startup";
import { Plan } from "../lib/plan";
import { maskSecrets } from "../lib/logger";
import { setDryRun } from "../lib/mode";
import { guardReadOnly } from "../api/read-only";
import type { PublicSystemInfoSchema } from "../types/schema/startup";
import type { PluginConfig } from "../types/config/plugins";
import type { PluginConfigurationSchema } from "../types/schema/plugins";
import { resolveValue } from "../lib/file-refs";
import { resolveApiKey } from "../lib/api-key";
import { waitForHealth, resolveWaitTimeoutMs } from "../lib/health";

export interface PipelineOptions {
  waitTimeoutSeconds?: number;
  dryRun?: boolean;
}

export interface PipelineResult {
  dryRun: boolean;
  /** Dry run only: whether any change is pending. */
  pending: boolean;
}

function wantsDryRun(flag: boolean | undefined): boolean {
  return flag ?? /^(1|true)$/i.test(process.env.JELLARR_DRY_RUN ?? "");
}

export async function runPipeline(
  path: string,
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  const raw: string = await fs.readFile(path, "utf8");
  const dryRun: boolean = wantsDryRun(options.dryRun);
  const secrets: Set<string> = new Set();
  const plan: Plan | undefined = dryRun ? new Plan(secrets) : undefined;
  maskSecrets(secrets);
  setDryRun(dryRun);
  let passwordsUnverified: boolean = false;

  const validationResult: ZodSafeParseResult<RootConfig> =
    RootConfigType.safeParse(await resolveValue(YAML.parse(raw), secrets));
  if (!validationResult.success) {
    const errorMessages: string = validationResult.error.issues
      .map((err: z.core.$ZodIssue) => `${err.path.join(".")}: ${err.message}`)
      .join("\n");
    throw new Error(`Configuration validation failed:\n${errorMessages}`);
  }

  const cfg: RootConfig = validationResult.data;

  const apiKey: string | undefined = resolveApiKey();

  if (dryRun && !apiKey) {
    throw new Error(
      "--dry-run requires JELLARR_API_KEY: a dry run never signs in",
    );
  }

  const liveClient: JellyfinClient = createJellyfinClient(cfg.base_url, apiKey);
  const jellyfinClient: JellyfinClient = dryRun
    ? guardReadOnly(liveClient)
    : liveClient;
  if (dryRun) console.log("DRY RUN: nothing will be changed");

  const waitTimeoutMs: number = resolveWaitTimeoutMs(
    options.waitTimeoutSeconds,
  );
  console.log("→ waiting for Jellyfin to become healthy");
  await waitForHealth(cfg.base_url, { timeoutMs: waitTimeoutMs });
  console.log("✓ Jellyfin is healthy");

  if (plan && cfg.startup) {
    const info: PublicSystemInfoSchema =
      await jellyfinClient.getPublicSystemInfo();
    if (info.StartupWizardCompleted === false) {
      plan.action("startup: the first-boot wizard would run");
    }
  }
  const wizardRan: boolean =
    cfg.startup && !dryRun
      ? await applyStartupWizard(jellyfinClient, cfg.startup)
      : false;

  let verifiedAdmin: AdminCredentials | undefined;
  if (wizardRan || !apiKey) {
    verifiedAdmin = await authenticateAsAdmin(
      jellyfinClient,
      cfg,
      wizardRan
        ? "The server was just set up by the startup wizard"
        : "JELLARR_API_KEY is not set",
    );
  }

  let currentServerConfigurationSchema: ServerConfigurationSchema;
  try {
    currentServerConfigurationSchema =
      await jellyfinClient.getSystemConfiguration();
  } catch (error) {
    if (verifiedAdmin || !isUnauthorized(error)) throw error;
    if (dryRun) {
      throw new Error(
        "JELLARR_API_KEY was rejected (401); a dry run never signs in",
      );
    }
    verifiedAdmin = await authenticateAsAdmin(
      jellyfinClient,
      cfg,
      "JELLARR_API_KEY was rejected (401)",
    );
    currentServerConfigurationSchema =
      await jellyfinClient.getSystemConfiguration();
  }
  let currentVirtualFolders: VirtualFolderInfoSchema[] | undefined;

  const updatedServerConfigurationSchema:
    ServerConfigurationSchema | undefined = calculateSystemDiff(
    currentServerConfigurationSchema,
    cfg.system,
  );

  if (updatedServerConfigurationSchema && plan) {
    plan.change(
      "system",
      currentServerConfigurationSchema,
      updatedServerConfigurationSchema,
    );
  } else if (updatedServerConfigurationSchema) {
    console.log("→ updating system config");
    await applySystem(jellyfinClient, updatedServerConfigurationSchema);
    console.log("✓ updated system config");
  } else {
    console.log("✓ system config already up to date");
  }

  if (cfg.metadata) {
    const currentMetadataConfigurationSchema: MetadataConfigurationSchema =
      await jellyfinClient.getMetadataConfiguration();

    const updatedMetadataConfigurationSchema:
      MetadataConfigurationSchema | undefined = calculateMetadataDiff(
      currentMetadataConfigurationSchema,
      cfg.metadata,
    );

    if (updatedMetadataConfigurationSchema && plan) {
      plan.change(
        "metadata",
        currentMetadataConfigurationSchema,
        updatedMetadataConfigurationSchema,
      );
    } else if (updatedMetadataConfigurationSchema) {
      console.log("→ updating metadata config");
      await applyMetadata(jellyfinClient, updatedMetadataConfigurationSchema);
      console.log("✓ updated metadata config");
    } else {
      console.log("✓ metadata config already up to date");
    }
  }

  if (cfg.encoding) {
    const currentEncodingOptionsSchema: EncodingOptionsSchema =
      await jellyfinClient.getEncodingConfiguration();

    const updatedEncodingOptionsSchema: EncodingOptionsSchema | undefined =
      calculateEncodingDiff(currentEncodingOptionsSchema, cfg.encoding);

    if (updatedEncodingOptionsSchema && plan) {
      plan.change(
        "encoding",
        currentEncodingOptionsSchema,
        updatedEncodingOptionsSchema,
      );
    } else if (updatedEncodingOptionsSchema) {
      console.log("→ updating encoding config");
      await applyEncoding(jellyfinClient, updatedEncodingOptionsSchema);
      console.log("✓ updated encoding config");
    } else {
      console.log("✓ encoding config already up to date");
    }
  }

  if (cfg.library?.virtualFolders) {
    currentVirtualFolders = await jellyfinClient.getVirtualFolders();
    const libraryDiff: LibraryDiff | undefined = calculateLibraryDiff(
      currentVirtualFolders,
      cfg.library.virtualFolders,
    );

    if (libraryDiff && plan) {
      for (const folder of libraryDiff.toCreate ?? []) {
        plan.action(`library ${folder.Name ?? "?"}: would be created`);
      }
      for (const update of libraryDiff.toUpdate ?? []) {
        plan.change(
          `library ${update.name}`,
          currentVirtualFolders.find(
            (folder: VirtualFolderInfoSchema) => folder.Name === update.name,
          )?.LibraryOptions,
          update.libraryOptions,
        );
      }
    } else if (libraryDiff) {
      console.log("→ updating library config");
      await applyLibrary(jellyfinClient, libraryDiff);
      console.log("✓ updated library config");
      currentVirtualFolders = await jellyfinClient.getVirtualFolders();
    } else {
      console.log("✓ library config already up to date");
    }
  }

  if (cfg.branding) {
    const currentBrandingSchema: BrandingOptionsDtoSchema =
      await jellyfinClient.getBrandingConfiguration();

    const updatedBrandingSchema: BrandingOptionsDtoSchema | undefined =
      calculateBrandingOptionsDiff(currentBrandingSchema, cfg.branding);

    if (updatedBrandingSchema && plan) {
      plan.change("branding", currentBrandingSchema, updatedBrandingSchema);
    } else if (updatedBrandingSchema) {
      console.log("→ updating branding config");
      await applyBrandingOptions(jellyfinClient, updatedBrandingSchema);
      console.log("✓ updated branding config");
    } else {
      console.log("✓ branding config already up to date");
    }

    if (cfg.branding.splashscreenFile) {
      const splashscreen: Uint8Array | undefined =
        await calculateSplashscreenUpload(
          jellyfinClient,
          cfg.branding.splashscreenFile,
        );
      if (splashscreen && plan) {
        plan.action(
          `branding splashscreen: ${cfg.branding.splashscreenFile} would be uploaded`,
        );
      } else if (splashscreen) {
        console.log("→ uploading splashscreen");
        await applySplashscreen(jellyfinClient, splashscreen);
        console.log("✓ uploaded splashscreen");
      } else {
        console.log("✓ splashscreen already up to date");
      }
    }
  }

  if (cfg.networking) {
    const currentNetworkingSchema: NetworkConfigurationSchema =
      await jellyfinClient.getNetworkingConfiguration();

    const updatedNetworkingSchema: NetworkConfigurationSchema | undefined =
      calculateNetworkingDiff(currentNetworkingSchema, cfg.networking);

    if (updatedNetworkingSchema && plan) {
      plan.change(
        "networking",
        currentNetworkingSchema,
        updatedNetworkingSchema,
      );
    } else if (updatedNetworkingSchema) {
      console.log("→ updating networking config");
      await applyNetworking(jellyfinClient, updatedNetworkingSchema);
      console.log("✓ updated networking config");
    } else {
      console.log("✓ networking config already up to date");
    }
  }

  if (cfg.users) {
    if (
      !currentVirtualFolders &&
      cfg.users.some(
        (userConfig: UserConfig) =>
          typeof userConfig.policy?.enabledLibraries !== "undefined" ||
          typeof userConfig.orderedLibraries !== "undefined",
      )
    ) {
      currentVirtualFolders = await jellyfinClient.getVirtualFolders();
    }

    let currentUsers: UserDtoSchema[] = await jellyfinClient.getUsers();
    const existingUsers: UserDtoSchema[] = currentUsers;

    const usersToCreate: UserConfig[] | undefined = calculateNewUsersDiff(
      currentUsers,
      cfg.users,
    );

    if (usersToCreate && plan) {
      for (const user of usersToCreate) {
        plan.action(`user ${user.name}: would be created`);
      }
    } else if (usersToCreate) {
      console.log("→ creating users");
      await createNewUsers(jellyfinClient, usersToCreate);
      console.log("✓ created users");
      currentUsers = await jellyfinClient.getUsers();
    }

    if (plan) {
      for (const user of existingUsers) {
        if (cfg.users.some((wanted: UserConfig) => wanted.name === user.Name)) {
          passwordsUnverified = true;
          plan.note(
            `user ${user.Name ?? "?"}: password not verified (dry run)`,
          );
        }
      }
    } else {
      await reconcileUserPasswords(
        jellyfinClient,
        existingUsers,
        cfg.users,
        new Set([
          ...(usersToCreate ?? []).map((user: UserConfig) => user.name),
          ...(verifiedAdmin ? [verifiedAdmin.name] : []),
        ]),
      );
    }

    const userPoliciesToUpdate: Map<string, UserPolicySchema> | undefined =
      calculateUserPoliciesDiff(currentUsers, cfg.users, currentVirtualFolders);
    const userConfigurationsToUpdate:
      Map<string, UserConfigurationSchema> | undefined =
      calculateUserConfigurationsDiff(
        currentUsers,
        cfg.users,
        currentVirtualFolders,
      );

    const userById: (id: string) => UserDtoSchema | undefined = (
      id: string,
    ): UserDtoSchema | undefined =>
      currentUsers.find((user: UserDtoSchema) => user.Id === id);

    if (userPoliciesToUpdate && plan) {
      for (const [id, policy] of userPoliciesToUpdate) {
        const user: UserDtoSchema | undefined = userById(id);
        plan.change(`user ${user?.Name ?? id}.policy`, user?.Policy, policy);
      }
    } else if (userPoliciesToUpdate) {
      console.log("→ updating user policies");
      await applyUserPolicies(jellyfinClient, userPoliciesToUpdate);
      console.log("✓ updated user policies");
    } else {
      console.log("✓ user policies already up to date");
    }

    if (userConfigurationsToUpdate && plan) {
      for (const [id, configuration] of userConfigurationsToUpdate) {
        const user: UserDtoSchema | undefined = userById(id);
        plan.change(
          `user ${user?.Name ?? id}.configuration`,
          user?.Configuration,
          configuration,
        );
      }
    } else if (userConfigurationsToUpdate) {
      console.log("→ updating user configurations");
      await applyUserConfigurations(jellyfinClient, userConfigurationsToUpdate);
      console.log("✓ updated user configurations");
    } else {
      console.log("✓ user configurations already up to date");
    }
  }

  if (cfg.plugins) {
    let installedPlugins: PluginInfoSchema[] =
      await jellyfinClient.getPlugins();
    const catalog: PackageInfoSchema[] = await jellyfinClient.getPackages();

    const pluginInstalls: PluginInstall[] | undefined = calculatePluginInstalls(
      installedPlugins,
      catalog,
      cfg.plugins,
      await jellyfinClient.getServerVersion(),
    );

    if (pluginInstalls && plan) {
      for (const install of pluginInstalls) {
        plan.action(
          `plugin ${install.name}: ${install.installedVersion ? `upgrade ${install.installedVersion} →` : "install"} ${install.version}`,
        );
      }
    } else if (pluginInstalls) {
      console.log("→ installing plugins");
      await installPlugins(jellyfinClient, pluginInstalls);
      console.log("✓ installed plugins");
      console.log("→ restarting Jellyfin to load them");
      await restartJellyfin(jellyfinClient, cfg.base_url, waitTimeoutMs);
      installedPlugins = await waitForInstalledPluginsActive(
        jellyfinClient,
        pluginInstalls,
        waitTimeoutMs,
      );
      console.log("✓ restarted Jellyfin; plugins loaded");
    } else {
      const pendingRestarts: PluginInstall[] | undefined =
        calculatePendingPluginRestarts(installedPlugins, catalog, cfg.plugins);
      if (pendingRestarts && plan) {
        for (const pending of pendingRestarts) {
          plan.action(`plugin ${pending.name}: would restart to load it`);
        }
      } else if (pendingRestarts) {
        console.log("→ restarting Jellyfin to load installed plugins");
        await restartJellyfin(jellyfinClient, cfg.base_url, waitTimeoutMs);
        installedPlugins = await waitForInstalledPluginsActive(
          jellyfinClient,
          pendingRestarts,
          waitTimeoutMs,
        );
        console.log("✓ restarted Jellyfin; plugins loaded");
      } else {
        console.log("✓ plugins already up to date");
      }
    }

    const pluginRemovals: PluginRemoval[] | undefined = calculatePluginRemovals(
      installedPlugins,
      catalog,
      cfg.plugins,
    );

    if (pluginRemovals && plan) {
      for (const removal of pluginRemovals) {
        plan.action(
          `plugin ${removal.name}: remove superseded ${removal.version}`,
        );
      }
    } else if (pluginRemovals) {
      console.log("→ removing superseded plugin versions");
      await removePlugins(jellyfinClient, pluginRemovals);
      console.log("✓ removed superseded plugin versions");
      console.log("→ restarting Jellyfin to unload them");
      await restartJellyfin(jellyfinClient, cfg.base_url, waitTimeoutMs);
      installedPlugins = await jellyfinClient.getPlugins();
      console.log("✓ restarted Jellyfin");
    }

    const renamedPlugins: PluginConfigList = resolveInstalledPluginNames(
      installedPlugins,
      catalog,
      cfg.plugins,
    );
    const desiredPlugins: PluginConfigList = dryRun
      ? renamedPlugins.filter((wanted: PluginConfig) =>
          installedPlugins.some(
            (installed: PluginInfoSchema) => installed.Name === wanted.name,
          ),
        )
      : renamedPlugins;
    const currentPluginConfigurations: Map<string, PluginConfigurationSchema> =
      await getPluginConfigurationSchemaByName(
        jellyfinClient,
        installedPlugins,
        desiredPlugins,
      );
    const pluginConfigurationsToUpdate:
      Map<string, BasePluginConfigurationSchema> | undefined =
      calculatePluginConfigurationsDiff(
        currentPluginConfigurations,
        desiredPlugins,
      );

    if (pluginConfigurationsToUpdate && plan) {
      for (const [name, current] of currentPluginConfigurations) {
        const next: BasePluginConfigurationSchema | undefined =
          pluginConfigurationsToUpdate.get(current.id);
        if (next)
          plan.change(
            `plugin ${name}.configuration`,
            current.configuration,
            next,
          );
      }
    } else if (pluginConfigurationsToUpdate) {
      console.log("→ updating plugin configurations");
      await applyPluginConfigurations(
        jellyfinClient,
        pluginConfigurationsToUpdate,
      );
      console.log("✓ updated plugin configurations");
    } else {
      console.log("✓ plugin configurations already up to date");
    }
  }

  if (cfg.api_keys) {
    const currentApiKeys: AuthenticationInfoSchema[] =
      await jellyfinClient.getApiKeys();
    const keysToCreate: ApiKeyConfig[] | undefined = calculateApiKeysToCreate(
      currentApiKeys,
      cfg.api_keys,
    );
    if (keysToCreate && plan) {
      for (const key of keysToCreate) {
        plan.action(`api key ${key.name}: would be created`);
      }
    } else if (keysToCreate) {
      console.log("→ creating API keys");
      await createApiKeys(jellyfinClient, keysToCreate);
      console.log("✓ created API keys");
    } else {
      console.log("✓ API keys already up to date");
    }
  }

  if (plan) {
    console.log(
      `${plan.pending ? "DRY RUN: changes are pending" : "DRY RUN: nothing would change"}${passwordsUnverified ? " (passwords were not verified)" : ""}`,
    );
  }
  return { dryRun, pending: plan?.pending ?? false };
}
