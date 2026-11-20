let dryRun: boolean = false;

/** Whether this run only reports what it would do. */
export function setDryRun(on: boolean): void {
  dryRun = on;
}

/** The wording of a step's log line: `would` in a dry run, `done` otherwise. */
export function say(done: string, would: string): string {
  return dryRun ? would : done;
}
