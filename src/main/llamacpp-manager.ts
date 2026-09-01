import { spawn, execFile, ChildProcess } from "child_process";
import { promises as fsPromises } from "fs";
import * as fs from "fs";
import * as path from "path";

const DEFAULT_GGUF_URL = "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf";
const LLAMA_CPP_RELEASES_API = "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest";

interface FsOps {
  mkdir: (path: string, opts?: any) => Promise<void>;
  writeFile: (path: string, data: Uint8Array) => Promise<void>;
  chmod: (path: string, mode: number) => Promise<void>;
  unlink: (path: string) => Promise<void>;
}

interface LlamaCppOptions {
  fetchFn?: typeof fetch;
  spawnFn?: typeof spawn;
  existsFn?: (p: string) => boolean;
  fsOps?: FsOps;
  execFileFn?: typeof execFile;
  statSyncFn?: (p: string) => { size: number };
  port?: number;
}

export class LlamaCppManager {
  private installDir: string;
  private port: number;
  private fetchFn: typeof fetch;
  private spawnFn: typeof spawn;
  private existsFn: (p: string) => boolean;
  private fsOps: FsOps;
  private execFileFn: typeof execFile;
  private statSyncFn: (p: string) => { size: number };
  private process: ChildProcess | null = null;
  private resolvedBinaryPath: string | null = null;

  constructor(installDir: string, opts?: LlamaCppOptions) {
    this.installDir = installDir;
    this.port = opts?.port !== undefined ? opts.port : (8100 + Math.floor(Math.random() * 900));
    this.fetchFn = opts?.fetchFn ?? fetch;
    this.spawnFn = opts?.spawnFn ?? spawn;
    this.existsFn = opts?.existsFn ?? fs.existsSync;
    this.execFileFn = opts?.execFileFn ?? execFile;
    this.statSyncFn = opts?.statSyncFn ?? fs.statSync;
    this.fsOps = opts?.fsOps ?? {
      mkdir: fsPromises.mkdir,
      writeFile: fsPromises.writeFile,
      chmod: fsPromises.chmod,
      unlink: fsPromises.unlink
    };
  }

  getPort(): number {
    return this.port;
  }

  getBaseUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  async ensureInstalled(onProgress: (pct: number) => void): Promise<void> {
    const llamaServerPath = path.join(this.installDir, "llama-server");

    // Skip if already exists (check both direct and resolved paths)
    if (this.existsFn(llamaServerPath)) {
      this.resolvedBinaryPath = llamaServerPath;
      return;
    }

    // If we already resolved a nested path, skip
    if (this.resolvedBinaryPath && this.existsFn(this.resolvedBinaryPath)) {
      return;
    }

    // Fetch releases data
    const releasesResponse = await this.fetchFn(LLAMA_CPP_RELEASES_API);
    if (!releasesResponse.ok) {
      throw new Error(`Failed to fetch releases: ${releasesResponse.statusText}`);
    }
    const releasesData: any = await releasesResponse.json();

    // Find macOS ARM64 asset
    const asset = releasesData.assets.find((a: any) =>
      /llama-.*-bin-macos-arm64\.zip/.test(a.name)
    );
    if (!asset) {
      throw new Error("Could not find llama.cpp macOS ARM64 binary in releases");
    }

    // Download the zip
    const zipPath = path.join(this.installDir, "llama.zip");
    await this.downloadFile(asset.browser_download_url, zipPath, onProgress);

    // Unzip
    await new Promise<void>((resolve, reject) => {
      this.execFileFn("unzip", ["-o", zipPath, "-d", this.installDir], (err) => {
        if (err) {
          reject(new Error(`Failed to unzip: ${err.message}`));
        } else {
          resolve();
        }
      });
    });

    // Resolve the binary path (may be nested)
    const resolvedPath = this.findLlamaServer(this.installDir);
    if (!resolvedPath) {
      throw new Error("llama-server binary not found after extraction");
    }
    this.resolvedBinaryPath = resolvedPath;

    // Make executable
    await this.fsOps.chmod(this.resolvedBinaryPath, 0o755);

    // Clean up zip
    try {
      await this.fsOps.unlink(zipPath);
    } catch {
      // Ignore cleanup errors
    }
  }

  async ensureModel(
    modelSpec: { url?: string; localPath?: string },
    onProgress: (pct: number) => void
  ): Promise<string> {
    // If localPath is provided, verify it exists
    if (modelSpec.localPath) {
      if (!this.existsFn(modelSpec.localPath)) {
        throw new Error(`llama.cpp model file not found: ${modelSpec.localPath}`);
      }
      return modelSpec.localPath;
    }

    // Download URL (use default if not provided)
    const url = modelSpec.url ?? DEFAULT_GGUF_URL;
    const modelFileName = path.basename(url);
    const modelsDir = path.join(this.installDir, "models");
    const modelPath = path.join(modelsDir, modelFileName);

    // Check if file already exists - validate completeness
    if (this.existsFn(modelPath)) {
      // Verify file is complete by checking size against content-length
      let shouldRedownload = false;
      try {
        const headResponse = await this.fetchFn(url, { method: "HEAD" } as any);
        if (headResponse.ok) {
          const contentLength = headResponse.headers.get("content-length");
          if (contentLength) {
            const expectedSize = parseInt(contentLength, 10);
            const actualSize = this.statSyncFn(modelPath).size;
            if (actualSize < expectedSize) {
              // File is incomplete, delete and re-download
              await this.fsOps.unlink(modelPath);
              shouldRedownload = true;
            }
          }
        }
      } catch {
        // HEAD request failed or no content-length - keep existing file
      }

      if (!shouldRedownload) {
        return modelPath;
      }
    }

    // Ensure models directory exists
    await this.fsOps.mkdir(modelsDir, { recursive: true });

    // Download the model
    const expectedSize = await this.downloadFile(url, modelPath, onProgress);

    // Verify download completeness if we got an expected size
    if (expectedSize > 0) {
      const actualSize = this.statSyncFn(modelPath).size;
      if (actualSize < expectedSize) {
        throw new Error(`Downloaded model is incomplete: expected ${expectedSize} bytes, got ${actualSize} bytes`);
      }
    }

    return modelPath;
  }

  async start(modelPath: string): Promise<void> {
    // Use resolved path if available, otherwise fallback to direct path
    const llamaServerPath = this.resolvedBinaryPath || path.join(this.installDir, "llama-server");

    let spawnError: Error | null = null;

    this.process = this.spawnFn(
      llamaServerPath,
      [
        "--model", modelPath,
        "--host", "127.0.0.1",
        "--port", String(this.port),
        "--n-gpu-layers", "999"
      ],
      { stdio: "pipe" }
    );

    this.process.on("error", (err) => {
      spawnError = new Error(`Failed to start llama-server: ${err.message}`);
    });

    if (this.process.stdout) {
      this.process.stdout.on("data", () => {});
    }
    if (this.process.stderr) {
      this.process.stderr.on("data", () => {});
    }

    // Poll for readiness
    for (let i = 0; i < 40; i++) {
      // Check if spawn failed
      if (spawnError) {
        throw spawnError;
      }

      if (await this.isReady()) {
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    // Final check for spawn error
    if (spawnError) {
      throw spawnError;
    }

    throw new Error("llama-server did not become ready within timeout");
  }

  async isReady(): Promise<boolean> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    try {
      const response = await this.fetchFn(`http://127.0.0.1:${this.port}/health`, {
        signal: ctrl.signal
      } as any);
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(t);
    }
  }

  stop(): void {
    if (this.process) {
      this.process.kill("SIGTERM");

      // Set up delayed SIGKILL if still alive (only if process has 'once' method)
      if (typeof (this.process as any).once === "function") {
        const gracePeriod = setTimeout(() => {
          if (this.process) {
            this.process.kill("SIGKILL");
          }
        }, 5000);

        (this.process as any).once("exit", () => {
          clearTimeout(gracePeriod);
        });
      }

      this.process = null;
    }
  }

  /**
   * Recursively searches for llama-server binary in the install directory.
   * Returns the absolute path if found, null otherwise.
   */
  private findLlamaServer(dir: string, depth: number = 0): string | null {
    // Limit recursion depth to avoid infinite loops
    if (depth > 10) return null;

    // Check direct path first
    const directPath = path.join(dir, "llama-server");
    if (this.existsFn(directPath)) {
      return directPath;
    }

    // Try common nested locations
    const commonPaths = [
      path.join(dir, "build", "bin", "llama-server"),
      path.join(dir, "bin", "llama-server"),
      path.join(dir, "build", "llama-server")
    ];

    for (const p of commonPaths) {
      if (this.existsFn(p)) {
        return p;
      }
    }

    return null;
  }

  private async downloadFile(
    url: string,
    destPath: string,
    onProgress: (pct: number) => void
  ): Promise<number> {
    const response = await this.fetchFn(url);
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.statusText}`);
    }

    const contentLength = response.headers.get("content-length");
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
    let downloadedBytes = 0;

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      downloadedBytes += value.length;

      if (totalBytes > 0) {
        const pct = Math.round((downloadedBytes / totalBytes) * 100);
        onProgress(pct);
      }
    }

    // Concatenate all chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const buffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Write to file
    await this.fsOps.writeFile(destPath, buffer);

    if (totalBytes > 0) {
      onProgress(100);
    }

    return totalBytes;
  }
}
