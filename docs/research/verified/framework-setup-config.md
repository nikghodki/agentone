# Framework Setup-Time User Configuration (Beyond Model)

**Research Date:** 2026-09-02  
**Task:** AgentOne redesign - per-framework user configuration requirements for guided setup wizard  
**Scope:** Setup-time configuration ONLY, beyond model backend (which the app already handles)

---

## Executive Summary

**Key Finding:** All three frameworks (ZeptoClaw, Hermes, OpenClaw) are usable with ZERO required user configuration beyond the model backend, which AgentOne already handles via adapters' `configure()`.

**For the guided setup wizard's "framework configuration" step:**
- **ZeptoClaw:** No additional config needed — wizard can skip to "ready"
- **Hermes:** No additional config needed — wizard can skip to "ready"  
- **OpenClaw:** No additional config needed — wizard can skip to "ready" (gateway auth token auto-generated on first run)

All three frameworks auto-generate required state (config files, workspace directories, auth tokens) with sane defaults on first run. Optional advanced settings (persona, channels, log level, etc.) can be exposed in an "Advanced" panel but are NOT gatekeepers for first-time setup.

---

## ZeptoClaw

**Config File:** `~/.zeptoclaw/config.json`  
**CLI Location:** `/opt/homebrew/bin/zeptoclaw`  
**Verification Method:** Inspected live config + `zeptoclaw status` + `zeptoclaw onboard --help`

### Setup-Time Configuration

| Field | Required/Optional | Default | What It's For | How App Would Set It |
|-------|-------------------|---------|---------------|---------------------|
| `providers.<provider>` | Optional | N/A | Model provider config (api_base, model) | Adapter's `configure()` already handles this |
| `agents.defaults.model` | Optional | N/A | Default model name | Adapter's `configure()` already handles this |
| `gateway.host` | Optional | `0.0.0.0` | Gateway bind address | Leave as default |
| `gateway.port` | Optional | `8080` | Gateway port | Leave as default or auto-assign |
| Workspace path | Optional | `~/.zeptoclaw/workspace` | Agent workspace directory | Auto-created on first run |
| SOUL.md | Optional | Auto-created template | Agent persona/identity | Auto-created; user can edit later |
| Log level | Optional | Info (inferred) | Log verbosity | Leave as default |
| Tool configs | Optional | Defaults work | Browser, channels, etc. | Only needed for optional features |

### What ZeptoClaw Prompts For on First Run

**Command:** `zeptoclaw onboard`

**Modes:**
- Express mode (default): Minimal prompts, likely just model/provider if not configured
- Full 10-step wizard (`--full`): All optional settings

**Verdict:** The onboard command is OPTIONAL. If config file exists (which the app will create via adapter), ZeptoClaw runs without prompting.

### VERIFIED Conclusion

**Required config beyond model:** NONE

ZeptoClaw works immediately after the app writes `providers.<provider>` and `agents.defaults.model` via the adapter's `configure()`. All other config has sane defaults. The workspace, sessions, skills directories are auto-created on first run.

**Setup wizard action:** Skip ZeptoClaw-specific config step — show "ZeptoClaw ready" after model selection.

---

## Hermes

**Config File:** `~/.hermes/config.yaml` + `~/.hermes/.env`  
**CLI Location:** `~/.local/bin/hermes`  
**Verification Method:** Inspected live config + `hermes config check` + `hermes setup --help`

### Setup-Time Configuration

| Field | Required/Optional | Default | What It's For | How App Would Set It |
|-------|-------------------|---------|---------------|---------------------|
| `model.default` | Optional | N/A | Default model name | Adapter's `configure()` already handles this |
| `model.provider` | Optional | N/A | Provider name (ollama, openai, etc.) | Adapter's `configure()` already handles this |
| `model.base_url` | Optional | N/A | Provider API endpoint | Adapter's `configure()` already handles this |
| SOUL.md | Optional | Auto-created template | Agent persona | Auto-created at `~/.hermes/SOUL.md` |
| Setup sections | Optional | N/A | TTS, terminal, gateway, tools, telemetry, agent | All have defaults; only needed for advanced features |
| Channel configs | Optional | N/A | Telegram, Slack, Discord, etc. | Only for multi-channel mode |
| .env secrets | Optional | N/A | API keys for optional providers/tools | Only for features user wants to enable |

### What Hermes Prompts For on First Run

**Command:** `hermes setup`

**Sections (all optional):**
- `model`: Model selection and provider — app handles this
- `tts`: Text-to-speech config — optional feature
- `terminal`: Terminal preferences — has defaults
- `gateway`: Messaging gateway config — only for multi-channel use
- `tools`: Tool enablement — has defaults
- `telemetry`: Telemetry opt-in — optional
- `agent`: Agent behavior settings — has defaults

**Non-interactive mode:** `hermes setup --non-interactive` uses all defaults.

**Verdict:** `hermes config check` shows "Required:" section is EMPTY. All config is optional.

### VERIFIED Conclusion

**Required config beyond model:** NONE

Hermes works immediately after the app writes `model.default`, `model.provider`, `model.base_url` to `~/.hermes/config.yaml`. The installer auto-creates SOUL.md, .env, skills directory, etc. All optional features (channels, TTS, browser, etc.) are disabled by default and don't block usage.

**Setup wizard action:** Skip Hermes-specific config step — show "Hermes ready" after model selection.

---

## OpenClaw

**Config File:** `~/.openclaw/openclaw.json`  
**CLI Location:** Isolated Node 22 environment (see openclaw-config-spike.md)  
**Verification Method:** Inspected live config + `openclaw config validate` + `openclaw onboard --help` + `openclaw gateway status`

### Setup-Time Configuration

| Field | Required/Optional | Default | What It's For | How App Would Set It |
|-------|-------------------|---------|---------------|---------------------|
| `agents.defaults.workspace` | Optional | `~/.openclaw/workspace` | Agent workspace path | Auto-set on first run |
| `agents.defaults.models` | Optional | N/A | Model registration | Adapter's `configure()` already handles this |
| `agents.defaults.model.primary` | Optional | N/A | Default model | Adapter's `configure()` already handles this |
| `agents.defaults.modelPolicy.allow` | Optional | N/A | Model allowlist | Adapter's `configure()` already handles this |
| `models.providers.<provider>` | Optional | N/A | Provider + model registry | Adapter's `configure()` already handles this |
| `gateway.mode` | Optional | `local` | Gateway mode (local vs remote) | Leave as default |
| `gateway.port` | Optional | `18789` | Gateway port | Auto-assigned or default |
| `gateway.bind` | Optional | `loopback` | Bind address (loopback, lan, tailnet) | Leave as default (loopback is safest) |
| `gateway.auth.mode` | Optional | `token` | Auth mode (token vs password) | Leave as default |
| `gateway.auth.token` | **REQUIRED** | Auto-generated | Gateway access token | Auto-generated on first run |
| `plugins.entries.<plugin>` | Optional | N/A | Plugin enablement | Only for optional plugins (ollama plugin handled by adapter) |
| `skills.entries.<skill>` | Optional | N/A | Skill enablement | Only for optional skills |
| IDENTITY.md, USER.md, SOUL.md | Optional | Auto-created templates | Agent/user personas | Auto-created in workspace; user can fill in later |
| `wizard.lastRunAt` | Optional | Auto-set | Onboard tracking | Set by openclaw internally |

### What OpenClaw Prompts For on First Run

**Command:** `openclaw onboard`

**Flows:**
- `quickstart` (default): Minimal prompts, auto-generates config
- `advanced`: More options
- `manual`: Full control
- `import`: Migrate from another framework

**Non-interactive mode:** `openclaw onboard --non-interactive --accept-risk` uses all defaults.

**Key prompts (if interactive):**
1. **Auth provider selection** — but the app will use local model, so this is just for gateway auth (token auto-generated)
2. **Gateway settings** — port, bind mode (defaults work)
3. **Workspace path** — has default `~/.openclaw/workspace`
4. **Daemon install** — optional, can skip
5. **Channels, skills** — all optional

**Critical finding:** The `gateway.auth.token` is REQUIRED for the gateway to run, BUT it's AUTO-GENERATED on first run. The user doesn't need to provide it.

### VERIFIED Conclusion

**Required config beyond model:** NONE (from user perspective)

OpenClaw auto-generates the gateway auth token on first run. The app doesn't need to prompt for it. Port (18789), bind mode (loopback), and workspace path all have sane defaults. After the adapter writes the model config (`models.providers.<provider>` + `agents.defaults.model.primary` + plugin enablement), OpenClaw is ready to run.

**Setup wizard action:** Skip OpenClaw-specific config step — show "OpenClaw ready" after model selection. The app should call `openclaw onboard --non-interactive --accept-risk` on first run to initialize the config with defaults, then the adapter's `configure()` writes the model settings.

---

## Comparison Matrix

| Aspect | ZeptoClaw | Hermes | OpenClaw |
|--------|-----------|--------|----------|
| **Config file** | `~/.zeptoclaw/config.json` | `~/.hermes/config.yaml` | `~/.openclaw/openclaw.json` |
| **Required fields beyond model** | NONE | NONE | NONE (auth token auto-generated) |
| **Workspace path** | `~/.zeptoclaw/workspace` (default) | N/A (no explicit workspace) | `~/.openclaw/workspace` (default) |
| **Gateway/daemon** | Optional (defaults: 0.0.0.0:8080) | Optional (not needed for CLI mode) | Optional for CLI; required for gateway mode (auto-configured) |
| **Auth token** | Not needed | Not needed | Auto-generated on first run |
| **Persona files** | SOUL.md (optional, template) | SOUL.md (optional, template) | IDENTITY.md, USER.md, SOUL.md (optional, templates) |
| **Log level** | Has default | Has default | Has default |
| **First-run onboarding** | `zeptoclaw onboard` (optional) | `hermes setup` (optional) | `openclaw onboard` (auto-gen config) |
| **Non-interactive setup** | Config file only | `--non-interactive` flag | `--non-interactive --accept-risk` |

---

## Recommended Setup Wizard Flow

### Step 1: Model Backend Selection
User selects local (Ollama) or remote backend. App handles this (existing functionality).

### Step 2: Framework Selection
User picks ZeptoClaw, Hermes, or OpenClaw.

### Step 3: Framework Configuration (THIS RESEARCH)

**For ALL frameworks:**
```
✓ [Framework Name] configured successfully

[Framework Name] is ready to run with your selected model backend.

Optional (Advanced):
  ☐ Customize agent persona (SOUL.md / IDENTITY.md)
  ☐ Configure multi-channel gateway (Telegram, Slack, Discord, etc.)
  ☐ Adjust log level and workspace location
  ☐ Enable optional tools (browser, vision, TTS, etc.)

[Skip]  [Configure Advanced]
```

**If user clicks "Configure Advanced"**, show framework-specific optional settings:
- **ZeptoClaw:** Gateway host/port, SOUL.md editor, tool configs
- **Hermes:** SOUL.md editor, channel configs, TTS/terminal settings
- **OpenClaw:** IDENTITY.md/USER.md editors, gateway bind mode, channels, skills

**Default action:** Skip advanced config, proceed to framework launch.

### Step 4: Launch Framework
App calls adapter's `configure(backend)`, which writes model config. Framework is ready to run.

---

## What Each Framework PROMPTS For on Interactive First Run

### ZeptoClaw
```bash
$ zeptoclaw onboard
# Express mode (default): Likely just confirms model/provider if not set
# Full mode (--full): 10-step wizard covering all optional settings
```

**App strategy:** Don't call `zeptoclaw onboard`. The adapter's `configure()` writes config directly.

### Hermes
```bash
$ hermes setup
# Interactive sections: model, tts, terminal, gateway, tools, telemetry, agent
# All have defaults; user can skip all
```

**App strategy:** Don't call `hermes setup`. Write `~/.hermes/config.yaml` directly via adapter.

### OpenClaw
```bash
$ openclaw onboard
# Prompts for: auth provider, gateway settings, workspace, daemon install, channels, skills
# All have defaults or auto-generate (like auth token)
```

**App strategy:** Call `openclaw onboard --non-interactive --accept-risk` on first run to initialize defaults, THEN the adapter's `configure()` overwrites model settings.

---

## Implementation Notes for AgentOne

### Adapter `configure()` Responsibility
The adapter's `configure(backend: ModelBackend)` method handles:
1. Writing provider config (api_base, model name, etc.)
2. Setting default model
3. Enabling required plugins (e.g., ollama plugin for OpenClaw)
4. Validating config

**The adapter does NOT handle:**
- User persona/identity files (optional, user can edit later)
- Channel configs (optional, not needed for local agent use)
- Advanced settings (log level, gateway tuning, etc.)

### First-Run Initialization

**ZeptoClaw:**
```typescript
// No init command needed. Just write config and run.
await writeConfig('~/.zeptoclaw/config.json', { providers, agents });
```

**Hermes:**
```typescript
// No init command needed. Just write config.
await writeConfig('~/.hermes/config.yaml', { model });
```

**OpenClaw:**
```typescript
// Initialize with defaults first (creates auth token, workspace, etc.)
await exec('openclaw onboard --non-interactive --accept-risk --skip-channels --skip-skills --skip-daemon');
// THEN write model config
await writeConfig('~/.openclaw/openclaw.json', { models, agents, plugins });
```

---

## Guardrail Verification

**Host Node Version:**
```bash
$ node -v
v16.16.0
```

✅ **PASS** — Host node unchanged throughout research (OpenClaw invoked via isolated Node 22 in spike directory)

---

## Sources

**VERIFIED (inspected):**
- `~/.zeptoclaw/config.json` (live config)
- `~/.hermes/config.yaml` (live config)
- `~/.openclaw/openclaw.json` (live config)
- `zeptoclaw status` (config schema + defaults)
- `zeptoclaw onboard --help` (onboarding flow)
- `hermes config check` (required fields check — result: none)
- `hermes setup --help` (setup wizard sections)
- `openclaw onboard --help` (onboarding options)
- `openclaw config validate` (config validation)
- `openclaw gateway status` (gateway config)

**Referenced docs:**
- `docs/research/verified/zeptoclaw.md` (Phase 0 verification)
- `docs/research/verified/hermes-agent.md` (Phase 0 verification)
- `docs/research/verified/openclaw.md` (Phase 0 verification)
- `docs/research/verified/openclaw-config-spike.md` (config migration + Ollama wiring)

---

**Verified By:** AgentOne Phase 0 follow-up research  
**Research Date:** 2026-09-02  
**Status:** COMPLETE — All three frameworks require ZERO user config beyond model backend
