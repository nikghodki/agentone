# Phase 4 — Capability-Management UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A page that lists each deployment's installed capabilities (from the app's DB record) and lets the user remove them — performing a real per-framework CLI uninstall where the framework supports it, and otherwise deleting the app's record with a clear note.

**Architecture:** Add a `removeCapability` method to the `FrameworkAdapter` interface (symmetric with `installCapability`), implemented per framework using the VERIFIED uninstall CLIs (`docs/research/verified/capability-uninstall-commands.md`). A DB delete + two IPC handlers (`get-capabilities`, `remove-capability`) expose it; the remove handler calls the live adapter when the deployment is running, always deletes the DB record, and returns whether the framework itself was updated. A `CapabilitiesPage` renders the list (from the DB) grouped by type with a confirm-Remove action.

**Tech Stack:** Electron 23 / React 18 / TypeScript 5.6 / better-sqlite3 / Zustand / Vitest.

**Spec:** `docs/specs/2026-08-31-agentone-v2-design.md` (§6 capability model, §7 data model `installed_capabilities`, §11 Phase 4). Verified uninstall commands: `docs/research/verified/capability-uninstall-commands.md`.

## Global Constraints

- **Host Node v16.16.0** — never change host node/PATH; dev tooling runs under host node 16.
- **No invented commands** — adapter `removeCapability` uses ONLY the verified uninstall commands below; where a framework has no CLI uninstall, it does NOT shell out (no `rm -rf`, no config editing) and instead reports `frameworkRemoved:false` with a note.
- **Injection-safe** — every CLI call uses the adapter's existing `execWithArgsFn` arg-array pattern + `validateCapabilityName(name)` (both already present in all 3 adapters). Mirror each adapter's existing `installCapability` binary-resolution convention (hermes: `execWithArgsFn("hermes", …)`; openclaw: `getOpenclawBinary()` under the Node-22 sandbox; zeptoclaw: `execWithArgsFn("zeptoclaw", …)`).
- **No secrets in logs.**
- **Injectable deps for tests** — adapters inject `execWithArgs`; DB tests use a real sqlite file in tmpdir; renderer uses RTL + jsdom.

### Verified uninstall commands (source of truth — do NOT deviate)
| framework | skill | mcp | plugin |
|---|---|---|---|
| **hermes** | `hermes skills uninstall <name>` | `hermes mcp remove <name>` | `hermes plugins remove <name>` |
| **openclaw** | NOT supported (bundled; disable only) → `frameworkRemoved:false` | `openclaw mcp unset <name>` then `openclaw mcp reload` | `openclaw plugins uninstall <name>` |
| **zeptoclaw** | NOT supported (no CLI) → `frameworkRemoved:false` | NOT supported → `frameworkRemoved:false` | n/a → `frameworkRemoved:false` |

---

## Interfaces (shared across tasks — exact names/types)

```typescript
// FrameworkAdapter (src/shared/v2-types.ts) gains:
removeCapability(spec: { type: string; name: string }): Promise<{ frameworkRemoved: boolean; note?: string }>;

// Database (src/main/database.ts):
removeCapability(deploymentId: string, type: string, name: string): void;   // DELETE row

// IPC (src/main/ipc-handlers.ts) + preload + ElectronAPI:
getCapabilities(deploymentId: string): Promise<InstalledCapability[]>;
removeCapability(deploymentId: string, spec: { type: string; name: string }): Promise<{ frameworkRemoved: boolean; note?: string }>;
```

`InstalledCapability` (existing) = `{ deploymentId: string; type: "mcp"|"plugin"|"skill"; name: string; source: string }`.

**Standard "unsupported" note strings** (use verbatim):
- openclaw skill: `"OpenClaw skills are bundled and can only be disabled, not uninstalled via CLI — removed from AgentOne's list only."`
- zeptoclaw (any): `"ZeptoClaw does not support uninstalling capabilities via CLI — removed from AgentOne's list only."`
- deployment not running (IPC layer): `"Deployment is not running — removed from AgentOne's list only; the framework may still have it until redeploy."`

---

## Task 1: Interface `removeCapability` + `Database.removeCapability`

**Files:**
- Modify: `src/shared/v2-types.ts` (add method to `FrameworkAdapter`)
- Modify: `src/main/database.ts` (add `removeCapability`; `getCapabilities` already exists ~line 337)
- Test: `tests/main/database.test.ts` (extend)

**Interfaces:**
- Produces: the interface method signature (consumed by Task 2 adapters) + `db.removeCapability` (consumed by Task 3 IPC).

- [ ] **Step 1: Write the failing DB test** (append to `tests/main/database.test.ts`)

```typescript
it("removeCapability deletes only the matching capability row", () => {
  db.seedFrameworks([{ id: "hermes", name: "Hermes", features: ["a","b","c","d","e"], installRecipe: {} }]);
  const dep = db.createDeployment({ frameworkId: "hermes", location: "local", remoteUrl: null, modelBackendId: null });
  db.recordCapability({ deploymentId: dep.id, type: "skill", name: "web-search", source: "marketplace" });
  db.recordCapability({ deploymentId: dep.id, type: "mcp", name: "fs", source: "marketplace" });

  db.removeCapability(dep.id, "skill", "web-search");

  const remaining = db.getCapabilities(dep.id);
  expect(remaining).toHaveLength(1);
  expect(remaining[0]).toMatchObject({ type: "mcp", name: "fs" });
});

it("removeCapability is a no-op when the row does not exist", () => {
  db.seedFrameworks([{ id: "hermes", name: "Hermes", features: ["a","b","c","d","e"], installRecipe: {} }]);
  const dep = db.createDeployment({ frameworkId: "hermes", location: "local", remoteUrl: null, modelBackendId: null });
  expect(() => db.removeCapability(dep.id, "skill", "nope")).not.toThrow();
  expect(db.getCapabilities(dep.id)).toHaveLength(0);
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run tests/main/database.test.ts` — FAIL (`removeCapability` not a function).

- [ ] **Step 3: Add the interface method** in `src/shared/v2-types.ts` `FrameworkAdapter`, right after `installCapability(...)`:
```typescript
  removeCapability(spec: { type: string; name: string }): Promise<{ frameworkRemoved: boolean; note?: string }>;
```

- [ ] **Step 4: Implement `Database.removeCapability`** near `getCapabilities`:
```typescript
removeCapability(deploymentId: string, type: string, name: string): void {
  this.db
    .prepare("DELETE FROM installed_capabilities WHERE deployment_id = ? AND type = ? AND name = ?")
    .run(deploymentId, type, name);
}
```

- [ ] **Step 5: Run tests** — PASS. (Note: adding the interface method will make the 3 adapters fail typecheck until Task 2 — that is expected; `npm run build` will not be clean until Task 2. The vitest run for this task's DB test still passes since ts-transpile per-file doesn't require the adapters. If the suite typechecks globally and fails, proceed to Task 2 which resolves it — do NOT stub the adapters here.)

- [ ] **Step 6: Commit**

```bash
git add src/shared/v2-types.ts src/main/database.ts tests/main/database.test.ts
git commit -m "feat(phase4): FrameworkAdapter.removeCapability interface + Database.removeCapability"
```

---

## Task 2: `removeCapability` in all three adapters (batched)

**Files:**
- Modify: `src/main/frameworks/hermes-adapter.ts`, `src/main/frameworks/openclaw-adapter.ts`, `src/main/frameworks/zeptoclaw-adapter.ts`
- Test: `tests/main/hermes-adapter.test.ts`, `tests/main/openclaw-adapter.test.ts`, `tests/main/zeptoclaw-adapter.test.ts`

**Interfaces:**
- Consumes: the interface method (Task 1), each adapter's existing `execWithArgsFn` + `validateCapabilityName` + binary-resolution convention.
- Produces: `removeCapability` on all 3 adapters (consumed by Task 3 IPC).

This is one batched task (same method across 3 files). Implement each per the verified table, then add tests per adapter.

- [ ] **Step 1: Write the failing tests** (one block per adapter test file)

Hermes (`tests/main/hermes-adapter.test.ts`) — all supported:
```typescript
it("removeCapability uninstalls skill/mcp/plugin via the verified hermes CLIs", async () => {
  const exec = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
  const a = new HermesAdapter(undefined, undefined, exec);
  expect(await a.removeCapability({ type: "skill", name: "web-search" })).toEqual({ frameworkRemoved: true });
  expect(exec).toHaveBeenCalledWith("hermes", ["skills", "uninstall", "web-search"]);
  await a.removeCapability({ type: "mcp", name: "fs" });
  expect(exec).toHaveBeenCalledWith("hermes", ["mcp", "remove", "fs"]);
  await a.removeCapability({ type: "plugin", name: "p1" });
  expect(exec).toHaveBeenCalledWith("hermes", ["plugins", "remove", "p1"]);
});
it("removeCapability rejects an injection-y name", async () => {
  const a = new HermesAdapter(undefined, undefined, vi.fn());
  await expect(a.removeCapability({ type: "skill", name: "a; rm -rf /" })).rejects.toThrow();
});
```

OpenClaw (`tests/main/openclaw-adapter.test.ts`) — mcp/plugins supported, skills not:
```typescript
it("removeCapability: mcp unset+reload, plugins uninstall (verified); skills unsupported → frameworkRemoved false", async () => {
  const exec = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
  const a = new OpenclawAdapter(tempDir, undefined, exec);   // match this file's existing ctor arg order
  await a.removeCapability({ type: "mcp", name: "fs" });
  const argLists = exec.mock.calls.map((c: any[]) => c[1]);
  expect(argLists).toContainEqual(["mcp", "unset", "fs"]);
  expect(argLists).toContainEqual(["mcp", "reload"]);
  expect(await a.removeCapability({ type: "plugin", name: "p1" })).toEqual({ frameworkRemoved: true });
  const skill = await a.removeCapability({ type: "skill", name: "bundled-x" });
  expect(skill.frameworkRemoved).toBe(false);
  expect(skill.note).toMatch(/bundled/i);
});
```

ZeptoClaw (`tests/main/zeptoclaw-adapter.test.ts`) — none supported:
```typescript
it("removeCapability returns frameworkRemoved false with a note for every type (no CLI uninstall)", async () => {
  const exec = vi.fn();
  const a = new ZeptoclawAdapter(undefined, undefined, exec);   // match this file's existing ctor arg order
  for (const type of ["skill", "mcp", "plugin"] as const) {
    const r = await a.removeCapability({ type, name: "x" });
    expect(r.frameworkRemoved).toBe(false);
    expect(r.note).toMatch(/does not support/i);
  }
  expect(exec).not.toHaveBeenCalled();   // never shells out
});
```

- [ ] **Step 2: Run to verify fail** — the three adapter test files FAIL (method missing).

- [ ] **Step 3: Implement Hermes `removeCapability`** (mirror its `installCapability` — `execWithArgsFn("hermes", …)`, `validateCapabilityName` first):
```typescript
async removeCapability(spec: { type: string; name: string }): Promise<{ frameworkRemoved: boolean; note?: string }> {
  this.validateCapabilityName(spec.name);
  if (spec.type === "skill")  { await this.execWithArgsFn("hermes", ["skills", "uninstall", spec.name]); return { frameworkRemoved: true }; }
  if (spec.type === "mcp")    { await this.execWithArgsFn("hermes", ["mcp", "remove", spec.name]);       return { frameworkRemoved: true }; }
  if (spec.type === "plugin") { await this.execWithArgsFn("hermes", ["plugins", "remove", spec.name]);   return { frameworkRemoved: true }; }
  throw new Error(`Unsupported capability type: ${spec.type}`);
}
```

- [ ] **Step 4: Implement OpenClaw `removeCapability`** (use `getOpenclawBinary()` + the Node-22 sandboxed env exactly as its `installCapability` does):
```typescript
async removeCapability(spec: { type: string; name: string }): Promise<{ frameworkRemoved: boolean; note?: string }> {
  this.validateCapabilityName(spec.name);
  const bin = this.getOpenclawBinary();
  if (spec.type === "mcp") {
    await this.execWithArgsFn(bin, ["mcp", "unset", spec.name]);
    await this.execWithArgsFn(bin, ["mcp", "reload"]);   // hot-reload (verified)
    return { frameworkRemoved: true };
  }
  if (spec.type === "plugin") { await this.execWithArgsFn(bin, ["plugins", "uninstall", spec.name]); return { frameworkRemoved: true }; }
  if (spec.type === "skill")  { return { frameworkRemoved: false, note: "OpenClaw skills are bundled and can only be disabled, not uninstalled via CLI — removed from AgentOne's list only." }; }
  throw new Error(`Unsupported capability type: ${spec.type}`);
}
```
(If openclaw's `installCapability` passes the sandboxed `env` via a third `execWithArgsFn` arg, pass it here identically. Match the existing call shape in this file.)

- [ ] **Step 5: Implement ZeptoClaw `removeCapability`** (no CLI uninstall for any type — never shell out):
```typescript
async removeCapability(spec: { type: string; name: string }): Promise<{ frameworkRemoved: boolean; note?: string }> {
  this.validateCapabilityName(spec.name);
  return { frameworkRemoved: false, note: "ZeptoClaw does not support uninstalling capabilities via CLI — removed from AgentOne's list only." };
}
```

- [ ] **Step 6: Run tests** — `npx vitest run tests/main/hermes-adapter.test.ts tests/main/openclaw-adapter.test.ts tests/main/zeptoclaw-adapter.test.ts` — PASS; then FULL suite `npx vitest run` (was 269 + new) and `npm run build` (now clean — all adapters implement the interface). Record node -v.

- [ ] **Step 7: Commit**

```bash
git add src/main/frameworks/ tests/main/hermes-adapter.test.ts tests/main/openclaw-adapter.test.ts tests/main/zeptoclaw-adapter.test.ts
git commit -m "feat(phase4): removeCapability in hermes/openclaw/zeptoclaw adapters (verified uninstall CLIs)"
```

---

## Task 3: IPC `get-capabilities` + `remove-capability`

**Files:**
- Modify: `src/main/ipc-handlers.ts` (add 2 handlers; `deploymentRegistry` ~line 28 maps deploymentId → {adapter, orchestrator})
- Modify: `src/preload/index.ts`, `src/shared/types.ts` (ElectronAPI)
- Test: `tests/main/capabilities-ipc.test.ts` (new) — extract the handler bodies as exported functions for testability (mirror the exported `createAdapter`/`handleSaveModelBackend` convention).

**Interfaces:**
- Consumes: `db.getCapabilities`, `db.removeCapability` (Task 1), adapter `removeCapability` (Task 2), `deploymentRegistry`.
- Produces: `getCapabilities` + `removeCapability` on ElectronAPI (consumed by Task 4 UI).

- [ ] **Step 1: Write the failing test** (`tests/main/capabilities-ipc.test.ts`)

Extract and test an exported `handleRemoveCapability(deploymentId, spec, deps)` where `deps = { db, getAdapter }` (`getAdapter(id)` returns the live adapter or undefined):

```typescript
import { handleRemoveCapability } from "../../src/main/ipc-handlers";

it("running deployment: calls adapter.removeCapability AND deletes the DB row", async () => {
  const adapter = { removeCapability: vi.fn().mockResolvedValue({ frameworkRemoved: true }) };
  const db = { removeCapability: vi.fn() };
  const res = await handleRemoveCapability("dep1", { type: "skill", name: "web-search" },
    { db: db as any, getAdapter: () => adapter as any });
  expect(adapter.removeCapability).toHaveBeenCalledWith({ type: "skill", name: "web-search" });
  expect(db.removeCapability).toHaveBeenCalledWith("dep1", "skill", "web-search");
  expect(res).toEqual({ frameworkRemoved: true });
});

it("not-running deployment: skips adapter, still deletes DB row, returns forget note", async () => {
  const db = { removeCapability: vi.fn() };
  const res = await handleRemoveCapability("dep1", { type: "skill", name: "x" },
    { db: db as any, getAdapter: () => undefined });
  expect(db.removeCapability).toHaveBeenCalledWith("dep1", "skill", "x");
  expect(res.frameworkRemoved).toBe(false);
  expect(res.note).toMatch(/not running/i);
});

it("adapter reports frameworkRemoved false (unsupported): DB row still deleted, note passed through", async () => {
  const adapter = { removeCapability: vi.fn().mockResolvedValue({ frameworkRemoved: false, note: "bundled" }) };
  const db = { removeCapability: vi.fn() };
  const res = await handleRemoveCapability("dep1", { type: "skill", name: "x" },
    { db: db as any, getAdapter: () => adapter as any });
  expect(db.removeCapability).toHaveBeenCalled();
  expect(res).toEqual({ frameworkRemoved: false, note: "bundled" });
});
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement** exported `handleRemoveCapability(deploymentId, spec, deps)`:
  - `const adapter = deps.getAdapter(deploymentId);`
  - if adapter: `result = await adapter.removeCapability(spec)`; else `result = { frameworkRemoved: false, note: "Deployment is not running — removed from AgentOne's list only; the framework may still have it until redeploy." }`.
  - always `deps.db.removeCapability(deploymentId, spec.type, spec.name);`
  - return `result`.
  Register `ipcMain.handle("remove-capability", (_e, deploymentId, spec) => handleRemoveCapability(deploymentId, spec, { db, getAdapter: (id) => deploymentRegistry.get(id)?.adapter }))` and `ipcMain.handle("get-capabilities", (_e, deploymentId) => db.getCapabilities(deploymentId))`.

- [ ] **Step 4: Preload + ElectronAPI** — add `getCapabilities(deploymentId)` and `removeCapability(deploymentId, spec)` to `src/preload/index.ts` (ipcRenderer.invoke) and `src/shared/types.ts` with the signatures from the Interfaces section.

- [ ] **Step 5: Run tests + build** — `npx vitest run` green; `npm run build` clean. Record node -v.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc-handlers.ts src/preload/index.ts src/shared/types.ts tests/main/capabilities-ipc.test.ts
git commit -m "feat(phase4): get-capabilities + remove-capability IPC (adapter uninstall when running, always forget DB row)"
```

---

## Task 4: `CapabilitiesPage` + navigation

**Files:**
- Create: `src/renderer/pages/CapabilitiesPage.tsx`
- Modify: `src/renderer/App.tsx` (route the new view), `src/renderer/store.ts` (view union + a way to reach it), a link from `SettingsPage.tsx` (or DashboardPage)
- Test: `tests/renderer/capabilities-page.test.tsx` (RTL; add `// @vitest-environment jsdom` if the project defaults to node)

**Interfaces:**
- Consumes: `window.electronAPI.getCapabilities` + `removeCapability` (Task 3), `store.currentDeploymentId`.

- [ ] **Step 1: Write the failing RTL test** (`tests/renderer/capabilities-page.test.tsx`)

```typescript
// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
// mock window.electronAPI: getCapabilities -> [{deploymentId:"d1",type:"skill",name:"web-search",source:"marketplace"}],
//                          removeCapability -> {frameworkRemoved:true}
it("lists capabilities and removes one on confirm", async () => {
  // render <CapabilitiesPage/> with store.currentDeploymentId = "d1"
  expect(await screen.findByText("web-search")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /remove/i }));
  // confirm if a confirm step exists
  await waitFor(() => expect(window.electronAPI.removeCapability).toHaveBeenCalledWith("d1", { type: "skill", name: "web-search" }));
});

it("shows the note when the framework could not uninstall", async () => {
  // removeCapability -> {frameworkRemoved:false, note:"...only"}; after remove, the note text is shown
});
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement `CapabilitiesPage`** — on mount, `getCapabilities(currentDeploymentId)`; render grouped by type (Skills / MCP Servers / Plugins); each row shows name + source + a Remove button; Remove → confirm → `removeCapability(deploymentId, {type,name})` → on resolve, if `frameworkRemoved === false` show the returned `note`, then refetch the list. Empty state: "No capabilities installed yet." Loading + error states.

- [ ] **Step 4: Wire navigation** — add `"capabilities"` to the store view union (or however views are typed), render `<CapabilitiesPage/>` for it in `App.tsx`, and add a "Manage capabilities" link/button in `SettingsPage.tsx` (or Dashboard) that `setView("capabilities")`. Follow the existing routing/store pattern used by the other pages.

- [ ] **Step 5: Run tests + build** — `npx vitest run tests/renderer/` + full `npx vitest run` green; `npm run build` clean. Record node -v.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/pages/CapabilitiesPage.tsx src/renderer/App.tsx src/renderer/store.ts src/renderer/pages/SettingsPage.tsx tests/renderer/capabilities-page.test.tsx
git commit -m "feat(phase4): CapabilitiesPage — list + remove installed capabilities per deployment"
```

---

## Task 5: Full-suite verification + spec Phase-4 status

**Files:**
- Modify: `docs/specs/2026-08-31-agentone-v2-design.md` (§11 Phase 4 — note capability-management UI delivered; remote deployments + polish still pending)

- [ ] **Step 1:** `npx vitest run` (all green) + `npm run build` (clean); host `node -v` = v16.16.0.
- [ ] **Step 2:** Update spec §11 Phase 4 to record the capability-management UI as delivered (remove = real CLI uninstall for hermes + openclaw mcp/plugins; app-forget for zeptoclaw & openclaw skills per verified command availability), with remote deployments + polish still pending.
- [ ] **Step 3: Commit**

```bash
git add docs/specs/2026-08-31-agentone-v2-design.md
git commit -m "docs(phase4): capability-management UI delivered; remote deployments + polish pending"
```

---

## Notes / Deferrals (explicit)
- **Real uninstall is limited by framework support** (verified): hermes = all types; openclaw = mcp + plugins (skills bundled/disable-only); zeptoclaw = none via CLI. Where unsupported, remove deletes the app's DB record and returns a note — no `rm -rf` / config editing (per approved decision).
- **Removing while a deployment isn't running** deletes the DB record only (the framework keeps the capability until redeploy); the UI surfaces this via the returned note.
- **Manual add from the UI is out of scope** (the app auto-provisions on demand); this page is view + remove only.
