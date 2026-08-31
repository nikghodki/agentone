# Hermes Agent Framework - Verified Install

**Verification Date:** 2026-08-31  
**Task:** Phase 0, Task 1 - Runtime & Install Feasibility Spike

---

## Install Status: SUCCESS (with PATH caveat)

**Runtime:** Python 3.11.16 (bundled), Node.js 26.8.1 (bundled)  
**Version:** Hermes Agent v0.21.0 (2026.8.31) · upstream 8dbf07e9  
**Installation Method:** Official curl installer (bundles all runtimes)

---

## Installation Command

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
```

**Install Location:** `~/.hermes/hermes-agent/`

---

## Bundled Runtimes (VERIFIED)

The Hermes installer automatically provisions and bundles:

1. **uv** (Python package manager) → `~/.hermes/bin/uv`
2. **Python 3.11.16** → Managed by uv
3. **Node.js 26.8.1** → `~/.hermes/node/bin/node`
4. **ripgrep** → Installed via Homebrew
5. **ffmpeg** → Already present (8.1.2)
6. **Playwright Chromium** → Downloaded for browser tools
7. **Browser Use CLI** → Default browser backend
8. **Computer Use driver (cua-driver)** → For desktop control

**Key Feature:** Hermes brings its own runtimes, so no system Python/Node version conflicts.

---

## Version Output (VERIFIED)

```
$ hermes --version
Hermes Agent v0.21.0 (2026.8.31) · upstream 8dbf07e9
Install directory: /Users/nikhil/.hermes/hermes-agent
Install method: git
Python: 3.11.16
OpenAI SDK: 2.24.0
Up to date
```

---

## Help Output (VERIFIED - excerpt)

```
$ hermes --help
usage: hermes [-h] [--version] [-z PROMPT] [--usage-file PATH] [-m MODEL]
              [--provider PROVIDER] [--reasoning LEVEL] [-t TOOLSETS]
              [--resume SESSION] [--no-restore-cwd] [--in DIR]
              [--continue [SESSION_NAME]] [--worktree] [--accept-hooks]
              [--skills SKILLS] [--yolo] [--pass-session-id]
              [--ignore-user-config] [--ignore-rules] [--safe-mode] [--tui]
              [--cli] [--dev]
              {chat,model,moa,fallback,worktree,browser,secrets,egress,migrate,
               gateway,proxy,lsp,setup,whatsapp,whatsapp-cloud,slack,send,login,
               logout,auth,status,pause,resume,cron,sync,webhook,peer,portal,
               kanban,project,hooks,doctor,verify,security,approvals,dump,debug,
               backup,checkpoints,import,import-agent,config,skin,console,pairing,
               skills,bundles,plugins,curator,pets,journey,learning,memory-graph,
               memory,tools,computer-use,mcp,sessions,insights,monitoring,claw,
               update,uninstall,acp,profile,completion,dashboard,serve,desktop,
               gui,logs,prompt-size}
              ...

Hermes Agent - AI assistant with tool-calling capabilities

positional arguments:
  {chat,model,moa,fallback,worktree,browser,secrets,egress,migrate,gateway,
   proxy,lsp,setup,whatsapp,whatsapp-cloud,slack,send,login,logout,auth,
   status,pause,resume,cron,sync,webhook,peer,portal,kanban,project,hooks,
   doctor,verify,security,approvals,dump,debug,backup,checkpoints,import,
   import-agent,config,skin,console,pairing,skills,bundles,plugins,curator,
   pets,journey,learning,memory-graph,memory,tools,computer-use,mcp,sessions,
   insights,monitoring,claw,update,uninstall,acp,profile,completion,dashboard,
   serve,desktop,gui,logs,prompt-size}
                        Command to run
    chat                Interactive chat with the agent
    model               Select default model and provider
    mcp                 Manage MCP servers and run Hermes as an MCP server
    gateway             Messaging gateway management
    skills              Search, install, configure, and manage skills
    tools               Configure which tools are enabled per platform
    computer-use        Manage the Computer Use (cua-driver) backend
    [... 50+ more commands]

options:
  -h, --help            show this help message and exit
  --version, -V         Show version and exit
  -z PROMPT, --oneshot PROMPT
                        One-shot mode: send a single prompt and print ONLY the
                        final response text to stdout
  -m MODEL, --model MODEL
                        Model override for this invocation
  --tui                 Launch the modern TUI instead of the classic REPL
  [... many more options]
```

---

## Key Findings

1. **Self-Contained:** Bundles Python 3.11 + Node 26 + browser + all dependencies
2. **No System Conflicts:** Managed runtimes don't interfere with host Python/Node
3. **Rich Tooling:** 60+ built-in tools, MCP support, skills system
4. **Multiple Interfaces:** CLI, TUI, dashboard, desktop app, MCP server
5. **58 Bundled Skills:** Synced to `~/.hermes/skills/` during install
6. **Active Development:** v0.21.0 released 2026-08-31

---

## PATH Pollution Issue (CRITICAL)

**Problem:** The Hermes installer adds `~/.local/bin` to PATH and creates symlinks:

- `~/.local/bin/node` → `~/.hermes/node/bin/node` (Node 26.8.1)
- `~/.local/bin/npm` → `~/.hermes/node/bin/npm`
- `~/.local/bin/npx` → `~/.hermes/node/bin/npx`
- `~/.local/bin/hermes` → Hermes launcher script

**Impact:** This overrides the host Node 16.16.0, breaking AgentOne's vitest tests:

```
The module 'better-sqlite3.node' was compiled against Node.js MODULE_VERSION 93.
This version requires MODULE_VERSION 147.
```

**Workaround:** Temporarily rename the symlinks:

```bash
mv ~/.local/bin/node ~/.local/bin/node.hermes-backup
mv ~/.local/bin/npm ~/.local/bin/npm.hermes-backup
mv ~/.local/bin/npx ~/.local/bin/npx.hermes-backup
```

**Recommendation for Desktop App:**

1. **Don't add Hermes to system PATH** — Invoke via absolute path
2. **Bundle in isolated location** — E.g., `app.asar/hermes/` or `~/.flashlearn/hermes/`
3. **Subprocess with explicit PATH** — Control environment variables when spawning
4. **Desktop integration pattern:** Similar to how Claude Code manages subagents

---

## Configuration Files (VERIFIED)

Created by installer:

- `~/.hermes/.env` — API keys and secrets
- `~/.hermes/config.yaml` — Model, toolsets, MCP servers, agent settings
- `~/.hermes/SOUL.md` — Agent personality customization
- `~/.hermes/skills/` — 58 bundled skills

---

## Guardrail Verification: SUCCESS (after mitigation)

After Hermes installation and symlink backup:

```bash
$ node -v
v16.16.0

$ npx vitest run
Test Files  12 passed (12)
     Tests  79 passed (79)
```

**Mitigation Required:** The symlinks in `~/.local/bin/` were renamed to restore host Node 16.

---

## Verification: COMPLETE

- [x] Hermes installed via official curl installer
- [x] Version captured: v0.21.0
- [x] Help output captured
- [x] Bundled runtimes verified (Python 3.11.16, Node 26.8.1)
- [x] Configuration files created
- [x] 58 skills synced
- [x] Host Node 16 preserved (after symlink mitigation)
- [x] Vitest passes (79/79 tests)

---

## Desktop App Integration Notes

For desktop app integration, Hermes will require:

1. **Isolated installation** — Install to app-private directory, not `~/.hermes/`
2. **No PATH pollution** — Don't add symlinks to system PATH
3. **Explicit runtime paths** — Invoke with full paths to bundled Python/Node
4. **Config management** — Manage `.env` and `config.yaml` for user
5. **MCP server coordination** — Handle MCP server lifecycle
6. **Skill sync** — Manage bundled vs. user-installed skills

**Recommended approach:** Bundle Hermes as a portable installation similar to how Electron apps bundle native dependencies, with controlled subprocess invocation.

---

## Ollama Integration (VERIFIED)

Hermes supports Ollama as a local model provider. Ollama was also installed and verified during this spike:

**Ollama Version:** 0.33.0  
**Installed Models:** 
- `radenadri/Qwen3.5-0.8B-Claude-4.6-Opus-Reasoning-Distilled-GGUF:latest` (527 MB)
- `llama3.2:3b` (2.0 GB)

**Integration:** Set `provider: ollama` in `~/.hermes/config.yaml` to use local models.

---

## Interface (VERIFIED - Task 2)

### 1. Invoke + Stream

**One-Shot Command:**
```bash
hermes -z "Your prompt here"
# Outputs only the final response text
```

**Interactive Mode:**
```bash
hermes chat
# OR
hermes --tui  # Modern TUI interface
```

**Streaming:** Hermes streams output to stdout. The `-z/--oneshot` flag suppresses intermediate output and returns only the final response.

**Verified Output:**
```bash
$ hermes -z "What is 2+2? Answer in one sentence."
The answer is 4.
```

### 2. Model Wiring (Ollama)

**Config File:** `~/.hermes/config.yaml`

**Ollama Configuration:**
```yaml
model:
  default: "llama3.2:3b"
  provider: "ollama"  # Maps to "custom" internally
  base_url: "http://localhost:11434/v1"
```

**Verification:** Tested with `llama3.2:3b` via local Ollama. Successful one-shot response confirmed.

**Provider Aliases:** `"ollama"`, `"vllm"`, `"llamacpp"` all map to `"custom"` provider with OpenAI-compatible API.

**Model Format:** Standard Ollama model names (e.g., `llama3.2:3b`, `mistral:latest`)

**Alternative Local Providers:**
- `lmstudio`: First-class support with dedicated provider
- `custom`: Any OpenAI-compatible endpoint with explicit `base_url`

### 3. Capability Commands

**Skills Installation:**
```bash
# Search for skills
hermes skills search <query>

# Install a skill
hermes skills install <skill-name>

# List installed skills
hermes skills list

# Check for updates
hermes skills check
hermes skills update
```

**Skills Config:** `~/.hermes/config.yaml` + `~/.hermes/skills/` directory

**Bundled Skills:** 58 skills included (apple-notes, claude-code, computer-use, obsidian, etc.)

**MCP Servers:**
```bash
# Add an MCP server
hermes mcp add <name> --url <endpoint>
hermes mcp add <name> --command <cmd> --args <args...>

# List MCP servers
hermes mcp list

# Test connection
hermes mcp test <name>

# Install from catalog
hermes mcp install <catalog-name>
```

**MCP Config Location:** `~/.hermes/config.yaml` under MCP servers section

**Restart Required:** Unknown (not tested due to time constraints). Hermes runs as a long-lived process (gateway mode) which may require reload/restart for config changes. CLI mode likely picks up changes immediately.

---

## Capability Loop (NOT TESTED - Task 2 scope only)

Hermes was not selected for the Task 3 capability loop PoC. ZeptoClaw was chosen due to its simpler architecture and verified hot-reload behavior. Hermes interface has been documented for future adapter implementation.

---

**Verified By:** AgentOne v2 Phase 0 Tasks 2-3 Spike  
**Next Steps:** Proceed to Phase 1 - Adapter Implementation
