export interface Logger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

let secretValues: Set<string> = new Set();

/** Masks these values (resolved from `_file` or `${VAR}`) in every log line. */
export function maskSecrets(values: Set<string>): void {
  secretValues = values;
}

/** Adds one more value to the set being masked. */
export function addSecret(value: string): void {
  secretValues.add(value);
}

function masked(msg: string): string {
  let out: string = msg;
  for (const secret of secretValues) {
    if (secret === "") continue;
    out = out.split(secret).join("***");
    out = out.split(JSON.stringify(secret).slice(1, -1)).join("***");
  }
  return out;
}

export const logger: Logger = {
  info: (msg: string): void => {
    console.log(masked(msg));
  },
  warn: (msg: string): void => {
    console.warn(masked(msg));
  },
  error: (msg: string): void => {
    console.error(masked(msg));
  },
};
