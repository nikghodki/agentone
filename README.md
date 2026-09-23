# AgentOne

**AgentOne is a desktop launcher and capability manager for agent frameworks.** Deploy a real agent framework in a few clicks, pick where its model runs (local or cloud), connect it to a messaging channel, and just *ask* — the app quietly installs the skills, plugins, or MCP servers the task needs.

> (macOS app id `com.agentone.app`.)

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

---

## Requirements

- **macOS** (Apple Silicon first; see [PACKAGING.md](PACKAGING.md) for x64)
- **Node 16** on the host for source and tests
- **Node ≥ 22** for the *packaging* toolchain only (`electron-builder`, `concurrently`). Run packaging under an isolated Node 22 (`nvm use 22`, or prefix `PATH`) — **do not** change your host Node.

## Getting started

```bash
# Install dependencies (host Node 16)
npm install

# Run the tests
#   NOTE: run the main and renderer suites separately (see "Tests" below).
npx vitest run tests/main
npx vitest run tests/renderer

# Run the app in dev (renderer + main + preload + Electron)
npm run dev
```

The dev loop starts a Vite renderer on `http://localhost:5173` and launches Electron once it's up.

## Building a distributable app

```bash
# Run under Node 22 (host Node stays 16 for source/tests).
export PATH="/path/to/node-v22/bin:$PATH"   # or `nvm use 22`
export CSC_IDENTITY_AUTO_DISCOVERY=false      # unsigned: don't pick up a cert
unset ELECTRON_RUN_AS_NODE

npm run build                                  # compile renderer + main + preload → dist/
npm run rebuild:electron                       # better-sqlite3 → Electron's ABI
npx electron-builder --mac --arm64             # → release/AgentOne-<version>-arm64.dmg
```

Full packaging notes (Node-22 bundling for openclaw, x64, signing/notarization) are in [PACKAGING.md](PACKAGING.md).

> **Status:** the current build is **unsigned / ad-hoc-signed** for local testing. Code signing + notarization with an Apple Developer certificate is required before distributing publicly on macOS. This is a known, tracked follow-up.

## Tests

The main and renderer suites must be **run separately**. Running the combined `npm test` (all files in one `vitest` process) trips a known Node 16 V8 teardown flake.

```bash
npx vitest run tests/main      # main-process suite
npx vitest run tests/renderer  # renderer suite
```

### The `better-sqlite3` ABI gotcha (important)

`better-sqlite3` is a native module. Its compiled `.node` is bound to **one** ABI at a time:

- After `npm run rebuild:electron` it is compiled for **Electron's ABI** (for packaging).
- The test suite needs it compiled for **host Node's ABI**.

If you package and then run the tests, the main-process tests fail with `ERR_DLOPEN_FAILED`. Fix by rebuilding for the host before testing:

```bash
npm rebuild better-sqlite3
```

The CI workflow handles this automatically.

## Project layout

```
src/
  main/                  Electron main process
    frameworks/            per-framework adapters (openclaw, zeptoclaw, hermes) + process manager
    model-backends/        anthropic, openai-compatible, azure, bedrock
    database.ts            SQLite (better-sqlite3) persistence
    ipc-handlers.ts        renderer ⇄ main IPC surface
    secrets.ts             cloud credential storage
  preload/                 context bridge
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
PACKAGING.md               macOS build & distribution guide
```

## Documentation

- [PACKAGING.md](PACKAGING.md) — building the macOS app, Node 22, x64, signing/notarization
- [docs/specs/](docs/specs/) — design specifications (v2 launcher concept + each phase)
- [docs/research/](docs/research/) — per-framework research notes
- [docs/superpowers/plans/](docs/superpowers/plans/) — implementation plans per phase

## Contributing

1. Branch off `main`, keep feature work on its own branch.
2. Make your change and run the **split** test suites (main and renderer separately).
3. If you touched packaging/native deps, remember the `better-sqlite3` ABI rule above.
4. Open a pull request against `main`.

## License

[ISC](LICENSE)
