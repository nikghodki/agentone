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
unset ELECTRON_RUN_AS_NODE                      # see caveat below — this MUST be unset

npm run build                                   # clean + compile renderer + main + preload → dist/
npm run icon                                    # generate app icon (build/icon.icns)
npm run stage:node22                            # stage Node 22 binary into build/node22-bin/
npm run rebuild:electron                        # better-sqlite3 → Electron's ABI (see below)

# Unpacked .app (fast pipeline check):
npx electron-builder --dir --mac --arm64        # → release/mac-arm64/AgentOne.app

# Full .dmg installer (arm64 — verified artifact):
npx electron-builder --mac --arm64              # → release/AgentOne-1.0.0-arm64.dmg (125M)

# Convenience script (icon + stage + rebuild + build):
npm run dist:mac                                # runs all steps above

# arm64 requires a valid signature to run — ad-hoc sign the bundle:
codesign --force --deep --sign - release/mac-arm64/AgentOne.app
open release/mac-arm64/AgentOne.app
```

Artifacts land in `release/`. The **verified arm64 build** produces `AgentOne-1.0.0-arm64.dmg` (125 MB) containing:
- Custom app icon (indigo "A" placeholder)
- Node 22 binary (108 MB) bundled at `Contents/Resources/node22-bin/node`
- better-sqlite3 native module (asar-unpacked)
- All app code and dependencies

### Why the extra steps (each is load-bearing)

- **`npm run stage:node22`** — copies the Node 22 binary from `spikes/openclaw-test/.nvm/versions/node/v22.23.2/bin/node` into `build/node22-bin/node` (override source via `OPENCLAW_NODE22_SRC` env). electron-builder bundles this into the .app at `Contents/Resources/node22-bin/` via `extraResources`. The packaged app's main process sets `process.env.OPENCLAW_NODE22_BIN_DIR` to this path when `app.isPackaged` is true, so the openclaw adapter uses the bundled Node 22.
- **`npm run rebuild:electron`** — electron-builder's own native rebuild pulls a *prebuilt* better-sqlite3 for the host Node ABI (v93 / Node 16), which crashes the packaged app at import (Electron needs `NODE_MODULE_VERSION 113`). So `electron-builder.yml` sets `npmRebuild: false` and we compile better-sqlite3 from source against Electron's headers via `rebuild:electron` first, then package it as-is. (If the Electron version changes, update the `--target` in that script. For x64 builds, use `npm run rebuild:electron:x64`.)
- **`codesign --force --deep --sign -`** — on Apple Silicon the kernel rejects a bundle whose signature doesn't seal its resources. `identity: null` skips signing and leaves the Electron binary's ad-hoc sig (which doesn't cover the app), so the app is killed on launch. Re-sign ad-hoc to seal the whole bundle. (`codesign --verify` should then pass.)
- **`unset ELECTRON_RUN_AS_NODE`** — if this env var is set (some ABI/debug commands set it), Electron runs as plain Node with **no GUI** — the app launches and exits immediately with no window. `open` inherits the caller's environment, so it must be unset in your shell too.
- **Node 22 binary is bundled; openclaw module tree is NOT.** The .dmg contains only the Node 22 **binary** (~108 MB) at `node22-bin/node`, not openclaw's ~882 MB global module tree. The packaged app resolves openclaw at runtime: the adapter calls `install()` under the bundled Node 22 (or uses a system openclaw install if present). This is the remaining integration step.
- **Ollama is not bundled.** The app uses a system Ollama install (`/opt/homebrew/bin/ollama`, `/usr/local/bin/ollama`, or PATH) via `resolveOllamaBinary()` in `src/main/paths.ts`. Install Ollama separately, or bundling it is a follow-up.

## What the build does

- `scripts/generate-icon.sh` creates a placeholder app icon (indigo "A") → `build/icon.icns`.
- `scripts/stage-node22.sh` copies the Node 22 binary into `build/node22-bin/` (electron-builder bundles this as `extraResources`).
- `@electron/rebuild` recompiles the native **better-sqlite3** module against
  Electron's ABI (Electron 23) — required or the app crashes on DB init.
- `better-sqlite3` is **asar-unpacked** (`asarUnpack` in `electron-builder.yml`) —
  a native `.node` cannot be loaded from inside the asar archive.
- The renderer loads from `file://` in the packaged app (`src/main/index.ts` only
  uses the `http://localhost:5173` dev server when `NODE_ENV=development`).
  Vite `base: "./"` makes the built asset paths relative so `file://` loading works.
- Framework binaries (zeptoclaw/hermes/openclaw) and models (Ollama/llama.cpp GGUF)
  are **downloaded/provisioned at runtime** by the adapters/managers — they are
  NOT bundled into the app. (Exception: the Node 22 **binary** is bundled; openclaw's
  module tree is installed at runtime.)

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

## Multi-architecture builds

The config supports both `arm64` (Apple Silicon) and `x64` (Intel) targets:

- **arm64** (verified): build on Apple Silicon hosts using `npm run rebuild:electron` (arm64 default). Produces `AgentOne-1.0.0-arm64.dmg` (125 MB).
- **x64**: build on Intel hosts (or CI) using `npm run rebuild:electron:x64` before `electron-builder`. The native better-sqlite3 module must be compiled for the target arch. Produces `AgentOne-1.0.0.dmg` (x64, ~129 MB).

The electron-builder config targets both archs (`mac.target.arch: [arm64, x64]`), but **only the arm64 artifact is verified on this Apple Silicon host** — x64 builds require an Intel host or CI for the native module compilation + verification.

## Known follow-ups

- **Code signing + notarization** for public distribution: the config is **env-gated** — set `CSC_LINK` / `CSC_KEY_PASSWORD` (code signing certificate .p12 + password) and `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` (Apple Developer credentials), then uncomment the `hardenedRuntime` + `notarize` block in `electron-builder.yml` and remove `identity: null`. (Needs the user's Apple Developer cert — not runnable here.)
- **openclaw module distribution** in the packaged app: the Node 22 **binary** is bundled, but the openclaw **module tree** (~882 MB) is NOT — the adapter installs/resolves it at runtime under bundled Node 22 (or uses a system openclaw). This is the remaining integration step.
- **Production icon**: the placeholder indigo "A" icon should be replaced with final branding when ready (regenerate via `npm run icon` after updating `scripts/generate-icon.sh`).
