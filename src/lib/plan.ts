import { deepEqual } from "fast-equals";
import { logger } from "./logger";

const MASK: string = "***";
const CREDENTIAL_KEY: RegExp =
  /pass(word)?|secret|token|api_?key|credential|private/i;

/** Server-side values are masked by field name, since only config-derived secrets are known. */
function isCredential(key: string, value: unknown): boolean {
  return typeof value === "string" && value !== "" && CREDENTIAL_KEY.test(key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Collects what a dry run would change, as "path: current → desired" lines.
 * Strings in `secrets` (resolved from `_file` or `${VAR}`) are printed as ***.
 */
export class Plan {
  pending: boolean = false;

  constructor(private readonly secrets: ReadonlySet<string> = new Set()) {}

  private show(value: unknown): string {
    if (value === undefined) return "(unset)";
    return JSON.stringify(value, (key: string, leaf: unknown): unknown =>
      (typeof leaf === "string" && this.secrets.has(leaf)) ||
      isCredential(key, leaf)
        ? MASK
        : leaf,
    );
  }

  private walk(path: string, current: unknown, next: unknown): string[] {
    if (isPlainObject(next) && isPlainObject(current)) {
      return Object.entries(next).flatMap(([key, value]: [string, unknown]) =>
        this.walk(`${path}.${key}`, current[key], value),
      );
    }
    if (deepEqual(current, next)) return [];
    const leafKey: string = path.split(".").at(-1) ?? "";
    if (
      (typeof next === "string" && this.secrets.has(next)) ||
      isCredential(leafKey, next)
    ) {
      return [`  ${path}: ${MASK} → ${MASK}`];
    }
    return [`  ${path}: ${this.show(current)} → ${this.show(next)}`];
  }

  /** Records the differences between a section's current and planned state. */
  change(section: string, current: unknown, next: unknown): void {
    const lines: string[] = this.walk(section, current, next);
    if (lines.length === 0) return;
    this.pending = true;
    lines.forEach((line: string) => {
      logger.info(line);
    });
  }

  /** Records a pending action that is not a field diff. */
  action(text: string): void {
    this.pending = true;
    logger.info(`  ${text}`);
  }

  /** Records information that does not count as a pending change. */
  note(text: string): void {
    logger.info(`  ${text}`);
  }
}
