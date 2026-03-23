import type { Command } from "commander";
import kleur from "kleur";
import { getAllAssignments, getCurrentModel } from "../core/ohmy.js";
import { resolveRole } from "../core/roles.js";
import { AGENT_ROLES } from "../constants.js";

export function registerGet(program: Command): void {
  program
    .command("get [role]")
    .description("Show current model assignment(s)")
    .option("--json", "Output as JSON")
    .action((roleInput: string | undefined, opts: { json?: boolean }) => {
      if (roleInput) {
        // Single role
        const role = resolveRole(roleInput);
        if (!role) {
          console.error(kleur.red(`✗ Unknown role: "${roleInput}"`));
          process.exit(1);
        }
        const model = getCurrentModel(role.section, role.key);
        if (opts.json) {
          console.log(JSON.stringify({ role: role.key, model: model ?? null }));
        } else {
          console.log(`${kleur.bold(role.displayName.padEnd(20))} ${kleur.cyan(model ?? kleur.gray("(not set)"))}`);
        }
      } else {
        // All roles
        const assignments = getAllAssignments();
        if (opts.json) {
          console.log(JSON.stringify(assignments, null, 2));
          return;
        }
        console.log(kleur.bold("\nAgent Role Assignments\n"));
        for (const role of AGENT_ROLES) {
          const model = assignments[role.key];
          const section = role.section === "categories" ? kleur.gray("[cat]") : kleur.gray("[agt]");
          console.log(
            `  ${section} ${role.key.padEnd(22)} ${model ? kleur.cyan(model) : kleur.gray("(not set)")}`,
          );
        }
        console.log();
      }
    });
}
