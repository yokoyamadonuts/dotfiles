# Claude Code Hooks

This directory contains custom hooks for Claude Code to enhance the development workflow.

## Files

- `format.ts` - Automatically formats files after Claude Code writes or edits them
- `notify.ts` - Sends desktop notifications for Claude Code events
- `skill-memory.ts` - Injects a skill's private `.memory.md` into context when that skill is used
- `skill-memory.test.ts` - Tests for the skill-memory hook
- `types.ts` - TypeScript type definitions for Claude Code hook data structures

## Type Definitions

`types.ts` models the hook stdin JSON as documented in the official hooks
reference: `HookCommonInput` (session_id, cwd, hook_event_name, permission_mode,
effort, ...) and `PostToolUseHookData` (tool_name, tool_input, tool_response,
tool_use_id). `tool_input` is typed for `Write` / `Edit` / `Skill`;
`tool_response` for `Write` is `{ filePath, type }`. `MultiEdit` no longer
exists upstream and is not modelled.

## Running the tests

```bash
cd claude/hooks && deno test --allow-read --allow-write --allow-env --allow-run
```

`--allow-write` is needed because the integration test creates a temp dir.

## Usage

The hooks are configured in `../settings.json` and are automatically executed by Claude Code when the specified events occur.

### Format Hook

The format hook runs after Write, Edit, and Bash operations. For Bash it formats the files listed in `tool_response.bashEditDiff.changedFiles` (edits Claude made through shell commands in auto mode; absent on older versions → no-op). Files are formatted by extension:

- `.go` files - formatted with `gofmt`
- `.rs` files - formatted with `rustfmt`
- `.ts`, `.tsx`, `.js`, `.jsx` files - formatted with Biome (for Node.js projects) or Deno
- `.json`, `.jsonc` files - formatted with `jq`

### Notify Hook

The notify hook sends desktop notifications when:
- a turn finishes (`Stop` event; the tail of the last message is shown)
- a turn ends on an API error (`StopFailure` event; the error type is shown)
- Claude needs attention (`Notification` event: `permission_prompt`, `idle_prompt`, `agent_needs_input`, `agent_completed`)

It uses `terminal-notifier` when installed and otherwise falls back to macOS Notification Center via `osascript`. Errors are swallowed (exit 0) so a broken notifier never blocks a session.

### Skill Memory Hook

The skill-memory hook runs after the `Skill` tool is used. It reads the invoked skill's private `.memory.md` (at `~/.claude/skills/<name>/.memory.md`, gitignored) and injects it into context via `additionalContext`, so accumulated failure modes and input quirks for that skill surface before it runs. It fails open (missing file, plugin-namespaced skill, or any error → no-op) and runs read-only (`--allow-env --allow-read`). See `CLAUDE.md` → "Per-Skill Memory" for the write convention and the `references/lessons.md` promotion path.