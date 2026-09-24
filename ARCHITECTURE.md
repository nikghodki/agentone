# AgentOne — Architecture

AgentOne is an **Electron desktop app** (macOS-first) that acts as a launcher and capability manager for agent frameworks. High-level design: [docs/specs/2026-08-31-agentone-v2-design.md](docs/specs/2026-08-31-agentone-v2-design.md).

## The big picture

```
┌────────────────────────────────────────────────────────────────────┐
│  Renderer (React 19 + Zustand + Tailwind)                          │
│                                                                    │
│  Onboarding wizard:  framework → config → model (local/cloud) →    │
│                      deploy → channel → use-case                   │
│  Surfaces: Task · Capabilities · Channels · Use cases · Settings    │
│                                                                    │
│  Talks to main ONLY via window.agentone (typed preload bridge)     │
└──────────────────────────────┬─────────────────────────────────────┘
                               │  ipcRenderer.invoke (preload)
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│  Main process (Node/Electron)                                      │
│                                                                    │
│  ipc-handlers.ts ──── the single IPC surface (~30 channels)        │
│        │                                                           │
│        ├── FrameworkManager                                         │
│        │    ├── framework-registry.ts   (metadata + install recipes)│
│        │    └── adapters (src/main/frameworks/):                    │
│        │         OpenclawAdapter · ZeptoclawAdapter · HermesAdapter │
│        │         each implements FrameworkAdapter (below)          │
│        │         + ProcessManager for spawned CLI/WebUI processes  │
│        │                                                           │
│        ├── Model backends (src/main/model-backends/):              │
│        │    ollama (managed, incl. model download) · llamacpp ·    │
│        │    vllm · custom endpoint · cloud (anthropic, openai-     │
│        │    compatible, azure, bedrock w/ SigV4)                   │
│        │                                                           │
│        ├── Capability orchestrator (skill/plugin/MCP install-      │
│        │    remove loop, gap detection)                            │
│        │                                                           │
│        ├── database.ts  (better-sqlite3, SQLite in userData)       │
│        ├── secrets.ts   (credential store, restricted perms)       │
│        └── hardware-detector.ts (picks sensible local-model size)  │
│                                                                    │
│  Spawns / talks to: framework CLIs (openclaw, zeptoclaw, hermes),  │
│  Ollama/llama.cpp/vLLM model servers, cloud provider APIs          │
└────────────────────────────────────────────────────────────────────┘
```

## Key abstractions

### `FrameworkAdapter` — the framework plugin point

Defined in [src/shared/v2-types.ts](src/shared/v2-types.ts). One implementation per framework ([src/main/frameworks/](src/main/frameworks/)); the rest of the app is framework-agnostic:

```ts
install()                              // install the framework runtime
configure(backend: ModelBackendConfig) // write the framework's model config
start() / stop() / status() / restart()
sendTask(input)                        // submit a task
streamOutput(cb)                       // stream the agent's reply
listCapabilities() / installCapability(spec) / removeCapability(spec)
requiresRestartAfterInstall()          // true: capabilities load at startup
detectGap?(input)                      // "your agent is missing skill X"
listChannels?() / configureChannel?(spec) / removeChannel?(id)
```

Adapters are deliberately **injectable** (probe / execWithArgs / processManager / secrets parameters) so tests run hermetically.

**Node-version guardrails:** openclaw requires Node 22+ while the host runs Node 16 — the openclaw adapter runs every CLI call under an isolated Node 22 with a sandboxed `PATH` (bundled `resources/node22-bin` in packaged builds, `OPENCLAW_NODE22_BIN_DIR` env override, else a generic nvm fallback). See the "Ruling O1" comments in [src/main/frameworks/openclaw-adapter.ts](src/main/frameworks/openclaw-adapter.ts).

### Model backends

`ModelBackendKind = "ollama" | "llamacpp" | "vllm" | "custom" | "cloud"` with protocol `v1/messages` or `v1/chat/completions`. Each backend implements `chat(messages, onToken)` for streaming. Cloud backends (Anthropic, OpenAI-compatible, Azure, Bedrock + AWS SigV4) read API keys from the secrets store — raw secrets never enter the database or the renderer.

### IPC boundary

All renderer ↔ main traffic goes through:

1. `ipcMain.handle(...)` in [src/main/ipc-handlers.ts](src/main/ipc-handlers.ts) (deployments, capabilities, channels, model backends, DB reads/writes, ollama control),
2. the typed bridge in [src/preload/index.ts](src/preload/index.ts) exposed as `window.agentone`.

Renderer code must never import main-process modules; shared types come from `src/shared/`.

### State & routing (renderer)

- **Store:** [src/renderer/store.ts](src/renderer/store.ts) (Zustand). `AppView` selects the page; `WizardStep` drives the onboarding flow:
  `framework → config → model-location → model-local | model-cloud → deploy → channel → use-case`
- **Pages** ([src/renderer/pages/](src/renderer/pages/)): the wizard (8 steps) plus `TaskPage`, `CapabilitiesPage`, `ChannelsPage`, `UseCasesPage`, `SettingsPage`, and the v1-era `SetupPage`/`OnboardingPage`/`DashboardPage` (kept, deferred in v2).
- **Use-case catalog** ([src/shared/use-cases.ts](src/shared/use-cases.ts)) and **channel catalog** ([src/shared/channels.ts](src/shared/channels.ts)) are pure data modules shared by renderer and tests; `buildPrompt()` ([src/renderer/lib/prompt-builder.ts](src/renderer/lib/prompt-builder.ts)) is a pure, unit-tested function.

### Persistence

- **SQLite** (`better-sqlite3`, file in Electron's `userData`) — deployments, model backends (reference only, no secrets), capabilities, channels, conversations, usage stats. Schema + migrations live in [src/main/database.ts](src/main/database.ts).
- **Secrets** — separate JSON file written by [src/main/secrets.ts](src/main/secrets.ts) with restrictive permissions.

### Process management

[ProcessManager](src/main/frameworks/process-manager.ts) spawns and tracks framework CLI/gateway child processes, captures streaming output, and handles stop/restart. Frameworks load capabilities **at startup**, so capability installs are followed by `restart()` when `requiresRestartAfterInstall()` is true.

## Directory map

| Path | Role |
|---|---|
| `src/main/` | Electron main process (adapters, backends, DB, secrets, IPC) |
| `src/preload/` | `window.agentone` context bridge |
| `src/renderer/` | React UI (pages, wizard, components, store, hooks) |
| `src/shared/` | Types + catalogs shared by all three sides |
| `src/personas/` | v1 persona JSON (deferred in v2, kept for reference) |
| `tests/main`, `tests/renderer` | vitest suites (run separately — see README) |
| `docs/specs/` | Design specs, per phase |
| `docs/research/` | Per-framework research & verified spikes |
| `scripts/` | Packaging helpers (icon generation, Node 22 staging) |
| `build/` | Packaging assets (`icon.icns`) |

## Design decisions worth knowing

1. **The app drives frameworks, it doesn't embed them.** AgentOne installs, configures, and supervises external framework CLIs rather than forking their runtimes — simpler, and it means the frameworks' own ecosystems (plugins, MCP) keep working untouched.
2. **Capabilities are app-orchestrated, not agent-self-installed.** Cross-framework research showed only partial support for mid-task self-install, so AgentOne owns the install/remove loop and restarts the framework afterwards.
3. **Config-file as the contract.** Each framework's model wiring is expressed by writing its native config file (`~/.openclaw/openclaw.json`, `~/.zeptoclaw/config.json`, `~/.hermes/config.yaml`) — the recipes are documented in [docs/research/](docs/research/).
4. **Loopback-first, no telemetry.** Model servers bind to localhost; cloud calls go straight to the provider.
