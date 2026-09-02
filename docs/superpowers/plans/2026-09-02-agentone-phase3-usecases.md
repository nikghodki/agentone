# AgentOne Phase 3 — Use-Case Prompt Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** ~10 curated, framework-agnostic use cases; each opens a customizable prompt builder (template + fill-in fields → copy-ready prompt). Shown as the final wizard step + a persistent "Get started" surface. Pure renderer — no engine/IPC.

**Spec:** `docs/specs/2026-09-02-agentone-phase3-usecases.md`. UI kit: `src/renderer/components/ui/*`. Patterns: `ChannelSetupForm` (shared component reused by wizard + page), `ChannelsPage`/`CapabilitiesPage` (surface from Task).

**Tech Stack:** React 18 / TS / Tailwind / Zustand / Vitest + RTL (jsdom). Host Node 16. **Run tests SPLIT** (`vitest run tests/main` + `tests/renderer`) — combined run hits the known Node-16 V8 teardown flake.

## Global Constraints
- Phase 1 UI kit + design tokens (indigo `primary`, slate). The light `UseCaseBuilder` on the still-dark Task-side surface uses a light container (as ChannelsPage does for its Add form).
- Pure renderer: no main-process/IPC/DB changes.
- Copy via `navigator.clipboard.writeText` with a graceful fallback (e.g. a selectable textarea) — jsdom lacks clipboard, so tests inject/spy a clipboard mock.
- Host Node 16; existing suites (main 309 / renderer 97) stay green (run split). A11y: labeled inputs, focus rings, keyboard-operable card picker.

## File Structure
- Create: `src/shared/use-cases.ts` (catalog + `buildPrompt`), `src/renderer/components/UseCaseBuilder.tsx`, `src/renderer/pages/wizard/UseCaseStep.tsx`, `src/renderer/pages/UseCasesPage.tsx`.
- Modify: `src/renderer/store.ts` (WizardStep `"use-case"`, AppView `"use-cases"`), `src/renderer/pages/wizard/Wizard.tsx` (route + channel→use-case), `src/renderer/pages/wizard/ChannelStep.tsx` (Continue/Skip → use-case step instead of task), `src/renderer/App.tsx` (route `"use-cases"`), `src/renderer/pages/TaskPage.tsx` ("Get started" link).

## Interfaces
```ts
// src/shared/use-cases.ts
interface UseCaseField { key:string; label:string; type:"text"|"textarea"|"select"; placeholder?:string; options?:string[]; optional?:boolean; }
interface UseCase { id:string; title:string; description:string; category:string; fields:UseCaseField[]; template:string; }
export const USE_CASES: UseCase[];
export function buildPrompt(uc: UseCase, values: Record<string,string>): string;   // pure: substitute {key}
// UseCaseBuilder props: { onDone?: () => void }  (self-contained: picks from USE_CASES, builds, copies)
```

---

## Task 1: Catalog + `buildPrompt` + `UseCaseBuilder`
**Files:** `src/shared/use-cases.ts` (new), `src/renderer/components/UseCaseBuilder.tsx` (new). Tests: `tests/renderer/use-cases.test.ts` (buildPrompt), `tests/renderer/use-case-builder.test.tsx` (RTL).

- [ ] **Failing tests:**
  - `buildPrompt`: substitutes `{topic}` etc. with values; an OPTIONAL empty field collapses without leaving a literal `{key}` or dangling punctuation; a required field's value appears. No leftover `{}` for provided fields.
  - `USE_CASES` has ~10 entries, each with id/title/description/fields/template; every `{placeholder}` in a template has a matching field `key` (no orphan placeholders) — assert this invariant across the catalog.
  - `UseCaseBuilder` (RTL, clipboard mock): renders the use-case cards; picking one shows its fields; typing updates a visible prompt preview (assert the assembled text appears); clicking **Copy** calls `navigator.clipboard.writeText` with the assembled prompt and shows a "Copied" confirmation.
- [ ] Run → fail. Implement: the ~10 curated use cases from the spec §2 (framework-agnostic; each 1–4 fields + a template using only its field keys); `buildPrompt` (trim values, drop optional-empty cleanly, no orphan `{}`); `UseCaseBuilder` (RadioCardGroup/card grid → fields via UI kit Input/Textarea/Select → live preview via buildPrompt → Copy w/ clipboard + fallback + "Copied" state + a "paste to your agent" hint). Design tokens.
- [ ] Run tests (split) + build. Commit `feat(phase3): use-case catalog + buildPrompt + UseCaseBuilder`.

## Task 2: Wizard step + Get-started surface + wiring
**Files:** `src/renderer/pages/wizard/UseCaseStep.tsx` (new), `src/renderer/pages/UseCasesPage.tsx` (new), `store.ts`, `Wizard.tsx`, `ChannelStep.tsx`, `App.tsx`, `TaskPage.tsx`. Test: `tests/renderer/use-case-step-and-page.test.tsx`.

- [ ] **Failing tests:**
  - Store: `WizardStep` includes `"use-case"`; `AppView` includes `"use-cases"`.
  - `UseCaseStep` renders `UseCaseBuilder` + a **Finish** action → `setView("task")`.
  - Channel step now advances to the `use-case` wizard step on Continue (and Skip on the channel step → still goes to use-case OR task — spec: channel Skip → task is fine; channel Continue-to-app → use-case). Assert the channel step routes forward to `use-case` (adjust its test).
  - `UseCasesPage` renders `UseCaseBuilder`; reachable via a TaskPage "Get started" button → `setView("use-cases")`.
- [ ] Run → fail. Implement: add the store step/view; `UseCaseStep` (UseCaseBuilder inside the wizard layout + Finish→task; wrap in light container consistent with wizard's light theme — the wizard is already light, so no wrapper needed there); Wizard routes `"use-case"`; ChannelStep's Continue-to-app → `setWizardStep("use-case")` (Skip → task remains); `UseCasesPage` (light container for the builder on the dark Task surface, like ChannelsPage) + App route + TaskPage "Get started" button.
- [ ] Run tests (split) + build. Commit `feat(phase3): use-case wizard step + Get-started surface + wiring`.

## Task 3: Full-suite verify + spec status
- [ ] Split suites (`tests/main` + `tests/renderer`) green + `npm run build` clean; host node16.
- [ ] Mark Phase 3 delivered in the spec §1.
- [ ] Commit `docs(phase3): use-case prompt generator delivered`.

## Notes / Deferrals
- The app does NOT send the prompt (user copies + sends via their channel) — per requirement.
- Per-framework-tailored use cases = possible follow-up (generic set now).
- Task/UseCasesPage remain dark (light builder wrapped in a light container); full dark→light re-theme is the standing redesign follow-up.
