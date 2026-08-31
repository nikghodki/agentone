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
