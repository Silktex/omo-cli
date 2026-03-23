import type { Command } from "commander";
import kleur from "kleur";
import { resolveRole } from "../core/roles.js";
import { resolveModelString } from "../core/registry.js";
import { setModelInConfig } from "../core/ohmy.js";
import { insertRoleAssignment } from "../db/queries.js";
import type { Provider } from "../types.js";
import { MODEL_REGISTRY } from "../constants.js";

export function registerSet(program: Command): void {
  program
    .command("set <role> <model>")
    .description("Assign a model to an agent role")
    .option("--no-reload", "Skip signaling OpenCode to hot-reload")
    .action((roleInput: string, modelInput: string) => {
      // Resolve role
      const role = resolveRole(roleInput);
      if (!role) {
        console.error(kleur.red(`✗ Unknown role: "${roleInput}"`));
        console.error(`  Run ${kleur.cyan("omoctl models")} to list available roles.`);
        process.exit(1);
      }

      // Resolve model string
      const { modelString, model } = resolveModelString(modelInput);

      // Write to config
      try {
        setModelInConfig(role.section, role.key, modelString);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(kleur.red(`✗ Failed to update config: ${msg}`));
        process.exit(1);
      }

      // Log to DB
      try {
        const provider = model?.provider ?? inferProvider(modelString);
        insertRoleAssignment({
          role: role.key,
          model: modelString,
          provider: provider as Provider,
          assignedAt: new Date().toISOString(),
          assignedBy: "cli",
        });
      } catch { /* non-fatal — DB write failure shouldn't block the user */ }

      console.log(
        kleur.green("✓") +
        ` ${kleur.bold(role.displayName)} → ${kleur.cyan(modelString)}` +
        (model ? kleur.gray(` (${model.provider}, ${model.tier})`) : ""),
      );
    });
}

function inferProvider(modelString: string): Provider {
  if (modelString.startsWith("alibaba") || modelString.startsWith("qwen") || modelString.startsWith("kimi")) return "alibaba";
  if (modelString.startsWith("minimax") || modelString.includes("MiniMax")) return "minimax";
  if (modelString.startsWith("zai") || modelString.startsWith("glm") || modelString.startsWith("z1")) return "zai";
  return "alibaba";
}
