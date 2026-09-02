# AgentOne Phase 2 — Slice 2b: Channel UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make channel setup usable from the app: an optional **wizard step 7** after deploy (pick a channel → guided form → Connect with staged progress → verify), and a **Channels management surface** (list configured channels + live status + add/remove) from the Task screen. Pure renderer slice on top of the Slice 2a engine.

**Architecture:** A shared `ChannelSetupForm` (catalog-driven fields → `configureChannel` IPC with staged progress + verify result) reused by both the wizard step and the Channels surface. Reuses the Phase 1 UI kit + design tokens, the `CHANNELS` catalog (`src/shared/channels.ts`), and the 2a electronAPI: `configureChannel(deploymentId, spec) → {connected, detail?}`, `listChannels(deploymentId)`, `removeChannel(deploymentId, id)`.

**Tech Stack:** React 18 / TS / Tailwind / Zustand / Vitest + RTL (jsdom). Host Node 16. **Run tests SPLIT** (`vitest run tests/main` + `tests/renderer`) — a combined run hits a known Node-16 V8 teardown flake.

**Spec:** `docs/specs/2026-09-02-agentone-phase2-messaging-channels.md` §5. UI kit: `src/renderer/components/ui/*`. Pattern for the management surface: `src/renderer/pages/CapabilitiesPage.tsx`.

## Global Constraints
- Use the Phase 1 UI kit + design tokens (indigo `primary`, slate, `Card`/`Button`/`Input`/`RadioCardGroup`/`Callout`/`ProgressBar`). No off-palette colors.
- **Catalog-driven:** only offer channels whose `CHANNELS[i].frameworks` includes the deployed framework id (currently just Telegram; Slack/Discord/WhatsApp have `frameworks: []` until Slice 2c — they must NOT appear yet). New channels appear automatically when 2c widens the catalog.
- **Secrets** are entered in masked inputs and passed to `configureChannel`'s `spec.secrets`; never render a secret back, never log it.
- Host Node 16; existing suites stay green (main + renderer, run split).
- Accessibility: labeled inputs, focus rings, keyboard-operable pickers.

## File Structure
- Create: `src/renderer/components/ChannelSetupForm.tsx` (shared form), `src/renderer/pages/wizard/ChannelStep.tsx`, `src/renderer/pages/ChannelsPage.tsx`.
- Modify: `src/renderer/store.ts` (add `"channel"` WizardStep + `"channels"` AppView), `src/renderer/pages/wizard/Wizard.tsx` (route the channel step; deploy → channel), `src/renderer/pages/wizard/DeployStep.tsx` (on success go to the channel step, not straight to task), `src/renderer/App.tsx` (route `"channels"`), `src/renderer/pages/TaskPage.tsx` (a "Channels" link).
- Tests under `tests/renderer/**`.

## Interfaces
```ts
// ChannelSetupForm — shared by wizard step + Channels surface
interface ChannelSetupFormProps {
  deploymentId: string;
  frameworkId: string;                    // to filter the catalog
  onConnected?: (id: string) => void;     // after a successful/attempted connect
}
// It: lists catalog channels for frameworkId (RadioCardGroup) → on pick shows fields (Input, secrets masked) + instructions Callout →
// "Connect" → window.electronAPI.configureChannel(deploymentId, { id, config, secrets }) with a staged ProgressBar
//   ("Saving… / Restarting gateway… / Verifying…") → shows a success/failure Callout from {connected, detail}.
// store: add WizardStep "channel"; AppView "channels".
```

---

## Task 1: `ChannelSetupForm` + wizard step 7 (ChannelStep)
**Files:** `src/renderer/components/ChannelSetupForm.tsx` (new), `src/renderer/pages/wizard/ChannelStep.tsx` (new), `src/renderer/store.ts` (WizardStep `"channel"`), `src/renderer/pages/wizard/Wizard.tsx` (route), `src/renderer/pages/wizard/DeployStep.tsx` (deploy→channel). Test: `tests/renderer/channel-setup-form.test.tsx`, `tests/renderer/wizard-channel-step.test.tsx`.

- [ ] **Failing tests:**
  - ChannelSetupForm: given frameworkId "openclaw", the channel picker lists ONLY catalog channels whose `frameworks` includes "openclaw" (currently telegram; assert slack/discord NOT shown). Picking telegram shows its `botToken` (masked) field + instructions. Clicking Connect calls `window.electronAPI.configureChannel("dep1", {id:"telegram", config:{}, secrets:{botToken:"T"}})`; on `{connected:true}` shows a success Callout; on `{connected:false, detail}` shows a warning Callout with the detail. (Mock electronAPI.)
  - ChannelStep: renders ChannelSetupForm with the current deploymentId + selectedFrameworkId; has a **Skip** action → `setView("task")`; after a connect, a "Continue to app" → `setView("task")`.
  - DeployStep: on successful deploy now navigates to the **channel** wizard step (not directly to task) — adjust its existing test.
- [ ] Run → fail. Implement: add `"channel"` to `WizardStep`; DeployStep success → `setCurrentDeploymentId(dep.id)` + `setWizardStep("channel")` (stay in wizard) instead of `setView("task")`; Wizard routes `"channel"` → `<ChannelStep/>`; ChannelStep composes ChannelSetupForm (deploymentId=currentDeploymentId, frameworkId=selectedFrameworkId) + Skip/Continue → task. ChannelSetupForm filters `CHANNELS` by frameworkId, renders picker + per-field inputs (secret fields masked) + instructions Callout, Connect → configureChannel with a staged ProgressBar + result Callout.
- [ ] Run tests (split) + build. Commit `feat(phase2b): ChannelSetupForm + wizard step 7 (connect a channel, skippable)`.

## Task 2: Channels management surface
**Files:** `src/renderer/pages/ChannelsPage.tsx` (new), `src/renderer/store.ts` (AppView `"channels"`), `src/renderer/App.tsx` (route), `src/renderer/pages/TaskPage.tsx` ("Channels" link). Test: `tests/renderer/channels-page.test.tsx`.
- [ ] **Failing tests:** ChannelsPage on mount calls `listChannels(currentDeploymentId)` and lists channels with status (enabled/connected badges); an **Add channel** control shows the ChannelSetupForm; a **Remove** on a row → confirm → `removeChannel(currentDeploymentId, id)` → refetch. TaskPage has a "Channels" button → `setView("channels")`. Empty state ("No channels connected yet").
- [ ] Run → fail. Implement mirroring `CapabilitiesPage` (loading/empty/error states, UI kit, tokens); reuse `ChannelSetupForm` for Add. App routes `case "channels"`.
- [ ] Run tests (split) + build. Commit `feat(phase2b): Channels management surface (list + status + add/remove)`.

## Task 3: Full-suite verify + spec 2b status
- [ ] Run split suites (`tests/main` + `tests/renderer`) green + `npm run build` clean; host node16.
- [ ] Update Phase 2 spec §1 to mark Slice 2b delivered (2c pending).
- [ ] Commit `docs(phase2): Slice 2b (channel UI) delivered`.

## Notes / Deferrals
- Only Telegram is offered today (catalog `frameworks`); Slack/Discord/WhatsApp appear automatically once Slice 2c widens the catalog + adds per-framework config. WhatsApp-web QR pairing = 2c.
- The wizard step is **optional/skippable** — deploy remains complete without a channel.
- No engine/main changes in 2b (pure renderer); the 2a `configure-channel`/`list-channels`/`remove-channel` IPC is reused as-is.
