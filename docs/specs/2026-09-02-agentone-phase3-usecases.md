# AgentOne Redesign — Phase 3: Use-Case Prompt Generator (Design Spec)

**Date:** 2026-09-02
**Status:** DELIVERED (2026-09-02)
**Implements:** original step 9 — once an agent is set up, show ~10 use cases it can help with; selecting one helps craft a copy-paste prompt the user sends to the agent via their messaging channel.
**Builds on:** Phase 1 wizard + UI kit; Phase 2 channels.

## 1. Goal & decisions
A **generic, curated** set of ~10 framework-agnostic agent use cases; each opens a **customizable prompt builder** (template + a few fill-in fields → an assembled, copy-ready prompt). Surfaced both as the **final wizard step** (after channel setup) and a persistent **"Get started" surface** from the Task screen. **Pure renderer** — no engine/IPC, no per-framework research.

## 2. Data — use-case catalog (`src/shared/use-cases.ts`)
```ts
interface UseCaseField { key: string; label: string; type: "text"|"textarea"|"select"; placeholder?: string; options?: string[]; optional?: boolean; }
interface UseCase {
  id: string; title: string; description: string; category: string;
  fields: UseCaseField[];
  template: string;   // contains {fieldKey} placeholders
}
export const USE_CASES: UseCase[];   // ~10 curated, framework-agnostic
```
Curated set (framework-agnostic; final list in the plan): e.g. **Research a topic**, **Summarize a document/URL**, **Draft an email/message**, **Write & explain code**, **Debug an error**, **Plan a project/checklist**, **Brainstorm ideas**, **Analyze data/CSV**, **Rewrite/tone-adjust text**, **Answer questions from notes**. Each has 1–4 fields (topic, tone, length, language, etc.) and a template like `Research {topic} and give me {depth} with sources.`

## 3. Prompt assembly
`buildPrompt(useCase, values) → string`: substitute `{key}` with the user's value (trimmed); required-but-empty fields left as a readable placeholder or the field is required before Copy enables; optional empty fields collapse cleanly. Pure function, unit-tested (deterministic; no framework logic).

## 4. UI
- **`UseCaseBuilder`** (shared component): a card grid of `USE_CASES` (title + description, `RadioCardGroup`/cards) → on pick, render the use case's `fields` (Input/Textarea/Select from the UI kit) → a **live prompt preview** (read-only, monospace) → **Copy** button (`navigator.clipboard.writeText` + copied-confirmation, with a fallback). A hint: "Paste this to your agent in <channel/your messaging app>." Reused by both surfaces.
- **Wizard final step (`UseCaseStep`)**: after the channel step; shows `UseCaseBuilder` + a **Finish** action → Task. Skippable.
- **Get-started surface (`UseCasesPage`)**: reachable from Task ("Get started" / "Use cases" button); same `UseCaseBuilder`, revisitable anytime.

## 5. Wiring
- Store: add wizard step `"use-case"` (after `"channel"`), AppView `"use-cases"`.
- Wizard: `channel` step's "Continue" → `use-case` step (Skip on the channel step still → task; use-case step Finish → task). App routes `"use-cases"`; TaskPage gets a "Get started" link.
- No main-process/IPC changes.

## 6. Testing
- `buildPrompt` unit tests (substitution, optional/empty fields, no leftover `{}`).
- `UseCaseBuilder` RTL: pick a use case → fields render → filling them updates the preview → Copy calls clipboard with the assembled prompt.
- Wizard use-case step (Finish→task) + UseCasesPage (from Task) render/nav.
- Host Node 16; run suites **split** (main + renderer; combined `vitest` hits the known Node-16 V8 teardown flake). UI kit + tokens.

## 7. Out of scope / deferrals
- Sending the prompt from the app (the user copies + sends via their channel — matches the requirement). No agent round-trip.
- Per-framework tailored use cases (generic set now; a per-framework pass is a possible follow-up).
- The light form on the still-dark Task/UseCasesPage surface uses a light container (as with ChannelsPage) until the broader dark→light re-theme follow-up.

## 8. Success criteria
A set-up user sees ~10 use cases, picks one, fills a couple of fields, and copies a tailored prompt to paste to their agent — from the end of the wizard and anytime via the Get-started surface.
