# AgentOne Phase 2 — Slice 2c: Channel Breadth (Slack + Discord + WhatsApp-web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Widen messaging-channel support beyond Telegram to **Slack** and **Discord** on all three frameworks, and add **WhatsApp-web** as a guided QR-pairing walkthrough. Only verified config formats — no invented keys.

**Architecture:** Mostly catalog-driven (`src/shared/channels.ts` `frameworks[]` arrays) reusing the Slice 2a/2b engine + `ChannelSetupForm`. Two adapters need per-channel code for their documented asymmetries: **zeptoclaw slack** (bot_token + app_token, no signing secret) and **hermes discord** (top-level `discord:` section, not `platforms.discord`). WhatsApp-web is a new `kind:"qr"` guided flow in `ChannelSetupForm` (no credential write, no automation).

**Tech Stack:** Electron 23 / React 18 / TS / better-sqlite3 / Zustand / Vitest + RTL (jsdom). Host Node 16; openclaw-touching adapter tests mock exec (no live run). **Run tests SPLIT** (`vitest run tests/main` + `tests/renderer`).

**Spec:** `docs/specs/2026-09-02-agentone-phase2-messaging-channels.md` §1 (Slice 2c). **Verified research (binding source of truth):** `docs/research/verified/framework-messaging-channels.md` — the "Channel Write-Format (Slice 2a)" section (lines ~920–1546). All keys below are copied verbatim from it.

## Global Constraints
- **No invented config keys/flags/paths.** Only the verified formats copied below. Anything not covered = out of scope (see Deferrals), never a guess.
- **Secrets** via the existing `Secrets`/`secretRef` path used by 2a; entered masked; never rendered back; never logged; never written to DB. Reuse each adapter's established secret handling (zeptoclaw plaintext-in-config chmod 600 — documented exception; hermes → `.env`; openclaw → `--use-env`).
- Injection-safe (arg-arrays / escaped config writes); loopback only; monitored gateway restart after channel change (reuse 2a orchestration — unchanged).
- Host Node 16; existing suites green (main 337 / renderer 132, run split). Adapter tests mock exec/fs; NO live framework runs, NO mutation of real `~/.hermes` `~/.zeptoclaw` `~/.openclaw`.

## Verified formats (verbatim — the ONLY writes permitted)
**SLACK**
- hermes: YAML `platforms.slack.enabled: true`; `.env`: `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`. (generic `platforms.<id>` path already correct.)
- openclaw: `openclaw channels add --channel slack --use-env` reading env `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`. (generic path already correct + tested.)
- zeptoclaw: config.json `channels.slack.{enabled:true, bot_token:"xoxb-…", app_token:"xapp-…"}` — **app-level token (socket mode), NO signing secret.** (needs per-channel code — Task 2.)

**DISCORD**
- openclaw: `openclaw channels add --channel discord --use-env` reading env `DISCORD_BOT_TOKEN`. (generic path already correct + tested.)
- zeptoclaw: config.json `channels.discord.{enabled:true, token:"<bot token>"}` (single token). (generic path already handles single-token.)
- hermes: **TOP-LEVEL `discord:` section (NOT under `platforms.`)** with `discord.{require_mention, auto_thread, reactions, free_response_channels}` defaults; `.env`: `DISCORD_BOT_TOKEN`. (needs per-channel code — Task 3.)

**WHATSAPP-WEB** (all frameworks): QR/interactive pairing, guided-only, NO programmatic write-format. `kind:"qr"`. Pairing is driven by the framework's own CLI (`hermes whatsapp` / `openclaw channels login --channel whatsapp` / zeptoclaw `channel setup whatsapp_web`) which shows a QR the user scans; the app only guides + can best-effort verify via the existing per-framework verify command. (Task 4.)

## File Structure
- Modify: `src/shared/channels.ts` (frameworks[] for slack/discord; slack field set; add whatsapp_web).
- Modify: `src/main/frameworks/zeptoclaw-adapter.ts` (slack per-channel write).
- Modify: `src/main/frameworks/hermes-adapter.ts` (discord top-level write + listChannels reads top-level discord).
- Modify: `src/renderer/components/ChannelSetupForm.tsx` (branch on `kind`; qr guided flow).
- Tests: the corresponding `tests/main/{zeptoclaw,hermes}-adapter.test.ts`, `tests/renderer/channel-catalog.test.ts`, `tests/renderer/channel-setup-form.test.tsx`.

---

## Task 1: Catalog — expose Slack + Discord; refine Slack fields; add WhatsApp-web (qr)
**Files:** `src/shared/channels.ts`. Test: `tests/renderer/channel-catalog.test.ts` (extend).

- [ ] **Failing tests:**
  - `slack.frameworks` deep-equals `["openclaw","zeptoclaw","hermes"]` (order not asserted — use a set/`toContain` for each); `discord.frameworks` contains all three.
  - `slack.fields` keys are `botToken`(secret), `appToken`(secret), `signingSecret`(secret, `optional:true`) — assert `signingSecret` is marked optional (with help noting it's for hermes/openclaw, not zeptoclaw). `discord.fields` = `botToken`(secret).
  - A `whatsapp_web` ChannelDef EXISTS with `kind:"qr"`, `frameworks` containing all three, `fields: []`, and non-empty `instructions`.
  - Catalog invariant test still passes for all entries (id/name/kind/fields/frameworks/instructions present).
- [ ] Run → fail. Implement: set `slack.frameworks` + `discord.frameworks` to all three; add `appToken` + mark `signingSecret` optional on slack (keep `ChannelField.optional?` — add to the interface if absent, matching v2 field-optional convention); add the `whatsapp_web` entry (`kind:"qr"`, fields `[]`, instructions describing scan-the-QR pairing). Do NOT touch whatsapp_cloud (stays `frameworks: []`).
- [ ] Run tests (split) + build. Commit `feat(phase2c): catalog exposes slack+discord (all frameworks) + whatsapp_web qr`.

## Task 2: zeptoclaw — Slack per-channel write (bot_token + app_token)
**Files:** `src/main/frameworks/zeptoclaw-adapter.ts`. Test: `tests/main/zeptoclaw-adapter.test.ts` (extend).

**Interfaces:** Consumes the 2a `configureChannel(spec:{id,config,secrets})` seam (unchanged signature).

- [ ] **Failing tests:**
  - `configureChannel({id:"slack", config:{}, secrets:{botToken:"xoxb-B", appToken:"xapp-A"}})` writes `config.json` `channels.slack = { enabled:true, bot_token:"xoxb-B", app_token:"xapp-A" }` — assert BOTH keys present, `enabled:true`, and NO `token` key and NO `signing_secret` key. chmod 600 still applied. Other config keys (providers/agents/channels.telegram if seeded) preserved.
  - discord unchanged: `configureChannel({id:"discord", secrets:{botToken:"T"}})` still writes `channels.discord = { enabled:true, token:"T" }` (single token, existing generic behavior) — assert it did NOT regress.
- [ ] Run → fail. Implement: in `configureChannel`, branch on `spec.id === "slack"` to build `{ enabled:true, bot_token: secrets.botToken, app_token: secrets.appToken }` (omit undefined) instead of the single-`token` shape; keep the generic single-`token` path for all other ids (telegram/discord). Deep-merge + chmod 600 unchanged.
- [ ] Run tests (split) + build. Commit `feat(phase2c): zeptoclaw slack config (bot_token+app_token)`.

## Task 3: hermes — Discord top-level `discord:` section + listChannels sees it
**Files:** `src/main/frameworks/hermes-adapter.ts`. Test: `tests/main/hermes-adapter.test.ts` (extend + FIX the contradictory fixture).

- [ ] **Failing tests:**
  - `configureChannel({id:"discord", config:{}, secrets:{botToken:"T"}})` writes a **TOP-LEVEL** `discord:` YAML section (NOT `platforms.discord`) with `discord.require_mention/auto_thread/reactions` defaults and does NOT add `platforms.discord`; the bot token goes to `.env` as `DISCORD_BOT_TOKEN=T` (never in config.yaml). Existing `platforms.*` (e.g. a seeded telegram/slack) + `model.*` preserved.
  - slack unchanged: `configureChannel({id:"slack",...})` still writes `platforms.slack.enabled:true` + env `SLACK_*` (no regression).
  - `listChannels()` returns a `discord` entry when the config has a top-level `discord:` section (currently `parseChannelsFromYaml` reads only `platforms.*`, so a correct discord section is invisible — fix it to ALSO detect top-level `discord:`). Assert both a `platforms.slack` and a top-level `discord` are listed.
  - **FIX** the existing test fixture that (incorrectly) placed `discord:` under `platforms:` in a listChannels fixture — move it to top-level to match the verified format; ensure the assertion still checks discord is listed.
- [ ] Run → fail. Implement: in `configureChannel`, branch `spec.id === "discord"` → write/merge a top-level `discord:` section (preserve existing sub-keys; set the documented defaults only if absent) + `DISCORD_BOT_TOKEN` to `.env`; all other ids keep the `platforms.<id>` path. Extend `parseChannelsFromYaml`/`listChannels` to also surface a top-level `discord:` section as a channel. `removeChannel` for discord: disable/remove the top-level `discord:` section (mirror the platforms path). Keep verify (gateway-level) as-is.
- [ ] Run tests (split) + build. Commit `feat(phase2c): hermes discord top-level section + listChannels`.

## Task 4: ChannelSetupForm — branch on `kind`; WhatsApp-web guided QR flow
**Files:** `src/renderer/components/ChannelSetupForm.tsx`. Test: `tests/renderer/channel-setup-form.test.tsx` (extend).

- [ ] **Failing tests:**
  - Selecting a `kind:"credential"` channel (telegram/slack/discord) still renders the field inputs + Connect calling `configureChannel` (existing behavior — assert no regression; slack now shows botToken+appToken+optional signingSecret; the optional field does NOT gate the Connect button).
  - Selecting the `whatsapp_web` (`kind:"qr"`) channel renders a **guided pairing walkthrough** (the `instructions`, framework-specific pairing hint) and NO secret inputs; instead of "Connect" it offers a guided action (e.g. "Start pairing" → calls `configureChannel({id:"whatsapp_web", config:{}, secrets:{}})` to kick the framework's pairing, then a Callout to scan the QR in the framework, and a "Check status" that calls the verify path) — assert the qr branch does NOT render `<input>` secret fields and shows the pairing instructions.
  - Slack optional-field gating: the Connect button is enabled with botToken+appToken filled even when the optional signingSecret is blank (assert `optional` fields don't block submit).
- [ ] Run → fail. Implement: read `selectedChannel.kind`; for `"qr"` render the guided walkthrough branch (instructions + pairing/verify actions, no credential inputs); for `"credential"` keep the current form but make the Connect-enabled predicate ignore `optional` fields (`fields.filter(f=>!f.optional).some(f=>!values[f.key])`). Reuse UI kit + tokens (light theme). Keep the framework-filter (`ch.frameworks.includes(frameworkId)`).
- [ ] Run tests (split) + build. Commit `feat(phase2c): ChannelSetupForm qr guided flow + optional-field handling`.

## Task 5: Full-suite verify + spec 2c status + deferrals doc
- [ ] Split suites (`tests/main` + `tests/renderer`) green + `npm run build` clean; host node16.
- [ ] Update Phase 2 spec §1 Slice 2c → DELIVERED (with the exact scope: slack+discord all frameworks, whatsapp_web guided QR) and record DEFERRALS explicitly: whatsapp_cloud (documented but per-channel multi-field + verify format unverified), long-tail openclaw channels (generic form), and live re-verification of zeptoclaw `channel test`/`channel list` real output + hermes per-channel verify (kept as documented best-effort; hermes verify is gateway-level).
- [ ] Commit `docs(phase2): Slice 2c (slack/discord/whatsapp-web) delivered`.

## Deferrals / Out of scope (verified-gap or lower-value — do NOT build here)
- **whatsapp_cloud** (all frameworks): openclaw NOT SUPPORTED; hermes (`platforms.whatsapp-cloud` + `WHATSAPP_CLOUD_*` env) and zeptoclaw (`channels.whatsapp_cloud.*` 4 fields) formats ARE documented but need per-channel multi-field adapter code and their verify format is unverified → separate future slice.
- **Long-tail openclaw channels** (signal/imessage/teams/…): generic form, future.
- **Live parser re-verification:** zeptoclaw `channel test`/`channel list` real status columns and hermes per-channel connectivity are not verified against live output; the existing channel-agnostic parsers are kept as best-effort. verifyChannel generalizes to slack/discord for free (agnostic), with hermes remaining gateway-level.
