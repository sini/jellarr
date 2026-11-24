import { z } from "zod";
import { SystemConfigType } from "./system";
import { MetadataConfigType } from "./metadata";
import { XbmcMetadataConfigType } from "./xbmc-metadata";
import { EncodingOptionsConfigType } from "./encoding-options";
import { LibraryConfigType } from "./library";
import { BrandingOptionsConfigType } from "./branding-options";
import { NetworkingConfigType } from "./networking";
import { UserConfigListType } from "./users";
import { StartupConfigType } from "./startup";
import { PluginConfigListType } from "./plugins";
import { ApiKeyConfigListType } from "./api-keys";
import { DeviceConfigListType } from "./devices";
import { LiveTvConfigType } from "./livetv";
import { AuthoritativeConfigType } from "./authoritative";
import {
  ScheduledTaskConfigListType,
  type ScheduledTaskConfig,
  type TaskTriggerConfig,
} from "./scheduled-tasks";
import { parseDuration, triggerProblem } from "../../mappers/scheduled-tasks";

interface RootConfigInput {
  system: { pluginRepositories?: Array<{ name: string }> | undefined };
  plugins?: Array<{ repository?: string | undefined }> | undefined;
  users?: Array<{ name: string; renameFrom?: string | undefined }> | undefined;
  livetv?: { authoritative?: boolean | undefined } | undefined;
  authoritative?:
    | {
        livetv?: boolean | undefined;
        users?: boolean | "delete" | "disable" | undefined;
        deleteDisabledAfter?: string | undefined;
      }
    | undefined;
  scheduledTasks?: ScheduledTaskConfig[] | undefined;
}

export const RootConfigType: z.ZodObject<{
  version: z.ZodNumber;
  base_url: z.ZodURL;
  system: typeof SystemConfigType;
  metadata: z.ZodOptional<typeof MetadataConfigType>;
  xbmcMetadata: z.ZodOptional<typeof XbmcMetadataConfigType>;
  encoding: z.ZodOptional<typeof EncodingOptionsConfigType>;
  library: z.ZodOptional<typeof LibraryConfigType>;
  branding: z.ZodOptional<typeof BrandingOptionsConfigType>;
  networking: z.ZodOptional<typeof NetworkingConfigType>;
  users: z.ZodOptional<typeof UserConfigListType>;
  plugins: z.ZodOptional<typeof PluginConfigListType>;
  startup: z.ZodOptional<typeof StartupConfigType>;
  api_keys: z.ZodOptional<typeof ApiKeyConfigListType>;
  devices: z.ZodOptional<typeof DeviceConfigListType>;
  livetv: z.ZodOptional<typeof LiveTvConfigType>;
  authoritative: z.ZodOptional<typeof AuthoritativeConfigType>;
  scheduledTasks: z.ZodOptional<typeof ScheduledTaskConfigListType>;
  reconcilePasswords: z.ZodOptional<z.ZodBoolean>;
  expandEnv: z.ZodOptional<z.ZodBoolean>;
}> = z
  .object({
    version: z.number().int().positive("Version must be a positive integer"),
    base_url: z.url({ message: "Base URL must be a valid URL" }),
    system: SystemConfigType,
    metadata: MetadataConfigType.optional(),
    xbmcMetadata: XbmcMetadataConfigType.optional(),
    encoding: EncodingOptionsConfigType.optional(),
    library: LibraryConfigType.optional(),
    branding: BrandingOptionsConfigType.optional(),
    networking: NetworkingConfigType.optional(),
    users: UserConfigListType.optional(),
    plugins: PluginConfigListType.optional(),
    startup: StartupConfigType.optional(),
    api_keys: ApiKeyConfigListType.optional(),
    devices: DeviceConfigListType.optional(),
    livetv: LiveTvConfigType.optional(),
    authoritative: AuthoritativeConfigType.optional(),
    scheduledTasks: ScheduledTaskConfigListType.optional(),
    reconcilePasswords: z.boolean().optional(),
    expandEnv: z.boolean().optional(),
  })
  .strict()
  .superRefine((cfg: RootConfigInput, ctx: z.RefinementCtx): void => {
    const alias: boolean | undefined = cfg.authoritative?.livetv;
    const canonical: boolean | undefined = cfg.livetv?.authoritative;
    if (alias !== undefined && canonical !== undefined && alias !== canonical) {
      ctx.addIssue({
        code: "custom",
        path: ["authoritative", "livetv"],
        message:
          "authoritative.livetv is an alias of livetv.authoritative and the two disagree; set only livetv.authoritative",
      });
    }
    const after: string | undefined = cfg.authoritative?.deleteDisabledAfter;
    if (after !== undefined) {
      const message: string | undefined =
        cfg.authoritative?.users !== "disable"
          ? 'authoritative.deleteDisabledAfter is only valid with authoritative.users: "disable"'
          : parseDuration(after) === undefined
            ? `authoritative.deleteDisabledAfter "${after}" is not a duration such as "30d", "12h" or "2w"`
            : undefined;
      if (message) {
        ctx.addIssue({
          code: "custom",
          path: ["authoritative", "deleteDisabledAfter"],
          message,
        });
      }
    }
    (cfg.scheduledTasks ?? []).forEach(
      (task: ScheduledTaskConfig, index: number): void => {
        if (!task.key && !task.name) {
          ctx.addIssue({
            code: "custom",
            path: ["scheduledTasks", index],
            message: "a scheduled task needs a key (preferred) or a name",
          });
        }
        task.triggers.forEach(
          (trigger: TaskTriggerConfig, triggerIndex: number): void => {
            const problem: string | undefined = triggerProblem(trigger);
            if (problem) {
              ctx.addIssue({
                code: "custom",
                path: ["scheduledTasks", index, "triggers", triggerIndex],
                message: problem,
              });
            }
          },
        );
      },
    );
    const userNames: Set<string> = new Set(
      (cfg.users ?? []).map((user: { name: string }) => user.name),
    );
    const userSources: Set<string> = new Set();
    (cfg.users ?? []).forEach(
      (user: { renameFrom?: string | undefined }, index: number): void => {
        if (user.renameFrom === undefined) return;
        const message: string | undefined = userNames.has(user.renameFrom)
          ? `users renameFrom "${user.renameFrom}" is also a declared user name`
          : userSources.has(user.renameFrom)
            ? `users renameFrom "${user.renameFrom}" is used by more than one user`
            : undefined;
        userSources.add(user.renameFrom);
        if (message) {
          ctx.addIssue({
            code: "custom",
            path: ["users", index, "renameFrom"],
            message,
          });
        }
      },
    );
    const known: Set<string> = new Set(
      (cfg.system.pluginRepositories ?? []).map(
        (repository: { name: string }) => repository.name,
      ),
    );
    (cfg.plugins ?? []).forEach(
      (plugin: { repository?: string | undefined }, index: number): void => {
        if (plugin.repository !== undefined && !known.has(plugin.repository)) {
          ctx.addIssue({
            code: "custom",
            path: ["plugins", index, "repository"],
            message: `Plugin repository "${plugin.repository}" is not declared in system.pluginRepositories`,
          });
        }
      },
    );
  });

export type RootConfig = z.infer<typeof RootConfigType>;
