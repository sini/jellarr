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

/**
 * `secrets`, when given, collects every string that came from a `_file`
 * reference or contains a substituted `${VAR}`, so dry-run output can mask it.
 */
export async function resolveValue(
  value: unknown,
  secrets?: Set<string>,
): Promise<unknown> {
  const parsed: z.ZodSafeParseResult<FileRef> = FileRefType.safeParse(value);
  if (parsed.success) {
    const fileRef: FileRef = parsed.data;
    try {
      const filePath: string = substituteEnvVars(fileRef._file);
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
      value.map((item: unknown) => resolveValue(item, secrets)),
    );
  }

  if (typeof value === "object" && value !== null) {
    return resolveFileReferences(value as Record<string, unknown>, secrets);
  }

  // NOTE: substituted values are always strings; numeric and boolean fields cannot be set from ${VAR}.
  if (typeof value === "string") {
    const substituted: string = substituteEnvVars(value);
    if (/\$\{\w+\}/.test(value)) secrets?.add(substituted);
    return substituted;
  }

  return value;
}

async function resolveEntry(
  [key, value]: [string, unknown],
  secrets?: Set<string>,
): Promise<[string, unknown]> {
  return [key, await resolveValue(value, secrets)];
}

export async function resolveFileReferences(
  obj: Record<string, unknown>,
  secrets?: Set<string>,
): Promise<Record<string, unknown>> {
  const resolved: Array<[string, unknown]> = await Promise.all(
    Object.entries(obj).map((entry: [string, unknown]) =>
      resolveEntry(entry, secrets),
    ),
  );
  return Object.fromEntries(resolved);
}
