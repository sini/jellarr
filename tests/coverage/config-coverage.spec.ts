import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  SystemConfigType,
  MetadataOptionsConfigType,
  ContentTypeConfigType,
  PathSubstitutionConfigType,
  CastReceiverApplicationConfigType,
  TrickplayOptionsConfigType,
  PluginRepositoryConfigType,
} from "../../src/types/config/system";
import { EncodingOptionsConfigType } from "../../src/types/config/encoding-options";
import { NetworkingConfigType } from "../../src/types/config/networking";
import { MetadataConfigType } from "../../src/types/config/metadata";
import {
  LiveTvConfigType,
  TunerHostConfigType,
  ListingProviderConfigType,
} from "../../src/types/config/livetv";
import { BrandingOptionsConfigType } from "../../src/types/config/branding-options";
import { LibraryOptionsConfigType } from "../../src/types/config/library";
import {
  UserConfigType,
  UserPolicyConfigType,
  AccessScheduleConfigType,
} from "../../src/types/config/users";
import { TaskTriggerConfigType } from "../../src/types/config/scheduled-tasks";
import {
  StartupConfigType,
  StartupRemoteAccessConfigType,
  StartupUserConfigType,
} from "../../src/types/config/startup";
import {
  ENDPOINT_EXCLUSIONS,
  FIELD_EXCLUSIONS,
  PENDING_ENDPOINTS,
  PENDING_FIELDS,
} from "./exclusions";

const ROOT: string = resolve(__dirname, "../..");
const SCHEMA: string = resolve(ROOT, "generated/schema.d.ts");

/** Unwraps optional/nullable/array wrappers down to the object schema. */
function objectOf(schema: z.ZodType): z.ZodObject {
  let current: z.ZodType = schema;
  for (;;) {
    if (current instanceof z.ZodObject) return current;
    if (current instanceof z.ZodArray) current = current.element as z.ZodType;
    else if (
      current instanceof z.ZodOptional ||
      current instanceof z.ZodNullable
    )
      current = current.unwrap() as z.ZodType;
    else throw new Error("not an object schema");
  }
}

function keysOf(schema: z.ZodType): Set<string> {
  return new Set(Object.keys(objectOf(schema).shape));
}

interface Target {
  dto: string;
  keys: Set<string>;
}

const targets: Target[] = (
  [
    ["ServerConfiguration", SystemConfigType],
    ["EncodingOptions", EncodingOptionsConfigType],
    ["NetworkConfiguration", NetworkingConfigType],
    ["MetadataConfiguration", MetadataConfigType],
    ["LiveTvOptions", LiveTvConfigType],
    ["BrandingOptionsDto", BrandingOptionsConfigType],
    ["LibraryOptions", LibraryOptionsConfigType],
    ["UserPolicy", UserPolicyConfigType],
    ["UserConfiguration", UserConfigType],
    ["TaskTriggerInfo", TaskTriggerConfigType],
    ["TunerHostInfo", TunerHostConfigType],
    ["ListingsProviderInfo", ListingProviderConfigType],
    ["StartupConfigurationDto", StartupConfigType],
    ["StartupUserDto", StartupUserConfigType],
    ["StartupRemoteAccessDto", StartupRemoteAccessConfigType],
    ["TypeOptions", objectOf(LibraryOptionsConfigType).shape.typeOptions],
    ["MetadataOptions", MetadataOptionsConfigType],
    ["TrickplayOptions", TrickplayOptionsConfigType],
    ["PathSubstitution", PathSubstitutionConfigType],
    ["CastReceiverApplication", CastReceiverApplicationConfigType],
    ["NameValuePair", ContentTypeConfigType],
    ["RepositoryInfo", PluginRepositoryConfigType],
    ["AccessSchedule", AccessScheduleConfigType],
    ["MediaPathInfo", objectOf(LibraryOptionsConfigType).shape.pathInfos],
  ] as Array<[string, z.ZodType]>
).map(([dto, schema]: [string, z.ZodType]): Target => ({
  dto,
  keys: keysOf(schema),
}));

/** DTOs with no jellarr schema yet; each field is judged against the exclusion lists. */
const UNCOVERED_DTOS: string[] = [
  "XbmcMetadataOptions",
  "DatabaseConfigurationOptions",
  "ImageOption",
  "DisplayPreferencesDto",
  "DeviceOptionsDto",
];

function schemaSource(): ts.SourceFile {
  return ts.createSourceFile(
    SCHEMA,
    readFileSync(SCHEMA, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
}

/** Writable (non-readonly) property names of components["schemas"][dto]. */
function writableFields(): Map<string, string[]> {
  const source: ts.SourceFile = schemaSource();
  const out: Map<string, string[]> = new Map();
  ts.forEachChild(source, (node: ts.Node): void => {
    if (!ts.isInterfaceDeclaration(node) || node.name.text !== "components")
      return;
    for (const member of node.members) {
      if (
        !ts.isPropertySignature(member) ||
        member.name.getText() !== "schemas"
      )
        continue;
      const literal: ts.TypeLiteralNode = member.type as ts.TypeLiteralNode;
      for (const dto of literal.members) {
        if (!ts.isPropertySignature(dto) || !dto.type) continue;
        if (!ts.isTypeLiteralNode(dto.type)) continue;
        const fields: string[] = [];
        for (const field of dto.type.members) {
          if (!ts.isPropertySignature(field)) continue;
          const readonly: boolean =
            field.modifiers?.some(
              (m: ts.ModifierLike): boolean =>
                m.kind === ts.SyntaxKind.ReadonlyKeyword,
            ) ?? false;
          if (!readonly) fields.push(field.name.getText());
        }
        out.set(dto.name.getText(), fields);
      }
    }
  });
  return out;
}

const lowerFirst: (name: string) => string = (name: string): string =>
  name.charAt(0).toLowerCase() + name.slice(1);

/** Config keys a DTO field may be declared under. */
const ALIASES: Record<string, string> = {
  "ServerConfiguration.UICulture": "uiCulture",
  "StartupConfigurationDto.UICulture": "uiCulture",
  "LiveTvOptions.SaveRecordingNFO": "saveRecordingNfo",
  "LibraryOptions.EnableEmbeddedExtrasTitles": "enableEmbeddedExtraTitles",
  "UserPolicy.EnableContentDeletionFromFolders":
    "enableContentDeletionFromLibraries",
  "UserPolicy.EnabledFolders": "enabledLibraries",
  "UserPolicy.BlockedMediaFolders": "blockedMediaLibraries",
  "UserConfiguration.GroupedFolders": "groupedLibraries",
  "UserConfiguration.OrderedViews": "orderedLibraries",
  "UserConfiguration.LatestItemsExcludes": "latestItemsExcludedLibraries",
  "UserConfiguration.MyMediaExcludes": "myMediaExcludedLibraries",
  "TunerHostInfo.AllowHWTranscoding": "allowHwTranscoding",
};

interface Verdict {
  covered: string[];
  excluded: string[];
  pending: string[];
  missing: string[];
}

function judge(): Verdict {
  const dtos: Map<string, string[]> = writableFields();
  const verdict: Verdict = {
    covered: [],
    excluded: [],
    pending: [],
    missing: [],
  };
  const all: Array<[string, Set<string> | undefined]> = [
    ...targets.map((t: Target): [string, Set<string>] => [t.dto, t.keys]),
    ...UNCOVERED_DTOS.map((d: string): [string, undefined] => [d, undefined]),
  ];
  for (const [dto, keys] of all) {
    const fields: string[] | undefined = dtos.get(dto);
    if (!fields) throw new Error(`DTO ${dto} is not in the schema`);
    for (const field of fields) {
      const id: string = `${dto}.${field}`;
      const key: string = ALIASES[id] ?? lowerFirst(field);
      if (Object.hasOwn(FIELD_EXCLUSIONS, id)) verdict.excluded.push(id);
      else if (Object.hasOwn(PENDING_FIELDS, id)) {
        if (keys?.has(key)) verdict.missing.push(`stale pending ${id}`);
        else verdict.pending.push(id);
      } else if (keys?.has(key)) verdict.covered.push(id);
      else verdict.missing.push(id);
    }
  }
  return verdict;
}

/** POST and DELETE operations of the OpenAPI document. */
function writeEndpoints(): string[] {
  const source: ts.SourceFile = schemaSource();
  const out: string[] = [];
  ts.forEachChild(source, (node: ts.Node): void => {
    if (!ts.isInterfaceDeclaration(node) || node.name.text !== "paths") return;
    for (const path of node.members) {
      if (!ts.isPropertySignature(path) || !path.type) continue;
      if (!ts.isTypeLiteralNode(path.type)) continue;
      const name: string = path.name.getText().replace(/^"|"$/g, "");
      for (const method of path.type.members) {
        if (!ts.isPropertySignature(method)) continue;
        const verb: string = method.name.getText();
        const typed: string = method.type?.getText() ?? "";
        if ((verb === "post" || verb === "delete") && typed !== "never")
          out.push(`${verb.toUpperCase()} ${name}`);
      }
    }
  });
  return out;
}

/** The configuration write endpoints: everything else is content or runtime. */
const CONFIG_ENDPOINT_PREFIXES: RegExp[] = [
  /^POST \/System\/Configuration/,
  /^(POST|DELETE) \/Branding\/Splashscreen$/,
  /^(POST|DELETE) \/Library\/VirtualFolders/,
  /^POST \/Users\/(New|\{userId\}\/Policy|Configuration|Password)$/,
  /^DELETE \/Users\/\{userId\}$/,
  /^POST \/Users$/,
  /^(POST|DELETE) \/UserImage$/,
  /^POST \/DisplayPreferences\//,
  /^POST \/Packages\/Installed\//,
  /^DELETE \/Plugins\//,
  /^POST \/Plugins\/\{pluginId\}\/(Configuration|\{version\}\/(Enable|Disable))$/,
  /^POST \/Repositories$/,
  /^POST \/ScheduledTasks\/\{taskId\}\/Triggers$/,
  /^(POST|DELETE) \/Auth\/Keys/,
  /^POST \/Startup\//,
  /^(POST|DELETE) \/LiveTv\/(TunerHosts|ListingProviders)$/,
  /^POST \/LiveTv\/ChannelMappings$/,
  /^POST \/Devices\/Options$/,
];

function calledEndpoints(): Set<string> {
  const text: string = readFileSync(
    resolve(ROOT, "src/api/jellyfin_client.ts"),
    "utf8",
  );
  const out: Set<string> = new Set();
  for (const m of text.matchAll(/\b\w+\.(GET|POST|DELETE)\(\s*"([^"]+)"/g))
    out.add(`${m[1]} ${m[2]}`);
  return out;
}

describe("configuration coverage", (): void => {
  const verdict: Verdict = judge();
  const total: number =
    verdict.covered.length +
    verdict.excluded.length +
    verdict.pending.length +
    verdict.missing.length;

  it("reports the field figures", (): void => {
    console.info(
      `fields: ${String(verdict.covered.length)} covered, ${String(verdict.excluded.length)} excluded, ${String(verdict.pending.length)} pending, ${String(verdict.missing.length)} undecided, of ${String(total)}`,
    );
  });

  it("decides every writable configuration field", (): void => {
    expect(verdict.missing).toEqual([]);
  });

  it("keeps every exclusion live", (): void => {
    const dtos: Map<string, string[]> = writableFields();
    const real: Set<string> = new Set(
      [...dtos].flatMap(([d, fs]: [string, string[]]): string[] =>
        fs.map((f: string): string => `${d}.${f}`),
      ),
    );
    for (const id of [
      ...Object.keys(FIELD_EXCLUSIONS),
      ...Object.keys(PENDING_FIELDS),
    ]) {
      expect(real.has(id), `stale exclusion ${id}`).toBe(true);
    }
    for (const id of Object.keys(FIELD_EXCLUSIONS))
      expect(FIELD_EXCLUSIONS[id].length, id).toBeGreaterThan(5);
  });

  it("calls or excludes every configuration endpoint", (): void => {
    const called: Set<string> = calledEndpoints();
    const config: string[] = writeEndpoints().filter((e: string): boolean =>
      CONFIG_ENDPOINT_PREFIXES.some((re: RegExp): boolean => re.test(e)),
    );
    const open: string[] = config.filter(
      (e: string): boolean =>
        !called.has(e) &&
        !Object.hasOwn(ENDPOINT_EXCLUSIONS, e) &&
        !Object.hasOwn(PENDING_ENDPOINTS, e),
    );
    const nCalled: number = config.filter((e: string): boolean =>
      called.has(e),
    ).length;
    console.info(
      `endpoints: ${String(nCalled)} called, ${String(Object.keys(ENDPOINT_EXCLUSIONS).length)} excluded, ${String(Object.keys(PENDING_ENDPOINTS).length)} pending, of ${String(config.length)}`,
    );
    expect(open).toEqual([]);
  });
});
