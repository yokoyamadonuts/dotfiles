import { join } from "jsr:@std/path";
import type { PostToolUseHookData, SkillToolParams } from "./types.ts";

/** Max lines of a .memory.md to inject before truncating (context budget guard). */
export const MAX_INJECT_LINES = 200;

/**
 * Resolve the `.memory.md` path for a repo-local skill.
 * Returns `null` for plugin-namespaced skills (name contains ":") or empty
 * names — those are not managed by this dotfiles repo.
 */
export function memoryPath(skill: string, home: string): string | null {
  if (!skill || skill.includes(":")) {
    return null;
  }
  return join(home, ".claude", "skills", skill, ".memory.md");
}

/** Cap `text` to `maxLines`, appending a truncation marker pointing at `path`. */
export function truncate(text: string, maxLines: number, path: string): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) {
    return text;
  }
  return lines.slice(0, maxLines).join("\n") +
    `\n\n(truncated; full memory at ${path})`;
}

export type LoadDeps = {
  home?: string;
  readTextFile?: (path: string | URL) => Promise<string>;
};

/**
 * Load and format a skill's private memory for context injection.
 * Fails open: returns `null` when the skill is plugin-namespaced, has no
 * memory file, the file is empty, or any read error occurs.
 */
export async function loadMemoryContext(
  skill: string,
  deps: LoadDeps = {},
): Promise<string | null> {
  const home = deps.home ?? Deno.env.get("HOME") ?? "";
  const readTextFile = deps.readTextFile ?? Deno.readTextFile;
  if (!home) {
    return null;
  }
  const path = memoryPath(skill, home);
  if (!path) {
    return null;
  }
  try {
    const raw = await readTextFile(path);
    if (!raw.trim()) {
      return null;
    }
    const body = truncate(raw, MAX_INJECT_LINES, path);
    return `# Skill memory: ${skill}\n\n` +
      `Private, per-machine notes for the "${skill}" skill. ` +
      `Apply any relevant failure modes / input quirks below before proceeding.\n\n` +
      body;
  } catch {
    return null; // fail open: missing file, permission error, etc.
  }
}

/** Build the PostToolUse JSON that injects `context` next to the tool result. */
export function buildOutput(context: string): string {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: context,
    },
    suppressOutput: true,
  });
}

/**
 * Core request handler. Returns the JSON string to print to stdout, or `null`
 * when nothing should be emitted (non-Skill tool, no skill name, no memory).
 */
export async function handle(
  data: Partial<PostToolUseHookData<SkillToolParams>>,
  deps: LoadDeps = {},
): Promise<string | null> {
  // `data` may be runtime-null (stdin can be the literal JSON `null`); the `?.`
  // guards keep this fail-open even though the static type isn't nullable.
  if (data?.tool_name !== "Skill") {
    return null;
  }
  const skill = data.tool_input?.skill;
  if (!skill) {
    return null;
  }
  const context = await loadMemoryContext(skill, deps);
  return context ? buildOutput(context) : null;
}

async function main(): Promise<void> {
  try {
    const data = await new Response(Deno.stdin.readable).json();
    const out = await handle(data);
    if (out) {
      console.log(out); // stdout MUST be JSON only — never log human text here
    }
  } catch (error) {
    // Fail open: never break skill use. Log to stderr (no --allow-write needed).
    const message = error instanceof Error ? error.message : String(error);
    console.error(`skill-memory hook error: ${message}`);
  }
}

if (import.meta.main) {
  await main();
}
