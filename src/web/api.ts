import type { Server } from "bun";
import { getAllAssignments, setModelInConfig } from "../core/ohmy.js";
import { listProfiles, saveProfile, getProfile } from "../core/profiles.js";
import { getLatestSnapshot, getRecentSessions } from "../db/queries.js";
import { pollAllProviders } from "../providers/poller.js";
import { MODEL_REGISTRY, AGENT_ROLES, PROVIDER_INFO } from "../constants.js";
import { resolveRole } from "../core/roles.js";
import { resolveModelString } from "../core/registry.js";
import type { Provider } from "../types.js";
import { existsSync, readFileSync } from "node:fs";
import { PROXY_LOG_PATH, PROXY_URL, WEB_PORT } from "../constants.js";

const PROVIDERS: Provider[] = ["alibaba", "minimax", "zai"];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function err(msg: string, status = 400): Response {
  return json({ error: msg }, status);
}

export async function handleApiRequest(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // ── GET /api/providers ──────────────────────────────────────────────────────
  if (path === "/api/providers" && method === "GET") {
    const snapshots = await pollAllProviders();
    const result = PROVIDERS.map(p => ({
      id: p,
      name: PROVIDER_INFO[p].name,
      snapshot: snapshots[p],
    }));
    return json(result);
  }

  // ── GET /api/providers/:id ──────────────────────────────────────────────────
  const providerMatch = path.match(/^\/api\/providers\/(\w+)$/);
  if (providerMatch && method === "GET") {
    const p = providerMatch[1] as Provider;
    if (!PROVIDERS.includes(p)) return err("Unknown provider", 404);
    const snap = getLatestSnapshot(p);
    return json({ id: p, name: PROVIDER_INFO[p].name, snapshot: snap });
  }

  // ── GET /api/roles ──────────────────────────────────────────────────────────
  if (path === "/api/roles" && method === "GET") {
    const assignments = getAllAssignments();
    const result = AGENT_ROLES.map(r => ({
      key: r.key,
      displayName: r.displayName,
      section: r.section,
      model: assignments[r.key] ?? null,
      purpose: r.purpose,
    }));
    return json(result);
  }

  // ── POST /api/roles/:role ────────────────────────────────────────────────────
  const roleMatch = path.match(/^\/api\/roles\/([^/]+)$/);
  if (roleMatch && method === "POST") {
    const roleKey = decodeURIComponent(roleMatch[1]);
    const role = resolveRole(roleKey);
    if (!role) return err("Unknown role", 404);
    let body: { model?: string };
    try { body = await req.json() as { model?: string }; } catch { return err("Invalid JSON"); }
    if (!body.model) return err("model field required");
    const { modelString } = resolveModelString(body.model);
    try {
      setModelInConfig(role.section, role.key, modelString);
      return json({ role: role.key, model: modelString, ok: true });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : String(e), 500);
    }
  }

  // ── GET /api/sessions ───────────────────────────────────────────────────────
  if (path === "/api/sessions" && method === "GET") {
    const limit = parseInt(url.searchParams.get("limit") ?? "50");
    const offset = parseInt(url.searchParams.get("offset") ?? "0");
    const sessions = getRecentSessions(limit, offset);
    return json({ sessions, limit, offset });
  }

  // ── GET /api/models ─────────────────────────────────────────────────────────
  if (path === "/api/models" && method === "GET") {
    return json(MODEL_REGISTRY);
  }

  // ── GET /api/profiles ───────────────────────────────────────────────────────
  if (path === "/api/profiles" && method === "GET") {
    return json(listProfiles());
  }

  // ── POST /api/profiles/:name ─────────────────────────────────────────────────
  const profileSaveMatch = path.match(/^\/api\/profiles\/([^/]+)$/);
  if (profileSaveMatch && method === "POST" && !path.endsWith("/apply")) {
    const name = decodeURIComponent(profileSaveMatch[1]);
    const assignments = getAllAssignments();
    const profile = saveProfile(name, assignments);
    return json(profile);
  }

  // ── POST /api/profiles/:name/apply ──────────────────────────────────────────
  const profileApplyMatch = path.match(/^\/api\/profiles\/([^/]+)\/apply$/);
  if (profileApplyMatch && method === "POST") {
    const name = decodeURIComponent(profileApplyMatch[1]);
    const profile = getProfile(name);
    if (!profile) return err("Profile not found", 404);
    let count = 0;
    for (const [roleKey, modelInput] of Object.entries(profile.assignments)) {
      const role = resolveRole(roleKey);
      if (!role) continue;
      const { modelString } = resolveModelString(modelInput);
      try { setModelInConfig(role.section, role.key, modelString); count++; } catch { /* skip */ }
    }
    return json({ ok: true, applied: count, profile: name });
  }

  // ── GET /api/proxy/status ───────────────────────────────────────────────────
  if (path === "/api/proxy/status" && method === "GET") {
    try {
      const res = await fetch(`${PROXY_URL}/health`, { signal: AbortSignal.timeout(2000) });
      const data = await res.json();
      return json({ status: "online", health: data });
    } catch {
      return json({ status: "offline", error: "Connection refused" });
    }
  }

  // ── GET /api/proxy/log (SSE) ─────────────────────────────────────────────────
  if (path === "/api/proxy/log" && method === "GET") {
    const encoder = new TextEncoder();
    let intervalId: ReturnType<typeof setInterval>;
    let lastSize = 0;

    const stream = new ReadableStream({
      start(controller) {
        const sendEvent = (data: string) => {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        // Send initial lines
        if (existsSync(PROXY_LOG_PATH)) {
          const lines = readFileSync(PROXY_LOG_PATH, "utf8").split("\n").filter(Boolean).slice(-20);
          for (const line of lines) sendEvent(line);
          lastSize = lines.length;
        }

        // Poll for new lines
        intervalId = setInterval(() => {
          if (!existsSync(PROXY_LOG_PATH)) return;
          const lines = readFileSync(PROXY_LOG_PATH, "utf8").split("\n").filter(Boolean);
          if (lines.length > lastSize) {
            for (const line of lines.slice(lastSize)) sendEvent(line);
            lastSize = lines.length;
          }
        }, 1000);
      },
      cancel() { clearInterval(intervalId); },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // ── GET /api/trends ──────────────────────────────────────────────────────────
  if (path === "/api/trends" && method === "GET") {
    const { getSnapshotHistory } = await import("../db/queries.js");
    const hours = parseInt(url.searchParams.get("hours") ?? "24");
    const trends = Object.fromEntries(
      await Promise.all(PROVIDERS.map(async p => [p, getSnapshotHistory(p, hours)]))
    );
    return json(trends);
  }

  return null; // not an API route
}

export function serveWebUi(req: Request): Response {
  return new Response(getHtmlPage(), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function getHtmlPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>omoctl — Agent Control Plane</title>
  <style>
    :root {
      --bg: #1a1b26; --bg2: #24283b; --bg3: #292e42;
      --fg: #c0caf5; --fg2: #a9b1d6; --gray: #565f89;
      --cyan: #7dcfff; --green: #9ece6a; --yellow: #e0af68;
      --red: #f7768e; --purple: #bb9af7; --orange: #ff9e64;
      --border: #3d59a1;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--fg); font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 13px; }
    header { background: var(--bg2); border-bottom: 1px solid var(--border); padding: 12px 20px; display: flex; align-items: center; gap: 16px; }
    header h1 { color: var(--cyan); font-size: 18px; }
    header span { color: var(--gray); }
    nav { display: flex; gap: 4px; margin-left: auto; }
    nav button { background: var(--bg3); border: 1px solid var(--border); color: var(--fg2); padding: 4px 12px; border-radius: 4px; cursor: pointer; font-family: inherit; font-size: 12px; }
    nav button.active { background: var(--border); color: var(--cyan); }
    nav button:hover { border-color: var(--cyan); }
    main { padding: 16px 20px; max-width: 1400px; }
    .page { display: none; } .page.active { display: block; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .card { background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; padding: 14px; }
    .card h3 { color: var(--cyan); font-size: 13px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
    .gauge-wrap { margin: 6px 0; }
    .gauge-label { display: flex; justify-content: space-between; color: var(--fg2); font-size: 11px; margin-bottom: 3px; }
    .gauge-bar { height: 6px; background: var(--bg3); border-radius: 3px; overflow: hidden; }
    .gauge-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
    .green { background: var(--green); } .yellow { background: var(--yellow); } .red { background: var(--red); }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px 10px; color: var(--gray); font-weight: normal; border-bottom: 1px solid var(--border); font-size: 11px; text-transform: uppercase; }
    td { padding: 7px 10px; border-bottom: 1px solid var(--bg3); color: var(--fg2); }
    tr:hover td { background: var(--bg3); }
    select { background: var(--bg3); border: 1px solid var(--border); color: var(--fg); padding: 3px 6px; border-radius: 3px; font-family: inherit; font-size: 12px; cursor: pointer; }
    .tag { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: bold; }
    .tag-smart { background: rgba(187,154,247,0.2); color: var(--purple); }
    .tag-fast { background: rgba(125,207,255,0.2); color: var(--cyan); }
    .tag-deep { background: rgba(255,158,100,0.2); color: var(--orange); }
    .status-ok { color: var(--green); } .status-err { color: var(--red); } .status-warn { color: var(--yellow); }
    pre { background: var(--bg3); padding: 10px; border-radius: 4px; overflow-x: auto; color: var(--fg2); font-size: 11px; }
    .refresh-btn { background: var(--bg3); border: 1px solid var(--border); color: var(--fg2); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-family: inherit; font-size: 11px; }
    .refresh-btn:hover { color: var(--cyan); border-color: var(--cyan); }
    .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .section-header h2 { color: var(--fg); font-size: 14px; }
    .estimated { color: var(--yellow); font-size: 10px; }
    #proxy-log { height: 300px; overflow-y: auto; background: var(--bg3); padding: 10px; border-radius: 4px; font-size: 11px; }
    #proxy-log .log-line { padding: 2px 0; border-bottom: 1px solid var(--bg2); }
    .roles-table select { width: 260px; }
  </style>
</head>
<body>
<header>
  <h1>⚡ omoctl</h1>
  <span>oh-my-openagent control plane</span>
  <span id="last-refresh" style="color:var(--gray);font-size:11px"></span>
  <nav>
    <button class="active" onclick="showPage('overview')">Overview</button>
    <button onclick="showPage('roles')">Roles</button>
    <button onclick="showPage('sessions')">Sessions</button>
    <button onclick="showPage('plans')">Plans</button>
    <button onclick="showPage('proxy')">Proxy</button>
  </nav>
</header>
<main>

<!-- OVERVIEW -->
<div id="page-overview" class="page active">
  <div class="section-header">
    <h2>Provider Overview</h2>
    <button class="refresh-btn" onclick="loadAll()">↺ Refresh</button>
  </div>
  <div id="provider-grid" class="grid">Loading…</div>
</div>

<!-- ROLES -->
<div id="page-roles" class="page">
  <div class="section-header"><h2>Agent Roles</h2></div>
  <table class="roles-table">
    <thead><tr><th>Role</th><th>Section</th><th>Current Model</th><th>Change</th></tr></thead>
    <tbody id="roles-tbody">Loading…</tbody>
  </table>
</div>

<!-- SESSIONS -->
<div id="page-sessions" class="page">
  <div class="section-header"><h2>Session History</h2></div>
  <table>
    <thead><tr><th>Time</th><th>Role</th><th>Model</th><th>Provider</th><th>Tokens</th><th>Cost</th><th>Status</th></tr></thead>
    <tbody id="sessions-tbody">Loading…</tbody>
  </table>
</div>

<!-- PLANS -->
<div id="page-plans" class="page">
  <div class="section-header"><h2>Coding Plan Quotas</h2></div>
  <div id="plans-grid" class="grid">Loading…</div>
</div>

<!-- PROXY -->
<div id="page-proxy" class="page">
  <div class="section-header"><h2>Proxy Status</h2></div>
  <div id="proxy-status" class="card" style="margin-bottom:12px">Checking…</div>
  <div class="card">
    <h3>Live Log</h3>
    <div id="proxy-log"></div>
  </div>
</div>

</main>

<script>
const API = '';
let models = [];
let proxyEventSource = null;

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  event.target.classList.add('active');
  if (name === 'proxy' && !proxyEventSource) connectProxyLog();
}

function gaugeHtml(used, limit, label) {
  if (used == null || limit == null) return '';
  const pct = Math.min(100, Math.round(used / limit * 100));
  const cls = pct >= 90 ? 'red' : pct >= 75 ? 'yellow' : 'green';
  const usedFmt = used > 999 ? (used/1000).toFixed(0)+'k' : used;
  const limitFmt = limit > 999 ? (limit/1000).toFixed(0)+'k' : limit;
  return \`<div class="gauge-wrap">
    <div class="gauge-label"><span>\${label}: \${usedFmt}/\${limitFmt}</span><span>\${pct}%</span></div>
    <div class="gauge-bar"><div class="gauge-fill \${cls}" style="width:\${pct}%"></div></div>
  </div>\`;
}

async function loadProviders() {
  const res = await fetch(API + '/api/providers');
  const data = await res.json();
  const grid = document.getElementById('provider-grid');
  grid.innerHTML = data.map(p => {
    const s = p.snapshot;
    if (!s || s.error) return \`<div class="card"><h3>\${p.name}</h3><p class="status-err">\${s?.error || 'No data'}</p></div>\`;
    const est = s.isEstimated ? '<span class="estimated"> ~estimated</span>' : '';
    return \`<div class="card">
      <h3>\${p.name}\${est}</h3>
      \${s.planName ? \`<p style="color:var(--gray);font-size:11px">\${s.planName}</p>\` : ''}
      \${gaugeHtml(s.tpdUsed, s.tpdLimit, 'TPD')}
      \${gaugeHtml(s.rpdUsed, s.rpdLimit, 'RPD')}
      \${gaugeHtml(s.rpmUsed, s.rpmLimit, 'RPM')}
      \${s.spendToday != null ? \`<p style="margin-top:8px">Today: <strong>\$\${s.spendToday.toFixed(2)}</strong></p>\` : ''}
      \${s.spendMonth != null ? \`<p>Month: <strong>\$\${s.spendMonth.toFixed(2)}</strong></p>\` : ''}
    </div>\`;
  }).join('');
}

async function loadRoles() {
  const [rolesRes, modelsRes] = await Promise.all([
    fetch(API + '/api/roles'), fetch(API + '/api/models')
  ]);
  const roles = await rolesRes.json();
  models = await modelsRes.json();
  const tbody = document.getElementById('roles-tbody');
  tbody.innerHTML = roles.map(r => \`<tr>
    <td><strong style="color:var(--cyan)">\${r.key}</strong><br><span style="color:var(--gray);font-size:11px">\${r.purpose}</span></td>
    <td><span style="color:var(--gray)">\${r.section}</span></td>
    <td style="color:var(--fg)">\${r.model || '<span style="color:var(--gray)">—</span>'}</td>
    <td>
      <select onchange="setRole('\${r.key}', this.value)">
        <option value="">— change model —</option>
        \${models.map(m => \`<option value="\${m.alias}" \${r.model?.includes(m.modelId) ? 'selected' : ''}>\${m.alias} (\${m.provider}, \${m.tier})</option>\`).join('')}
      </select>
    </td>
  </tr>\`).join('');
}

async function setRole(roleKey, modelAlias) {
  if (!modelAlias) return;
  await fetch(API + '/api/roles/' + encodeURIComponent(roleKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelAlias })
  });
  loadRoles();
}

async function loadSessions() {
  const res = await fetch(API + '/api/sessions');
  const { sessions } = await res.json();
  const tbody = document.getElementById('sessions-tbody');
  if (!sessions.length) { tbody.innerHTML = '<tr><td colspan="7" style="color:var(--gray)">No sessions yet</td></tr>'; return; }
  tbody.innerHTML = sessions.map(s => \`<tr>
    <td>\${s.startedAt?.slice(0,19) || '—'}</td>
    <td>\${s.agentRole || '—'}</td>
    <td>\${s.model}</td>
    <td>\${s.provider}</td>
    <td>\${((s.inputTokens||0)+(s.outputTokens||0)).toLocaleString()}</td>
    <td>\$\${(s.costUsd||0).toFixed(4)}</td>
    <td class="status-\${s.status === 'done' ? 'ok' : s.status === 'error' ? 'err' : 'warn'}">\${s.status}</td>
  </tr>\`).join('');
}

async function loadPlans() {
  const res = await fetch(API + '/api/providers');
  const data = await res.json();
  document.getElementById('plans-grid').innerHTML = data.map(p => {
    const s = p.snapshot;
    if (!s) return \`<div class="card"><h3>\${p.name}</h3><p class="status-err">No data</p></div>\`;
    return \`<div class="card">
      <h3>\${p.name}</h3>
      \${s.planName ? \`<p style="color:var(--gray);margin-bottom:8px">\${s.planName}</p>\` : ''}
      \${gaugeHtml(s.rpmUsed, s.rpmLimit, 'RPM')}
      \${gaugeHtml(s.rpdUsed, s.rpdLimit, 'RPD')}
      \${gaugeHtml(s.tpmUsed, s.tpmLimit, 'TPM')}
      \${gaugeHtml(s.tpdUsed, s.tpdLimit, 'TPD')}
      \${s.spendToday != null ? \`<p style="margin-top:6px">Today: \$\${s.spendToday.toFixed(2)}</p>\` : ''}
      \${s.spendMonth != null ? \`<p>Month: \$\${s.spendMonth.toFixed(2)}</p>\` : ''}
      \${s.quotaResetsAt ? \`<p style="color:var(--gray);font-size:11px">Resets: \${new Date(s.quotaResetsAt).toLocaleString()}</p>\` : ''}
      \${s.isEstimated ? '<p class="estimated">~ estimated</p>' : ''}
    </div>\`;
  }).join('');
}

async function loadProxy() {
  const res = await fetch(API + '/api/proxy/status');
  const data = await res.json();
  const el = document.getElementById('proxy-status');
  el.innerHTML = \`<h3>Proxy</h3>
    <p class="status-\${data.status === 'online' ? 'ok' : 'err'}">\${data.status === 'online' ? '✓ Online' : '✗ Offline'}</p>
    \${data.health ? \`<pre>\${JSON.stringify(data.health, null, 2)}</pre>\` : ''}\`;
}

function connectProxyLog() {
  proxyEventSource = new EventSource(API + '/api/proxy/log');
  proxyEventSource.onmessage = (e) => {
    const log = document.getElementById('proxy-log');
    const line = document.createElement('div');
    line.className = 'log-line';
    try {
      const entry = JSON.parse(e.data);
      const ts = String(entry.timestamp || entry.time || '').slice(11, 19);
      const provider = entry.provider || '';
      const status = entry.status || entry.statusCode || '';
      const color = Number(status) >= 400 ? 'var(--red)' : 'var(--green)';
      line.innerHTML = \`<span style="color:var(--gray)">\${ts}</span> <span style="color:var(--cyan)">\${provider.padEnd ? provider : ''}</span> <span style="color:\${color}">\${status}</span>\`;
    } catch { line.textContent = e.data.slice(0, 120); }
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  };
}

async function loadAll() {
  document.getElementById('last-refresh').textContent = 'Refreshing…';
  await Promise.all([loadProviders(), loadRoles(), loadSessions(), loadPlans()]);
  document.getElementById('last-refresh').textContent = 'Updated ' + new Date().toLocaleTimeString();
}

// Initial load
loadAll();
setInterval(loadAll, 30000);
</script>
</body>
</html>`;
}
