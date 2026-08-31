# AgentOne v2 — Phase 0 (Interface Spike) + Phase 1 Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De-risk the three agent frameworks by verifying their real interfaces (spike), and build the framework-agnostic foundations (DB schema, adapter/backend interfaces, model-backend layer, secrets, framework registry, onboarding wizard) that don't depend on spike results.

**Architecture:** Extend the shipped AgentOne Electron + React + TypeScript app. Add a `FrameworkAdapter` seam and an orthogonal `ModelBackend` provider layer in the main process, plus a framework-selection → model-backend onboarding wizard in the renderer. Phase 0 is investigation whose deliverable is *verified findings* (committed docs) + throwaway proof-of-concept scripts; Phase 1 tasks here are the concrete, spike-independent scaffolding. The openclaw adapter body and the capability gap→install→restart→resume orchestrator are intentionally NOT in this plan — they are written as a follow-on plan once the spike verifies the exact commands.

**Tech Stack:** Electron 23 (env-pinned, see constraints), React 18, TypeScript 5.6, better-sqlite3, Zustand, Vitest. Frameworks under study: openclaw (Node), zeptoclaw (Rust), hermes (Python).

**Spec:** `docs/specs/2026-08-31-agentone-v2-design.md`

## Global Constraints

- **Environment runtime reality:** this dev machine has **Node v16.16.0 only** (v1 ruling R7). openclaw requires **Node 22+**; zeptoclaw needs Rust; hermes needs Python 3.11+. The spike (Phase 0) must FIRST establish whether each framework can be installed/run in the target environment at all — do not assume it can.
- Automated tests run under Node 16 via Vitest; app runtime is Electron 23's bundled Node 18. Don't use APIs absent from both unless guarded.
- TypeScript strict mode; renderer reaches main only via the `contextBridge` preload API (`contextIsolation: true`, `nodeIntegration: false`).
- All user data stays local in SQLite (extend the v1 DB); cloud/endpoint API keys stored via Electron `safeStorage`, never in the DB (store only a `secret_ref`) and never logged.
- Reuse v1 modules — do not rewrite: `src/main/database.ts`, `src/main/hardware-detector.ts`, `src/main/ollama-manager.ts`, the IPC/preload pattern, the Zustand store + routing.
- Personas are deferred: do not surface the v1 persona/guided-task flow in v2 onboarding (leave the code in place).
- Spike tasks produce a committed findings doc under `docs/research/verified/`; any proof-of-concept code is thrown away (or clearly quarantined under `spikes/`), never merged into `src/`.
- Frameworks: openclaw (default), zeptoclaw, hermes. Model backends: Ollama (managed local), llama.cpp/vLLM (advanced local), custom endpoint (`v1/messages` | `v1/chat/completions`), cloud (Anthropic/OpenAI/OpenRouter/Azure/Bedrock).

---

## File Structure

```
src/
├── main/
│   ├── database.ts                 # MODIFY: extend schema + CRUD (Task 4)
│   ├── model-backends/
│   │   ├── types.ts                # ModelBackend interface (Task 6 consumes shared types)
│   │   ├── openai-compatible.ts    # v1/chat/completions backend (Task 6)
│   │   ├── anthropic-messages.ts   # v1/messages backend (Task 7)
│   │   └── index.ts                # backend factory (Task 7)
│   ├── secrets.ts                  # safeStorage wrapper (Task 5)
│   └── framework-registry.ts       # framework metadata + seeding (Task 8)
├── shared/
│   └── v2-types.ts                 # FrameworkAdapter, ModelBackend, FrameworkMeta, Deployment types (Task 4)
├── renderer/
│   ├── pages/
│   │   ├── FrameworkSelectPage.tsx # onboarding step 1 (Task 9)
│   │   └── ModelBackendPage.tsx    # onboarding step 2 (Task 9)
│   └── store.ts                    # MODIFY: v2 onboarding state (Task 9)
docs/research/verified/
├── openclaw.md                     # Task 1-3 spike output
├── zeptoclaw.md                    # Task 1 availability check
└── hermes-agent.md                 # Task 1 availability check
spikes/                             # throwaway PoC (Tasks 2-3), git-ignored
tests/main/
├── database-v2.test.ts             # Task 4
├── model-backends.test.ts          # Tasks 6-7
├── secrets.test.ts                 # Task 5
└── framework-registry.test.ts      # Task 8
tests/renderer/
└── onboarding-v2.test.ts           # Task 9
```

---

## PHASE 0 — Interface Spike (investigation; deliverable = verified findings)

> These tasks are NOT TDD. Their deliverable is verified knowledge committed as a findings doc, plus optional throwaway PoC under `spikes/`. Each ends with a committed doc a reviewer can check against reality.

### Task 1: Runtime & install feasibility for all three frameworks

**Files:**
- Create: `docs/research/verified/openclaw.md`, `docs/research/verified/zeptoclaw.md`, `docs/research/verified/hermes-agent.md`
- Create: `.gitignore` entry `spikes/`

**Interfaces:**
- Consumes: the unverified research in `docs/research/{openclaw,zeptoclaw,hermes-agent}.md`
- Produces: a verified per-framework findings doc answering: required runtime + version, exact install command, whether install SUCCEEDS in the target env (or what runtime must be provisioned), and the framework's own version/help output.

- [ ] **Step 1:** Add `spikes/` to `.gitignore`; create `docs/research/verified/`.
- [ ] **Step 2:** For openclaw: attempt the documented install (`npm i -g openclaw@latest` — note it needs Node 22+; record whether the env's Node 16 blocks it and what a working setup requires). Capture `openclaw --version` / `--help` verbatim.
- [ ] **Step 3:** For zeptoclaw: attempt the documented install (curl/brew/cargo). Capture `zeptoclaw --version` / `--help`.
- [ ] **Step 4:** For hermes: attempt the documented install (curl `install.sh`). Capture `hermes --version` / `--help`.
- [ ] **Step 5:** Write each `verified/*.md` with: runtime+version required, exact working install command, install SUCCESS/BLOCKED (+ why), and the real `--help` output. Mark every claim VERIFIED or STILL-UNVERIFIED.
- [ ] **Step 6:** Commit: `git add docs/research/verified .gitignore && git commit -m "spike: verified runtime/install feasibility for openclaw/zeptoclaw/hermes"`

**Deliverable gate:** three findings docs, each stating install SUCCESS/BLOCKED with evidence. If openclaw install is BLOCKED by the environment, that is a valid, important finding — report it; do not fake success.

### Task 2: openclaw invoke + stream + config verification

**Files:**
- Modify: `docs/research/verified/openclaw.md`
- Create (throwaway): `spikes/openclaw-invoke.mjs`

**Interfaces:**
- Consumes: Task 1 (openclaw installed, or a provisioned Node-22 environment)
- Produces: verified answers to — (a) exact command/endpoint to send a task and stream output; (b) the config file path + schema for setting the model provider; (c) how to point openclaw at a local Ollama and at a cloud provider; (d) the exact commands to add an MCP server / plugin.

- [ ] **Step 1:** Configure openclaw against a known model backend (start with Ollama if available locally, else a cloud key you set as an env var). Record the exact `~/.openclaw/openclaw.json` edits that work.
- [ ] **Step 2:** Send a one-shot task and capture the streaming mechanism (CLI stdout? WebSocket frames?) in `spikes/openclaw-invoke.mjs` — a minimal script that spawns/streams. Record the real stream format.
- [ ] **Step 3:** Run `openclaw mcp add ...` (and/or plugin install) for one MCP server; record the exact command, where it writes config, and whether a restart is required before the tool is usable.
- [ ] **Step 4:** Update `verified/openclaw.md` with VERIFIED invoke/stream, config schema, model-wiring, and capability-install commands (verbatim).
- [ ] **Step 5:** Commit: `git add docs/research/verified/openclaw.md && git commit -m "spike: verified openclaw invoke/stream/config/capability commands"`

**Deliverable gate:** reviewer can read `verified/openclaw.md` and know the exact commands the future adapter will run.

### Task 3: Capability loop proof-of-concept on openclaw (gap → install → restart → resume)

**Files:**
- Modify: `docs/research/verified/openclaw.md`
- Create (throwaway): `spikes/openclaw-capability-loop.mjs`

**Interfaces:**
- Consumes: Task 2 (verified invoke + capability-install commands)
- Produces: a go/no-go on the app-orchestrated capability loop for openclaw: can the app detect a capability gap, install the capability, restart the framework, and resume the task with context preserved?

- [ ] **Step 1:** Give openclaw a task that requires an MCP server it does NOT have; capture how the gap surfaces (error text? tool-not-found? agent asks?). Record the exact signal.
- [ ] **Step 2:** In `spikes/openclaw-capability-loop.mjs`, script: detect-gap → run the install command from Task 2 → restart openclaw → re-issue the task; confirm it now succeeds.
- [ ] **Step 3:** Record whether task/conversation context survives the restart, and how you re-established it.
- [ ] **Step 4:** Update `verified/openclaw.md` with a GO/NO-GO verdict on the loop + the concrete detect/install/restart/resume recipe (or the blocker if NO-GO).
- [ ] **Step 5:** Commit: `git add docs/research/verified/openclaw.md && git commit -m "spike: openclaw capability loop PoC + go/no-go"`

**Deliverable gate:** an explicit GO/NO-GO. NO-GO here reshapes the follow-on plan (e.g. pre-bundle-only for openclaw) — that's the point of the spike.

---

## PHASE 1 — Foundations (spike-independent; full TDD)

### Task 4: Define v2 shared types + extend SQLite schema + CRUD

**Files:**
- Create: `src/shared/v2-types.ts`
- Modify: `src/main/database.ts`
- Test: `tests/main/database-v2.test.ts`

**Interfaces:**
- Consumes: v1 `Database` class (`src/main/database.ts`)
- Produces: `src/shared/v2-types.ts` defining the shared types used across Tasks 4–9, AND `Database` methods `seedFrameworks(list: FrameworkMeta[]): void`, `getFrameworks(): FrameworkMeta[]`, `createDeployment(d: NewDeployment): Deployment`, `getDeployments(): Deployment[]`, `saveModelBackend(b: ModelBackendConfig): void`, `getModelBackend(id: string): ModelBackendConfig | null`, `recordCapability(c: InstalledCapability): void`, `getCapabilities(deploymentId: string): InstalledCapability[]`.

- [ ] **Step 1: Create `src/shared/v2-types.ts`** with the shared types (single source of truth for Tasks 4–9):
```typescript
export interface FrameworkMeta {
  id: "openclaw" | "zeptoclaw" | "hermes";
  name: string;
  features: string[];              // top-5 for onboarding cards
  installRecipe: Record<string, unknown>;
  isDefault?: boolean;
}
export interface NewDeployment {
  frameworkId: string;
  location: "local" | "remote";
  remoteUrl: string | null;
  modelBackendId: string | null;
}
export interface Deployment extends NewDeployment {
  id: string; status: string; createdAt: string;
}
export type ModelBackendKind = "ollama" | "llamacpp" | "vllm" | "custom" | "cloud";
export type ModelProtocol = "v1/messages" | "v1/chat/completions";
export interface ModelBackendConfig {
  id: string; kind: ModelBackendKind; provider: string | null;
  baseUrl: string | null; protocol: ModelProtocol; model: string;
  secretRef: string | null;        // -> keychain ref, never the raw key
}
export interface InstalledCapability {
  deploymentId: string; type: "mcp" | "plugin" | "skill"; name: string; source: string;
}
export interface ChatMessage { role: "system" | "user" | "assistant"; content: string; }
// Interfaces implemented in later tasks:
export interface ModelBackend { chat(messages: ChatMessage[], onToken: (t: string) => void): Promise<string>; }
export interface FrameworkAdapter {
  install(): Promise<void>;
  configure(backend: ModelBackendConfig): Promise<void>;
  start(): Promise<void>; stop(): Promise<void>; status(): Promise<string>;
  sendTask(input: string): Promise<void>;
  streamOutput(cb: (chunk: string) => void): () => void;
  listCapabilities(): Promise<InstalledCapability[]>;
  installCapability(spec: { type: string; name: string }): Promise<void>;
  restart(): Promise<void>;
}
```
- [ ] **Step 2: Write failing tests** in `tests/main/database-v2.test.ts` (use a temp DB like the v1 `database.test.ts`):
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Database } from "../../src/main/database";
import fs from "fs"; import path from "path"; import os from "os";

describe("Database v2 entities", () => {
  let db: Database; let p: string;
  beforeEach(() => { p = path.join(os.tmpdir(), `a1-v2-${Date.now()}.db`); db = new Database(p); db.initialize(); });
  afterEach(() => { db.close(); if (fs.existsSync(p)) fs.unlinkSync(p); });

  it("seeds and reads frameworks", () => {
    db.seedFrameworks([{ id: "openclaw", name: "OpenClaw", features: ["a","b","c","d","e"], installRecipe: {} }]);
    const f = db.getFrameworks();
    expect(f).toHaveLength(1); expect(f[0].id).toBe("openclaw"); expect(f[0].features).toHaveLength(5);
  });
  it("creates and lists deployments", () => {
    db.seedFrameworks([{ id: "openclaw", name: "OpenClaw", features: [], installRecipe: {} }]);
    const d = db.createDeployment({ frameworkId: "openclaw", location: "local", remoteUrl: null, modelBackendId: null });
    expect(d.id).toBeDefined(); expect(db.getDeployments()[0].frameworkId).toBe("openclaw");
  });
  it("saves and reads a model backend without the raw secret", () => {
    db.saveModelBackend({ id: "b1", kind: "cloud", provider: "anthropic", baseUrl: null, protocol: "v1/messages", model: "claude-sonnet-5", secretRef: "kc:anthropic" });
    expect(db.getModelBackend("b1")?.secretRef).toBe("kc:anthropic");
  });
  it("records and lists capabilities", () => {
    db.seedFrameworks([{ id: "openclaw", name: "OpenClaw", features: [], installRecipe: {} }]);
    const d = db.createDeployment({ frameworkId: "openclaw", location: "local", remoteUrl: null, modelBackendId: null });
    db.recordCapability({ deploymentId: d.id, type: "mcp", name: "web-search", source: "clawhub" });
    expect(db.getCapabilities(d.id)[0].name).toBe("web-search");
  });
});
```
- [ ] **Step 3: Run** `npx vitest run tests/main/database-v2.test.ts` → expect FAIL (methods undefined).
- [ ] **Step 4: Implement** the four tables from spec §7 in `initialize()` (add to the existing `exec` block) and the CRUD methods on `Database`, mirroring v1 patterns (prepared statements, JSON columns for `features`/`installRecipe`, `randomUUID()` ids). Store `features` as JSON text; parse on read (guard with try/catch like v1 `getProfile`).
- [ ] **Step 5: Run** the test → expect PASS.
- [ ] **Step 6: Commit** `git add src/shared/v2-types.ts src/main/database.ts tests/main/database-v2.test.ts && git commit -m "feat: v2 shared types + extend SQLite schema (frameworks, deployments, model_backends, capabilities)"`

### Task 5: Secrets wrapper over Electron safeStorage

**Files:**
- Create: `src/main/secrets.ts`
- Test: `tests/main/secrets.test.ts`

**Interfaces:**
- Produces: `class Secrets { set(ref: string, value: string): void; get(ref: string): string | null; delete(ref: string): void }` backed by `safeStorage` encryption, persisting ciphertext to a file under userData. In tests, inject a fake encryptor so no Electron runtime is needed.

- [ ] **Step 1: Write failing tests** in `tests/main/secrets.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { Secrets } from "../../src/main/secrets";
// Fake encryptor: reversible, no Electron needed
const fakeEnc = { isEncryptionAvailable: () => true,
  encryptString: (s: string) => Buffer.from(s, "utf8"),
  decryptString: (b: Buffer) => b.toString("utf8") };

describe("Secrets", () => {
  it("stores and retrieves a secret by ref", () => {
    const s = new Secrets(":memory:", fakeEnc as any);
    s.set("kc:anthropic", "sk-abc"); expect(s.get("kc:anthropic")).toBe("sk-abc");
  });
  it("returns null for unknown ref", () => {
    const s = new Secrets(":memory:", fakeEnc as any);
    expect(s.get("nope")).toBeNull();
  });
  it("deletes a secret", () => {
    const s = new Secrets(":memory:", fakeEnc as any);
    s.set("k","v"); s.delete("k"); expect(s.get("k")).toBeNull();
  });
});
```
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `Secrets` taking a store path and an injectable encryptor (defaulting to Electron's `safeStorage` in production). Use an in-memory Map when path is `:memory:`, else a JSON file of `{ref: base64(ciphertext)}`. Never log values.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add src/main/secrets.ts tests/main/secrets.test.ts && git commit -m "feat: add safeStorage-backed Secrets wrapper (injectable encryptor for tests)"`

### Task 6: ModelBackend interface + OpenAI-compatible backend

**Files:**
- Create: `src/main/model-backends/types.ts`, `src/main/model-backends/openai-compatible.ts`
- Test: `tests/main/model-backends.test.ts`

**Interfaces:**
- Consumes: `ModelBackend`, `ModelBackendConfig`, `ChatMessage` from `v2-types.ts` (Task 4)
- Produces: `class OpenAICompatibleBackend implements ModelBackend` hitting `POST {baseUrl}/v1/chat/completions` with SSE streaming (`data: {json}` lines, `[DONE]` sentinel), accumulating `choices[0].delta.content`. Covers Ollama, llama.cpp, vLLM, OpenAI, OpenRouter, Azure (base URL varies).

- [ ] **Step 1: Write failing tests** using a fake `fetch` returning a canned SSE `ReadableStream`; assert tokens are accumulated and `onToken` called per delta. (Mirror the buffered-line parsing from v1 `ollama-manager` — test a JSON object split across two chunks is NOT dropped.)
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** with cross-chunk line buffering (reuse the v1 pattern: keep a `buffer`, `split("\n")`, retain the trailing partial line, flush after the loop), parsing OpenAI SSE, ignoring `[DONE]`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add src/main/model-backends/types.ts src/main/model-backends/openai-compatible.ts tests/main/model-backends.test.ts && git commit -m "feat: ModelBackend interface + OpenAI-compatible streaming backend"`

### Task 7: Anthropic v1/messages backend + backend factory

**Files:**
- Create: `src/main/model-backends/anthropic-messages.ts`, `src/main/model-backends/index.ts`
- Test: extend `tests/main/model-backends.test.ts`

**Interfaces:**
- Consumes: `ModelBackend` (Task 6), `ModelBackendConfig`, `Secrets` (Task 5)
- Produces: `class AnthropicMessagesBackend implements ModelBackend` hitting `POST {baseUrl}/v1/messages` with Anthropic SSE (`content_block_delta` → `delta.text`); and `createBackend(cfg: ModelBackendConfig, secrets: Secrets): ModelBackend` selecting by `cfg.protocol` (`v1/chat/completions` → OpenAICompatible, `v1/messages` → AnthropicMessages) and resolving the key via `secrets.get(cfg.secretRef)`.

- [ ] **Step 1: Write failing tests**: fake-fetch Anthropic SSE stream → assert text accumulation; and `createBackend` returns the right class per protocol and injects the resolved key into the Authorization/`x-api-key` header.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the Anthropic backend (same buffered-line SSE parsing, parse `event: content_block_delta`/`data:` frames) and the factory.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add src/main/model-backends/ tests/main/model-backends.test.ts && git commit -m "feat: Anthropic v1/messages backend + protocol-selecting backend factory"`

### Task 8: Framework registry + metadata seeding

**Files:**
- Create: `src/main/framework-registry.ts`
- Test: `tests/main/framework-registry.test.ts`

**Interfaces:**
- Consumes: `FrameworkMeta` (Task 4), `Database.seedFrameworks/getFrameworks` (Task 4)
- Produces: `FRAMEWORKS: FrameworkMeta[]` (openclaw/zeptoclaw/hermes, each with a **verified** top-5 features list sourced from `docs/research/verified/*.md` — use the Phase-0 output, not the unverified research), and `seedFrameworkRegistry(db: Database): void`.

- [ ] **Step 1: Write failing tests**: `FRAMEWORKS` has exactly 3 entries with ids `openclaw`/`zeptoclaw`/`hermes`; each has a non-empty `name` and exactly 5 `features`; openclaw is marked default; `seedFrameworkRegistry` populates the DB so `getFrameworks()` returns 3.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the constant + seeding. (Feature copy: pull the top-5 from the verified docs produced in Phase 0; if a framework wasn't fully verified, use its research-doc features and mark `verified: false` in a comment.)
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git add src/main/framework-registry.ts tests/main/framework-registry.test.ts && git commit -m "feat: framework registry with 3 frameworks and seeding"`

### Task 9: Onboarding wizard — framework select → model backend select

**Files:**
- Create: `src/renderer/pages/FrameworkSelectPage.tsx`, `src/renderer/pages/ModelBackendPage.tsx`
- Modify: `src/renderer/store.ts` (add v2 onboarding state), `src/renderer/App.tsx` (routes)
- Test: `tests/renderer/onboarding-v2.test.ts`

**Interfaces:**
- Consumes: the Zustand store (v1), framework metadata via IPC (`getFrameworks`), backend kinds
- Produces: two wizard pages driving store state `selectedFrameworkId` (default `openclaw`) and `modelBackendDraft` ({kind, provider, baseUrl, protocol, model}); a store action `setFramework(id)` and `setModelBackendDraft(partial)`. The pages render against the `FrameworkAdapter`/backend interfaces with the adapter MOCKED (real install wiring comes in the follow-on plan).

- [ ] **Step 1: Write failing store tests** in `tests/renderer/onboarding-v2.test.ts` (mock `window.electronAPI` as the v1 store test does): initial `selectedFrameworkId === "openclaw"`; `setFramework("hermes")` updates it; `setModelBackendDraft({kind:"cloud",provider:"anthropic"})` merges into the draft.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the store additions; then `FrameworkSelectPage` (cards from `getFrameworks()`, top-5 features, openclaw preselected) and `ModelBackendPage` (choose kind: local-Ollama / advanced-local / custom-endpoint / cloud → conditional fields: provider, base URL, protocol radio `v1/messages`|`v1/chat/completions`, model). Wire both into `App.tsx` behind new view states. Keep the real "install framework" call stubbed (a no-op adapter) — note it in a comment as follow-on.
- [ ] **Step 4: Run** the store test → PASS; run the full suite `npx vitest run` (no regressions) and `npx tsc -p tsconfig.renderer.json --noEmit`.
- [ ] **Step 5: Commit** `git add src/renderer tests/renderer/onboarding-v2.test.ts && git commit -m "feat: v2 onboarding wizard (framework select + model backend select) against mocked adapter"`

---

## Follow-on (NOT in this plan — write after the spike)
- openclaw `FrameworkAdapter` implementation (install/configure/start/sendTask/streamOutput/installCapability/restart) using the **verified** commands from Phase 0.
- CapabilityOrchestrator (pre-bundle + gap→install→restart→resume) — shape depends on Task 3's GO/NO-GO.
- zeptoclaw + hermes adapters; advanced-local (llama.cpp/vLLM) install; remote (connect-only) deployments; capability management UI.

---

## Self-Review

**Spec coverage:** §4 architecture → Tasks 3–9 (interfaces/backends/registry/onboarding) + follow-on (adapters/orchestrator, explicitly deferred). §5 flow → Task 9 (wizard). §6 capability model → Phase 0 spike verifies feasibility; implementation is follow-on. §7 data model → Task 4. §8 security → Task 5 (secrets), Task 9 (visible install — follow-on). §9 reuse → Tasks 4/6 reuse v1 DB + buffered-SSE pattern. §10 risks → Phase 0 spike is exactly risks #1–#3; §11 phasing → this plan = Phase 0 + spike-independent Phase 1. §12 decisions honored (personas deferred, mac-first, etc.).

**Placeholder scan:** no TBD/TODO; spike tasks have concrete commands to run and a defined deliverable doc; scaffolding tasks have real test + implementation code. The openclaw adapter body is not a placeholder — it is explicitly a separate, spike-gated plan (writing invented commands now would be the placeholder).

**Type consistency:** `FrameworkMeta` (id/name/features/installRecipe), `Deployment`/`NewDeployment`, `ModelBackendConfig` (id/kind/provider/baseUrl/protocol/model/secretRef), `InstalledCapability` (deploymentId/type/name/source) are defined once in `v2-types.ts` (Task 4) and consumed identically in Tasks 6–9. `ModelBackend.chat(messages, onToken)` and `createBackend(cfg, secrets)` signatures match across Tasks 6–7.
