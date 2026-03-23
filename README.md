# omoctl

**Agent model control plane for oh-my-openagent.**

Switch models, monitor quotas, and manage agent roles across Alibaba DashScope, Minimax, and Z.AI — all from one terminal-native tool.

```
omoctl set sisyphus kimi-k2.5
omoctl get
omoctl plans
omoctl monitor
```

---

## What it solves

You run multiple OpenCode agents simultaneously via [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) with a round-robin fallback proxy across three providers. Without omoctl you have three disconnected problems:

1. **No real-time visibility** — you don't know which agent is burning tokens, on which provider, at what rate.
2. **No fast model switching** — reassigning a model to an agent role (Sisyphus, Hephaestus, Prometheus, etc.) requires manually editing `oh-my-opencode.json` and restarting OpenCode.
3. **No rate-limit awareness** — you can't see which providers are near their limits without visiting three separate dashboards.

`omoctl` collapses all three into one tool.

---

## Installation

### Prerequisites

- [Bun](https://bun.sh) v1.0 or later
- oh-my-openagent configured at `~/.config/opencode/oh-my-opencode.json`
- [tokentop](https://github.com/tokentopapp/tokentop) *(optional but recommended — see below)*

### Install omoctl

```bash
git clone https://github.com/Silktex/omo-cli.git
cd omo-cli
bun install
bun link

# Create global binary
ln -sf "$(pwd)/src/index.ts" ~/.bun/bin/omoctl
chmod +x src/index.ts
```

Verify:

```bash
omoctl --help
omoctl config validate
```

### Install tokentop (optional)

tokentop is a terminal token-usage monitor for 10+ providers (Anthropic, OpenAI, Gemini, and more). omoctl and tokentop are complementary — tokentop covers all providers broadly, omoctl covers Alibaba/Minimax/Z.AI deeply with role-level control.

```bash
git clone https://github.com/tokentopapp/tokentop.git
cd tokentop
bun install
bun link

# Create global binary
ln -sf "$(pwd)/src/index.ts" ~/.bun/bin/tokentop
chmod +x src/index.ts
```

Or if tokentop has a published release:

```bash
bun install -g tokentop
```

**Shared database:** If you point both tools at the same SQLite file, omoctl can read tokentop's session records to avoid double-polling. Set in `~/.config/omoctl/config.json`:

```jsonc
{
  "database": "~/.local/share/tokentop/data.db"
}
```

omoctl's schema is a superset of tokentop's — it adds `agent_role` and `agent_name` columns to the `sessions` table without breaking tokentop reads.

### Environment variables

```bash
export ALIBABA_API_KEY="sk-..."
export MINIMAX_API_KEY="eyJ..."
export ZAI_API_KEY="..."
```

omoctl reads these at startup. No separate config file required for basic use.

### Tool comparison

| Capability | omoctl | tokentop |
|-----------|--------|----------|
| Alibaba / Minimax / Z.AI quota | ✓ | — |
| Anthropic / OpenAI / Gemini monitoring | — | ✓ |
| oh-my-openagent role → model switching | ✓ | — |
| Fallback proxy monitoring | ✓ | — |
| Budget alerts (all providers) | — | ✓ |
| Historical cost trends (all providers) | — | ✓ |
| Interactive TUI dashboard | ✓ | ✓ |
| Web UI | ✓ | — |

Run them side by side — they share a SQLite schema and don't conflict.

---

### For LLMs

> **This section is written for AI coding assistants (Claude Code, Cursor, Copilot, etc.) that need to install, configure, or use omoctl on behalf of a user.**

#### What omoctl is

`omoctl` is a Bun/TypeScript CLI tool. The entry point is `src/index.ts`. It runs directly with Bun — no build step required. The global binary at `~/.bun/bin/omoctl` is a symlink to `src/index.ts`.

#### How to install (LLM instructions)

```bash
# 1. Clone the repo
git clone https://github.com/Silktex/omo-cli.git /home/$USER/projects/omo-cli
cd /home/$USER/projects/omo-cli

# 2. Install dependencies
bun install

# 3. Link globally
ln -sf "$(pwd)/src/index.ts" ~/.bun/bin/omoctl
chmod +x src/index.ts

# 4. Verify
omoctl --help
```

If `~/.bun/bin` is not in PATH, add it:

```bash
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

#### How omoctl works — architecture

```
src/
  index.ts              — CLI entry point (commander.js)
  types.ts              — shared TypeScript types
  constants.ts          — AGENT_ROLES registry, MODEL_REGISTRY, paths

  cli/
    set.ts              — omoctl set <role> <model>
    get.ts              — omoctl get [role]
    models.ts           — omoctl models [--provider] [--tier] [--available]
    plans.ts            — omoctl plans + omoctl status
    profile.ts          — omoctl use/profile save/list/show/delete
    config-cmd.ts       — omoctl config [path|validate]
    proxy-cmd.ts        — omoctl proxy status/log/start/stop

  core/
    ohmy.ts             — reads/writes oh-my-opencode.json atomically (JSONC-aware)
    config.ts           — loads ~/.config/omoctl/config.json with defaults
    registry.ts         — model registry + fuzzy lookup (fuse.js)
    roles.ts            — agent role registry + fuzzy alias matching
    profiles.ts         — named profile store at ~/.config/omoctl/profiles.json

  db/
    schema.ts           — SQLite schema init (bun:sqlite, 5 tables)
    queries.ts          — typed query helpers

  providers/
    poller.ts           — Alibaba / Minimax / Z.AI API pollers

  tui/
    App.tsx             — root ink component, keyboard bindings, polling loop
    launch.ts           — renders the ink TUI
    views/              — Dashboard, Plans, Trends, Roles, Proxy views
    components/         — ProviderCard

  web/
    api.ts              — 12 REST API handlers + SSE + single-file React HTML
    server.ts           — Bun.serve() wrapper, opens browser on start
```

#### Key file: oh-my-opencode.json

omoctl reads and writes `~/.config/opencode/oh-my-opencode.json`. The format is:

```json
{
  "agents": {
    "sisyphus":    { "model": "minimax-coding-plan/MiniMax-M2.7" },
    "hephaestus":  { "model": "openai/gpt-5.3-codex" },
    "prometheus":  { "model": "zai-coding-plan/glm-5" }
  },
  "categories": {
    "quick":       { "model": "zai-coding-plan/glm-4.7-flashx" },
    "ultrabrain":  { "model": "minimax-coding-plan/MiniMax-M2.7" }
  }
}
```

Model strings follow the format `provider-prefix/model-id`:

| Provider prefix         | Provider   |
|------------------------|------------|
| `alibaba-coding-plan`  | Alibaba    |
| `minimax-coding-plan`  | Minimax    |
| `zai-coding-plan`      | Z.AI       |
| `openai`               | OpenAI     |

When you run `omoctl set sisyphus glm-5`, omoctl:
1. Fuzzy-matches "sisyphus" to the `agents.sisyphus` key
2. Fuzzy-matches "glm-5" to `modelId: "glm-5", provider: "zai"` in the MODEL_REGISTRY
3. Builds the full string `zai-coding-plan/glm-5`
4. Uses `jsonc-parser` to apply only that edit (preserving comments and formatting)
5. Writes to a temp file then renames atomically
6. Sends SIGHUP to any running `opencode` process

#### SQLite database

Located at `~/.local/share/omoctl/data.db`. Tables:

| Table                | Purpose                                         |
|---------------------|-------------------------------------------------|
| `provider_snapshots` | Quota/spend data polled from provider APIs      |
| `role_assignments`   | History of every `set` operation               |
| `sessions`           | Session records (tokentop-compatible + role cols)|
| `proxy_stats`        | Per-minute aggregated proxy request counts      |
| `profiles`           | Named role→model assignment profiles           |

#### Config file

`~/.config/omoctl/config.json` — auto-created with defaults on first validation. Key fields:

```jsonc
{
  "ohMyOpenagentConfig": "~/.config/opencode/oh-my-opencode.json",
  "proxyLog":            "~/.config/opencode/proxy.log",
  "refreshInterval":     30000,
  "web": { "port": 4242, "host": "127.0.0.1", "openBrowser": true },
  "database":            "~/.local/share/omoctl/data.db"
}
```

#### Common LLM tasks

**Switch a model for an agent:**
```bash
omoctl set <role> <model>
# Examples:
omoctl set sisyphus qwen-max
omoctl set sis kimi-k2.5       # fuzzy alias
omoctl set heph glm-5
omoctl set quick glm-4.7-flashx
```

**Read current assignments:**
```bash
omoctl get               # all roles
omoctl get sisyphus      # single role
omoctl get --json        # machine-readable
```

**Save and apply profiles:**
```bash
omoctl profile save my-profile
omoctl use my-profile
omoctl profile list
```

**Check provider quotas:**
```bash
omoctl plans             # pretty-print all providers
omoctl plans --json      # JSON for parsing
omoctl status            # cached status from DB
```

**Launch the TUI dashboard:**
```bash
omoctl monitor           # TUI only
omoctl monitor --web     # TUI + web UI on port 4242
omoctl --no-tui          # JSON output, no TUI (scriptable)
```

**Web UI (when --web is active):**
- `http://localhost:4242/` — overview
- `GET  /api/providers`       — provider stats
- `GET  /api/roles`           — role assignments
- `POST /api/roles/:role`     — `{ "model": "glm-5" }` to change model
- `GET  /api/models`          — model registry
- `GET  /api/proxy/log`       — SSE stream of proxy log

#### Role and model aliases

**Roles** (fuzzy-matched):

| Key              | Aliases     | Section    |
|-----------------|-------------|------------|
| `sisyphus`       | `sis`       | agents     |
| `hephaestus`     | `heph`      | agents     |
| `prometheus`     | `pro`       | agents     |
| `oracle`         | —           | agents     |
| `librarian`      | `lib`       | agents     |
| `explore`        | —           | agents     |
| `quick`          | —           | categories |
| `ultrabrain`     | —           | categories |
| `visual-engineering` | `visual` | categories |
| `deep`           | —           | categories |

**Models** (fuzzy-matched, sample):

| Alias           | Provider  | Tier  |
|----------------|-----------|-------|
| `qwen-max`      | alibaba   | smart |
| `qwen-turbo`    | alibaba   | fast  |
| `kimi-k2.5`     | alibaba   | smart |
| `minimax-m1`    | minimax   | smart |
| `minimax-m2.7`  | minimax   | smart |
| `z1-pro`        | zai       | smart |
| `glm-5`         | zai       | smart |
| `glm-4.7-flashx`| zai       | fast  |

Run `omoctl models` to see the full list with context windows and costs.

---

## Commands

```
omoctl                          Launch TUI dashboard
omoctl monitor [--web]          Same as above; --web also starts port 4242
omoctl --no-tui                 Print JSON status, no TUI

omoctl set <role> <model>       Assign model to agent role
omoctl get [role]               Show current model(s)
omoctl models [--provider] [--tier] [--available]

omoctl use <profile>            Apply saved profile to all roles
omoctl profile save <name>
omoctl profile list
omoctl profile show <name>
omoctl profile delete <name>

omoctl plans [--json]           Provider quota + plan stats
omoctl status [--json]          Cached provider status

omoctl proxy status
omoctl proxy log                Live tail of proxy log
omoctl proxy start / stop

omoctl config                   Open config in $EDITOR
omoctl config path
omoctl config validate
```

---

## Milestones

- [x] **v0.1** — CLI core (set/get/models/plans/profile/config/proxy)
- [x] **v0.2** — TUI dashboard (5 views, interactive model picker)
- [x] **v0.3** — Proxy integration (log tailer, health poller)
- [x] **v0.4** — Web UI (Bun HTTP server, REST API, React SPA)
- [ ] **v0.5** — tokentop bridge (shared SQLite, unified trends)
- [ ] **v1.0** — tests, single-binary build, Homebrew formula

---

## Related files

| File | Role |
|------|------|
| `~/.config/opencode/oh-my-opencode.json` | oh-my-openagent config — omoctl reads/writes this |
| `~/.config/opencode/fallback-proxy.js`   | Round-robin provider proxy (port 4141)            |
| `~/.config/omoctl/config.json`           | omoctl config (auto-created with defaults)        |
| `~/.config/omoctl/profiles.json`         | Saved role profiles                               |
| `~/.local/share/omoctl/data.db`          | SQLite database                                   |
| `~/.config/opencode/proxy.log`           | Fallback proxy log — omoctl tails this            |
