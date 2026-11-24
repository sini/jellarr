import { promises as fs } from "fs";
import type { z } from "zod";
import { FileRefType, type FileRef } from "../types/config/file-refs";

function substituteEnvVars(
  raw: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return raw.replace(/\$\$\{|\$\{(\w+)\}/g, (match: string, name?: string) => {
    if (match === "$${") return "${";
    const varName: string = name as string;
    const value: string | undefined = env[varName];
    if (value === undefined) {
      throw new Error(`Undefined environment variable in config: ${varName}`);
    }
    return value;
  });
}

export interface ResolveOptions {
  /** Collects every string that came from a `_file` reference or a substituted `${VAR}`, so dry-run output can mask it. */
  secrets?: Set<string>;
  /** Expand `${VAR}` (and `$${`) in strings. Off by default: strings pass through untouched. `_file` references are always resolved. */
  expandEnv?: boolean;
}

export async function resolveValue(
  value: unknown,
  options: ResolveOptions = {},
): Promise<unknown> {
  const { secrets, expandEnv }: ResolveOptions = options;
  const parsed: z.ZodSafeParseResult<FileRef> = FileRefType.safeParse(value);
  if (parsed.success) {
    const fileRef: FileRef = parsed.data;
    try {
      const filePath: string = expandEnv
        ? substituteEnvVars(fileRef._file)
        : fileRef._file;
      const contents: string = await fs.readFile(filePath, "utf8");
      const fileValue: string = contents.trim();
      secrets?.add(fileValue);
      return fileValue;
    } catch (err) {
      throw new Error(
        `Failed to read file referenced by _file: ${fileRef._file}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (Array.isArray(value)) {
    return Promise.all(
      value.map((item: unknown) => resolveValue(item, options)),
    );
  }

  if (typeof value === "object" && value !== null) {
    return resolveFileReferences(value as Record<string, unknown>, options);
  }

  // NOTE: substituted values are always strings; numeric and boolean fields cannot be set from ${VAR}.
  if (typeof value === "string" && expandEnv) {
    const substituted: string = substituteEnvVars(value);
    if (/\$\{\w+\}/.test(value)) secrets?.add(substituted);
    return substituted;
  }

  return value;
}

async function resolveEntry(
  [key, value]: [string, unknown],
  options: ResolveOptions,
): Promise<[string, unknown]> {
  if (key.endsWith("File") && FileRefType.safeParse(value).success) {
    throw new Error(
      `'${key}' is a path, not a secret: use a plain path (\${VAR} is allowed with expandEnv), not { _file }`,
    );
  }
  return [key, await resolveValue(value, options)];
}

export async function resolveFileReferences(
  obj: Record<string, unknown>,
  options: ResolveOptions = {},
): Promise<Record<string, unknown>> {
  const resolved: Array<[string, unknown]> = await Promise.all(
    Object.entries(obj).map((entry: [string, unknown]) =>
      resolveEntry(entry, options),
    ),
  );
  return Object.fromEntries(resolved);
}
