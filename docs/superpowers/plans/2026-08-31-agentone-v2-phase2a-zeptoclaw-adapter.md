# AgentOne v2 Phase 2a — zeptoclaw Adapter + Capability Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one framework work end-to-end — deploy **zeptoclaw** (sandboxed), wire it to a model backend, run a task with streamed output, and prove the app-orchestrated capability loop (detect gap → install → resume, with app-triggered + monitored restart when a framework requires it).

**Architecture:** Add a `ProcessManager` (sandboxed child-process spawn + monitored readiness) and a `ZeptoclawAdapter implements FrameworkAdapter` (from `v2-types`, built on the VERIFIED commands in `docs/research/verified/zeptoclaw.md`) in the Electron main process, plus a `CapabilityOrchestrator` that runs the capability loop. Wire deploy/sendTask/stream over IPC into a minimal renderer task surface. zeptoclaw is proven first; hermes + openclaw adapters are follow-on plans reusing this exact interface and orchestrator.

**Tech Stack:** Electron 23, TypeScript 5.6, better-sqlite3, Vitest, zeptoclaw 0.9.2 (installed), Ollama (installed). Node 16 host/tests.

**Spec:** `docs/specs/2026-08-31-agentone-v2-design.md` (see §6 capability model incl. app-triggered+monitored restart, §10 spike findings, §12 post-spike decisions)

## Global Constraints

- Host `node` stays **v16.16.0**; tests run under Node 16 (Vitest), app runtime is Electron 23's Node 18. Do NOT `npm rebuild` or change host node.
- **Use the VERIFIED commands** from `docs/research/verified/zeptoclaw.md` (install, invoke/stream, config schema for model wiring, capability install). Do NOT invent commands — read that file.
- **Sandboxed installs (spike finding):** a framework's install/run must NOT modify host runtimes or the host `PATH` default. Spawn with an isolated, explicit environment; never let an installer hijack `~/.local/bin/node` (as hermes did).
- **App owns restart (spec §6):** when the adapter reports a restart is required to load a capability, the app triggers `stop()`→`start()` and MONITORS `status()` until healthy (bounded timeout) before resuming — never asks the user, never assumes it came back. zeptoclaw hot-reloads skills (no restart) per the spike — the loop must handle BOTH paths.
- Reuse v2 foundations — do NOT rewrite: `FrameworkAdapter`/`ModelBackend`/types in `src/shared/v2-types.ts`, `Database` (deployments/capabilities), `Secrets`, `createBackend`, `framework-registry`, the IPC/preload pattern, the Zustand store.
- Secrets never logged; local frameworks bind to loopback.
- Personas remain deferred.

---

## File Structure

```
src/main/frameworks/
├── process-manager.ts        # sandboxed spawn + stop + monitored readiness (Task 1)
├── zeptoclaw-adapter.ts      # ZeptoclawAdapter implements FrameworkAdapter (Tasks 2-4)
src/main/capability-orchestrator.ts   # the loop: run→detect gap→install→(monitored restart?)→resume (Task 5)
src/main/ipc-handlers.ts      # MODIFY: deploy/sendTask/stream/capability IPC (Task 6)
src/preload/index.ts          # MODIFY: expose new IPC (Task 6)
src/shared/types.ts           # MODIFY: ElectronAPI additions (Task 6)
src/renderer/pages/TaskPage.tsx        # minimal task/chat surface driving the framework (Task 7)
src/renderer/store.ts         # MODIFY: deployment + task state (Task 7)
tests/main/process-manager.test.ts     # Task 1
tests/main/zeptoclaw-adapter.test.ts   # Tasks 2-4
tests/main/capability-orchestrator.test.ts  # Task 5
docs/research/verified/zeptoclaw-e2e.md      # Task 8 real-run verification report
```

---

### Task 1: ProcessManager — sandboxed spawn + monitored readiness

**Files:** Create `src/main/frameworks/process-manager.ts`; Test `tests/main/process-manager.test.ts`

**Interfaces:**
- Produces: `class ProcessManager` with `start(cmd: string, args: string[], opts: { env?: Record<string,string>; cwd?: string }): void`, `stop(): Promise<void>` (SIGTERM then SIGKILL after a grace period), `isRunning(): boolean`, `waitUntilReady(check: () => Promise<boolean>, opts: { timeoutMs: number; intervalMs: number }): Promise<void>` (polls `check` until true or throws on timeout), and an injectable `spawnFn` (defaults to node `child_process.spawn`) so tests use a fake. Sandboxing: `start` builds the child env from `opts.env` explicitly (does NOT inherit a mutated PATH by default beyond what's passed) — document this.

- [ ] **Step 1: Write failing tests** in `tests/main/process-manager.test.ts` with a FAKE spawnFn returning a fake child (EventEmitter with `kill`, `pid`, `stdout`/`stderr` streams):
```typescript
import { describe, it, expect, vi } from "vitest";
import { ProcessManager } from "../../src/main/frameworks/process-manager";
import { EventEmitter } from "events";

function fakeChild() { const c: any = new EventEmitter(); c.pid = 1234; c.kill = vi.fn(() => c.emit("exit", 0)); c.stdout = new EventEmitter(); c.stderr = new EventEmitter(); return c; }

describe("ProcessManager", () => {
  it("starts a process via the injected spawnFn and reports running", () => {
    const child = fakeChild(); const spawnFn = vi.fn(() => child);
    const pm = new ProcessManager(spawnFn as any);
    pm.start("zeptoclaw", ["serve"], { env: { PATH: "/x" } });
    expect(spawnFn).toHaveBeenCalledWith("zeptoclaw", ["serve"], expect.objectContaining({ env: { PATH: "/x" } }));
    expect(pm.isRunning()).toBe(true);
  });
  it("waitUntilReady resolves once check returns true", async () => {
    const pm = new ProcessManager(vi.fn(() => fakeChild()) as any);
    pm.start("x", [], {});
    let n = 0; await expect(pm.waitUntilReady(async () => ++n >= 3, { timeoutMs: 1000, intervalMs: 1 })).resolves.toBeUndefined();
    expect(n).toBe(3);
  });
  it("waitUntilReady rejects on timeout", async () => {
    const pm = new ProcessManager(vi.fn(() => fakeChild()) as any);
    pm.start("x", [], {});
    await expect(pm.waitUntilReady(async () => false, { timeoutMs: 20, intervalMs: 5 })).rejects.toThrow(/timeout/i);
  });
  it("stop kills the child and reports not running", async () => {
    const child = fakeChild(); const pm = new ProcessManager(vi.fn(() => child) as any);
    pm.start("x", [], {}); await pm.stop();
    expect(child.kill).toHaveBeenCalled(); expect(pm.isRunning()).toBe(false);
  });
});
```
- [ ] **Step 2: Run** `npx vitest run tests/main/process-manager.test.ts` → FAIL.
- [ ] **Step 3: Implement** `ProcessManager` (injectable spawnFn default `require("child_process").spawn`; track child + running flag; `waitUntilReady` polls with setInterval/timeout; `stop` SIGTERM, then SIGKILL after grace, resolves on `exit`). Env is passed explicitly; add a doc comment that callers pass a sandboxed env (never rely on a mutated host PATH).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add src/main/frameworks/process-manager.ts tests/main/process-manager.test.ts && git commit -m "feat: ProcessManager with sandboxed spawn + monitored readiness"`

### Task 2: ZeptoclawAdapter — install + configure (model wiring)

**Files:** Create `src/main/frameworks/zeptoclaw-adapter.ts`; Test `tests/main/zeptoclaw-adapter.test.ts`

**Interfaces:**
- Consumes: `FrameworkAdapter`, `ModelBackendConfig` (v2-types); `ProcessManager` (Task 1); the VERIFIED zeptoclaw commands + config schema in `docs/research/verified/zeptoclaw.md`.
- Produces: `class ZeptoclawAdapter implements FrameworkAdapter` — this task delivers `install(): Promise<void>` (idempotent: no-op/verify if the verified doc shows it's already installed via brew) and `configure(backend: ModelBackendConfig): Promise<void>` (writes the zeptoclaw config — path + schema per the verified doc — pointing it at the given model backend; base URL/model/provider mapped from `ModelBackendConfig`). Accept an injectable config-dir path so tests write to a temp dir.

- [ ] **Step 1: READ** `docs/research/verified/zeptoclaw.md` for the exact config path, config schema, and install command. Use those verbatim.
- [ ] **Step 2: Write failing tests** (inject a temp config dir): `configure(backend)` writes a config file at the expected path whose contents point zeptoclaw at `backend`'s model + base URL (assert the JSON/TOML keys the verified doc specifies); `configure` is idempotent (re-running overwrites cleanly); `install` resolves without throwing when the binary is already present (inject a fake "which" check).
- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4: Implement** `install` + `configure` per the verified doc. Map `ModelBackendConfig.{kind,provider,baseUrl,model}` to zeptoclaw's provider config (for `kind:"ollama"`/custom → its OpenAI-compatible/base-url provider; for cloud → the named provider). Never write secrets to the config file — if a key is needed, reference it via env at start (Task 3), resolved from `Secrets`.
- [ ] **Step 5: Run** → PASS.
- [ ] **Step 6: Commit** `git add src/main/frameworks/zeptoclaw-adapter.ts tests/main/zeptoclaw-adapter.test.ts && git commit -m "feat: ZeptoclawAdapter install + configure (model wiring per verified spike)"`

### Task 3: ZeptoclawAdapter — start/stop/status/sendTask/streamOutput

**Files:** Modify `src/main/frameworks/zeptoclaw-adapter.ts`; extend `tests/main/zeptoclaw-adapter.test.ts`

**Interfaces:**
- Produces: `start()`/`stop()` (via ProcessManager, sandboxed env; inject any needed API key from `Secrets` into the child env, never the config file), `status(): Promise<string>` (health check — per verified doc: a ping/`--version`/endpoint), `sendTask(input): Promise<void>` + `streamOutput(cb): () => void` (spawn/stream the verified invoke command, e.g. `zeptoclaw agent --stream -m ...`, parse its SSE/token stream reusing the cross-chunk buffering pattern from `src/main/model-backends/openai-compatible.ts`, emit tokens to `cb`; return an unsubscribe).

- [ ] **Step 1: Write failing tests** with a fake ProcessManager/child: `start` spawns the verified command with a sandboxed env containing the resolved key; `status` returns healthy when the health check passes; `sendTask`+`streamOutput` parse a canned token stream and deliver tokens in order (include a token split across two chunks — assert none dropped); `stop` stops the process.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** using ProcessManager + the verified commands; reuse the buffered streaming parse. `status()` uses the verified health mechanism.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: ZeptoclawAdapter start/stop/status/sendTask/streamOutput (sandboxed, buffered stream)"`

### Task 4: ZeptoclawAdapter — capabilities (list/install + restart-required flag)

**Files:** Modify `src/main/frameworks/zeptoclaw-adapter.ts`; extend tests

**Interfaces:**
- Produces: `listCapabilities(): Promise<InstalledCapability[]>`, `installCapability(spec: {type,name}): Promise<void>` (run the verified install command — e.g. zeptoclaw `install_skill`/MCP add), and `requiresRestartAfterInstall(): boolean` (per spike: zeptoclaw skills hot-reload → returns `false`; keep it a method so other adapters can return true). `restart(): Promise<void>` = `stop()` then `start()`.

- [ ] **Step 1: Write failing tests** (fake process): `installCapability` invokes the verified install command with the right args; `listCapabilities` parses the verified listing; `requiresRestartAfterInstall()` returns `false` for zeptoclaw; `restart()` calls stop then start.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** per the verified doc.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: ZeptoclawAdapter capability install/list + restart-not-required flag"`

### Task 5: CapabilityOrchestrator — the loop (with app-triggered, monitored restart)

**Files:** Create `src/main/capability-orchestrator.ts`; Test `tests/main/capability-orchestrator.test.ts`

**Interfaces:**
- Consumes: a `FrameworkAdapter` (any impl) + `Database.recordCapability`.
- Produces: `class CapabilityOrchestrator` with `runTask(input, onToken, onStatus): Promise<string>` implementing: send task → stream tokens; on a detected capability gap (the adapter surfaces a gap via a callback/parsed signal — model it as an adapter method `onCapabilityGap` or a parsed sentinel the adapter exposes), the orchestrator: emits `onStatus("Setting up <name>")`, calls `installCapability`, records it, and — if `adapter.requiresRestartAfterInstall()` — triggers a **monitored restart** (`stop`→`start`→`waitUntilReady(adapter.status ...)` with a bounded timeout) before re-issuing the task; if no restart required, resumes immediately. On restart timeout/crash → throw a clear error (do not hang).

- [ ] **Step 1: Write failing tests** with a FAKE adapter (no real process) covering the state machine:
  - **no-restart path** (fake `requiresRestartAfterInstall()===false`): a task that reports one gap → orchestrator installs, records, resumes, returns final text; assert `restart` was NOT called and `onStatus("Setting up ...")` fired.
  - **restart-required path** (fake returns `true`): assert orchestrator calls `stop`→`start`, polls `status()` until healthy, THEN resumes; assert order via a call log.
  - **restart-timeout path**: fake `status()` never healthy → `runTask` rejects with a clear error; assert it does not hang (use fake timers).
  - **no-gap path**: task completes with no gap → no install/restart.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the orchestrator against the `FrameworkAdapter` interface + `waitUntilReady` semantics (reuse ProcessManager's readiness pattern or the adapter's `status`). Keep it framework-agnostic (works for any adapter, so hermes/openclaw reuse it).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add src/main/capability-orchestrator.ts tests/main/capability-orchestrator.test.ts && git commit -m "feat: CapabilityOrchestrator — gap→install→(monitored restart?)→resume loop"`

### Task 6: IPC wiring — deploy, sendTask, stream, capability/status events

**Files:** Modify `src/main/ipc-handlers.ts`, `src/preload/index.ts`, `src/shared/types.ts`; Test: extend an ipc/types test if present, else rely on build:main typecheck + the unit tests above.

**Interfaces:**
- Produces (ElectronAPI additions, matching the existing v1 handler pattern exactly): `deployFramework(frameworkId, modelBackendId): Promise<Deployment>` (constructs the ZeptoclawAdapter, `install`→`configure`(from the saved ModelBackend)→`start`→`waitUntilReady`; persists the deployment), `sendTask(deploymentId, input): Promise<string>` (drives the CapabilityOrchestrator), `onTaskToken(cb)` + `onTaskStatus(cb)` (streaming/status events), `getDeployments()`.

- [ ] **Step 1:** Add the channels to `src/shared/types.ts` `ElectronAPI` (exact names), the preload `invoke`/`on` wrappers, and `ipcMain.handle`/`webContents.send` in `ipc-handlers.ts`. Construct the adapter with a factory keyed on `frameworkId` (only `zeptoclaw` wired now; others throw "not yet supported" — a clear stub). Resolve the model backend via `Database.getModelBackend` + `createBackend`/config, and any key via `Secrets`.
- [ ] **Step 2:** Register `seedFrameworkRegistry`-created frameworks are present (already seeded at init). On `deployFramework`, create the deployment row (FK to the seeded framework).
- [ ] **Step 3: Verify** `npm run build:main` typechecks clean and `npx vitest run` still passes (unit tests unaffected). Channel names match across main/preload/type (grep to confirm).
- [ ] **Step 4: Commit** `git add -A && git commit -m "feat: IPC for deployFramework/sendTask/stream + zeptoclaw adapter factory"`

### Task 7: Renderer task surface — drive the framework, stream output

**Files:** Create `src/renderer/pages/TaskPage.tsx`; Modify `src/renderer/store.ts`, `src/renderer/App.tsx`; Test: `tests/renderer/task-flow.test.ts` (store-level)

**Interfaces:**
- Consumes: the new IPC (`deployFramework`, `sendTask`, `onTaskToken`, `onTaskStatus`), the store.
- Produces: onboarding "finish" now calls `deployFramework(selectedFrameworkId, modelBackendId)` (real deploy, replacing the Task-9 stub) → routes to `TaskPage`; `TaskPage` sends a task, streams tokens, and shows a "Setting up <capability>…" status line when `onTaskStatus` fires. Store: `currentDeploymentId`, `taskStreamText`, `taskStatus`, actions to set them; token/status subscriptions cleaned up on unmount (mirror the v1 use-llm cleanup discipline).

- [ ] **Step 1: Write failing store tests** (mock `window.electronAPI`): setting `currentDeploymentId`; appending `taskStreamText`; setting/clearing `taskStatus`. Run → FAIL.
- [ ] **Step 2: Implement** store additions; run → PASS.
- [ ] **Step 3:** Build `TaskPage` (input → sendTask; render streamed tokens; status banner) with subscription cleanup; wire onboarding finish → deployFramework → TaskPage; add the route to `App.tsx`. Remove the Task-9 stub comment.
- [ ] **Step 4: Verify** `npx tsc -p tsconfig.renderer.json --noEmit` clean + `npx vitest run` passes. (GUI not verifiable headless — note it.)
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: renderer task surface — real deploy + streamed task run with capability status"`

### Task 8: Real end-to-end verification (zeptoclaw + Ollama)

**Files:** Create `docs/research/verified/zeptoclaw-e2e.md` (verification report). No src changes (throwaway scripts under `spikes/` if needed).

**Interfaces:** Consumes the built adapter + orchestrator + Ollama (installed) + zeptoclaw (installed).

- [ ] **Step 1:** Using the real installed zeptoclaw + Ollama, exercise the built code paths (via a small harness or the app main process in dev) to: deploy zeptoclaw wired to Ollama, run a task that returns text (confirm streaming), then run a task that needs a skill zeptoclaw lacks → confirm the orchestrator detects the gap, installs the skill, resumes (no restart), and returns a correct result.
- [ ] **Step 2:** Confirm the host `node -v` is still v16.16.0 and `npx vitest run` still passes after the real run (sandboxing held).
- [ ] **Step 3:** Write `docs/research/verified/zeptoclaw-e2e.md`: what was run, evidence (commands + trimmed output), GO/NO-GO on the end-to-end capability loop, and any gaps to feed the hermes/openclaw adapter plans.
- [ ] **Step 4: Commit** `git add docs/research/verified/zeptoclaw-e2e.md && git commit -m "verify: zeptoclaw + Ollama end-to-end capability loop (Phase 2a)"`

---

## Follow-on (NOT in this plan)
- hermes adapter (sandboxed install — it hijacks host node PATH; must isolate), then openclaw adapter (config-migration wiring; it's the default and release-gated to actually work). Both reuse `FrameworkAdapter` + `CapabilityOrchestrator` unchanged.
- Advanced-local (llama.cpp/vLLM) + cloud model backends + API-key entry UI (`secrets.set`); remote (connect-only) deployments; capability management UI.

---

## Self-Review

**Spec coverage:** §4 FrameworkAdapter → Tasks 2-4; ModelBackend wiring → Task 2; §6 capability loop incl. app-triggered+monitored restart → Task 5 (both no-restart and restart-required+timeout paths tested); §8 security (sandboxed spawn, key via env not config, never logged) → Tasks 1-3; §10 sandbox finding → Tasks 1/3; §12.6 zeptoclaw-first → this whole plan; §12.7 no-universal-restart → Task 4 flag + Task 5 branches; §12.8 sandboxed installs → Task 1 env discipline. openclaw/hermes explicitly follow-on.

**Placeholder scan:** no TBD/TODO; exact framework commands are delegated to `docs/research/verified/zeptoclaw.md` (a committed, verified artifact) rather than invented — Tasks 2-4 instruct the implementer to read it. Test code is concrete for the testable units (ProcessManager, orchestrator state machine, adapter parsing); the real-process E2E is a documented verification task (can't be a pure unit test).

**Type/interface consistency:** `FrameworkAdapter` methods used by the orchestrator (Task 5) and IPC (Task 6) match the interface defined in `v2-types` (Phase 1 Task 4): install/configure/start/stop/status/sendTask/streamOutput/listCapabilities/installCapability/restart, plus the new `requiresRestartAfterInstall()` added in Task 4 (extend the `FrameworkAdapter` interface in v2-types when adding it, so all adapters/consumers agree). `Deployment`/`ModelBackendConfig`/`InstalledCapability` reused from v2-types unchanged.
