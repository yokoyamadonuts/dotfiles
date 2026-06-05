import { join } from "jsr:@std/path";

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
