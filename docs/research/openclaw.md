# OpenClaw Agent Framework Research

**Research Date:** August 31, 2026  
**Purpose:** Desktop app adapter feasibility assessment  
**Repository:** https://github.com/openclaw/openclaw

---

## 1. What It Is

**One-line description:**  
OpenClaw is a self-hosted AI assistant gateway that connects messaging channels to AI agents with extensible tools, running locally on any OS.

**Tagline (from repo):**  
> "Your own personal AI assistant. Any OS. Any Platform. The lobster way. 🦞"

### Top 5 User-Facing Features (for onboarding card):

1. **Multi-channel messaging** — Works through WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, and more
2. **Local & hosted models** — Supports both cloud LLM providers (Anthropic, OpenAI, etc.) and local models (Ollama, LM Studio)
3. **Extensible capabilities** — Add tools, skills, and plugins from ClawHub marketplace or custom sources
4. **MCP protocol support** — Full Model Context Protocol client/server for tool integration
5. **Web Control UI & CLI** — Dashboard at localhost:18789 plus rich CLI and TUI interfaces

### Real/Maintained Status:

- **Stars:** 388,300+ (highly popular)
- **Forks:** 81,500+
- **Commits:** 85,607
- **Last Activity:** Aug 31, 2026 (multiple commits today)
- **Primary Language:** TypeScript
- **Runtime:** Node.js (22.22.3+, 24.15+, 25.9+, or 26 recommended)
- **Organization:** OpenClaw Foundation (non-profit)
- **License:** MIT

**Confidence:** HIGH — Active, well-maintained project with strong community and recent development

**Evidence:**
> "Most recent commits (all dated Aug 31, 2026): `71ce840` — refactor: consolidate upgrade recovery ownership (#134415) by steipete"  
> Source: https://github.com/openclaw/openclaw/commits/main

---

## 2. Install + Configure Locally

### Installation Methods:

**Primary (macOS/Linux/WSL2):**
```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

**Windows PowerShell:**
```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

**Via npm (recommended for development):**
```bash
npm install -g openclaw@latest --allow-scripts=openclaw
```
Note: Omit `--allow-scripts=openclaw` on npm 11.15 and earlier.

**From source (development):**
```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm build
pnpm ui:build
```

**Docker/Hosting:**  
Repository includes `Dockerfile`, `docker-compose.yml`, `fly.toml`, and `render.yaml` for containerized deployments.

### Runtime Prerequisites:

- **Node.js:** Version 22.22.3+, 24.15+, 25.9+, or 26 (recommended)
- **Package manager:** npm 11.15+ or pnpm (for development)
- **API Key:** Required from chosen model provider (Anthropic, OpenAI, etc.)

### Configuration:

**Primary config location:**
```
~/.openclaw/openclaw.json
```

**Format:** JSON5 (JSON with comments)

**Example config structure:**
```json5
{
  agents: {
    defaults: {
      model: { primary: "anthropic/claude-opus-4-6" }
    }
  },
  channels: {
    whatsapp: {
      allowFrom: ["..."]
    }
  }
}
```

**Configuration commands:**
```bash
openclaw onboard --install-daemon  # Initial setup
openclaw config set <key> <value>  # Update settings
openclaw gateway status            # Check daemon status
```

### Hosted/Remote/Cloud Options:

- **Self-hosted:** Primary deployment model (local Gateway daemon)
- **Cloud hosting:** Supports deployment to Fly.io, Render.com (config files included)
- **Remote Gateway:** Can connect to remote Gateway via WebSocket URL with token authentication

**Confidence:** HIGH — Well-documented installation with multiple paths

**Evidence:**
> "Install paths: macOS / Linux / WSL2: `curl -fsSL https://openclaw.ai/install.sh | bash`"  
> "Config lives at `~/.openclaw/openclaw.json` (JSON5 format)"  
> Source: https://docs.openclaw.ai/install, https://docs.openclaw.ai/gateway/configuration

---

## 3. Invoke + Stream

### Query/Task Invocation:

**CLI messaging:**
```bash
openclaw message send <text>          # Send message to agent
openclaw message broadcast <text>     # Broadcast to multiple channels
openclaw infer model run              # Direct inference
openclaw infer web search|fetch       # Web operations
```

**Interactive interfaces:**
```bash
openclaw tui                          # Terminal UI (full interactive)
openclaw chat                         # Alias for tui --local
openclaw terminal                     # Alias for tui --local
openclaw dashboard                    # Web UI at http://127.0.0.1:18789/
```

**Programmatic (via channels):**
- Connect through messaging apps (Telegram, Slack, WhatsApp, etc.)
- Gateway bridges chat apps to the agent runtime
- Messages route through the Gateway's typed WebSocket API

### Streaming Output:

**CLI streaming behavior:**
> "Long-running commands show a progress indicator (OSC 9;4 when supported)."

**Related streaming commands:**
```bash
openclaw logs                         # View streaming logs
openclaw attach                       # Attach to running session
openclaw acp                          # Streaming data protocol
```

**JSON output mode:**
```bash
<command> --json                      # Structured output for bounded commands
```

**Transport protocol:**
- Gateway exposes WebSocket API (text frames, JSON payloads)
- Accept-then-stream pattern: request → ack with `status:"accepted"` → streaming events → final result
- Side-effecting methods require idempotency keys for safe retry

### Concrete Command Examples:

```bash
# Start interactive session
openclaw tui

# Send direct query
openclaw message send "Analyze this codebase"

# Web search
openclaw infer web search "latest AI news"

# Resume previous session
openclaw resume
```

**Confidence:** HIGH — Multiple documented invocation paths

**Evidence:**
> "`openclaw message` — with subcommands like `send`, `broadcast`, `poll`, `react`, `read`, `edit`, `delete`"  
> "`openclaw tui` — the terminal UI"  
> "Gateway exposes a typed WS API (requests, responses, server-push events)"  
> Source: https://docs.openclaw.ai/cli

---

## 4. Model Backend

### External LLM Requirement:

**YES** — OpenClaw requires an external LLM provider. It does not include its own model weights.

### Supported Providers:

**Major Cloud Providers:**
- **Anthropic** (API + Claude CLI integration)
- **OpenAI** (API + Codex integration)
- **Amazon Bedrock** (including Bedrock Mantle variant)
- **Google Gemini**
- **Azure Speech** (Speech services; text models via OpenAI-compatible endpoints)

**Specialized Providers:**
- **xAI**, **Groq** (LPU inference), **Mistral**, **DeepSeek**, **Cohere**
- **Perplexity** (includes web search capability)
- **Z.AI (GLM)**

**Local Model Services:**
- **Ollama** (cloud + local models)
- **LM Studio**
- **llama.cpp** (managed or existing server)
- **vLLM**, **SGLang**, **inferrs**
- **ds4** (local DeepSeek V4)

**Aggregators/Gateways:**
- **OpenRouter**
- **LiteLLM** (unified gateway)
- **ClawRouter** (managed multi-provider routing)
- **Cloudflare AI Gateway**, **Vercel AI Gateway**

### Configuration:

**Setup workflow:**
1. Authenticate via `openclaw onboard` (guides through provider selection and API key entry)
2. Set default model in config:
```json5
{
  agents: {
    defaults: {
      model: { primary: "anthropic/claude-opus-4-6" }
    }
  }
}
```

**Model format:** `provider/model` (e.g., `anthropic/claude-opus-4-6`, `openai/gpt-4`)

**Credentials:**
- API keys stored securely during onboarding
- File-based secrets preferred over inline (`--token-file`, `--password-file`)
- Onboarding "verifies model access" before completion

### Failover/Selection:

- Shared media generation tools support provider selection and failover
- `primary` field in config implies additional selection options
- ClawRouter provides managed multi-provider routing

**Confidence:** HIGH — Comprehensive provider support documented

**Evidence:**
> "OpenClaw supports many LLM providers. The general workflow: authenticate with the provider, then set the default model using the `provider/model` format."  
> "Several providers explicitly support running models locally: Ollama, LM Studio, inferrs, SGLang, vLLM, ds4, llama.cpp"  
> Source: https://docs.openclaw.ai/providers

---

## 5. Capabilities (Tools/Plugins/Skills/MCP)

### Three Extension Surfaces:

OpenClaw uses a three-layer capability model:

**1. Tools** — Callable functions
> "A typed function the agent can call"

Examples: `exec`, `browser`, `web_search`, `read`, `write`, `edit`, `ask_user`

**2. Skills** — Instruction workflows
> "A SKILL.md instruction pack loaded into the agent prompt"

Skills teach repeatable workflows using existing tools. Located in:
- Workspace directory
- Shared skill directory
- Managed skill root
- Plugin packages

**3. Plugins** — Runtime extensions
> "Add tools, skills, channels, providers, hooks, and more"

Plugins are the primary extension mechanism.

### Built-in Tool Categories:

- **Runtime:** `exec`, `process`, `terminal`
- **Files:** `read`, `write`, `edit`
- **Web:** `web_search`, `x_search`, `web_fetch`
- **Human input:** `ask_user`, `secrets`
- **Browser, Media, and more**

### Adding/Enabling Capabilities:

**Plugins:**
```bash
openclaw plugins search <query>       # Find plugins in ClawHub
openclaw plugins install <name>       # Install from ClawHub/npm/git/local
openclaw plugins list                 # List installed plugins
openclaw plugins enable <name>        # Enable a plugin
openclaw plugins disable <name>       # Disable a plugin
openclaw plugins doctor               # Diagnose plugin issues
```

**Skills:**
```bash
openclaw skills search <query>        # Find skills
openclaw skills install <name>        # Install skill
openclaw skills list                  # List installed skills
openclaw skills verify                # Verify skill integrity
```

**Plugin sources:**
> "Plugins can be installed from ClawHub, npm, git, local directories, or archives"

### MCP (Model Context Protocol) Support:

**YES** — Full MCP client and server support.

**As MCP Server (exposing OpenClaw):**
```bash
openclaw mcp serve                    # Start MCP server via stdio
openclaw mcp serve --url wss://...    # Connect to remote Gateway
```

Exposed tools: `conversations_list`, `conversation_get`, `messages_read`, `attachments_fetch`, `events_poll`, `events_wait`, `messages_send`, `permissions_list_open`, `permissions_respond`

**As MCP Client (consuming external MCP servers):**
```bash
openclaw mcp add <name> --command <cmd> --arg <args>
openclaw mcp list                     # List configured MCP servers
openclaw mcp probe <name>             # Test connection and list tools
openclaw mcp tools <name> --include <patterns>
openclaw mcp configure <name>         # Update server settings
openclaw mcp login <name>             # OAuth for HTTP servers
```

**MCP transport support:**
- **stdio:** Launch local child process
- **SSE/HTTP:** HTTP streaming endpoints
- **streamable-http:** Canonical HTTP streaming

**Example MCP server installation:**
```bash
openclaw mcp add memory --command npx --arg -y --arg @modelcontextprotocol/server-memory
openclaw mcp set docs '{"url":"https://mcp.example.com","transport":"streamable-http"}'
```

### Discovery and Management:

**Tool filtering/policy:**
- Tools filtered by: active profile, allow/deny lists, provider restrictions, sandbox state, channel permissions, plugin availability
- Per-server tool filters: `toolFilter.include`/`exclude` with glob patterns
- `enabled: false` keeps server saved but excludes from discovery

**Large catalog handling:**
> "Tool Search and Code Mode let agents search, call, and combine many eligible tools without sending every schema to the model."

**Where capabilities live:**
- **Plugins:** Installed via package manager, registered in config
- **MCP servers:** Defined in `mcp.servers` config section
- **Skills:** Workspace, shared directories, or plugin packages
- **Tools:** Registered via plugin API `api.registerTool(...)` and manifest `contracts.tools`

**Confidence:** HIGH — Comprehensive, well-documented capability system

**Evidence:**
> "The three surfaces: Tools are callable actions; Skills teach workflows; Plugins add runtime capabilities"  
> "MCP support: `openclaw mcp` command with `serve`, `list`, `show`, `add`, `set`, `configure` subcommands"  
> "Official plugins install on demand"  
> Source: https://docs.openclaw.ai/tools, https://docs.openclaw.ai/cli/mcp

---

## 6. Self-Install + Web-Search (CRITICAL)

### Can the agent self-install capabilities during a task?

**NO** — Not documented or supported.

The documentation presents capability installation as an **operator/configuration activity**, not an agent-autonomous action. Installation commands (`openclaw plugins install`, `openclaw mcp add`) are CLI operations requiring human initiation.

**Evidence:**
> "The documentation does not describe agents self-installing tools or capabilities mid-task. Installation is presented as an operator/configuration activity via the Plugins page."  
> Source: https://docs.openclaw.ai/tools

### Does it emit signals when missing a capability?

**NOT DOCUMENTED** — No information found about agents signaling missing capabilities.

The docs describe tool filtering and discovery but do not mention error signals, capability-missing events, or agent awareness of unavailable tools.

### Web search capability:

**YES** — Built-in web search tool.

OpenClaw includes `web_search` as a built-in tool in the Web category, plus `x_search` (X/Twitter posts) and `web_fetch` (readable page content).

**CLI access:**
```bash
openclaw infer web search "query"
openclaw infer web fetch "url"
```

**Agent access:**
Agents can call `web_search` tool during task execution (subject to tool policy/profile).

**Provider integration:**
- Standard web search via built-in tool
- **Perplexity provider** offers web-search-augmented LLM responses

### Self-installation mechanism:

**NONE DOCUMENTED**

The capability system requires:
1. Operator runs `openclaw plugins install <name>` or `openclaw mcp add <name>`
2. Configuration updated in `~/.openclaw/openclaw.json`
3. Plugin/MCP server enabled and discovered by agent runtime

There is **no mechanism** for an agent to:
- Detect missing capabilities autonomously
- Search ClawHub/npm for needed plugins
- Install and enable new tools during task execution
- Emit structured "capability missing" signals

### On-demand plugin installation:

> "Official plugins install on demand"

This refers to **channel plugins** (Matrix, Nostr, Twitch, Zalo) being installed when the operator configures those channels, NOT agent-initiated installation during tasks.

**Confidence:** HIGH (for absence) — Thoroughly searched documentation, no evidence of self-install

**Evidence:**
> "The documentation does NOT describe agents self-installing tools or capabilities mid-task"  
> "Plugins can be installed from ClawHub, npm, git, local directories, or archives" (but via CLI commands)  
> "Web category covers `web_search`, `x_search`, and `web_fetch`"  
> Source: https://docs.openclaw.ai/tools, https://docs.openclaw.ai/clawhub

---

## 7. License

**License Type:** MIT License

**Copyright:** Copyright (c) 2026 OpenClaw Foundation

**Key Terms:**
- Permissive open-source license
- Free to use, modify, distribute, sublicense, and sell
- **Attribution requirement:** Copyright and permission notice must be included in all copies or substantial portions
- **No warranty:** Software provided "AS IS" without warranty of any kind
- **No liability:** Authors not liable for claims or damages

**Third-party notices:** Documented separately in `THIRD_PARTY_NOTICES.md`

**Implications for adapter:**
- Can be integrated into commercial desktop app
- Must retain MIT license notice and OpenClaw Foundation copyright
- No restrictions on wrapping, embedding, or adapting the framework

**Confidence:** HIGH — Standard MIT license, very permissive

**Evidence:**
> "MIT License, Copyright (c) 2026 OpenClaw Foundation"  
> "The license grants broad permissions to use, modify, distribute, sublicense, and sell the software free of charge, subject to certain conditions."  
> Source: https://raw.githubusercontent.com/openclaw/openclaw/main/LICENSE

---

## Summary Assessment

### Adapter Feasibility: HIGH

OpenClaw is well-suited for desktop app integration:
- ✅ Mature, actively maintained (85k+ commits, 388k+ stars)
- ✅ Multiple installation methods (npm, curl script, Docker)
- ✅ Clear CLI and programmatic interfaces
- ✅ Comprehensive provider support (Anthropic, OpenAI, local models)
- ✅ Rich capability system (tools, skills, plugins, MCP)
- ✅ Permissive MIT license
- ✅ Built-in web search

### Single Biggest Risk/Unknown:

**No agent self-installation of capabilities** — The framework lacks a mechanism for agents to autonomously discover, install, and enable missing tools/plugins during task execution. This is a critical gap for an "auto-provisioning" desktop app.

**Workarounds:**
1. Pre-install common plugins during desktop app setup
2. Build custom capability detection and prompt user for installation approval
3. Develop a wrapper that monitors agent requests and suggests plugin installations
4. Fork OpenClaw to add agent-initiated capability installation (significant effort)

### Other Risks:

- **Dependency on external LLM providers** — Requires API keys and network access (mitigated by local model support)
- **Gateway daemon management** — Desktop app must handle daemon lifecycle (start, stop, health checks)
- **Configuration complexity** — Rich config surface may require guided setup UI
- **WebSocket protocol** — Need to implement WS client for programmatic control

### Strengths for Adapter:

- Node.js runtime (cross-platform, Electron-native)
- Rich CLI makes scripted installation/config straightforward
- MCP support enables future tool ecosystem growth
- Active community and foundation backing
- Excellent documentation

---

**Report generated:** August 31, 2026  
**File location:** `$(repo root)/docs/research/openclaw.md`
