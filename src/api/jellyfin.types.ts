import type { ServerConfigurationSchema } from "../types/schema/system";
import type { EncodingOptionsSchema } from "../types/schema/encoding-options";
import type { NetworkConfigurationSchema } from "../types/schema/networking";
import type { MetadataConfigurationSchema } from "../types/schema/metadata";
import type {
  VirtualFolderInfoSchema,
  AddVirtualFolderDtoSchema,
  CollectionTypeSchema,
  UpdateLibraryOptionsDtoSchema,
} from "../types/schema/library";
import type { BrandingOptionsDtoSchema } from "../types/schema/branding-options";
import type {
  UserDtoSchema,
  CreateUserByNameSchema,
  UserPolicySchema,
  UserConfigurationSchema,
} from "../types/schema/users";
import {
  type PluginInfoSchema,
  type PackageInfoSchema,
  type BasePluginConfigurationSchema,
} from "../types/schema/plugins";
import type { AuthenticationInfoSchema } from "../types/schema/api-keys";
import type {
  LiveTvOptionsSchema,
  ListingsProviderInfoSchema,
  TunerHostInfoSchema,
} from "../types/schema/livetv";

import type {
  PublicSystemInfoSchema,
  StartupConfigurationDtoSchema,
  StartupUserDtoSchema,
  StartupRemoteAccessDtoSchema,
} from "../types/schema/startup";

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: unknown;
  response: Response;
}

export type GetSystemConfigurationResponse =
  ApiResponse<ServerConfigurationSchema>;
export type PostSystemConfigurationResponse = ApiResponse<void>;
export type GetEncodingConfigurationResponse = ApiResponse;
export type PostEncodingConfigurationResponse = ApiResponse<void>;
export type GetNetworkingConfigurationResponse = ApiResponse;
export type PostNetworkingConfigurationResponse = ApiResponse<void>;
export type GetMetadataConfigurationResponse = ApiResponse;
export type PostMetadataConfigurationResponse = ApiResponse<void>;
export type GetVirtualFoldersResponse = ApiResponse<VirtualFolderInfoSchema[]>;
export type PostVirtualFolderResponse = ApiResponse<void>;
export type GetBrandingConfigurationResponse = ApiResponse;
export type PostBrandingConfigurationResponse = ApiResponse<void>;
export type GetUsersResponse = ApiResponse<UserDtoSchema[]>;
export type PostNewUserResponse = ApiResponse<UserDtoSchema>;
export type PostUserPolicyResponse = ApiResponse<void>;
export type PostStartupCompleteResponse = ApiResponse<void>;
export type GetPublicSystemInfoResponse = ApiResponse<PublicSystemInfoSchema>;
export type GetStartupUserResponse = ApiResponse<StartupUserDtoSchema>;
export type PostUserPasswordResponse = ApiResponse<void>;
export type PostStartupStepResponse = ApiResponse<void>;
export type PostAuthenticateByNameResponse = ApiResponse<{
  AccessToken?: string | null;
}>;
export type GetSystemInfoResponse = ApiResponse<{ Version?: string | null }>;
export type GetPluginsResponse = ApiResponse<PluginInfoSchema[]>;
export type GetPackagesResponse = ApiResponse<PackageInfoSchema[]>;
export type PostInstallPackageResponse = ApiResponse<void>;
export type DeletePluginResponse = ApiResponse<void>;
export type GetPluginConfigurationResponse =
  ApiResponse<BasePluginConfigurationSchema>;
export type PostPluginConfigurationResponse = ApiResponse<void>;
export type GetApiKeysResponse = ApiResponse<{
  Items?: AuthenticationInfoSchema[];
}>;
export type PostApiKeyResponse = ApiResponse<void>;

export interface InstallPackageOptions {
  assemblyGuid?: string;
  version?: string;
  repositoryUrl?: string;
}

export type PasswordCheck = "valid" | "invalid" | "unverifiable";

export interface JellyfinClient {
  restartServer(): Promise<void>;
  checkUserPassword(username: string, password: string): Promise<PasswordCheck>;
  updateUserPassword(userId: string, newPassword: string): Promise<void>;
  setAccessToken(accessToken: string): void;
  authenticateByName(username: string, password: string): Promise<string>;
  getServerVersion(): Promise<string>;
  getPendingRestart(): Promise<boolean>;
  getSystemConfiguration(): Promise<ServerConfigurationSchema>;
  updateSystemConfiguration(
    body: Partial<ServerConfigurationSchema>,
  ): Promise<void>;
  getEncodingConfiguration(): Promise<EncodingOptionsSchema>;
  updateEncodingConfiguration(
    body: Partial<EncodingOptionsSchema>,
  ): Promise<void>;
  getNetworkingConfiguration(): Promise<NetworkConfigurationSchema>;
  updateNetworkingConfiguration(
    body: Partial<NetworkConfigurationSchema>,
  ): Promise<void>;
  getMetadataConfiguration(): Promise<MetadataConfigurationSchema>;
  updateMetadataConfiguration(
    body: Partial<MetadataConfigurationSchema>,
  ): Promise<void>;
  getVirtualFolders(): Promise<VirtualFolderInfoSchema[]>;
  addVirtualFolder(
    name: string,
    collectionType: CollectionTypeSchema | undefined,
    body: AddVirtualFolderDtoSchema,
  ): Promise<void>;
  updateLibraryOptions(
    libraryId: string,
    body: UpdateLibraryOptionsDtoSchema,
  ): Promise<void>;
  addMediaPath(libraryName: string, path: string): Promise<void>;
  removeMediaPath(libraryName: string, path: string): Promise<void>;
  getBrandingConfiguration(): Promise<BrandingOptionsDtoSchema>;
  updateBrandingConfiguration(
    body: Partial<BrandingOptionsDtoSchema>,
  ): Promise<void>;
  getSplashscreen(): Promise<Uint8Array>;
  uploadSplashscreen(image: Uint8Array): Promise<void>;
  deleteSplashscreen(): Promise<void>;
  getUsers(): Promise<UserDtoSchema[]>;
  createUser(body: CreateUserByNameSchema): Promise<void>;
  updateUserPolicy(userId: string, body: UserPolicySchema): Promise<void>;
  updateUserConfiguration(
    userId: string,
    body: UserConfigurationSchema,
  ): Promise<void>;
  completeStartupWizard(): Promise<void>;
  getPublicSystemInfo(): Promise<PublicSystemInfoSchema>;
  updateStartupConfiguration(
    body: StartupConfigurationDtoSchema,
  ): Promise<void>;
  getStartupUser(): Promise<void>;
  updateStartupUser(body: StartupUserDtoSchema): Promise<void>;
  setRemoteAccess(body: StartupRemoteAccessDtoSchema): Promise<void>;
  getPlugins(): Promise<PluginInfoSchema[]>;
  getPackages(): Promise<PackageInfoSchema[]>;
  installPackage(name: string, options?: InstallPackageOptions): Promise<void>;
  uninstallPlugin(pluginId: string, version: string): Promise<void>;
  getPluginConfiguration(
    pluginId: string,
  ): Promise<BasePluginConfigurationSchema>;
  updatePluginConfiguration(
    pluginId: string,
    body: BasePluginConfigurationSchema,
  ): Promise<void>;
  getApiKeys(): Promise<AuthenticationInfoSchema[]>;
  createApiKey(appName: string): Promise<void>;
  getLiveTvOptions(): Promise<LiveTvOptionsSchema>;
  updateLiveTvOptions(body: LiveTvOptionsSchema): Promise<void>;
  saveTunerHost(body: TunerHostInfoSchema): Promise<void>;
  deleteTunerHost(id: string): Promise<void>;
  saveListingProvider(
    body: ListingsProviderInfoSchema,
    password?: string,
  ): Promise<void>;
  deleteListingProvider(id: string): Promise<void>;
}
