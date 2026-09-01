# Packaging AgentOne (macOS)

This documents how to build a distributable macOS app from source. The current
target is an **unsigned local build** for testing; code signing + notarization
for public distribution is a follow-up (see below).

## Prerequisites

- **Node ≥ 22 for the build tooling.** The app source targets the Node runtime
  bundled inside Electron, but the build orchestration (`electron-builder@26`,
  `concurrently@10`, etc.) requires Node ≥ 20/22. The repo's *tests* and
  `npm run build` run on the pinned host Node 16, but **packaging must run under
  Node 22** — use an isolated Node 22 (e.g. `nvm use 22`, or prefix `PATH` with a
  Node 22 `bin`) so you do not change the host Node install.
- macOS with Xcode command-line tools (for the native `better-sqlite3` rebuild).

## Build

```bash
# Run under Node 22 (host Node is pinned to 16 for source/tests).
export PATH="/path/to/node-v22/bin:$PATH"     # or `nvm use 22`
export CSC_IDENTITY_AUTO_DISCOVERY=false        # unsigned: don't pick up a cert

npm run build                                   # compiles renderer + main + preload → dist/

# Unpacked .app (fast pipeline check):
npx electron-builder --dir --mac --arm64        # → release/mac-arm64/AgentOne.app

# Full .dmg installer:
npx electron-builder --mac --arm64              # → release/AgentOne-<version>-arm64.dmg
```

Artifacts land in `release/`.

## What the build does

- `@electron/rebuild` recompiles the native **better-sqlite3** module against
  Electron's ABI (Electron 23) — required or the app crashes on DB init.
- `better-sqlite3` is **asar-unpacked** (`asarUnpack` in `electron-builder.yml`) —
  a native `.node` cannot be loaded from inside the asar archive.
- The renderer loads from `file://` in the packaged app (`src/main/index.ts` only
  uses the `http://localhost:5173` dev server when `NODE_ENV=development`).
  Vite `base: "./"` makes the built asset paths relative so `file://` loading works.
- Framework binaries (zeptoclaw/hermes/openclaw) and models (Ollama/llama.cpp GGUF)
  are **downloaded/provisioned at runtime** by the adapters/managers — they are
  NOT bundled into the app.

## ⚠️ After packaging: rebuild better-sqlite3 for host Node

Packaging runs `@electron/rebuild`, which recompiles the native **better-sqlite3**
against **Electron's ABI** (`NODE_MODULE_VERSION 113` for Electron 23). This leaves
`node_modules/better-sqlite3` unusable under the host Node 16 — the test suite and
any `node`-run tooling will fail with *"compiled against a different Node.js version"*.

After building a package, restore it for host development/tests:

```bash
npm rebuild better-sqlite3     # rebuilds for the host Node (16) ABI
npx vitest run                 # should be green again
```

(`node_modules` is git-ignored, so this never affects commits — but it does affect
your local dev/test until you rebuild.)

## Installing the unsigned build

The `.dmg`/`.app` is **unsigned**, so Gatekeeper will block a normal double-click.
Open it once via **right-click → Open** (or `xattr -dr com.apple.quarantine AgentOne.app`).

## Known follow-ups

- **Code signing + notarization** for public distribution: add an Apple Developer
  ID cert + app-specific password, set `mac.identity` / re-enable `hardenedRuntime`
  + entitlements, and run notarization. (Deferred — needs credentials.)
- **openclaw in the packaged app** needs a bundled **Node 22** wired to the
  adapter's `node22BinDir`. Deferred: openclaw is not the default framework
  (see spec §12 post-O4), so the package ships with zeptoclaw (default) + hermes
  working; openclaw runtime bundling is a later step.
- **Intel (x64) build**: only `arm64` is built today. Add `x64` to `mac.target.arch`
  in `electron-builder.yml` when an Intel build is needed.
- **App icon**: no custom icon is set yet (electron-builder uses the default).
