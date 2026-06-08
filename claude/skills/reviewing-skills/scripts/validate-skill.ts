// Deterministic skill validator (SP2: test-gate / Evaluation stage).
// Tier 1: structural checks on SKILL.md (frontmatter, name, description, body).
// Tier 2: runs scripts/*.test.ts via `deno test` when present.
// Used by /create-skill as a fail-closed gate; also runnable standalone (--all).

import { parse as parseYaml } from "jsr:@std/yaml";

export const MAX_BODY_LINES = 500;
export const MAX_NAME_LEN = 64;
export const MAX_DESC_LEN = 1024;

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export type Severity = "Critical" | "Warning";
export type Violation = { severity: Severity; check: string; detail: string };

export type ParseResult =
  | { ok: true; frontmatter: Record<string, unknown>; body: string }
  | { ok: false; error: string };

/** Split a SKILL.md into its YAML frontmatter object and the remaining body. */
export function parseFrontmatter(content: string): ParseResult {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return { ok: false, error: "no YAML frontmatter block found" };
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(match[1], { schema: "json" });
  } catch (e) {
    return { ok: false, error: `invalid YAML: ${(e as Error).message}` };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "frontmatter must be a YAML object" };
  }
  return {
    ok: true,
    frontmatter: parsed as Record<string, unknown>,
    body: content.slice(match[0].length),
  };
}
