# Hermes Agent Research Report

**Research Date:** 2026-08-31  
**Repository:** https://github.com/NousResearch/hermes-agent  
**License:** MIT  
**Stars:** 238,932  
**Last Updated:** 2026-08-31 (actively maintained)  
**Primary Language:** Python (with JavaScript for TUI/desktop app)

---

## 1. What It Is

**One-line description:** A self-improving AI agent with autonomous skill creation, multi-platform support, and persistent memory across sessions.

**Confidence:** HIGH (verified from official repo and documentation)

**Quote from README:**
> "The self-improving AI agent built by Nous Research. It's the only agent with a built-in learning loop — it creates skills from experience, improves them during use, nudges itself to persist knowledge, searches its own past conversations, and builds a deepening model of who you are across sessions."

### Top 5 User-Facing Features (for onboarding card):

1. **Multi-Platform Gateway** — Single agent accessible from Telegram, Discord, Slack, WhatsApp, Signal, and CLI with voice memo transcription and cross-platform conversation continuity.

2. **Autonomous Skill Creation** — Built-in learning loop that creates skills from complex tasks, improves them during use, and persists knowledge automatically (compatible with agentskills.io open standard).

3. **Persistent Memory & Search** — Agent-curated memory with FTS5 full-text session search, LLM summarization for cross-session recall, and Honcho dialectic user modeling.

4. **Flexible Terminal Backends** — Seven execution environments (local, Docker, SSH, Singularity, Modal, Daytona, Vercel Sandbox) including serverless options that hibernate when idle.

5. **Scheduled Automation** — Built-in cron scheduler with natural language task definitions, delivering results to any connected platform.

### Real/Maintained Status

- **Stars:** 238,932 (extremely popular)
- **Forks:** 48,700
- **Last Activity:** 2026-08-31 (actively maintained)
- **Language/Runtime:** Python 3.11-3.13, Node.js (for TUI/desktop)
- **Repository Status:** Public and actively developed

**Confidence:** HIGH (verified from GitHub API)

---

## 2. Install + Configure Locally

**Confidence:** HIGH (documented in official installation scripts and README)

### Install Path

**Linux/macOS/WSL2/Android (Termux):**
```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.bashrc
hermes
```

**Windows (PowerShell, native):**
```powershell
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
```

**Desktop App:**
- Windows/macOS: Download installer from hermes-agent.nousresearch.com

### Runtime Prerequisites

The installer automatically bundles:
- **uv** (Python package manager)
- **Python 3.11** (required; versions 3.11-3.13 supported, 3.14+ explicitly blocked)
- **Node.js** (for TUI and desktop app)
- **ripgrep** (for code search)
- **ffmpeg** (for voice/media processing)
- **Portable Git Bash** (Windows only, MinGit ~45MB, no admin required)

**Quote from pyproject.toml:**
> "Requires Python >=3.11,<3.14. The upper cap is load-bearing, not cosmetic — prevents uv from selecting 3.14 where some Rust-backed transitives lack wheels."

### Installation Locations

- **Linux/macOS/WSL2:** `~/.hermes/`
- **Windows:** `%LOCALAPPDATA%\hermes\`
- **Source code:** `${HERMES_HOME:-$HOME/.hermes}/hermes-agent/`

### Configuration File Locations/Format

**Primary config:** `~/.hermes/config.yaml` (YAML format)

**Environment variables:** `.env` file (takes precedence over config.yaml for secrets)

**Example files in repo:**
- `cli-config.yaml.example` — main configuration template
- `.env.example` — environment variables template

**Key configuration sections:**
- `model:` — provider, default model, base URL, context length, max tokens
- `toolsets:` — enabled tool categories per platform
- `mcp_servers:` — MCP server connections (stdio or HTTP)
- `skills:` — skill creation intervals, external directories
- `terminal:` — backend (local/docker/ssh/etc), timeout, lifetime
- `memory:` — compression settings, database journal mode
- `agent:` — max turns (default 500), reasoning effort

**Configuration commands:**
```bash
hermes config set <section.key> <value>
hermes config get <section.key>
hermes setup          # Full setup wizard
hermes setup --portal # OAuth setup for Nous Portal
```

**Quote from cli-config.yaml.example:**
> "Copy examples in, or use `hermes config set <section.key> <value>`. Documented secret env vars in `.env` take precedence over their corresponding settings."

### Hosted/Remote/Cloud Options

**YES** — Multiple remote execution options:

1. **SSH Backend** — Run agent on remote VPS/server
   ```yaml
   terminal:
     backend: ssh
     ssh:
       host: your-server.com
       user: username
       key: /path/to/key
   ```

2. **Serverless Options:**
   - **Modal** — GPU cluster or serverless execution
   - **Daytona** — Serverless persistence (hibernates when idle)
   - **Vercel Sandbox** — Serverless execution

3. **Messaging Gateway** — Agent runs on server, accessed via Telegram/Discord/Slack/etc.

**Quote from README:**
> "Run it on a $5 VPS, a GPU cluster, or serverless infrastructure that costs nearly nothing when idle. It's not tied to your laptop — talk to it from Telegram while it works on a cloud VM."

**Confidence:** HIGH (documented in installation and configuration docs)

---

## 3. Invoke + Stream

**Confidence:** HIGH (documented in AGENTS.md and source code)

### How to Invoke

**Three primary methods:**

#### A. CLI (Interactive)
```bash
hermes              # Start interactive TUI
hermes gateway      # Start messaging gateway for multi-platform access
```

#### B. Programmatic (Python SDK)
**Quote from AGENTS.md:**
> "Two invocation methods:
> - `chat(message: str) -> str` — Simple interface, returns final response string.
> - `run_conversation(user_message, system_message=None, conversation_history=None, task_id=None) -> dict` — Full interface returning dict with `final_response` plus `messages`."

**Example instantiation:**
```python
from run_agent import AIAgent

agent = AIAgent(
    provider="anthropic",
    model="claude-opus-4.6",
    api_key="your-key",
    max_iterations=500,
    enabled_toolsets=["web", "terminal", "file"],
    platform="cli",
    session_id="unique-session-id"
)

# Simple interface
response = agent.chat("Your query here")

# Full interface
result = agent.run_conversation(
    user_message="Your query",
    conversation_history=[...]
)
```

#### C. MCP Server (for Claude Code, Cursor, etc.)
```bash
hermes mcp serve
```

**Client configuration (claude_desktop_config.json):**
```json
{
  "mcpServers": {
    "hermes": {
      "command": "hermes",
      "args": ["mcp", "serve"]
    }
  }
}
```

### Streaming Output

**Multiple streaming mechanisms:**

#### 1. TUI Transport (Primary)
**Quote from AGENTS.md:**
> "Newline-delimited JSON-RPC over stdio. Chat streaming flows `prompt.submit` → `message.delta`/`message.complete`; tool activity via `tool.start`/`progress`/`complete`."

#### 2. Desktop App (Electron)
React/Electron surface talking to `tui_gateway` backend via JSON-RPC using `JsonRpcGatewayClient` from `@hermes/shared`.

#### 3. Dashboard Chat
Embeds real `hermes --tui` over WebSocket PTY bridge at `/api/pty` using `ptyprocess`, streaming raw PTY bytes bidirectionally.

#### 4. Messaging Platforms
Native streaming for Slack with "draft_stream_is_the_message" mode (prefix-stable append-only deltas).

**Quote from AGENTS.md:**
> "Stream-is-the-message adapters (`draft_stream_is_message = True`, e.g. Slack native streaming): draft frames must be prefix-stable (append-only deltas); the consumer declares the final via `finish(final_text)`."

### Concrete Commands/Endpoints

**CLI commands:**
```bash
hermes              # Interactive CLI with streaming
hermes model        # Choose LLM provider/model  
hermes tools        # Configure enabled tools
hermes gateway      # Start messaging gateway
hermes doctor       # Diagnostic check
hermes update       # Update to latest version
```

**Entry points (from pyproject.toml):**
- `hermes` → `hermes_cli.main:main`
- `hermes-agent` → `run_agent:main`
- `hermes-acp` → `acp_adapter.entry:main`

**Confidence:** HIGH (documented in architecture docs and verified in source)

---

## 4. Model Backend

**Confidence:** HIGH (extensively documented in .env.example and configuration)

### External LLM Requirement

**YES** — Requires external LLM. No bundled model.

**Quote from README:**
> "Use any model you want — Nous Portal, OpenRouter, OpenAI, your own endpoint, and many others. Switch with `hermes model` — no code changes, no lock-in."

### Supported Providers (30+)

**Major providers documented in .env.example:**

#### Cloud Providers:
- **Anthropic** (default model: `anthropic/claude-opus-4.6`)
- **OpenAI** (all GPT models)
- **Google/Gemini** (GOOGLE_API_KEY / GEMINI_API_KEY + GEMINI_BASE_URL)
- **OpenRouter** (300+ models aggregator)
- **Azure OpenAI** (Azure Foundry)
- **AWS Bedrock** (via AWS credentials)
- **Google Vertex AI** (via Google Cloud credentials)

#### Specialized Providers:
- **Nous Portal** (300+ models + Tool Gateway for web search, image gen, TTS, browser)
- **Fireworks AI**
- **DeepInfra**
- **Ollama** (local models)
- **Ollama Cloud**

#### Regional/Specialized:
- **Qwen** (OAuth-based)
- **Kimi/Moonshot** (KIMI_API_KEY)
- **MiniMax** (Chinese models)
- **Xiaomi MiMo**
- **GLM** (z.ai)
- **Arcee AI**
- **NovitaAI**
- **Upstage Solar**
- **Nebius**
- **Hugging Face** (HF_TOKEN + HF_BASE_URL)
- **Mistral**
- **LMStudio** (local)
- **Custom endpoints**

**Quote from .env.example:**
> "`LLM_MODEL` is deprecated — model default now lives in config.yaml."

### Model Configuration

**Via config.yaml:**
```yaml
model:
  default: anthropic/claude-opus-4.6
  provider: auto  # Auto-detects from credentials
  base_url: https://openrouter.ai/api/v1
  context_length: 200000  # Total window (input+output)
  max_tokens: 4096        # Output cap only
  default_headers:
    X-Custom-Header: value
  timeout: 300
```

**Via CLI:**
```bash
hermes model              # Interactive model selection
hermes setup --portal     # OAuth for Nous Portal (one subscription covers model + 4 Tool Gateway tools)
hermes portal info        # Check Portal subscription status
```

### Credentials Configuration

**Two methods:**

1. **Environment variables** (`.env` file, takes precedence):
```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
GOOGLE_API_KEY=...
# etc for 30+ providers
```

2. **Config.yaml** (less secure for secrets):
```yaml
model:
  api_key: your-key-here
  # OR use key_cmd for short-lived tokens:
  key_cmd: "aws secretsmanager get-secret-value --secret-id my-key"
```

**Credential precedence:**
> "Documented secret env vars in `.env` take precedence over their corresponding settings."

### Default Model

**Hermes/Nous models** are mentioned as defaults but requires external provider:

**Quote from README:**
> "Supports any model (Nous Portal, OpenRouter, OpenAI, custom endpoints). Switch with `hermes model` — no code changes."

**Note:** Despite the name "Hermes," this refers to the agent framework, not a bundled model. The agent works with any LLM provider.

**Confidence:** HIGH (extensively documented and verified)

---

## 5. Capabilities

**Confidence:** HIGH (documented in README, configuration, and source code)

### MCP Server Support

**YES** — Full MCP (Model Context Protocol) server support.

**Quote from README:**
> "Connect any MCP server for extended tool capabilities."

**Quote from GitHub page:**
> "MCP Integration — Connect any MCP server for extended capabilities."

### MCP Configuration

**In config.yaml (mcp_servers section):**

```yaml
mcp_servers:
  # Stdio-based MCP server
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"]
    env:
      CUSTOM_VAR: value
    timeout: 120
    connect_timeout: 60
    keepalive_interval: 180

  # HTTP-based MCP server
  custom-api:
    url: https://your-mcp-server.com/api
    headers:
      Authorization: Bearer token
    timeout: 120
```

**Connection types:**
- **stdio** — command, args, env (for local MCP servers)
- **HTTP** — url, headers (for remote MCP servers)

**Options:**
- `timeout` (default 120s)
- `connect_timeout` (default 60s)  
- `keepalive_interval` (default 180s, minimum 5s)
- Server-initiated sampling enabled by default with per-server model/rate/token controls

**Quote from cli-config.yaml.example:**
> "MCP tool results spill to disk at a tighter 50,000-char threshold."

### 60+ Optional MCP Servers Available

**Found in `/optional-mcps` directory (68 pre-configured MCP servers):**

Integration categories:
- **Development:** GitHub (Gitlab), Sentry, BuildKite, CircleCI, Railway, Vercel, Netlify, Supabase, Neon
- **Project Management:** Linear, Asana, Monday, ClickUp, Notion, Todoist
- **Communication:** Slack, Intercom, Calendly
- **Data/Analytics:** Datadog, Mixpanel, Amplitude, Grafana
- **Design:** Figma, Canva, Miro
- **Cloud:** AWS Knowledge, Cloudflare, MotherDuck (DuckDB)
- **Finance:** Stripe, PayPal, Square, Robinhood
- **CRM:** Attio, Close, HubSpot
- **AI/ML:** Hugging Face, Comfy Cloud
- **Documentation:** Notion, Dropbox, Postman, Microsoft Learn, Unreal Engine
- **Other:** Algolia, Klaviyo, N8N, Prisma, Semgrep, Twilio, Webflow, WordPress, Wolfram, and more

**Community example cited:**
> "[computer-use-linux](https://github.com/avifenesh/computer-use-linux) — Linux desktop-control MCP server for Hermes and other MCP hosts, with AT-SPI accessibility trees, Wayland/X11 input, screenshots, and compositor window targeting."

### Built-in Tools/Plugins System

**40+ built-in tools** organized into toolsets:

**Core toolsets:**
- `web` — search, extract (Exa, Firecrawl, Parallel, SearXNG, Brave, DuckDuckGo, xAI)
- `terminal` — 7 backends (local, docker, ssh, singularity, modal, daytona, vercel)
- `file` — read, write, edit, search files
- `browser` — automated browser control (Browserbase, Camofox, Lightpanda, Chrome)
- `vision` — image understanding
- `image_gen` — image generation (via FAL or Nous Tool Gateway)
- `skills` — skill creation and management
- `memory` — persistent memory across sessions
- `tts` — text-to-speech (OpenAI, ElevenLabs, Groq, Edge TTS, local)
- `cronjob` — scheduled task management
- `todo` — task list management
- `delegation` — spawn subagents for parallel work

**Composites:**
- `debugging` — specialized debugging tools
- `safe` — read-only tools
- `all` — everything

**Tool configuration:**
```bash
hermes tools          # Configure enabled tools
```

**Quote from README:**
> "60+ built-in tools with a toolset system."

### Skills System

**Skills = "Procedural memory the agent creates and reuses"**

**Quote from README:**
> "A closed learning loop — Agent-curated memory with periodic nudges. Autonomous skill creation after complex tasks. Skills self-improve during use. FTS5 session search with LLM summarization for cross-session recall."

**Storage location:** `~/.hermes/skills/`

**Configuration:**
```yaml
skills:
  creation_nudge_interval: 15  # Nudge every 15 tool iterations (0 disables)
  external_dirs:
    - /shared/skills  # Read-only shared skills
```

**Quote from cli-config.yaml.example:**
> "Skill creation always writes to ~/.hermes/skills/, and local skills win on name collisions."

**Standard compatibility:**
> "Compatible with the agentskills.io open standard — portable, shareable, and community-contributed."

**Browse skills:**
```bash
/skills              # List available skills
/<skill-name>        # Invoke specific skill
```

**Skills Hub:** 88,000+ skills available at https://agentskills.io

### Plugin System

**Extensibility via plugins:**

**Quote from AGENTS.md:**
> "General plugins expose `register(ctx)` and can add lifecycle hooks (`pre_tool_call`, `post_tool_call`, `pre_llm_call`, `post_llm_call`, `on_session_start`, `on_session_end`), tools, and CLI subcommands."

**Plugin types:**
1. **General plugins** — Add tools, hooks, and CLI commands
2. **Memory providers** — Implement `MemoryProvider` ABC
3. **Model providers** — Register via `providers.register_provider(ProviderProfile(...))`

**Discovery:** `tools/registry.py` auto-discovers any `tools/*.py` with `registry.register()` call.

### How Capabilities Are Added/Enabled/Discovered

**1. Built-in tools:** Via `toolsets` configuration in config.yaml
```yaml
platform_toolsets:
  hermes-cli: [web, terminal, file, browser, skills, memory]
```

**2. MCP servers:** Via `mcp_servers` section in config.yaml (see above)

**3. Skills:** 
   - Auto-created during use (nudge interval configurable)
   - Manual creation via agent commands
   - Import from Skills Hub (agentskills.io)
   - External directories for shared skills

**4. Plugins:** 
   - Auto-discovered from `tools/` directory
   - Custom plugins via `ctx.register_tool(...)`

**Discovery mechanism:**
> "Tools registry handles schema collection, dispatch, availability checking, and error wrapping. All handlers must return a JSON string."

**Confidence:** HIGH (extensively documented and verified in source)

---

## 6. Self-Install + Web-Search (CRITICAL)

**Confidence:** MEDIUM-HIGH for web search (documented); LOW-MEDIUM for autonomous MCP/capability installation (not explicitly documented)

### Web Search Capability

**YES** — Agent can autonomously search the web during tasks.

**Quote from README:**
> "Full web control: Search, extract, browse, vision, image generation, TTS."

**Web search tools (from web_tools.py):**

1. **`web_search` tool** — "Searches the web, returning up to 5 results by default with titles, URLs, and descriptions."

2. **`web_extract` tool** — "Pulls content from specific page URLs, returning clean page content in markdown/text (no LLM summarization — fast). Also works with PDF links."

**Supported backends:**
- Exa (exa.ai) — search + extract
- Firecrawl — search + extract, direct or via Nous Tool Gateway
- Parallel (parallel.ai) — search + extract
- SearXNG — search only
- Brave Search — search only (free tier)
- DuckDuckGo (ddgs package) — search only
- xAI — via credentials
- **Keyless free tier** — Exa/Parallel anonymous endpoints as fallback

**Quote from web_tools.py analysis:**
> "Yes, the agent can search the web autonomously during tasks. Two registered tools handle this: `web_search` and `web_extract`."

**Configuration:**
```yaml
web:
  backend: firecrawl  # or exa, parallel, searxng, brave, ddg, xai
```

### Autonomous Capability Installation

**UNCLEAR** — The agent can create skills autonomously, but **autonomous MCP server installation is not explicitly documented.**

#### What IS Documented:

**1. Autonomous Skill Creation:**
**Quote from README:**
> "Autonomous skill creation after complex tasks. Skills self-improve during use."

**Mechanism:**
```yaml
skills:
  creation_nudge_interval: 15  # Agent is nudged to save a skill every 15 tool iterations
```

**Quote from AGENTS.md:**
> "Per-conversation prompt caching is sacred — a long conversation reuses a cached prefix each turn; mutating past context or rebuilding the system prompt invalidates it."

This suggests skills are created reactively after tasks, not proactively installed before tasks.

**2. Skills Hub Integration:**
The agent integrates with agentskills.io (88,000+ skills), but installation appears to be manual or user-initiated, not autonomous.

**3. MCP Server Configuration:**
MCP servers are configured in config.yaml. No evidence of autonomous installation was found in the documentation or source code search.

#### What IS NOT Documented:

- ❌ Agent autonomously installing MCP servers during a task
- ❌ Agent detecting missing capabilities and auto-installing MCP servers
- ❌ Agent searching for and enabling new MCP servers on instruction
- ❌ Signals emitted when agent is missing a capability

#### Possible Workarounds:

The agent COULD theoretically:
1. Use the `terminal` tool to run `npm install` or other installation commands
2. Use the `file` tool to edit `config.yaml` and add MCP servers
3. Use web search to find MCP server installation instructions

However, this would require:
- The agent to recognize it needs a capability
- The agent to know how to find and install MCP servers
- The agent to modify its own configuration
- A restart to load the new MCP server

**No documented evidence this workflow exists.**

### Missing Capability Signals

**NOT DOCUMENTED** — No explicit signals when agent is missing a capability.

Possible implicit signals:
- Tool execution errors (e.g., "tool not found")
- Agent reasoning about limitations in chat
- Skill creation nudges after repeated tool use

But no dedicated "missing capability" detection system is documented.

### Summary: Self-Install Capability

| Capability | Status | Evidence |
|------------|--------|----------|
| **Autonomous web search during tasks** | ✅ YES | Documented tools: `web_search`, `web_extract` with multiple backends |
| **Autonomous skill creation** | ✅ YES | Documented with nudge intervals, auto-improvement |
| **Autonomous MCP server installation** | ❌ NO / UNCLEAR | Not documented; manual config.yaml editing required |
| **Detect missing capabilities** | ❌ NO / UNCLEAR | No explicit signals documented |
| **Install tools/capabilities on instruction** | ⚠️ MAYBE | Possible via terminal/file tools, but not documented workflow |

**Quote (most relevant):**
> "The core is a narrow waist; capability lives at the edges. Every model tool ships on every API call, so new core tools face a high bar."

This architecture suggests tools are pre-configured, not dynamically installed.

**Confidence:** 
- Web search: HIGH (clearly documented and implemented)
- Autonomous MCP installation: LOW (no evidence found)
- Self-install capabilities: MEDIUM (possible but not documented)

---

## 7. License

**MIT License**

**Source:** https://github.com/NousResearch/hermes-agent/blob/main/LICENSE

**Quote from GitHub:**
> "License: MIT"

**Confidence:** HIGH (verified from repository)

---

## Summary of Findings

### Strengths for Desktop App Adapter

1. ✅ **Well-documented architecture** — Clear entry points (`AIAgent` class, CLI commands, MCP server)
2. ✅ **Multiple invocation methods** — CLI, Python SDK, MCP server, messaging gateway
3. ✅ **Flexible model backends** — 30+ providers, easy switching, no lock-in
4. ✅ **Strong capability system** — 60+ tools, MCP support, skills system
5. ✅ **Persistent memory** — Sessions, skills, and user modeling
6. ✅ **Remote execution** — SSH, Docker, serverless options
7. ✅ **Active development** — 238k stars, updated today

### Gaps/Risks for Desktop App Adapter

1. ⚠️ **No autonomous MCP server installation** — MCP servers require manual config.yaml editing
2. ⚠️ **No missing capability detection** — No signals when agent needs new tools
3. ⚠️ **Python 3.11-3.13 requirement** — Version-locked (3.14+ explicitly blocked)
4. ⚠️ **Exact dependency pinning** — All 100+ dependencies pinned to exact versions for supply-chain security
5. ⚠️ **Complex configuration** — Many options spread across config.yaml and .env
6. ⚠️ **Prompt caching sacred** — Architecture constraint limits dynamic system prompt changes
7. ⚠️ **No hosted API** — Must run locally or self-host (though serverless options exist)

### Biggest Risk/Unknown for Building an Adapter

**The single biggest risk is the lack of autonomous capability provisioning.**

Hermes can:
- ✅ Search the web
- ✅ Create skills autonomously
- ✅ Self-improve skills
- ✅ Connect to pre-configured MCP servers

But Hermes CANNOT (as documented):
- ❌ Detect when it's missing a capability it needs
- ❌ Autonomously search for and install MCP servers during a task
- ❌ Auto-provision new tools/capabilities on demand
- ❌ Emit signals when missing capabilities

**This means:**
Your desktop app would need to handle capability provisioning externally:
1. Detect what capabilities the user's task requires
2. Check if Hermes has those capabilities configured
3. Install/configure missing MCP servers
4. Update Hermes' config.yaml
5. Restart or reload Hermes

Alternatively, ship a comprehensive pre-configured set of MCP servers with the desktop app.

**The vision of "auto-provisioning capabilities" would be an adapter-layer responsibility, not a Hermes-native feature.**

---

## Evidence Quality Notes

- **High confidence:** README, GitHub stats, installation scripts, .env.example, cli-config.yaml.example, AGENTS.md, pyproject.toml, source code files
- **Medium confidence:** Inferred from architecture and tool implementations
- **Low confidence:** Capabilities not explicitly documented (autonomous MCP installation)
- **Doc site limitations:** Some doc pages (configuration, MCP, skills) returned 404s; relied on repo files instead

**All quotes are verbatim from official sources (README, AGENTS.md, config examples, source code).**
