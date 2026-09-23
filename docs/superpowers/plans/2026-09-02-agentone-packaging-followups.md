# AgentOne — Packaging Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. NOTE: this is ops/build-tooling work; most steps verify by building/inspecting artifacts, not unit tests. Only Task 2 (paths helper) is unit-tested.

**Goal:** Advance the macOS packaging follow-ups: a placeholder **app icon**, an **x64/Intel** target (wired), a **Node-22 bundling mechanism** so the packaged app can run openclaw under a bundled Node 22, and **signing/notarization config** wired (but stubbed — needs the user's Apple Developer cert). Produce and verify a real **arm64 `.dmg`**.

**Architecture:** electron-builder config + a small tested `paths.ts` helper + main-process env injection (the openclaw adapter ALREADY resolves `OPENCLAW_NODE22_BIN_DIR` from env, so NO adapter change is needed). A staging script copies the Node 22 binary into `build/node22-bin/` which `extraResources` bundles into `resources/node22-bin`.

**Tech Stack:** Electron 23 (^23.3.13) / electron-builder ^26 / better-sqlite3 / macOS `sips`+`iconutil`. Build tooling runs under **isolated Node 22** (`spikes/openclaw-test/.nvm/versions/node/v22.23.2/bin`); host Node stays 16 for source/tests. **Run tests SPLIT.**

**Spec:** `PACKAGING.md` "Known follow-ups" (icon / x64 / node22 / signing). This plan is the design of record.

## Global Constraints (rulings — binding)
- **Do NOT bundle the ~882MB openclaw global module tree** into the .dmg. Bundle only the Node 22 **binary** (~115MB) + wire resolution; document that openclaw's own install is handled by the app's `install()` under bundled Node 22 (or a system openclaw) as the remaining integration step. Shipping a ~1GB installer is not the right design.
- **Signing stays OFF by default** (`identity: null` / `CSC_IDENTITY_AUTO_DISCOVERY=false`) so the unsigned build keeps working; add signing/notarization config **gated on env vars** (present only when the user supplies `CSC_LINK`/`CSC_KEY_PASSWORD` + Apple ID creds). Never hardcode a cert.
- **x64:** wire the target arch + an x64 better-sqlite3 rebuild script, but the VERIFIED artifact this task produces is **arm64** (native better-sqlite3 built from source for arm64 cannot be run/verified as x64 on this Apple-Silicon host). Document x64 as build-on-x64/CI.
- Host Node pinned 16 for source/tests; build tooling under Node 22. After any packaging rebuild of better-sqlite3 to Electron ABI, **`npm rebuild better-sqlite3`** to restore host-Node-16 tests (existing GOTCHA). Existing suites stay green (main 346 / renderer 143 on the branch base — see below).
- Loopback-only / no secrets — unchanged. No behavior change to app runtime beyond the packaged-only env injection.

## Branch base
Branch off `origin/main`. WS5 files (`electron-builder.yml`, `src/main/index.ts`, `src/main/paths.ts`, `package.json`, `PACKAGING.md`, new `build/` assets + `scripts/`) are DISJOINT from the open PRs (#18/#19/#20), so it merges independently.
(Test baseline on origin/main: main 309 / renderer 142 — the WS2/WS3 test additions live on their own branches.)

## File Structure
- Create: `build/icon.icns` (generated), `scripts/generate-icon.sh` (regenerates it), `scripts/stage-node22.sh` (stages the Node 22 binary into `build/node22-bin/`).
- Modify: `electron-builder.yml` (icon, x64 arch, extraResources, env-gated signing/notarize), `package.json` (icon/stage/x64-rebuild scripts), `src/main/paths.ts` (`resolveBundledNode22BinDir()`), `src/main/index.ts` (set `OPENCLAW_NODE22_BIN_DIR` when packaged), `PACKAGING.md`.
- Test: `tests/main/paths-node22.test.ts` (new).

---

## Task 1: Placeholder app icon
**Files:** `scripts/generate-icon.sh` (new), `build/icon.icns` (generated), `electron-builder.yml`, `package.json`.

- [ ] Create `scripts/generate-icon.sh` that generates a simple branded icon deterministically: write a 1024×1024 PNG (e.g. via a small inline approach — a solid indigo `#4F46E5` rounded square with a white "A1"/"A" — you may create the base PNG with `sips`-friendly input, or generate an SVG and rasterize; if no rasterizer, produce the PNG with a tiny Node/`sips` step), then build an `.iconset` (the standard sizes 16..1024 incl @2x via `sips -z`) and `iconutil -c icns` → `build/icon.icns`.
- [ ] Run the script; confirm `build/icon.icns` exists and is a valid icns (`file build/icon.icns`).
- [ ] `electron-builder.yml`: add `mac.icon: build/icon.icns`. `package.json`: add `"icon": "bash scripts/generate-icon.sh"`.
- [ ] Commit `build(pkg): placeholder app icon + generator`.

## Task 2: Bundled-Node-22 path helper (unit-tested)
**Files:** `src/main/paths.ts`. Test: `tests/main/paths-node22.test.ts` (new).

- [ ] **Failing tests:**
  - `resolveBundledNode22BinDir()` returns `path.join(process.resourcesPath, "node22-bin")` when that directory EXISTS (mock `process.resourcesPath` to a temp dir containing `node22-bin/`), and `null` when it does not exist (temp dir without it) or when `process.resourcesPath` is undefined (dev/test).
- [ ] Run → fail. Implement `export function resolveBundledNode22BinDir(): string | null` in paths.ts mirroring the existing `resolveOllamaBinary` style (guard on `process.resourcesPath` + `fs.existsSync`).
- [ ] Run `npx vitest run tests/main` (green) + build. Commit `feat(pkg): resolveBundledNode22BinDir helper`.

## Task 3: Inject OPENCLAW_NODE22_BIN_DIR when packaged
**Files:** `src/main/index.ts`.

- [ ] In the app bootstrap (before any framework adapter is created — e.g. top of `app.whenReady()` or module load), if `app.isPackaged` and `resolveBundledNode22BinDir()` returns a dir and `process.env.OPENCLAW_NODE22_BIN_DIR` is unset, set `process.env.OPENCLAW_NODE22_BIN_DIR = <that dir>`. Add a one-line log (path only, no secrets). This makes the openclaw adapter (which already reads that env with top precedence after injection) use the bundled Node 22 in production, with the dev fallback unchanged.
- [ ] `npm run build` clean. Commit `feat(pkg): use bundled Node 22 for openclaw when packaged`.

## Task 4: electron-builder — x64 target, extraResources, env-gated signing
**Files:** `electron-builder.yml`, `scripts/stage-node22.sh` (new), `package.json`.

- [ ] `scripts/stage-node22.sh`: copy the Node 22 **binary** from `${OPENCLAW_NODE22_SRC:-spikes/openclaw-test/.nvm/versions/node/v22.23.2}/bin/node` into `build/node22-bin/node` (mkdir -p; chmod +x). Print the staged path + size. (Binary only — NOT the module tree, per Global Constraints.)
- [ ] `electron-builder.yml`:
  - `extraResources`: `- from: build/node22-bin` `to: node22-bin` (so it lands at `<app>/Contents/Resources/node22-bin`). Guard-friendly: if `build/node22-bin` is absent the build still works (electron-builder skips missing globs? — if not, ensure the stage script runs first via the dist script).
  - `mac.target[0].arch`: `[arm64, x64]`.
  - Add COMMENTED / env-gated signing+notarization block: document `mac.notarize` + how `CSC_LINK`/`CSC_KEY_PASSWORD`/`APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID` enable it; keep `identity: null` default. Do NOT enable notarize unconditionally.
- [ ] `package.json`: add `"stage:node22": "bash scripts/stage-node22.sh"`, `"rebuild:electron:x64": "cd node_modules/better-sqlite3 && node-gyp rebuild --target=23.3.13 --arch=x64 --dist-url=https://electronjs.org/headers"`, and a `"dist:mac": "npm run stage:node22 && npm run rebuild:electron && electron-builder --mac"` convenience script.
- [ ] `npm run build` clean (config parses). Commit `build(pkg): x64 target + node22 extraResources + env-gated signing config`.

## Task 5: Produce & verify a real arm64 .dmg + PACKAGING.md
**Files:** `PACKAGING.md`.

- [ ] Under **Node 22** (`export PATH="$PWD/spikes/openclaw-test/.nvm/versions/node/v22.23.2/bin:$PATH"; unset ELECTRON_RUN_AS_NODE; export CSC_IDENTITY_AUTO_DISCOVERY=false`): run `npm run icon` (if not already built), `npm run stage:node22`, `npm run rebuild:electron`, then `npx electron-builder --mac --arm64` (arm64 only for the verified artifact). Verify: `release/*.dmg` (arm64) is produced; the `.app` contains `Contents/Resources/node22-bin/node` and the custom icon (`Contents/Resources/*.icns`). Capture the dmg filename + size.
- [ ] **Restore host tests:** `npm rebuild better-sqlite3` (host Node 16), then confirm `npx vitest run tests/main` + `npx vitest run tests/renderer` green (incl. the new paths test), host node16.
- [ ] Update `PACKAGING.md`: mark icon / node22-bundle / x64 done-or-wired; document (a) run `npm run stage:node22` before `dist`; (b) the openclaw **module tree** is NOT bundled (~882MB) — the app installs/resolves openclaw under bundled Node 22 at runtime (or use a system openclaw) — this is the remaining integration step; (c) x64 must be built on an x64 host/CI (uses `rebuild:electron:x64`); (d) signing/notarization: set `CSC_LINK`/`CSC_KEY_PASSWORD` + Apple creds to enable (needs the user's Apple Developer cert). Record the produced arm64 dmg name/size.
- [ ] Commit `docs(pkg): packaging follow-ups (icon, node22 bundle, x64, signing) + build verified`.

## Notes / Deferrals
- **Signing/notarization** requires the user's Apple Developer certificate + credentials — wired via env, not runnable here (BLOCKED on the cert).
- **x64** artifact not verifiable on this Apple-Silicon host (native better-sqlite3) — config + rebuild script wired; build on x64/CI.
- **openclaw module distribution** in the package is the remaining integration step (bundling ~882MB is not the right design) — documented.
- If the full `electron-builder` run fails after reasonable troubleshooting, commit the config/code/docs work and report BLOCKED with the exact error (do not thrash the build).
