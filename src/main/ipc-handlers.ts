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

    const userMsgId = randomUUID();
    const assistantMsgId = randomUUID();
    db.saveMessage({ id: userMsgId, conversationId, role: "user", content: prompt });
    db.saveMessage({ id: assistantMsgId, conversationId, role: "assistant", content: fullResponse });

    return fullResponse;
  });

  ipcMain.handle("get-remaining-generations", () => {
    const licenseStatus = getLicenseStatus(db);
    return rateLimiter.getRemainingGenerations(db, licenseStatus);
  });

  ipcMain.handle("get-license-status", () => getLicenseStatus(db));

  ipcMain.handle("activate-license", (_e, key: string) => {
    const profile = db.getProfile();
    if (!profile) throw new Error("Profile not initialized. Cannot activate license.");
    db.saveProfile({ ...profile, licenseKey: key, licenseValidUntil: null });
    return true;
  });
}

export function shutdownServices() {
  ollamaManager?.stop();
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
