import Fuse from "fuse.js";
import type { ModelInfo, Provider, ModelTier } from "../types.js";
import { MODEL_REGISTRY, PROVIDER_INFO } from "../constants.js";

const fuse = new Fuse(MODEL_REGISTRY, {
  keys: ["alias", "modelId"],
  threshold: 0.4,
  includeScore: true,
});

export function resolveModel(input: string): ModelInfo | undefined {
  // Exact match first
  const exact = MODEL_REGISTRY.find(m => m.alias === input || m.modelId === input);
  if (exact) return exact;
  // Fuzzy match
  const results = fuse.search(input);
  return results[0]?.item;
}

/** Build the full provider-prefixed model string for oh-my-opencode.json */
export function buildModelString(model: ModelInfo): string {
  const prefix = providerPrefix(model.provider);
  return `${prefix}/${model.modelId}`;
}

/** Accept either a bare alias, a full `provider/model`, or a registry match */
export function resolveModelString(input: string): { modelString: string; model?: ModelInfo } {
  // Already in provider/model format
  if (input.includes("/")) return { modelString: input };

  const model = resolveModel(input);
  if (model) return { modelString: buildModelString(model), model };

  // Unknown alias — pass through as-is (user knows what they're doing)
  return { modelString: input };
}

function providerPrefix(provider: Provider): string {
  const map: Record<Provider, string> = {
    alibaba: "alibaba-coding-plan",
    minimax: "minimax-coding-plan",
    zai: "zai-coding-plan",
  };
  return map[provider];
}

export function filterModels(opts: {
  provider?: string;
  tier?: string;
  available?: boolean;
  configuredKeys?: Set<string>;
}): ModelInfo[] {
  let list = [...MODEL_REGISTRY];

  if (opts.provider) {
    const p = opts.provider.toLowerCase();
    list = list.filter(m =>
      m.provider === p ||
      PROVIDER_INFO[m.provider as Provider]?.name.toLowerCase().includes(p)
    );
  }
  if (opts.tier) {
    list = list.filter(m => m.tier === (opts.tier as ModelTier));
  }
  if (opts.available && opts.configuredKeys) {
    list = list.filter(m => opts.configuredKeys!.has(m.provider));
  }
  return list;
}

export function getConfiguredProviders(env: NodeJS.ProcessEnv = process.env): Set<Provider> {
  const set = new Set<Provider>();
  if (env.ALIBABA_API_KEY) set.add("alibaba");
  if (env.MINIMAX_API_KEY) set.add("minimax");
  if (env.ZAI_API_KEY) set.add("zai");
  return set;
}
