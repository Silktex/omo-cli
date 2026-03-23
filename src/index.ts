#!/usr/bin/env bun
import { Command } from "commander";
import { registerSet } from "./cli/set.js";
import { registerGet } from "./cli/get.js";
import { registerModels } from "./cli/models.js";
import { registerPlans } from "./cli/plans.js";
import { registerProfile } from "./cli/profile.js";
import { registerConfig } from "./cli/config-cmd.js";
import { registerProxy } from "./cli/proxy-cmd.js";

const program = new Command();

program
  .name("omoctl")
  .description("Agent model control plane for oh-my-openagent")
  .version("0.1.0")
  .option("--web", "Also start web UI on port 4242")
  .option("--web-port <port>", "Override web UI port", "4242")
  .option("--no-tui", "Skip TUI, print to stdout (for scripting)")
  .option("--json", "Output JSON instead of formatted text")
  .option("--config <path>", "Use alternate config file")
  .option("--refresh <ms>", "Override polling interval")
  .option("--theme <name>", "TUI theme (tokyo-night/dracula/nord)", "tokyo-night");

// Register all CLI commands
registerSet(program);
registerGet(program);
registerModels(program);
registerPlans(program);
registerProfile(program);
registerConfig(program);
registerProxy(program);

// monitor command (alias for default TUI launch)
program
  .command("monitor")
  .description("Launch TUI dashboard")
  .option("--web", "Also start web UI on port 4242")
  .option("--web-port <port>", "Override web UI port", "4242")
  .option("--no-tui", "Skip TUI, print JSON to stdout")
  .action(async (opts: { web?: boolean; webPort?: string; tui?: boolean }) => {
    await runDashboard({ web: opts.web, noTui: opts.tui === false });
  });

// Default action: launch TUI (or print status if --no-tui)
program.action(async (_opts: Record<string, unknown>, cmd: { opts: () => Record<string, unknown> }) => {
  const noTui = process.argv.includes("--no-tui");
  const web = process.argv.includes("--web");
  await runDashboard({ web, noTui });
});

async function runDashboard(opts: { web?: boolean; noTui?: boolean }) {
  if (opts.noTui) {
    const { getAllAssignments } = await import("./core/ohmy.js");
    const { pollAllProviders } = await import("./providers/poller.js");
    const [assignments, snapshots] = await Promise.all([
      Promise.resolve(getAllAssignments()),
      pollAllProviders(),
    ]);
    console.log(JSON.stringify({ assignments, providers: snapshots }, null, 2));
    return;
  }

  if (opts.web) {
    const { startWebServer } = await import("./web/server.js");
    const portArg = process.argv.find((_, i, arr) => arr[i - 1] === "--web-port");
    startWebServer(portArg ? parseInt(portArg) : undefined);
  }

  const { launchTui } = await import("./tui/launch.js");
  launchTui();
}

program.parse(process.argv);
