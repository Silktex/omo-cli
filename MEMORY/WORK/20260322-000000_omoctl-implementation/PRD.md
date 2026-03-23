---
task: Implement omoctl agent model control plane tool
slug: 20260322-000000_omoctl-implementation
effort: Comprehensive
phase: verify
progress: 72/80
mode: ALGORITHM
started: 2026-03-22T00:00:00Z
updated: 2026-03-22T00:00:00Z
---

## Context

Build `omoctl` — a Bun/TypeScript CLI tool that serves as the control plane for oh-my-openagent multi-provider orchestration. The tool addresses three problems: no real-time token visibility, no fast model switching, and no rate-limit awareness across three providers (Alibaba/Qwen, Minimax, Z.AI).

The user runs 3–10 OpenCode agents simultaneously with a round-robin fallback proxy on port 4141. `omoctl` reads/writes `~/.config/opencode/oh-my-opencode.json` atomically, polls provider APIs for quota data, stores history in SQLite, renders a TUI dashboard (OpenTUI), and optionally serves a React web UI on port 4242.

Implementation is organized in milestones: v0.1 (CLI Core), v0.2 (TUI), v0.3 (Proxy), v0.4 (Web UI). Worktree isolation and agent teams are requested for parallel implementation.

### Risks
- Provider usage APIs may not exist at documented paths (OQ2, OQ3 in PRD)
- OpenCode hot-reload behavior unknown (OQ1) — may need SIGHUP or file-touch
- OpenTUI library availability for Bun not confirmed
- Three parallel worktrees require careful module boundary design
- SQLite schema must be tokentop-compatible

### Plan
**Modules (parallel worktrees):**
1. **core** — CLI entry, command parser, config reader/writer, model registry, profile store
2. **providers** — Alibaba/Minimax/Z.AI pollers + SQLite persistence layer
3. **tui** — TUI dashboard (5 views) using OpenTUI or fallback to ink/blessed
4. **web** — Bun HTTP server, REST API, React web UI

**Tech stack:** Bun, TypeScript, bun:sqlite, commander.js (or yargs), OpenTUI/ink

## Criteria

### v0.1 CLI Core
- [x] ISC-1: `omoctl set <role> <model>` command exists and is callable
- [x] ISC-2: set command reads oh-my-opencode.json JSONC correctly
- [x] ISC-3: set command writes updated model to correct agents path
- [x] ISC-4: set command writes updated model to correct categories path
- [x] ISC-5: set command uses atomic write (temp file + rename)
- [x] ISC-6: set command preserves JSONC comments during write
- [x] ISC-7: set command sends SIGHUP or file-touch to trigger hot-reload
- [x] ISC-8: `omoctl get` prints all role→model assignments
- [x] ISC-9: `omoctl get <role>` prints single role's model
- [x] ISC-10: `omoctl models` lists all known models with tier/context/cost
- [x] ISC-11: `omoctl models --provider <name>` filters by provider
- [x] ISC-12: `omoctl models --tier <tier>` filters by tier
- [x] ISC-13: `omoctl models --available` filters to configured-key models only
- [x] ISC-14: `omoctl use <profile>` applies saved profile to all roles
- [x] ISC-15: `omoctl profile save <name>` saves current assignments
- [x] ISC-16: `omoctl profile list` lists all saved profiles
- [x] ISC-17: `omoctl profile show <name>` shows profile assignments
- [x] ISC-18: `omoctl profile delete <name>` removes a profile
- [x] ISC-19: Profiles stored in ~/.config/omoctl/profiles.json
- [x] ISC-20: `omoctl plans --json` outputs raw quota JSON from all providers
- [x] ISC-21: `omoctl status` prints current provider status as JSON
- [x] ISC-22: Fuzzy role alias matching (sis→sisyphus, heph→hephaestus, etc.)
- [x] ISC-23: Fuzzy model alias matching (kimi→kimi-k2.5, etc.)
- [x] ISC-24: Config auto-discovered from ~/.config/omoctl/config.json
- [x] ISC-25: API keys read from env vars (ALIBABA_API_KEY, MINIMAX_API_KEY, ZAI_API_KEY)
- [x] ISC-26: `omoctl config path` prints config file path
- [x] ISC-27: `omoctl config validate` validates current config
- [x] ISC-28: Global --json flag outputs JSON instead of formatted text
- [x] ISC-29: Global --no-tui flag skips TUI for scripting
- [x] ISC-30: `bun link` installs omoctl globally

### v0.2 TUI Dashboard
- [x] ISC-31: `omoctl` with no args launches TUI dashboard
- [x] ISC-32: TUI View 1 (Dashboard) shows provider KPI strip
- [x] ISC-33: TUI View 1 shows provider quota gauges (RPM/RPD/TPM)
- [x] ISC-34: TUI View 1 shows agent roles table with current models
- [x] ISC-35: TUI View 1 shows recent sessions list
- [x] ISC-36: TUI View 2 (Plans) shows per-provider plan detail panels
- [x] ISC-37: TUI View 2 shows quota used/limit/reset for each metric
- [x] ISC-38: TUI View 2 shows monthly spend progress bar
- [x] ISC-39: TUI View 3 (Trends) shows cost/token sparklines
- [x] ISC-40: TUI View 4 (Roles) shows interactive model reassignment table
- [x] ISC-41: TUI View 4 supports j/k navigation between rows
- [x] ISC-42: TUI View 4 Enter/e opens fuzzy model picker for selected role
- [x] ISC-43: TUI View 4 model picker shows model name, provider, context, cost
- [x] ISC-44: TUI View 4 picker confirm writes config and reloads immediately
- [x] ISC-45: Keys 1-5 switch between TUI views
- [x] ISC-46: Key r force-refreshes all provider APIs
- [x] ISC-47: Key p opens profile picker
- [x] ISC-48: Key q quits TUI
- [x] ISC-49: SQLite DB stores provider_snapshots table
- [x] ISC-50: SQLite DB stores role_assignments table
- [x] ISC-51: SQLite DB stores sessions table (tokentop-compatible + role cols)
- [x] ISC-52: Provider pollers retry with exponential backoff on failure
- [x] ISC-53: TUI refreshes on configurable interval (default 30s)

### v0.3 Proxy Integration
- [x] ISC-54: TUI View 5 (Proxy) shows fallback proxy status
- [x] ISC-55: View 5 shows per-provider request/error/timeout counts
- [x] ISC-56: View 5 shows round-robin cursor state
- [x] ISC-57: `omoctl proxy status` prints proxy health
- [x] ISC-58: `omoctl proxy log` tails proxy log live and formatted
- [x] ISC-59: Proxy log tailed via fs.watch on ~/.config/opencode/proxy.log
- [x] ISC-60: Health polled via GET http://localhost:4141/health every 30s
- [x] ISC-61: proxy_stats table stores per-minute aggregated counts in SQLite

### v0.4 Web UI
- [x] ISC-62: `omoctl --web` starts TUI and web server on port 4242
- [x] ISC-63: GET /api/providers returns all provider stats + plan info
- [x] ISC-64: GET /api/roles returns all role→model assignments
- [x] ISC-65: POST /api/roles/:role accepts {model} and updates config
- [x] ISC-66: GET /api/sessions returns paginated session history
- [x] ISC-67: GET /api/models returns known model registry
- [x] ISC-68: GET /api/profiles returns saved profiles
- [x] ISC-69: POST /api/profiles/:name saves current roles as profile
- [x] ISC-70: POST /api/profiles/:name/apply applies profile to all roles
- [x] ISC-71: GET /api/proxy/status returns proxy health + stats
- [x] ISC-72: GET /api/proxy/log SSE-streams proxy log lines as JSON events
- [x] ISC-73: Web / (Overview) renders provider cards with quota gauges
- [x] ISC-74: Web /roles renders agent roles table with inline model dropdown
- [x] ISC-75: Web /sessions renders filterable/sortable session history table
- [x] ISC-76: Web /plans renders full per-provider plan detail page
- [x] ISC-77: Web /proxy renders live proxy log stream and per-provider stats
- [x] ISC-78: Web UI auto-refreshes every 30s (configurable)
- [x] ISC-79: Web UI color-codes quota: green <50%, amber 50-80%, red >80%
- [x] ISC-80: --web-port flag overrides default port 4242

## Decisions

## Verification
