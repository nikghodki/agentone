/**
 * Framework Registry — Metadata for the 3 supported AI agent frameworks.
 *
 * Features are sourced from Phase 0 verified installation and interface docs:
 * - docs/research/verified/openclaw.md
 * - docs/research/verified/zeptoclaw.md
 * - docs/research/verified/hermes-agent.md
 *
 * NOTE: OpenClaw's Ollama wiring is PARTIAL/needs work per the Phase 0 spike.
 */

import type { Database } from "./database";
import type { FrameworkMeta } from "../shared/v2-types";

/**
 * Static registry of the 3 frameworks, each with exactly 5 user-facing features
 * sourced from research documents.
 */
export const FRAMEWORKS: FrameworkMeta[] = [
  {
    id: "openclaw",
    name: "OpenClaw",
    features: [
      "Multi-channel messaging gateway (WhatsApp, Telegram, Slack, Discord, Signal)",
      "Cloud model providers (Anthropic, OpenAI) with OpenAI-compatible streaming",
      "MCP protocol native support (server and client commands)",
      "Extensible via ClawHub skills, plugins, and tools",
      "Rich CLI with 60+ commands and WebSocket Gateway architecture",
    ],
    installRecipe: {},
    isDefault: true,
  },
  {
    id: "zeptoclaw",
    name: "ZeptoClaw",
    features: [
      "Lightweight Rust binary (6MB, no runtime dependencies)",
      "Local model support via Ollama (tested with llama3.2:3b)",
      "Hot-reload capabilities (skills available immediately, no restart)",
      "Multi-channel gateway (Telegram, Slack, Discord, WhatsApp, email)",
      "MCP servers and extensible skills system",
    ],
    installRecipe: {},
  },
  {
    id: "hermes",
    name: "Hermes Agent",
    features: [
      "Self-contained install with bundled Python 3.11 and Node 26 runtimes",
      "58 bundled skills plus skill marketplace and MCP server support",
      "Multi-channel gateway (Telegram, Slack, Discord, WhatsApp, Signal)",
      "Local Ollama support verified (tested with llama3.2:3b)",
      "Rich CLI with 60+ commands including one-shot mode and TUI",
    ],
    installRecipe: {},
  },
];

/**
 * Seeds the framework registry into the database.
 * Populates the frameworks table with the static FRAMEWORKS list.
 */
export function seedFrameworkRegistry(db: Database): void {
  db.seedFrameworks(FRAMEWORKS);
}
