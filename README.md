# AgentOne

<div align="left">

**AgentOne is a desktop launcher and capability manager for agent frameworks.** Deploy a real agent framework in a few clicks, pick where its model runs (local or cloud), connect it to a messaging channel, and just *ask* — the app quietly installs the skills, plugins, or MCP servers the task needs.

[![CI](https://github.com/nikghodki/agentone/actions/workflows/ci.yml/badge.svg)](https://github.com/nikghodki/agentone/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-lightgrey.svg)](LICENSE)
[![Platform: macOS](https://img.shields.io/badge/Platform-macOS-lightgrey.svg)](PACKAGING.md)
[![App](https://img.shields.io/badge/App-Electron%2023%20%C2%B7%20React%2019%20%C2%B7%20SQLite-blue.svg)](ARCHITECTURE.md)

</div>

---

## What it does

- **One-click framework deployment** — pick one of three supported agent frameworks and AgentOne installs, configures, and starts it:
  - **zeptoclaw** (default) — Rust, single binary, SSE streaming
  - **openclaw** — Node, CLI + Web UI + WebSocket
  - **hermes** — Python, JSON-RPC/stdio + WebSocket
- **Choose your model backend** — where the agent's brain runs:
  - *Managed local* — Ollama (AgentOne can download & manage models for you)
  - *Advanced local* — llama.cpp, vLLM
  - *Custom endpoint* — anything speaking `v1/messages` or `v1/chat/completions`
  - *Cloud* — Anthropic, OpenAI, OpenRouter, Azure OpenAI, Amazon Bedrock
- **Connect a messaging channel** — talk to your agent from **Telegram**, **Slack**, **Discord**, or **WhatsApp Cloud**.
- **Manage capabilities** — install and remove the skills, plugins, and MCP servers your tasks need.
- **Use-case prompt generator** — ten curated, framework-agnostic tasks (research a topic, summarize a document, draft an email, write & explain code, debug an error, plan a project, brainstorm, analyze a CSV, rewrite/adjust tone, answer from notes). Pick one, fill in a few fields, and copy a ready-to-paste prompt to your agent.

## Screenshots

*(Add screenshots here before publishing — onboarding wizard, Task page, Channels, Use cases.)*

## How to use it

1. **Launch & onboard** — the first-run wizard walks you through: pick a **framework**, set its **config**, choose a **model** (local via Ollama/llama.cpp/vLLM, a custom endpoint, or a **cloud** provider), then **deploy**.
2. **Connect a channel** (optional) — wire the agent to Telegram, Slack, Discord, or WhatsApp Cloud so you can reach it from your phone or workspace.
3. **Ask** — on the **Task** screen, type a task and AgentOne streams the agent's response.
4. **Add capabilities** — from **Capabilities**, install the skills/plugins/MCP servers the task needs; AgentOne restarts the framework so they load.
5. **Get started fast** — **Use cases** turns a template (research, debug, draft an email, …) into a copy-ready prompt.

> **macOS note:** the currently published build is unsigned/ad-hoc-signed for local use. Code signing + notarization is a tracked follow-up (see below).

## Requirements

- **macOS** (Apple Silicon first; see [PACKAGING.md](PACKAGING.md) for x64)
- **Node 16** on the host for source and tests (pinned to 16.16.0)
- **Node ≥ 22** for the *packaging* toolchain only. Run packaging under an isolated Node 22 (`nvm use 22`, or prefix `PATH`) — **do not** change your host Node.

## Getting started (from source)

```bash
git clone https://github.com/nikghodki/agentone.git && cd agentone
npm install                                  # host Node 16

npx vitest run tests/main                    # main-process suite
npx vitest run tests/renderer                # renderer suite

npm run dev                                  # run the app (renderer + main + preload + Electron)
```

The dev loop starts a Vite renderer on `http://localhost:5173` and launches Electron once it's up.

## Building a distributable app

```bash
# Run under Node 22 (host Node stays 16 for source/tests).
export PATH="/path/to/node-v22/bin:$PATH"    # or `nvm use 22`
export CSC_IDENTITY_AUTO_DISCOVERY=false     # unsigned: don't pick up a cert
unset ELECTRON_RUN_AS_NODE

npm run build                                # compile renderer + main + preload → dist/
npm run rebuild:electron                     # better-sqlite3 → Electron's ABI
npx electron-builder --mac --arm64           # → release/AgentOne-<version>-arm64.dmg
```

Full packaging notes (Node-22 bundling for openclaw, x64, signing/notarization) are in [PACKAGING.md](PACKAGING.md).

## Tests

The main and renderer suites must be **run separately** — the combined run trips a known Node 16 V8 teardown flake.

```bash
npx vitest run tests/main      # main-process suite
npx vitest run tests/renderer  # renderer suite
```

### The `better-sqlite3` ABI gotcha (important)

`better-sqlite3` is a native module bound to **one** ABI at a time:

- After `npm run rebuild:electron` it's compiled for **Electron's ABI** (packaging).
- The tests need it compiled for **host Node's ABI**.

If you package and then run the tests, the main-process tests fail with `ERR_DLOPEN_FAILED`. Fix with:

```bash
npm rebuild better-sqlite3
```

CI handles this automatically.

## Architecture & project layout

See [ARCHITECTURE.md](ARCHITECTURE.md) for the component diagram, the `FrameworkAdapter` plugin point, the IPC boundary, and design decisions.

```
src/
  main/                  Electron main process
    frameworks/            per-framework adapters (openclaw, zeptoclaw, hermes) + process manager
    model-backends/        ollama, llamacpp, vllm, custom, cloud (anthropic/openai/azure/bedrock)
    database.ts            SQLite (better-sqlite3) persistence
    ipc-handlers.ts        renderer ⇄ main IPC surface
    secrets.ts             cloud credential storage
  preload/                 context bridge (window.agentone)
  renderer/                React 19 + Zustand + Tailwind UI
    pages/                 onboarding wizard + Task/Capabilities/Channels/UseCases/Settings
    components/            wizard steps, UI kit, chat
  shared/                  types, channel catalog, use-case catalog
  personas/                v1 persona JSON (deferred in v2, kept for reference)
tests/                     vitest suites (main + renderer)
docs/
  specs/                   design specs (v2 + per-phase)
  research/                per-framework research notes
  superpowers/plans/       per-phase implementation plans
scripts/                   packaging helpers (icon generation, Node 22 staging)
PACKAGING.md               macOS build & distribution guide
ARCHITECTURE.md            system architecture
CONTRIBUTING.md            how to contribute
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — how it's put together
- [CONTRIBUTING.md](CONTRIBUTING.md) — dev setup, testing, conventions, what to help with
- [PACKAGING.md](PACKAGING.md) — building the macOS app, Node 22, x64, signing/notarization
- [docs/specs/](docs/specs/) — design specifications (v2 launcher concept + each phase)
- [docs/research/](docs/research/) — per-framework research notes
- [docs/superpowers/plans/](docs/superpowers/plans/) — implementation plans per phase

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). In short: branch off `main`, make your change, run the **split** test suites (main and renderer separately), remember the `better-sqlite3` ABI rule, and open a PR.

## License

[ISC](LICENSE)
