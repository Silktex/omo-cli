import type { Command } from "commander";
import kleur from "kleur";
import { loadConfig, validateConfig, saveConfig } from "../core/config.js";
import { CONFIG_PATH, OH_MY_OPENCODE_PATH } from "../constants.js";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function registerConfig(program: Command): void {
  const configCmd = program.command("config").description("Manage omoctl configuration");

  configCmd
    .command("path")
    .description("Print config file path")
    .action(() => {
      console.log(CONFIG_PATH);
    });

  configCmd
    .command("validate")
    .description("Validate current configuration")
    .action(() => {
      const config = loadConfig();
      const errors = validateConfig(config);

      // Check API keys
      const keys = {
        ALIBABA_API_KEY: process.env.ALIBABA_API_KEY,
        MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
        ZAI_API_KEY: process.env.ZAI_API_KEY,
      };

      console.log(kleur.bold("\nomoctl Configuration\n"));
      console.log(`Config file:  ${existsSync(CONFIG_PATH) ? kleur.green(CONFIG_PATH) : kleur.gray(CONFIG_PATH + " (using defaults)")}`);
      console.log(`OpenCode cfg: ${existsSync(config.ohMyOpenagentConfig) ? kleur.green(config.ohMyOpenagentConfig) : kleur.yellow(config.ohMyOpenagentConfig + " (not found)")}`);
      console.log(`Database:     ${config.database}`);

      console.log(kleur.bold("\nAPI Keys\n"));
      for (const [k, v] of Object.entries(keys)) {
        const status = v ? kleur.green("✓ set") : kleur.red("✗ missing");
        console.log(`  ${k.padEnd(20)} ${status}`);
      }

      if (errors.length > 0) {
        console.log(kleur.bold("\nErrors\n"));
        for (const e of errors) console.log(kleur.red(`  ✗ ${e}`));
        process.exit(1);
      } else {
        console.log(kleur.green("\n✓ Configuration valid\n"));
      }
    });

  // Default: open in $EDITOR
  configCmd
    .action(() => {
      if (!existsSync(CONFIG_PATH)) {
        mkdirSync(dirname(CONFIG_PATH), { recursive: true });
        const config = loadConfig();
        writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
        console.log(kleur.gray(`Created default config at ${CONFIG_PATH}`));
      }
      const editor = process.env.EDITOR ?? process.env.VISUAL ?? "nano";
      spawnSync(editor, [CONFIG_PATH], { stdio: "inherit" });
    });
}
