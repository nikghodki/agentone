# AgentOne Phase 2 — Slice 2a: Channel Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The engine to configure a messaging channel on a deployed framework: an adapter channel API (`listChannels`/`configureChannel`/`removeChannel`/`verifyChannel`) implemented per framework using the VERIFIED write-formats, plus a `configure-channel` IPC that does **config-write → monitored gateway restart → verify**. Proven end-to-end for Telegram on OpenClaw. (UI is Slice 2b.)

**Architecture:** Optional channel methods on `FrameworkAdapter` (like `detectGap?`, so adapters adopt incrementally without breaking the build). A shared channel **catalog** (per-channel required fields + framework support, from research). A `channels` DB table (deployment_id, channel_id, secretRef) + `Secrets` for tokens. The `configure-channel` IPC mirrors the capability gap→install→monitored-restart loop.

**Tech Stack:** Electron / TS / better-sqlite3 / Vitest. Host Node 16 (tests/build); openclaw under isolated Node 22; packaging unchanged.

**Spec:** `docs/specs/2026-09-02-agentone-phase2-messaging-channels.md`. **Research (exact formats — source of truth):** `docs/research/verified/framework-messaging-channels.md` (esp. the "Channel Write-Format (Slice 2a)" section).

## Global Constraints
- **No invented config/commands** — use ONLY the verified write-formats/commands from the research doc. Per framework:
  - **zeptoclaw:** write `config.channels.<id> = { enabled:true, token:"<TOKEN>", ... }` to `~/.zeptoclaw/config.json` (deep-merge, preserve other keys). Token MUST live in the config file (plaintext) — document + `chmod 600` the config. Verify: `zeptoclaw channel test <id>` / `channel list`. Remove: config-edit (delete/disable) + restart.
  - **hermes:** set `platforms.<id>.enabled: true` in `~/.hermes/config.yaml` (escaped, deep-merge) + write the secret to `~/.hermes/.env` (e.g. `TELEGRAM_BOT_TOKEN=<TOKEN>`). Verify: `hermes gateway status`. Remove: set enabled:false + restart.
  - **openclaw:** `openclaw channels add --channel <id> --token <TOKEN>` (or `--use-env`) non-interactively (Node-22 sandbox, arg-array). Verify: `openclaw channels status --channel <id> --probe`. Remove: `openclaw channels remove --channel <id> --delete`.
- **Secrets via `Secrets`** (secretRef per channel); tokens never logged. Where a framework requires the token in its config file (zeptoclaw), that's the documented exception; hermes → `.env`, openclaw → `--use-env`/config.
- **Gateway restart is required** after channel changes (no hot-reload) → monitored restart (adapter `restart()` / stop→start→waitUntilHealthy).
- Host Node v16.16.0; openclaw under Node 22; injection-safe (validate channel id + arg-arrays / escaped writes). Existing suite stays green.

## Interfaces (shared across tasks)
```ts
// FrameworkAdapter (src/shared/v2-types.ts) — OPTIONAL (adapters implement incrementally):
listChannels?(): Promise<Array<{ id: string; enabled: boolean; connected?: boolean }>>;
configureChannel?(spec: { id: string; config: Record<string,string>; secrets: Record<string,string> }): Promise<void>;
removeChannel?(id: string): Promise<{ removed: boolean; note?: string }>;
verifyChannel?(id: string): Promise<{ connected: boolean; detail?: string }>;
requiresRestartAfterChannelChange?(): boolean;

// Shared channel catalog (src/shared/channels.ts)
interface ChannelField { key: string; label: string; secret?: boolean; help?: string; placeholder?: string; }
interface ChannelDef { id: string; name: string; kind: "credential"|"qr"|"generic"; fields: ChannelField[]; frameworks: string[]; instructions: string; }
export const CHANNELS: ChannelDef[];   // curated: telegram, slack, discord (+ whatsapp_cloud, signal)

// DB (src/main/database.ts)
recordChannel(c: { deploymentId:string; channelId:string; secretRef:string|null }): void;
getChannels(deploymentId: string): Array<{ channelId:string; secretRef:string|null }>;
removeChannelRecord(deploymentId:string, channelId:string): void;

// IPC + preload + ElectronAPI
configureChannel(deploymentId:string, spec:{ id:string; config:Record<string,string>; secrets:Record<string,string> }): Promise<{ connected:boolean; detail?:string }>;
listChannels(deploymentId:string): Promise<Array<{id:string;enabled:boolean;connected?:boolean}>>;
removeChannel(deploymentId:string, id:string): Promise<{removed:boolean;note?:string}>;
```

---

## Task 1: Channel interface (optional) + catalog + DB
**Files:** `src/shared/v2-types.ts` (optional methods), `src/shared/channels.ts` (new), `src/main/database.ts` (channels table + methods). Test: `tests/main/database.test.ts` (channels roundtrip), `tests/renderer/channel-catalog.test.ts`.
- [ ] Failing tests: db recordChannel/getChannels/removeChannelRecord roundtrip; CHANNELS catalog has telegram/slack/discord with the verified fields (telegram: botToken secret; slack: botToken+signingSecret+appToken; discord: botToken) and correct `frameworks` support.
- [ ] Implement: add the OPTIONAL channel methods to `FrameworkAdapter` (won't break adapters). Create `CHANNELS` catalog from the research doc (curated channels + fields + which frameworks support each + instructions text). Add a `channels` table `(id INTEGER PK, deployment_id, channel_id, secret_ref, created_at)` (guarded migration like extra_json) + the 3 db methods.
- [ ] Verify (`npx vitest run`), build, node -v. Commit `feat(phase2a): channel adapter interface (optional) + channel catalog + channels DB table`.

## Task 2: OpenClaw channel methods
**Files:** `src/main/frameworks/openclaw-adapter.ts` + test. (OpenClaw first — cleanest non-interactive CLI + `--probe` verify → best for the E2E.)
- [ ] Failing tests (inject execWithArgsFn, Node-22 sandbox env asserted):
  - `configureChannel({id:"telegram", config:{}, secrets:{botToken:"T"}})` runs `channels add --channel telegram --token T` (arg-array, sandboxed env); validates id.
  - `verifyChannel("telegram")` runs `channels status --channel telegram --probe`, parses connected true/false from output.
  - `removeChannel("telegram")` runs `channels remove --channel telegram --delete` → `{removed:true}`.
  - `listChannels()` parses `channels list` (enabled/connected).
  - `requiresRestartAfterChannelChange()` → true.
- [ ] Implement per the verified openclaw commands (use `--use-env` option where the secret should be injected rather than written; the plan's default: pass `--token` from the secret, or `--use-env` + set env — pick per the research doc's finding). Injection-safe, no token logged.
- [ ] Verify + build + node16. Commit `feat(phase2a): openclaw channel methods (add/status --probe/remove)`.

## Task 3: Hermes channel methods
**Files:** `src/main/frameworks/hermes-adapter.ts` + test.
- [ ] Failing tests: `configureChannel` sets `platforms.<id>.enabled: true` in config.yaml (escaped, deep-merge preserves model/other keys) AND writes the secret to `~/.hermes/.env` (`TELEGRAM_BOT_TOKEN=<T>` etc.); `verifyChannel` runs `hermes gateway status` and parses running/connected; `removeChannel` sets enabled:false (config-edit) → `{removed:true}`; `requiresRestartAfterChannelChange()` true. (Reuse the existing `escapeYaml` + config-write approach; add `.env` write helper.)
- [ ] Implement per verified hermes format. Secret → `.env` (never main config, never logged).
- [ ] Verify + build + node16. Commit `feat(phase2a): hermes channel methods (config.yaml platforms + .env secret + gateway status)`.

## Task 4: ZeptoClaw channel methods
**Files:** `src/main/frameworks/zeptoclaw-adapter.ts` + test.
- [ ] Failing tests: `configureChannel` deep-merges `channels.<id> = {enabled:true, token:<T>, ...}` into `~/.zeptoclaw/config.json` (preserves other keys); after write, `chmod 600` the config (token is plaintext-in-file — documented exception); `verifyChannel` runs `channel test <id>` / parses `channel list`; `removeChannel` deletes/disables the channel section (config-edit) → `{removed:true}`; `requiresRestartAfterChannelChange()` true.
- [ ] Implement per verified zeptoclaw format. Add a code comment documenting the plaintext-token-in-config exception + the chmod.
- [ ] Verify + build + node16. Commit `feat(phase2a): zeptoclaw channel methods (config.json channels + test/list verify)`.

## Task 5: configure-channel IPC (config → monitored restart → verify)
**Files:** `src/main/ipc-handlers.ts` (exported `handleConfigureChannel`, `handleListChannels`, `handleRemoveChannel`), `src/preload/index.ts`, `src/shared/types.ts`. Test: `tests/main/configure-channel.test.ts`.
- [ ] Failing tests (inject a fake adapter + db + a `restart` monitor):
  - `handleConfigureChannel(deploymentId, spec, deps)`: stores each secret via `secrets.set(\`channel:${deploymentId}:${id}:${field}\`, value)`, calls `adapter.configureChannel({id, config, secrets})`, then if `adapter.requiresRestartAfterChannelChange()` → monitored restart (`adapter.stop()`→`adapter.start()`→ waitUntilHealthy/`status()`), then `adapter.verifyChannel(id)`; records the channel row; returns the verify result. If the adapter lacks channel methods → clear "framework does not support channel setup" error.
  - restart failure / verify:false surfaces (does not falsely report connected).
  - `handleListChannels` / `handleRemoveChannel` (removeChannel + restart + db removeChannelRecord + delete secrets).
- [ ] Implement + register IPC (deps: db, getAdapter from deploymentRegistry, secrets). Preload + ElectronAPI types. No token logged.
- [ ] Verify + build + node16. Commit `feat(phase2a): configure-channel IPC (config→monitored restart→verify) + list/remove`.

## Task 6: Live E2E — OpenClaw + Telegram (docs)
Throwaway/dummy token; no real account. Under isolated Node 22; host node16 guarded.
- [ ] Deploy openclaw + a model; via the engine (not UI): `configureChannel(telegram, {botToken:"<dummy>"})` → monitored gateway restart → `verifyChannel` — capture real output (expect verify to report NOT-connected for a dummy token, which still proves the wire path: add succeeds, restart happens, probe runs). Confirm the secret-injection choice (`--use-env` vs `--token`) works and the token isn't in logs. Confirm `channels list` shows it; `removeChannel` cleans up.
- [ ] Write `docs/research/verified/phase2a-channel-e2e.md` (GO/NO-GO + the exact observed behavior + any adapter fix needed). Guardrail node -v. Commit docs only.

## Task 7: Full-suite verify + spec 2a status
- [ ] `npx vitest run` green + `npm run build` clean; host node16. Update the Phase 2 spec §1 to mark Slice 2a delivered. Commit.

## Notes / Deferrals
- UI (wizard step 7 + Channels surface) = Slice 2b. Long-tail/generic + WhatsApp-web QR = Slice 2c.
- zeptoclaw plaintext-token-in-config is a documented, verified exception (framework requires it); hermes `.env` + openclaw `--use-env` keep tokens out of the main config.
- `verifyChannel` with a dummy token is expected to report not-connected; the E2E validates the WIRE (add→restart→probe), not a live Telegram connection.
