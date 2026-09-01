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
- Support **three frameworks**: **zeptoclaw** (default — see §12 post-O4), **openclaw**, **hermes**.
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
4. App reloads capabilities **only if the framework requires it** — the Phase 0 spike found **zeptoclaw hot-reloads skills with NO restart** (loop = detect → install → resume). Some frameworks may still need a restart; the adapter declares whether a restart is required.
5. Framework continues; app streams the result. User sees only "Setting up <capability>…".

**Restart/resume is per-framework, not universal** (spike-corrected): the orchestrator asks the adapter whether a restart is needed; when it isn't (zeptoclaw), it just resumes.

**When a restart IS required, the app owns it — trigger + monitor:** the app does NOT ask the user to restart and does NOT assume the gateway came back. It (1) checkpoints task/conversation context, (2) **triggers the restart** via the adapter (`stop` → `start`), (3) **monitors readiness** by polling the adapter's `status()`/health endpoint until the gateway reports healthy, with a bounded timeout, (4) on healthy → re-issues the task and resumes streaming; on timeout/crash-loop → surfaces a clear error and does not silently hang. The `FrameworkAdapter` exposes `restart()` and a `status()`/health check for exactly this; the orchestrator treats a required restart as a first-class, monitored step.

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

## 10. Risks & Spikes — Phase 0 spike COMPLETE (findings in `docs/research/verified/`)
1. **Interface verification (DONE):** all three installed + verified against local Ollama. zeptoclaw + hermes invoke/stream/config/capability commands VERIFIED; **openclaw's Ollama wiring is PARTIAL** (config-migration complexity) and needs dedicated work in its adapter.
2. **Restart/resume (RESOLVED, simpler than feared):** zeptoclaw hot-reloads skills — **no restart**. Restart is per-framework, declared by the adapter (see §6).
3. **Gap-signal detection (PARTIAL):** app-orchestrated loop proven GO on zeptoclaw; the exact gap signal per framework still needs hardening in each adapter.
4. **Cross-platform install + sandboxing (ELEVATED):** the **hermes installer hijacks the host `node` PATH** (spike finding). The app MUST sandbox framework installs (isolated PATH/prefix or container) so a framework installer cannot hijack host runtimes; openclaw needs a bundled/isolated Node 22.
5. **Model-backend wiring:** each framework expresses providers differently in its config; the ModelBackend→framework-config mapping needs a small adapter per framework (openclaw hardest — see #1).

---

## 11. Phasing (thin slice → fast-follows)
- **Phase 0 (spike): DONE** — all three frameworks + Ollama installed/verified; capability loop GO (proven on zeptoclaw, no restart). Findings in `docs/research/verified/`.
- **Phase 1 (foundations): DONE** — v2 types + schema, secrets, ModelBackend layer (both protocols) + factory, framework registry, onboarding wizard. (Merged.)
- **Phase 2 (adapters): DONE** — zeptoclaw (reference), hermes, and openclaw adapters + capability orchestrator + sandboxed installs, all merged. Default is **zeptoclaw** (openclaw failed the headless "works E2E" gate — see §12 post-O4). Live E2E findings in `docs/research/verified/`.
- **Phase 3 (model backends): DONE** — managed **llama.cpp** (download llama-server + curated GGUF, launch on loopback, monitor) + custom endpoint (both protocols) + cloud providers **Anthropic, OpenAI, OpenRouter, Azure OpenAI, Amazon Bedrock** (Bedrock via in-repo AWS SigV4) + API-key/multi-part-credential entry (`secrets.set`, JSON blob for Bedrock). **Deferred:** managed **vLLM** (Linux/CUDA, not Mac-viable — custom endpoint covers BYO vLLM); **Bedrock token streaming** (AWS binary event-stream — non-streaming `invoke` for now); Bedrock limited to Anthropic Claude model family.
- **Phase 4 (in progress):**
  - **Capability-management UI: DONE** — a page lists each deployment's installed capabilities (from the app DB) grouped by skill/MCP/plugin, with per-item remove. Remove performs a **real per-framework CLI uninstall where the framework supports it** (hermes: all types; openclaw: MCP `mcp unset`+reload and plugins `plugins uninstall`) and otherwise **deletes the app's record and tells the user** (openclaw bundled skills; all zeptoclaw types — no CLI uninstall). The app record is always removed on a resolved outcome; a genuine uninstall error retains the record and surfaces the failure for retry. Verified uninstall commands: `docs/research/verified/capability-uninstall-commands.md`.
  - **Still pending:** remote framework deployments (connect-only: URL + credentials, no infra provisioning — §12.2); polish.

---

## 12. Resolved Decisions (approved 2026-08-31)
1. **Personas fully deferred** — v2 onboarding is framework-first then model; the persona/guided-task system is not surfaced.
2. **Remote frameworks = connect-only** (Phase 4): the user already runs the framework; the app only needs URL + credentials. The app does NOT provision remote infrastructure.
3. **Pre-bundle set (minimal start):** web search + fetch + filesystem MCP/tools per framework.
4. **Mac-first**: ship macOS first; Windows support for the Rust (zeptoclaw) / Python (hermes) managed installs is a later addition.
5. **First implementation plan covers Phase 0 (spike) + Phase 1 (thin slice)**; Phases 2–4 get their own plans.

### Post-spike decisions (amended 2026-08-31, after Phase 0)
6. **Default framework stays openclaw** (per original product intent), BUT it is built **last** among adapters (spike showed it's hardest to wire), and **"openclaw adapter works end-to-end" is a release gate** — the shipped default must actually function before any release. Build order: **zeptoclaw → hermes → openclaw**.

   **9. Post-O4 REVERSAL (amended after adapter build + O4 investigation): default is now `zeptoclaw`, not openclaw.** All three adapters were built and reviewed. During the openclaw release-gate verification, a controlled investigation found openclaw's default agent behaves as an **interactive voice assistant** (persona "Nova" + speech-synthesis tool): a one-shot headless prompt returns a greeting + an audio attachment instead of an answer (≤2/10 correct). This is **not fixable via app-writable config** — there is no persona/instructions key and `tools.profile` does not reliably disable speech-synthesis; the behavior is baked into openclaw's default agent prompt. openclaw therefore **fails** the decision-#6 release gate ("the shipped default must actually function"). Since **zeptoclaw** (and hermes) were verified answering prompts end-to-end, and zeptoclaw hot-reloads with no restart, **zeptoclaw becomes the shipped default**. openclaw remains a fully-supported, selectable framework but is **not** the default until its headless behavior is resolved (untested avenue: `openclaw agent exec` correctness; or an upstream persona-disable capability). Evidence: `docs/research/verified/openclaw-o4-terminal-tool-spike.md`.
7. **Capability loop needs no universal restart** — zeptoclaw hot-reloads; restart is per-framework, declared by the adapter (§6/§10).
8. **Framework installs must be sandboxed** — the hermes installer hijacked the host `node` PATH during the spike; the app must isolate framework installs (isolated PATH/prefix or container) and bundle/isolate openclaw's Node 22, never touching host runtimes.
