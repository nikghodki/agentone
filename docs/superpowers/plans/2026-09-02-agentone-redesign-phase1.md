# AgentOne Redesign — Phase 1 (Design System + Guided Wizard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. For the visual components (Tasks 1–2 and the step UIs), invoke the **frontend-design** skill to carry out the look described in the spec. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A modern, light & approachable UI and a guided setup wizard (framework → config → model → deploy) plus a "Switch framework" teardown — Phase 1 of the redesign.

**Architecture:** Renderer-heavy. A reusable Tailwind-based UI kit + a `WizardLayout` hosting linear step components backed by a Zustand `wizard` slice. Reuses the existing engine (`getFrameworks`, `saveModelBackend`, `deployFramework`, `buildSaveArgs`, adapters). One new thin main-process IPC (`remove-deployment`) + `db.deleteDeployment` for Step 10.

**Tech Stack:** React 18 (repo uses React 19 types) / TypeScript / Tailwind 3 / Zustand / Vitest + RTL (jsdom). Host Node 16 for tests/build; packaging under Node 22 (unchanged).

**Spec:** `docs/specs/2026-09-02-agentone-redesign-guided-setup.md` (design tokens + wizard steps live there — this plan argues from it). Research: `docs/research/verified/framework-setup-config.md` (no required framework config beyond model).

## Global Constraints
- **Design tokens are defined in the spec §2** — every component uses them (slate-50 bg, white `rounded-2xl` cards + `shadow-sm`, **indigo-600** primary, semantic emerald/amber/rose, `text-slate-900/500` text). Do NOT invent a different palette.
- **Font: system stack** `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif` (no new font dependency; SF Pro is the modern default on macOS). Bundling Inter is a deferred follow-up. (Ruling: avoids a font dep + packaging weight.)
- **Host Node v16.16.0** for tests/build. Tests: Vitest + RTL, jsdom (`// @vitest-environment jsdom` in `.tsx` test files). Existing suite (284) stays green.
- **No secrets in logs**; reuse the vetted `saveModelBackend(draft, secret)` path for keys/creds.
- **Reuse, don't reinvent** engine IPC: `window.electronAPI.getFrameworks/saveModelBackend/deployFramework/getDeployments`; renderer `buildSaveArgs` (`src/renderer/pages/model-backend-payload.ts`).
- Accessibility: labeled inputs, visible `focus:ring-2 ring-indigo-500`, keyboard-operable radio cards.

## File Structure
- Create: `src/renderer/components/ui/` (`Card.tsx`, `Button.tsx`, `Input.tsx`, `Select.tsx`, `Textarea.tsx`, `Badge.tsx`, `Callout.tsx`, `ProgressBar.tsx`, `StepProgress.tsx`, `RadioCardGroup.tsx`, `index.ts`).
- Create: `src/renderer/components/WizardLayout.tsx`; `src/renderer/pages/wizard/` (`FrameworkStep.tsx`, `ConfigStep.tsx`, `ModelLocationStep.tsx`, `ModelLocalStep.tsx`, `ModelCloudStep.tsx`, `DeployStep.tsx`, `Wizard.tsx`).
- Modify: `tailwind.config.ts`, `src/renderer/globals.css`, `src/renderer/store.ts` (wizard slice), `src/renderer/App.tsx` (route wizard), `src/main/ipc-handlers.ts` + `src/main/database.ts` + `src/preload/index.ts` + `src/shared/types.ts` (remove-deployment), `src/renderer/pages/TaskPage.tsx` (+ "Switch framework").
- Tests under `tests/renderer/**` and `tests/main/**`.

## Interfaces (shared across tasks)
```ts
// store wizard slice (src/renderer/store.ts)
type WizardStep = "framework" | "config" | "model-location" | "model-local" | "model-cloud" | "deploy";
interface WizardSlice {
  wizardStep: WizardStep;
  frameworkConfig: { persona?: string; port?: number };
  cloudForm: { apiKey: string; resourceUrl: string; deployment: string; apiVersion: string; region: string; accessKeyId: string; secretAccessKey: string; modelPath?: string };
  setWizardStep(s: WizardStep): void;
  patchWizard(p: Partial<Pick<WizardSlice,"frameworkConfig"|"cloudForm">>): void;
  resetWizard(): void;
}
// electronAPI additions
removeDeployment(deploymentId: string): Promise<void>;   // stop adapter + delete rows
// db
deleteDeployment(id: string): void;
```

---

## Task 1: Design-system foundation (Tailwind theme + globals)
**Files:** Modify `tailwind.config.ts`, `src/renderer/globals.css`. Test: `tests/renderer/design-tokens.test.ts` (assert config values).

- [ ] **Step 1 (failing test):** `tests/renderer/design-tokens.test.ts` imports `tailwind.config.ts` and asserts the theme extension exists:
```ts
import cfg from "../../tailwind.config";
it("defines the redesign tokens", () => {
  const c = (cfg as any).theme.extend.colors;
  expect(c.primary?.DEFAULT || c.primary).toBeTruthy();      // indigo-based primary
  expect((cfg as any).theme.extend.borderRadius?.["2xl"] ?? "").not.toBe(undefined);
});
```
- [ ] **Step 2:** Run → fails.
- [ ] **Step 3:** Extend `tailwind.config.ts` `theme.extend`: `colors.primary` = indigo scale (`DEFAULT:"#4F46E5"`, `hover:"#4338CA"`, `subtle:"#EEF2FF"`), keep semantic via Tailwind's emerald/amber/rose; `fontFamily.sans` = the system stack (Global Constraints); ensure `borderRadius` includes `2xl`. In `globals.css`, set base: `body { @apply bg-slate-50 text-slate-900 antialiased; font-family: theme(fontFamily.sans); }` and a `.focus-ring` utility.
- [ ] **Step 4:** Run test → pass; `npm run build` clean.
- [ ] **Step 5:** Commit `feat(ui): light design tokens (indigo primary, slate surfaces, system font)`.

## Task 2: UI component kit
**Files:** Create `src/renderer/components/ui/*` + `index.ts`. Test: `tests/renderer/ui-kit.test.tsx` (jsdom).

Each component is small, typed, and uses ONLY spec tokens. Representative APIs:
```tsx
// Button.tsx
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary"|"secondary"|"ghost"|"danger"; };
// primary: bg-primary text-white hover:bg-primary-hover rounded-lg px-4 py-2 font-medium focus:ring-2 ring-indigo-500 disabled:opacity-50
// Card.tsx: <div class="bg-white rounded-2xl shadow-sm p-6 ...">
// RadioCardGroup.tsx
type RadioCard = { value:string; title:string; description?:string; features?:string[]; badge?:string; };
type RadioCardGroupProps = { options: RadioCard[]; value: string|null; onChange:(v:string)=>void; columns?:1|2|3 };
// selected card: border-2 border-primary bg-primary-subtle; unselected: border border-slate-200 hover:border-slate-300; role="radio" aria-checked, keyboard (arrow/space/enter)
// StepProgress.tsx: props { steps: {key:string;label:string}[]; current:string }
// Callout.tsx: props { tone:"info"|"success"|"warning"|"error"; title?:string; children }
// ProgressBar.tsx: props { value:number /*0-100*/; label?:string; indeterminate?:boolean }
// Input/Select/Textarea: labeled wrappers { label; helper?; error?; ...native }
```
- [ ] **Step 1 (failing tests):** for the kit, e.g.
```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
it("Button primary renders and fires onClick", () => { const f=vi.fn(); render(<Button variant="primary" onClick={f}>Go</Button>); fireEvent.click(screen.getByRole("button",{name:"Go"})); expect(f).toHaveBeenCalled(); });
it("RadioCardGroup selects a card and calls onChange", () => { const f=vi.fn(); render(<RadioCardGroup value={null} onChange={f} options={[{value:"a",title:"A"},{value:"b",title:"B"}]} />); fireEvent.click(screen.getByText("B")); expect(f).toHaveBeenCalledWith("b"); });
it("Callout warning shows title", () => { render(<Callout tone="warning" title="Heads up">x</Callout>); expect(screen.getByText("Heads up")).toBeTruthy(); });
it("ProgressBar reflects value", () => { render(<ProgressBar value={42} label="Installing"/>); expect(screen.getByText(/Installing/)).toBeTruthy(); });
```
- [ ] **Step 2:** fail. **Step 3:** implement the kit per spec tokens (invoke frontend-design skill for polish). Export from `index.ts`. **Step 4:** tests pass; build clean. **Step 5:** commit `feat(ui): reusable component kit (Card/Button/Input/Select/RadioCardGroup/Callout/ProgressBar/StepProgress/Badge)`.

## Task 3: Wizard store slice + WizardLayout + routing
**Files:** Modify `src/renderer/store.ts`, `src/renderer/App.tsx`; create `src/renderer/components/WizardLayout.tsx`, `src/renderer/pages/wizard/Wizard.tsx`. Test: `tests/renderer/wizard-store.test.ts`, `tests/renderer/wizard-layout.test.tsx`.

- [ ] **Step 1 (failing tests):**
```ts
it("wizard starts at 'framework' and advances", () => { const s=useAppStore.getState(); expect(s.wizardStep).toBe("framework"); s.setWizardStep("config"); expect(useAppStore.getState().wizardStep).toBe("config"); });
it("resetWizard returns to framework and clears config/cloudForm", () => { const s=useAppStore.getState(); s.patchWizard({frameworkConfig:{port:9000}}); s.resetWizard(); expect(useAppStore.getState().wizardStep).toBe("framework"); expect(useAppStore.getState().frameworkConfig).toEqual({}); });
```
- [ ] **Step 2:** fail. **Step 3:** add the `WizardSlice` (Interfaces) to the store (initial `wizardStep:"framework"`, `frameworkConfig:{}`, `cloudForm` empty). Add a new `AppView` value `"wizard"` and set initial `view:"wizard"` (replaces `"v2-framework-select"` as first-run entry; keep the case for back-compat). `WizardLayout` renders `StepProgress` (steps: Framework, Setup, Model, Deploy — collapse local/cloud into "Model"), content, and Back/Continue footer driven by `wizardStep`. `Wizard.tsx` switches on `wizardStep` to render the step component (Tasks 4–7). `App.tsx`: `case "wizard": return <Wizard/>`.
- [ ] **Step 4:** RTL test: `WizardLayout` shows the current step title + Continue disabled until the step signals ready (via a prop/callback). **Step 5:** tests+build pass; commit `feat(wizard): store slice + WizardLayout shell + routing`.

## Task 4: Step 1 (framework) + Step 2 (config)
**Files:** `src/renderer/pages/wizard/FrameworkStep.tsx`, `ConfigStep.tsx`. Test: `tests/renderer/wizard-framework-config.test.tsx`.

- [ ] **Step 1 (failing tests):**
```tsx
// FrameworkStep: loads getFrameworks (mock window.electronAPI), shows 3 cards + "Recommended" on default, selecting sets selectedFrameworkId
it("lists frameworks and marks the default Recommended", async () => { /* mock getFrameworks → 3 incl isDefault zeptoclaw; expect await findByText('Recommended') and 3 cards */ });
it("selecting a framework enables Continue", async () => { /* click a card → onReady(true) / store.selectedFrameworkId set */ });
// ConfigStep: shows the no-required-config callout for the selected framework; Advanced is collapsed; expanding reveals persona + port
it("shows 'no extra setup' and hides advanced by default", () => { /* expect callout text; persona textarea not visible until Advanced toggled */ });
it("advanced values are captured into frameworkConfig", () => { /* toggle Advanced, type persona + port → patchWizard called with {persona, port} */ });
```
- [ ] **Step 2:** fail. **Step 3:** implement using the UI kit + `RadioCardGroup` (framework cards use `features` = top-5) and `Callout` + collapsible Advanced (`Textarea` persona, `Input` port). Use `getFrameworks` on mount; default selection = `isDefault`. **Step 4:** tests pass; build clean. **Step 5:** commit `feat(wizard): step 1 framework select + step 2 config (defaults + optional advanced)`.

## Task 5: Step 3 (model location) + Step 4 (model local)
**Files:** `ModelLocationStep.tsx`, `ModelLocalStep.tsx`. Test: `tests/renderer/wizard-model-local.test.tsx`.
- [ ] **Step 1 (failing tests):** location step → two RadioCards; choosing "local" advances to `model-local`, "cloud" to `model-cloud`. Local step → RadioCards default/choose/custom; "custom endpoint" reveals URL+key+protocol; selection populates `modelBackendDraft` (kind `ollama`/`llamacpp`/`custom`). Assert draft shape per choice.
- [ ] **Step 2:** fail. **Step 3:** implement; "Recommended default" preselected (kind `ollama`, curated model constant); "choose a model" = a small curated list; "custom" = Input URL + key + protocol Select → draft.kind `custom`. **Step 4/5:** tests+build; commit `feat(wizard): step 3 model location + step 4 local model`.

## Task 6: Step 5 (cloud model)
**Files:** `ModelCloudStep.tsx`. Test: `tests/renderer/wizard-model-cloud.test.tsx`.
- [ ] **Step 1 (failing tests):** provider Select (5 options); choosing Bedrock shows region + 2 keys; Azure shows resourceUrl/deployment/apiVersion + key; others show single key; a per-provider guided `Callout` with instructions renders. On continue, the collected `cloudForm` + provider feed `buildSaveArgs(draft, form)` producing the right `{draft.extra, secret}` (reuse the existing helper; assert via a unit call).
- [ ] **Step 2:** fail. **Step 3:** implement reusing `buildSaveArgs` from `src/renderer/pages/model-backend-payload.ts`; provider defaults (openrouter baseUrl, protocol per provider) mirror the existing `ModelBackendPage.handleProviderChange`. **Step 4/5:** tests+build; commit `feat(wizard): step 5 cloud model with guided provider setup`.

## Task 7: Step 6 (deploy)
**Files:** `DeployStep.tsx`. Test: `tests/renderer/wizard-deploy.test.tsx`.
- [ ] **Step 1 (failing tests):**
```tsx
it("deploys: saveModelBackend then deployFramework with the returned id, shows progress, routes to task", async () => {
  // mock electronAPI.saveModelBackend→"bid", deployFramework→{id:"dep1"}; render DeployStep with store {selectedFrameworkId:'zeptoclaw', modelBackendDraft, cloudForm}
  // click "Install & Deploy" → expect saveModelBackend called with buildSaveArgs output, then deployFramework("zeptoclaw","bid"); on resolve setCurrentDeploymentId("dep1") + setView("task")
});
it("shows an error callout + Retry when deploy fails", async () => { /* deployFramework rejects → Callout error + Retry button re-invokes */ });
```
- [ ] **Step 2:** fail. **Step 3:** implement: assemble payload via `buildSaveArgs` (cloud) or the local draft; `saveModelBackend`→`deployFramework`; subscribe to the install/model progress channel + `onTaskStatus` to drive a staged `ProgressBar` ("Installing… / Configuring… / Starting…"); success → `setCurrentDeploymentId` + `setView("task")`; failure → `Callout` error + Retry. (Advanced `frameworkConfig` persona/port: pass through if the deploy path supports it; otherwise note as a follow-up — do NOT block the default path.) **Step 4/5:** tests+build; commit `feat(wizard): step 6 deploy with staged progress + retry`.

## Task 8: remove-deployment IPC + Step 10 "Switch framework"
**Files:** `src/main/database.ts` (`deleteDeployment`), `src/main/ipc-handlers.ts` (`remove-deployment` handler, exported `handleRemoveDeployment`), `src/preload/index.ts`, `src/shared/types.ts`, `src/renderer/pages/TaskPage.tsx` (Switch button). Tests: `tests/main/remove-deployment.test.ts`, `tests/renderer/switch-framework.test.tsx`.
- [ ] **Step 1 (failing tests):**
```ts
// main: handleRemoveDeployment stops the live adapter (if any) and deletes the deployment row
it("stops adapter and deletes deployment", async () => { const adapter={stop:vi.fn().mockResolvedValue(undefined)}; const db={deleteDeployment:vi.fn()}; await handleRemoveDeployment("dep1",{db,getAdapter:()=>adapter}); expect(adapter.stop).toHaveBeenCalled(); expect(db.deleteDeployment).toHaveBeenCalledWith("dep1"); });
it("no live adapter: still deletes the row", async () => { const db={deleteDeployment:vi.fn()}; await handleRemoveDeployment("dep1",{db,getAdapter:()=>undefined}); expect(db.deleteDeployment).toHaveBeenCalledWith("dep1"); });
```
```tsx
// renderer: Switch framework → confirm → removeDeployment(currentDeploymentId) → resetWizard() + setView("wizard")
it("switch framework tears down and restarts the wizard", async () => { /* click Switch → confirm → expect removeDeployment('dep1'); resetWizard; setView('wizard') */ });
```
- [ ] **Step 2:** fail. **Step 3:** `db.deleteDeployment(id)` = `DELETE FROM deployments WHERE id=?` (+ its capabilities). Export `handleRemoveDeployment(deploymentId, {db,getAdapter})` (mirror `handleRemoveCapability`): `await getAdapter(id)?.stop()` (guarded), then `db.deleteDeployment(id)`; register `ipcMain.handle("remove-deployment", ...)` with `getAdapter: id => deploymentRegistry.get(id)?.adapter` and also `deploymentRegistry.delete(id)`. Preload + `ElectronAPI.removeDeployment`. TaskPage: a "Switch framework" `Button variant="ghost"` → confirm → `removeDeployment` → `resetWizard()` + `setView("wizard")`. **Step 4/5:** tests+build; commit `feat(wizard): switch/remove framework teardown (remove-deployment IPC + Task action)`.

## Task 9: Full-suite verification + spec status
- [ ] Run `npx vitest run` (all green, incl. existing 284) + `npm run build` clean; host `node -v` = v16.16.0.
- [ ] Update the redesign spec §1 to mark Phase 1 delivered; note Phases 2–3 pending.
- [ ] Commit `docs(redesign): Phase 1 delivered (design system + guided wizard + switch)`.

## Notes / Deferrals
- Font = system stack (Inter bundling deferred). Dark mode deferred (light only).
- Step 2 advanced persona/port applied at deploy only if the adapter `configure()` path already accepts it; otherwise wiring it is a follow-up (default empty path needs nothing).
- Packaged-app launch verification (open the built app on the new UI) is done manually after merge (see PACKAGING.md); not a task gate here.
- v1 pages remain in the tree but are not part of the wizard.
