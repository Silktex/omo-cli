# PRD: `omoctl` — Agent Model Control Plane

**Version:** 1.0.0-draft  
**Status:** Proposal  
**Authors:** (you)  
**Date:** 2026-03-22  
**Depends on:** [tokentop](https://github.com/tokentopapp/tokentop) · [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) · fallback-proxy (local)

---

## 1. Problem Statement

You run multi-agent orchestration with oh-my-openagent across three providers (Alibaba/Qwen, Minimax, Z.AI), using the round-robin fallback proxy. Today you have three disconnected problems with no single tool that addresses all of them:

1. **No real-time visibility.** You don't know which agent is burning tokens, on which provider, at what rate — until a session runs out or a bill arrives.
2. **No fast model switching.** Reassigning a model to an agent role (Sisyphus, Hephaestus, Prometheus, etc.) requires manually editing `oh-my-opencode.json` and restarting OpenCode. There is no CLI shortcut.
3. **No rate limit awareness.** You can't see which providers are close to their limits, when those limits reset, or which coding plan you're on per provider — without visiting three separate dashboards.

`omoctl` collapses all three into one terminal-native tool with an optional web UI.

---

## 2. Goals

| # | Goal | Success Metric |
|---|------|----------------|
| G1 | Switch a model for any agent role in ≤ 3 keystrokes from the CLI | `omoctl set sisyphus kimi-k2.5` completes and hot-reloads config in < 500 ms |
| G2 | Surface real-time token burn rate, cost, and rate limit status per provider | Dashboard refreshes on configurable interval (default 30 s); all three providers visible simultaneously |
| G3 | Show full per-provider plan stats: quota, used, remaining, reset time | Correct data shown for Alibaba DashScope, Minimax, and Z.AI plans |
| G4 | Web UI available on demand via `--web` flag, same data as TUI | Browser dashboard at `localhost:4242` while TUI remains usable in parallel |
| G5 | Zero additional credential management | Reads keys already present in `~/.local/share/opencode/auth.json`, `.env`, or the shell environment |
| G6 | Works alongside existing fallback proxy without disruption | Proxy on port 4141 unaffected; `omoctl` reads proxy logs as a secondary data source |

## 3. Non-Goals

- `omoctl` does **not** replace OpenCode or oh-my-openagent — it controls and observes them.
- `omoctl` does **not** execute code or make LLM calls on its own.
- `omoctl` does **not** manage billing or payment.
- `omoctl` does **not** support providers beyond the three in scope (Alibaba, Minimax, Z.AI) in v1.
- Mobile app or hosted SaaS — out of scope.

---

## 4. Users

**Primary:** You — a solo developer running 3–10 OpenCode agents simultaneously with multi-provider orchestration.

**Secondary:** Any developer using oh-my-openagent with more than one provider who wants a monitoring and control layer.

---

## 5. Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                        omoctl process                        │
│                                                             │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────────┐  │
│  │  CLI Layer  │   │  Core Engine │   │   Web Server    │  │
│  │  (commands) │──▶│  (state mgr) │──▶│  (--web flag)   │  │
│  └─────────────┘   └──────┬───────┘   └────────┬────────┘  │
│                           │                    │            │
│               ┌───────────┼──────────┐         │            │
│               ▼           ▼          ▼         ▼            │
│         ┌──────────┐ ┌───────┐ ┌────────┐ ┌──────────┐    │
│         │ Provider │ │ Config │ │ Proxy  │ │  React   │    │
│         │ Pollers  │ │ Writer │ │ Log    │ │  WebUI   │    │
│         │(3 APIs)  │ │(oh-my) │ │ Tailer │ │(port 4242│    │
│         └──────────┘ └────────┘ └────────┘ └──────────┘    │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │  SQLite DB  │                          │
│                    │ (tokentop-  │                          │
│                    │ compatible) │                          │
│                    └─────────────┘                          │
└────────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
  oh-my-opencode.json         fallback-proxy
  (hot-reloaded by            (port 4141,
   OpenCode)                   passthrough)
```

### Key Design Decisions

- **Runtime:** Bun (matches both tokentop and oh-my-openagent)
- **Storage:** SQLite via `bun:sqlite`, schema-compatible with tokentop so data can be shared
- **TUI:** OpenTUI (same framework as tokentop) for consistent look
- **Web UI:** Single-file React served by Bun's built-in HTTP server — no separate bundler needed
- **Config mutation:** Direct JSON/JSONC write to `~/.config/opencode/oh-my-opencode.json` via a safe atomic-write pattern (write to temp → rename)
- **IPC with proxy:** Tail `~/.config/opencode/proxy.log` for real-time per-provider request/error counts

---

## 6. Feature Specifications

### 6.1 CLI — Model Switching

**Command:** `omoctl set <role> <model>`

Rewrites the model assignment for a named agent role in `oh-my-opencode.json`, then signals OpenCode to hot-reload (SIGHUP or file-touch, whichever OpenCode supports).

```
# Examples
omoctl set sisyphus kimi-k2.5
omoctl set hephaestus gpt-5.3-codex
omoctl set prometheus qwen-max
omoctl set oracle z1-reasoning-pro
omoctl set quick qwen-turbo
omoctl set ultrabrain minimax-m1

# Shorthand aliases
omoctl set sis kimi        # fuzzy match on both role and model
omoctl set heph codex
```

**Supported roles** (maps directly to oh-my-openagent agent categories):

| Role Key | Agent | Purpose |
|----------|-------|---------|
| `sisyphus` / `sis` | Sisyphus | Main orchestrator |
| `hephaestus` / `heph` | Hephaestus | Autonomous deep worker |
| `prometheus` / `pro` | Prometheus | Strategic planner |
| `oracle` | Oracle | Architecture / debugging |
| `librarian` / `lib` | Librarian | Docs / code search |
| `explore` | Explore | Fast codebase grep |
| `quick` | Quick category | Single-file / typo fixes |
| `ultrabrain` | Ultrabrain category | Hard logic, architecture |
| `visual` | Visual-engineering category | Frontend, UI/UX |
| `deep` | Deep category | Autonomous research |

**Model registry** (built-in, auto-updated from `models.dev`):

| Alias | Full Model ID | Provider | Tier |
|-------|--------------|----------|------|
| `qwen-max` | `qwen-max` | Alibaba | smart |
| `qwen-turbo` | `qwen-turbo` | Alibaba | fast |
| `minimax-m1` | `MiniMax-M1` | Minimax | smart |
| `minimax-text` | `MiniMax-Text-01` | Minimax | fast |
| `z1-pro` | `z1-reasoning-pro` | Z.AI | smart |
| `z1` | `z1` | Z.AI | fast |
| `kimi-k2.5` | `kimi-k2.5` | Moonshot (via proxy) | smart |
| `glm-5` | `glm-5` | Z.AI GLM | smart |
| `gpt-5.3-codex` | `gpt-5.3-codex` | OpenAI | deep |
| `smart` | (proxy tier alias) | round-robin | smart |
| `fast` | (proxy tier alias) | round-robin | fast |

**Command:** `omoctl get [role]`

Print current model assignment for one or all roles.

```
omoctl get                     # print all role→model assignments
omoctl get sisyphus            # print just Sisyphus's current model
```

**Command:** `omoctl use <profile>`

Switch ALL roles to a pre-saved profile in one command.

```
omoctl use budget              # all roles → fast/cheap models
omoctl use performance         # all roles → flagship models
omoctl use kimi-heavy          # all roles → Kimi + GLM stack
omoctl use default             # restore oh-my-openagent defaults
```

Profiles are stored in `~/.config/omoctl/profiles.json`.

**Command:** `omoctl profile save <name>`

Save the current role→model assignments as a named profile.

```
omoctl profile save kimi-heavy
omoctl profile list
omoctl profile delete kimi-heavy
```

**Command:** `omoctl models [--provider <name>]`

List all known models, with tier, context window, cost/1M tokens, and current availability.

```
omoctl models
omoctl models --provider alibaba
omoctl models --tier smart
omoctl models --available          # only models whose API key is configured
```

---

### 6.2 TUI Dashboard

Launched by: `omoctl` (no flags) or `omoctl monitor`

The TUI is a tokentop-compatible terminal dashboard with additional panels specific to oh-my-openagent.

#### Layout

```
╔══════════════════════════════════════════════════════════════════╗
║  omoctl  •  oh-my-openagent control plane  •  2026-03-22 14:33  ║
╠═══════════════╦════════════════╦════════════════╦════════════════╣
║  ALIBABA      ║  MINIMAX       ║  Z.AI          ║  PROXY         ║
║  qwen-max     ║  MiniMax-M1    ║  z1-pro        ║  round-robin   ║
║  ████░░ 62%   ║  ██░░░░ 34%    ║  █░░░░░ 18%    ║  3 providers   ║
║  $12.40 today ║  $4.80 today   ║  $2.10 today   ║  47 req today  ║
║  Reset: 9h12m ║  Reset: 3h44m  ║  Reset: 21h8m  ║  0 errors      ║
╠═══════════════╩════════════════╩════════════════╩════════════════╣
║  AGENT ROLES                                                      ║
║  sisyphus      kimi-k2.5         ████ 12.4k tok  $0.62  active   ║
║  hephaestus    gpt-5.3-codex     ██░░  4.1k tok  $0.28  idle     ║
║  prometheus    qwen-max          █░░░  1.8k tok  $0.09  idle     ║
║  oracle        z1-reasoning-pro  ░░░░     0 tok  $0.00  idle     ║
║  quick         qwen-turbo        ██░░  3.2k tok  $0.04  active   ║
╠══════════════════════════════════════════════════════════════════╣
║  SESSIONS (last 24h)                                   [/filter]  ║
║  14:28  sisyphus     kimi-k2.5    48.2k / 131k ctx  $2.41  done  ║
║  14:15  hephaestus   codex         9.1k /  32k ctx  $0.91  done  ║
║  13:44  quick        qwen-turbo    2.1k /   8k ctx  $0.02  done  ║
╠═══════════════════════════════════════════════════════════════════╣
║  [1]Dashboard [2]Plans [3]Trends [4]Roles [5]Proxy  [?]Help [q]  ║
╚═══════════════════════════════════════════════════════════════════╝
```

#### Views

| Key | View | Contents |
|-----|------|----------|
| `1` | **Dashboard** | KPI strip, provider gauges, agent roles table, recent sessions |
| `2` | **Plans** | Per-provider coding plan: name, quota, used, remaining, reset time, RPM/RPD limits |
| `3` | **Trends** | Cost and token sparklines per provider and per agent role over 7/30/90 days |
| `4` | **Roles** | Full agent role table with interactive model reassignment |
| `5` | **Proxy** | Fallback proxy status: request log, error counts, round-robin cursor, per-provider success rate |

#### Interactive model switching from TUI

In **View 4 (Roles)**:
- Navigate rows with `j`/`k`
- Press `Enter` or `e` to open model picker for the selected role
- Model picker is a fuzzy-searchable list showing model name, provider, context size, cost/1M tokens
- Confirm with `Enter` — writes config and reloads immediately

#### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `1`–`5` | Switch views |
| `r` | Force-refresh all provider APIs |
| `e` | Edit model for selected role (View 4) |
| `p` | Switch to profile (opens profile picker) |
| `/` | Filter sessions or models |
| `s` | Cycle sort column |
| `j`/`k` | Navigate rows |
| `Enter` | Open detail / edit |
| `i` | Toggle sidebar |
| `t` | Cycle time window |
| `,` | Settings |
| `?` | Help overlay |
| `q` | Quit |

---

### 6.3 Plans View — Coding Plan Stats

**View 2** is the centerpiece for your use case. For each provider it shows:

#### Per-Provider Plan Panel

```
╔══════════════════════════════════════════════╗
║  ALIBABA DASHSCOPE                           ║
║  Plan:       DashScope Pay-As-You-Go         ║
║  ─────────────────────────────────────────── ║
║  Quota Type    Used         Limit    Reset   ║
║  RPM           42 / min     60       —       ║
║  RPD           1,240 / day  5,000    in 9h   ║
║  TPM           84k / min    120k     —       ║
║  TPD           2.1M / day   5M       in 9h   ║
║  ─────────────────────────────────────────── ║
║  Monthly spend:  $48.20 / $200.00 budget     ║
║  ████████░░░░░░░░░░░░░░░░  24%               ║
║                                              ║
║  Models active this session:                 ║
║    qwen-max      8 req   48.2k tok  $2.41    ║
║    qwen-turbo   14 req   12.1k tok  $0.24    ║
╚══════════════════════════════════════════════╝
```

**Data sourced from:**
- Alibaba: DashScope usage API (`/api/v1/services/aigc/usage`)
- Minimax: Minimax platform usage API
- Z.AI: Z.AI account API
- Fallback: Parse proxy log for request counts if provider API lacks usage endpoint

**Reset time calculation:** Displayed as countdown (`in 9h 12m`) for daily/monthly quotas, and as next-minute marker for RPM limits.

---

### 6.4 Web UI (`--web` flag)

**Launch:** `omoctl --web` or `omoctl monitor --web`

Starts the TUI in the terminal **and** serves a React web dashboard at `http://localhost:4242`.

The web UI is a single HTML file compiled by Bun, served by Bun's built-in HTTP server. No separate process. No bundler at runtime.

#### Web UI pages

**`/` — Overview Dashboard**
- Responsive card grid: one card per provider
- Each card: plan name, quota gauges (RPM/RPD/TPM), spend progress bar, reset countdown, active model list
- Auto-refreshes every 30 seconds (configurable)
- Color-coded status: green < 50%, amber 50–80%, red > 80% of quota

**`/roles` — Agent Roles**
- Table of all agent roles with current model assignment
- Inline dropdown to change model per role — writes `oh-my-opencode.json` via the omoctl API
- Live "active" indicator if the agent is currently in a session
- Last-used timestamp and total spend per role

**`/sessions` — Session History**
- Filterable, sortable table of all sessions
- Columns: timestamp, agent, model, provider, input tokens, output tokens, cached tokens, cost, duration, status
- Click a session row to expand: full token breakdown, per-message cost waterfall, cache hit rate
- Export to CSV

**`/trends` — Historical Charts**
- Line charts (Chart.js): cost and tokens per day, per provider and per agent role
- Time range selector: 7d / 30d / 90d
- Stacked view (all providers) and per-provider breakdown

**`/plans` — Coding Plans**
- Full per-provider plan detail page
- Quota progress bars with reset countdowns
- Model-level breakdown: requests, tokens, cost for the current period

**`/proxy` — Proxy Status**
- Live log stream from fallback proxy
- Per-provider: total requests, errors, timeouts, success rate, average latency
- Round-robin cursor: which provider is "next up"
- Button to pause/resume proxy (sends SIGUSR1 to proxy process)

#### Web API

The web UI is backed by a JSON REST API served by omoctl on the same port:

```
GET  /api/providers            → all provider stats + plan info
GET  /api/providers/:id        → single provider detail
GET  /api/roles                → all role→model assignments
POST /api/roles/:role          → { model: "..." } → update role model
GET  /api/sessions             → session history (paginated)
GET  /api/sessions/:id         → session detail
GET  /api/trends               → aggregated cost/token history
GET  /api/proxy/status         → proxy health + per-provider stats
GET  /api/proxy/log            → SSE stream of proxy log lines
GET  /api/models               → known model registry
GET  /api/profiles             → saved role profiles
POST /api/profiles/:name       → save current roles as profile
POST /api/profiles/:name/apply → apply profile to all roles
```

All endpoints return JSON. SSE endpoint (`/api/proxy/log`) streams newline-delimited JSON events.

---

### 6.5 Configuration

Config file: `~/.config/omoctl/config.json`

```jsonc
{
  // Providers to poll and display
  "providers": {
    "alibaba": {
      "enabled": true,
      "apiKey": "{env:ALIBABA_API_KEY}",
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "plan": "pay-as-you-go",
      "budgets": {
        "daily": 20.00,
        "monthly": 200.00
      }
    },
    "minimax": {
      "enabled": true,
      "apiKey": "{env:MINIMAX_API_KEY}",
      "baseUrl": "https://api.minimax.io/v1",
      "plan": "standard"
    },
    "zai": {
      "enabled": true,
      "apiKey": "{env:ZAI_API_KEY}",
      "baseUrl": "https://api.z.ai/v1",
      "plan": "glm-coding"
    }
  },

  // Path to oh-my-openagent config to mutate
  "ohMyOpenagentConfig": "~/.config/opencode/oh-my-opencode.json",

  // Path to fallback proxy log
  "proxyLog": "~/.config/opencode/proxy.log",

  // Web UI settings (only used when --web is passed)
  "web": {
    "port": 4242,
    "host": "127.0.0.1",
    "openBrowser": true       // auto-open browser on start
  },

  // Polling interval for provider APIs (ms)
  "refreshInterval": 30000,

  // TUI theme (inherits tokentop themes: tokyo-night, dracula, nord)
  "theme": "tokyo-night",

  // Budget alert thresholds (0.0–1.0)
  "alertThresholds": {
    "warn": 0.75,
    "critical": 0.90
  },

  // SQLite database path (tokentop-compatible schema)
  "database": "~/.local/share/omoctl/data.db"
}
```

---

## 7. Data Model

### SQLite Schema

```sql
-- Provider plans and quota snapshots
CREATE TABLE provider_snapshots (
  id           INTEGER PRIMARY KEY,
  provider     TEXT NOT NULL,        -- 'alibaba' | 'minimax' | 'zai'
  plan_name    TEXT,
  rpm_used     INTEGER,
  rpm_limit    INTEGER,
  rpd_used     INTEGER,
  rpd_limit    INTEGER,
  tpm_used     INTEGER,
  tpm_limit    INTEGER,
  tpd_used     INTEGER,
  tpd_limit    INTEGER,
  spend_today  REAL,
  spend_month  REAL,
  quota_resets_at TEXT,              -- ISO8601
  sampled_at   TEXT NOT NULL         -- ISO8601
);

-- Agent role assignments (history of changes)
CREATE TABLE role_assignments (
  id         INTEGER PRIMARY KEY,
  role       TEXT NOT NULL,
  model      TEXT NOT NULL,
  provider   TEXT NOT NULL,
  assigned_at TEXT NOT NULL,         -- ISO8601
  assigned_by TEXT DEFAULT 'cli'     -- 'cli' | 'tui' | 'web' | 'profile'
);

-- Sessions (tokentop-compatible + role column added)
CREATE TABLE sessions (
  id             TEXT PRIMARY KEY,
  agent_role     TEXT,               -- oh-my-openagent role name
  agent_name     TEXT,               -- display name (Sisyphus, etc.)
  model          TEXT NOT NULL,
  provider       TEXT NOT NULL,
  input_tokens   INTEGER DEFAULT 0,
  output_tokens  INTEGER DEFAULT 0,
  cache_tokens   INTEGER DEFAULT 0,
  cost_usd       REAL DEFAULT 0.0,
  duration_ms    INTEGER,
  status         TEXT DEFAULT 'active',   -- 'active' | 'done' | 'error'
  project_path   TEXT,
  started_at     TEXT NOT NULL,
  ended_at       TEXT
);

-- Proxy request log (aggregated per minute)
CREATE TABLE proxy_stats (
  id           INTEGER PRIMARY KEY,
  provider     TEXT NOT NULL,
  minute       TEXT NOT NULL,        -- ISO8601 truncated to minute
  requests     INTEGER DEFAULT 0,
  errors       INTEGER DEFAULT 0,
  timeouts     INTEGER DEFAULT 0,
  avg_latency_ms INTEGER
);

-- Named profiles
CREATE TABLE profiles (
  name        TEXT PRIMARY KEY,
  assignments TEXT NOT NULL,         -- JSON blob: {role: model, ...}
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
```

---

## 8. Provider Integration Details

### 8.1 Alibaba DashScope

**Usage endpoint:** `GET https://dashscope.aliyuncs.com/api/v1/services/aigc/usage`  
**Auth:** `Authorization: Bearer $ALIBABA_API_KEY`  
**Quota fields:** `rpm`, `rpd`, `tpm`, `tpd` per model  
**Reset cadence:** RPM resets every minute (wall clock); RPD/TPD reset at UTC midnight  
**Plan detection:** Parse `plan` field from account info endpoint

### 8.2 Minimax

**Usage endpoint:** `GET https://api.minimax.io/v1/account/usage` (confirm exact path in dashboard)  
**Auth:** `Authorization: Bearer $MINIMAX_API_KEY`  
**Quota fields:** Token quota (monthly), request quota per model  
**Reset cadence:** Monthly (billing cycle start date)  
**Plan detection:** `subscription.plan_name` from account endpoint

### 8.3 Z.AI (GLM / Z1)

**Usage endpoint:** `GET https://api.z.ai/v1/account/usage` (confirm exact path)  
**Auth:** `Authorization: Bearer $ZAI_API_KEY`  
**Quota fields:** Token quota per coding plan tier (GLM Coding Plan, Z1 Pro, etc.)  
**Reset cadence:** Monthly  
**Plan detection:** `account.plan` from account endpoint

> **Implementation note:** If a provider's usage API is unavailable or returns insufficient data, omoctl falls back to computing usage from the proxy log + local session records. The UI clearly labels this as "estimated."

---

## 9. Integration with tokentop

`omoctl` is designed for side-by-side use with tokentop, not as a replacement:

| Concern | Tool |
|---------|------|
| All providers (10+) including Anthropic, OpenAI, Gemini | tokentop |
| oh-my-openagent role → model assignment | **omoctl** |
| Quick CLI model switching | **omoctl** |
| Rate limits and plan quota for Alibaba/Minimax/Z.AI | **omoctl** |
| Fallback proxy monitoring | **omoctl** |
| Budget alerts across all providers | tokentop |
| Historical cost trends (all providers) | tokentop |

**Shared database:** If tokentop's SQLite path is configured and accessible, omoctl can read session records from it to avoid double-polling. The `sessions` table schema in omoctl adds two columns (`agent_role`, `agent_name`) on top of tokentop's schema; the migration is additive and non-breaking.

---

## 10. oh-my-openagent Config Integration

omoctl reads and writes `oh-my-opencode.json` (JSONC-aware) at the path configured in `ohMyOpenagentConfig`. It uses an atomic write pattern:

1. Parse current JSONC to AST (preserving comments)
2. Mutate only the targeted `model` field under the relevant agent block
3. Write to a temp file in the same directory
4. `rename()` temp → original (atomic on POSIX)

**Relevant config paths in `oh-my-opencode.json`:**

```jsonc
{
  "agents": {
    "sisyphus": { "model": "kimi-k2.5" },          // ← omoctl writes here
    "hephaestus": { "model": "gpt-5.3-codex" },
    "prometheus": { "model": "qwen-max" }
  },
  "categories": {
    "quick": { "model": "qwen-turbo" },
    "ultrabrain": { "model": "z1-reasoning-pro" },
    "visual-engineering": { "model": "MiniMax-M1" },
    "deep": { "model": "gpt-5.3-codex" }
  }
}
```

omoctl also watches this file with `fs.watch` so any external edits (manual or by another tool) are reflected in the TUI and web UI immediately.

---

## 11. Fallback Proxy Integration

omoctl integrates with `fallback-proxy.js` (the round-robin proxy built earlier) via:

1. **Log tailing:** `fs.watch` on `~/.config/opencode/proxy.log` — parses structured JSON log lines for per-provider request counts, errors, latencies
2. **Health polling:** `GET http://localhost:4141/health` every 30 s — returns current round-robin cursor and per-provider counters
3. **Process management:** omoctl can start/stop the proxy via `Bun.spawn` if it's not already running (opt-in, disabled by default)

The **View 5 (Proxy)** TUI panel and `/proxy` web page both source from this integration.

---

## 12. CLI Reference (Full)

```
omoctl [command] [options]

MONITORING
  omoctl                        Launch TUI dashboard
  omoctl monitor                Same as above
  omoctl monitor --web          TUI + web UI on port 4242
  omoctl --web                  Same as above

MODEL MANAGEMENT
  omoctl set <role> <model>     Assign model to agent role
  omoctl get [role]             Show current model(s)
  omoctl models                 List all known models
  omoctl models --provider <p>  Filter by provider
  omoctl models --tier <t>      Filter by tier (smart/fast)
  omoctl models --available     Only models with configured keys

PROFILES
  omoctl use <profile>          Apply saved profile to all roles
  omoctl profile save <name>    Save current assignments as profile
  omoctl profile list           List all saved profiles
  omoctl profile show <name>    Show a profile's assignments
  omoctl profile delete <name>  Delete a saved profile

PROVIDER STATS (non-interactive)
  omoctl status                 Print current provider status (JSON)
  omoctl status --provider <p>  Single provider status
  omoctl plans                  Print coding plan quota for all providers
  omoctl plans --json           Machine-readable JSON output

PROXY
  omoctl proxy status           Print proxy health
  omoctl proxy start            Start the fallback proxy (if not running)
  omoctl proxy stop             Stop the fallback proxy
  omoctl proxy log              Tail proxy log (live, formatted)

CONFIG
  omoctl config                 Open config in $EDITOR
  omoctl config path            Print config file path
  omoctl config validate        Validate current config

GLOBAL FLAGS
  --web                         Also start web UI on port 4242
  --web-port <port>             Override web UI port
  --no-tui                      Skip TUI, print to stdout (for scripting)
  --json                        Output JSON instead of formatted text
  --config <path>               Use alternate config file
  --refresh <ms>                Override polling interval
  --theme <name>                TUI theme (tokyo-night/dracula/nord)
  -v, --version                 Print version
  -h, --help                    Show help
```

---

## 13. Installation

```bash
# Prerequisites: Bun v1.0+
# Clone alongside tokentop
git clone https://github.com/YOUR_ORG/omoctl.git
cd omoctl
bun install

# Link globally
bun link

# First run — auto-discovers keys from environment
omoctl config validate
omoctl
```

**Required environment variables** (same as fallback proxy):

```bash
export ALIBABA_API_KEY="sk-..."
export MINIMAX_API_KEY="..."
export ZAI_API_KEY="..."
```

`omoctl` will also pick up whatever is already in `~/.local/share/opencode/auth.json` (tokentop's discovery logic, imported directly).

---

## 14. Milestones

### v0.1 — CLI Core
- [ ] `omoctl set / get / models` commands
- [ ] Atomic config writer for `oh-my-opencode.json`
- [ ] Profile save/load/apply
- [ ] `omoctl plans --json` (raw quota fetch from all three providers)

### v0.2 — TUI
- [ ] Views 1–4 (Dashboard, Plans, Trends, Roles)
- [ ] Interactive model picker in Roles view
- [ ] Provider API pollers with retry + backoff
- [ ] SQLite persistence

### v0.3 — Proxy Integration
- [ ] View 5 (Proxy) in TUI
- [ ] Log tailer + health poller for `fallback-proxy.js`
- [ ] `omoctl proxy` subcommands

### v0.4 — Web UI
- [ ] `--web` flag spins up Bun HTTP server
- [ ] All six web pages: Overview, Roles, Sessions, Trends, Plans, Proxy
- [ ] REST API backing all pages
- [ ] SSE log stream for proxy view
- [ ] Auto-open browser on start

### v0.5 — tokentop Bridge
- [ ] Read sessions from tokentop SQLite if configured
- [ ] Unified trends combining tokentop's 10-provider data with omoctl's role data
- [ ] `omoctl` TUI theme consistency with tokentop

### v1.0 — Release
- [ ] Full test coverage on config writer and provider pollers
- [ ] README and usage docs
- [ ] `bun build` single-binary output
- [ ] Homebrew formula

---

## 15. Open Questions

| # | Question | Owner | Target |
|---|----------|-------|--------|
| OQ1 | Does OpenCode hot-reload `oh-my-opencode.json` on file change, or does it require a restart? | Verify with OpenCode source | v0.1 |
| OQ2 | Which Minimax endpoint exposes per-model RPM/RPD quota? | Test against live Minimax API | v0.2 |
| OQ3 | Z.AI usage API path and auth format for the GLM Coding Plan | Test against live Z.AI account | v0.2 |
| OQ4 | Should the web UI be accessible on LAN (non-loopback) with a flag? | You | v0.4 |
| OQ5 | Should omoctl write to the proxy's provider registry (add/remove providers) or treat it as read-only? | You | v0.3 |
| OQ6 | Multi-machine setup: is there a use case for omoctl running on a remote server? | You | v1.0 |

---

## 16. Related Files

| File | Role |
|------|------|
| `~/.config/opencode/fallback-proxy.js` | Round-robin provider proxy (port 4141) |
| `~/.config/opencode/oh-my-opencode.json` | oh-my-openagent config — omoctl reads/writes this |
| `~/.config/omoctl/config.json` | omoctl's own config |
| `~/.local/share/omoctl/data.db` | SQLite database |
| `~/.config/opencode/proxy.log` | Fallback proxy log — omoctl tails this |
| `~/.local/share/opencode/auth.json` | OpenCode OAuth tokens — omoctl reads (credential discovery) |

---

*End of PRD — omoctl v1.0.0-draft*
