import type { ProviderSnapshot, Provider } from "../types.js";
import { loadConfig, resolveApiKey } from "../core/config.js";
import { insertSnapshot } from "../db/queries.js";

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// ─── Alibaba DashScope ────────────────────────────────────────────────────────

export async function pollAlibaba(): Promise<ProviderSnapshot> {
  const config = loadConfig();
  const apiKey = resolveApiKey(config, "alibaba");
  const base: Omit<ProviderSnapshot, "sampledAt"> = { provider: "alibaba", isEstimated: false };

  if (!apiKey) {
    return { ...base, sampledAt: new Date().toISOString(), isEstimated: true, error: "ALIBABA_API_KEY not set" };
  }

  try {
    const res = await fetchWithTimeout(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/usage",
      { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as Record<string, unknown>;
    return {
      provider: "alibaba",
      planName: (data.plan as string) ?? "DashScope",
      rpmLimit: extractNumber(data, "rpm_limit"),
      rpmUsed: extractNumber(data, "rpm_used"),
      rpdLimit: extractNumber(data, "rpd_limit"),
      rpdUsed: extractNumber(data, "rpd_used"),
      tpmLimit: extractNumber(data, "tpm_limit"),
      tpmUsed: extractNumber(data, "tpm_used"),
      spendToday: extractNumber(data, "spend_today"),
      spendMonth: extractNumber(data, "spend_month"),
      sampledAt: new Date().toISOString(),
      isEstimated: false,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { ...base, sampledAt: new Date().toISOString(), isEstimated: true, error };
  }
}

// ─── Minimax ─────────────────────────────────────────────────────────────────

export async function pollMinimax(): Promise<ProviderSnapshot> {
  const config = loadConfig();
  const apiKey = resolveApiKey(config, "minimax");
  const base: Omit<ProviderSnapshot, "sampledAt"> = { provider: "minimax", isEstimated: false };

  if (!apiKey) {
    return { ...base, sampledAt: new Date().toISOString(), isEstimated: true, error: "MINIMAX_API_KEY not set" };
  }

  try {
    const res = await fetchWithTimeout(
      "https://api.minimax.io/v1/account/usage",
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as Record<string, unknown>;
    return {
      provider: "minimax",
      planName: extractString(data, "subscription", "plan_name") ?? "Minimax Standard",
      tpdLimit: extractNumber(data, "quota_total"),
      tpdUsed: extractNumber(data, "quota_used"),
      spendMonth: extractNumber(data, "spend_month"),
      sampledAt: new Date().toISOString(),
      isEstimated: false,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { ...base, sampledAt: new Date().toISOString(), isEstimated: true, error };
  }
}

// ─── Z.AI ─────────────────────────────────────────────────────────────────────

export async function pollZai(): Promise<ProviderSnapshot> {
  const config = loadConfig();
  const apiKey = resolveApiKey(config, "zai");
  const base: Omit<ProviderSnapshot, "sampledAt"> = { provider: "zai", isEstimated: false };

  if (!apiKey) {
    return { ...base, sampledAt: new Date().toISOString(), isEstimated: true, error: "ZAI_API_KEY not set" };
  }

  try {
    const res = await fetchWithTimeout(
      "https://api.z.ai/v1/account/usage",
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as Record<string, unknown>;
    const account = (data.account ?? data) as Record<string, unknown>;
    return {
      provider: "zai",
      planName: extractString(account, "plan") ?? "Z.AI",
      tpdLimit: extractNumber(account, "quota_total"),
      tpdUsed: extractNumber(account, "quota_used"),
      spendMonth: extractNumber(account, "spend_month"),
      sampledAt: new Date().toISOString(),
      isEstimated: false,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { ...base, sampledAt: new Date().toISOString(), isEstimated: true, error };
  }
}

// ─── Poll all and persist ─────────────────────────────────────────────────────

export async function pollAllProviders(): Promise<Record<Provider, ProviderSnapshot>> {
  const [alibaba, minimax, zai] = await Promise.all([pollAlibaba(), pollMinimax(), pollZai()]);
  for (const snap of [alibaba, minimax, zai]) {
    try { insertSnapshot(snap); } catch { /* non-fatal */ }
  }
  return { alibaba, minimax, zai };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractNumber(obj: Record<string, unknown>, ...keys: string[]): number | undefined {
  let cur: unknown = obj;
  for (const k of keys) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return typeof cur === "number" ? cur : undefined;
}

function extractString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  let cur: unknown = obj;
  for (const k of keys) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return typeof cur === "string" ? cur : undefined;
}
