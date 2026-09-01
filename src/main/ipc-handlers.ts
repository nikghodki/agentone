import { ipcMain, BrowserWindow } from "electron";
import { randomUUID } from "crypto";
import { Database } from "./database";
import { OllamaManager } from "./ollama-manager";
import { RateLimiter } from "./rate-limiter";
import { detectHardware, selectModel } from "./hardware-detector";
import { getAppPaths } from "./paths";
import { FRAMEWORKS } from "./framework-registry";
import { ZeptoclawAdapter } from "./frameworks/zeptoclaw-adapter";
import { HermesAdapter } from "./frameworks/hermes-adapter";
import { OpenclawAdapter } from "./frameworks/openclaw-adapter";
import { CapabilityOrchestrator } from "./capability-orchestrator";
import { Secrets } from "./secrets";
import type { ModelChoice, UserProfile, TaskUsage } from "../shared/types";
import type { FrameworkAdapter, Deployment } from "../shared/v2-types";

let ollamaManager: OllamaManager | null = null;
let selectedModel: ModelChoice | null = null;
let ollamaState: "not_installed" | "downloading_model" | "starting" | "ready" | "error" = "not_installed";

// Deployment registry: maps deploymentId -> {adapter, orchestrator}
interface DeploymentInstance {
  adapter: FrameworkAdapter;
  orchestrator: CapabilityOrchestrator;
}
const deploymentRegistry = new Map<string, DeploymentInstance>();

/**
 * Create a FrameworkAdapter instance based on the frameworkId.
 * Zeptoclaw, Hermes, and OpenClaw are wired; other frameworks throw a clear error.
 */
export function createAdapter(frameworkId: string, secrets: Secrets): FrameworkAdapter {
  if (frameworkId === "zeptoclaw") {
    return new ZeptoclawAdapter(undefined, undefined, undefined, secrets);
  }

  if (frameworkId === "hermes") {
    return new HermesAdapter(undefined, undefined, undefined, secrets);
  }

  if (frameworkId === "openclaw") {
    return new OpenclawAdapter(undefined, undefined, undefined, undefined, secrets);
  }

  throw new Error(
    `Framework "${frameworkId}" is not yet supported. ` +
    `Only "zeptoclaw", "hermes", and "openclaw" are currently wired for deployment.`
  );
}

export function registerIpcHandlers(db: Database, rateLimiter: RateLimiter, secrets: Secrets) {
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

  ipcMain.handle("get-frameworks", () => FRAMEWORKS);

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

  ipcMain.handle("deploy-framework", async (_e, frameworkId: string, modelBackendId: string): Promise<Deployment> => {
    try {
      // Create the adapter
      const adapter = createAdapter(frameworkId, secrets);

      // Resolve the model backend
      const backend = db.getModelBackend(modelBackendId);
      if (!backend) {
        throw new Error(`Model backend "${modelBackendId}" not found in database`);
      }

      // Create deployment record (pending status)
      const deployment = db.createDeployment({
        frameworkId,
        location: "local",
        remoteUrl: null,
        modelBackendId,
      });

      try {
        // Run install → configure → start
        await adapter.install();
        await adapter.configure(backend);
        await adapter.start();

        // Poll status until healthy using consolidated readiness check
        // This now incorporates process liveness (Fix 2)
        const processManager = (adapter as any).processManager;
        if (processManager && processManager.waitUntilReady) {
          // Use ProcessManager's waitUntilReady for consistent polling
          await processManager.waitUntilReady(
            async () => {
              const status = await adapter.status();
              return status === "healthy";
            },
            { timeoutMs: 10000, intervalMs: 500 }
          );
        } else {
          // Fallback for adapters without ProcessManager
          const timeoutMs = 10000;
          const startTime = Date.now();
          while (Date.now() - startTime < timeoutMs) {
            const status = await adapter.status();
            if (status === "healthy") {
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          // Final status check
          const finalStatus = await adapter.status();
          if (finalStatus !== "healthy") {
            throw new Error(`Adapter failed to reach healthy status: ${finalStatus}`);
          }
        }

        // Create orchestrator
        const orchestrator = new CapabilityOrchestrator(adapter, db, deployment.id);

        // Update deployment status to ready
        db.updateDeploymentStatus(deployment.id, "ready");

        // Register in deployment registry (only after successful deploy)
        deploymentRegistry.set(deployment.id, { adapter, orchestrator });

        return { ...deployment, status: "ready" };
      } catch (error) {
        // Clean up any started process (prevent zombie)
        await adapter.stop().catch(() => {});
        // Mark deployment as failed
        db.updateDeploymentStatus(deployment.id, "failed");
        throw error;
      }
    } catch (error) {
      throw new Error(`Failed to deploy framework: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  ipcMain.handle("send-task", async (_e, deploymentId: string, input: string): Promise<string> => {
    const instance = deploymentRegistry.get(deploymentId);
    if (!instance) {
      throw new Error(`Deployment "${deploymentId}" not found or not ready`);
    }

    const win = BrowserWindow.getAllWindows()[0];
    if (!win) {
      throw new Error("No browser window found for streaming");
    }

    // Run task with streaming callbacks
    const result = await instance.orchestrator.runTask(
      input,
      (token) => {
        win.webContents.send("task-token", token);
      },
      (status) => {
        win.webContents.send("task-status", status);
      }
    );

    return result;
  });

  ipcMain.handle("get-deployments", () => db.getDeployments());

  ipcMain.handle(
    "save-model-backend",
    (
      _e,
      draft: { kind: string; provider: string | null; baseUrl: string | null; protocol: string; model: string },
      apiKey?: string
    ): string => {
      const id = randomUUID();
      let secretRef: string | null = null;

      // If apiKey is provided and non-empty, store it securely
      if (apiKey && apiKey.trim() !== "") {
        secretRef = `backend:${id}`;
        secrets.set(secretRef, apiKey);
      }

      // Save the model backend config (never log the apiKey)
      db.saveModelBackend({
        id,
        kind: draft.kind as any,
        provider: draft.provider,
        baseUrl: draft.baseUrl,
        protocol: draft.protocol as any,
        model: draft.model,
        secretRef,
      });

      return id;
    }
  );
}

export function shutdownServices() {
  ollamaManager?.stop();
  for (const { adapter } of deploymentRegistry.values()) {
    adapter.stop().catch(() => {});
  }
  deploymentRegistry.clear();
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
