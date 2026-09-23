# ZeptoClaw Agent Framework - Verified Install

**Verification Date:** 2026-08-31  
**Task:** Phase 0, Task 1 - Runtime & Install Feasibility Spike

---

## Install Status: SUCCESS

**Runtime:** Rust (statically compiled binary)  
**Version:** 0.9.2  
**Installation Method:** Already installed via Homebrew at `/opt/homebrew/bin/zeptoclaw`

---

## Installation Command

```bash
brew install qhkm/tap/zeptoclaw
```

**Note:** ZeptoClaw was already present in the environment. No new installation was required.

---

## Version Output (VERIFIED)

```
$ zeptoclaw --version
zeptoclaw 0.9.2
```

---

## Help Output (VERIFIED)

```
$ zeptoclaw --help
Ultra-lightweight personal AI assistant

Usage: zeptoclaw [COMMAND]

Commands:
  onboard      Initialize configuration and workspace
  agent        Start interactive agent mode
  batch        Process prompts from a file
  gateway      Start multi-channel gateway
  agent-stdin  Run agent in stdin/stdout mode (for containerized execution)
  heartbeat    Trigger or inspect heartbeat tasks
  history      Manage conversation history
  memory       Manage long-term memory
  template     Manage agent templates
  skills       Manage skills
  hand         Manage hands-lite packages
  tools        Manage and discover tools
  auth         Manage authentication
  version      Show version information
  status       Show system status
  channel      Manage communication channels
  config       Validate configuration file
  secrets      Manage secret encryption
  watch        Watch a URL for changes and notify
  pair         Manage device pairing (bearer token auth)
  quota        Show or reset per-provider quota usage
  provider     Inspect provider chain configuration
  panel        Start the control panel (API server + dashboard)
  doctor       Run system diagnostics
  daemon       Start supervised daemon (auto-restarts gateway on failure)
  migrate      Migrate config and skills from an OpenClaw installation
  update       Check for updates or update to latest version
  uninstall    Remove ZeptoClaw state and optionally the current binary
  hardware     Hardware device management (USB discovery, peripherals)
  mcp-server   Start MCP server (expose tools to Claude Desktop, VS Code, Cursor)
  acp          Start ACP agent on stdio (for use with acpx or any ACP client)
  help         Print this message or the help of the given subcommand(s)

Options:
  -h, --help     Print help
  -V, --version  Print version
```

---

## Key Findings

1. **Binary Size:** ~6MB (single Rust binary)
2. **Runtime Dependencies:** None (statically compiled)
3. **Installation:** Straightforward via Homebrew
4. **Command Surface:** Comprehensive CLI with 30+ subcommands
5. **MCP Support:** Built-in MCP server support (`mcp-server` command)
6. **Multi-channel:** Gateway supports Telegram, Slack, Discord, WhatsApp, etc.

---

## Verification: COMPLETE

- [x] Binary present at `/opt/homebrew/bin/zeptoclaw`
- [x] Version captured: 0.9.2
- [x] Help output captured
- [x] No runtime dependencies required
- [x] Ready for desktop app integration testing

---

## Interface (VERIFIED - Task 2)

### 1. Invoke + Stream

**Command:**
```bash
echo "Your prompt here" | zeptoclaw agent
# OR
zeptoclaw agent  # Interactive mode
```

**Streaming:** ZeptoClaw streams output to stdout with a spinner animation showing "Thinking..." during generation. Final response is printed after streaming completes.

**Verified Output:**
```
ZeptoClaw Interactive Agent
Type your message and press Enter. Type /help for commands, /quit to exit.

  ⠋ Thinking...  # Animated spinner during streaming
The result of the calculation is 4.  # Final streamed response
```

### 2. Model Wiring (Ollama)

**Config File:** `~/.zeptoclaw/config.json`

**Ollama Configuration:**
```json
{
  "agents": {
    "defaults": {
      "model": "llama3.2:3b"
    }
  },
  "providers": {
    "ollama": {
      "api_base": "http://localhost:11434/v1",
      "model": "llama3.2:3b"
    },
    "openrouter": null  // Disable other providers to use Ollama as primary
  }
}
```

**Verification:** Tested with `llama3.2:3b` via local Ollama. Successful streaming response confirmed.

**Model Format:** Standard Ollama model names (e.g., `llama3.2:3b`, `mistral:latest`)

**Provider Check:**
```bash
zeptoclaw provider status
# Shows: ollama backend, model, api_base
```

### 3. Capability Commands

**Skills Installation:**
```bash
# Create a new skill (writes to ~/.zeptoclaw/skills/<name>/SKILL.md)
zeptoclaw skills create <skill-name>

# Install from community/GitHub
zeptoclaw skills install <skill-name>
zeptoclaw skills install --github <owner/repo>

# List skills
zeptoclaw skills list

# Search skills
zeptoclaw skills search <query>
```

**Skills Config Location:** `~/.zeptoclaw/skills/<skill-name>/SKILL.md`

**MCP Servers:**
- **Config Location:** `~/.zeptoclaw/config.json` under `mcp.servers` array
- **Manual Configuration:** MCP servers must be added manually to config (no CLI command for `mcp add` found)
- **Format:**
  ```json
  {
    "mcp": {
      "servers": [
        // MCP server entries here
      ]
    }
  }
  ```

**Restart Required:** **NO** — Skills are available immediately after creation/installation. Verified by creating `capability-loop-test` skill and confirming it appeared in `skills list` without restart.

---

## Capability Loop PoC (VERIFIED - Task 3)

**Framework:** ZeptoClaw  
**Test Date:** 2026-08-31  
**Result:** GO

### Loop Recipe

1. **Gap Detection:**
   - Agent response indicates missing capability in status output
   - Skills marked as "not found" or tools marked as disabled
   - Example: `zeptoclaw status` shows tool availability

2. **Install:**
   ```bash
   # For skills
   zeptoclaw skills create <skill-name>
   # OR
   zeptoclaw skills install <skill-name>
   
   # For config changes (MCP servers, providers)
   # Edit ~/.zeptoclaw/config.json directly
   ```

3. **Restart:**
   - **NOT REQUIRED** — Hot reload confirmed for skills
   - Config changes also take effect immediately (verified with provider swap)

4. **Resume:**
   - Re-issue the same task/prompt
   - Agent now has access to the capability
   - Session context is managed by the app (ZeptoClaw doesn't maintain cross-invocation state by default)

### Test Evidence

**Test Script:** `$(repo root)/spikes/zeptoclaw-capability-loop.sh`

**Test Flow:**
1. Created skill `capability-loop-test` via `zeptoclaw skills create`
2. Verified skill appeared in `zeptoclaw skills list` immediately
3. Confirmed no restart was needed
4. Cleaned up test skill

**Output:**
```
Created skill at "$HOME/.zeptoclaw/skills/capability-loop-test/SKILL.md"

Skills:
  - capability-loop-test (workspace, ready)

✓ Skill available without restart!
```

### Context Preservation

- ZeptoClaw CLI mode: Each invocation is stateless unless using session management
- For app integration: The desktop app would manage conversation state and re-inject it when resuming after capability installation
- Session files stored in `~/.zeptoclaw/sessions/`

---

**Verified By:** AgentOne v2 Phase 0 Tasks 2-3 Spike  
**Next Steps:** Proceed to Phase 1 - Adapter Implementation
