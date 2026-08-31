# AgentOne v2 ("redefine the core") — brainstorming intake

Captured during brainstorming on 2026-08-31. Feeds the design doc → spec → plan. Not the spec itself.

## Product
Extend the shipped AgentOne (Electron + React + TS) into a launcher/manager for agent frameworks. Users deploy a framework, pick a model backend, and the app auto-provisions capabilities (plugins/skills/MCP) behind a simple UX. The MVP's local-Ollama persona chat becomes one option; **personas/guided-tasks are deferred** for the redefined core (chat surface becomes the task interface). Runtime model: **both local and remote** frameworks.

## First-run flow
1. Install app.
2. Choose an **agent framework** — each shown with its **top 5 features**. Support 3 to start:
   - openclaw (default) — https://github.com/openclaw/openclaw
   - zeptoclaw — https://github.com/qhkm/zeptoclaw
   - hermes (hermes-agent) — https://github.com/NousResearch/hermes-agent
3. App **installs + configures** the selected framework.
4. Choose a **model backend** (see below).
5. App wires the backend into the framework → ready. During tasks, the agent-self-install loop runs.

## Model-backend layer (a common provider interface)
- **Local, managed (beginner):** Ollama — auto-install + hardware-tiered predefined model (REUSE the MVP's hardware-detector + model-tiering + OllamaManager), plus an option to pick other models.
- **Local, managed (advanced):** option to install/run **llama.cpp** or **vLLM** as the local model server.
- **Custom endpoint (self-hosted or any compatible):** user supplies **base URL + API key** and selects the wire protocol — **Anthropic `POST /v1/messages`** or **OpenAI `POST /v1/chat/completions`** (with streaming). This generalizes: Ollama, llama.cpp, and vLLM all expose an OpenAI-compatible `/v1/chat/completions`, so this path also covers self-hosted servers.
- **Cloud providers:** Anthropic, OpenAI, OpenRouter, Azure OpenAI, Amazon Bedrock (key/endpoint/model/region as each requires).
- Credentials stored in the OS keychain via Electron `safeStorage`; never logged.

## Capability auto-provisioning (agent-driven, self-install)
1. User asks → app forwards the query to the deployed framework.
2. Framework signals it needs a plugin/MCP server/skill it lacks.
3. App instructs the framework to **search the internet** for it and **enable it itself**.
4. Framework enables it, continues; app streams results. No curated catalog for MVP — intelligence lives in the agent; the app orchestrates + provides simple UX.

## Architecture (extend the shipped app)
- **Framework registry + adapters** — per-framework metadata (name, top-5 features, install/config recipe) + adapter interface: `install / configure / start / stop / status / sendTask / streamOutput`. One impl per framework × location (local process vs remote API). Today's OllamaManager is the model layer, not a framework adapter.
- **Model-backend provider interface** — implementations per the list above; selected backend wired into the framework's config.
- **Capability self-install orchestrator** — the loop above (framework-interface-dependent).
- **Reused shell** — Electron + React + SQLite + IPC; new onboarding wizard (framework → model backend); settings manage framework, backend + credentials, installed capabilities.

## Open dependency (BLOCKING for adapter impl)
Each framework's real interface: invoke+stream, capability-gap signal, and self-install-via-web-search mechanism. Being researched now → docs/research/{openclaw,zeptoclaw,hermes-agent}.md. The spec can be written with an early **spike task** per framework if any interface is under-documented.

## Scope
Start with **all 3 frameworks**, local first; cloud + advanced local backends (llama.cpp/vLLM) as fast-follows if needed to keep the first cut tractable (to be sequenced in the plan).
