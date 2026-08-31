import { ipcMain, BrowserWindow } from "electron";
import { randomUUID } from "crypto";
import { Database } from "./database";
import { OllamaManager } from "./ollama-manager";
import { RateLimiter } from "./rate-limiter";
import { detectHardware, selectModel } from "./hardware-detector";
import { getAppPaths } from "./paths";
import { FRAMEWORKS } from "./framework-registry";
import { ZeptoclawAdapter } from "./frameworks/zeptoclaw-adapter";
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
 * Only zeptoclaw is wired for now; other frameworks throw a clear error.
 */
function createAdapter(frameworkId: string, secrets: Secrets): FrameworkAdapter {
  if (frameworkId === "zeptoclaw") {
    return new ZeptoclawAdapter(undefined, undefined, undefined, secrets);
  }

  throw new Error(
    `Framework "${frameworkId}" is not yet supported. ` +
    `Only "zeptoclaw" is currently wired for deployment.`
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

        // Poll status until healthy
        const timeoutMs = 10000; // 10 second timeout
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

        // Create orchestrator
        const orchestrator = new CapabilityOrchestrator(adapter, db, deployment.id);

        // Register in deployment registry
        deploymentRegistry.set(deployment.id, { adapter, orchestrator });

        // Update deployment status to ready
        db.updateDeploymentStatus(deployment.id, "ready");

        return { ...deployment, status: "ready" };
      } catch (error) {
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
