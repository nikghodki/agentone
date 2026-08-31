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
    this.port = port !== undefined ? port : (11500 + Math.floor(Math.random() * 1001));
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
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/tags`, { signal: ctrl.signal });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(t);
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
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines.filter(Boolean)) {
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

    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer);
        if (data.total && data.completed) {
          onProgress(Math.round((data.completed / data.total) * 100));
        }
        if (data.status === "success") {
          onProgress(100);
        }
      } catch {
        // skip
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
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines.filter(Boolean)) {
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

    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer);
        if (data.message?.content) {
          const token = data.message.content;
          fullResponse += token;
          onToken(token);
        }
      } catch {
        // skip
      }
    }

    return fullResponse;
  }
}
