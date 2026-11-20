import { promises as fs } from "fs";
import type { z } from "zod";
import { FileRefType, type FileRef } from "../types/config/file-refs";

function substituteEnvVars(
  raw: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return raw.replace(/\$\$|\$\{(\w+)\}/g, (match: string, name?: string) => {
    if (match === "$$") return "$";
    const varName: string = name as string;
    const value: string | undefined = env[varName];
    if (value === undefined) {
      throw new Error(`Undefined environment variable in config: ${varName}`);
    }
    return value;
  });
}

export async function resolveValue(value: unknown): Promise<unknown> {
  const parsed: z.ZodSafeParseResult<FileRef> = FileRefType.safeParse(value);
  if (parsed.success) {
    const fileRef: FileRef = parsed.data;
    try {
      const contents: string = await fs.readFile(fileRef._file, "utf8");
      return contents.trim();
    } catch (err) {
      throw new Error(
        `Failed to read file referenced by _file: ${fileRef._file}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map(resolveValue));
  }

  if (typeof value === "object" && value !== null) {
    return resolveFileReferences(value as Record<string, unknown>);
  }

  // NOTE: substituted values are always strings; numeric and boolean fields cannot be set from ${VAR}.
  if (typeof value === "string") {
    return substituteEnvVars(value);
  }

  return value;
}

async function resolveEntry([key, value]: [string, unknown]): Promise<
  [string, unknown]
> {
  return [key, await resolveValue(value)];
}

export async function resolveFileReferences(
  obj: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const resolved: Array<[string, unknown]> = await Promise.all(
    Object.entries(obj).map(resolveEntry),
  );
  return Object.fromEntries(resolved);
}
