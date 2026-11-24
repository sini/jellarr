import type { ServerConfigurationSchema } from "../types/schema/system";
import type { EncodingOptionsSchema } from "../types/schema/encoding-options";
import type { NetworkConfigurationSchema } from "../types/schema/networking";
import type { XbmcMetadataOptionsSchema } from "../types/schema/xbmc-metadata";
import type { MetadataConfigurationSchema } from "../types/schema/metadata";
import type {
  VirtualFolderInfoSchema,
  AddVirtualFolderDtoSchema,
  CollectionTypeSchema,
  UpdateLibraryOptionsDtoSchema,
} from "../types/schema/library";
import type { BrandingOptionsDtoSchema } from "../types/schema/branding-options";
import type {
  DisplayPreferencesDtoSchema,
  UserDtoSchema,
  CreateUserByNameSchema,
  UserPolicySchema,
  UserConfigurationSchema,
} from "../types/schema/users";
import type {
  JellyfinClient,
  ApiResponse,
  GetSystemConfigurationResponse,
  PostSystemConfigurationResponse,
  GetEncodingConfigurationResponse,
  PostEncodingConfigurationResponse,
  GetNetworkingConfigurationResponse,
  PostNetworkingConfigurationResponse,
  GetMetadataConfigurationResponse,
  PostMetadataConfigurationResponse,
  GetVirtualFoldersResponse,
  PostVirtualFolderResponse,
  GetBrandingConfigurationResponse,
  PostBrandingConfigurationResponse,
  GetUsersResponse,
  PostNewUserResponse,
  PostUserPolicyResponse,
  PostStartupCompleteResponse,
  GetSystemInfoResponse,
  GetPluginsResponse,
  GetPackagesResponse,
  PostInstallPackageResponse,
  DeletePluginResponse,
  InstallPackageOptions,
  GetPluginConfigurationResponse,
  PostPluginConfigurationResponse,
  GetApiKeysResponse,
  PostApiKeyResponse,
  PostAuthenticateByNameResponse,
  GetPublicSystemInfoResponse,
  PostStartupStepResponse,
  PostUserPasswordResponse,
  PasswordCheck,
  GetStartupUserResponse,
} from "./jellyfin.types";
import { makeClient, type RetryOptions } from "./client";
import { logger } from "../lib/logger";
import { JellyfinHttpError } from "./errors";
import type { paths } from "../../generated/schema";
import type { Client } from "openapi-fetch";
import {
  type PluginInfoSchema,
  type PackageInfoSchema,
  type BasePluginConfigurationSchema,
} from "../types/schema/plugins";
import type {
  PublicSystemInfoSchema,
  StartupConfigurationDtoSchema,
  StartupUserDtoSchema,
  StartupRemoteAccessDtoSchema,
} from "../types/schema/startup";
import type { AuthenticationInfoSchema } from "../types/schema/api-keys";
import type {
  TaskInfoSchema,
  TaskTriggerInfoSchema,
} from "../types/schema/scheduled-tasks";
import type {
  LiveTvOptionsSchema,
  ListingsProviderInfoSchema,
  TunerHostInfoSchema,
} from "../types/schema/livetv";

/** The display-preferences id, and client name, under which jellarr keeps its own per-user markers. */
const DISPLAY_PREFERENCES_ID: string = "jellarr";

export function createJellyfinClient(
  baseUrl: string,
  apiKey?: string,
  retry?: RetryOptions,
): JellyfinClient {
  let token: string | undefined = apiKey;
  const client: Client<paths> = makeClient(
    baseUrl,
    (): string | undefined => token,
    "jellarr",
    retry,
  );

  // NOTE: /Startup/* is anonymous on a pristine server; a stale token there could only get it rejected.
  const startup: Client<paths> = makeClient(
    baseUrl,
    undefined,
    "jellarr",
    retry,
  );

  return {
    setAccessToken(accessToken: string): void {
      token = accessToken;
    },

    async checkUserPassword(
      username: string,
      password: string,
    ): Promise<PasswordCheck> {
      const probeId: string = "jellarr-password-check";
      const probe: Client<paths> = makeClient(
        baseUrl,
        undefined,
        probeId,
        retry,
      );
      const res: PostAuthenticateByNameResponse = await probe.POST(
        "/Users/AuthenticateByName",
        {
          body: { Username: username, Pw: password },
          headers: { "content-type": "application/json" },
        },
      );
      if (res.response.status === 401) return "invalid";
      if (res.response.status === 403) return "unverifiable";
      if (!res.response.ok) {
        throw new Error(
          `POST /Users/AuthenticateByName failed: ${res.response.status.toString()}`,
        );
      }
      const probeToken: string | null | undefined = res.data?.AccessToken;
      if (probeToken) {
        await makeClient(baseUrl, probeToken, probeId)
          .POST("/Sessions/Logout")
          .catch((error: unknown) => {
            logger.warn(
              `Could not sign out the password-check session of ${username}: ${error instanceof Error ? error.message : String(error)}`,
            );
          });
      }
      return "valid";
    },

    async updateUserPassword(
      userId: string,
      newPassword: string,
    ): Promise<void> {
      const res: PostUserPasswordResponse = await client.POST(
        "/Users/Password",
        {
          params: { query: { userId } },
          body: { NewPw: newPassword },
          headers: { "content-type": "application/json" },
        },
      );
      if (!res.response.ok) {
        throw new Error(
          `POST /Users/Password failed: ${res.response.status.toString()}`,
        );
      }
    },

    async authenticateByName(
      username: string,
      password: string,
    ): Promise<string> {
      const res: PostAuthenticateByNameResponse = await client.POST(
        "/Users/AuthenticateByName",
        {
          body: { Username: username, Pw: password },
          headers: { "content-type": "application/json" },
        },
      );
      if (!res.response.ok) {
        throw new JellyfinHttpError(
          `POST /Users/AuthenticateByName failed: ${res.response.status.toString()}`,
          res.response.status,
        );
      }
      const accessToken: string | null | undefined = res.data?.AccessToken;
      if (!accessToken) {
        throw new Error(
          "POST /Users/AuthenticateByName succeeded but returned no AccessToken",
        );
      }
      return accessToken;
    },

    async getServerVersion(): Promise<string> {
      const res: GetSystemInfoResponse = await client.GET("/System/Info");
      if (!res.response.ok) {
        throw new Error(
          `GET /System/Info failed: ${res.response.status.toString()}`,
        );
      }
      const version: string | null | undefined = res.data?.Version;
      if (!version) {
        throw new Error("GET /System/Info returned no server version");
      }
      return version;
    },

    async getServerSpec(): Promise<unknown> {
      const res: Response = await fetch(
        `${baseUrl.replace(/\/+$/, "")}/api-docs/openapi.json`,
        token
          ? { headers: { Authorization: `MediaBrowser Token="${token}"` } }
          : {},
      );
      if (!res.ok) {
        throw new Error(
          `GET /api-docs/openapi.json failed: ${res.status.toString()}`,
        );
      }
      return res.json();
    },

    async getPendingRestart(): Promise<boolean> {
      const res: GetSystemInfoResponse = await client.GET("/System/Info");
      if (!res.response.ok) {
        throw new Error(
          `GET /System/Info failed: ${res.response.status.toString()}`,
        );
      }
      // NOTE: the generated SystemInfo type omits HasPendingRestart, which the server sends.
      return (
        (res.data as { HasPendingRestart?: boolean } | undefined)
          ?.HasPendingRestart === true
      );
    },

    async getSystemConfiguration(): Promise<ServerConfigurationSchema> {
      const res: GetSystemConfigurationResponse = await client.GET(
        "/System/Configuration",
      );

      if (!res.response.ok) {
        throw new JellyfinHttpError(
          `GET /System/Configuration failed: ${res.response.status.toString()}`,
          res.response.status,
        );
      }

      return res.data as ServerConfigurationSchema;
    },

    async updateSystemConfiguration(
      body: Partial<ServerConfigurationSchema>,
    ): Promise<void> {
      const res: PostSystemConfigurationResponse = await client.POST(
        "/System/Configuration",
        {
          body,
          headers: { "content-type": "application/json" },
        },
      );

      if (!res.response.ok) {
        throw new Error(
          `POST /System/Configuration failed: ${res.response.status.toString()}`,
        );
      }
    },

    async getEncodingConfiguration(): Promise<EncodingOptionsSchema> {
      const res: GetEncodingConfigurationResponse = await client.GET(
        "/System/Configuration/{key}",
        {
          params: { path: { key: "encoding" } },
        },
      );

      if (!res.response.ok) {
        throw new Error(
          `GET /System/Configuration/encoding failed: ${res.response.status.toString()}`,
        );
      }

      return res.data as EncodingOptionsSchema;
    },

    async updateEncodingConfiguration(
      body: Partial<EncodingOptionsSchema>,
    ): Promise<void> {
      const res: PostEncodingConfigurationResponse = await client.POST(
        "/System/Configuration/{key}",
        {
          params: { path: { key: "encoding" } },
          body,
          headers: { "content-type": "application/json" },
        },
      );

      if (!res.response.ok) {
        throw new Error(
          `POST /System/Configuration/encoding failed: ${res.response.status.toString()}`,
        );
      }
    },

    async getXbmcMetadataConfiguration(): Promise<XbmcMetadataOptionsSchema> {
      const res: ApiResponse = await client.GET("/System/Configuration/{key}", {
        params: { path: { key: "xbmcmetadata" } },
      });

      if (!res.response.ok) {
        throw new Error(
          `GET /System/Configuration/xbmcmetadata failed: ${res.response.status.toString()}`,
        );
      }

      return res.data as XbmcMetadataOptionsSchema;
    },

    async updateXbmcMetadataConfiguration(
      body: Partial<XbmcMetadataOptionsSchema>,
    ): Promise<void> {
      const res: ApiResponse = await client.POST(
        "/System/Configuration/{key}",
        {
          params: { path: { key: "xbmcmetadata" } },
          body,
          headers: { "content-type": "application/json" },
        },
      );

      if (!res.response.ok) {
        throw new Error(
          `POST /System/Configuration/xbmcmetadata failed: ${res.response.status.toString()}`,
        );
      }
    },

    async getNetworkingConfiguration(): Promise<NetworkConfigurationSchema> {
      const res: GetNetworkingConfigurationResponse = await client.GET(
        "/System/Configuration/{key}",
        {
          params: { path: { key: "network" } },
        },
      );

      if (res.error) {
        throw new Error(
          `GET /System/Configuration/network failed: ${res.response.status.toString()}`,
        );
      }

      return res.data as NetworkConfigurationSchema;
    },

    async updateNetworkingConfiguration(
      body: Partial<NetworkConfigurationSchema>,
    ): Promise<void> {
      const res: PostNetworkingConfigurationResponse = await client.POST(
        "/System/Configuration/{key}",
        {
          params: { path: { key: "network" } },
          body,
          headers: { "content-type": "application/json" },
        },
      );

      if (res.error) {
        throw new Error(
          `POST /System/Configuration/network failed: ${res.response.status.toString()}`,
        );
      }
    },

    async getMetadataConfiguration(): Promise<MetadataConfigurationSchema> {
      const res: GetMetadataConfigurationResponse = await client.GET(
        "/System/Configuration/{key}",
        {
          params: { path: { key: "metadata" } },
        },
      );

      if (!res.response.ok) {
        throw new Error(
          `GET /System/Configuration/metadata failed: ${res.response.status.toString()}`,
        );
      }

      return res.data as MetadataConfigurationSchema;
    },

    async updateMetadataConfiguration(
      body: Partial<MetadataConfigurationSchema>,
    ): Promise<void> {
      const res: PostMetadataConfigurationResponse = await client.POST(
        "/System/Configuration/{key}",
        {
          params: { path: { key: "metadata" } },
          body,
          headers: { "content-type": "application/json" },
        },
      );

      if (!res.response.ok) {
        throw new Error(
          `POST /System/Configuration/metadata failed: ${res.response.status.toString()}`,
        );
      }
    },

    async getVirtualFolders(): Promise<VirtualFolderInfoSchema[]> {
      const res: GetVirtualFoldersResponse = await client.GET(
        "/Library/VirtualFolders",
      );

      if (!res.response.ok) {
        throw new Error(
          `GET /Library/VirtualFolders failed: ${res.response.status.toString()}`,
        );
      }

      return res.data as VirtualFolderInfoSchema[];
    },

    async addVirtualFolder(
      name: string,
      collectionType: CollectionTypeSchema | undefined,
      body: AddVirtualFolderDtoSchema,
    ): Promise<void> {
      const res: PostVirtualFolderResponse = await client.POST(
        "/Library/VirtualFolders",
        {
          params: {
            query: {
              name,
              collectionType,
              refreshLibrary: true,
            },
          },
          body,
          headers: { "content-type": "application/json" },
        },
      );

      if (!res.response.ok) {
        throw new Error(
          `POST /Library/VirtualFolders failed: ${res.response.status.toString()}`,
        );
      }
    },

    async updateLibraryOptions(
      libraryId: string,
      body: UpdateLibraryOptionsDtoSchema,
    ): Promise<void> {
      const res: PostStartupStepResponse = await client.POST(
        "/Library/VirtualFolders/LibraryOptions",
        {
          body: { ...body, Id: libraryId },
          headers: { "content-type": "application/json" },
        },
      );

      if (!res.response.ok) {
        throw new Error(
          `POST /Library/VirtualFolders/LibraryOptions failed: ${res.response.status.toString()}`,
        );
      }
    },

    async addMediaPath(libraryName: string, path: string): Promise<void> {
      const res: ApiResponse = await client.POST(
        "/Library/VirtualFolders/Paths",
        {
          params: { query: { refreshLibrary: false } },
          body: { Name: libraryName, PathInfo: { Path: path } },
          headers: { "content-type": "application/json" },
        },
      );
      if (!res.response.ok) {
        throw new Error(
          `POST /Library/VirtualFolders/Paths failed: ${res.response.status.toString()}`,
        );
      }
    },

    async removeMediaPath(libraryName: string, path: string): Promise<void> {
      const res: ApiResponse = await client.DELETE(
        "/Library/VirtualFolders/Paths",
        {
          params: {
            query: { name: libraryName, path, refreshLibrary: false },
          },
        },
      );
      if (!res.response.ok) {
        throw new Error(
          `DELETE /Library/VirtualFolders/Paths failed: ${res.response.status.toString()}`,
        );
      }
    },

    async getBrandingConfiguration(): Promise<BrandingOptionsDtoSchema> {
      const res: GetBrandingConfigurationResponse = await client.GET(
        "/Branding/Configuration",
      );

      if (!res.response.ok) {
        throw new Error(
          `GET /Branding/Configuration failed: ${res.response.status.toString()}`,
        );
      }

      if (!res.data) {
        throw new Error(
          "GET /Branding/Configuration returned no body - the branding route moved again",
        );
      }

      return res.data as BrandingOptionsDtoSchema;
    },

    async updateBrandingConfiguration(
      body: Partial<BrandingOptionsDtoSchema>,
    ): Promise<void> {
      const res: PostBrandingConfigurationResponse = await client.POST(
        "/System/Configuration/Branding",
        {
          body: body as BrandingOptionsDtoSchema,
        },
      );

      if (!res.response.ok) {
        throw new Error(
          `POST /System/Configuration/Branding failed: ${res.response.status.toString()}`,
        );
      }
    },

    async getSplashscreen(): Promise<Uint8Array> {
      const res: ApiResponse = await client.GET("/Branding/Splashscreen", {
        parseAs: "arrayBuffer",
      });
      // NOTE: the server answers 404 when the splashscreen is disabled or none is set, never a generated image.
      if (res.response.status === 404) return new Uint8Array();
      if (!res.response.ok) {
        throw new Error(
          `GET /Branding/Splashscreen failed: ${res.response.status.toString()}`,
        );
      }
      return new Uint8Array(res.data as ArrayBuffer);
    },

    async uploadSplashscreen(image: Uint8Array): Promise<void> {
      // NOTE: the endpoint takes the image base64-encoded as a plain text body; the server sniffs the real type.
      const res: ApiResponse = await client.POST("/Branding/Splashscreen", {
        body: Buffer.from(image).toString("base64"),
        bodySerializer: (body: unknown): string => body as string,
        headers: { "content-type": "image/png" },
      });
      if (!res.response.ok) {
        throw new Error(
          `POST /Branding/Splashscreen failed: ${res.response.status.toString()}`,
        );
      }
    },

    async deleteSplashscreen(): Promise<void> {
      const res: ApiResponse = await client.DELETE("/Branding/Splashscreen");
      if (!res.response.ok) {
        throw new Error(
          `DELETE /Branding/Splashscreen failed: ${res.response.status.toString()}`,
        );
      }
    },

    async getUsers(): Promise<UserDtoSchema[]> {
      const res: GetUsersResponse = await client.GET("/Users");

      if (!res.response.ok) {
        throw new Error(`GET /Users failed: ${res.response.status.toString()}`);
      }

      return res.data as UserDtoSchema[];
    },

    async createUser(body: CreateUserByNameSchema): Promise<void> {
      const res: PostNewUserResponse = await client.POST("/Users/New", {
        body,
      });

      if (!res.response.ok) {
        throw new Error(
          `POST /Users/New failed: ${res.response.status.toString()}`,
        );
      }
    },

    async updateUserPolicy(
      userId: string,
      body: UserPolicySchema,
    ): Promise<void> {
      const res: PostUserPolicyResponse = await client.POST(
        "/Users/{userId}/Policy",
        {
          params: { path: { userId } },
          body,
          headers: { "content-type": "application/json" },
        },
      );

      if (!res.response.ok) {
        throw new Error(
          `POST /Users/{userId}/Policy failed: ${res.response.status.toString()}`,
        );
      }
    },

    async updateUserConfiguration(
      userId: string,
      body: UserConfigurationSchema,
    ): Promise<void> {
      const res: ApiResponse<void> = await client.POST("/Users/Configuration", {
        params: { query: { userId } },
        body,
        headers: { "content-type": "application/json" },
      });

      if (!res.response.ok) {
        throw new Error(
          `POST /Users/Configuration failed: ${res.response.status.toString()}`,
        );
      }
    },

    async completeStartupWizard(): Promise<void> {
      const res: PostStartupCompleteResponse =
        await startup.POST("/Startup/Complete");

      if (!res.response.ok) {
        throw new Error(
          `POST /Startup/Complete failed: ${res.response.status.toString()}`,
        );
      }
    },

    async getPublicSystemInfo(): Promise<PublicSystemInfoSchema> {
      const res: GetPublicSystemInfoResponse = await client.GET(
        "/System/Info/Public",
      );
      if (!res.response.ok) {
        throw new Error(
          `GET /System/Info/Public failed: ${res.response.status.toString()}`,
        );
      }
      return res.data as PublicSystemInfoSchema;
    },

    async updateStartupConfiguration(
      body: StartupConfigurationDtoSchema,
    ): Promise<void> {
      const res: PostStartupStepResponse = await startup.POST(
        "/Startup/Configuration",
        { body, headers: { "content-type": "application/json" } },
      );
      if (!res.response.ok) {
        throw new Error(
          `POST /Startup/Configuration failed: ${res.response.status.toString()}`,
        );
      }
    },

    async getStartupUser(): Promise<void> {
      const res: GetStartupUserResponse = await startup.GET("/Startup/User");
      if (!res.response.ok) {
        throw new Error(
          `GET /Startup/User failed: ${res.response.status.toString()}`,
        );
      }
    },

    async updateStartupUser(body: StartupUserDtoSchema): Promise<void> {
      const res: PostStartupStepResponse = await startup.POST("/Startup/User", {
        body,
        headers: { "content-type": "application/json" },
      });
      if (!res.response.ok) {
        throw new Error(
          `POST /Startup/User failed: ${res.response.status.toString()}`,
        );
      }
    },

    async setRemoteAccess(body: StartupRemoteAccessDtoSchema): Promise<void> {
      const res: PostStartupStepResponse = await startup.POST(
        "/Startup/RemoteAccess",
        { body, headers: { "content-type": "application/json" } },
      );
      if (!res.response.ok) {
        throw new Error(
          `POST /Startup/RemoteAccess failed: ${res.response.status.toString()}`,
        );
      }
    },

    async restartServer(): Promise<void> {
      const res: PostStartupStepResponse = await client.POST("/System/Restart");
      if (!res.response.ok) {
        throw new Error(
          `POST /System/Restart failed: ${res.response.status.toString()}`,
        );
      }
    },

    async getPlugins(): Promise<PluginInfoSchema[]> {
      const res: GetPluginsResponse = await client.GET("/Plugins");
      if (!res.response.ok) {
        throw new Error(
          `GET /Plugins failed: ${res.response.status.toString()}`,
        );
      }
      return res.data as PluginInfoSchema[];
    },

    async getPackages(): Promise<PackageInfoSchema[]> {
      const res: GetPackagesResponse = await client.GET("/Packages");
      if (!res.response.ok) {
        throw new Error(
          `GET /Packages failed: ${res.response.status.toString()}`,
        );
      }
      return res.data as PackageInfoSchema[];
    },

    async installPackage(
      name: string,
      options?: InstallPackageOptions,
    ): Promise<void> {
      const res: PostInstallPackageResponse = await client.POST(
        "/Packages/Installed/{name}",
        {
          params: { path: { name }, query: options },
        },
      );
      if (!res.response.ok) {
        throw new Error(
          `POST /Packages/Installed/${name} failed: ${res.response.status.toString()}`,
        );
      }
    },

    async uninstallPlugin(pluginId: string, version: string): Promise<void> {
      const res: DeletePluginResponse = await client.DELETE(
        "/Plugins/{pluginId}/{version}",
        {
          params: { path: { pluginId, version } },
        },
      );
      if (!res.response.ok) {
        throw new Error(
          `DELETE /Plugins/${pluginId}/${version} failed: ${res.response.status.toString()}`,
        );
      }
    },

    async enablePlugin(pluginId: string, version: string): Promise<void> {
      const res: ApiResponse = await client.POST(
        "/Plugins/{pluginId}/{version}/Enable",
        { params: { path: { pluginId, version } } },
      );
      if (!res.response.ok) {
        throw new Error(
          `POST /Plugins/${pluginId}/${version}/Enable failed: ${res.response.status.toString()}`,
        );
      }
    },

    async disablePlugin(pluginId: string, version: string): Promise<void> {
      const res: ApiResponse = await client.POST(
        "/Plugins/{pluginId}/{version}/Disable",
        { params: { path: { pluginId, version } } },
      );
      if (!res.response.ok) {
        throw new Error(
          `POST /Plugins/${pluginId}/${version}/Disable failed: ${res.response.status.toString()}`,
        );
      }
    },

    async getPluginConfiguration(
      pluginId: string,
    ): Promise<BasePluginConfigurationSchema> {
      const res: GetPluginConfigurationResponse = await client.GET(
        "/Plugins/{pluginId}/Configuration",
        {
          params: { path: { pluginId } },
        },
      );
      if (!res.response.ok) {
        throw new Error(
          `GET /Plugins/${pluginId}/Configuration failed: ${res.response.status.toString()}`,
        );
      }
      return res.data as BasePluginConfigurationSchema;
    },

    async updatePluginConfiguration(
      pluginId: string,
      body: BasePluginConfigurationSchema,
    ): Promise<void> {
      const res: PostPluginConfigurationResponse = await client.POST(
        "/Plugins/{pluginId}/Configuration",
        {
          params: { path: { pluginId } },
          body,
        } as unknown as { params: { path: { pluginId: string } } },
      );
      if (!res.response.ok) {
        throw new Error(
          `POST /Plugins/${pluginId}/Configuration failed: ${res.response.status.toString()}`,
        );
      }
    },

    async getApiKeys(): Promise<AuthenticationInfoSchema[]> {
      const res: GetApiKeysResponse = await client.GET("/Auth/Keys");
      if (res.error) {
        throw new Error(
          `GET /Auth/Keys failed: ${res.response.status.toString()}`,
        );
      }
      const data: { Items?: AuthenticationInfoSchema[] } = res.data as {
        Items?: AuthenticationInfoSchema[];
      };
      return data.Items ?? [];
    },

    async createApiKey(appName: string): Promise<void> {
      const res: PostApiKeyResponse = await client.POST("/Auth/Keys", {
        params: { query: { app: appName } },
      });
      if (res.error) {
        throw new Error(
          `POST /Auth/Keys failed: ${res.response.status.toString()}`,
        );
      }
    },

    async deleteApiKey(accessToken: string): Promise<void> {
      const res: ApiResponse = await client.DELETE("/Auth/Keys/{key}", {
        params: { path: { key: accessToken } },
      });
      if (!res.response.ok) {
        throw new Error(
          `DELETE /Auth/Keys/{key} failed: ${res.response.status.toString()}`,
        );
      }
    },

    async getCurrentUser(): Promise<UserDtoSchema | undefined> {
      const res: ApiResponse<UserDtoSchema> = await client.GET("/Users/Me");
      // NOTE: an API key belongs to no user, so the server refuses with a 4xx other than 401.
      if (res.response.status === 401 || res.response.status >= 500) {
        throw new Error(
          `GET /Users/Me failed: ${res.response.status.toString()}`,
        );
      }
      return res.response.ok ? res.data : undefined;
    },

    async getDisplayPreferences(
      userId: string,
      id: string = DISPLAY_PREFERENCES_ID,
      clientName: string = DISPLAY_PREFERENCES_ID,
    ): Promise<DisplayPreferencesDtoSchema> {
      const res: ApiResponse<DisplayPreferencesDtoSchema> = await client.GET(
        "/DisplayPreferences/{displayPreferencesId}",
        {
          params: {
            path: { displayPreferencesId: id },
            query: { userId, client: clientName },
          },
        },
      );
      if (!res.response.ok || !res.data) {
        throw new Error(
          `GET /DisplayPreferences/${id} failed: ${res.response.status.toString()}`,
        );
      }
      return res.data;
    },

    async updateDisplayPreferences(
      userId: string,
      body: DisplayPreferencesDtoSchema,
      id: string = DISPLAY_PREFERENCES_ID,
      clientName: string = DISPLAY_PREFERENCES_ID,
    ): Promise<void> {
      const res: ApiResponse = await client.POST(
        "/DisplayPreferences/{displayPreferencesId}",
        {
          params: {
            path: { displayPreferencesId: id },
            query: { userId, client: clientName },
          },
          body,
          headers: { "content-type": "application/json" },
        },
      );
      if (!res.response.ok) {
        throw new Error(
          `POST /DisplayPreferences/${id} failed: ${res.response.status.toString()}`,
        );
      }
    },

    async renameUser(userId: string, body: UserDtoSchema): Promise<void> {
      const res: ApiResponse = await client.POST("/Users", {
        params: { query: { userId } },
        body,
        headers: { "content-type": "application/json" },
      });
      if (!res.response.ok) {
        throw new Error(
          `POST /Users failed: ${res.response.status.toString()}`,
        );
      }
    },

    async deleteUser(userId: string): Promise<void> {
      const res: ApiResponse = await client.DELETE("/Users/{userId}", {
        params: { path: { userId } },
      });
      if (!res.response.ok) {
        throw new Error(
          `DELETE /Users/${userId} failed: ${res.response.status.toString()}`,
        );
      }
    },

    async deleteVirtualFolder(name: string): Promise<void> {
      const res: ApiResponse = await client.DELETE("/Library/VirtualFolders", {
        params: { query: { name, refreshLibrary: false } },
      });
      if (!res.response.ok) {
        throw new Error(
          `DELETE /Library/VirtualFolders failed: ${res.response.status.toString()}`,
        );
      }
    },

    async renameVirtualFolder(name: string, newName: string): Promise<void> {
      const res: ApiResponse = await client.POST(
        "/Library/VirtualFolders/Name",
        { params: { query: { name, newName, refreshLibrary: false } } },
      );
      if (!res.response.ok) {
        throw new Error(
          `POST /Library/VirtualFolders/Name failed: ${res.response.status.toString()}`,
        );
      }
    },

    async getScheduledTasks(): Promise<TaskInfoSchema[]> {
      const res: ApiResponse<TaskInfoSchema[]> =
        await client.GET("/ScheduledTasks");
      if (!res.response.ok) {
        throw new Error(
          `GET /ScheduledTasks failed: ${res.response.status.toString()}`,
        );
      }
      return res.data ?? [];
    },

    async updateTaskTriggers(
      taskId: string,
      triggers: TaskTriggerInfoSchema[],
    ): Promise<void> {
      const res: ApiResponse = await client.POST(
        "/ScheduledTasks/{taskId}/Triggers",
        { params: { path: { taskId } }, body: triggers },
      );
      if (!res.response.ok) {
        throw new Error(
          `POST /ScheduledTasks/${taskId}/Triggers failed: ${res.response.status.toString()}`,
        );
      }
    },

    async getLiveTvOptions(): Promise<LiveTvOptionsSchema> {
      const res: ApiResponse = await client.GET("/System/Configuration/{key}", {
        params: { path: { key: "livetv" } },
      });
      if (!res.response.ok) {
        throw new Error(
          `GET /System/Configuration/livetv failed: ${res.response.status.toString()}`,
        );
      }
      return (res.data ?? {}) as LiveTvOptionsSchema;
    },

    async updateLiveTvOptions(body: LiveTvOptionsSchema): Promise<void> {
      const res: ApiResponse = await client.POST(
        "/System/Configuration/{key}",
        {
          params: { path: { key: "livetv" } },
          body,
        },
      );
      if (!res.response.ok) {
        throw new Error(
          `POST /System/Configuration/livetv failed: ${res.response.status.toString()}`,
        );
      }
    },

    async saveTunerHost(body: TunerHostInfoSchema): Promise<void> {
      const res: ApiResponse = await client.POST("/LiveTv/TunerHosts", {
        body,
      });
      if (!res.response.ok) {
        throw new Error(
          `POST /LiveTv/TunerHosts failed: ${res.response.status.toString()}`,
        );
      }
    },

    async deleteTunerHost(id: string): Promise<void> {
      const res: ApiResponse = await client.DELETE("/LiveTv/TunerHosts", {
        params: { query: { id } },
      });
      if (!res.response.ok) {
        throw new Error(
          `DELETE /LiveTv/TunerHosts failed: ${res.response.status.toString()}`,
        );
      }
    },

    async saveListingProvider(
      body: ListingsProviderInfoSchema,
      password?: string,
    ): Promise<void> {
      const res: ApiResponse = await client.POST("/LiveTv/ListingProviders", {
        params: { query: { pw: password } },
        body,
      });
      if (!res.response.ok) {
        throw new Error(
          `POST /LiveTv/ListingProviders failed: ${res.response.status.toString()}`,
        );
      }
    },

    async deleteListingProvider(id: string): Promise<void> {
      const res: ApiResponse = await client.DELETE("/LiveTv/ListingProviders", {
        params: { query: { id } },
      });
      if (!res.response.ok) {
        throw new Error(
          `DELETE /LiveTv/ListingProviders failed: ${res.response.status.toString()}`,
        );
      }
    },
  };
}
