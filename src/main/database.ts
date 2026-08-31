import BetterSqlite3 from "better-sqlite3";
import { randomUUID } from "crypto";
import type { UserProfile, Conversation, Message, TaskUsage } from "../shared/types";

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
        id INTEGER PRIMARY KEY DEFAULT 1,
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
    `);
  }

  getProfile(): UserProfile | null {
    const row = this.db.prepare("SELECT * FROM user_profile WHERE id = 1").get() as any;
    if (!row) return null;
    return {
      persona: row.persona,
      priorities: JSON.parse(row.priorities),
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

  close(): void {
    this.db.close();
  }
}
