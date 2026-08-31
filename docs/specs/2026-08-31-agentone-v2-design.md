# AgentOne v2 — Agent-Framework Launcher & Capability Manager (Design Spec)

**Date:** 2026-08-31
**Status:** Draft for review
**Author:** Nikhil + Claude
**Supersedes core of:** `docs/specs/2026-08-31-agentone-design.md` (v1 MVP — local-Ollama persona chat)

---

## 1. Vision

**One-liner:** A desktop app that lets anyone deploy a real agent framework in a few clicks, pick where its model runs, and just *ask* — the app quietly installs whatever skills, plugins, or MCP servers the task needs.

**Shift from v1:** v1 was a private local-Ollama persona chat. v2 **redefines the core**: the app becomes a launcher/manager for agent frameworks. The v1 local-Ollama chat becomes *one model backend*, and the persona/guided-task system is **deferred** (the chat surface becomes the task interface that drives the selected framework).

**Two audiences, one flow:** beginners get sensible defaults (openclaw + a hardware-picked local model); advanced users can choose frameworks, model servers (llama.cpp/vLLM), custom endpoints, or cloud providers.

---

## 2. Scope

**In scope (v2):**
- Support **three frameworks**: **openclaw** (default), **zeptoclaw**, **hermes**.
- Runtime: **both local and remote** framework deployments.
- Model backends: managed-local (Ollama), advanced-local (llama.cpp, vLLM), custom endpoint (`v1/messages` / `v1/chat/completions`), and cloud (Anthropic, OpenAI, OpenRouter, Azure OpenAI, Amazon Bedrock).
- **App-orchestrated + pre-bundled** capability provisioning (skills/plugins/MCP servers) behind a simple UX.
- Reuse the shipped Electron + React + SQLite + IPC shell.

**Deferred:**
- The v1 persona system and guided task catalog (kept in the codebase; not surfaced in v2 onboarding).
- Freemium/licensing UX (revisit once the launcher is proven).

**Explicitly gated by a spike (see §10):** the exact per-framework install/invoke/config/capability commands — the research that informed this spec cited implausible repo stats, so commands are treated as *plausible but unverified* until a spike confirms them.

---

## 3. Research Summary (per-framework, unverified — see docs/research/)

| | **openclaw** (default) | **zeptoclaw** | **hermes** |
|---|---|---|---|
| Language / install | Node 22+, `npm i -g openclaw` or curl | Rust single binary; curl / brew / docker / cargo | Python; curl `install.sh` (bundles Python+Node) |
| Invoke + stream | CLI (`openclaw tui`, `openclaw message send`), Web UI `:18789`, WebSocket | `zeptoclaw agent --stream -m "..."`, SSE; gateway daemon; Rust SDK | `hermes` CLI, Python SDK, `hermes mcp serve`; JSON-RPC/stdio, WS |
| Config file | `~/.openclaw/openclaw.json` | `~/.zeptoclaw/config.json` | `~/.hermes/config.yaml` (+ `.env`) |
| Model providers | Anthropic, OpenAI, Bedrock, Gemini, Ollama, LM Studio, llama.cpp, 20+ | 18 providers, OpenAI-compatible endpoints | 30+ incl. Anthropic, OpenAI, OpenRouter, Gemini, Ollama, custom |
| MCP / plugins / skills | ✅ all + ClawHub marketplace + web_search tool | ✅ all + ClawHub + web_search/find_skills/install_skill | ✅ all + autonomous skill creation + web_search |
| Agent self-installs mid-task | ❌ operator/CLI only (`openclaw plugins install`, `openclaw mcp add`) | ⚠️ partial (self-install tools, **requires restart**) | ❌ MCP = manual config edit; ✅ skills auto-created |

**Key cross-framework facts we rely on:** all three (a) expose a **web_search** tool, (b) manage capabilities through a **config file and/or install CLI the app can drive**, (c) support **many model providers including Ollama, custom endpoints, and cloud**, and (d) load capabilities **at startup** (a restart is needed after install).

---

## 4. Architecture (extends the shipped app)

```
Electron Main Process
├── FrameworkManager
│   ├── Framework Registry (metadata: id, name, top-5 features, install/config recipe)
│   └── FrameworkAdapter (per framework × location: local process | remote API)
│       interface: install() configure(backend) start() stop() status()
│                  sendTask(input) streamOutput(cb) listCapabilities() installCapability(spec) restart()
├── ModelBackendManager
│   └── ModelBackend (provider interface)
│       ├── OllamaBackend        (REUSE v1 hardware-detector + tiering + OllamaManager)
│       ├── ManagedServerBackend (llama.cpp | vLLM — install + launch local server)
│       ├── CustomEndpointBackend(base URL + key + shape: v1/messages | v1/chat/completions)
│       └── CloudBackend         (Anthropic | OpenAI | OpenRouter | Azure | Bedrock)
├── CapabilityOrchestrator
│   ├── pre-bundle installer (curated common MCP/tools per framework, installed at deploy)
│   └── gap→install→restart→resume loop (app-orchestrated; agent web_search identifies)
├── Database (SQLite — extend v1 schema: frameworks, deployments, model_backends, capabilities)
└── Secrets (Electron safeStorage / OS keychain — cloud + endpoint API keys)
        │ IPC (contextBridge)
Renderer (React)
├── Onboarding wizard: pick framework (top-5 features) → install → pick model backend → ready
├── Task/Chat surface: drives the selected framework via its adapter; streams output
├── Frameworks view: deployed frameworks, status, switch/redeploy
└── Settings: model backend + credentials, installed capabilities, framework management
```

**Design principles:**
- The **FrameworkAdapter** is the single seam that hides per-framework differences. Everything above it is framework-agnostic.
- The **ModelBackend** interface is orthogonal to frameworks: any backend can be wired into any framework by writing that framework's provider config. Because Ollama/llama.cpp/vLLM all serve an OpenAI-compatible `/v1/chat/completions`, the `CustomEndpointBackend` generalizes them; the managed backends add install/launch convenience.
- The v1 `OllamaManager`, `hardware-detector`, SQLite layer, IPC pattern, and Zustand/routing shell are **reused**, not rewritten.

---

## 5. First-Run Flow

1. **Install app** (dmg/exe — the v1 packaging track, R6 deferrals still apply).
2. **Choose a framework** — cards show each framework's **top 5 features**; openclaw preselected as default.
3. **Install + configure** the chosen framework (adapter `install()` → `configure()`), with progress UI (reuses the v1 ModelProgress pattern).
4. **Choose a model backend:**
   - *Local (managed, beginner):* install Ollama, hardware-pick a predefined model (reuse v1), with "choose another model."
   - *Local (advanced):* install/run llama.cpp or vLLM.
   - *Custom endpoint:* base URL + API key + protocol (`v1/messages` | `v1/chat/completions`).
   - *Cloud:* Anthropic / OpenAI / OpenRouter / Azure / Bedrock (key/endpoint/model/region).
5. **Pre-bundle** the framework's curated common capabilities.
6. **Ready** — the task/chat surface drives the framework; the capability loop handles the long tail.

---

## 6. Capability Model (app-orchestrated + pre-bundle)

**At deploy:** install a curated, per-framework set of common MCP servers/tools (e.g. web/fetch/filesystem) so most asks need no runtime install or restart.

**At runtime (long tail):**
1. User asks → app forwards to the framework; framework runs, using its **web_search** to identify a capability it lacks.
2. App detects the gap (from the framework's output/tool signal — exact signal per framework confirmed in the spike) and resolves the concrete capability (MCP server / plugin / skill).
3. **App installs + configures** it via the framework's config file / install CLI (`openclaw mcp add`, zeptoclaw `install_skill`, hermes `config.yaml` edit).
4. App performs a **transparent restart/resume** of the framework (capabilities load at startup), preserving conversation/task context.
5. Framework continues; app streams the result. User sees only "Setting up <capability>…".

**Restart/resume** is a first-class concern: the orchestrator must checkpoint task context, restart the adapter, and re-issue the task so the newly loaded capability is available.

---

## 7. Data Model (SQLite — extends v1)

```sql
CREATE TABLE frameworks (            -- catalog (seeded)
  id TEXT PRIMARY KEY,               -- 'openclaw' | 'zeptoclaw' | 'hermes'
  name TEXT, features_json TEXT, install_recipe_json TEXT );

CREATE TABLE deployments (
  id TEXT PRIMARY KEY, framework_id TEXT REFERENCES frameworks(id),
  location TEXT,                     -- 'local' | 'remote'
  remote_url TEXT, status TEXT, model_backend_id TEXT,
  created_at TEXT DEFAULT (datetime('now')) );

CREATE TABLE model_backends (
  id TEXT PRIMARY KEY,
  kind TEXT,                         -- 'ollama'|'llamacpp'|'vllm'|'custom'|'cloud'
  provider TEXT,                     -- e.g. 'anthropic','openai','bedrock'
  base_url TEXT, protocol TEXT,      -- 'v1/messages'|'v1/chat/completions'
  model TEXT, secret_ref TEXT );     -- secret_ref → keychain, never the raw key

CREATE TABLE installed_capabilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deployment_id TEXT REFERENCES deployments(id),
  type TEXT,                         -- 'mcp'|'plugin'|'skill'
  name TEXT, source TEXT, installed_at TEXT DEFAULT (datetime('now')) );
```
v1 `conversations`/`messages` tables are reused for the task/chat surface.

---

## 8. Security & Privacy
- Cloud/endpoint API keys stored via Electron `safeStorage` (OS keychain); DB stores only a `secret_ref`. Keys never logged or sent anywhere but the configured provider.
- Local frameworks bind to loopback only; remote deployments use user-supplied URLs over TLS.
- Capability installs are surfaced to the user ("Setting up <x>"); nothing installs silently without a visible indication.

---

## 9. Reuse from v1
- `hardware-detector` + model tiering + `OllamaManager` → the `OllamaBackend`.
- SQLite layer, IPC/contextBridge pattern, Zustand store + routing, setup/progress UI, settings shell.
- Streaming primitives (token/progress channels, buffered NDJSON) → adapter `streamOutput`.

---

## 10. Risks & Spikes (do these FIRST in the plan)
1. **Interface verification spike (per framework, BLOCKING):** confirm the real install command, invoke+stream mechanism, config schema, MCP/plugin/skill install command, capability-gap signal, and restart behavior. The research is plausible but cited implausible repo stats — verify before coding adapters.
2. **Restart/resume UX:** capabilities load at startup; the resume loop must preserve context. Prototype early.
3. **Gap-signal detection:** none of the three documents a clean "missing capability" event. May require parsing agent output or wrapping the web_search/tool layer. High-uncertainty — spike it.
4. **Cross-platform install:** three different runtimes (Node/Rust/Python) to install reliably on Mac + Windows. Managed installs are non-trivial.
5. **Model-backend wiring:** each framework expresses providers differently in its config; the ModelBackend→framework-config mapping needs a small adapter per framework.

---

## 11. Phasing (thin slice → fast-follows)
- **Phase 0 (spike):** verify all three frameworks' interfaces; confirm the capability gap→install→restart→resume loop is feasible on openclaw. Output: a short findings doc + a go/no-go per assumption.
- **Phase 1 (thin slice):** openclaw, **local**, with the **Ollama** backend — deploy → run one task → pre-bundled capability works → one runtime capability install+restart+resume works end-to-end.
- **Phase 2:** add zeptoclaw + hermes adapters (local); framework selection with top-5 features.
- **Phase 3:** model backends — advanced-local (llama.cpp/vLLM), custom endpoint (both protocols), cloud providers.
- **Phase 4:** remote deployments; capability management UI; polish.

---

## 12. Open Questions (for review)
1. Onboarding order — framework first then model, as specified. Confirm we never re-surface personas.
2. For remote frameworks (Phase 4), do we assume the user already runs the framework and only needs connection details, or does the app provision remote infra? (Assumption: connect-only.)
3. Pre-bundle set — which specific MCP servers/tools per framework? (Defer to Phase 1 with a minimal set: web search + fetch + filesystem.)
4. Windows support for Rust (zeptoclaw) / Python (hermes) managed installs — acceptable to ship Mac-first? 
