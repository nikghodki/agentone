import BetterSqlite3 from "better-sqlite3";
import { randomUUID } from "crypto";
import type { UserProfile, Conversation, Message, TaskUsage } from "../shared/types";
import type { FrameworkMeta, NewDeployment, Deployment, ModelBackendConfig, InstalledCapability } from "../shared/v2-types";

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
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
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

      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

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

      CREATE TABLE IF NOT EXISTS frameworks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        features TEXT NOT NULL,
        install_recipe TEXT NOT NULL,
        is_default INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS deployments (
        id TEXT PRIMARY KEY,
        framework_id TEXT NOT NULL REFERENCES frameworks(id),
        location TEXT NOT NULL CHECK(location IN ('local', 'remote')),
        remote_url TEXT,
        model_backend_id TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS model_backends (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        provider TEXT,
        base_url TEXT,
        protocol TEXT NOT NULL,
        model TEXT NOT NULL,
        secret_ref TEXT,
        extra_json TEXT
      );

      CREATE TABLE IF NOT EXISTS capabilities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deployment_id TEXT NOT NULL REFERENCES deployments(id),
        type TEXT NOT NULL CHECK(type IN ('mcp', 'plugin', 'skill')),
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        installed_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_capabilities_deployment_id ON capabilities(deployment_id);
    `);

    // Migration: ensure extra_json exists on model_backends created before this column was added.
    const cols = this.db.prepare("PRAGMA table_info(model_backends)").all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "extra_json")) {
      this.db.exec("ALTER TABLE model_backends ADD COLUMN extra_json TEXT");
    }
  }

  getProfile(): UserProfile | null {
    const row = this.db.prepare("SELECT * FROM user_profile WHERE id = 1").get() as any;
    if (!row) return null;
    let priorities: string[] = [];
    try {
      priorities = JSON.parse(row.priorities);
    } catch {
      // Fall back to empty priorities if JSON is corrupted
      priorities = [];
    }
    return {
      persona: row.persona,
      priorities,
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
      // rowid DESC as tiebreaker: insertion order is stable for never-VACUUMed local DB, resolves same-timestamp collisions
      .prepare("SELECT * FROM conversations ORDER BY updated_at DESC, rowid DESC LIMIT ?")
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

  seedFrameworks(list: FrameworkMeta[]): void {
    for (const fw of list) {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO frameworks (id, name, features, install_recipe, is_default)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          fw.id,
          fw.name,
          JSON.stringify(fw.features),
          JSON.stringify(fw.installRecipe),
          fw.isDefault ? 1 : 0
        );
    }
  }

  getFrameworks(): FrameworkMeta[] {
    return this.db
      .prepare("SELECT * FROM frameworks")
      .all()
      .map((row: any) => {
        let features: string[] = [];
        let installRecipe: Record<string, unknown> = {};
        try {
          features = JSON.parse(row.features);
        } catch {
          features = [];
        }
        try {
          installRecipe = JSON.parse(row.install_recipe);
        } catch {
          installRecipe = {};
        }
        return {
          id: row.id,
          name: row.name,
          features,
          installRecipe,
          isDefault: row.is_default === 1,
        };
      });
  }

  createDeployment(d: NewDeployment): Deployment {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO deployments (id, framework_id, location, remote_url, model_backend_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, d.frameworkId, d.location, d.remoteUrl, d.modelBackendId, "pending", now);
    return {
      id,
      frameworkId: d.frameworkId,
      location: d.location,
      remoteUrl: d.remoteUrl,
      modelBackendId: d.modelBackendId,
      status: "pending",
      createdAt: now,
    };
  }

  getDeployments(): Deployment[] {
    return this.db
      .prepare("SELECT * FROM deployments ORDER BY created_at DESC")
      .all()
      .map((row: any) => ({
        id: row.id,
        frameworkId: row.framework_id,
        location: row.location,
        remoteUrl: row.remote_url,
        modelBackendId: row.model_backend_id,
        status: row.status,
        createdAt: row.created_at,
      }));
  }

  updateDeploymentStatus(id: string, status: string): void {
    this.db
      .prepare("UPDATE deployments SET status = ? WHERE id = ?")
      .run(status, id);
  }

  saveModelBackend(b: ModelBackendConfig): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO model_backends (id, kind, provider, base_url, protocol, model, secret_ref, extra_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(b.id, b.kind, b.provider, b.baseUrl, b.protocol, b.model, b.secretRef,
           b.extra != null ? JSON.stringify(b.extra) : null);
  }

  getModelBackend(id: string): ModelBackendConfig | null {
    const row = this.db.prepare("SELECT * FROM model_backends WHERE id = ?").get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      kind: row.kind,
      provider: row.provider,
      baseUrl: row.base_url,
      protocol: row.protocol,
      model: row.model,
      secretRef: row.secret_ref,
      extra: row.extra_json ? JSON.parse(row.extra_json) : null,
    };
  }

  recordCapability(c: InstalledCapability): void {
    this.db
      .prepare(
        `INSERT INTO capabilities (deployment_id, type, name, source)
         VALUES (?, ?, ?, ?)`
      )
      .run(c.deploymentId, c.type, c.name, c.source);
  }

  getCapabilities(deploymentId: string): InstalledCapability[] {
    return this.db
      .prepare("SELECT * FROM capabilities WHERE deployment_id = ?")
      .all(deploymentId)
      .map((row: any) => ({
        deploymentId: row.deployment_id,
        type: row.type,
        name: row.name,
        source: row.source,
      }));
  }

  close(): void {
    this.db.close();
  }
}
