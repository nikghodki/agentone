# Phase 3 — Model Backends (llama.cpp + cloud providers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the model-backend layer — a managed **llama.cpp** local server (download binary + curated GGUF, launch, monitor) plus keeping the custom-endpoint path, and cloud providers **OpenRouter, Azure OpenAI, and Amazon Bedrock** — all behind the existing `ModelBackend` seam and `ModelBackendPage`.

**Architecture:** New `LlamaCppManager` (modeled on `OllamaManager`) that downloads a prebuilt `llama-server` + a curated GGUF and runs the server on loopback; it surfaces as backend `kind:"llamacpp"` with a local OpenAI-compatible `baseUrl` handled by the existing `OpenAICompatibleBackend`. Cloud expansion adds provider-based routing in `createBackend`: OpenRouter reuses `OpenAICompatibleBackend`; **Azure** and **Bedrock** get dedicated backends. Provider-specific config (Azure deployment/api-version, Bedrock region) is stored in a new nullable `extra_json` column; multi-part Bedrock credentials are stored as one JSON blob via `Secrets`.

**Tech Stack:** Electron 23 / React 18 / TypeScript 5.6 / better-sqlite3 / Zustand / Vitest. No new runtime dependencies (SigV4 implemented in-repo).

**Spec:** `docs/specs/2026-08-31-agentone-v2-design.md` (§5 First-Run Flow, §7 Data Model, §8 Security, §11 Phasing — Phase 3).

## Global Constraints

- **Host Node stays v16.16.0** — never change host node/PATH; all dev tooling runs under host node 16.
- **Secrets only via `Secrets` (safeStorage).** API keys / AWS creds are NEVER written to the DB, NEVER logged. The DB stores only a `secretRef`. Multi-part creds (Bedrock) are stored as a JSON string under a single `secretRef`.
- **Local servers bind loopback only** (`127.0.0.1`).
- **Injection-safe process spawning** — use argument arrays (`spawn`/`execFile`), never shell string interpolation.
- **Mac-first** (spec §12.4): llama.cpp targets macOS (arm64 Metal). vLLM managed launch is explicitly out of scope.
- **Injectable dependencies for tests** — `fetch`, spawn function, and `Secrets` encryptor are injected (match existing test patterns: `tests/main/model-backends.test.ts` injects `fetch`; `tests/main/save-model-backend.test.ts` injects a fake encryptor; DB tests use a real sqlite file in tmpdir).
- **No secrets in logs** applies to every task that touches keys/creds.

---

## File Structure

**Create:**
- `src/main/llamacpp-manager.ts` — download `llama-server` + curated GGUF (progress), spawn/monitor/stop the server (loopback).
- `src/main/model-backends/azure-openai.ts` — Azure OpenAI backend (api-key header + api-version query + deployment URL).
- `src/main/model-backends/bedrock.ts` — Amazon Bedrock backend (Anthropic Claude via `invoke` + SigV4, non-streaming).
- `src/main/aws-sigv4.ts` — minimal AWS Signature V4 signer (pure function, unit-tested against AWS known-answer vectors).
- Test files mirroring each (see tasks).

**Modify:**
- `src/shared/v2-types.ts` — add `extra?: Record<string, unknown> | null` to `ModelBackendConfig`.
- `src/main/database.ts` — `extra_json` column (guarded `ALTER TABLE` migration) + include `extra` in `saveModelBackend`/`getModelBackend`.
- `src/main/model-backends/index.ts` — route on provider for `azure`/`bedrock`; OpenRouter falls through to OpenAI-compatible.
- `src/main/model-backends/openai-compatible.ts` — extract the SSE line-parser into an exported helper for reuse by Azure (no behavior change to existing path).
- `src/main/ipc-handlers.ts` — `save-model-backend` accepts `extra` + secret value (possibly JSON); `deployFramework` starts the llama.cpp server for `kind:"llamacpp"` and rewrites `baseUrl`; `shutdownServices` stops it.
- `src/preload/index.ts` + `src/shared/types.ts` — `saveModelBackend` signature carries `extra`.
- `src/renderer/pages/ModelBackendPage.tsx` + `src/renderer/store.ts` — managed llama.cpp option (with download progress), provider dropdown (Anthropic/OpenAI/OpenRouter/Azure/Bedrock), conditional per-provider fields, `draft.extra`.

---

## Interfaces (shared across tasks — exact names/types)

```typescript
// src/shared/v2-types.ts — ModelBackendConfig gains:
extra?: Record<string, unknown> | null;   // provider-specific: azure {deployment, apiVersion, resourceUrl}, bedrock {region}

// LlamaCppManager (Task 3)
class LlamaCppManager {
  constructor(installDir: string, opts?: {
    fetchFn?: typeof fetch;
    spawnFn?: (cmd: string, args: string[], opts: object) => import("child_process").ChildProcess;
    port?: number;
  });
  getPort(): number;
  getBaseUrl(): string;                                   // http://127.0.0.1:<port>/v1
  async ensureInstalled(onProgress: (pct: number) => void): Promise<void>;   // download+unpack llama-server
  async ensureModel(modelSpec: { url?: string; localPath?: string }, onProgress: (pct: number) => void): Promise<string>; // returns resolved .gguf path
  async start(modelPath: string): Promise<void>;          // spawn llama-server, poll /health
  async isReady(): Promise<boolean>;                      // GET /health -> ok
  stop(): void;                                           // SIGTERM then SIGKILL after grace
}

// aws-sigv4.ts (Task 6)
function signRequestV4(params: {
  method: string; host: string; path: string; region: string; service: string;
  headers: Record<string, string>; body: string;
  accessKeyId: string; secretAccessKey: string; sessionToken?: string;
  now?: Date;   // injectable for deterministic tests
}): Record<string, string>;   // returns headers to send incl. Authorization + x-amz-date (+ x-amz-security-token)

// createBackend routing (Task 5/6) — provider takes precedence for azure/bedrock, else protocol.
```

Curated default GGUF (Task 3): **Qwen2.5-1.5B-Instruct GGUF, Q4_K_M** — small (~1GB), Metal-friendly, known-good. URL constant:
`https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf`

llama.cpp prebuilt asset (Task 3): the macOS arm64 build from `https://github.com/ggml-org/llama.cpp/releases/latest` (asset name matches `llama-*-bin-macos-arm64.zip`, contains `llama-server`). The release asset URL is resolved via the GitHub releases API `https://api.github.com/repos/ggml-org/llama.cpp/releases/latest`.

---

## Task 1: Data model — `extra_json` column + `ModelBackendConfig` config field

**Files:**
- Modify: `src/shared/v2-types.ts` (add `extra` to `ModelBackendConfig`)
- Modify: `src/main/database.ts:81-89` (schema), `:296-317` (`saveModelBackend`/`getModelBackend`), `initialize()` (`:15-102`)
- Test: `tests/main/database.test.ts` (extend)

**Interfaces:**
- Produces: `ModelBackendConfig.extra?: Record<string, unknown> | null`; DB persists/reads it as `extra_json` TEXT (JSON) — consumed by Tasks 2, 5, 6.

- [ ] **Step 1: Write the failing test** (append to `tests/main/database.test.ts`)

```typescript
it("persists and reads back a model backend with extra config", () => {
  db.saveModelBackend({
    id: "mb1", kind: "cloud", provider: "azure", baseUrl: null,
    protocol: "v1/chat/completions", model: "gpt-4o",
    secretRef: "backend:mb1",
    extra: { deployment: "gpt4o", apiVersion: "2024-06-01", resourceUrl: "https://r.openai.azure.com" },
  });
  const got = db.getModelBackend("mb1");
  expect(got?.extra).toEqual({ deployment: "gpt4o", apiVersion: "2024-06-01", resourceUrl: "https://r.openai.azure.com" });
});

it("reads back null extra when none provided", () => {
  db.saveModelBackend({
    id: "mb2", kind: "ollama", provider: null, baseUrl: "http://127.0.0.1:11434",
    protocol: "v1/chat/completions", model: "llama3.2:3b", secretRef: null,
  });
  expect(db.getModelBackend("mb2")?.extra ?? null).toBeNull();
});

it("adds extra_json column to a pre-existing table without it (migration)", () => {
  // Simulate an old DB: create model_backends WITHOUT extra_json, then initialize() again.
  const raw = (db as any).db as import("better-sqlite3").Database;
  raw.exec("DROP TABLE IF EXISTS model_backends");
  raw.exec(`CREATE TABLE model_backends (id TEXT PRIMARY KEY, kind TEXT, provider TEXT, base_url TEXT, protocol TEXT, model TEXT, secret_ref TEXT)`);
  db.initialize(); // must ALTER-add extra_json, not throw
  db.saveModelBackend({ id: "mb3", kind: "cloud", provider: "bedrock", baseUrl: null, protocol: "v1/messages", model: "anthropic.claude-3-5-sonnet-20240620-v1:0", secretRef: "backend:mb3", extra: { region: "us-east-1" } });
  expect(db.getModelBackend("mb3")?.extra).toEqual({ region: "us-east-1" });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/main/database.test.ts`
Expected: FAIL (`extra` undefined on read; migration test errors on missing column).

- [ ] **Step 3: Add `extra` to the type**

In `src/shared/v2-types.ts`, inside `ModelBackendConfig`:
```typescript
  secretRef: string | null;
  extra?: Record<string, unknown> | null;   // provider-specific config (azure/bedrock); JSON in DB extra_json
```

- [ ] **Step 4: Add the column + guarded migration in `database.ts`**

In the `CREATE TABLE IF NOT EXISTS model_backends (...)` block, add `extra_json TEXT` as the last column. Then, still inside `initialize()` (AFTER the CREATE block), add an idempotent migration for pre-existing DBs:
```typescript
// Migration: ensure extra_json exists on model_backends created before this column was added.
const cols = this.db.prepare("PRAGMA table_info(model_backends)").all() as Array<{ name: string }>;
if (!cols.some((c) => c.name === "extra_json")) {
  this.db.exec("ALTER TABLE model_backends ADD COLUMN extra_json TEXT");
}
```

- [ ] **Step 5: Persist/read `extra` in the DB methods**

`saveModelBackend`:
```typescript
this.db
  .prepare(`INSERT OR REPLACE INTO model_backends (id, kind, provider, base_url, protocol, model, secret_ref, extra_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
  .run(b.id, b.kind, b.provider, b.baseUrl, b.protocol, b.model, b.secretRef,
       b.extra != null ? JSON.stringify(b.extra) : null);
```
`getModelBackend` return object adds:
```typescript
  extra: row.extra_json ? JSON.parse(row.extra_json) : null,
```

- [ ] **Step 6: Run tests to verify pass**

Run: `npx vitest run tests/main/database.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/v2-types.ts src/main/database.ts tests/main/database.test.ts
git commit -m "feat(phase3): model_backends.extra_json column + ModelBackendConfig.extra (guarded migration)"
```

---

## Task 2: `save-model-backend` IPC — persist `extra` + JSON-capable secret

**Files:**
- Modify: `src/main/ipc-handlers.ts:251-280`
- Modify: `src/preload/index.ts:57-58`, `src/shared/types.ts:126-129`
- Test: `tests/main/save-model-backend.test.ts` (extend)

**Interfaces:**
- Consumes: Task 1 `extra` field, `Secrets.set` (stores arbitrary string incl. JSON).
- Produces: `saveModelBackend(draft, secret?)` where `draft` carries `extra`; consumed by Task 7 UI.

- [ ] **Step 1: Write the failing test** (extend `tests/main/save-model-backend.test.ts`)

```typescript
it("persists extra config and stores a JSON multi-part secret via Secrets", () => {
  const id = handleSaveModelBackend(
    { kind: "cloud", provider: "bedrock", baseUrl: null, protocol: "v1/messages",
      model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
      extra: { region: "us-east-1" } },
    JSON.stringify({ accessKeyId: "AKIA...", secretAccessKey: "shh" })
  );
  const saved = db.getModelBackend(id)!;
  expect(saved.extra).toEqual({ region: "us-east-1" });
  expect(saved.secretRef).toBe(`backend:${id}`);
  // Secret is retrievable and NOT in the DB row (only the ref is)
  expect(JSON.parse(secrets.get(saved.secretRef!)!)).toEqual({ accessKeyId: "AKIA...", secretAccessKey: "shh" });
});

it("stores no secretRef when no secret provided", () => {
  const id = handleSaveModelBackend(
    { kind: "llamacpp", provider: null, baseUrl: "http://127.0.0.1:8080/v1",
      protocol: "v1/chat/completions", model: "qwen2.5-1.5b" }, undefined);
  expect(db.getModelBackend(id)?.secretRef).toBeNull();
});
```

> Note: the existing test file calls the handler logic directly (see its setup). Follow the existing harness: if the file registers the ipc handler and invokes via a captured handler fn, reuse that; otherwise extract the handler body into a testable `handleSaveModelBackend(draft, secret?)` function in `ipc-handlers.ts` and export it (mirrors the exported `createAdapter` pattern already in that file).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/main/save-model-backend.test.ts` — FAIL (extra not persisted).

- [ ] **Step 3: Extend the handler**

Change the `draft` param type to include `extra?: Record<string, unknown> | null`, keep the second param as `secret?: string` (a plain key OR a JSON creds blob — the handler does not care which). Pass `extra: draft.extra ?? null` into `db.saveModelBackend`. Secret storage logic (secretRef = `backend:${id}`, `secrets.set`) is unchanged. Never log `secret`.

- [ ] **Step 4: Update preload + ElectronAPI type**

`src/shared/types.ts` `saveModelBackend`:
```typescript
saveModelBackend: (
  draft: { kind: string; provider: string | null; baseUrl: string | null; protocol: string; model: string; extra?: Record<string, unknown> | null },
  secret?: string
) => Promise<string>;
```
`src/preload/index.ts` passes `draft, secret` through unchanged (signature widened only).

- [ ] **Step 5: Run tests** — `npx vitest run tests/main/save-model-backend.test.ts` — PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc-handlers.ts src/preload/index.ts src/shared/types.ts tests/main/save-model-backend.test.ts
git commit -m "feat(phase3): save-model-backend persists extra + JSON-capable secret"
```

---

## Task 3: `LlamaCppManager` — download binary + GGUF, launch, monitor

**Files:**
- Create: `src/main/llamacpp-manager.ts`
- Test: `tests/main/llamacpp-manager.test.ts`

**Interfaces:**
- Consumes: injected `fetchFn`, `spawnFn` (test pattern).
- Produces: the `LlamaCppManager` class (see Interfaces section) — consumed by Task 4 deploy wiring.

**Behavior (mirrors `OllamaManager` + adds download):**
- `ensureInstalled(onProgress)`: if `<installDir>/llama-server` missing → GET the GitHub releases API JSON, pick the asset matching `/llama-.*-bin-macos-arm64\.zip/`, download it (stream, report pct from `content-length`), unzip into `installDir`, `chmod 0o755` the `llama-server`. Idempotent (skip if present).
- `ensureModel({url, localPath}, onProgress)`: if `localPath` given and exists → return it. Else download `url` (default = curated Qwen GGUF constant) into `<installDir>/models/`, streaming with pct from `content-length`, return the path. Idempotent (skip if file already present with expected size).
- `start(modelPath)`: `spawnFn(<installDir>/llama-server, ["--model", modelPath, "--host", "127.0.0.1", "--port", String(port), "--n-gpu-layers", "999"], { stdio: "pipe" })`; then poll `isReady()` up to 40×500ms.
- `isReady()`: `GET http://127.0.0.1:<port>/health` → `response.ok` (guard with AbortController 2s timeout).
- `stop()`: `SIGTERM`; if still alive after a short grace, `SIGKILL`. Null the handle.

- [ ] **Step 1: Write failing tests** (`tests/main/llamacpp-manager.test.ts`)

```typescript
import { describe, it, expect, vi } from "vitest";
import { LlamaCppManager } from "../../src/main/llamacpp-manager";

function jsonResponse(obj: unknown) {
  return { ok: true, status: 200, json: async () => obj, headers: new Map() } as any;
}

it("start() spawns llama-server on loopback with the model path and polls /health", async () => {
  const fakeChild: any = { kill: vi.fn(), on: vi.fn(), stdout: { on: vi.fn() }, stderr: { on: vi.fn() } };
  const spawnFn = vi.fn().mockReturnValue(fakeChild);
  let healthCalls = 0;
  const fetchFn = vi.fn().mockImplementation(async (url: string) => {
    if (String(url).endsWith("/health")) { healthCalls++; return { ok: true } as any; }
    throw new Error("unexpected");
  });
  const mgr = new LlamaCppManager("/fake/llamacpp", { spawnFn, fetchFn: fetchFn as any, port: 8123 });
  await mgr.start("/fake/model.gguf");

  const [cmd, args, opts] = spawnFn.mock.calls[0];
  expect(cmd).toBe("/fake/llamacpp/llama-server");
  expect(args).toEqual(expect.arrayContaining(["--model", "/fake/model.gguf", "--host", "127.0.0.1", "--port", "8123"]));
  expect(mgr.getBaseUrl()).toBe("http://127.0.0.1:8123/v1");
  expect(healthCalls).toBeGreaterThan(0);
});

it("ensureModel() returns a user-supplied local path without downloading", async () => {
  const fetchFn = vi.fn();
  const mgr = new LlamaCppManager("/fake/llamacpp", { fetchFn: fetchFn as any });
  // localPath resolution should short-circuit; use a path the manager treats as existing (inject fs check via existsFn if present, else use installDir file). See implementation note.
  const p = await mgr.ensureModel({ localPath: "/some/existing.gguf" }, () => {});
  expect(p).toBe("/some/existing.gguf");
  expect(fetchFn).not.toHaveBeenCalled();
});

it("stop() sends SIGTERM", async () => {
  const fakeChild: any = { kill: vi.fn(), on: vi.fn(), stdout: { on: vi.fn() }, stderr: { on: vi.fn() } };
  const spawnFn = vi.fn().mockReturnValue(fakeChild);
  const fetchFn = vi.fn().mockResolvedValue({ ok: true } as any);
  const mgr = new LlamaCppManager("/fake/llamacpp", { spawnFn, fetchFn: fetchFn as any, port: 8124 });
  await mgr.start("/m.gguf");
  mgr.stop();
  expect(fakeChild.kill).toHaveBeenCalledWith("SIGTERM");
});
```

> Implementation note: to keep `ensureModel`/`ensureInstalled` testable without hitting disk, inject an optional `existsFn?: (p: string) => boolean` (default `fs.existsSync`) and `fsPromises` for writes. The `localPath` short-circuit uses `existsFn`. Keep download streaming behind `fetchFn`.

- [ ] **Step 2: Run to verify fail** — `npx vitest run tests/main/llamacpp-manager.test.ts` — FAIL (module missing).

- [ ] **Step 3: Implement `LlamaCppManager`** per the Behavior + Interfaces above. Use `spawn` from `child_process` as the default `spawnFn`; default `fetchFn = fetch`; default `port` = random in 8100–8999. Loopback only. Progress: for streamed downloads, read `content-length` and sum received bytes → `onProgress(Math.round(pct))`. Unzip via `child_process.execFile("unzip", ["-o", zipPath, "-d", installDir])` (arg-array; macOS ships `unzip`).

- [ ] **Step 4: Run tests** — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/llamacpp-manager.ts tests/main/llamacpp-manager.test.ts
git commit -m "feat(phase3): LlamaCppManager — download llama-server + GGUF, launch on loopback, monitor"
```

---

## Task 4: Deploy + lifecycle wiring for `kind:"llamacpp"`

**Files:**
- Modify: `src/main/ipc-handlers.ts` (`deployFramework` ~`:147-222`, module-level manager var ~`:17`, `shutdownServices` ~`:283-289`)
- Test: `tests/main/ipc-handlers-llamacpp.test.ts` (new) or extend an existing ipc-handlers test

**Interfaces:**
- Consumes: `LlamaCppManager` (Task 3), the deployed `ModelBackendConfig` (Task 1).
- Produces: at deploy, a running llama.cpp server whose `baseUrl` is injected into the backend config before `adapter.configure(backend)`.

- [ ] **Step 1: Write the failing test**

Refactor so the llama.cpp startup is a testable exported function `startLlamaCppForBackend(backend, mgr, onProgress)` that takes an injected manager and returns the backend with a rewritten `baseUrl`. The test drives that function directly (no full IPC round-trip needed):

```typescript
import { startLlamaCppForBackend, shutdownServices, __setLlamaCppManagerForTest } from "../../src/main/ipc-handlers";

it("starts the manager and rewrites baseUrl to the local server for a llamacpp backend", async () => {
  const mgr = {
    ensureInstalled: vi.fn().mockResolvedValue(undefined),
    ensureModel: vi.fn().mockResolvedValue("/models/m.gguf"),
    start: vi.fn().mockResolvedValue(undefined),
    getBaseUrl: () => "http://127.0.0.1:8123/v1",
    stop: vi.fn(),
  };
  const backend = { id: "x", kind: "llamacpp", provider: null, baseUrl: null,
    protocol: "v1/chat/completions", model: "qwen2.5-1.5b", secretRef: null, extra: null };
  const out = await startLlamaCppForBackend(backend as any, mgr as any, () => {});
  expect(mgr.ensureInstalled).toHaveBeenCalled();
  expect(mgr.ensureModel).toHaveBeenCalled();
  expect(mgr.start).toHaveBeenCalledWith("/models/m.gguf");
  expect(out.baseUrl).toBe("http://127.0.0.1:8123/v1");
});

it("shutdownServices stops a registered llama.cpp manager", () => {
  const mgr = { stop: vi.fn() };
  __setLlamaCppManagerForTest(mgr as any);   // test seam mirroring the module-level var
  shutdownServices();
  expect(mgr.stop).toHaveBeenCalled();
});
```

> Implementation note: add an exported factory `createLlamaCppManager(installDir)`, a module-level `llamaCppManager` var registered in `shutdownServices`, the exported `startLlamaCppForBackend(...)`, and a tiny `__setLlamaCppManagerForTest` seam (mirrors the existing exported `createAdapter` testability convention in this file). `deployFramework` calls `startLlamaCppForBackend` when `backend.kind === "llamacpp"` and stores the manager in the module-level var.

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement deploy wiring.** In `deployFramework`, after loading `backend` and before `adapter.configure(backend)`:
```typescript
if (backend.kind === "llamacpp") {
  llamaCppManager = createLlamaCppManager(getLlamaCppInstallDir());
  await llamaCppManager.ensureInstalled((pct) => sendProgress("llamacpp-install", pct));
  const modelPath = await llamaCppManager.ensureModel(
    { url: (backend.extra?.modelUrl as string) || undefined, localPath: (backend.extra?.modelPath as string) || undefined },
    (pct) => sendProgress("llamacpp-model", pct));
  await llamaCppManager.start(modelPath);
  backend = { ...backend, baseUrl: llamaCppManager.getBaseUrl() };
}
```
Add `llamaCppManager?.stop()` to `shutdownServices()`. Reuse the existing progress IPC channel pattern (`model-download-progress` or a dedicated channel — match how `OllamaManager` progress is surfaced).

- [ ] **Step 4: Run tests** — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc-handlers.ts tests/main/ipc-handlers-llamacpp.test.ts
git commit -m "feat(phase3): start/stop managed llama.cpp server in deploy lifecycle"
```

---

## Task 5: Cloud — OpenRouter + Azure OpenAI

**Files:**
- Create: `src/main/model-backends/azure-openai.ts`
- Modify: `src/main/model-backends/openai-compatible.ts` (export SSE line-parser helper — no behavior change)
- Modify: `src/main/model-backends/index.ts` (provider routing)
- Test: `tests/main/model-backends.test.ts` (extend)

**Interfaces:**
- Consumes: `ModelBackendConfig` incl. `extra` (azure: `{resourceUrl, deployment, apiVersion}`), `apiKey` from `secrets.get`.
- Produces: `AzureOpenAIBackend`; `createBackend` provider routing.

- [ ] **Step 1: Write failing tests**

```typescript
it("Azure backend builds deployment URL with api-version and uses api-key header", async () => {
  const calls: any[] = [];
  const fakeFetch = async (url: string, opts: any) => { calls.push({ url, opts }); return { ok: true, body: createSSEStream(['data: {"choices":[{"delta":{"content":"hi"}}]}\n\n', "data: [DONE]\n\n"]) } as any; };
  const cfg = { id: "a", kind: "cloud", provider: "azure", baseUrl: null, protocol: "v1/chat/completions", model: "gpt-4o",
    secretRef: "backend:a", extra: { resourceUrl: "https://r.openai.azure.com", deployment: "gpt4o", apiVersion: "2024-06-01" } };
  const backend = new AzureOpenAIBackend(cfg as any, "AZKEY", fakeFetch as any);
  const out = await backend.chat([{ role: "user", content: "yo" }], () => {});
  expect(calls[0].url).toBe("https://r.openai.azure.com/openai/deployments/gpt4o/chat/completions?api-version=2024-06-01");
  expect(calls[0].opts.headers["api-key"]).toBe("AZKEY");
  expect(calls[0].opts.headers["Authorization"]).toBeUndefined();
  expect(out).toBe("hi");
});

it("createBackend routes provider=azure to AzureOpenAIBackend and provider=openrouter to OpenAI-compatible", () => {
  const secrets = { get: () => "k" } as any;
  const azure = createBackend({ provider: "azure", protocol: "v1/chat/completions", extra: { resourceUrl: "https://r", deployment: "d", apiVersion: "v" } } as any, secrets);
  expect(azure).toBeInstanceOf(AzureOpenAIBackend);
  const or = createBackend({ provider: "openrouter", protocol: "v1/chat/completions", baseUrl: "https://openrouter.ai/api" } as any, secrets);
  expect(or).toBeInstanceOf(OpenAICompatibleBackend);
});
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Extract the SSE parser** from `openai-compatible.ts` into an exported `parseSSEStream(body, onToken): Promise<string>` (or a small helper module) and have `OpenAICompatibleBackend.chat` call it — verify the existing model-backends tests still pass unchanged.

- [ ] **Step 4: Implement `AzureOpenAIBackend`** using `extra.resourceUrl`/`deployment`/`apiVersion`: URL `${resourceUrl}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`, headers `{ "Content-Type": "application/json", "api-key": apiKey }` (NO Authorization), body identical to OpenAI-compatible, reuse `parseSSEStream`.

- [ ] **Step 5: Route in `createBackend`** BEFORE the protocol check:
```typescript
if (cfg.provider === "azure") return new AzureOpenAIBackend(cfg, apiKey, fetchFn);
if (cfg.provider === "bedrock") return new BedrockBackend(cfg, apiKey, fetchFn);  // Task 6
// OpenRouter is OpenAI-compatible: falls through to the protocol branch (Bearer key + baseUrl).
```
(OpenRouter needs no special code — the UI supplies `baseUrl=https://openrouter.ai/api` and a Bearer key; the existing OpenAI-compatible path handles it. `${baseUrl}/v1/chat/completions` → confirm the UI sets baseUrl WITHOUT a trailing `/v1` since the backend appends `/v1/chat/completions`.)

- [ ] **Step 6: Run tests** — `npx vitest run tests/main/model-backends.test.ts` — PASS (incl. unchanged existing cases).

- [ ] **Step 7: Commit**

```bash
git add src/main/model-backends/ tests/main/model-backends.test.ts
git commit -m "feat(phase3): OpenRouter (reuse) + Azure OpenAI backend + provider routing"
```

---

## Task 6: Amazon Bedrock — SigV4 signer + backend (Anthropic Claude, non-streaming)

**Files:**
- Create: `src/main/aws-sigv4.ts`, `src/main/model-backends/bedrock.ts`
- Modify: `src/main/model-backends/index.ts` (route already added in Task 5)
- Test: `tests/main/aws-sigv4.test.ts`, `tests/main/model-backends.test.ts` (extend for bedrock)

**Interfaces:**
- Consumes: `signRequestV4(...)` (see Interfaces), `secrets.get(secretRef)` returning JSON `{accessKeyId, secretAccessKey, sessionToken?}`, `extra.region`.
- Produces: `BedrockBackend`.

- [ ] **Step 1: Write the failing SigV4 test with AWS known-answer vectors** (`tests/main/aws-sigv4.test.ts`)

```typescript
import { describe, it, expect } from "vitest";
import { signRequestV4 } from "../../src/main/aws-sigv4";

// AWS SigV4 canonical example (get-vanilla family) — deterministic with fixed date + test creds.
it("produces the AWS-documented Authorization header for the canonical example", () => {
  const headers = signRequestV4({
    method: "GET", host: "example.amazonaws.com", path: "/", region: "us-east-1", service: "service",
    headers: { host: "example.amazonaws.com", "x-amz-date": "20150830T123600Z" }, body: "",
    accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
    now: new Date(Date.UTC(2015, 7, 30, 12, 36, 0)),
  });
  // The exact expected Authorization string from the AWS SigV4 test-suite for this input.
  expect(headers["Authorization"]).toBe(
    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, " +
    "SignedHeaders=host;x-amz-date, " +
    "Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31"
  );
});
```

> The implementer must reproduce the canonical `SignedHeaders`/`Signature` exactly (this is the standard AWS `get-vanilla` test vector). If the exact expected signature differs from the constant above after a correct implementation, update the constant to the value the AWS test-suite documents for these precise inputs — the point is a known-answer vector, not this literal string.

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement `signRequestV4`** — canonical request → string-to-sign → signing key (`HMAC` chain `AWS4<secret>`→date→region→service→`aws4_request`) → hex signature, using Node `crypto` (`createHash("sha256")`, `createHmac`). Include `x-amz-security-token` in signed headers when `sessionToken` present. Return the headers to send (`Authorization`, `x-amz-date`, and echo `x-amz-security-token`). No secrets logged.

- [ ] **Step 4: Write the failing Bedrock backend test** (extend `tests/main/model-backends.test.ts`)

```typescript
it("Bedrock backend signs an invoke request and returns the Claude answer (non-streaming)", async () => {
  const calls: any[] = [];
  const fakeFetch = async (url: string, opts: any) => { calls.push({ url, opts }); return {
    ok: true,
    json: async () => ({ content: [{ type: "text", text: "4" }] }),  // Bedrock Anthropic invoke response shape
  } as any; };
  const secrets = { get: () => JSON.stringify({ accessKeyId: "AKID", secretAccessKey: "sk" }) } as any;
  const cfg = { id: "b", kind: "cloud", provider: "bedrock", baseUrl: null, protocol: "v1/messages",
    model: "anthropic.claude-3-5-sonnet-20240620-v1:0", secretRef: "backend:b", extra: { region: "us-east-1" } };
  const backend = createBackend(cfg as any, secrets, fakeFetch as any);
  const tokens: string[] = [];
  const out = await backend.chat([{ role: "user", content: "2+2? one number" }], (t) => tokens.push(t));
  expect(calls[0].url).toContain("bedrock-runtime.us-east-1.amazonaws.com");
  expect(calls[0].url).toContain(encodeURIComponent(cfg.model) + "/invoke");  // or the exact invoke path
  expect(calls[0].opts.headers["Authorization"]).toContain("AWS4-HMAC-SHA256");
  expect(out).toBe("4");
  expect(tokens).toEqual(["4"]);   // non-streaming: single onToken call
});
```

- [ ] **Step 5: Implement `BedrockBackend`** — parse creds JSON from `apiKey` (the retrieved secret) + `extra.region`. Build `POST https://bedrock-runtime.<region>.amazonaws.com/model/<modelId>/invoke` with the Anthropic-on-Bedrock body (`{ anthropic_version: "bedrock-2023-05-31", max_tokens, messages }`), sign via `signRequestV4` (service `"bedrock"`), send, parse `content[].text`, call `onToken(fullText)` once, return the text. Non-streaming (documented limitation). No secrets logged.

- [ ] **Step 6: Run tests** — `npx vitest run tests/main/aws-sigv4.test.ts tests/main/model-backends.test.ts` — PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main/aws-sigv4.ts src/main/model-backends/bedrock.ts src/main/model-backends/index.ts tests/main/aws-sigv4.test.ts tests/main/model-backends.test.ts
git commit -m "feat(phase3): Amazon Bedrock backend (Anthropic Claude via invoke + in-repo SigV4)"
```

---

## Task 7: `ModelBackendPage` UI — managed llama.cpp + provider fields

**Files:**
- Create: `src/renderer/pages/model-backend-payload.ts` (pure helper `buildSaveArgs`)
- Modify: `src/renderer/pages/ModelBackendPage.tsx`, `src/renderer/store.ts` (add `extra` to `modelBackendDraft`)
- Test: `tests/renderer/model-backend-payload.test.ts` (pure helper, matches existing store-test style) + one RTL render check in `tests/renderer/model-backend-page.test.tsx`

**Interfaces:**
- Consumes: `saveModelBackend(draft, secret?)` with `draft.extra` (Task 2).
- Produces: `buildSaveArgs(draft, form) -> { draft: {...,extra}, secret?: string }` (pure, testable); per-provider UI + draft shape.

- [ ] **Step 1: Write failing tests for the pure payload helper** (`tests/renderer/model-backend-payload.test.ts`)

```typescript
import { describe, it, expect } from "vitest";
import { buildSaveArgs } from "../../src/renderer/pages/model-backend-payload";

it("bedrock: region -> extra, two keys -> JSON secret", () => {
  const { draft, secret } = buildSaveArgs(
    { kind: "cloud", provider: "bedrock", protocol: "v1/messages", model: "anthropic.claude-3-5-sonnet-20240620-v1:0", baseUrl: null },
    { region: "us-east-1", accessKeyId: "AKID", secretAccessKey: "sk", apiKey: "", resourceUrl: "", deployment: "", apiVersion: "" });
  expect(draft.extra).toEqual({ region: "us-east-1" });
  expect(JSON.parse(secret!)).toEqual({ accessKeyId: "AKID", secretAccessKey: "sk" });
});

it("azure: resourceUrl/deployment/apiVersion -> extra, key -> secret", () => {
  const { draft, secret } = buildSaveArgs(
    { kind: "cloud", provider: "azure", protocol: "v1/chat/completions", model: "gpt-4o", baseUrl: null },
    { region: "", accessKeyId: "", secretAccessKey: "", apiKey: "AZ", resourceUrl: "https://r.openai.azure.com", deployment: "gpt4o", apiVersion: "2024-06-01" });
  expect(draft.extra).toEqual({ resourceUrl: "https://r.openai.azure.com", deployment: "gpt4o", apiVersion: "2024-06-01" });
  expect(secret).toBe("AZ");
});

it("openrouter: bearer key -> secret, no extra", () => {
  const { draft, secret } = buildSaveArgs(
    { kind: "cloud", provider: "openrouter", protocol: "v1/chat/completions", model: "meta-llama/llama-3.1-8b", baseUrl: "https://openrouter.ai/api" },
    { region: "", accessKeyId: "", secretAccessKey: "", apiKey: "OR", resourceUrl: "", deployment: "", apiVersion: "" });
  expect(draft.extra ?? null).toBeNull();
  expect(secret).toBe("OR");
});

it("managed llamacpp: no secret, optional local model path -> extra.modelPath", () => {
  const { draft, secret } = buildSaveArgs(
    { kind: "llamacpp", provider: null, protocol: "v1/chat/completions", model: "qwen2.5-1.5b", baseUrl: null },
    { region: "", accessKeyId: "", secretAccessKey: "", apiKey: "", resourceUrl: "", deployment: "", apiVersion: "", modelPath: "/my/model.gguf" } as any);
  expect(draft.extra).toEqual({ modelPath: "/my/model.gguf" });
  expect(secret).toBeUndefined();
});
```

- [ ] **Step 2: Write one failing RTL render test** (`tests/renderer/model-backend-page.test.tsx`) asserting conditional fields:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
// mock window.electronAPI.saveModelBackend + deployFramework; render <ModelBackendPage/>
it("reveals Bedrock fields when Bedrock provider is chosen", async () => {
  // select Cloud kind, choose provider "bedrock" -> region + Access Key ID + Secret Access Key inputs appear
  expect(screen.getByLabelText(/region/i)).toBeTruthy();
  expect(screen.getByLabelText(/access key id/i)).toBeTruthy();
  expect(screen.getByLabelText(/secret access key/i)).toBeTruthy();
});
```

- [ ] **Step 3: Run to verify fail.**

- [ ] **Step 4: Add `extra` to the store draft.** In `src/renderer/store.ts`, `ModelBackendDraft` gains `extra?: Record<string, unknown> | null` and the initial state sets `extra: null`; `setModelBackendDraft` already merges partials.

- [ ] **Step 5: Implement `buildSaveArgs`** (pure) per the tests: maps provider-specific form fields into `draft.extra` and the `secret` (JSON for bedrock, plain for others, undefined when none).

- [ ] **Step 6: Update `ModelBackendPage`** (uses `buildSaveArgs` in `handleFinish`):
  - Split the "Advanced Local" button into **Managed llama.cpp** (`kind:"llamacpp"`, no URL required — the app runs it; optional "use my own .gguf path" field → `extra.modelPath`) and keep **Custom Endpoint** (`kind:"custom"`, URL+protocol+key) for BYO/other locally-hosted models.
  - Cloud provider `<select>` options: `anthropic`, `openai`, `openrouter`, `azure`, `bedrock`. On change, set sensible defaults (openrouter → `baseUrl=https://openrouter.ai/api`, protocol `v1/chat/completions`; anthropic → protocol `v1/messages`; bedrock → protocol `v1/messages`).
  - Conditional fields: **azure** → resourceUrl + deployment + apiVersion (→ `draft.extra`), api-key; **bedrock** → region (→ `draft.extra.region`), Access Key ID + Secret Access Key (combined into the secret as JSON on finish); **anthropic/openai/openrouter** → single API key.
  - `handleFinish`: build `secret` = for bedrock `JSON.stringify({accessKeyId, secretAccessKey})`, else the api-key string; call `saveModelBackend({ ...draft, extra }, secret)`.

- [ ] **Step 7: Run tests + typecheck** — `npx vitest run tests/renderer/` and `npm run build`.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/pages/ModelBackendPage.tsx src/renderer/pages/model-backend-payload.ts src/renderer/store.ts tests/renderer/
git commit -m "feat(phase3): ModelBackendPage — managed llama.cpp + OpenRouter/Azure/Bedrock provider fields"
```

---

## Task 8: Full-suite verification + spec Phase-3 status update

**Files:**
- Modify: `docs/specs/2026-08-31-agentone-v2-design.md` (§11 Phase 3 → mark done, note vLLM-managed + Bedrock-streaming deferred)

- [ ] **Step 1:** Run the full suite + build: `npx vitest run` and `npm run build`. All green; host `node -v` = v16.16.0.
- [ ] **Step 2:** Update spec §11 Phase 3 to reflect delivered scope and the two documented deferrals (managed vLLM; Bedrock token-streaming).
- [ ] **Step 3: Commit**

```bash
git add docs/specs/2026-08-31-agentone-v2-design.md
git commit -m "docs(phase3): mark Phase 3 model-backends delivered; note vLLM/Bedrock-streaming deferrals"
```

---

## Notes / Deferrals (explicit)
- **Managed vLLM** launch is out of scope (Linux/CUDA; not Mac-viable) — custom-endpoint path covers BYO vLLM.
- **Bedrock token streaming** is deferred (AWS binary event-stream parsing); Bedrock returns the full answer via one `onToken`.
- **Bedrock targets Anthropic Claude models** (the `anthropic_version` invoke body). Other Bedrock model families are a follow-up.
- The curated GGUF choice (Qwen2.5-1.5B-Instruct Q4_K_M) and the llama.cpp release repo (`ggml-org/llama.cpp`) are values, not placeholders — change only with reason.
