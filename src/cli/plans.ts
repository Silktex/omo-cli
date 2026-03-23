import type { Command } from "commander";
import kleur from "kleur";
import { pollAllProviders, pollAlibaba, pollMinimax, pollZai } from "../providers/poller.js";
import { getLatestSnapshot } from "../db/queries.js";
import { PROVIDER_INFO } from "../constants.js";
import type { Provider, ProviderSnapshot } from "../types.js";

export function registerPlans(program: Command): void {
  program
    .command("plans")
    .description("Show coding plan quota for all providers")
    .option("--json", "Output raw JSON")
    .option("--provider <name>", "Show single provider")
    .action(async (opts: { json?: boolean; provider?: string }) => {
      let snapshots: Record<string, ProviderSnapshot>;

      if (opts.provider) {
        const p = opts.provider.toLowerCase() as Provider;
        const poll = p === "alibaba" ? pollAlibaba : p === "minimax" ? pollMinimax : pollZai;
        snapshots = { [p]: await poll() };
      } else {
        snapshots = await pollAllProviders();
      }

      if (opts.json) {
        console.log(JSON.stringify(snapshots, null, 2));
        return;
      }

      for (const [provider, snap] of Object.entries(snapshots)) {
        printProviderPlan(provider as Provider, snap);
      }
    });

  program
    .command("status")
    .description("Print current provider status")
    .option("--provider <name>", "Single provider")
    .option("--json", "Output JSON")
    .action(async (opts: { provider?: string; json?: boolean }) => {
      const providers: Provider[] = opts.provider
        ? [opts.provider.toLowerCase() as Provider]
        : ["alibaba", "minimax", "zai"];

      const results: Record<string, ProviderSnapshot | null> = {};
      for (const p of providers) {
        results[p] = getLatestSnapshot(p);
      }

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      for (const [p, snap] of Object.entries(results)) {
        if (!snap) {
          console.log(kleur.gray(`${p}: no data (run \`omoctl plans\` to fetch)`));
        } else {
          const info = PROVIDER_INFO[p as Provider];
          const age = Math.round((Date.now() - new Date(snap.sampledAt).getTime()) / 60000);
          const tag = snap.isEstimated ? kleur.yellow(" [estimated]") : "";
          console.log(`${kleur.bold(info?.name ?? p)}${tag} — last polled ${age}m ago`);
          if (snap.error) console.log(kleur.red(`  Error: ${snap.error}`));
        }
      }
    });
}

function printProviderPlan(provider: Provider, snap: ProviderSnapshot): void {
  const info = PROVIDER_INFO[provider];
  const title = info?.name ?? provider;
  const estimated = snap.isEstimated ? kleur.yellow(" [estimated]") : "";
  const error = snap.error ? kleur.red(` ⚠ ${snap.error}`) : "";

  console.log(`\n${kleur.bold("═".repeat(50))}`);
  console.log(`${kleur.bold(title)}${estimated}${error}`);
  if (snap.planName) console.log(kleur.gray(`Plan: ${snap.planName}`));
  console.log(kleur.bold("─".repeat(50)));

  const rows: [string, string | undefined, string | undefined][] = [
    ["RPM", snap.rpmUsed?.toString(), snap.rpmLimit?.toString()],
    ["RPD", snap.rpdUsed?.toLocaleString(), snap.rpdLimit?.toLocaleString()],
    ["TPM", snap.tpmUsed?.toLocaleString(), snap.tpmLimit?.toLocaleString()],
    ["TPD", snap.tpdUsed?.toLocaleString(), snap.tpdLimit?.toLocaleString()],
  ];

  console.log(`${"Quota".padEnd(8)} ${"Used".padEnd(15)} ${"Limit".padEnd(15)} ${"Pct"}`);
  for (const [label, used, limit] of rows) {
    if (!used && !limit) continue;
    const pct = used && limit ? Math.round(parseInt(used.replace(/,/g, "")) / parseInt(limit.replace(/,/g, "")) * 100) : null;
    const bar = pct !== null ? gauge(pct) : "";
    console.log(`${label.padEnd(8)} ${(used ?? "—").padEnd(15)} ${(limit ?? "—").padEnd(15)} ${bar}`);
  }

  if (snap.spendToday !== undefined) console.log(`\nSpend today:  $${snap.spendToday.toFixed(2)}`);
  if (snap.spendMonth !== undefined) console.log(`Spend month:  $${snap.spendMonth.toFixed(2)}`);
  if (snap.quotaResetsAt) {
    const resetsIn = Math.round((new Date(snap.quotaResetsAt).getTime() - Date.now()) / 3600000);
    console.log(kleur.gray(`Resets in: ~${resetsIn}h`));
  }
}

function gauge(pct: number): string {
  const filled = Math.round(pct / 5);
  const empty = 20 - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  const color = pct >= 90 ? kleur.red : pct >= 75 ? kleur.yellow : kleur.green;
  return `${color(bar)} ${pct}%`;
}
