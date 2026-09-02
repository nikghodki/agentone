# AgentOne — Visual Redesign & Guided Setup (Design Spec)

**Date:** 2026-09-02
**Status:** Draft for review
**Builds on:** `docs/specs/2026-08-31-agentone-v2-design.md` (v2 launcher). This spec redesigns the **UX/UI** and restructures onboarding into a **guided wizard**. It does not change the framework/model/capability engine already built.

---

## 1. Goal

A modern, professional, **light & approachable** desktop UX with a single **guided setup wizard** that walks a user from "nothing" to "a deployed agent they can talk to." Delivered in phases:

- **Phase 1 (this spec):** visual design system + wizard steps **1–6** (framework → config → model → deploy) and **10** (remove/switch).
- **Phase 2 (later):** messaging-channel setup (steps 7–8).
- **Phase 3 (later):** use-case prompt generator (step 9).

The full 10-step flow is summarized in §7 for context; only Phase 1 is specified in detail here.

---

## 2. Visual Design System (light & approachable)

A small, reusable token set + component kit, built on the existing Tailwind 3 setup (extend `tailwind.config`). Reskin only — React structure is preserved.

**Color tokens (Tailwind palette anchors):**
- App background: `slate-50` (#F8FAFC). Surfaces/cards: `white`.
- Text: primary `slate-900`, secondary `slate-500`, disabled `slate-400`.
- Borders/dividers: `slate-200`.
- **Primary accent: `indigo-600`** (#4F46E5), hover `indigo-700`, subtle bg `indigo-50`.
- Semantic: success `emerald-600`, warning `amber-500`, error `rose-600`, each with a `-50` tint for callouts.

**Shape & depth:** cards `rounded-2xl` + `shadow-sm` (hover `shadow-md`); inputs/buttons `rounded-lg`; generous padding (`p-6`/`p-8`), consistent `gap-4/6` rhythm.

**Typography:** Inter (bundled/`@fontsource`) with `system-ui` fallback. Hierarchy: page/step title `text-2xl font-semibold`, section `text-lg font-medium`, body `text-sm text-slate-700`, helper `text-xs text-slate-500`.

**Component kit** (`src/renderer/components/ui/`): `Card`, `Button` (`primary`|`secondary`|`ghost`|`danger`), `Input`, `Select`, `Textarea` (all with label + helper/error), `RadioCardGroup` (large selectable cards), `StepProgress` (numbered steps header), `Callout` (`info`|`warning`|`success`), `ProgressBar`, `Badge`. Each is a small typed component with consistent props; pages compose these instead of ad-hoc Tailwind.

**Accessibility:** visible focus rings (`ring-2 ring-indigo-500`), labels tied to inputs, sufficient contrast (WCAG AA on slate/indigo), keyboard-navigable radio cards.

---

## 3. Wizard Architecture

**`WizardLayout`** (`src/renderer/components/WizardLayout.tsx`): a fixed **StepProgress** header, a scrollable content area, and a footer with **Back** / **Continue** (+ contextual primary label like "Install & Deploy"). Hosts the current step component. Consistent max-width (`max-w-3xl`) centered.

**State (Zustand store, extend existing):** a `wizard` slice —
```ts
type WizardStep = "framework" | "framework-config" | "model-location"
  | "model-local" | "model-cloud" | "deploy" | "done";
interface WizardState {
  step: WizardStep;
  frameworkId: string | null;
  frameworkConfig: Record<string, unknown>;   // optional advanced settings (empty by default)
  modelBackendDraft: ModelBackendDraft;         // reuse existing draft shape
  cloudForm: { apiKey; resourceUrl; deployment; apiVersion; region; accessKeyId; secretAccessKey; ... };
  deploymentId: string | null;
}
```
Navigation is linear with branch at model-location (local → `model-local`, cloud → `model-cloud`), both converging on `deploy`. `setWizardStep`, `patchWizard(partial)` actions. On first run `view` opens the wizard (replacing the current direct `v2-framework-select` page); once a deployment exists the app opens the Task surface.

**Reuse (no main-process changes):** `getFrameworks`, `saveModelBackend(draft, secret)`, `deployFramework(frameworkId, backendId)`, `getDeployments`, `onTaskToken`/`onTaskStatus`, and the model-download/framework-install progress channel. `buildSaveArgs` (renderer) is reused to assemble the cloud/local payload.

---

## 4. Phase 1 Steps

### Step 1 — Choose framework
`RadioCardGroup` of 3 cards from `FRAMEWORKS`: name, one-line tagline, **top-5 features**, and a **"Recommended" `Badge`** on the default (`isDefault` → zeptoclaw). Selecting one enables Continue. (Modern redesign of today's `FrameworkSelectPage`.)

### Step 2 — Framework configuration
Per verified research (`docs/research/verified/framework-setup-config.md`), **no framework requires config beyond the model.** So this step is a concise confirmation:
- Callout: "**<Framework>** needs no extra setup — we'll use recommended defaults (loopback, auto-generated tokens, auto workspace)."
- Optional collapsible **"Advanced (optional)"**: a persona/system-prompt `Textarea` (written to the framework's persona file — SOUL.md / IDENTITY.md) and a gateway **port** `Input`. Left empty → defaults. Values collected into `frameworkConfig` and applied at deploy (see §6). Advanced is closed by default; most users click Continue straight through.

### Step 3 — Model: local or cloud?
`RadioCardGroup`, two options with plain-language explanations:
- **Local model** — "Runs privately on your machine. No account or key needed."
- **Cloud model** — "Use a hosted provider with your own API key. Faster, larger models."

### Step 4 — Local model (branch)
`RadioCardGroup`:
- **Recommended default** (preselected) — managed Ollama + a curated small model; zero decisions.
- **Choose a model** — a list of curated local models to pick from.
- **Custom endpoint** — for a model hosted elsewhere: `Input` base URL + API key + protocol `Select` (`v1/chat/completions` | `v1/messages`).
Produces a `modelBackendDraft` (`kind: "ollama"|"llamacpp"|"custom"`).

### Step 5 — Cloud model (branch)
Provider `Select`: **Anthropic, OpenAI, OpenRouter, Azure OpenAI, Amazon Bedrock**. On select, show a **guided `Callout`** with concise, correct instructions + a "where to get your key" link, then the provider-specific fields:
- Anthropic/OpenAI/OpenRouter: API key.
- Azure: resource URL + deployment + api-version + api-key.
- Bedrock: region + Access Key ID + Secret Access Key.
`buildSaveArgs` assembles `draft.extra` + `secret` exactly as the existing `ModelBackendPage` does.

### Step 6 — Deploy
Primary action "Install & Deploy". Calls `saveModelBackend(draft, secret)` → `deployFramework(frameworkId, backendId)`. Shows a **staged ProgressBar**: "Installing <framework>…" → "Configuring model…" → "Starting…" using the existing progress/status channels (and applies `frameworkConfig` advanced values — persona file, port — as part of configure). On success → Task surface; on failure → a clear `Callout` with the error + Retry.

### Step 10 — Remove / switch framework
A **"Switch framework"** action (in the Task header and Settings): confirm dialog → teardown the current deployment (adapter `stop()`, best-effort uninstall, delete the deployment + its capabilities) → reset `wizard` state → open Step 1. Reuses the deploy/stop plumbing; the teardown IPC is `removeDeployment(deploymentId)` (new thin handler: stop adapter, delete deployment row) — the only new main-process surface in Phase 1.

---

## 5. Data & Reuse
- Renderer-heavy: new `components/ui/*`, `WizardLayout`, step components under `src/renderer/pages/wizard/`, store `wizard` slice; `App.tsx` routes the wizard.
- Main process: unchanged except one thin `remove-deployment` IPC (Step 10) — stop adapter + `db` delete deployment/capabilities.
- Persona/port advanced values (Step 2) are applied via the existing adapter `configure()` path; if wiring them requires an adapter tweak, that is a small, isolated change scoped in the plan (default path — empty config — needs no adapter change).

---

## 6. Testing
- **Component/logic tests (RTL + Vitest, jsdom):** each step renders and advances; RadioCardGroup selection; `buildSaveArgs` per provider (exists); wizard store transitions (local vs cloud branch → deploy); Step 6 calls save+deploy with the right args; Step 10 teardown calls remove-deployment.
- **Main:** `remove-deployment` handler unit test (stops adapter, deletes rows).
- Host Node 16 for tests; existing suite stays green. No secrets in logs (reuse the vetted secret path).

---

## 7. Full Flow (context — Phases 2 & 3, not specified here)
7. **Messaging channel setup** — after deploy, ask which channel to set up, per what the installed framework supports (Telegram/Slack/Discord/WhatsApp/Signal/email). *(Phase 2 — needs per-framework channel research.)*
8. **Channel walkthrough** — guided setup for the chosen channel (tokens, bot creation, etc.). *(Phase 2.)*
9. **Use-cases** — show ~10 use cases the agent can help with; selecting one generates a copy-paste prompt to send via the channel. *(Phase 3 — needs per-framework use-case research.)*

---

## 8. Out of Scope / Deferrals (Phase 1)
- Messaging channels (Phase 2) and use-cases (Phase 3).
- Dark mode / theme switching (ship light only).
- The v1 persona/Ollama "setup" flow is retired as the entry (already changed); its pages remain in the tree but are not part of the wizard.
- No change to the framework/model/capability engine, adapters, or the packaging pipeline.

---

## 9. Success Criteria (Phase 1)
A first-run user sees a modern light UI, picks a framework (3 feature cards), passes a no-friction config step, sets up a local or cloud model with guided help, watches a clear deploy progress, and lands on the Task surface — and can "Switch framework" to redo the flow. Existing tests green; new component/logic tests cover the wizard.
