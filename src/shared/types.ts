import type { FrameworkMeta, Deployment, InstalledCapability } from "./v2-types";

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
  getFrameworks: () => Promise<FrameworkMeta[]>;

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

  deployFramework: (frameworkId: string, modelBackendId: string, options?: import("./v2-types").FrameworkDeployOptions) => Promise<Deployment>;
  sendTask: (deploymentId: string, input: string) => Promise<string>;
  getDeployments: () => Promise<Deployment[]>;
  onTaskToken: (callback: (token: string) => void) => () => void;
  onTaskStatus: (callback: (status: string) => void) => () => void;

  saveModelBackend: (
    draft: { kind: string; provider: string | null; baseUrl: string | null; protocol: string; model: string; extra?: Record<string, unknown> | null },
    secret?: string
  ) => Promise<string>;

  getCapabilities: (deploymentId: string) => Promise<InstalledCapability[]>;
  removeCapability: (
    deploymentId: string,
    spec: { type: string; name: string }
  ) => Promise<{ frameworkRemoved: boolean; note?: string }>;
  removeDeployment: (deploymentId: string) => Promise<void>;

  configureChannel: (
    deploymentId: string,
    spec: { id: string; config: Record<string, string>; secrets: Record<string, string> }
  ) => Promise<{ connected: boolean; detail?: string }>;
  listChannels: (deploymentId: string) => Promise<Array<{ id: string; enabled: boolean; connected?: boolean }>>;
  removeChannel: (deploymentId: string, id: string) => Promise<{ removed: boolean; note?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
