#!/usr/bin/env node
import { Command, Option } from "commander";
import { runPipeline, type PipelineResult } from "../pipeline";
import { runDump } from "../dump";

interface ApplyOptions {
  configFile: string;
  waitTimeout?: number;
  dryRun?: boolean;
}

interface DumpOptions {
  baseUrl: string;
}

const program: Command = new Command();

program
  .name("jellarr")
  .description("Declarative Jellyfin configuration applier");

program
  .command("apply", { isDefault: true })
  .description("Apply configuration to Jellyfin")
  .addOption(
    new Option("--configFile <path>", "path to config file").default(
      "config/config.yml",
    ),
  )
  .addOption(
    new Option(
      "--waitTimeout <seconds>",
      "seconds to wait for Jellyfin /health (default 300, or JELLARR_WAIT_TIMEOUT)",
    ).argParser(Number),
  )
  .addOption(
    new Option(
      "--dry-run",
      "print the planned changes without changing anything (or JELLARR_DRY_RUN=1); exit 2 when changes are pending",
    ),
  )
  .action(async (opts: ApplyOptions): Promise<void> => {
    const result: PipelineResult = await runPipeline(opts.configFile, {
      ...(opts.dryRun ? { dryRun: true } : {}),
      ...(opts.waitTimeout !== undefined
        ? { waitTimeoutSeconds: opts.waitTimeout }
        : {}),
    });
    if (result.dryRun) {
      process.exitCode = result.pending ? 2 : 0;
      return;
    }
    console.log("✅ jellarr apply complete");
  });

program
  .command("dump")
  .description("[EXPERIMENTAL] Dump existing Jellyfin configuration as YAML")
  .requiredOption("--baseUrl <url>", "Jellyfin server URL")
  .action(async (opts: DumpOptions): Promise<void> => {
    await runDump(opts.baseUrl);
  });

program.parseAsync().catch((err: unknown): void => {
  console.error(err);
  process.exit(1);
});
