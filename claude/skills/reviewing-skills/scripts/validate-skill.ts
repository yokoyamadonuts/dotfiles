// Deterministic skill validator (SP2: test-gate / Evaluation stage).
// Tier 1: structural checks on SKILL.md (frontmatter, name, description, body).
// Tier 2: runs scripts/*.test.ts via `deno test` when present.
// Used by /create-skill as a fail-closed gate; also runnable standalone (--all).

import { parse as parseYaml } from "jsr:@std/yaml";

export const MAX_BODY_LINES = 500;
export const MAX_NAME_LEN = 64;
export const MAX_DESC_LEN = 1024;

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const NAME_RE = /^[a-z0-9-]+$/;
const RESERVED_WORDS = ["anthropic", "claude"];
const VAGUE_NAMES = ["helper", "utils", "tools"];
const WHEN_TO_USE_RE = /^#{1,6}\s+.*when to use/im;

export type Severity = "Critical" | "Warning";
export type Violation = { severity: Severity; check: string; detail: string };

export type ParseResult =
  | { ok: true; frontmatter: Record<string, unknown>; body: string }
  | { ok: false; error: string };

/** C2: name must be a flat kebab/lowercase id, ≤64 chars, no reserved words. */
export function checkName(name: unknown): Violation[] {
  if (typeof name !== "string" || name.length === 0) {
    return [{
      severity: "Critical",
      check: "C2 name",
      detail: "missing or empty",
    }];
  }
  const v: Violation[] = [];
  if (name.length > MAX_NAME_LEN) {
    v.push({
      severity: "Critical",
      check: "C2 name",
      detail: `${name.length} chars (>${MAX_NAME_LEN})`,
    });
  }
  if (!NAME_RE.test(name)) {
    v.push({
      severity: "Critical",
      check: "C2 name",
      detail: `"${name}" violates ${NAME_RE.source}`,
    });
  }
  for (const word of RESERVED_WORDS) {
    if (name.includes(word)) {
      v.push({
        severity: "Critical",
        check: "C2 name",
        detail: `contains reserved word "${word}"`,
      });
    }
  }
  if (VAGUE_NAMES.includes(name)) {
    v.push({
      severity: "Warning",
      check: "W2 name",
      detail: `vague name "${name}"`,
    });
  }
  return v;
}

/** C3: description must be present, non-empty, ≤1024 chars. */
export function checkDescription(description: unknown): Violation[] {
  if (typeof description !== "string" || description.trim().length === 0) {
    return [{
      severity: "Critical",
      check: "C3 description",
      detail: "missing or empty",
    }];
  }
  if (description.length > MAX_DESC_LEN) {
    return [{
      severity: "Critical",
      check: "C3 description",
      detail: `${description.length} chars (>${MAX_DESC_LEN})`,
    }];
  }
  return [];
}

/** W1/W3: body should be ≤500 lines and not carry a "When to Use" heading. */
export function checkBody(body: string): Violation[] {
  const v: Violation[] = [];
  const lines = body.split("\n").length;
  if (lines > MAX_BODY_LINES) {
    v.push({
      severity: "Warning",
      check: "W1 body",
      detail: `${lines} lines (>${MAX_BODY_LINES})`,
    });
  }
  if (WHEN_TO_USE_RE.test(body)) {
    v.push({
      severity: "Warning",
      check: "W3 body",
      detail: `"When to Use" belongs in description`,
    });
  }
  return v;
}

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

export type SkillResult = {
  skill: string;
  violations: Violation[];
  scriptTests: { ran: boolean; passed: boolean; output: string };
};

/** Tier-1 orchestration: parse, then run all field checks. */
export function validateContent(content: string): Violation[] {
  const parsed = parseFrontmatter(content);
  if (!parsed.ok) {
    return [{
      severity: "Critical",
      check: "C1 frontmatter",
      detail: parsed.error,
    }];
  }
  return [
    ...checkName(parsed.frontmatter.name),
    ...checkDescription(parsed.frontmatter.description),
    ...checkBody(parsed.body),
  ];
}

/** The gate blocks only on Critical violations; Warnings are advisory. */
export function hasCritical(violations: Violation[]): boolean {
  return violations.some((x) => x.severity === "Critical");
}

/** Human-readable, auto-fix-loop-parseable result line(s). */
export function formatResult(r: SkillResult): string {
  const status = hasCritical(r.violations) ? "FAIL" : "PASS";
  const lines = [`${r.skill}: ${status}`];
  for (const x of r.violations) {
    lines.push(`  [${x.severity}] ${x.check}: ${x.detail}`);
  }
  return lines.join("\n");
}
