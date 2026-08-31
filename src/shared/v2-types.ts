export interface FrameworkMeta {
  id: "openclaw" | "zeptoclaw" | "hermes";
  name: string;
  features: string[];              // top-5 for onboarding cards
  installRecipe: Record<string, unknown>;
  isDefault?: boolean;
}
export interface NewDeployment {
  frameworkId: string;
  location: "local" | "remote";
  remoteUrl: string | null;
  modelBackendId: string | null;
}
export interface Deployment extends NewDeployment {
  id: string; status: string; createdAt: string;
}
export type ModelBackendKind = "ollama" | "llamacpp" | "vllm" | "custom" | "cloud";
export type ModelProtocol = "v1/messages" | "v1/chat/completions";
export interface ModelBackendConfig {
  id: string; kind: ModelBackendKind; provider: string | null;
  baseUrl: string | null; protocol: ModelProtocol; model: string;
  secretRef: string | null;        // -> keychain ref, never the raw key
}
export interface InstalledCapability {
  deploymentId: string; type: "mcp" | "plugin" | "skill"; name: string; source: string;
}
export interface ChatMessage { role: "system" | "user" | "assistant"; content: string; }
// Interfaces implemented in later tasks:
export interface ModelBackend { chat(messages: ChatMessage[], onToken: (t: string) => void): Promise<string>; }
export interface FrameworkAdapter {
  install(): Promise<void>;
  configure(backend: ModelBackendConfig): Promise<void>;
  start(): Promise<void>; stop(): Promise<void>; status(): Promise<string>;
  sendTask(input: string): Promise<void>;
  streamOutput(cb: (chunk: string) => void): () => void;
  listCapabilities(): Promise<InstalledCapability[]>;
  installCapability(spec: { type: string; name: string }): Promise<void>;
  restart(): Promise<void>;
}
