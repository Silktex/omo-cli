// Shared types for omoctl

export type Provider = "alibaba" | "minimax" | "zai";
export type ModelTier = "smart" | "fast" | "deep";
export type AssignedBy = "cli" | "tui" | "web" | "profile";

// oh-my-opencode.json structure
export interface OhMyOpenCodeConfig {
  $schema?: string;
  agents?: Record<string, { model: string; [key: string]: unknown }>;
  categories?: Record<string, { model: string; variant?: string; [key: string]: unknown }>;
  google_auth?: boolean;
  tmux?: Record<string, unknown>;
  [key: string]: unknown;
}

// Agent role — maps oh-my-openagent keys to display names
export interface AgentRole {
  key: string;           // e.g. "sisyphus"
  aliases: string[];     // e.g. ["sis"]
  displayName: string;   // e.g. "Sisyphus"
  purpose: string;
  section: "agents" | "categories";
}

// Model in the registry
export interface ModelInfo {
  alias: string;           // short alias e.g. "qwen-max"
  modelId: string;         // full ID e.g. "qwen-max"
  provider: Provider;
  tier: ModelTier;
  contextWindow?: number;
  costPer1MInput?: number;
  costPer1MOutput?: number;
  available?: boolean;     // true if API key is configured
}

// Provider quota snapshot
export interface ProviderSnapshot {
  provider: Provider;
  planName?: string;
  rpmUsed?: number;
  rpmLimit?: number;
  rpdUsed?: number;
  rpdLimit?: number;
  tpmUsed?: number;
  tpmLimit?: number;
  tpdUsed?: number;
  tpdLimit?: number;
  spendToday?: number;
  spendMonth?: number;
  quotaResetsAt?: string;   // ISO8601
  sampledAt: string;        // ISO8601
  isEstimated?: boolean;    // true if sourced from proxy log fallback
  error?: string;
}

// Role assignment record
export interface RoleAssignment {
  role: string;
  model: string;
  provider: Provider;
  assignedAt: string;
  assignedBy: AssignedBy;
}

// Session record (tokentop-compatible + role fields)
export interface Session {
  id: string;
  agentRole?: string;
  agentName?: string;
  model: string;
  provider: Provider;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  costUsd: number;
  durationMs?: number;
  status: "active" | "done" | "error";
  projectPath?: string;
  startedAt: string;
  endedAt?: string;
}

// Named profile
export interface Profile {
  name: string;
  assignments: Record<string, string>;  // role → model
  createdAt: string;
  updatedAt: string;
}

// Proxy stats (per-minute aggregate)
export interface ProxyStat {
  provider: Provider;
  minute: string;
  requests: number;
  errors: number;
  timeouts: number;
  avgLatencyMs?: number;
}

// omoctl config file
export interface OmoctlConfig {
  providers: {
    alibaba?: ProviderConfig;
    minimax?: ProviderConfig;
    zai?: ProviderConfig;
  };
  ohMyOpenagentConfig: string;
  proxyLog: string;
  web?: {
    port: number;
    host: string;
    openBrowser: boolean;
  };
  refreshInterval: number;
  theme: "tokyo-night" | "dracula" | "nord";
  alertThresholds: {
    warn: number;
    critical: number;
  };
  database: string;
}

export interface ProviderConfig {
  enabled: boolean;
  apiKey?: string;       // or {env:VAR_NAME} placeholder
  baseUrl: string;
  plan?: string;
  budgets?: {
    daily?: number;
    monthly?: number;
  };
}

// Proxy health response from GET /health
export interface ProxyHealth {
  status: "ok" | "degraded" | "down";
  providers: Array<{
    name: string;
    requests: number;
    errors: number;
    successRate: number;
  }>;
  roundRobinCursor?: number;
  uptime?: number;
}
