import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { OmoctlConfig } from "../types.js";
import { CONFIG_PATH, DB_PATH, OH_MY_OPENCODE_PATH, PROXY_LOG_PATH, REFRESH_INTERVAL_MS, WEB_PORT } from "../constants.js";

const DEFAULT_CONFIG: OmoctlConfig = {
  providers: {
    alibaba: {
      enabled: true,
      apiKey: "{env:ALIBABA_API_KEY}",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      plan: "pay-as-you-go",
    },
    minimax: {
      enabled: true,
      apiKey: "{env:MINIMAX_API_KEY}",
      baseUrl: "https://api.minimax.io/v1",
      plan: "standard",
    },
    zai: {
      enabled: true,
      apiKey: "{env:ZAI_API_KEY}",
      baseUrl: "https://api.z.ai/v1",
      plan: "glm-coding",
    },
  },
  ohMyOpenagentConfig: OH_MY_OPENCODE_PATH,
  proxyLog: PROXY_LOG_PATH,
  web: {
    port: WEB_PORT,
    host: "127.0.0.1",
    openBrowser: true,
  },
  refreshInterval: REFRESH_INTERVAL_MS,
  theme: "tokyo-night",
  alertThresholds: { warn: 0.75, critical: 0.90 },
  database: DB_PATH,
};

let _config: OmoctlConfig | null = null;

export function loadConfig(path = CONFIG_PATH): OmoctlConfig {
  if (_config) return _config;
  if (!existsSync(path)) {
    _config = DEFAULT_CONFIG;
    return _config;
  }
  try {
    const raw = readFileSync(path, "utf8");
    _config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    return _config;
  } catch {
    _config = DEFAULT_CONFIG;
    return _config;
  }
}

export function saveConfig(config: OmoctlConfig, path = CONFIG_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
  _config = config;
}

export function resolveApiKey(config: OmoctlConfig, provider: "alibaba" | "minimax" | "zai"): string | undefined {
  const raw = config.providers[provider]?.apiKey;
  if (!raw) return process.env[provider === "alibaba" ? "ALIBABA_API_KEY" : provider === "minimax" ? "MINIMAX_API_KEY" : "ZAI_API_KEY"];
  const match = raw.match(/^\{env:(.+)\}$/);
  if (match) return process.env[match[1]];
  return raw;
}

export function validateConfig(config: OmoctlConfig): string[] {
  const errors: string[] = [];
  if (!config.ohMyOpenagentConfig) errors.push("ohMyOpenagentConfig path is required");
  if (config.refreshInterval < 1000) errors.push("refreshInterval must be ≥ 1000ms");
  return errors;
}
