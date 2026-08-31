# ZeptoClaw Agent Framework Research

**Repository:** https://github.com/qhkm/zeptoclaw  
**Homepage:** https://zeptoclaw.com/  
**Research Date:** 2026-08-31  
**Status:** Active (last push: 2026-07-30)

---

## 1. What It Is

**One-line description:** Fast, small, secure, local-first personal AI assistant infrastructure delivered as a single Rust binary with tools, memory, channels, providers, and sandboxed autonomy.

**Evidence:** From GitHub description: "Fast, small, secure, local-first personal AI assistant infrastructure: one Rust binary for tools, memory, channels, providers, and sandboxed autonomy."

### Top 5 User-Facing Features

1. **Multi-Provider LLM Support** — 18 providers (Anthropic, OpenAI, OpenRouter, Gemini, Ollama, etc.) with SSE streaming, retry/backoff, budget caps, and auto-failover
2. **33 Built-in Tools + Extensibility** — Shell, filesystem, web search, git, PDF reading, transcription, plus plugin system and MCP server support
3. **Multi-Channel Gateway** — Unified message bus for Telegram, Slack, Discord, WhatsApp, email, webhook, and more
4. **6-Layer Security Model** — Container sandboxes (Docker, Landlock, Firejail, etc.), prompt injection detection, secret leak scanner, policy engine, SSRF prevention
5. **Agent Swarms & Delegation** — Parallel sub-agent delegation with cost-aware routing and aggregation

**Evidence:** From README feature table and core features section.

### Real/Maintained Status

- **Stars:** 649
- **Forks:** 98
- **Last Activity:** 2026-07-30 (recent)
- **Language:** Rust
- **Tests:** 3,900+ tests
- **Binary Size:** ~6MB
- **License:** Apache 2.0

**Confidence:** HIGH — Active repository with recent commits, strong test coverage, production-ready metrics.

---

## 2. Install + Configure Locally

### Installation Methods

**One-liner (macOS/Linux):**
```bash
curl -fsSL https://raw.githubusercontent.com/qhkm/zeptoclaw/main/install.sh | sh
```

**Homebrew:**
```bash
brew install qhkm/tap/zeptoclaw
```

**Docker:**
```bash
docker pull ghcr.io/qhkm/zeptoclaw:latest
```

**From Source:**
```bash
cargo install zeptoclaw --git https://github.com/qhkm/zeptoclaw
```

**Evidence:** From README installation section.

### Runtime Prerequisites

- **Rust runtime:** Not required for binary install (statically compiled)
- **Optional features:** Control panel requires `--features panel` at build time
- **System dependencies:** None for basic operation; optional features may require Docker, screenshot tools, Android ADB

### Configuration

**Config file location:** `~/.zeptoclaw/config.json`

**Format:** JSON with sections for providers, agents, channels, tools

**Example:**
```json
{
  "providers": {
    "openrouter": { "api_key": "sk-or-..." },
    "ollama": { "api_key": "ollama" }
  },
  "agents": { 
    "defaults": { "model": "anthropic/claude-sonnet-4" } 
  }
}
```

**Environment variables:** Follow pattern `ZEPTOCLAW_<SECTION>_<KEY>`
- Example: `export ZEPTOCLAW_PROVIDERS_GROQ_API_KEY=gsk_...`

**Interactive setup:**
```bash
zeptoclaw onboard  # Walks through API keys, channels, workspace
```

**Evidence:** From README configuration section and docs.

### Hosted/Remote/Cloud Options

**Yes** — Multiple deployment options:
- DigitalOcean App Platform
- Railway
- Render
- Fly.io
- Any VPS: `curl -fsSL https://zeptoclaw.com/setup.sh | bash`

**Evidence:** README Deploy section with platform badges.

**Confidence:** HIGH — Comprehensive installation and deployment documentation.

---

## 3. Invoke + Stream

### Invocation Methods

**CLI (one-shot):**
```bash
zeptoclaw agent -m "Analyze our API for security issues"
```

**CLI (streaming):**
```bash
zeptoclaw agent --stream -m "Explain async Rust"
```

**With templates:**
```bash
zeptoclaw agent --template coder -m "Add error handling to main.rs"
```

**Batch processing:**
```bash
zeptoclaw batch --input prompts.txt --output results.jsonl
```

**Multi-channel gateway (daemon):**
```bash
zeptoclaw gateway                   # Standard
zeptoclaw gateway --containerized   # With container isolation per request
```

**Evidence:** From README Quick Start section.

### Streaming Support

**Yes** — Token-by-token streaming via `--stream` flag. Uses SSE (Server-Sent Events) streaming from providers.

**Quote:** "Stream responses token-by-token" and "18 providers with SSE streaming"

### SDK/API

**Rust library embedding:**
```rust
ZeptoAgent::builder()
    .provider(p)
    .tool(t)
    .build()
```

**Evidence:** From README: "Library Facade — Embed as a crate — `ZeptoAgent::builder().provider(p).tool(t).build()` for Tauri/GUI apps"

**OpenAI-compatible API:** Available via panel feature with `/v1/chat/completions` endpoint.

**Evidence:** From CLAUDE.md: "api/ # Panel API server + OpenAI-compatible serve routes (axum)"

**Confidence:** HIGH — Multiple invocation methods clearly documented.

---

## 4. Model Backend

### Requires External LLM?

**Yes** — ZeptoClaw is an agent framework that connects to external LLM providers; it does not include a built-in model.

### Supported Providers (18 total)

| Provider | Config Key | Auth |
|----------|------------|------|
| **Anthropic** | `anthropic` | API key |
| **OpenAI** | `openai` | API key |
| **OpenRouter** | `openrouter` | API key |
| **Google Gemini** | `gemini` | API key |
| **Google Vertex AI** | `vertex` | ADC or access token |
| **Groq** | `groq` | API key |
| **DeepSeek** | `deepseek` | API key |
| **xAI (Grok)** | `xai` | API key |
| **NVIDIA NIM** | `nvidia` | API key |
| **Azure OpenAI** | `azure` | API key + api_base |
| **AWS Bedrock** | `bedrock` | API key |
| **Kimi (Moonshot)** | `kimi` | API key |
| **Zhipu (GLM)** | `zhipu` | API key |
| **Qianfan (Baidu)** | `qianfan` | API key |
| **Novita AI** | `novita` | API key |
| **Liquid AI** | `liquid` | API key |
| **Ollama** | `ollama` | local/keyless |
| **VLLM** | `vllm` | local/keyless |

**Evidence:** From README Providers section.

**Quote:** "All OpenAI-compatible endpoints work out of the box."

### Model Configuration

Configured via `config.json` providers section or environment variables. Base URLs can be overridden with `api_base` for proxies or self-hosted endpoints.

**Example default model:**
```json
{
  "agents": { "defaults": { "model": "anthropic/claude-sonnet-4" } }
}
```

**Confidence:** HIGH — Comprehensive provider support with clear configuration.

---

## 5. Capabilities (MCP / Plugins / Skills / Tools)

### Built-in Tools (33)

**File/Code:** shell, read_file, write_file, list_files, edit_file, grep, find  
**Web:** web_search, web_fetch, http_request, screenshot  
**Memory:** memory, longterm_memory  
**Messaging:** message, whatsapp  
**Automation:** cron, spawn, delegate, reminder  
**Integrations:** gsheets, r8r, git, project, stripe  
**Media:** pdf_read, transcribe  
**Skills:** find_skills, install_skill  
**Device/Hardware:** android, hardware

**Evidence:** From tools reference documentation.

### MCP Server Support

**Yes** — Full MCP (Model Context Protocol) server support with auto-discovery.

**How it works:**
- Auto-discovers MCP servers from standard config locations
- **Global config:** `~/.mcp/servers.json`
- **Project config:** `{workspace}/.mcp.json`
- Supports both HTTP and stdio transports
- Compatible with Claude Desktop format

**Configuration formats supported:**
```json
{
  "mcpServers": {
    "github": { "url": "http://localhost:3000" },
    "local-tool": { 
      "command": "node", 
      "args": ["server.js"],
      "env": { "API_KEY": "..." }
    }
  }
}
```

**Evidence:** From source code `src/tools/mcp/discovery.rs`:
```rust
//! MCP server auto-discovery from standard config files.
//!
//! Scans two locations (in order):
//! 1. `~/.mcp/servers.json` — global user-level config
//! 2. `{workspace}/.mcp.json` — project-level config (optional)
```

**How MCP servers are added:**
1. Create or edit `~/.mcp/servers.json` or `.mcp.json` in workspace
2. Add server configuration with HTTP URL or stdio command
3. Servers are automatically discovered at agent startup
4. MCP tools become available in agent tool registry

**Evidence:** MCP discovery code shows automatic loading at startup via `discover_mcp_servers()` function.

### Plugin System

**Yes** — JSON manifest plugins for custom tools without modifying source.

**Plugin location:** `~/.zeptoclaw/plugins/`

**Plugin format (JSON manifest):**
```json
{
  "name": "tool_name",
  "description": "Tool description shown to LLM",
  "version": "1.0.0",
  "parameters": { /* JSON Schema */ },
  "command": "executable {{param}} {{param2}}"
}
```

**How plugins work:**
1. **Discovery:** At startup, scans plugin directories for JSON files
2. **Validation:** Checks required fields and JSON schema validity
3. **Registration:** Valid plugins wrapped in `PluginTool` adapter and registered
4. **Execution:** Parameters interpolated into command template with shell escaping

**Security:** All values are shell-escaped, commands run through shell blocklist, container isolation applies when enabled.

**Evidence:** From plugin documentation and architecture.

### Skills System

**Yes** — Higher-level capability packages via ClawHub marketplace.

**Skill management tools:**
- `find_skills` — Search ClawHub skills marketplace by query
- `install_skill` — Download and install skills by slug

**Skill location:** `~/.zeptoclaw/skills/`

**How skills are added:**
1. Use `find_skills` tool to search marketplace: `find_skills(query="web scraping")`
2. Use `install_skill` tool to install: `install_skill(slug="web-scraper", sha256="...")`
3. Skills include metadata, YAML frontmatter, and implementation
4. Community skills at github.com/qhkm/zeptoclaw-skills

**Evidence:** From source code `src/tools/skills_search.rs` and `skills_install.rs`.

**Discovery mechanism:**
- Skills auto-discovered from `~/.zeptoclaw/skills/` directory
- Core skills in repo `skills/` folder (github, skill-creator, deep-research)

**Confidence:** HIGH — Three distinct capability systems (MCP, plugins, skills) all documented and implemented.

---

## 6. Self-Install + Web-Search (CRITICAL)

### Can Agent Install/Enable Capabilities During Task Execution?

**PARTIAL** — Agent can search for and install skills at runtime, but requires restart.

**Evidence:**

**Skills (runtime install, requires restart):**
- `find_skills` tool: Searches ClawHub marketplace during execution
- `install_skill` tool: Downloads and installs skills during execution

**Quote from source code (`skills_install.rs`):**
```rust
fn description(&self) -> &str {
    "Install a skill from ClawHub by slug. Use find_skills first to discover available slugs. \
     The skill will be available after restarting the agent."
}
```

**Workflow:**
1. Agent detects missing capability
2. Agent calls `web_search` to research the capability
3. Agent calls `find_skills` to search marketplace
4. Agent calls `install_skill` to download/install skill
5. **Restart required** for skill to become available

**MCP Servers (manual config, requires restart):**
- MCP servers discovered only at startup from config files
- No runtime MCP server installation tool
- User must manually edit `~/.mcp/servers.json` and restart

**Plugins (manual config, requires restart):**
- Plugins discovered only at startup from `~/.zeptoclaw/plugins/`
- No runtime plugin installation mechanism
- Discovery quote: "At startup, ZeptoClaw scans configured plugin directories"

### Web Search Capability

**Yes** — Built-in web search tool.

**Tool:** `web_search` — "Search the web using the Brave Search API"

**Evidence:** From tools reference listing web_search as built-in tool.

### Signal When Missing Capability

**Not explicitly documented** — No evidence of specific error signals or prompts when a capability is missing. The agent would need to:
1. Recognize the task requires a capability it lacks
2. Use `web_search` to research the capability
3. Use `find_skills` to search for relevant skills
4. Use `install_skill` to provision it
5. Inform user that restart is needed

**Confidence:** MEDIUM — Runtime skill installation is possible but incomplete due to restart requirement. No dynamic MCP/plugin installation. Web search is available.

**Quote for mechanism:** From skill installation source code showing the workflow is designed but gated by restart requirement.

---

## 7. License

**Apache License 2.0**

**Evidence:** From repository metadata and README license badge.

**Disclaimer from README:**
> "ZeptoClaw is a pure open-source software project with no token, no cryptocurrency, no blockchain component."

**Confidence:** HIGH — Standard open-source license clearly stated.

---

## Summary Assessment

### Strengths for Desktop App Adapter

1. **Single binary deployment** — No runtime dependencies, ~6MB size
2. **Multi-provider support** — Handles all major LLM providers
3. **MCP native support** — Auto-discovers MCP servers from standard locations
4. **Multiple capability systems** — MCP, plugins, skills provide flexibility
5. **Security-first design** — 6-layer security model built-in
6. **Well-documented** — Comprehensive docs and 3,900+ tests
7. **Active development** — Recent commits, growing community

### Weaknesses/Risks for Desktop App Adapter

1. **Restart requirement** — Skills, plugins, MCP all require restart after installation
2. **No dynamic MCP provisioning** — Cannot install MCP servers at runtime
3. **Plugin discovery timing** — All capability discovery happens at startup only
4. **Marketplace dependency** — Skills rely on ClawHub marketplace availability
5. **Config file management** — Manual editing required for MCP/plugin configuration
6. **No hot-reload for capabilities** — Config hot-reload exists but doesn't cover tool/skill loading

### Biggest Risk/Unknown

**CRITICAL ISSUE: Restart Requirement for All Capability Types**

ZeptoClaw supports three capability extension mechanisms (MCP servers, plugins, skills), but ALL require an agent restart to become available after installation or configuration. The skill installation system demonstrates that runtime discovery is partially implemented (`find_skills` and `install_skill` tools work during execution), but the registration phase only occurs at startup.

**Impact for Desktop App Adapter:**
- Cannot provide true agent self-provisioning experience
- User must restart agent after auto-installing capabilities
- Degrades UX compared to frameworks with dynamic capability loading
- May require desktop app to implement capability caching or pre-provisioning strategy

**Mitigation options:**
1. Pre-install common MCP servers/plugins with app
2. Build wrapper that handles restart/resume workflow transparently
3. Contribute dynamic tool registration feature to upstream project
4. Use batch mode to install multiple capabilities before restart

**Evidence confidence:** HIGH — Explicitly stated in source code and documentation.

---

## Research Confidence Levels

- **Installation & Configuration:** HIGH (comprehensive docs, multiple verified sources)
- **Model Backend Support:** HIGH (detailed provider list, clear configuration)
- **MCP Support:** HIGH (source code reviewed, implementation verified)
- **Plugin System:** HIGH (documented and source-verified)
- **Skills System:** HIGH (source code and marketplace confirmed)
- **Self-Installation:** MEDIUM-HIGH (capability exists but limited by restart requirement)
- **Web Search:** HIGH (tool confirmed in documentation)
- **Overall Framework Viability:** HIGH (active, tested, production-ready)

---

## Additional Notes

### Architecture Quality
- Clean Rust architecture with separate modules for agent, tools, channels, providers
- 3,900+ tests indicate production readiness
- CI/CD pipeline with feature matrix testing
- Binary size budget enforcement (11MB ceiling)

### Security Posture
- Designed with CVE awareness (references CVE-2026-25253 and ClawHavoc incident)
- Multiple sandbox runtime options
- Defense-in-depth approach with 8 security layers
- Prompt injection detection and secret leak scanning built-in

### Community & Ecosystem
- Growing skill marketplace (ClawHub)
- Compatible with Claude Desktop MCP format
- Migration tool from OpenClaw (competing framework)
- Deploy templates for major cloud platforms

### Performance Metrics
- ~6MB binary (compressed)
- ~50ms startup time
- ~6MB RAM per agent
- 18 LLM providers supported
- 649 GitHub stars (moderate adoption)

---

**Report compiled from:**
- GitHub repository: https://github.com/qhkm/zeptoclaw
- Official documentation: https://zeptoclaw.com/docs/
- Source code analysis (MCP, skills, plugin implementations)
- README and architecture documentation (CLAUDE.md)
- Last verified: 2026-08-31
