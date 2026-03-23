import type { AgentRole, ModelInfo } from "./types.js";
import os from "node:os";
import path from "node:path";

export const CONFIG_DIR = path.join(os.homedir(), ".config", "omoctl");
export const DATA_DIR = path.join(os.homedir(), ".local", "share", "omoctl");
export const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
export const PROFILES_PATH = path.join(CONFIG_DIR, "profiles.json");
export const DB_PATH = path.join(DATA_DIR, "data.db");
export const OH_MY_OPENCODE_PATH = path.join(os.homedir(), ".config", "opencode", "oh-my-opencode.json");
export const PROXY_LOG_PATH = path.join(os.homedir(), ".config", "opencode", "proxy.log");
export const PROXY_URL = "http://localhost:4141";
export const WEB_PORT = 4242;
export const REFRESH_INTERVAL_MS = 30_000;

// Agent role registry
export const AGENT_ROLES: AgentRole[] = [
  { key: "sisyphus", aliases: ["sis"], displayName: "Sisyphus", purpose: "Main orchestrator", section: "agents" },
  { key: "hephaestus", aliases: ["heph"], displayName: "Hephaestus", purpose: "Autonomous deep worker", section: "agents" },
  { key: "prometheus", aliases: ["pro"], displayName: "Prometheus", purpose: "Strategic planner", section: "agents" },
  { key: "oracle", aliases: [], displayName: "Oracle", purpose: "Architecture / debugging", section: "agents" },
  { key: "librarian", aliases: ["lib"], displayName: "Librarian", purpose: "Docs / code search", section: "agents" },
  { key: "explore", aliases: [], displayName: "Explore", purpose: "Fast codebase grep", section: "agents" },
  { key: "atlas", aliases: [], displayName: "Atlas", purpose: "Broad analysis", section: "agents" },
  { key: "metis", aliases: [], displayName: "Metis", purpose: "Tactical planning", section: "agents" },
  { key: "momus", aliases: [], displayName: "Momus", purpose: "Code review", section: "agents" },
  { key: "multimodal-looker", aliases: ["visual-agent", "looker"], displayName: "Multimodal Looker", purpose: "Visual analysis", section: "agents" },
  { key: "quick", aliases: [], displayName: "Quick", purpose: "Single-file / typo fixes", section: "categories" },
  { key: "ultrabrain", aliases: [], displayName: "Ultrabrain", purpose: "Hard logic, architecture", section: "categories" },
  { key: "visual-engineering", aliases: ["visual"], displayName: "Visual Engineering", purpose: "Frontend, UI/UX", section: "categories" },
  { key: "deep", aliases: [], displayName: "Deep", purpose: "Autonomous research", section: "categories" },
  { key: "unspecified-low", aliases: [], displayName: "Unspecified (Low)", purpose: "Low-complexity tasks", section: "categories" },
  { key: "unspecified-high", aliases: [], displayName: "Unspecified (High)", purpose: "High-complexity tasks", section: "categories" },
  { key: "writing", aliases: [], displayName: "Writing", purpose: "Documentation/writing tasks", section: "categories" },
  { key: "artistry", aliases: [], displayName: "Artistry", purpose: "Creative/design tasks", section: "categories" },
];

// Built-in model registry
export const MODEL_REGISTRY: ModelInfo[] = [
  { alias: "qwen-max", modelId: "qwen-max", provider: "alibaba", tier: "smart", contextWindow: 32768, costPer1MInput: 2.4, costPer1MOutput: 9.6 },
  { alias: "qwen-turbo", modelId: "qwen-turbo", provider: "alibaba", tier: "fast", contextWindow: 8192, costPer1MInput: 0.05, costPer1MOutput: 0.15 },
  { alias: "qwen3.5-plus", modelId: "qwen3.5-plus", provider: "alibaba", tier: "smart", contextWindow: 131072, costPer1MInput: 0.4, costPer1MOutput: 1.2 },
  { alias: "minimax-m1", modelId: "MiniMax-M1", provider: "minimax", tier: "smart", contextWindow: 1000000, costPer1MInput: 0.3, costPer1MOutput: 1.1 },
  { alias: "minimax-m2.7", modelId: "MiniMax-M2.7", provider: "minimax", tier: "smart", contextWindow: 1000000, costPer1MInput: 0.3, costPer1MOutput: 1.1 },
  { alias: "minimax-text", modelId: "MiniMax-Text-01", provider: "minimax", tier: "fast", contextWindow: 1000000, costPer1MInput: 0.1, costPer1MOutput: 0.3 },
  { alias: "z1-pro", modelId: "z1-reasoning-pro", provider: "zai", tier: "smart", contextWindow: 65536, costPer1MInput: 3.5, costPer1MOutput: 14 },
  { alias: "z1", modelId: "z1", provider: "zai", tier: "fast", contextWindow: 65536, costPer1MInput: 0.8, costPer1MOutput: 2.4 },
  { alias: "glm-5", modelId: "glm-5", provider: "zai", tier: "smart", contextWindow: 131072, costPer1MInput: 0.0, costPer1MOutput: 0.0 },
  { alias: "glm-4.7-flashx", modelId: "glm-4.7-flashx", provider: "zai", tier: "fast", contextWindow: 131072, costPer1MInput: 0.0, costPer1MOutput: 0.0 },
  { alias: "kimi-k2.5", modelId: "kimi-k2.5", provider: "alibaba", tier: "smart", contextWindow: 131072, costPer1MInput: 0.6, costPer1MOutput: 2.5 },
];

// Provider display names and base URLs
export const PROVIDER_INFO = {
  alibaba: { name: "Alibaba DashScope", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", envKey: "ALIBABA_API_KEY" },
  minimax: { name: "Minimax", baseUrl: "https://api.minimax.io/v1", envKey: "MINIMAX_API_KEY" },
  zai: { name: "Z.AI", baseUrl: "https://api.z.ai/v1", envKey: "ZAI_API_KEY" },
} as const;
