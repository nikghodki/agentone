# AgentOne — Per-Framework Tailored Use Cases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** On top of the ~10 generic (universal) use cases, add a SMALL set of **framework-tailored** use cases — each grounded in a VERIFIED distinctive capability of that framework — and filter what `UseCaseBuilder` shows by the currently-selected framework (universal + the ones tailored to it).

**Architecture:** Pure renderer. Add an optional `frameworks?: string[]` to the `UseCase` type (absent/empty = universal, shown for every framework). Add 3 tailored use cases. `UseCaseBuilder` reads `selectedFrameworkId` from the store and filters. No engine/IPC/DB changes; `buildPrompt` unchanged.

**Tech Stack:** React 18 / TS / Tailwind / Zustand / Vitest + RTL (jsdom). Host Node 16. **Run tests SPLIT** (`vitest run tests/main` + `tests/renderer`).

**Spec:** Extends Phase 3 (`docs/specs/2026-09-02-agentone-phase3-usecases.md`) which explicitly lists "per-framework tailored use cases" as the follow-up. This plan is the design of record.

## Global Constraints
- **No invented framework capabilities.** The ONLY tailored use cases permitted are the 3 below, each grounded in a cited verified feature. Do NOT add others; do NOT tailor a use case to a framework that lacks the verified capability.
  - **hermes → "Browse a live web page"** — grounded: hermes bundles real browser tools (Playwright Chromium + Browser Use CLI), `docs/research/verified/hermes-agent.md:35-36`.
  - **zeptoclaw → "Remember something for later"** — grounded: zeptoclaw `memory` command "Manage long-term memory", `docs/research/verified/zeptoclaw.md:51`.
  - **openclaw → "Automate a terminal task"** — grounded: openclaw terminal tool / `openclaw agent exec`, `docs/research/verified/openclaw-o4-terminal-tool-spike.md`.
- The 10 existing generic use cases stay UNIVERSAL (no `frameworks` field) and unchanged.
- `buildPrompt` invariant preserved: every `{placeholder}` in a template has a matching field `key` (no orphan placeholders) — assert across the whole catalog incl. the new entries.
- Framework context = the store's `selectedFrameworkId` (set in the wizard, persists to the Task-side surfaces; default `"zeptoclaw"`). Host Node 16; existing suites green (main 346 / renderer 143, run split). Light UI kit + tokens.

## File Structure
- Modify: `src/shared/use-cases.ts` (`frameworks?` on `UseCase`; 3 new entries).
- Modify: `src/renderer/components/UseCaseBuilder.tsx` (read `selectedFrameworkId`; filter; optional "Tailored for <name>" affordance).
- Tests: `tests/renderer/use-cases.test.ts` (catalog invariants + filtering helper), `tests/renderer/use-case-builder.test.tsx` (framework filtering in the UI).

## Interfaces
```ts
// src/shared/use-cases.ts
export interface UseCase {
  id: string; title: string; description: string; category: string;
  fields: UseCaseField[]; template: string;
  frameworks?: string[];   // absent/empty = universal (shown for all frameworks)
}
// pure helper (unit-testable without RTL):
export function useCasesForFramework(frameworkId: string): UseCase[]; // universal + those whose frameworks includes frameworkId
```

---

## Task 1: `frameworks?` field + 3 tailored use cases + filter helper
**Files:** `src/shared/use-cases.ts`. Test: `tests/renderer/use-cases.test.ts` (extend).

- [ ] **Failing tests:**
  - Every existing generic use case has NO `frameworks` field (still universal). `USE_CASES` length is now 13 (10 + 3).
  - The 3 tailored entries exist with the exact ids/frameworks: `browse-url` (frameworks `["hermes"]`), `remember-info` (`["zeptoclaw"]`), `terminal-task` (`["openclaw"]`); each has fields + a template whose every `{placeholder}` has a matching field key (extend the existing no-orphan-placeholder invariant test to cover all 13).
  - `useCasesForFramework("hermes")` returns all 10 universal + `browse-url`, and does NOT include `remember-info`/`terminal-task`. `useCasesForFramework("zeptoclaw")` includes `remember-info` only (of the tailored). `useCasesForFramework("openclaw")` includes `terminal-task` only. `useCasesForFramework("unknown")` returns exactly the 10 universal.
- [ ] Run → fail. Implement: add `frameworks?: string[]` to `UseCase`; append the 3 entries:
  - `browse-url`: title "Browse a live web page", category "research", fields `[{key:"url",label:"Page URL",type:"text",placeholder:"https://…"},{key:"task",label:"What should the agent do?",type:"textarea",placeholder:"e.g. summarize the pricing tiers"}]`, template `"Open the web page at {url} and {task}. Summarize what you find with the key details."`, frameworks `["hermes"]`.
  - `remember-info`: title "Remember something for later", category "productivity", fields `[{key:"info",label:"What to remember",type:"textarea",placeholder:"e.g. My project deadline is Oct 3"}]`, template `"Remember the following for future reference: {info}. Store it in your long-term memory and confirm."`, frameworks `["zeptoclaw"]`.
  - `terminal-task`: title "Automate a terminal task", category "coding", fields `[{key:"task",label:"Terminal task",type:"textarea",placeholder:"e.g. find and delete all .tmp files in ~/downloads"}]`, template `"Using your terminal tool, {task}. Show the commands you run and the result."`, frameworks `["openclaw"]`.
  - Add `export function useCasesForFramework(frameworkId)` filtering universal (`!uc.frameworks || uc.frameworks.length===0`) OR `uc.frameworks.includes(frameworkId)`.
- [ ] Run tests (split) + build. Commit `feat(usecases): frameworks tag + 3 tailored use cases + filter helper`.

## Task 2: `UseCaseBuilder` filters by selected framework
**Files:** `src/renderer/components/UseCaseBuilder.tsx`. Test: `tests/renderer/use-case-builder.test.tsx` (extend).

- [ ] **Failing tests:**
  - With store `selectedFrameworkId="hermes"`, the builder's card grid shows `browse-url` and does NOT show `remember-info`/`terminal-task`; still shows the universal ones (e.g. `research`).
  - With `selectedFrameworkId="zeptoclaw"`, shows `remember-info`, not `browse-url`/`terminal-task`.
  - Picking a tailored card renders its fields + live preview + Copy (existing behavior unchanged — no regression to the generic flow).
- [ ] Run → fail. Implement: read `selectedFrameworkId` from `useAppStore`; build the card list from `useCasesForFramework(selectedFrameworkId)` instead of the raw `USE_CASES`. (Optional: a small "Tailored for {framework}" badge on framework-specific cards — nice-to-have, keep light-tokens; not required by tests.) Keep everything else (RadioCardGroup, fields, preview, Copy, clipboard fallback) as-is.
- [ ] Run tests (split) + build. Commit `feat(usecases): UseCaseBuilder shows universal + framework-tailored use cases`.

## Task 3: Full-suite verify + spec note
- [ ] Split suites (`tests/main` + `tests/renderer`) green + `npm run build` clean; host node16.
- [ ] Add a note to the Phase 3 spec §7 that per-framework tailored use cases are now delivered (hermes browse / zeptoclaw memory / openclaw terminal), grounded in verified features; further per-framework use cases can be added as capabilities are verified.
- [ ] Commit `docs(usecases): per-framework tailored use cases delivered`.

## Notes / Deferrals
- Only 3 tailored use cases (one per framework) — deliberately minimal + verified. More can be added per framework as distinctive capabilities are verified (e.g. openclaw MCP tools, hermes voice/TTS as an output mode, zeptoclaw skills authoring).
- Still no agent round-trip — the builder produces a copy-paste prompt (unchanged).
- `selectedFrameworkId` is the framework signal for both the wizard use-case step and the Task-side UseCasesPage; no new store field needed.
