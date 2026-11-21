import { readFileSync } from "node:fs";

function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value;
}

export function resolveApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const direct: string | undefined = nonEmpty(env.JELLARR_API_KEY);
  const file: string | undefined = nonEmpty(env.JELLARR_API_KEY_FILE);
  if (direct !== undefined && file !== undefined) {
    throw new Error(
      "JELLARR_API_KEY and JELLARR_API_KEY_FILE are both set: use only one",
    );
  }
  if (file === undefined) {
    return direct;
  }
  return nonEmpty(readFileSync(file, "utf8").trim());
}
