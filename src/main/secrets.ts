import fs from "fs";
import path from "path";

interface Encryptor {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

/**
 * Secrets wrapper over Electron safeStorage.
 * Persists encrypted secrets to a file or in-memory Map.
 * Never logs secret values.
 */
export class Secrets {
  private store: Map<string, Buffer>;
  private filePath: string | null;
  private encryptor: Encryptor;

  constructor(storePath: string, encryptor?: Encryptor) {
    this.store = new Map();
    this.encryptor = encryptor || this.getDefaultEncryptor();

    if (storePath === ":memory:") {
      this.filePath = null;
    } else {
      this.filePath = storePath;
      this.loadFromFile();
    }
  }

  /**
   * Set a secret value by reference.
   */
  set(ref: string, value: string): void {
    const encrypted = this.encryptor.encryptString(value);
    this.store.set(ref, encrypted);
    if (this.filePath) {
      this.saveToFile();
    }
  }

  /**
   * Get a secret value by reference.
   * Returns null if not found.
   */
  get(ref: string): string | null {
    const encrypted = this.store.get(ref);
    if (!encrypted) {
      return null;
    }
    try {
      return this.encryptor.decryptString(encrypted);
    } catch {
      return null;
    }
  }

  /**
   * Delete a secret by reference.
   */
  delete(ref: string): void {
    this.store.delete(ref);
    if (this.filePath) {
      this.saveToFile();
    }
  }

  /**
   * Load secrets from file (JSON format: {ref: base64(ciphertext)})
   */
  private loadFromFile(): void {
    if (!this.filePath || !fs.existsSync(this.filePath)) {
      return;
    }

    try {
      const content = fs.readFileSync(this.filePath, "utf-8");
      const data = JSON.parse(content);

      for (const [ref, base64Ciphertext] of Object.entries(data)) {
        const encrypted = Buffer.from(base64Ciphertext as string, "base64");
        this.store.set(ref, encrypted);
      }
    } catch {
      // If file is corrupted or missing, start with empty store
      this.store.clear();
    }
  }

  /**
   * Save secrets to file (JSON format: {ref: base64(ciphertext)})
   */
  private saveToFile(): void {
    if (!this.filePath) {
      return;
    }

    const data: Record<string, string> = {};
    for (const [ref, encrypted] of this.store) {
      data[ref] = encrypted.toString("base64");
    }

    // Ensure directory exists
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.filePath, JSON.stringify(data), "utf-8");
  }

  /**
   * Get the default encryptor from Electron safeStorage.
   */
  private getDefaultEncryptor(): Encryptor {
    try {
      const { safeStorage } = require("electron");
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error("Encryption is not available on this system");
      }
      return safeStorage;
    } catch {
      throw new Error("Electron safeStorage is not available and no encryptor was provided");
    }
  }
}
