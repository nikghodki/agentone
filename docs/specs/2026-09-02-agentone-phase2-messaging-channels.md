# AgentOne Redesign — Phase 2: Messaging Channels (Design Spec)

**Date:** 2026-09-02
**Status:** Draft for review
**Builds on:** `docs/specs/2026-09-02-agentone-redesign-guided-setup.md` (Phase 1 wizard). Implements the original steps **7–8**: after deploy, set up the messaging channel(s) the installed framework supports, and manage them later.
**Research (source of truth):** `docs/research/verified/framework-messaging-channels.md`.

---

## 1. Goal & Slices

After a framework is deployed, let the user connect messaging channels (Telegram, Slack, Discord, WhatsApp, Signal, …) through a **guided, verified** flow, and manage them anytime. Built in slices:

- **Slice 2a (engine):** adapter channel API + per-framework config-write + monitored gateway restart + verify — proven end-to-end for the common channels on at least one framework.
- **Slice 2b (UI):** the wizard **step 7** (optional, post-deploy) + a **Channels management surface** (list + live status + add/remove).
- **Slice 2c (breadth):** long-tail channels (generic form) + QR/interactive channels (WhatsApp-web guided pairing).

Each slice ships independently and gets its own plan.

## 2. Research-driven realities (must respect)

- **zeptoclaw & hermes channel-setup CLIs are interactive (prompt-driven)** → the app must **write channel config directly** to their config files (zeptoclaw `~/.zeptoclaw/config.json`, hermes `~/.hermes/config.yaml`), NOT drive the interactive CLI. **openclaw** supports **non-interactive** `channels add … <flags>` (preferred) or config write.
- **A gateway restart is required** after any channel change (no hot-reload) → **monitored restart** (stop → start → poll healthy, bounded timeout) — reuse the CapabilityOrchestrator's monitored-restart pattern / adapter `restart()`.
- **Verify-connected is per-framework:** zeptoclaw `channel test <name>` / `channel list`; hermes `gateway status`; openclaw `channels status --channel <name> --probe`.
- **Remove:** openclaw `channels remove --channel <name> --delete` (CLI); zeptoclaw/hermes = config edit (set disabled / delete section) + restart.
- **WhatsApp-web = QR pairing** (interactive) — guide only (Slice 2c); cannot fully automate.
- Support matrix (verified): zeptoclaw 6, hermes 8+, openclaw 30 channels. Common to all: **telegram, slack, discord** (+ whatsapp, signal on most).

## 3. Channel catalog (curated + generic)

A renderer/shared **channel catalog** defines, per channel, its display name, the **required user fields** (from research), which are **secrets**, and which frameworks support it:
```ts
interface ChannelField { key: string; label: string; secret?: boolean; help?: string; placeholder?: string; }
interface ChannelDef {
  id: string;              // "telegram" | "slack" | "discord" | "whatsapp_cloud" | "signal" | ...
  name: string;
  fields: ChannelField[];  // e.g. telegram: [{key:"botToken", secret:true, ...}]
  kind: "credential" | "qr" | "generic";
  frameworks: string[];    // which support it (from the matrix)
  instructions: string;    // where/how to obtain the credentials
}
```
- **credential** channels (telegram/slack/discord/whatsapp_cloud/signal/teams/google_chat/webhook): first-class guided forms.
- **qr** channels (whatsapp_web): guided pairing (Slice 2c).
- **generic**: any framework-listed channel not in the curated catalog → a generic key/value form + "follow framework docs" (Slice 2c).
Curated fields per channel come verbatim from the research doc (e.g. Slack = botToken + signingSecret + appToken).

## 4. Engine — adapter channel API (Slice 2a)

Add to `FrameworkAdapter`:
```ts
listChannels(): Promise<Array<{ id: string; enabled: boolean; connected?: boolean }>>;
configureChannel(spec: { id: string; config: Record<string,string>; secrets: Record<string,string> }): Promise<void>;
removeChannel(id: string): Promise<void>;
verifyChannel(id: string): Promise<{ connected: boolean; detail?: string }>;
requiresRestartAfterChannelChange(): boolean;   // true for all three (per research)
```
Per adapter (using verified commands/config):
- **configureChannel:** write the channel's config section to the framework config file (deep-merge, preserving other keys — reuse the model-config deep-merge approach); non-secret values inline, **secrets kept out of the config file** — see §6. openclaw MAY use `channels add --<flags>` non-interactively instead. Then the caller triggers a monitored restart.
- **verifyChannel:** run the per-framework verify command; parse connected/failed.
- **removeChannel:** openclaw CLI; zeptoclaw/hermes config-edit (disable/delete) — then restart.
- Injection-safe (validate channel id + values via arg-arrays / escaped config writes), no secrets logged.

**Orchestration:** a `configure-channel` IPC: `configureChannel(spec)` → if `requiresRestartAfterChannelChange()` → **monitored restart** (adapter.stop→start→waitUntilHealthy) → `verifyChannel(id)` → return `{connected, detail}`. Mirrors the capability gap→install→restart→resume loop.

## 5. UI (Slice 2b)

- **Wizard step 7 — Connect a channel (optional):** after deploy, show the framework's supported channels (from `listChannels`/the catalog filtered by framework) as `RadioCardGroup`; picking one reveals its guided form (fields from the catalog, secrets masked) + instructions `Callout`; "Connect" → `configureChannel` (progress: "Saving… / Restarting gateway… / Verifying…") → success/failure `Callout`. **Skippable** ("I'll do this later" → Task).
- **Channels management surface** (from Task/settings): list configured channels with **live status** (`verifyChannel`/`listChannels`), **Add channel** (same guided form) and **Remove** (confirm → removeChannel → restart). Uses the Phase 1 UI kit + design tokens.

## 6. Security
Channel secrets (bot tokens, signing secrets, access tokens) are stored via **`Secrets`** (safeStorage) with a `secretRef` per channel field; **never written to the framework config file in plaintext if avoidable** — where a framework requires the secret in its config file to function, document that and set file perms tight; prefer env/secret-store injection where the framework supports it. Secrets never logged. (Slice 2a resolves, per framework, whether the secret can be injected vs must live in the config file; the research doc's per-channel notes drive this.)

## 7. Data
Source of truth for "which channels are configured" = the framework itself via `listChannels()`; the app additionally records a lightweight row per configured channel (reuse the `capabilities`-style pattern or a new `channels` table: deployment_id, channel_id, secretRef(s)) so the UI can show channels + know which secretRefs to manage. Final table shape decided in the Slice 2a plan.

## 8. Testing
- **Engine (2a):** per-adapter `configureChannel` writes the correct config/CLI (arg-array, deep-merge preserves other keys), `verifyChannel` parses connected/failed, `removeChannel` correct; injection-safe; secrets not logged; the configure-channel IPC does config→monitored-restart→verify. Host Node 16; openclaw under Node 22; no real accounts (mock exec/fetch). A live E2E (docs) proves one framework + telegram end-to-end.
- **UI (2b):** channel picker filtered by framework; guided form collects fields; Connect calls the IPC with the right spec; status rendering; add/remove. RTL + jsdom.

## 9. Deferrals / Out of scope
- **QR/interactive channels** (WhatsApp-web) full automation — Slice 2c gives guided pairing only.
- Long-tail openclaw channels beyond the curated catalog — generic form (Slice 2c).
- Inbound message routing / actually chatting via the channel is the framework's job; the app only sets channels up and verifies connectivity.
- Phase 3 (use-case prompt generator) is separate.

## 10. Success Criteria (Phase 2)
A deployed user can pick a supported channel, follow guided instructions, enter credentials, and the app writes the config, restarts the gateway (monitored), and confirms the channel is **connected** — and can manage (add/remove/see status) channels later. Common channels get first-class UX; every supported channel is at least selectable/configurable.
