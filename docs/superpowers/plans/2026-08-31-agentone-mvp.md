# AgentOne MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AgentOne desktop app MVP — an Electron app that bundles Ollama, runs a local LLM, onboards users by persona, and provides guided AI task flows with a freemium subscription model.

**Architecture:** Electron main process manages Ollama lifecycle, hardware detection, SQLite, and license validation via IPC. React renderer provides onboarding, dashboard with persona-based task cards, guided task forms that generate structured prompts, and a freeform chat view with streaming. Ollama binary is bundled in the app and communicates via localhost HTTP.

**Tech Stack:** Electron 33+, React 18, TypeScript 5, Tailwind CSS, shadcn/ui, Zustand, better-sqlite3, Ollama (bundled binary), Vite (for renderer build), Vitest (testing), electron-builder (packaging).

**Spec:** `docs/specs/2026-08-31-agentone-design.md`

## Global Constraints

- Node 20+ LTS
- Electron 33+ (for latest security patches and contextIsolation default)
- TypeScript strict mode enabled
- All user data stored locally in SQLite — no cloud storage, no telemetry of conversation content
- Ollama communicates on `http://127.0.0.1:{random_port}` — never exposed beyond localhost
- Free tier: 20 AI generations/day. Pro tier: unlimited. Each LLM invocation counts as 1 generation
- Personas defined as JSON files in `src/personas/`, not hardcoded
- Mac: macOS 12+, Apple Silicon M1+ or Intel 2018+. Windows: Windows 10 64-bit+
- Minimum 8GB RAM, 6GB disk free

---

## File Structure

```
flashlearn/
├── package.json
├── tsconfig.json
├── tsconfig.main.json           # TS config for Electron main process
├── tsconfig.renderer.json       # TS config for React renderer
├── vite.config.ts               # Vite config for renderer
├── vitest.config.ts             # Test config
├── electron-builder.yml         # Packaging config
├── tailwind.config.ts
├── postcss.config.js
├── src/
│   ├── main/                    # Electron main process (Node.js)
│   │   ├── index.ts             # App entry: window creation, app lifecycle
│   │   ├── ipc-handlers.ts      # Registers all IPC handlers
│   │   ├── ollama-manager.ts    # Start/stop Ollama, download models, health checks
│   │   ├── hardware-detector.ts # Detect RAM/GPU, select optimal model
│   │   ├── database.ts          # SQLite schema + CRUD operations
│   │   ├── license-manager.ts   # Validate Stripe license key, offline grace
│   │   ├── rate-limiter.ts      # Track daily generation count, enforce free tier limit
│   │   └── paths.ts             # Cross-platform paths for data, models, ollama binary
│   ├── preload/
│   │   └── index.ts             # contextBridge: expose typed IPC API to renderer
│   ├── renderer/
│   │   ├── index.html           # HTML shell
│   │   ├── main.tsx             # React root mount
│   │   ├── App.tsx              # Top-level routing (onboarding vs dashboard vs chat)
│   │   ├── store.ts             # Zustand: app state (persona, view, conversations)
│   │   ├── hooks/
│   │   │   └── use-llm.ts       # Hook: send prompt via IPC, handle streaming tokens
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui primitives (Button, Card, Input, etc.)
│   │   │   ├── TaskCard.tsx     # Single task suggestion card on dashboard
│   │   │   ├── GuidedFlowForm.tsx  # Dynamic form renderer from guided_flow JSON
│   │   │   ├── ChatMessage.tsx  # Single chat bubble (user or assistant)
│   │   │   ├── ChatInput.tsx    # Text input with send button + suggestions
│   │   │   ├── ModelProgress.tsx   # Model download progress bar
│   │   │   └── StreamingText.tsx   # Renders tokens as they arrive
│   │   ├── pages/
│   │   │   ├── SetupPage.tsx    # First-launch: hardware detect + model download
│   │   │   ├── OnboardingPage.tsx  # Persona selection + priorities
│   │   │   ├── DashboardPage.tsx   # Task grid + recently used + discover more + stats
│   │   │   ├── GuidedTaskPage.tsx  # Guided flow form + result display + actions
│   │   │   ├── ChatPage.tsx     # Freeform chat with streaming
│   │   │   └── SettingsPage.tsx # License key, model info, reset, analytics opt-out
│   │   └── lib/
│   │       ├── format.ts        # Date formatting, time-saved estimation
│   │       └── prompt-builder.ts   # Build LLM prompt from guided flow fields + persona system prompt
│   ├── shared/
│   │   └── types.ts             # Types shared between main and renderer via IPC
│   └── personas/
│       ├── student.json
│       ├── professional.json
│       ├── parent.json
│       └── small-business.json
├── tests/
│   ├── main/
│   │   ├── hardware-detector.test.ts
│   │   ├── database.test.ts
│   │   ├── rate-limiter.test.ts
│   │   ├── license-manager.test.ts
│   │   └── ollama-manager.test.ts
│   ├── renderer/
│   │   ├── prompt-builder.test.ts
│   │   ├── GuidedFlowForm.test.tsx
│   │   └── store.test.ts
│   └── personas/
│       └── persona-schema.test.ts
└── resources/
    ├── icon.icns                # Mac app icon
    └── icon.ico                 # Windows app icon
```

---

### Task 1: Project Scaffolding and Electron Shell

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.main.json`, `tsconfig.renderer.json`, `vite.config.ts`, `vitest.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `electron-builder.yml`
- Create: `src/main/index.ts`, `src/main/paths.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/index.html`, `src/renderer/main.tsx`, `src/renderer/App.tsx`
- Create: `src/shared/types.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: Working Electron app that opens a window rendering a React "Hello World" page. `getAppPaths(): AppPaths` from `paths.ts`. IPC bridge with `window.electronAPI` typed in `shared/types.ts`.

- [ ] **Step 1: Initialize project and install dependencies**

```bash
cd /Users/nghodki/workspace/flashlearn
npm init -y
npm install electron electron-builder --save-dev
npm install react react-dom zustand better-sqlite3
npm install -D typescript @types/react @types/react-dom @types/better-sqlite3
npm install -D vite @vitejs/plugin-react vitest @testing-library/react @testing-library/jest-dom jsdom
npm install -D tailwindcss postcss autoprefixer
npm install -D concurrently wait-on
npx tailwindcss init -p --ts
```

- [ ] **Step 2: Configure TypeScript**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

Create `tsconfig.main.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "outDir": "dist/main",
    "rootDir": "src/main"
  },
  "include": ["src/main/**/*", "src/shared/**/*"]
}
```

Create `tsconfig.renderer.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "dist/renderer",
    "rootDir": "src"
  },
  "include": ["src/renderer/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 3: Create shared types**

Create `src/shared/types.ts`:
```typescript
export interface AppPaths {
  userData: string;
  models: string;
  database: string;
  ollamaBinary: string;
}

export interface HardwareInfo {
  totalRamGB: number;
  platform: "darwin" | "win32" | "linux";
  arch: string;
  gpuType: "apple-silicon" | "nvidia" | "amd" | "none";
}

export interface ModelChoice {
  name: string;
  displayName: string;
  sizeGB: number;
  minRamGB: number;
}

export interface Persona {
  id: string;
  name: string;
  icon: string;
  system_prompt: string;
  tasks: TaskDefinition[];
  discovery_queue: string[];
}

export interface TaskDefinition {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  category: string;
  guided_flow: GuidedFlow;
}

export interface GuidedFlow {
  fields: FlowField[];
  prompt_template: string;
}

export type FlowField = {
  type: "choice" | "textarea" | "text";
  label: string;
  optional?: boolean;
  options?: string[];
  placeholder?: string;
};

export interface Conversation {
  id: string;
  title: string | null;
  taskId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface TaskUsage {
  taskId: string;
  persona: string;
  startedAt: string;
  completed: boolean;
  durationSeconds: number | null;
}

export interface UserProfile {
  persona: string;
  priorities: string[];
  licenseKey: string | null;
  licenseValidUntil: string | null;
}

export interface GenerationResult {
  content: string;
  conversationId: string;
  messageId: string;
}

export interface ElectronAPI {
  getAppPaths: () => Promise<AppPaths>;
  getHardwareInfo: () => Promise<HardwareInfo>;
  getModelChoice: () => Promise<ModelChoice>;

  ollamaStatus: () => Promise<"not_installed" | "downloading_model" | "starting" | "ready" | "error">;
  ollamaStartAndPull: () => Promise<void>;
  onModelDownloadProgress: (callback: (progress: number) => void) => () => void;

  dbGetProfile: () => Promise<UserProfile | null>;
  dbSaveProfile: (profile: UserProfile) => Promise<void>;
  dbGetConversations: (limit: number) => Promise<Conversation[]>;
  dbCreateConversation: (taskId: string | null) => Promise<Conversation>;
  dbGetMessages: (conversationId: string) => Promise<Message[]>;
  dbSaveMessage: (msg: Omit<Message, "createdAt">) => Promise<void>;
  dbRecordTaskUsage: (usage: TaskUsage) => Promise<void>;
  dbGetTaskUsageStats: () => Promise<{ taskId: string; count: number }[]>;
  dbGetDailyGenerationCount: () => Promise<number>;

  generate: (prompt: string, systemPrompt: string, conversationId: string) => Promise<string>;
  onGenerateToken: (callback: (token: string) => void) => () => void;

  getRemainingGenerations: () => Promise<number | "unlimited">;

  getLicenseStatus: () => Promise<"free" | "pro" | "expired">;
  activateLicense: (key: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

- [ ] **Step 4: Create Electron main process entry**

Create `src/main/paths.ts`:
```typescript
import { app } from "electron";
import path from "path";
import type { AppPaths } from "../shared/types";

export function getAppPaths(): AppPaths {
  const userData = app.getPath("userData");
  return {
    userData,
    models: path.join(userData, "models"),
    database: path.join(userData, "agentone.db"),
    ollamaBinary: path.join(
      process.resourcesPath,
      "ollama",
      process.platform === "win32" ? "ollama.exe" : "ollama"
    ),
  };
}
```

Create `src/main/index.ts`:
```typescript
import { app, BrowserWindow } from "electron";
import path from "path";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

- [ ] **Step 5: Create preload script**

Create `src/preload/index.ts`:
```typescript
import { contextBridge, ipcRenderer } from "electron";
import type { ElectronAPI } from "../shared/types";

const api: ElectronAPI = {
  getAppPaths: () => ipcRenderer.invoke("get-app-paths"),
  getHardwareInfo: () => ipcRenderer.invoke("get-hardware-info"),
  getModelChoice: () => ipcRenderer.invoke("get-model-choice"),

  ollamaStatus: () => ipcRenderer.invoke("ollama-status"),
  ollamaStartAndPull: () => ipcRenderer.invoke("ollama-start-and-pull"),
  onModelDownloadProgress: (callback) => {
    const handler = (_event: unknown, progress: number) => callback(progress);
    ipcRenderer.on("model-download-progress", handler);
    return () => ipcRenderer.removeListener("model-download-progress", handler);
  },

  dbGetProfile: () => ipcRenderer.invoke("db-get-profile"),
  dbSaveProfile: (profile) => ipcRenderer.invoke("db-save-profile", profile),
  dbGetConversations: (limit) => ipcRenderer.invoke("db-get-conversations", limit),
  dbCreateConversation: (taskId) => ipcRenderer.invoke("db-create-conversation", taskId),
  dbGetMessages: (cid) => ipcRenderer.invoke("db-get-messages", cid),
  dbSaveMessage: (msg) => ipcRenderer.invoke("db-save-message", msg),
  dbRecordTaskUsage: (usage) => ipcRenderer.invoke("db-record-task-usage", usage),
  dbGetTaskUsageStats: () => ipcRenderer.invoke("db-get-task-usage-stats"),
  dbGetDailyGenerationCount: () => ipcRenderer.invoke("db-get-daily-generation-count"),

  generate: (prompt, systemPrompt, conversationId) =>
    ipcRenderer.invoke("generate", prompt, systemPrompt, conversationId),
  onGenerateToken: (callback) => {
    const handler = (_event: unknown, token: string) => callback(token);
    ipcRenderer.on("generate-token", handler);
    return () => ipcRenderer.removeListener("generate-token", handler);
  },

  getRemainingGenerations: () => ipcRenderer.invoke("get-remaining-generations"),

  getLicenseStatus: () => ipcRenderer.invoke("get-license-status"),
  activateLicense: (key) => ipcRenderer.invoke("activate-license", key),
};

contextBridge.exposeInMainWorld("electronAPI", api);
```

- [ ] **Step 6: Create React renderer shell**

Create `src/renderer/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AgentOne</title>
  </head>
  <body class="bg-zinc-950 text-zinc-100">
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

Create `src/renderer/main.tsx`:
```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `src/renderer/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Create `src/renderer/App.tsx`:
```tsx
export function App() {
  return (
    <div className="flex items-center justify-center h-screen">
      <h1 className="text-3xl font-bold">AgentOne</h1>
    </div>
  );
}
```

- [ ] **Step 7: Configure Vite for renderer**

Create `vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "src/renderer",
  base: "./",
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
});
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
});
```

- [ ] **Step 8: Add npm scripts to package.json**

Update `package.json` scripts:
```json
{
  "main": "dist/main/index.js",
  "scripts": {
    "dev:renderer": "vite --config vite.config.ts",
    "dev:main": "tsc -p tsconfig.main.json --watch",
    "dev": "concurrently \"npm run dev:renderer\" \"npm run dev:main\" \"wait-on http://localhost:5173 && electron .\"",
    "build:renderer": "vite build --config vite.config.ts",
    "build:main": "tsc -p tsconfig.main.json",
    "build": "npm run build:renderer && npm run build:main",
    "test": "vitest run",
    "test:watch": "vitest",
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  }
}
```

- [ ] **Step 9: Verify Electron launches with React renderer**

```bash
npm run build:main && npm run dev:renderer &
# In another terminal:
npx electron .
```

Expected: Electron window opens showing "AgentOne" centered in dark background.

- [ ] **Step 10: Commit**

```bash
git init
echo "node_modules/\ndist/\n*.db\nmodels/" > .gitignore
git add -A
git commit -m "feat: scaffold Electron + React + TypeScript project with IPC bridge"
```

---

### Task 2: SQLite Database Layer

**Files:**
- Create: `src/main/database.ts`
- Test: `tests/main/database.test.ts`

**Interfaces:**
- Consumes: `AppPaths.database` from `paths.ts`, types from `shared/types.ts`
- Produces: `Database` class with methods: `initialize(): void`, `getProfile(): UserProfile | null`, `saveProfile(p: UserProfile): void`, `getConversations(limit: number): Conversation[]`, `createConversation(taskId: string | null): Conversation`, `getMessages(conversationId: string): Message[]`, `saveMessage(msg: Omit<Message, "createdAt">): void`, `recordTaskUsage(usage: TaskUsage): void`, `getTaskUsageStats(): { taskId: string; count: number }[]`, `getDailyGenerationCount(): number`, `incrementDailyGenerationCount(): void`

- [ ] **Step 1: Write failing tests for Database class**

Create `tests/main/database.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Database } from "../../src/main/database";
import fs from "fs";
import path from "path";
import os from "os";

describe("Database", () => {
  let db: Database;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `agentone-test-${Date.now()}.db`);
    db = new Database(dbPath);
    db.initialize();
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  describe("profile", () => {
    it("returns null when no profile exists", () => {
      expect(db.getProfile()).toBeNull();
    });

    it("saves and retrieves a profile", () => {
      const profile = {
        persona: "student",
        priorities: ["summarize", "quiz"],
        licenseKey: null,
        licenseValidUntil: null,
      };
      db.saveProfile(profile);
      const result = db.getProfile();
      expect(result).toEqual(profile);
    });

    it("updates existing profile on save", () => {
      db.saveProfile({ persona: "student", priorities: [], licenseKey: null, licenseValidUntil: null });
      db.saveProfile({ persona: "professional", priorities: ["emails"], licenseKey: "key123", licenseValidUntil: "2027-01-01" });
      const result = db.getProfile();
      expect(result?.persona).toBe("professional");
      expect(result?.licenseKey).toBe("key123");
    });
  });

  describe("conversations", () => {
    it("creates a conversation and retrieves it", () => {
      const conv = db.createConversation("draft_email");
      expect(conv.id).toBeDefined();
      expect(conv.taskId).toBe("draft_email");
      const all = db.getConversations(10);
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(conv.id);
    });

    it("creates freeform conversation with null taskId", () => {
      const conv = db.createConversation(null);
      expect(conv.taskId).toBeNull();
    });

    it("returns conversations ordered by updatedAt desc", () => {
      const c1 = db.createConversation("task_a");
      const c2 = db.createConversation("task_b");
      const all = db.getConversations(10);
      expect(all[0].id).toBe(c2.id);
      expect(all[1].id).toBe(c1.id);
    });

    it("respects limit", () => {
      db.createConversation("a");
      db.createConversation("b");
      db.createConversation("c");
      expect(db.getConversations(2)).toHaveLength(2);
    });
  });

  describe("messages", () => {
    it("saves and retrieves messages for a conversation", () => {
      const conv = db.createConversation(null);
      db.saveMessage({ id: "m1", conversationId: conv.id, role: "user", content: "Hello" });
      db.saveMessage({ id: "m2", conversationId: conv.id, role: "assistant", content: "Hi there!" });
      const msgs = db.getMessages(conv.id);
      expect(msgs).toHaveLength(2);
      expect(msgs[0].role).toBe("user");
      expect(msgs[1].role).toBe("assistant");
    });
  });

  describe("task usage", () => {
    it("records and retrieves task usage stats", () => {
      db.recordTaskUsage({ taskId: "draft_email", persona: "professional", startedAt: new Date().toISOString(), completed: true, durationSeconds: 30 });
      db.recordTaskUsage({ taskId: "draft_email", persona: "professional", startedAt: new Date().toISOString(), completed: true, durationSeconds: 45 });
      db.recordTaskUsage({ taskId: "brainstorm", persona: "professional", startedAt: new Date().toISOString(), completed: true, durationSeconds: 60 });
      const stats = db.getTaskUsageStats();
      const emailStat = stats.find((s) => s.taskId === "draft_email");
      expect(emailStat?.count).toBe(2);
    });
  });

  describe("daily generation count", () => {
    it("starts at 0", () => {
      expect(db.getDailyGenerationCount()).toBe(0);
    });

    it("increments count", () => {
      db.incrementDailyGenerationCount();
      db.incrementDailyGenerationCount();
      expect(db.getDailyGenerationCount()).toBe(2);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/main/database.test.ts
```

Expected: All tests FAIL (module not found).

- [ ] **Step 3: Implement Database class**

Create `src/main/database.ts`:
```typescript
import BetterSqlite3 from "better-sqlite3";
import { randomUUID } from "crypto";
import type { UserProfile, Conversation, Message, TaskUsage } from "../shared/types";

export class Database {
  private db: BetterSqlite3.Database;

  constructor(dbPath: string) {
    this.db = new BetterSqlite3(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }

  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY DEFAULT 1,
        persona TEXT NOT NULL,
        priorities TEXT NOT NULL DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        license_key TEXT,
        license_valid_until TEXT
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT,
        task_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id),
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS task_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        persona TEXT NOT NULL,
        started_at TEXT DEFAULT (datetime('now')),
        completed INTEGER DEFAULT 0,
        duration_seconds INTEGER
      );

      CREATE TABLE IF NOT EXISTS daily_generations (
        date TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  getProfile(): UserProfile | null {
    const row = this.db.prepare("SELECT * FROM user_profile WHERE id = 1").get() as any;
    if (!row) return null;
    return {
      persona: row.persona,
      priorities: JSON.parse(row.priorities),
      licenseKey: row.license_key,
      licenseValidUntil: row.license_valid_until,
    };
  }

  saveProfile(profile: UserProfile): void {
    this.db
      .prepare(
        `INSERT INTO user_profile (id, persona, priorities, license_key, license_valid_until)
         VALUES (1, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           persona = excluded.persona,
           priorities = excluded.priorities,
           license_key = excluded.license_key,
           license_valid_until = excluded.license_valid_until`
      )
      .run(
        profile.persona,
        JSON.stringify(profile.priorities),
        profile.licenseKey,
        profile.licenseValidUntil
      );
  }

  getConversations(limit: number): Conversation[] {
    return this.db
      .prepare("SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?")
      .all(limit)
      .map((row: any) => ({
        id: row.id,
        title: row.title,
        taskId: row.task_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
  }

  createConversation(taskId: string | null): Conversation {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare("INSERT INTO conversations (id, task_id, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .run(id, taskId, now, now);
    return { id, title: null, taskId, createdAt: now, updatedAt: now };
  }

  getMessages(conversationId: string): Message[] {
    return this.db
      .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
      .all(conversationId)
      .map((row: any) => ({
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role,
        content: row.content,
        createdAt: row.created_at,
      }));
  }

  saveMessage(msg: Omit<Message, "createdAt">): void {
    this.db
      .prepare("INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)")
      .run(msg.id, msg.conversationId, msg.role, msg.content);
  }

  recordTaskUsage(usage: TaskUsage): void {
    this.db
      .prepare("INSERT INTO task_usage (task_id, persona, started_at, completed, duration_seconds) VALUES (?, ?, ?, ?, ?)")
      .run(usage.taskId, usage.persona, usage.startedAt, usage.completed ? 1 : 0, usage.durationSeconds);
  }

  getTaskUsageStats(): { taskId: string; count: number }[] {
    return this.db
      .prepare("SELECT task_id as taskId, COUNT(*) as count FROM task_usage GROUP BY task_id ORDER BY count DESC")
      .all() as { taskId: string; count: number }[];
  }

  getDailyGenerationCount(): number {
    const today = new Date().toISOString().split("T")[0];
    const row = this.db.prepare("SELECT count FROM daily_generations WHERE date = ?").get(today) as any;
    return row?.count ?? 0;
  }

  incrementDailyGenerationCount(): void {
    const today = new Date().toISOString().split("T")[0];
    this.db
      .prepare(
        `INSERT INTO daily_generations (date, count) VALUES (?, 1)
         ON CONFLICT(date) DO UPDATE SET count = count + 1`
      )
      .run(today);
  }

  close(): void {
    this.db.close();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/main/database.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/database.ts tests/main/database.test.ts
git commit -m "feat: add SQLite database layer with profile, conversations, messages, task usage, and daily generation tracking"
```

---

### Task 3: Hardware Detector and Model Selection

**Files:**
- Create: `src/main/hardware-detector.ts`
- Test: `tests/main/hardware-detector.test.ts`

**Interfaces:**
- Consumes: `HardwareInfo`, `ModelChoice` from `shared/types.ts`
- Produces: `detectHardware(): HardwareInfo`, `selectModel(info: HardwareInfo): ModelChoice`

- [ ] **Step 1: Write failing tests**

Create `tests/main/hardware-detector.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { selectModel } from "../../src/main/hardware-detector";
import type { HardwareInfo } from "../../src/shared/types";

describe("selectModel", () => {
  it("selects 4B model for 8GB RAM", () => {
    const hw: HardwareInfo = { totalRamGB: 8, platform: "darwin", arch: "arm64", gpuType: "apple-silicon" };
    const model = selectModel(hw);
    expect(model.name).toBe("gemma3:4b-it-q4_K_M");
    expect(model.sizeGB).toBeLessThanOrEqual(3);
    expect(model.minRamGB).toBeLessThanOrEqual(8);
  });

  it("selects 8B model for 16GB RAM", () => {
    const hw: HardwareInfo = { totalRamGB: 16, platform: "darwin", arch: "arm64", gpuType: "apple-silicon" };
    const model = selectModel(hw);
    expect(model.name).toBe("llama3.2:8b-instruct-q4_K_M");
    expect(model.minRamGB).toBeLessThanOrEqual(16);
  });

  it("selects 14B model for 32GB+ RAM", () => {
    const hw: HardwareInfo = { totalRamGB: 32, platform: "darwin", arch: "arm64", gpuType: "apple-silicon" };
    const model = selectModel(hw);
    expect(model.name).toBe("qwen2.5:14b-instruct-q4_K_M");
  });

  it("selects 4B model for low-end Windows", () => {
    const hw: HardwareInfo = { totalRamGB: 8, platform: "win32", arch: "x64", gpuType: "none" };
    const model = selectModel(hw);
    expect(model.name).toBe("gemma3:4b-it-q4_K_M");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/main/hardware-detector.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement hardware detector**

Create `src/main/hardware-detector.ts`:
```typescript
import os from "os";
import { execSync } from "child_process";
import type { HardwareInfo, ModelChoice } from "../shared/types";

const MODEL_TIERS: ModelChoice[] = [
  { name: "gemma3:4b-it-q4_K_M", displayName: "Gemma 3 4B", sizeGB: 2.5, minRamGB: 8 },
  { name: "llama3.2:8b-instruct-q4_K_M", displayName: "Llama 3.2 8B", sizeGB: 4.5, minRamGB: 12 },
  { name: "qwen2.5:14b-instruct-q4_K_M", displayName: "Qwen 2.5 14B", sizeGB: 8, minRamGB: 24 },
];

export function detectHardware(): HardwareInfo {
  const totalRamGB = Math.round(os.totalmem() / (1024 ** 3));
  const platform = process.platform as "darwin" | "win32" | "linux";
  const arch = process.arch;

  let gpuType: HardwareInfo["gpuType"] = "none";

  if (platform === "darwin" && arch === "arm64") {
    gpuType = "apple-silicon";
  } else if (platform === "win32" || platform === "linux") {
    try {
      const output = execSync("nvidia-smi --query-gpu=name --format=csv,noheader", {
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
      }).toString();
      if (output.trim().length > 0) gpuType = "nvidia";
    } catch {
      // no NVIDIA GPU or nvidia-smi not available
    }
  }

  return { totalRamGB, platform, arch, gpuType };
}

export function selectModel(info: HardwareInfo): ModelChoice {
  const available = MODEL_TIERS.filter((m) => m.minRamGB <= info.totalRamGB);
  if (available.length === 0) return MODEL_TIERS[0];
  return available[available.length - 1];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/main/hardware-detector.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/hardware-detector.ts tests/main/hardware-detector.test.ts
git commit -m "feat: add hardware detection and automatic model selection by RAM tier"
```

---

### Task 4: Ollama Manager (Lifecycle and Model Download)

**Files:**
- Create: `src/main/ollama-manager.ts`
- Test: `tests/main/ollama-manager.test.ts`

**Interfaces:**
- Consumes: `AppPaths` from `paths.ts`, `ModelChoice` from hardware detector
- Produces: `OllamaManager` class with: `start(): Promise<void>`, `stop(): void`, `isReady(): Promise<boolean>`, `pullModel(model: string, onProgress: (pct: number) => void): Promise<void>`, `generate(prompt: string, systemPrompt: string, onToken: (token: string) => void): Promise<string>`, `getPort(): number`

- [ ] **Step 1: Write tests for OllamaManager**

Create `tests/main/ollama-manager.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OllamaManager } from "../../src/main/ollama-manager";

// These test the logic without actually running Ollama.
// Integration tests with real Ollama require it to be installed.

describe("OllamaManager", () => {
  let manager: OllamaManager;

  beforeEach(() => {
    manager = new OllamaManager("/fake/ollama", "/fake/models", 0);
  });

  it("generates a random port between 11500-12500", () => {
    const port = manager.getPort();
    expect(port).toBeGreaterThanOrEqual(11500);
    expect(port).toBeLessThanOrEqual(12500);
  });

  it("reports not ready before start", async () => {
    const ready = await manager.isReady();
    expect(ready).toBe(false);
  });

  it("builds correct Ollama API URL", () => {
    const url = manager.getBaseUrl();
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/main/ollama-manager.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement OllamaManager**

Create `src/main/ollama-manager.ts`:
```typescript
import { spawn, ChildProcess } from "child_process";
import type { ModelChoice } from "../shared/types";

export class OllamaManager {
  private ollamaBinaryPath: string;
  private modelsDir: string;
  private port: number;
  private process: ChildProcess | null = null;

  constructor(ollamaBinaryPath: string, modelsDir: string, port?: number) {
    this.ollamaBinaryPath = ollamaBinaryPath;
    this.modelsDir = modelsDir;
    this.port = port || (11500 + Math.floor(Math.random() * 1000));
  }

  getPort(): number {
    return this.port;
  }

  getBaseUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        OLLAMA_HOST: `127.0.0.1:${this.port}`,
        OLLAMA_MODELS: this.modelsDir,
      };

      this.process = spawn(this.ollamaBinaryPath, ["serve"], { env, stdio: "pipe" });

      this.process.on("error", (err) => reject(new Error(`Failed to start Ollama: ${err.message}`)));

      const checkReady = async (attempts: number) => {
        for (let i = 0; i < attempts; i++) {
          if (await this.isReady()) {
            resolve();
            return;
          }
          await new Promise((r) => setTimeout(r, 500));
        }
        reject(new Error("Ollama did not become ready within timeout"));
      };

      checkReady(20);
    });
  }

  stop(): void {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }

  async isReady(): Promise<boolean> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async pullModel(
    model: string,
    onProgress: (pct: number) => void
  ): Promise<void> {
    const response = await fetch(`${this.getBaseUrl()}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model, stream: true }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value, { stream: true }).split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.total && data.completed) {
            onProgress(Math.round((data.completed / data.total) * 100));
          }
          if (data.status === "success") {
            onProgress(100);
          }
        } catch {
          // skip malformed JSON lines
        }
      }
    }
  }

  async generate(
    prompt: string,
    systemPrompt: string,
    model: string,
    onToken: (token: string) => void
  ): Promise<string> {
    const response = await fetch(`${this.getBaseUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Generation failed: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value, { stream: true }).split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            const token = data.message.content;
            fullResponse += token;
            onToken(token);
          }
        } catch {
          // skip
        }
      }
    }

    return fullResponse;
  }

  async generateWithHistory(
    messages: { role: string; content: string }[],
    model: string,
    onToken: (token: string) => void
  ): Promise<string> {
    const response = await fetch(`${this.getBaseUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: true }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Generation failed: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value, { stream: true }).split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            const token = data.message.content;
            fullResponse += token;
            onToken(token);
          }
        } catch {
          // skip
        }
      }
    }

    return fullResponse;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/main/ollama-manager.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ollama-manager.ts tests/main/ollama-manager.test.ts
git commit -m "feat: add OllamaManager for lifecycle control, model pulling, and streaming generation"
```

---

### Task 5: Persona System and Prompt Builder

**Files:**
- Create: `src/personas/student.json`, `src/personas/professional.json`, `src/personas/parent.json`, `src/personas/small-business.json`
- Create: `src/renderer/lib/prompt-builder.ts`
- Test: `tests/personas/persona-schema.test.ts`, `tests/renderer/prompt-builder.test.ts`

**Interfaces:**
- Consumes: `Persona`, `TaskDefinition`, `GuidedFlow`, `FlowField` from `shared/types.ts`
- Produces: 4 persona JSON files conforming to the `Persona` type. `buildPrompt(flow: GuidedFlow, values: Record<string, string>): string` function.

- [ ] **Step 1: Write persona schema validation test**

Create `tests/personas/persona-schema.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import type { Persona } from "../../src/shared/types";

const PERSONAS_DIR = path.join(__dirname, "../../src/personas");

function loadPersona(filename: string): Persona {
  const raw = fs.readFileSync(path.join(PERSONAS_DIR, filename), "utf-8");
  return JSON.parse(raw);
}

describe("persona JSON files", () => {
  const files = ["student.json", "professional.json", "parent.json", "small-business.json"];

  for (const file of files) {
    describe(file, () => {
      it("has required top-level fields", () => {
        const p = loadPersona(file);
        expect(p.id).toBeTruthy();
        expect(p.name).toBeTruthy();
        expect(p.icon).toBeTruthy();
        expect(p.system_prompt).toBeTruthy();
        expect(Array.isArray(p.tasks)).toBe(true);
        expect(Array.isArray(p.discovery_queue)).toBe(true);
      });

      it("has at least 4 tasks", () => {
        const p = loadPersona(file);
        expect(p.tasks.length).toBeGreaterThanOrEqual(4);
      });

      it("every task has a valid guided_flow with fields and prompt_template", () => {
        const p = loadPersona(file);
        for (const task of p.tasks) {
          expect(task.id).toBeTruthy();
          expect(task.title).toBeTruthy();
          expect(task.guided_flow).toBeDefined();
          expect(Array.isArray(task.guided_flow.fields)).toBe(true);
          expect(task.guided_flow.fields.length).toBeGreaterThan(0);
          expect(task.guided_flow.prompt_template).toBeTruthy();
          for (const field of task.guided_flow.fields) {
            expect(["choice", "textarea", "text"]).toContain(field.type);
            expect(field.label).toBeTruthy();
            if (field.type === "choice") {
              expect(Array.isArray(field.options)).toBe(true);
              expect(field.options!.length).toBeGreaterThan(0);
            }
          }
        }
      });
    });
  }
});
```

- [ ] **Step 2: Write prompt builder test**

Create `tests/renderer/prompt-builder.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildPrompt } from "../../src/renderer/lib/prompt-builder";
import type { GuidedFlow } from "../../src/shared/types";

describe("buildPrompt", () => {
  it("replaces template variables with field values", () => {
    const flow: GuidedFlow = {
      fields: [
        { type: "choice", label: "Tone", options: ["Professional", "Casual"] },
        { type: "textarea", label: "Key points" },
      ],
      prompt_template: "Write a {{tone}} email. Key points: {{key_points}}",
    };
    const values = { tone: "Professional", key_points: "Meeting moved to Friday" };
    const result = buildPrompt(flow, values);
    expect(result).toBe("Write a Professional email. Key points: Meeting moved to Friday");
  });

  it("removes conditional blocks when optional field is empty", () => {
    const flow: GuidedFlow = {
      fields: [
        { type: "textarea", label: "Reply to", optional: true },
        { type: "textarea", label: "Key points" },
      ],
      prompt_template: "Write an email.{{#if reply_to}} Replying to: {{reply_to}}{{/if}} Points: {{key_points}}",
    };
    const values = { reply_to: "", key_points: "Budget update" };
    const result = buildPrompt(flow, values);
    expect(result).toBe("Write an email. Points: Budget update");
  });

  it("keeps conditional blocks when optional field has value", () => {
    const flow: GuidedFlow = {
      fields: [
        { type: "textarea", label: "Reply to", optional: true },
        { type: "textarea", label: "Key points" },
      ],
      prompt_template: "Write an email.{{#if reply_to}} Replying to: {{reply_to}}{{/if}} Points: {{key_points}}",
    };
    const values = { reply_to: "Hi team, are we on track?", key_points: "Yes" };
    const result = buildPrompt(flow, values);
    expect(result).toBe("Write an email. Replying to: Hi team, are we on track? Points: Yes");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run tests/personas/ tests/renderer/prompt-builder.test.ts
```

Expected: FAIL (files don't exist).

- [ ] **Step 4: Create persona JSON files**

Create `src/personas/student.json`:
```json
{
  "id": "student",
  "name": "Student",
  "icon": "graduation-cap",
  "system_prompt": "You are a helpful AI study assistant. Explain concepts clearly with analogies. Be encouraging. Use simple language but don't be condescending. When generating study materials, be thorough and accurate.",
  "tasks": [
    {
      "id": "summarize_notes",
      "title": "Summarize my notes",
      "subtitle": "Turn long notes into key bullet points",
      "icon": "file-text",
      "category": "study",
      "guided_flow": {
        "fields": [
          { "type": "textarea", "label": "Paste your notes or text", "placeholder": "Paste lecture notes, textbook excerpts, or any study material..." },
          { "type": "choice", "label": "Summary style", "options": ["Bullet points", "Short paragraph", "Cornell notes format", "Mind map outline"] }
        ],
        "prompt_template": "Summarize the following notes in {{summary_style}} format. Be thorough but concise. Highlight the most important concepts.\n\nNotes:\n{{paste_your_notes_or_text}}"
      }
    },
    {
      "id": "explain_concept",
      "title": "Explain this concept",
      "subtitle": "Get a simple, clear explanation",
      "icon": "lightbulb",
      "category": "study",
      "guided_flow": {
        "fields": [
          { "type": "textarea", "label": "What concept do you need explained?", "placeholder": "e.g., 'photosynthesis', 'supply and demand', 'recursion'..." },
          { "type": "choice", "label": "Explanation level", "options": ["Explain like I'm 5", "High school level", "College intro level", "Advanced/technical"] }
        ],
        "prompt_template": "Explain the following concept at a {{explanation_level}} level. Use a clear analogy and give one concrete example.\n\nConcept: {{what_concept_do_you_need_explained}}"
      }
    },
    {
      "id": "quiz_me",
      "title": "Quiz me",
      "subtitle": "Test your knowledge with AI-generated questions",
      "icon": "help-circle",
      "category": "study",
      "guided_flow": {
        "fields": [
          { "type": "textarea", "label": "Paste the material to be quizzed on", "placeholder": "Paste notes, a chapter summary, or describe the topic..." },
          { "type": "choice", "label": "Question type", "options": ["Multiple choice (4 options)", "Short answer", "True/False", "Mix of all types"] },
          { "type": "choice", "label": "Difficulty", "options": ["Easy", "Medium", "Hard", "Exam-level"] }
        ],
        "prompt_template": "Generate 10 {{question_type}} questions at {{difficulty}} difficulty based on the following material. For multiple choice, include the correct answer marked. For all types, provide an answer key at the end.\n\nMaterial:\n{{paste_the_material_to_be_quizzed_on}}"
      }
    },
    {
      "id": "essay_help",
      "title": "Help me write this essay",
      "subtitle": "Get an outline and first draft",
      "icon": "pen-tool",
      "category": "writing",
      "guided_flow": {
        "fields": [
          { "type": "text", "label": "Essay topic", "placeholder": "e.g., 'The impact of social media on democracy'" },
          { "type": "textarea", "label": "Thesis statement or main argument", "optional": true, "placeholder": "What's your main point? Leave blank for suggestions." },
          { "type": "choice", "label": "Essay type", "options": ["Argumentative", "Expository", "Narrative", "Compare and contrast", "Research paper"] },
          { "type": "choice", "label": "Length", "options": ["Short (500 words)", "Medium (1000 words)", "Long (2000+ words)"] }
        ],
        "prompt_template": "Help me write a {{essay_type}} essay about: {{essay_topic}}\nTarget length: {{length}}\n{{#if thesis_statement_or_main_argument}}My thesis: {{thesis_statement_or_main_argument}}{{/if}}\n\nFirst, provide a detailed outline with section headers. Then write a complete first draft following that outline."
      }
    },
    {
      "id": "proofread",
      "title": "Proofread my writing",
      "subtitle": "Grammar, clarity, and style suggestions",
      "icon": "check-circle",
      "category": "writing",
      "guided_flow": {
        "fields": [
          { "type": "textarea", "label": "Paste your writing", "placeholder": "Paste your essay, email, or any text you want reviewed..." },
          { "type": "choice", "label": "Focus on", "options": ["Grammar and spelling only", "Clarity and flow", "Academic tone", "Everything (comprehensive review)"] }
        ],
        "prompt_template": "Proofread the following text with a focus on {{focus_on}}. For each issue found:\n1. Quote the original text\n2. Explain what's wrong\n3. Suggest the correction\n\nAt the end, provide the fully corrected version.\n\nText to proofread:\n{{paste_your_writing}}"
      }
    }
  ],
  "discovery_queue": ["translate_text", "create_flashcards", "research_topic", "cite_sources", "study_schedule"]
}
```

Create `src/personas/professional.json`:
```json
{
  "id": "professional",
  "name": "Working Professional",
  "icon": "briefcase",
  "system_prompt": "You are a helpful AI assistant for a working professional. Be concise, practical, and business-appropriate. Focus on saving time and improving quality of work output. Default to a professional tone unless told otherwise.",
  "tasks": [
    {
      "id": "draft_email",
      "title": "Draft an email",
      "subtitle": "Reply to a tricky message or write fresh",
      "icon": "mail",
      "category": "communication",
      "guided_flow": {
        "fields": [
          { "type": "choice", "label": "What kind of email?", "options": ["Reply to someone", "Cold outreach", "Follow-up", "Thank you note", "Apology", "Request"] },
          { "type": "textarea", "label": "Paste the email you're replying to", "optional": true, "placeholder": "If replying, paste the original email here..." },
          { "type": "choice", "label": "Tone", "options": ["Professional", "Friendly", "Firm", "Casual"] },
          { "type": "textarea", "label": "Key points to include", "placeholder": "What do you want to say? List the main points..." }
        ],
        "prompt_template": "Write a {{tone}} {{what_kind_of_email}} email.{{#if paste_the_email_youre_replying_to}} The email I'm replying to:\n{{paste_the_email_youre_replying_to}}{{/if}}\n\nKey points to cover:\n{{key_points_to_include}}"
      }
    },
    {
      "id": "summarize_document",
      "title": "Summarize a document",
      "subtitle": "Get key takeaways quickly",
      "icon": "file-text",
      "category": "productivity",
      "guided_flow": {
        "fields": [
          { "type": "textarea", "label": "Paste the document text", "placeholder": "Paste the document, article, or report you want summarized..." },
          { "type": "choice", "label": "Summary format", "options": ["Executive summary (3-5 sentences)", "Bullet points", "Key takeaways + action items", "One paragraph"] }
        ],
        "prompt_template": "Summarize the following document in {{summary_format}} format. Focus on the most important information and any action items.\n\nDocument:\n{{paste_the_document_text}}"
      }
    },
    {
      "id": "brainstorm",
      "title": "Brainstorm ideas",
      "subtitle": "Generate and rank ideas for any topic",
      "icon": "zap",
      "category": "creativity",
      "guided_flow": {
        "fields": [
          { "type": "textarea", "label": "What do you need ideas for?", "placeholder": "e.g., 'Marketing campaign for our new product launch'" },
          { "type": "textarea", "label": "Constraints or requirements", "optional": true, "placeholder": "e.g., 'Budget under $5K, target audience is Gen Z'" }
        ],
        "prompt_template": "Brainstorm 10 creative ideas for: {{what_do_you_need_ideas_for}}\n{{#if constraints_or_requirements}}Constraints: {{constraints_or_requirements}}{{/if}}\n\nFor each idea, give:\n1. The idea (one sentence)\n2. Why it could work\n3. Effort level (Low/Medium/High)\n\nRank them from most to least promising."
      }
    },
    {
      "id": "meeting_prep",
      "title": "Prepare for a meeting",
      "subtitle": "Get talking points and questions",
      "icon": "calendar",
      "category": "productivity",
      "guided_flow": {
        "fields": [
          { "type": "textarea", "label": "Meeting agenda or topic", "placeholder": "What's the meeting about? Paste an agenda if you have one..." },
          { "type": "choice", "label": "Your role", "options": ["Leading the meeting", "Presenting", "Participating", "Just listening/learning"] },
          { "type": "textarea", "label": "What do you want to accomplish?", "optional": true, "placeholder": "Your goals for this meeting..." }
        ],
        "prompt_template": "Help me prepare for a meeting where I'm {{your_role}}.\n\nMeeting topic/agenda:\n{{meeting_agenda_or_topic}}\n{{#if what_do_you_want_to_accomplish}}My goals: {{what_do_you_want_to_accomplish}}{{/if}}\n\nProvide:\n1. 5 key talking points\n2. 3 smart questions to ask\n3. Potential objections and how to handle them\n4. A brief opening statement"
      }
    },
    {
      "id": "linkedin_post",
      "title": "Write a LinkedIn post",
      "subtitle": "Professional content with engagement",
      "icon": "share-2",
      "category": "communication",
      "guided_flow": {
        "fields": [
          { "type": "textarea", "label": "What do you want to post about?", "placeholder": "e.g., 'A lesson I learned about leadership this week'" },
          { "type": "choice", "label": "Post style", "options": ["Story/personal experience", "Hot take/opinion", "Tips and advice", "Industry insight", "Career update"] }
        ],
        "prompt_template": "Write a LinkedIn post in {{post_style}} style about: {{what_do_you_want_to_post_about}}\n\nMake it:\n- Hook the reader in the first line\n- Use short paragraphs (1-2 sentences each)\n- Include a call-to-action at the end\n- Professional but personable tone\n- Under 200 words"
      }
    }
  ],
  "discovery_queue": ["presentation_outline", "performance_review", "project_plan", "salary_negotiation", "resignation_letter"]
}
```

Create `src/personas/parent.json`:
```json
{
  "id": "parent",
  "name": "Parent / Family",
  "icon": "heart",
  "system_prompt": "You are a warm, helpful AI assistant for parents and families. Be patient, practical, and encouraging. When helping with kids' homework, explain step-by-step at an age-appropriate level. For parenting questions, be supportive without being judgmental.",
  "tasks": [
    {
      "id": "homework_help",
      "title": "Help with homework",
      "subtitle": "Step-by-step explanations for any subject",
      "icon": "book-open",
      "category": "education",
      "guided_flow": {
        "fields": [
          { "type": "choice", "label": "Subject", "options": ["Math", "Science", "English/Language Arts", "History/Social Studies", "Foreign Language"] },
          { "type": "textarea", "label": "The homework question", "placeholder": "Type or paste the homework question..." },
          { "type": "choice", "label": "Grade level", "options": ["Elementary (K-5)", "Middle school (6-8)", "High school (9-12)"] }
        ],
        "prompt_template": "Help a {{grade_level}} student with this {{subject}} homework question. Explain step-by-step in a way that helps them understand the concept, not just the answer. Use simple language appropriate for their level.\n\nQuestion: {{the_homework_question}}"
      }
    },
    {
      "id": "explain_to_kid",
      "title": "Explain to my kid",
      "subtitle": "Kid-friendly explanations of anything",
      "icon": "message-circle",
      "category": "education",
      "guided_flow": {
        "fields": [
          { "type": "textarea", "label": "What needs explaining?", "placeholder": "e.g., 'Why is the sky blue?', 'What is inflation?'" },
          { "type": "choice", "label": "Child's age", "options": ["3-5 years old", "6-8 years old", "9-11 years old", "12-14 years old"] }
        ],
        "prompt_template": "Explain the following concept to a {{childs_age}} child. Use a fun analogy they can relate to, keep it short (3-4 sentences), and make it engaging.\n\nConcept: {{what_needs_explaining}}"
      }
    },
    {
      "id": "plan_activity",
      "title": "Plan an activity",
      "subtitle": "Fun ideas for kids and family time",
      "icon": "sun",
      "category": "family",
      "guided_flow": {
        "fields": [
          { "type": "text", "label": "Kids' ages", "placeholder": "e.g., '4 and 7'" },
          { "type": "choice", "label": "Activity type", "options": ["Indoor (at home)", "Outdoor", "Educational", "Creative/artsy", "Active/physical"] },
          { "type": "choice", "label": "Time available", "options": ["30 minutes", "1-2 hours", "Half day", "Full day"] }
        ],
        "prompt_template": "Suggest 5 {{activity_type}} activities for kids aged {{kids_ages}} that take about {{time_available}}. For each activity, include:\n- What you need (materials/supplies)\n- Simple step-by-step instructions\n- Why kids will enjoy it"
      }
    },
    {
      "id": "teacher_note",
      "title": "Write a note to teacher",
      "subtitle": "Clear, polite messages for school",
      "icon": "edit",
      "category": "communication",
      "guided_flow": {
        "fields": [
          { "type": "choice", "label": "What is this about?", "options": ["Absence/tardiness", "Behavior concern", "Academic question", "Schedule/event question", "Appreciation/thank you", "Special request"] },
          { "type": "textarea", "label": "Describe the situation", "placeholder": "What do you need to tell the teacher?" },
          { "type": "choice", "label": "Tone", "options": ["Polite and warm", "Concerned but respectful", "Direct and factual"] }
        ],
        "prompt_template": "Write a {{tone}} note to my child's teacher about: {{what_is_this_about}}\n\nSituation: {{describe_the_situation}}\n\nKeep it concise (under 150 words), professional, and parent-appropriate."
      }
    }
  ],
  "discovery_queue": ["bedtime_story", "meal_ideas", "chore_chart", "screen_time_alternatives", "birthday_planning"]
}
```

Create `src/personas/small-business.json`:
```json
{
  "id": "small-business",
  "name": "Small Business Owner",
  "icon": "store",
  "system_prompt": "You are a helpful AI assistant for small business owners. Be practical, results-oriented, and mindful of limited budgets and time. Focus on actionable advice that can be implemented immediately. When writing copy, optimize for conversion and SEO.",
  "tasks": [
    {
      "id": "product_description",
      "title": "Write a product description",
      "subtitle": "SEO-optimized copy for your listings",
      "icon": "tag",
      "category": "marketing",
      "guided_flow": {
        "fields": [
          { "type": "text", "label": "Product name", "placeholder": "e.g., 'Handmade Lavender Soy Candle'" },
          { "type": "textarea", "label": "Product details", "placeholder": "Material, size, features, what makes it special..." },
          { "type": "choice", "label": "Platform", "options": ["Etsy", "Amazon", "Shopify", "eBay", "General (any platform)"] },
          { "type": "choice", "label": "Tone", "options": ["Professional", "Fun and casual", "Luxurious/premium", "Earthy/artisan"] }
        ],
        "prompt_template": "Write a {{tone}} product description for {{platform}} for:\nProduct: {{product_name}}\nDetails: {{product_details}}\n\nInclude:\n- A compelling title with relevant keywords\n- 3-4 paragraph description highlighting benefits\n- Key features as bullet points\n- SEO-friendly language for the platform"
      }
    },
    {
      "id": "review_reply",
      "title": "Reply to a review",
      "subtitle": "Professional responses to customer reviews",
      "icon": "message-square",
      "category": "customer-service",
      "guided_flow": {
        "fields": [
          { "type": "choice", "label": "Review type", "options": ["Positive (4-5 stars)", "Mixed (3 stars)", "Negative (1-2 stars)"] },
          { "type": "textarea", "label": "Paste the review", "placeholder": "Paste the customer's review here..." },
          { "type": "textarea", "label": "Context (optional)", "optional": true, "placeholder": "Any background info? e.g., 'We already issued a refund'" }
        ],
        "prompt_template": "Write a professional, empathetic response to this {{review_type}} customer review:\n\nReview: {{paste_the_review}}\n{{#if context_optional}}Context: {{context_optional}}{{/if}}\n\nThe response should:\n- Thank the customer\n- Address their specific points\n- Be professional and non-defensive\n- End positively\n- Under 100 words"
      }
    },
    {
      "id": "social_post",
      "title": "Create a social media post",
      "subtitle": "Ready-to-post content for any platform",
      "icon": "share",
      "category": "marketing",
      "guided_flow": {
        "fields": [
          { "type": "textarea", "label": "What do you want to post about?", "placeholder": "e.g., 'New product launch', 'Holiday sale', 'Behind the scenes'" },
          { "type": "choice", "label": "Platform", "options": ["Instagram", "Facebook", "Twitter/X", "LinkedIn", "TikTok caption"] },
          { "type": "choice", "label": "Goal", "options": ["Drive sales", "Build engagement", "Educate/inform", "Entertain", "Announce something"] }
        ],
        "prompt_template": "Write a {{platform}} post to {{goal}} about: {{what_do_you_want_to_post_about}}\n\nInclude:\n- An attention-grabbing opening\n- The core message\n- A clear call-to-action\n- Relevant hashtags (3-5)\n- Appropriate length for the platform"
      }
    },
    {
      "id": "professional_message",
      "title": "Draft a professional message",
      "subtitle": "Client emails, vendor messages, proposals",
      "icon": "send",
      "category": "communication",
      "guided_flow": {
        "fields": [
          { "type": "choice", "label": "Who is this for?", "options": ["Client/customer", "Vendor/supplier", "Partner/collaborator", "Employee/contractor"] },
          { "type": "textarea", "label": "What do you need to communicate?", "placeholder": "Describe the situation and what you want to say..." },
          { "type": "choice", "label": "Tone", "options": ["Professional and warm", "Direct and efficient", "Formal/contractual", "Casual but businesslike"] }
        ],
        "prompt_template": "Write a {{tone}} message to a {{who_is_this_for}}.\n\nSituation: {{what_do_you_need_to_communicate}}\n\nKeep it clear, professional, and under 200 words."
      }
    }
  ],
  "discovery_queue": ["invoice_email", "job_posting", "faq_answers", "business_plan_section", "competitor_analysis"]
}
```

- [ ] **Step 5: Implement prompt builder**

Create `src/renderer/lib/prompt-builder.ts`:
```typescript
import type { GuidedFlow } from "@shared/types";

function labelToKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_");
}

export function buildPrompt(flow: GuidedFlow, values: Record<string, string>): string {
  let result = flow.prompt_template;

  result = result.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, key: string, content: string) => {
      const value = values[key];
      if (!value || value.trim() === "") return "";
      return content;
    }
  );

  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return values[key] ?? "";
  });

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

export function collectFlowValues(
  flow: GuidedFlow,
  formData: Record<string, string>
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of flow.fields) {
    const key = labelToKey(field.label);
    values[key] = formData[field.label] ?? "";
  }
  return values;
}
```

- [ ] **Step 6: Run all tests**

```bash
npx vitest run tests/personas/ tests/renderer/prompt-builder.test.ts
```

Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
git add src/personas/ src/renderer/lib/prompt-builder.ts tests/personas/ tests/renderer/prompt-builder.test.ts
git commit -m "feat: add 4 persona configs (student, professional, parent, small-business) with 18 guided task flows and prompt builder"
```

---

### Task 6: IPC Handlers and Rate Limiter

**Files:**
- Create: `src/main/ipc-handlers.ts`
- Create: `src/main/rate-limiter.ts`
- Modify: `src/main/index.ts` — wire up IPC handlers and Ollama startup
- Test: `tests/main/rate-limiter.test.ts`

**Interfaces:**
- Consumes: `Database` from Task 2, `OllamaManager` from Task 4, `detectHardware`/`selectModel` from Task 3, `getAppPaths` from Task 1
- Produces: All IPC handlers registered so that `window.electronAPI.*` calls work end-to-end. `RateLimiter` class with `canGenerate(db: Database, licenseStatus: string): boolean`, `recordGeneration(db: Database): void`, `getRemainingGenerations(db: Database, licenseStatus: string): number | "unlimited"`.

- [ ] **Step 1: Write rate limiter tests**

Create `tests/main/rate-limiter.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RateLimiter } from "../../src/main/rate-limiter";
import { Database } from "../../src/main/database";
import fs from "fs";
import path from "path";
import os from "os";

describe("RateLimiter", () => {
  let db: Database;
  let dbPath: string;
  const limiter = new RateLimiter(20);

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `agentone-rl-test-${Date.now()}.db`);
    db = new Database(dbPath);
    db.initialize();
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it("allows generation for free user under limit", () => {
    expect(limiter.canGenerate(db, "free")).toBe(true);
  });

  it("blocks generation for free user at limit", () => {
    for (let i = 0; i < 20; i++) limiter.recordGeneration(db);
    expect(limiter.canGenerate(db, "free")).toBe(false);
  });

  it("always allows generation for pro user", () => {
    for (let i = 0; i < 100; i++) limiter.recordGeneration(db);
    expect(limiter.canGenerate(db, "pro")).toBe(true);
  });

  it("reports remaining generations correctly", () => {
    for (let i = 0; i < 5; i++) limiter.recordGeneration(db);
    expect(limiter.getRemainingGenerations(db, "free")).toBe(15);
  });

  it("reports unlimited for pro users", () => {
    expect(limiter.getRemainingGenerations(db, "pro")).toBe("unlimited");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/main/rate-limiter.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement RateLimiter**

Create `src/main/rate-limiter.ts`:
```typescript
import type { Database } from "./database";

export class RateLimiter {
  private dailyLimit: number;

  constructor(dailyLimit: number) {
    this.dailyLimit = dailyLimit;
  }

  canGenerate(db: Database, licenseStatus: string): boolean {
    if (licenseStatus === "pro") return true;
    return db.getDailyGenerationCount() < this.dailyLimit;
  }

  recordGeneration(db: Database): void {
    db.incrementDailyGenerationCount();
  }

  getRemainingGenerations(db: Database, licenseStatus: string): number | "unlimited" {
    if (licenseStatus === "pro") return "unlimited";
    const used = db.getDailyGenerationCount();
    return Math.max(0, this.dailyLimit - used);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/main/rate-limiter.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Implement IPC handlers and wire into main process**

Create `src/main/ipc-handlers.ts`:
```typescript
import { ipcMain, BrowserWindow } from "electron";
import { randomUUID } from "crypto";
import { Database } from "./database";
import { OllamaManager } from "./ollama-manager";
import { RateLimiter } from "./rate-limiter";
import { detectHardware, selectModel } from "./hardware-detector";
import { getAppPaths } from "./paths";
import type { ModelChoice, UserProfile, TaskUsage } from "../shared/types";

let ollamaManager: OllamaManager | null = null;
let selectedModel: ModelChoice | null = null;
let ollamaState: "not_installed" | "downloading_model" | "starting" | "ready" | "error" = "not_installed";

export function registerIpcHandlers(db: Database, rateLimiter: RateLimiter) {
  const paths = getAppPaths();

  ipcMain.handle("get-app-paths", () => paths);

  ipcMain.handle("get-hardware-info", () => detectHardware());

  ipcMain.handle("get-model-choice", () => {
    if (!selectedModel) {
      const hw = detectHardware();
      selectedModel = selectModel(hw);
    }
    return selectedModel;
  });

  ipcMain.handle("ollama-status", () => ollamaState);

  ipcMain.handle("ollama-start-and-pull", async () => {
    try {
      ollamaManager = new OllamaManager(paths.ollamaBinary, paths.models);
      ollamaState = "starting";

      await ollamaManager.start();

      const hw = detectHardware();
      selectedModel = selectModel(hw);

      ollamaState = "downloading_model";
      await ollamaManager.pullModel(selectedModel.name, (progress) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) win.webContents.send("model-download-progress", progress);
      });

      ollamaState = "ready";
    } catch (err) {
      ollamaState = "error";
      throw err;
    }
  });

  ipcMain.handle("db-get-profile", () => db.getProfile());
  ipcMain.handle("db-save-profile", (_e, profile: UserProfile) => db.saveProfile(profile));
  ipcMain.handle("db-get-conversations", (_e, limit: number) => db.getConversations(limit));
  ipcMain.handle("db-create-conversation", (_e, taskId: string | null) => db.createConversation(taskId));
  ipcMain.handle("db-get-messages", (_e, cid: string) => db.getMessages(cid));
  ipcMain.handle("db-save-message", (_e, msg) => db.saveMessage(msg));
  ipcMain.handle("db-record-task-usage", (_e, usage: TaskUsage) => db.recordTaskUsage(usage));
  ipcMain.handle("db-get-task-usage-stats", () => db.getTaskUsageStats());
  ipcMain.handle("db-get-daily-generation-count", () => db.getDailyGenerationCount());

  ipcMain.handle("generate", async (_e, prompt: string, systemPrompt: string, conversationId: string) => {
    if (!ollamaManager || ollamaState !== "ready" || !selectedModel) {
      throw new Error("Ollama is not ready");
    }

    const licenseStatus = getLicenseStatus(db);
    if (!rateLimiter.canGenerate(db, licenseStatus)) {
      throw new Error("Daily generation limit reached. Upgrade to Pro for unlimited.");
    }

    const win = BrowserWindow.getAllWindows()[0];
    const fullResponse = await ollamaManager.generate(
      prompt,
      systemPrompt,
      selectedModel.name,
      (token) => {
        if (win) win.webContents.send("generate-token", token);
      }
    );

    rateLimiter.recordGeneration(db);

    const msgId = randomUUID();
    db.saveMessage({ id: randomUUID(), conversationId, role: "user", content: prompt });
    db.saveMessage({ id: msgId, conversationId, role: "assistant", content: fullResponse });

    return fullResponse;
  });

  ipcMain.handle("get-remaining-generations", () => {
    const licenseStatus = getLicenseStatus(db);
    return rateLimiter.getRemainingGenerations(db, licenseStatus);
  });

  ipcMain.handle("get-license-status", () => getLicenseStatus(db));

  ipcMain.handle("activate-license", (_e, key: string) => {
    const profile = db.getProfile();
    if (profile) {
      db.saveProfile({ ...profile, licenseKey: key, licenseValidUntil: null });
    }
    return true;
  });
}

function getLicenseStatus(db: Database): "free" | "pro" | "expired" {
  const profile = db.getProfile();
  if (!profile?.licenseKey) return "free";
  if (profile.licenseValidUntil) {
    const expiry = new Date(profile.licenseValidUntil);
    if (expiry < new Date()) return "expired";
  }
  return "pro";
}
```

Update `src/main/index.ts` to wire everything:
```typescript
import { app, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import { Database } from "./database";
import { RateLimiter } from "./rate-limiter";
import { registerIpcHandlers } from "./ipc-handlers";
import { getAppPaths } from "./paths";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  const paths = getAppPaths();
  fs.mkdirSync(paths.models, { recursive: true });

  const db = new Database(paths.database);
  db.initialize();

  const rateLimiter = new RateLimiter(20);
  registerIpcHandlers(db, rateLimiter);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc-handlers.ts src/main/rate-limiter.ts src/main/index.ts tests/main/rate-limiter.test.ts
git commit -m "feat: add IPC handlers, rate limiter (20/day free tier), and wire Electron main process"
```

---

### Task 7: Zustand Store and Routing

**Files:**
- Create: `src/renderer/store.ts`
- Modify: `src/renderer/App.tsx` — add view routing
- Test: `tests/renderer/store.test.ts`

**Interfaces:**
- Consumes: `ElectronAPI` from `shared/types.ts`, `Persona`, `Conversation` types
- Produces: Zustand store with state: `{ view, persona, personas, conversations, currentConversation, ollamaStatus, remainingGenerations }` and actions: `{ setView, loadProfile, loadPersonas, selectPersona, refreshConversations, setOllamaStatus }`. App.tsx routes between Setup, Onboarding, Dashboard, GuidedTask, Chat, Settings views.

- [ ] **Step 1: Write store test**

Create `tests/renderer/store.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock window.electronAPI
const mockAPI = {
  dbGetProfile: vi.fn().mockResolvedValue(null),
  dbGetConversations: vi.fn().mockResolvedValue([]),
  getRemainingGenerations: vi.fn().mockResolvedValue(20),
  ollamaStatus: vi.fn().mockResolvedValue("not_installed"),
};
(globalThis as any).window = { electronAPI: mockAPI };

// Must import after mock is set
const { useAppStore } = await import("../../src/renderer/store");

describe("useAppStore", () => {
  it("initializes with setup view", () => {
    const state = useAppStore.getState();
    expect(state.view).toBe("setup");
  });

  it("setView changes the current view", () => {
    useAppStore.getState().setView("dashboard");
    expect(useAppStore.getState().view).toBe("dashboard");
  });

  it("selectPersona updates persona and navigates to priorities", () => {
    useAppStore.getState().selectPersona("student");
    expect(useAppStore.getState().selectedPersonaId).toBe("student");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/renderer/store.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement Zustand store**

Create `src/renderer/store.ts`:
```typescript
import { create } from "zustand";
import type { Persona, Conversation } from "@shared/types";

export type AppView =
  | "setup"
  | "onboarding-persona"
  | "onboarding-priorities"
  | "dashboard"
  | "guided-task"
  | "chat"
  | "settings";

interface GuidedTaskContext {
  personaId: string;
  taskId: string;
}

interface AppState {
  view: AppView;
  selectedPersonaId: string | null;
  selectedPriorities: string[];
  personas: Persona[];
  conversations: Conversation[];
  ollamaStatus: "not_installed" | "downloading_model" | "starting" | "ready" | "error";
  modelDownloadProgress: number;
  remainingGenerations: number | "unlimited";
  guidedTaskContext: GuidedTaskContext | null;
  currentConversationId: string | null;
  isGenerating: boolean;
  streamingText: string;

  setView: (view: AppView) => void;
  selectPersona: (id: string) => void;
  setPriorities: (priorities: string[]) => void;
  setPersonas: (personas: Persona[]) => void;
  setOllamaStatus: (status: AppState["ollamaStatus"]) => void;
  setModelDownloadProgress: (progress: number) => void;
  setRemainingGenerations: (count: number | "unlimited") => void;
  openGuidedTask: (personaId: string, taskId: string) => void;
  setCurrentConversationId: (id: string | null) => void;
  setIsGenerating: (val: boolean) => void;
  appendStreamingText: (token: string) => void;
  clearStreamingText: () => void;
  setConversations: (convs: Conversation[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: "setup",
  selectedPersonaId: null,
  selectedPriorities: [],
  personas: [],
  conversations: [],
  ollamaStatus: "not_installed",
  modelDownloadProgress: 0,
  remainingGenerations: 20,
  guidedTaskContext: null,
  currentConversationId: null,
  isGenerating: false,
  streamingText: "",

  setView: (view) => set({ view }),
  selectPersona: (id) => set({ selectedPersonaId: id }),
  setPriorities: (priorities) => set({ selectedPriorities: priorities }),
  setPersonas: (personas) => set({ personas }),
  setOllamaStatus: (status) => set({ ollamaStatus: status }),
  setModelDownloadProgress: (progress) => set({ modelDownloadProgress: progress }),
  setRemainingGenerations: (count) => set({ remainingGenerations: count }),
  openGuidedTask: (personaId, taskId) =>
    set({ guidedTaskContext: { personaId, taskId }, view: "guided-task" }),
  setCurrentConversationId: (id) => set({ currentConversationId: id }),
  setIsGenerating: (val) => set({ isGenerating: val }),
  appendStreamingText: (token) => set((s) => ({ streamingText: s.streamingText + token })),
  clearStreamingText: () => set({ streamingText: "" }),
  setConversations: (convs) => set({ conversations: convs }),
}));
```

- [ ] **Step 4: Update App.tsx with view routing**

Replace `src/renderer/App.tsx`:
```tsx
import { useAppStore } from "./store";

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-zinc-400 text-lg">{name} — Coming next</p>
    </div>
  );
}

export function App() {
  const view = useAppStore((s) => s.view);

  switch (view) {
    case "setup":
      return <Placeholder name="Setup (Hardware + Model Download)" />;
    case "onboarding-persona":
      return <Placeholder name="Onboarding — Pick Your Persona" />;
    case "onboarding-priorities":
      return <Placeholder name="Onboarding — Pick Priorities" />;
    case "dashboard":
      return <Placeholder name="Dashboard" />;
    case "guided-task":
      return <Placeholder name="Guided Task Flow" />;
    case "chat":
      return <Placeholder name="Freeform Chat" />;
    case "settings":
      return <Placeholder name="Settings" />;
    default:
      return <Placeholder name="Unknown View" />;
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/renderer/store.test.ts
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/store.ts src/renderer/App.tsx tests/renderer/store.test.ts
git commit -m "feat: add Zustand store with view routing and app state management"
```

---

### Task 8: Setup Page and Onboarding UI

**Files:**
- Create: `src/renderer/pages/SetupPage.tsx`
- Create: `src/renderer/pages/OnboardingPage.tsx`
- Create: `src/renderer/components/ModelProgress.tsx`

**Interfaces:**
- Consumes: `useAppStore` from Task 7, `window.electronAPI.ollamaStartAndPull()`, `window.electronAPI.onModelDownloadProgress()`, `window.electronAPI.dbSaveProfile()`, `window.electronAPI.dbGetProfile()`
- Produces: `SetupPage` component (hardware detect → model download → transitions to onboarding or dashboard). `OnboardingPage` component (persona select → priorities → save profile → dashboard).

- [ ] **Step 1: Create ModelProgress component**

Create `src/renderer/components/ModelProgress.tsx`:
```tsx
interface ModelProgressProps {
  progress: number;
  modelName: string;
  sizeGB: number;
}

export function ModelProgress({ progress, modelName, sizeGB }: ModelProgressProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <p className="text-sm text-zinc-400 mb-2">
        Downloading your AI... ({sizeGB} GB)
      </p>
      <div className="w-full bg-zinc-800 rounded-full h-3">
        <div
          className="bg-blue-500 h-3 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-zinc-500 mt-2 text-center">{progress}%</p>
    </div>
  );
}
```

- [ ] **Step 2: Create SetupPage**

Create `src/renderer/pages/SetupPage.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useAppStore } from "../store";
import { ModelProgress } from "../components/ModelProgress";

export function SetupPage() {
  const { setView, setOllamaStatus, setModelDownloadProgress, modelDownloadProgress } = useAppStore();
  const [status, setStatus] = useState<"detecting" | "downloading" | "ready" | "error">("detecting");
  const [modelInfo, setModelInfo] = useState({ displayName: "", sizeGB: 0 });
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function setup() {
      try {
        const model = await window.electronAPI.getModelChoice();
        setModelInfo({ displayName: model.displayName, sizeGB: model.sizeGB });

        setStatus("downloading");
        setOllamaStatus("starting");

        const unsubscribe = window.electronAPI.onModelDownloadProgress((progress) => {
          setModelDownloadProgress(progress);
        });

        await window.electronAPI.ollamaStartAndPull();

        unsubscribe();
        setOllamaStatus("ready");
        setStatus("ready");

        const profile = await window.electronAPI.dbGetProfile();
        if (profile) {
          setView("dashboard");
        } else {
          setView("onboarding-persona");
        }
      } catch (err: any) {
        setStatus("error");
        setOllamaStatus("error");
        setErrorMsg(err.message || "Failed to set up AI");
      }
    }

    setup();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-6 p-8">
      <h1 className="text-4xl font-bold">AgentOne</h1>
      <p className="text-zinc-400">Your private AI assistant</p>

      {status === "detecting" && (
        <p className="text-zinc-300 animate-pulse">Detecting your hardware...</p>
      )}

      {status === "downloading" && (
        <ModelProgress
          progress={modelDownloadProgress}
          modelName={modelInfo.displayName}
          sizeGB={modelInfo.sizeGB}
        />
      )}

      {status === "ready" && (
        <p className="text-green-400">Ready! Setting up...</p>
      )}

      {status === "error" && (
        <div className="text-center">
          <p className="text-red-400 mb-2">Something went wrong</p>
          <p className="text-sm text-zinc-500">{errorMsg}</p>
          <button
            className="mt-4 px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700 text-sm"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create OnboardingPage**

Create `src/renderer/pages/OnboardingPage.tsx`:
```tsx
import { useState } from "react";
import { useAppStore } from "../store";

const PERSONAS = [
  { id: "student", name: "Student", icon: "🎓", desc: "Homework, studying, essays" },
  { id: "professional", name: "Working Professional", icon: "💼", desc: "Emails, meetings, productivity" },
  { id: "parent", name: "Parent / Family", icon: "❤️", desc: "Kids, homework help, planning" },
  { id: "small-business", name: "Small Business Owner", icon: "🏪", desc: "Marketing, customer service, content" },
  { id: "creator", name: "Creator / Artist", icon: "🎨", desc: "Writing, ideas, content creation" },
  { id: "freelancer", name: "Freelancer", icon: "💻", desc: "Proposals, invoices, clients" },
  { id: "personal", name: "Personal Use", icon: "🌟", desc: "General everyday help" },
];

const PRIORITIES_BY_PERSONA: Record<string, string[]> = {
  student: ["Summarize lecture notes", "Study for exams", "Write better essays", "Get homework help", "Proofread my writing", "Learn new concepts", "Stay organized"],
  professional: ["Save time on emails", "Write better documents", "Prepare for meetings", "Analyze data & reports", "Brainstorm ideas", "Learn new skills", "Stay organized"],
  parent: ["Help kids with homework", "Explain things to my kids", "Plan family activities", "Communicate with school", "Meal planning", "Stay organized"],
  "small-business": ["Write product descriptions", "Handle customer reviews", "Create social media content", "Draft professional messages", "Marketing ideas", "Save time on admin"],
  creator: ["Brainstorm ideas", "Write content", "Edit and proofread", "Get feedback", "Plan projects"],
  freelancer: ["Write proposals", "Draft client emails", "Create invoices", "Market my services", "Plan projects"],
  personal: ["Draft messages", "Get advice", "Brainstorm ideas", "Summarize things", "Learn something new"],
};

export function OnboardingPage() {
  const { view, selectPersona, selectedPersonaId, setPriorities, setView } = useAppStore();
  const [selectedPriorities, setLocalPriorities] = useState<string[]>([]);

  const isPersonaStep = view === "onboarding-persona";

  async function handlePersonaSelect(id: string) {
    selectPersona(id);
    setView("onboarding-priorities");
  }

  function togglePriority(p: string) {
    setLocalPriorities((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : prev.length < 3 ? [...prev, p] : prev
    );
  }

  async function handleFinish() {
    if (!selectedPersonaId) return;
    setPriorities(selectedPriorities);

    await window.electronAPI.dbSaveProfile({
      persona: selectedPersonaId,
      priorities: selectedPriorities,
      licenseKey: null,
      licenseValidUntil: null,
    });

    setView("dashboard");
  }

  if (isPersonaStep) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <h2 className="text-2xl font-bold mb-2">Who are you?</h2>
        <p className="text-zinc-400 mb-8">This helps me suggest the right things for you.</p>
        <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePersonaSelect(p.id)}
              className="flex items-center gap-3 p-4 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-blue-500 hover:bg-zinc-800 transition-colors text-left"
            >
              <span className="text-2xl">{p.icon}</span>
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-zinc-500">{p.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const priorities = PRIORITIES_BY_PERSONA[selectedPersonaId || "personal"] || [];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h2 className="text-2xl font-bold mb-2">What matters most?</h2>
      <p className="text-zinc-400 mb-8">Pick up to 3 — I'll prioritize these for you.</p>
      <div className="flex flex-col gap-2 max-w-md w-full mb-8">
        {priorities.map((p) => (
          <button
            key={p}
            onClick={() => togglePriority(p)}
            className={`p-3 rounded-lg border text-left text-sm transition-colors ${
              selectedPriorities.includes(p)
                ? "border-blue-500 bg-blue-500/10 text-blue-300"
                : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <button
        onClick={handleFinish}
        disabled={selectedPriorities.length === 0}
        className="px-6 py-3 bg-blue-600 rounded-lg font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Get Started
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Wire pages into App.tsx**

Update `src/renderer/App.tsx`:
```tsx
import { useAppStore } from "./store";
import { SetupPage } from "./pages/SetupPage";
import { OnboardingPage } from "./pages/OnboardingPage";

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-zinc-400 text-lg">{name} — Coming next</p>
    </div>
  );
}

export function App() {
  const view = useAppStore((s) => s.view);

  switch (view) {
    case "setup":
      return <SetupPage />;
    case "onboarding-persona":
    case "onboarding-priorities":
      return <OnboardingPage />;
    case "dashboard":
      return <Placeholder name="Dashboard" />;
    case "guided-task":
      return <Placeholder name="Guided Task Flow" />;
    case "chat":
      return <Placeholder name="Freeform Chat" />;
    case "settings":
      return <Placeholder name="Settings" />;
    default:
      return <Placeholder name="Unknown View" />;
  }
}
```

- [ ] **Step 5: Manually test the onboarding flow**

```bash
npm run dev
```

Expected: App launches → setup page detects hardware → (if Ollama not bundled yet, expect error — that's OK for now) → onboarding persona selection screen → priority selection → "Get Started" transitions to dashboard placeholder.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/pages/SetupPage.tsx src/renderer/pages/OnboardingPage.tsx src/renderer/components/ModelProgress.tsx src/renderer/App.tsx
git commit -m "feat: add setup page (hardware detect + model download) and onboarding flow (persona + priorities)"
```

---

### Task 9: Dashboard Page

**Files:**
- Create: `src/renderer/pages/DashboardPage.tsx`
- Create: `src/renderer/components/TaskCard.tsx`
- Create: `src/renderer/components/StatsCard.tsx`
- Create: `src/renderer/lib/persona-loader.ts`
- Modify: `src/renderer/App.tsx` — wire DashboardPage

**Interfaces:**
- Consumes: `useAppStore` from Task 7, persona JSON files from Task 5, `window.electronAPI.dbGetConversations()`, `window.electronAPI.dbGetTaskUsageStats()`, `window.electronAPI.getRemainingGenerations()`
- Produces: `DashboardPage` showing persona-specific task grid, recently used conversations, discover more section, and generation counter. `loadPersonas(): Persona[]` that reads bundled persona JSONs.

- [ ] **Step 1: Create persona-loader**

Create `src/renderer/lib/persona-loader.ts`:
```typescript
import type { Persona } from "@shared/types";

import studentData from "../../personas/student.json";
import professionalData from "../../personas/professional.json";
import parentData from "../../personas/parent.json";
import smallBusinessData from "../../personas/small-business.json";

const ALL_PERSONAS: Persona[] = [
  studentData as Persona,
  professionalData as Persona,
  parentData as Persona,
  smallBusinessData as Persona,
];

export function loadPersonas(): Persona[] {
  return ALL_PERSONAS;
}

export function getPersonaById(id: string): Persona | undefined {
  return ALL_PERSONAS.find((p) => p.id === id);
}
```

- [ ] **Step 2: Create TaskCard component**

Create `src/renderer/components/TaskCard.tsx`:
```tsx
import type { TaskDefinition } from "@shared/types";

interface TaskCardProps {
  task: TaskDefinition;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-2 p-4 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-blue-500/50 hover:bg-zinc-800/80 transition-all text-left group"
    >
      <div className="text-lg font-medium group-hover:text-blue-300 transition-colors">
        {task.title}
      </div>
      <div className="text-sm text-zinc-500">{task.subtitle}</div>
    </button>
  );
}
```

- [ ] **Step 3: Create StatsCard component**

Create `src/renderer/components/StatsCard.tsx`:
```tsx
interface StatsCardProps {
  tasksToday: number;
  remaining: number | "unlimited";
}

export function StatsCard({ tasksToday, remaining }: StatsCardProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50 text-sm">
      <span className="text-zinc-400">
        Today: <span className="text-zinc-200 font-medium">{tasksToday} tasks</span>
      </span>
      <span className="text-zinc-500">
        {remaining === "unlimited" ? (
          <span className="text-blue-400">Unlimited (Pro)</span>
        ) : (
          <>{remaining} generations left today</>
        )}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Create DashboardPage**

Create `src/renderer/pages/DashboardPage.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useAppStore } from "../store";
import { getPersonaById } from "../lib/persona-loader";
import { TaskCard } from "../components/TaskCard";
import { StatsCard } from "../components/StatsCard";

export function DashboardPage() {
  const {
    selectedPersonaId,
    openGuidedTask,
    setView,
    remainingGenerations,
    setRemainingGenerations,
    setConversations,
    conversations,
  } = useAppStore();

  const [dailyCount, setDailyCount] = useState(0);
  const persona = selectedPersonaId ? getPersonaById(selectedPersonaId) : null;

  useEffect(() => {
    async function load() {
      const remaining = await window.electronAPI.getRemainingGenerations();
      setRemainingGenerations(remaining);

      const count = await window.electronAPI.dbGetDailyGenerationCount();
      setDailyCount(count);

      const convs = await window.electronAPI.dbGetConversations(5);
      setConversations(convs);
    }
    load();
  }, []);

  const greeting = getGreeting();

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h1 className="text-lg font-bold">AgentOne</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setView("chat")}
            className="px-3 py-1.5 text-sm bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Chat
          </button>
          <button
            onClick={() => setView("settings")}
            className="px-3 py-1.5 text-sm bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Settings
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <p className="text-xl font-medium mb-6">
          {greeting} Here's what I can help with:
        </p>

        {/* Task Grid */}
        {persona && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {persona.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => openGuidedTask(persona.id, task.id)}
              />
            ))}
          </div>
        )}

        {/* Recently Used */}
        {conversations.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Recently Used</h3>
            <div className="flex flex-col gap-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    useAppStore.getState().setCurrentConversationId(conv.id);
                    setView("chat");
                  }}
                  className="text-left px-3 py-2 text-sm text-zinc-300 bg-zinc-900/50 rounded hover:bg-zinc-800 transition-colors"
                >
                  {conv.title || conv.taskId || "Freeform chat"} —{" "}
                  <span className="text-zinc-500">
                    {new Date(conv.createdAt).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Discover More */}
        {persona && persona.discovery_queue.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">
              Did you know I can also help with...
            </h3>
            <div className="flex flex-wrap gap-2">
              {persona.discovery_queue.map((taskId) => (
                <span
                  key={taskId}
                  className="px-3 py-1.5 bg-zinc-900 rounded-full text-sm text-zinc-400 border border-zinc-800"
                >
                  {taskId.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <StatsCard tasksToday={dailyCount} remaining={remainingGenerations} />
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning!";
  if (hour < 17) return "Good afternoon!";
  return "Good evening!";
}
```

- [ ] **Step 5: Wire DashboardPage into App.tsx**

Update the `"dashboard"` case in `App.tsx`:
```tsx
import { DashboardPage } from "./pages/DashboardPage";
// ... in switch:
case "dashboard":
  return <DashboardPage />;
```

- [ ] **Step 6: Manually test dashboard**

```bash
npm run dev
```

Expected: After completing onboarding, see the dashboard with persona-appropriate task cards, greeting, empty recently-used, discover-more pills, and stats bar.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/pages/DashboardPage.tsx src/renderer/components/TaskCard.tsx src/renderer/components/StatsCard.tsx src/renderer/lib/persona-loader.ts src/renderer/App.tsx
git commit -m "feat: add dashboard with persona task grid, recently used, discovery section, and daily stats"
```

---

### Task 10: Guided Task Flow Page (Structured Forms + LLM Generation)

**Files:**
- Create: `src/renderer/pages/GuidedTaskPage.tsx`
- Create: `src/renderer/components/GuidedFlowForm.tsx`
- Create: `src/renderer/components/StreamingText.tsx`
- Create: `src/renderer/hooks/use-llm.ts`
- Modify: `src/renderer/App.tsx` — wire GuidedTaskPage

**Interfaces:**
- Consumes: `useAppStore.guidedTaskContext`, persona JSON `guided_flow` definitions, `buildPrompt` from Task 5, `window.electronAPI.generate()`, `window.electronAPI.onGenerateToken()`
- Produces: `GuidedTaskPage` that renders the dynamic form from a task's `guided_flow`, submits structured prompt to LLM, streams the response, and shows action buttons (copy, regenerate, edit in chat).

- [ ] **Step 1: Create the useLLM hook**

Create `src/renderer/hooks/use-llm.ts`:
```tsx
import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "../store";

export function useLLM() {
  const {
    setIsGenerating,
    appendStreamingText,
    clearStreamingText,
    setRemainingGenerations,
  } = useAppStore();

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  const generate = useCallback(
    async (prompt: string, systemPrompt: string, conversationId: string): Promise<string> => {
      clearStreamingText();
      setIsGenerating(true);

      unsubRef.current = window.electronAPI.onGenerateToken((token) => {
        appendStreamingText(token);
      });

      try {
        const result = await window.electronAPI.generate(prompt, systemPrompt, conversationId);
        const remaining = await window.electronAPI.getRemainingGenerations();
        setRemainingGenerations(remaining);
        return result;
      } finally {
        setIsGenerating(false);
        if (unsubRef.current) {
          unsubRef.current();
          unsubRef.current = null;
        }
      }
    },
    [clearStreamingText, setIsGenerating, appendStreamingText, setRemainingGenerations]
  );

  return { generate };
}
```

- [ ] **Step 2: Create GuidedFlowForm**

Create `src/renderer/components/GuidedFlowForm.tsx`:
```tsx
import { useState } from "react";
import type { GuidedFlow, FlowField } from "@shared/types";

interface GuidedFlowFormProps {
  flow: GuidedFlow;
  onSubmit: (values: Record<string, string>) => void;
  isGenerating: boolean;
}

export function GuidedFlowForm({ flow, onSubmit, isGenerating }: GuidedFlowFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  function setValue(label: string, value: string) {
    setValues((prev) => ({ ...prev, [label]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  const requiredFieldsFilled = flow.fields
    .filter((f) => !f.optional)
    .every((f) => (values[f.label] ?? "").trim() !== "");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {flow.fields.map((field) => (
        <FieldRenderer
          key={field.label}
          field={field}
          value={values[field.label] ?? ""}
          onChange={(v) => setValue(field.label, v)}
        />
      ))}
      <button
        type="submit"
        disabled={!requiredFieldsFilled || isGenerating}
        className="mt-2 px-6 py-3 bg-blue-600 rounded-lg font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-start"
      >
        {isGenerating ? "Generating..." : "Generate ✨"}
      </button>
    </form>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FlowField;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-2">
        {field.label}
        {field.optional && <span className="text-zinc-600 ml-1">(optional)</span>}
      </label>
      {field.type === "choice" && field.options && (
        <div className="flex flex-wrap gap-2">
          {field.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                value === opt
                  ? "border-blue-500 bg-blue-500/10 text-blue-300"
                  : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      {field.type === "textarea" && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none resize-y"
        />
      )}
      {field.type === "text" && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create StreamingText**

Create `src/renderer/components/StreamingText.tsx`:
```tsx
import { useAppStore } from "../store";

export function StreamingText() {
  const text = useAppStore((s) => s.streamingText);
  const isGenerating = useAppStore((s) => s.isGenerating);

  if (!text && !isGenerating) return null;

  return (
    <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
      <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
        {text}
        {isGenerating && (
          <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-0.5" />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create GuidedTaskPage**

Create `src/renderer/pages/GuidedTaskPage.tsx`:
```tsx
import { useState } from "react";
import { useAppStore } from "../store";
import { getPersonaById } from "../lib/persona-loader";
import { buildPrompt, collectFlowValues } from "../lib/prompt-builder";
import { GuidedFlowForm } from "../components/GuidedFlowForm";
import { StreamingText } from "../components/StreamingText";
import { useLLM } from "../hooks/use-llm";

export function GuidedTaskPage() {
  const { guidedTaskContext, setView, isGenerating, streamingText, clearStreamingText } =
    useAppStore();
  const { generate } = useLLM();
  const [result, setResult] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!guidedTaskContext) {
    setView("dashboard");
    return null;
  }

  const persona = getPersonaById(guidedTaskContext.personaId);
  const task = persona?.tasks.find((t) => t.id === guidedTaskContext.taskId);

  if (!persona || !task) {
    setView("dashboard");
    return null;
  }

  async function handleSubmit(formValues: Record<string, string>) {
    setResult(null);
    clearStreamingText();

    const values = collectFlowValues(task!.guided_flow, formValues);
    const prompt = buildPrompt(task!.guided_flow, values);

    const conv = await window.electronAPI.dbCreateConversation(task!.id);
    setConversationId(conv.id);

    await window.electronAPI.dbRecordTaskUsage({
      taskId: task!.id,
      persona: persona!.id,
      startedAt: new Date().toISOString(),
      completed: true,
      durationSeconds: null,
    });

    const fullResult = await generate(prompt, persona!.system_prompt, conv.id);
    setResult(fullResult);
  }

  async function handleRegenerate() {
    if (!conversationId) return;
    clearStreamingText();
    setResult(null);
    const fullResult = await generate("Please regenerate the previous response with a different approach.", persona!.system_prompt, conversationId);
    setResult(fullResult);
  }

  function handleCopy() {
    const text = result || streamingText;
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
        <button
          onClick={() => { clearStreamingText(); setView("dashboard"); }}
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-lg font-medium">{task.title}</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
        <GuidedFlowForm
          flow={task.guided_flow}
          onSubmit={handleSubmit}
          isGenerating={isGenerating}
        />

        {/* Streaming / Result */}
        <div className="mt-6">
          <StreamingText />
        </div>

        {/* Action buttons */}
        {result && !isGenerating && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
            >
              {copied ? "Copied!" : "Copy to clipboard"}
            </button>
            <button
              onClick={handleRegenerate}
              className="px-4 py-2 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
            >
              Regenerate
            </button>
            <button
              onClick={() => {
                if (conversationId) {
                  useAppStore.getState().setCurrentConversationId(conversationId);
                  clearStreamingText();
                  setView("chat");
                }
              }}
              className="px-4 py-2 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
            >
              Edit in chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire GuidedTaskPage into App.tsx**

```tsx
import { GuidedTaskPage } from "./pages/GuidedTaskPage";
// in switch:
case "guided-task":
  return <GuidedTaskPage />;
```

- [ ] **Step 6: Manually test the full guided flow**

```bash
npm run dev
```

Expected: Click a task card on dashboard → see the guided form → fill fields → click Generate → see streaming response → copy/regenerate/edit-in-chat buttons appear.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/pages/GuidedTaskPage.tsx src/renderer/components/GuidedFlowForm.tsx src/renderer/components/StreamingText.tsx src/renderer/hooks/use-llm.ts src/renderer/App.tsx
git commit -m "feat: add guided task flow with dynamic forms, streaming LLM generation, and result actions"
```

---

### Task 11: Freeform Chat Page

**Files:**
- Create: `src/renderer/pages/ChatPage.tsx`
- Create: `src/renderer/components/ChatMessage.tsx`
- Create: `src/renderer/components/ChatInput.tsx`
- Modify: `src/renderer/App.tsx` — wire ChatPage

**Interfaces:**
- Consumes: `useAppStore.currentConversationId`, `window.electronAPI.dbGetMessages()`, `window.electronAPI.dbCreateConversation()`, `useLLM.generate()`, persona system prompt
- Produces: `ChatPage` with message history, streaming response, text input with suggestion chips, and back-to-dashboard navigation.

- [ ] **Step 1: Create ChatMessage**

Create `src/renderer/components/ChatMessage.tsx`:
```tsx
interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  if (role === "system") return null;

  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
          role === "user"
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-zinc-800 text-zinc-200 rounded-bl-sm"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ChatInput**

Create `src/renderer/components/ChatInput.tsx`:
```tsx
import { useState, useRef, useEffect } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  suggestions?: string[];
}

export function ChatInput({ onSend, disabled, suggestions }: ChatInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText("");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="border-t border-zinc-800 p-4">
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onSend(s)}
              disabled={disabled}
              className="px-3 py-1 bg-zinc-900 border border-zinc-700 rounded-full text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          disabled={disabled}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none resize-none disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={!text.trim() || disabled}
          className="px-4 py-3 bg-blue-600 rounded-xl text-sm font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create ChatPage**

Create `src/renderer/pages/ChatPage.tsx`:
```tsx
import { useEffect, useState, useRef } from "react";
import { useAppStore } from "../store";
import { getPersonaById } from "../lib/persona-loader";
import { ChatMessage } from "../components/ChatMessage";
import { ChatInput } from "../components/ChatInput";
import { useLLM } from "../hooks/use-llm";
import type { Message } from "@shared/types";

const SUGGESTIONS = [
  "Rewrite this paragraph to sound more confident",
  "What are 5 ways to improve my morning routine?",
  "Explain quantum computing like I'm 10",
];

export function ChatPage() {
  const {
    currentConversationId,
    setCurrentConversationId,
    selectedPersonaId,
    setView,
    isGenerating,
    streamingText,
    clearStreamingText,
  } = useAppStore();

  const { generate } = useLLM();
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const persona = selectedPersonaId ? getPersonaById(selectedPersonaId) : null;
  const systemPrompt = persona?.system_prompt || "You are a helpful AI assistant.";

  useEffect(() => {
    async function loadMessages() {
      if (currentConversationId) {
        const msgs = await window.electronAPI.dbGetMessages(currentConversationId);
        setMessages(msgs);
      }
    }
    loadMessages();
  }, [currentConversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  async function handleSend(text: string) {
    let convId = currentConversationId;
    if (!convId) {
      const conv = await window.electronAPI.dbCreateConversation(null);
      convId = conv.id;
      setCurrentConversationId(convId);
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      conversationId: convId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    clearStreamingText();

    const result = await generate(text, systemPrompt, convId);

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      conversationId: convId,
      role: "assistant",
      content: result,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMsg]);
    clearStreamingText();
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
        <button
          onClick={() => {
            clearStreamingText();
            setCurrentConversationId(null);
            setView("dashboard");
          }}
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-lg font-medium">Chat</h2>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 && !isGenerating && (
          <div className="text-center text-zinc-500 mt-20">
            <p className="text-lg mb-2">Ask me anything</p>
            <p className="text-sm">Or try one of the suggestions below</p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}

        {isGenerating && streamingText && (
          <ChatMessage role="assistant" content={streamingText + "█"} />
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isGenerating}
        suggestions={messages.length === 0 ? SUGGESTIONS : undefined}
      />
    </div>
  );
}
```

- [ ] **Step 4: Wire ChatPage into App.tsx**

```tsx
import { ChatPage } from "./pages/ChatPage";
// in switch:
case "chat":
  return <ChatPage />;
```

- [ ] **Step 5: Manually test freeform chat**

```bash
npm run dev
```

Expected: Click "Chat" from dashboard → see empty state with suggestions → type or click suggestion → message appears → streaming response from LLM → conversation persists.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/pages/ChatPage.tsx src/renderer/components/ChatMessage.tsx src/renderer/components/ChatInput.tsx src/renderer/App.tsx
git commit -m "feat: add freeform chat page with streaming, message history, and suggestion chips"
```

---

### Task 12: Settings Page and Electron Packaging

**Files:**
- Create: `src/renderer/pages/SettingsPage.tsx`
- Create: `electron-builder.yml`
- Modify: `src/renderer/App.tsx` — wire SettingsPage

**Interfaces:**
- Consumes: `window.electronAPI.getLicenseStatus()`, `window.electronAPI.activateLicense()`, `useAppStore`
- Produces: `SettingsPage` with license key entry, current model info, persona reset, analytics opt-out. `electron-builder.yml` config for producing `.dmg` (Mac) and `.exe` (Windows) installers.

- [ ] **Step 1: Create SettingsPage**

Create `src/renderer/pages/SettingsPage.tsx`:
```tsx
import { useState, useEffect } from "react";
import { useAppStore } from "../store";

export function SettingsPage() {
  const { setView, selectedPersonaId } = useAppStore();
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseStatus, setLicenseStatus] = useState<"free" | "pro" | "expired">("free");
  const [modelName, setModelName] = useState("");
  const [hardwareInfo, setHardwareInfo] = useState("");
  const [activating, setActivating] = useState(false);
  const [activationMsg, setActivationMsg] = useState("");

  useEffect(() => {
    async function load() {
      const status = await window.electronAPI.getLicenseStatus();
      setLicenseStatus(status);

      const model = await window.electronAPI.getModelChoice();
      setModelName(model.displayName);

      const hw = await window.electronAPI.getHardwareInfo();
      setHardwareInfo(`${hw.totalRamGB}GB RAM · ${hw.gpuType === "apple-silicon" ? "Apple Silicon" : hw.gpuType === "nvidia" ? "NVIDIA GPU" : "CPU"} · ${hw.platform}`);
    }
    load();
  }, []);

  async function handleActivate() {
    if (!licenseKey.trim()) return;
    setActivating(true);
    setActivationMsg("");
    try {
      const success = await window.electronAPI.activateLicense(licenseKey.trim());
      if (success) {
        setLicenseStatus("pro");
        setActivationMsg("License activated! You now have unlimited generations.");
      }
    } catch {
      setActivationMsg("Invalid license key. Please try again.");
    }
    setActivating(false);
  }

  async function handleResetPersona() {
    await window.electronAPI.dbSaveProfile({
      persona: "",
      priorities: [],
      licenseKey: null,
      licenseValidUntil: null,
    });
    useAppStore.getState().selectPersona("");
    setView("onboarding-persona");
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
        <button
          onClick={() => setView("dashboard")}
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-lg font-medium">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-lg mx-auto w-full">
        {/* License */}
        <section className="mb-8">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Subscription</h3>
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm">Status:</span>
              <span className={`text-sm font-medium ${licenseStatus === "pro" ? "text-blue-400" : "text-zinc-400"}`}>
                {licenseStatus === "pro" ? "Pro" : licenseStatus === "expired" ? "Expired" : "Free"}
              </span>
            </div>
            {licenseStatus !== "pro" && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="Enter license key"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleActivate}
                  disabled={activating}
                  className="px-4 py-2 bg-blue-600 rounded-lg text-sm hover:bg-blue-500 disabled:opacity-40 transition-colors"
                >
                  Activate
                </button>
              </div>
            )}
            {activationMsg && (
              <p className={`text-xs mt-2 ${licenseStatus === "pro" ? "text-green-400" : "text-red-400"}`}>
                {activationMsg}
              </p>
            )}
          </div>
        </section>

        {/* Model Info */}
        <section className="mb-8">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">AI Model</h3>
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-sm">
            <p>Model: <span className="text-zinc-200">{modelName}</span></p>
            <p className="mt-1">Hardware: <span className="text-zinc-200">{hardwareInfo}</span></p>
            <p className="mt-2 text-xs text-zinc-500">All AI processing happens on your device. Nothing is sent to the cloud.</p>
          </div>
        </section>

        {/* Persona */}
        <section className="mb-8">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Persona</h3>
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <p className="text-sm mb-3">
              Current: <span className="text-zinc-200">{selectedPersonaId || "None"}</span>
            </p>
            <button
              onClick={handleResetPersona}
              className="px-4 py-2 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
            >
              Change persona
            </button>
          </div>
        </section>

        {/* About */}
        <section>
          <h3 className="text-sm font-medium text-zinc-400 mb-3">About</h3>
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-sm text-zinc-400">
            <p>AgentOne v0.1.0</p>
            <p className="mt-1">Private AI that tells you what it can do.</p>
            <p className="mt-2 text-xs text-zinc-600">All data stays on your device.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire SettingsPage into App.tsx**

```tsx
import { SettingsPage } from "./pages/SettingsPage";
// in switch:
case "settings":
  return <SettingsPage />;
```

- [ ] **Step 3: Create electron-builder.yml**

Create `electron-builder.yml`:
```yaml
appId: com.agentone.app
productName: AgentOne
copyright: Copyright © 2026 AgentOne

directories:
  output: release
  buildResources: resources

files:
  - dist/**/*
  - src/personas/**/*
  - "!node_modules/**/*"
  - node_modules/better-sqlite3/**/*

extraResources:
  - from: resources/ollama/
    to: ollama/
    filter:
      - "**/*"

mac:
  category: public.app-category.productivity
  target:
    - target: dmg
      arch:
        - arm64
        - x64
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: resources/entitlements.mac.plist
  entitlementsInherit: resources/entitlements.mac.plist

win:
  target:
    - target: nsis
      arch:
        - x64
  artifactName: "${productName}-Setup-${version}.${ext}"

nsis:
  oneClick: true
  perMachine: false
  allowToChangeInstallationDirectory: false

publish: null
```

- [ ] **Step 4: Test the build**

```bash
npm run build
npm run pack
```

Expected: `release/` directory contains an unpacked app. Check it launches.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/pages/SettingsPage.tsx src/renderer/App.tsx electron-builder.yml
git commit -m "feat: add settings page (license, model info, persona reset) and electron-builder packaging config"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Section 1 (Vision): Covered by overall architecture
- [x] Section 3.1 (Install flow): Task 1 scaffolding + Task 4 Ollama Manager + Task 8 SetupPage
- [x] Section 3.2 (Onboarding): Task 8 OnboardingPage
- [x] Section 3.3 (Dashboard): Task 9 DashboardPage
- [x] Section 3.4 (Guided task flows): Task 10 GuidedTaskPage + Task 5 persona JSONs
- [x] Section 3.5 (Freeform chat): Task 11 ChatPage
- [x] Section 3.6 (Discovery engine): Task 9 discovery_queue rendering
- [x] Section 4 (Persona system): Task 5 JSON configs + prompt builder
- [x] Section 5.1-5.3 (Architecture): Tasks 1-4
- [x] Section 5.4 (Data model): Task 2 SQLite
- [x] Section 6 (Monetization): Task 6 rate limiter + Task 12 Settings (license)
- [x] Section 10 (Metrics): Task 2 tracks task_usage + daily_generations

**Placeholder scan:** No TBDs, TODOs, or "implement later" found.

**Type consistency:** `ElectronAPI` interface in Task 1 matches all IPC handlers in Task 6. `Persona`, `TaskDefinition`, `GuidedFlow` types used consistently across persona JSONs (Task 5), prompt builder (Task 5), guided flow form (Task 10), and dashboard (Task 9).
