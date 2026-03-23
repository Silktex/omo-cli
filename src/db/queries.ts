import type { ProviderSnapshot, RoleAssignment, Session, ProxyStat } from "../types.js";
import { getDb } from "./schema.js";

// ─── Provider Snapshots ──────────────────────────────────────────────────────

export function insertSnapshot(s: Omit<ProviderSnapshot, "id">): void {
  const db = getDb();
  db.run(
    `INSERT INTO provider_snapshots
      (provider, plan_name, rpm_used, rpm_limit, rpd_used, rpd_limit,
       tpm_used, tpm_limit, tpd_used, tpd_limit, spend_today, spend_month,
       quota_resets_at, sampled_at, is_estimated, error_msg)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      s.provider, s.planName ?? null,
      s.rpmUsed ?? null, s.rpmLimit ?? null,
      s.rpdUsed ?? null, s.rpdLimit ?? null,
      s.tpmUsed ?? null, s.tpmLimit ?? null,
      s.tpdUsed ?? null, s.tpdLimit ?? null,
      s.spendToday ?? null, s.spendMonth ?? null,
      s.quotaResetsAt ?? null, s.sampledAt,
      s.isEstimated ? 1 : 0, s.error ?? null,
    ],
  );
}

export function getLatestSnapshot(provider: string): ProviderSnapshot | null {
  const db = getDb();
  const row = db.query(
    `SELECT * FROM provider_snapshots WHERE provider=? ORDER BY sampled_at DESC LIMIT 1`,
  ).get(provider) as Record<string, unknown> | null;
  return row ? rowToSnapshot(row) : null;
}

export function getSnapshotHistory(provider: string, hours = 24): ProviderSnapshot[] {
  const db = getDb();
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const rows = db.query(
    `SELECT * FROM provider_snapshots WHERE provider=? AND sampled_at>? ORDER BY sampled_at`,
  ).all(provider, since) as Record<string, unknown>[];
  return rows.map(rowToSnapshot);
}

function rowToSnapshot(r: Record<string, unknown>): ProviderSnapshot {
  return {
    provider: r.provider as ProviderSnapshot["provider"],
    planName: r.plan_name as string | undefined,
    rpmUsed: r.rpm_used as number | undefined,
    rpmLimit: r.rpm_limit as number | undefined,
    rpdUsed: r.rpd_used as number | undefined,
    rpdLimit: r.rpd_limit as number | undefined,
    tpmUsed: r.tpm_used as number | undefined,
    tpmLimit: r.tpm_limit as number | undefined,
    tpdUsed: r.tpd_used as number | undefined,
    tpdLimit: r.tpd_limit as number | undefined,
    spendToday: r.spend_today as number | undefined,
    spendMonth: r.spend_month as number | undefined,
    quotaResetsAt: r.quota_resets_at as string | undefined,
    sampledAt: r.sampled_at as string,
    isEstimated: Boolean(r.is_estimated),
    error: r.error_msg as string | undefined,
  };
}

// ─── Role Assignments ────────────────────────────────────────────────────────

export function insertRoleAssignment(a: Omit<RoleAssignment, "id">): void {
  const db = getDb();
  db.run(
    `INSERT INTO role_assignments (role, model, provider, assigned_at, assigned_by)
     VALUES (?,?,?,?,?)`,
    [a.role, a.model, a.provider, a.assignedAt, a.assignedBy ?? "cli"],
  );
}

export function getLatestRoleAssignment(role: string): RoleAssignment | null {
  const db = getDb();
  const row = db.query(
    `SELECT * FROM role_assignments WHERE role=? ORDER BY assigned_at DESC LIMIT 1`,
  ).get(role) as Record<string, unknown> | null;
  if (!row) return null;
  return {
    role: row.role as string,
    model: row.model as string,
    provider: row.provider as RoleAssignment["provider"],
    assignedAt: row.assigned_at as string,
    assignedBy: row.assigned_by as RoleAssignment["assignedBy"],
  };
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export function upsertSession(s: Session): void {
  const db = getDb();
  db.run(
    `INSERT INTO sessions
      (id, agent_role, agent_name, model, provider, input_tokens, output_tokens,
       cache_tokens, cost_usd, duration_ms, status, project_path, started_at, ended_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       status=excluded.status, ended_at=excluded.ended_at,
       input_tokens=excluded.input_tokens, output_tokens=excluded.output_tokens,
       cost_usd=excluded.cost_usd, duration_ms=excluded.duration_ms`,
    [
      s.id, s.agentRole ?? null, s.agentName ?? null,
      s.model, s.provider,
      s.inputTokens, s.outputTokens, s.cacheTokens,
      s.costUsd, s.durationMs ?? null,
      s.status, s.projectPath ?? null,
      s.startedAt, s.endedAt ?? null,
    ],
  );
}

export function getRecentSessions(limit = 50, offset = 0): Session[] {
  const db = getDb();
  const rows = db.query(
    `SELECT * FROM sessions ORDER BY started_at DESC LIMIT ? OFFSET ?`,
  ).all(limit, offset) as Record<string, unknown>[];
  return rows.map(rowToSession);
}

function rowToSession(r: Record<string, unknown>): Session {
  return {
    id: r.id as string,
    agentRole: r.agent_role as string | undefined,
    agentName: r.agent_name as string | undefined,
    model: r.model as string,
    provider: r.provider as Session["provider"],
    inputTokens: (r.input_tokens as number) ?? 0,
    outputTokens: (r.output_tokens as number) ?? 0,
    cacheTokens: (r.cache_tokens as number) ?? 0,
    costUsd: (r.cost_usd as number) ?? 0,
    durationMs: r.duration_ms as number | undefined,
    status: r.status as Session["status"],
    projectPath: r.project_path as string | undefined,
    startedAt: r.started_at as string,
    endedAt: r.ended_at as string | undefined,
  };
}

// ─── Proxy Stats ─────────────────────────────────────────────────────────────

export function upsertProxyStat(s: Omit<ProxyStat, "id">): void {
  const db = getDb();
  db.run(
    `INSERT INTO proxy_stats (provider, minute, requests, errors, timeouts, avg_latency_ms)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(provider, minute) DO UPDATE SET
       requests=requests+excluded.requests,
       errors=errors+excluded.errors,
       timeouts=timeouts+excluded.timeouts,
       avg_latency_ms=excluded.avg_latency_ms`,
    [s.provider, s.minute, s.requests, s.errors, s.timeouts, s.avgLatencyMs ?? null],
  );
}

export function getProxyStats(provider: string, minutes = 60): ProxyStat[] {
  const db = getDb();
  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString().slice(0, 16);
  const rows = db.query(
    `SELECT * FROM proxy_stats WHERE provider=? AND minute>=? ORDER BY minute`,
  ).all(provider, since) as Record<string, unknown>[];
  return rows.map(r => ({
    provider: r.provider as ProxyStat["provider"],
    minute: r.minute as string,
    requests: r.requests as number,
    errors: r.errors as number,
    timeouts: r.timeouts as number,
    avgLatencyMs: r.avg_latency_ms as number | undefined,
  }));
}
