import { readFileSync } from "node:fs";

export function resolveApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const direct: string | undefined = env.JELLARR_API_KEY || undefined;
  const file: string | undefined = env.JELLARR_API_KEY_FILE || undefined;
  if (direct && file) {
    throw new Error(
      "JELLARR_API_KEY and JELLARR_API_KEY_FILE are both set: use only one",
    );
  }
  if (!file) {
    return direct;
  }
  return readFileSync(file, "utf8").trim() || undefined;
}
