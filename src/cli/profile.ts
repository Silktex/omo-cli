import type { Command } from "commander";
import kleur from "kleur";
import { listProfiles, getProfile, saveProfile, deleteProfile } from "../core/profiles.js";
import { getAllAssignments } from "../core/ohmy.js";
import { setModelInConfig } from "../core/ohmy.js";
import { resolveRole } from "../core/roles.js";
import { resolveModelString } from "../core/registry.js";
import { AGENT_ROLES } from "../constants.js";

export function registerProfile(program: Command): void {
  // omoctl use <profile>
  program
    .command("use <profile>")
    .description("Apply a saved profile to all roles")
    .action((name: string) => {
      const profile = getProfile(name);
      if (!profile) {
        console.error(kleur.red(`✗ Profile "${name}" not found.`));
        console.log(`  Available: ${listProfiles().map(p => p.name).join(", ") || "(none)"}`);
        process.exit(1);
      }

      let count = 0;
      for (const [roleKey, modelInput] of Object.entries(profile.assignments)) {
        const role = resolveRole(roleKey);
        if (!role) continue;
        const { modelString } = resolveModelString(modelInput);
        try {
          setModelInConfig(role.section, role.key, modelString);
          count++;
          console.log(`  ${kleur.green("✓")} ${role.key.padEnd(22)} → ${kleur.cyan(modelString)}`);
        } catch (err: unknown) {
          console.error(`  ${kleur.red("✗")} ${role.key}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      console.log(kleur.green(`\n✓ Applied profile "${name}" (${count} roles updated)\n`));
    });

  // omoctl profile <subcommand>
  const profileCmd = program.command("profile").description("Manage role profiles");

  profileCmd
    .command("save <name>")
    .description("Save current role assignments as a named profile")
    .action((name: string) => {
      const assignments = getAllAssignments();
      saveProfile(name, assignments);
      console.log(kleur.green(`✓ Profile "${name}" saved (${Object.keys(assignments).length} roles)`));
    });

  profileCmd
    .command("list")
    .description("List all saved profiles")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      const profiles = listProfiles();
      if (opts.json) {
        console.log(JSON.stringify(profiles, null, 2));
        return;
      }
      if (profiles.length === 0) {
        console.log(kleur.gray("No profiles saved. Use `omoctl profile save <name>`."));
        return;
      }
      console.log(kleur.bold("\nSaved Profiles\n"));
      for (const p of profiles) {
        const count = Object.keys(p.assignments).length;
        console.log(`  ${kleur.cyan(p.name.padEnd(20))} ${count} roles  ${kleur.gray(p.updatedAt.slice(0, 10))}`);
      }
      console.log();
    });

  profileCmd
    .command("show <name>")
    .description("Show a profile's assignments")
    .action((name: string) => {
      const profile = getProfile(name);
      if (!profile) {
        console.error(kleur.red(`✗ Profile "${name}" not found.`));
        process.exit(1);
      }
      console.log(kleur.bold(`\nProfile: ${profile.name}\n`));
      for (const [role, model] of Object.entries(profile.assignments)) {
        console.log(`  ${role.padEnd(22)} ${kleur.cyan(model)}`);
      }
      console.log();
    });

  profileCmd
    .command("delete <name>")
    .description("Delete a saved profile")
    .action((name: string) => {
      const deleted = deleteProfile(name);
      if (deleted) {
        console.log(kleur.green(`✓ Profile "${name}" deleted.`));
      } else {
        console.error(kleur.red(`✗ Profile "${name}" not found.`));
        process.exit(1);
      }
    });
}
