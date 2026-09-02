# AgentOne — Step-2 Advanced (persona / gateway-port) Applied-at-Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The wizard's Step-2 **Advanced** panel already collects `frameworkConfig.persona` (string) and `frameworkConfig.port` (number) into the store, but they are silently dropped at deploy. Thread them through deploy so the adapter actually applies them — persona → the framework's SOUL.md persona file; port → the framework's `gateway.port` where verified.

**Architecture:** Extend `FrameworkAdapter.configure(backend)` to `configure(backend, options?)` (backward-compatible optional 2nd arg). Each adapter applies what it verifiably supports. Thread `options` through the `deploy-framework` IPC → preload → `DeployStep`. Pure additive; no new IPC channel.

**Tech Stack:** Electron 23 / React 18 / TS / better-sqlite3 / Zustand / Vitest + RTL (jsdom). Host Node 16. **Run tests SPLIT** (`vitest run tests/main` + `tests/renderer`) — combined `vitest` hits the known Node-16 V8 teardown flake.

**Spec:** Phase 1 redesign spec `docs/specs/2026-09-02-agentone-redesign-guided-setup.md` (Step-2 Advanced panel). This plan is the design of record for the applied-at-deploy wiring; verified config facts below are the binding authority.

## Global Constraints
- **No invented config keys / paths.** Only the verified applications below. Anything not verified is a no-op (with a code comment saying why), never a guess.
- **Verified persona-file paths** (doc `docs/research/verified/framework-setup-config.md` + live on this machine):
  - hermes → `<configDir>/SOUL.md` (i.e. `~/.hermes/SOUL.md`)
  - zeptoclaw → `<configDir>/workspace/SOUL.md` (i.e. `~/.zeptoclaw/workspace/SOUL.md`)
  - openclaw → `<configDir>/workspace/SOUL.md` (i.e. `~/.openclaw/workspace/SOUL.md`)
- **Verified gateway-port keys:** openclaw `gateway.port` (default 18789, live in `~/.openclaw/openclaw.json`), zeptoclaw `gateway.port` (default 8080, verified doc §ZeptoClaw). **hermes has NO verified messaging-gateway bind-port key** (its `gateway` = OAuth Tool Gateway; messaging is per-`platforms.*`) → hermes **ignores** `gatewayPort` (documented no-op), still applies persona.
- **Persona write rules:** write the markdown file ONLY when persona is a non-empty (trimmed) string — never clobber the framework's auto-created template with empty content. `mkdir -p` the parent dir first. Persona is file CONTENT (not a shell arg) — no injection risk; do not log its contents.
- **Port validation:** coerce to integer; apply only when it is a finite integer in `[1, 65535]`; otherwise ignore. Deep-merge `{ gateway: { port } }` preserving all other config keys (reuse each adapter's existing deep-merge). Never a shell arg.
- Injection-safe throughout (arg-arrays / escaped writes). Loopback only. Host Node 16; existing suites green (main 309 / renderer 129, run split). No secrets involved (persona/port are not secrets).

## File Structure
- Modify: `src/shared/v2-types.ts` (extend `configure` signature + add `FrameworkDeployOptions` type).
- Modify: `src/main/frameworks/zeptoclaw-adapter.ts`, `hermes-adapter.ts`, `openclaw-adapter.ts` (apply persona + port in/after `configure`).
- Modify: `src/main/ipc-handlers.ts` (`deploy-framework` accepts + forwards `options`).
- Modify: `src/main/preload.ts` + `src/renderer/electron.d.ts` (deployFramework 3rd arg).
- Modify: `src/renderer/pages/wizard/DeployStep.tsx` (pass mapped options).
- Tests: `tests/main/*-adapter*.test.ts` (per adapter), `tests/main/ipc-*deploy*.test.ts` (or existing deploy handler test), `tests/renderer/*deploy-step*.test.tsx`.

## Interfaces
```ts
// src/shared/v2-types.ts
export interface FrameworkDeployOptions {
  persona?: string;       // agent persona/SOUL.md content; applied only if non-empty (trimmed)
  gatewayPort?: number;   // messaging gateway port; applied only where the framework has a verified key
}
export interface FrameworkAdapter {
  // ...
  configure(backend: ModelBackendConfig, options?: FrameworkDeployOptions): Promise<void>;
  // ...
}
```
Each adapter defines a private persona-path getter relative to its injectable `configDir`:
- hermes: `path.join(this.configDir, "SOUL.md")`
- zeptoclaw: `path.join(this.configDir, "workspace", "SOUL.md")`
- openclaw: `path.join(this.configDir, "workspace", "SOUL.md")`

---

## Task 1: Extend the adapter contract + a shared applier helper

**Files:** `src/shared/v2-types.ts` (modify). Tests: none new (type-only change; compile-checked by later tasks). 

- [ ] **Step 1:** Add `FrameworkDeployOptions` interface (as above) to `src/shared/v2-types.ts`.
- [ ] **Step 2:** Change `configure(backend: ModelBackendConfig): Promise<void>` → `configure(backend: ModelBackendConfig, options?: FrameworkDeployOptions): Promise<void>` in the `FrameworkAdapter` interface.
- [ ] **Step 3:** `npm run build` (or `tsc --noEmit`) — expect the 3 adapters to still compile (their impls omit the optional 2nd param, which is legal). Fix any type breakage.
- [ ] **Step 4:** Commit `feat(step2): FrameworkDeployOptions + optional 2nd arg on configure`.

## Task 2: zeptoclaw — apply persona (workspace/SOUL.md) + gateway.port

**Files:** `src/main/frameworks/zeptoclaw-adapter.ts` (modify). Test: `tests/main/zeptoclaw-adapter.test.ts` (extend).

- [ ] **Failing tests:**
  - `configure(backend, { persona: "You are a helpful ops bot." })` writes `<configDir>/workspace/SOUL.md` with exactly that content (mkdir the workspace dir first); the model-provider config in `config.json` is still written as before (deep-merge intact).
  - `configure(backend, { persona: "  " })` (whitespace-only) and `configure(backend, {})` and `configure(backend)` write NO SOUL.md (no clobber).
  - `configure(backend, { gatewayPort: 8090 })` deep-merges `gateway.port === 8090` into `config.json` while PRESERVING existing `providers`/`agents` keys.
  - `configure(backend, { gatewayPort: 70000 })` and `{ gatewayPort: 0 }` and `{ gatewayPort: NaN as any }` do NOT write a `gateway` key (out of range/invalid ignored).
- [ ] Run → fail. Implement: in `configure`, after the existing config write, (a) if `options?.gatewayPort` is an integer in `[1,65535]`, deep-merge `{ gateway: { port } }` into the config object before writing (or a second guarded merge+write); (b) if `options?.persona?.trim()` is non-empty, `fs.mkdir(path.join(configDir,"workspace"),{recursive:true})` then `fs.writeFile(personaPath, persona, "utf-8")`. Do not log persona content.
- [ ] Run tests (split) + build. Commit `feat(step2): zeptoclaw applies persona + gateway.port`.

## Task 3: openclaw — apply persona (workspace/SOUL.md) + gateway.port

**Files:** `src/main/frameworks/openclaw-adapter.ts` (modify). Test: `tests/main/openclaw-adapter.test.ts` (extend).

- [ ] **Failing tests:**
  - `configure(backend, { persona: "..." })` writes `<configDir>/workspace/SOUL.md` with that content; existing `openclaw.json` model config + any pre-existing `gateway` keys (bind/auth) are preserved.
  - empty/whitespace/absent persona → no SOUL.md write.
  - `configure(backend, { gatewayPort: 18800 })` deep-merges `gateway.port === 18800` while preserving `gateway.bind`, `gateway.auth`, and model keys (start from a fixture config that already has a `gateway` block).
  - invalid/out-of-range port ignored.
- [ ] Run → fail. Implement mirroring Task 2, using openclaw's existing deep-merge write path (do NOT clobber `gateway.auth.token` / `gateway.bind`). Persona path `path.join(configDir,"workspace","SOUL.md")`.
- [ ] Run tests (split) + build. Commit `feat(step2): openclaw applies persona + gateway.port`.

## Task 4: hermes — apply persona (SOUL.md); port is a documented no-op

**Files:** `src/main/frameworks/hermes-adapter.ts` (modify). Test: `tests/main/hermes-adapter.test.ts` (extend).

- [ ] **Failing tests:**
  - `configure(backend, { persona: "..." })` writes `<configDir>/SOUL.md` with that content; the YAML `model.*` config is still written as before.
  - empty/whitespace/absent persona → no SOUL.md write.
  - `configure(backend, { gatewayPort: 8090 })` does NOT add any `gateway`/`port` key to `config.yaml` (hermes has no verified messaging-gateway bind-port key) — assert the written YAML is byte-identical to the no-options case for the port dimension. Persona still applies if also given.
- [ ] Run → fail. Implement: persona write to `path.join(configDir,"SOUL.md")` (same rules); add a code comment: `// hermes 'gateway' is the OAuth Tool Gateway; messaging is per-platforms.* — no verified bind-port key, so gatewayPort is intentionally ignored.` Do not touch `config.yaml` for port.
- [ ] Run tests (split) + build. Commit `feat(step2): hermes applies persona (port intentionally no-op)`.

## Task 5: Thread options through deploy-framework IPC + preload

**Files:** `src/main/ipc-handlers.ts`, `src/main/preload.ts`, `src/renderer/electron.d.ts` (modify). Test: `tests/main` deploy-handler test (extend or add `tests/main/ipc-deploy-options.test.ts`).

**Interfaces:** Consumes `FrameworkDeployOptions` (Task 1). Produces: `deployFramework(frameworkId, modelBackendId, options?)`.

- [ ] **Failing tests:** the `deploy-framework` handler, given `(frameworkId, modelBackendId, { persona:"P", gatewayPort:8090 })`, calls `adapter.configure(backend, { persona:"P", gatewayPort:8090 })` (spy on a mock adapter). With no 3rd arg, calls `configure(backend, undefined)` (or `configure(backend)`) — backward compatible. Deployment record creation unchanged.
- [ ] Run → fail. Implement: `ipcMain.handle("deploy-framework", async (_e, frameworkId, modelBackendId, options?: FrameworkDeployOptions) => { ... await adapter.configure(backend, options); ... })`. Update `preload.ts` `deployFramework: (frameworkId, modelBackendId, options) => ipcRenderer.invoke("deploy-framework", frameworkId, modelBackendId, options)` and the `electron.d.ts` type.
- [ ] Run tests (split) + build. Commit `feat(step2): deploy-framework IPC forwards advanced options to configure`.

## Task 6: DeployStep passes the collected persona/port

**Files:** `src/renderer/pages/wizard/DeployStep.tsx` (modify). Test: `tests/renderer/*deploy-step*.test.tsx` (extend).

- [ ] **Failing tests:** with store `frameworkConfig = { persona: "P", port: 8090 }`, deploying calls `window.electronAPI.deployFramework(frameworkId, backendId, { persona:"P", gatewayPort:8090 })`. With `frameworkConfig = {}` (nothing entered), the 3rd arg is `undefined` OR `{}` with no persona/gatewayPort (assert no stray keys). Existing deploy-success navigation (→ channel step) unchanged.
- [ ] Run → fail. Implement: build `const advanced = {}; if (frameworkConfig.persona?.trim()) advanced.persona = frameworkConfig.persona; if (typeof frameworkConfig.port === "number") advanced.gatewayPort = frameworkConfig.port;` then `deployFramework(selectedFrameworkId, backendId, Object.keys(advanced).length ? advanced : undefined)`. Map `port → gatewayPort`.
- [ ] Run tests (split) + build. Commit `feat(step2): DeployStep passes persona + gateway port to deploy`.

## Task 7: Full-suite verify + status note

- [ ] Split suites (`tests/main` + `tests/renderer`) green + `npm run build` clean; host node16.
- [ ] Add a one-line note to the Phase 1 redesign spec (or a short verified doc) recording that Step-2 Advanced is now applied-at-deploy, with the per-framework mapping (persona→SOUL.md all three; port→gateway.port openclaw+zeptoclaw; hermes port no-op).
- [ ] Commit `docs(step2): Advanced persona/port applied-at-deploy`.

## Notes / Deferrals
- hermes gateway/messaging port remains unconfigurable via the app until a verified key exists (its messaging is per-`platforms.*`, set in Slice 2c).
- Persona overwrites the framework's auto-created SOUL.md template with the user's text (intended customization; the frameworks treat SOUL.md as user-editable). Only when non-empty.
- No live E2E required — writes go to injectable `configDir`; unit tests assert file contents + deep-merge preservation.
