# Contributing to AgentOne

Thanks for your interest in AgentOne. This guide covers how to set up a working environment, develop, test, and submit changes.

## Development environment

| Requirement | Version | Why |
|---|---|---|
| macOS | Apple Silicon first | Primary dev/test platform (see [PACKAGING.md](PACKAGING.md) for x64) |
| Node (host) | **16** (pinned to 16.16.0) | Source compilation and tests run on the host Node |
| Node (packaging only) | **≥ 22** (isolated) | `electron-builder` and the openclaw integration need Node 22 — run it via `nvm use 22` or a `PATH` prefix, **never** by upgrading the host Node |
| Xcode CLT | latest | Needed to compile the native `better-sqlite3` module |

```bash
git clone https://github.com/nikghodki/agentone.git
cd agentone
npm install        # host Node 16
```

## Run it

```bash
npm run dev
```

Starts the Vite renderer (port 5173), compiles main + preload in watch mode, and launches Electron once the renderer is up.

## Testing

The main and renderer suites **must be run separately** — the combined run trips a known Node 16 V8 teardown flake:

```bash
npx vitest run tests/main
npx vitest run tests/renderer
```

New behavior needs tests:

- **Main-process logic** (adapters, backends, database, IPC) → `tests/main/`
- **UI** (pages, wizard steps, components) → `tests/renderer/` using React Testing Library
- Adapters take injectable `probe` / `execWithArgs` / `processManager` / `secrets` parameters specifically so tests never touch the real system. Follow that pattern.

### The `better-sqlite3` ABI rule

`better-sqlite3` is native and is compiled for **one** ABI at a time:

- `npm install` / `npm rebuild better-sqlite3` → **host Node** ABI → tests work.
- `npm run rebuild:electron` → **Electron** ABI → packaging works, tests break with `ERR_DLOPEN_FAILED`.

If you package and then run tests, do `npm rebuild better-sqlite3` first. CI handles this automatically.

## Code style & conventions

- **TypeScript strict** — no `any` unless unavoidable; shared contracts live in `src/shared/` and are the single source of truth for main ↔ renderer ↔ preload.
- **Renderer ⇄ main communication only through IPC** via the typed `window.agentone` bridge in [src/preload/index.ts](src/preload/index.ts). Renderer code must never import from `src/main/`.
- **Secrets** are written through [src/main/secrets.ts](src/main/secrets.ts) to a restricted-perms file; never log them, never include them in IPC payloads or the SQLite DB (the DB stores references only).
- **Loopback-only** network defaults; no telemetry.
- Match the surrounding code's comment density and naming — comments in this codebase frequently cite the spec/ruling they implement (e.g. "Ruling O1").
- Specs live in [docs/specs/](docs/specs/); when implementing a spec'd feature, note the spec file in the commit/PR description.

## Branches & pull requests

- Branch off `main` with a descriptive name (e.g. `agentone-phase5-x`, `fix/capability-restart`).
- Small, focused PRs are preferred. A typical PR: change + tests + a one-paragraph summary of what/why.
- Keep PRs disjoint from other in-flight PRs where possible — this project is developed with parallel feature branches that merge independently.
- CI (split test suites on Node 16) must pass before merge.
- Packaging changes: run the pipeline in [PACKAGING.md](PACKAGING.md) and note the verified artifact (e.g. "arm64 .dmg built & launched").

## What we'd especially like help with

- **Code signing / notarization** so the macOS build works on other people's machines (see [PACKAGING.md](PACKAGING.md) "Known follow-ups")
- **x64 (Intel Mac) packaging** verification
- **CI coverage for packaging** (currently CI runs tests only)
- **Windows/Linux** porting (Electron shell should mostly transfer; native deps and framework install recipes need work)
- Additional **messaging channels** in [src/shared/channels.ts](src/shared/channels.ts)
- **Use-case catalog** growth in [src/shared/use-cases.ts](src/shared/use-cases.ts)

## Questions

Open a GitHub issue for anything unclear — there's no chat room yet.
