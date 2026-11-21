import type { components } from "../../../generated/schema";

export type ServerConfigurationSchema =
  components["schemas"]["ServerConfiguration"];

export type PluginRepositorySchema = NonNullable<
  ServerConfigurationSchema["PluginRepositories"]
>[number];

export type TrickplayOptionsSchema = NonNullable<
  ServerConfigurationSchema["TrickplayOptions"]
>;

export type MetadataOptionsSchema = NonNullable<
  ServerConfigurationSchema["MetadataOptions"]
>[number];

export type ContentTypeSchema = NonNullable<
  ServerConfigurationSchema["ContentTypes"]
>[number];

export type PathSubstitutionSchema = NonNullable<
  ServerConfigurationSchema["PathSubstitutions"]
>[number];

export type CastReceiverApplicationSchema = NonNullable<
  ServerConfigurationSchema["CastReceiverApplications"]
>[number];
