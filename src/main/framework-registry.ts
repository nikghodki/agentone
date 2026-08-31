/**
 * Framework Registry — Metadata for the 3 supported AI agent frameworks.
 *
 * IMPORTANT: Framework features are sourced from unverified research documents
 * (docs/research/openclaw.md, docs/research/zeptoclaw.md, docs/research/hermes-agent.md).
 * These should be reconciled with verified data from the Phase 0 verification spike
 * before shipping to production.
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
      "Multi-channel messaging — WhatsApp, Telegram, Slack, Discord, Signal, iMessage, and more",
      "Local & hosted models — Supports cloud providers (Anthropic, OpenAI) and local models (Ollama, LM Studio)",
      "Extensible capabilities — Add tools, skills, and plugins from ClawHub marketplace",
      "MCP protocol support — Full Model Context Protocol client/server for tool integration",
      "Web Control UI & CLI — Dashboard at localhost:18789 plus rich CLI and TUI interfaces",
    ],
    installRecipe: {},
    isDefault: true,
  },
  {
    id: "zeptoclaw",
    name: "ZeptoClaw",
    features: [
      "Multi-Provider LLM Support — 18 providers with SSE streaming, retry/backoff, and auto-failover",
      "33 Built-in Tools + Extensibility — Shell, filesystem, web search, git, PDF reading, plus plugins and MCP",
      "Multi-Channel Gateway — Unified message bus for Telegram, Slack, Discord, WhatsApp, email, webhook",
      "6-Layer Security Model — Container sandboxes, prompt injection detection, secret leak scanner, policy engine",
      "Agent Swarms & Delegation — Parallel sub-agent delegation with cost-aware routing and aggregation",
    ],
    installRecipe: {},
  },
  {
    id: "hermes",
    name: "Hermes Agent",
    features: [
      "Multi-Platform Gateway — Single agent accessible from Telegram, Discord, Slack, WhatsApp, Signal, CLI",
      "Autonomous Skill Creation — Built-in learning loop that creates skills from tasks and self-improves",
      "Persistent Memory & Search — Agent-curated memory with FTS5 full-text session search and cross-session recall",
      "Flexible Terminal Backends — Seven execution environments including Docker, SSH, Modal, Daytona, Vercel",
      "Scheduled Automation — Built-in cron scheduler with natural language task definitions",
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
