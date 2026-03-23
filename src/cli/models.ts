import type { Command } from "commander";
import kleur from "kleur";
import { filterModels, getConfiguredProviders } from "../core/registry.js";
import { PROVIDER_INFO } from "../constants.js";
import type { Provider } from "../types.js";

export function registerModels(program: Command): void {
  program
    .command("models")
    .description("List known models")
    .option("--provider <name>", "Filter by provider (alibaba, minimax, zai)")
    .option("--tier <tier>", "Filter by tier (smart, fast, deep)")
    .option("--available", "Only show models with configured API keys")
    .option("--json", "Output as JSON")
    .action((opts: { provider?: string; tier?: string; available?: boolean; json?: boolean }) => {
      const configuredKeys = getConfiguredProviders(process.env);
      const models = filterModels({
        provider: opts.provider,
        tier: opts.tier,
        available: opts.available,
        configuredKeys,
      });

      if (opts.json) {
        console.log(JSON.stringify(models, null, 2));
        return;
      }

      if (models.length === 0) {
        console.log(kleur.gray("No models match the given filters."));
        return;
      }

      console.log(kleur.bold(`\n${"Alias".padEnd(20)} ${"Model ID".padEnd(28)} ${"Provider".padEnd(10)} ${"Tier".padEnd(7)} ${"Context".padEnd(10)} ${"Cost/1M in"}\n`));

      for (const m of models) {
        const providerName = PROVIDER_INFO[m.provider as Provider]?.name ?? m.provider;
        const ctx = m.contextWindow ? `${(m.contextWindow / 1000).toFixed(0)}k` : "—";
        const cost = m.costPer1MInput !== undefined ? `$${m.costPer1MInput.toFixed(2)}` : "—";
        const avail = configuredKeys.has(m.provider) ? kleur.green("✓") : kleur.gray("·");
        const tierColor = m.tier === "smart" ? kleur.yellow : m.tier === "fast" ? kleur.cyan : kleur.magenta;

        console.log(
          `${avail} ${m.alias.padEnd(19)} ${m.modelId.padEnd(28)} ${m.provider.padEnd(10)} ${tierColor(m.tier.padEnd(7))} ${ctx.padEnd(10)} ${cost}`,
        );
      }
      console.log();
      console.log(kleur.gray(`${models.length} model(s). ✓ = API key configured\n`));
    });
}
