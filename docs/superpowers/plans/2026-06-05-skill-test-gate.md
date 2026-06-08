# Skill Test-Gate (SP2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deterministic, runnable skill validator (`validate-skill.ts`) that structurally checks every skill's SKILL.md and runs script tests for code-bearing skills, wired into `/create-skill` as a fail-closed gate.

**Architecture:** A single Deno/TS module of small pure functions (frontmatter parse + field checks) plus a thin FS/subprocess layer (`validateSkill`, Tier-2 `deno test` runner) and a CLI (`--all` / `<name>`). Pure functions are tested with inline strings; FS/CLI layers with temp-dir fixtures and subprocess integration tests. Lives under `reviewing-skills/scripts/` (the "skill quality" home); the deterministic gate complements reviewing-skills' qualitative LLM review.

**Tech Stack:** Deno 2.x, `jsr:@std/yaml`, `jsr:@std/path`, `jsr:@std/assert`. Matches existing hooks (`claude/hooks/*.ts`) and `vcsdd-lite/scripts/*` conventions.

**Spec:** `docs/superpowers/specs/2026-06-05-skill-test-gate-design.md`

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `claude/skills/reviewing-skills/scripts/validate-skill.ts` | Validator: pure checks + `validateSkill` + Tier-2 runner + CLI |
| `claude/skills/reviewing-skills/scripts/validate-skill.test.ts` | Unit (inline strings + DI) and subprocess integration tests |
| `claude/skills/reviewing-skills/scripts/fixtures/**` | Temp-on-disk fixture skills for FS/CLI/Tier-2 tests |
| `claude/commands/create-skill.md` | Insert deterministic gate step `[2.5/3]` |
| `claude/skills/reviewing-skills/SKILL.md` | Reference the deterministic arm + boundary |
| `CLAUDE.md` | One-line boundary note (validate-skill vs reviewing-skills) |

All names/signatures used across tasks (defined in Task 1 unless noted):
`Severity`, `Violation`, `ParseResult`, `parseFrontmatter` (T1); `checkName`, `checkDescription`, `checkBody` (T2); `validateContent`, `hasCritical`, `formatResult` (T3); `SkillResult`, `ValidateDeps`, `defaultHasTests`, `defaultRunTests`, `validateSkill` (T4); `skillsDir`, `listSkills`, `main` (T5).

---

## Task 1: Module scaffold — types, constants, `parseFrontmatter`

**Files:**
- Create: `claude/skills/reviewing-skills/scripts/validate-skill.ts`
- Create: `claude/skills/reviewing-skills/scripts/validate-skill.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `claude/skills/reviewing-skills/scripts/validate-skill.test.ts`:

```typescript
import { assertEquals } from "jsr:@std/assert";
import { parseFrontmatter } from "./validate-skill.ts";

Deno.test("parseFrontmatter: extracts object frontmatter and body", () => {
  const r = parseFrontmatter("---\nname: foo\ndescription: bar\n---\n# Body\ntext");
  assertEquals(r.ok, true);
  if (r.ok) {
    assertEquals(r.frontmatter.name, "foo");
    assertEquals(r.body, "# Body\ntext");
  }
});

Deno.test("parseFrontmatter: missing block fails", () => {
  const r = parseFrontmatter("# No frontmatter\njust text");
  assertEquals(r.ok, false);
});

Deno.test("parseFrontmatter: invalid YAML fails", () => {
  const r = parseFrontmatter("---\nname: : :\n  - broken\n---\n");
  assertEquals(r.ok, false);
});

Deno.test("parseFrontmatter: non-object frontmatter fails", () => {
  const r = parseFrontmatter("---\n- just\n- a\n- list\n---\nbody");
  assertEquals(r.ok, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test claude/skills/reviewing-skills/scripts/validate-skill.test.ts`
Expected: FAIL (`parseFrontmatter` not found / module missing).

- [ ] **Step 3: Write minimal implementation**

Create `claude/skills/reviewing-skills/scripts/validate-skill.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test claude/skills/reviewing-skills/scripts/validate-skill.test.ts`
Expected: PASS（4 tests passed）

- [ ] **Step 5: Type-check, format, commit**

```bash
deno check claude/skills/reviewing-skills/scripts/validate-skill.ts
deno fmt claude/skills/reviewing-skills/scripts/validate-skill.ts claude/skills/reviewing-skills/scripts/validate-skill.test.ts
git add claude/skills/reviewing-skills/scripts/validate-skill.ts claude/skills/reviewing-skills/scripts/validate-skill.test.ts
git commit -m "feat(skills): add validate-skill frontmatter parser

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Tier-1 field checks — `checkName`, `checkDescription`, `checkBody`

**Files:**
- Modify: `claude/skills/reviewing-skills/scripts/validate-skill.ts`
- Modify: `claude/skills/reviewing-skills/scripts/validate-skill.test.ts`

- [ ] **Step 1: Add failing tests**

Update the import line at the top of `validate-skill.test.ts` to:

```typescript
import {
  checkBody,
  checkDescription,
  checkName,
  parseFrontmatter,
} from "./validate-skill.ts";
```

Append these tests:

```typescript
Deno.test("checkName: valid flat name passes", () => {
  assertEquals(checkName("pptx"), []);
  assertEquals(checkName("competitive-research"), []);
});

Deno.test("checkName: missing/empty is Critical", () => {
  assertEquals(checkName(undefined)[0].severity, "Critical");
  assertEquals(checkName("")[0].severity, "Critical");
});

Deno.test("checkName: bad chars are Critical", () => {
  const v = checkName("Foo_Bar");
  assertEquals(v.some((x) => x.severity === "Critical"), true);
});

Deno.test("checkName: reserved word is Critical", () => {
  const v = checkName("claude-helper");
  assertEquals(v.some((x) => x.detail.includes("claude")), true);
});

Deno.test("checkName: over 64 chars is Critical", () => {
  const v = checkName("a".repeat(65));
  assertEquals(v.some((x) => x.severity === "Critical"), true);
});

Deno.test("checkName: vague name is Warning", () => {
  const v = checkName("utils");
  assertEquals(v.length, 1);
  assertEquals(v[0].severity, "Warning");
});

Deno.test("checkDescription: valid passes", () => {
  assertEquals(checkDescription("Does X. Use when Y."), []);
});

Deno.test("checkDescription: empty is Critical", () => {
  assertEquals(checkDescription("   ")[0].severity, "Critical");
  assertEquals(checkDescription(undefined)[0].severity, "Critical");
});

Deno.test("checkDescription: over 1024 chars is Critical", () => {
  assertEquals(checkDescription("x".repeat(1025))[0].severity, "Critical");
});

Deno.test("checkBody: short clean body passes", () => {
  assertEquals(checkBody("# Title\nsome steps"), []);
});

Deno.test("checkBody: over 500 lines is Warning", () => {
  const v = checkBody("x\n".repeat(501));
  assertEquals(v.some((x) => x.check.startsWith("W1")), true);
  assertEquals(v.every((x) => x.severity === "Warning"), true);
});

Deno.test("checkBody: 'When to Use' heading is Warning", () => {
  const v = checkBody("# Skill\n## When to Use This Skill\ntext");
  assertEquals(v.some((x) => x.check.startsWith("W3")), true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test claude/skills/reviewing-skills/scripts/validate-skill.test.ts`
Expected: FAIL (`checkName`/`checkDescription`/`checkBody` not exported).

- [ ] **Step 3: Implement the checks**

Add to `validate-skill.ts` (after `parseFrontmatter`). Also add the constants near the top constants block:

```typescript
const NAME_RE = /^[a-z0-9-]+$/;
const RESERVED_WORDS = ["anthropic", "claude"];
const VAGUE_NAMES = ["helper", "utils", "tools"];
const WHEN_TO_USE_RE = /^#{1,6}\s+.*when to use/im;

/** C2: name must be a flat kebab/lowercase id, ≤64 chars, no reserved words. */
export function checkName(name: unknown): Violation[] {
  if (typeof name !== "string" || name.length === 0) {
    return [{ severity: "Critical", check: "C2 name", detail: "missing or empty" }];
  }
  const v: Violation[] = [];
  if (name.length > MAX_NAME_LEN) {
    v.push({ severity: "Critical", check: "C2 name", detail: `${name.length} chars (>${MAX_NAME_LEN})` });
  }
  if (!NAME_RE.test(name)) {
    v.push({ severity: "Critical", check: "C2 name", detail: `"${name}" violates ${NAME_RE.source}` });
  }
  for (const word of RESERVED_WORDS) {
    if (name.includes(word)) {
      v.push({ severity: "Critical", check: "C2 name", detail: `contains reserved word "${word}"` });
    }
  }
  if (VAGUE_NAMES.includes(name)) {
    v.push({ severity: "Warning", check: "W2 name", detail: `vague name "${name}"` });
  }
  return v;
}

/** C3: description must be present, non-empty, ≤1024 chars. */
export function checkDescription(description: unknown): Violation[] {
  if (typeof description !== "string" || description.trim().length === 0) {
    return [{ severity: "Critical", check: "C3 description", detail: "missing or empty" }];
  }
  if (description.length > MAX_DESC_LEN) {
    return [{ severity: "Critical", check: "C3 description", detail: `${description.length} chars (>${MAX_DESC_LEN})` }];
  }
  return [];
}

/** W1/W3: body should be ≤500 lines and not carry a "When to Use" heading. */
export function checkBody(body: string): Violation[] {
  const v: Violation[] = [];
  const lines = body.split("\n").length;
  if (lines > MAX_BODY_LINES) {
    v.push({ severity: "Warning", check: "W1 body", detail: `${lines} lines (>${MAX_BODY_LINES})` });
  }
  if (WHEN_TO_USE_RE.test(body)) {
    v.push({ severity: "Warning", check: "W3 body", detail: `"When to Use" belongs in description` });
  }
  return v;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test claude/skills/reviewing-skills/scripts/validate-skill.test.ts`
Expected: PASS（16 tests passed）

- [ ] **Step 5: Type-check, format, commit**

```bash
deno check claude/skills/reviewing-skills/scripts/validate-skill.ts
deno fmt claude/skills/reviewing-skills/scripts/validate-skill.ts claude/skills/reviewing-skills/scripts/validate-skill.test.ts
git add claude/skills/reviewing-skills/scripts/validate-skill.ts claude/skills/reviewing-skills/scripts/validate-skill.test.ts
git commit -m "feat(skills): add Tier-1 name/description/body checks

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Orchestration — `validateContent`, `hasCritical`, `formatResult`

**Files:**
- Modify: `claude/skills/reviewing-skills/scripts/validate-skill.ts`
- Modify: `claude/skills/reviewing-skills/scripts/validate-skill.test.ts`

- [ ] **Step 1: Add failing tests**

Update the import line in `validate-skill.test.ts` to add the three symbols:

```typescript
import {
  checkBody,
  checkDescription,
  checkName,
  formatResult,
  hasCritical,
  parseFrontmatter,
  validateContent,
} from "./validate-skill.ts";
```

Append:

```typescript
const VALID_SKILL = "---\nname: demo-skill\ndescription: Does a demo. Use when demoing.\n---\n# Demo\nsteps here";

Deno.test("validateContent: valid skill has no violations", () => {
  assertEquals(validateContent(VALID_SKILL), []);
});

Deno.test("validateContent: no frontmatter => single C1 Critical", () => {
  const v = validateContent("# just a body");
  assertEquals(v.length, 1);
  assertEquals(v[0].check.startsWith("C1"), true);
});

Deno.test("validateContent: aggregates name + description violations", () => {
  const v = validateContent("---\nname: Bad_Name\ndescription: ''\n---\nbody");
  assertEquals(v.some((x) => x.check.startsWith("C2")), true);
  assertEquals(v.some((x) => x.check.startsWith("C3")), true);
});

Deno.test("hasCritical: true only when a Critical exists", () => {
  assertEquals(hasCritical([{ severity: "Warning", check: "W1 body", detail: "x" }]), false);
  assertEquals(hasCritical([{ severity: "Critical", check: "C1", detail: "x" }]), true);
  assertEquals(hasCritical([]), false);
});

Deno.test("formatResult: PASS with no critical, lists violations", () => {
  const out = formatResult({
    skill: "demo",
    violations: [{ severity: "Warning", check: "W1 body", detail: "612 lines (>500)" }],
    scriptTests: { ran: false, passed: true, output: "" },
  });
  assertEquals(out.includes("demo: PASS"), true);
  assertEquals(out.includes("[Warning] W1 body: 612 lines (>500)"), true);
});

Deno.test("formatResult: FAIL when a Critical exists", () => {
  const out = formatResult({
    skill: "demo",
    violations: [{ severity: "Critical", check: "C1 frontmatter", detail: "no YAML frontmatter block found" }],
    scriptTests: { ran: false, passed: true, output: "" },
  });
  assertEquals(out.includes("demo: FAIL"), true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test claude/skills/reviewing-skills/scripts/validate-skill.test.ts`
Expected: FAIL (`validateContent`/`hasCritical`/`formatResult` not exported, and `SkillResult` type used in tests).

- [ ] **Step 3: Implement orchestration**

Add to `validate-skill.ts`. (Define `SkillResult` here too — it is consumed by `formatResult` now and produced by `validateSkill` in Task 4.)

```typescript
export type SkillResult = {
  skill: string;
  violations: Violation[];
  scriptTests: { ran: boolean; passed: boolean; output: string };
};

/** Tier-1 orchestration: parse, then run all field checks. */
export function validateContent(content: string): Violation[] {
  const parsed = parseFrontmatter(content);
  if (!parsed.ok) {
    return [{ severity: "Critical", check: "C1 frontmatter", detail: parsed.error }];
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test claude/skills/reviewing-skills/scripts/validate-skill.test.ts`
Expected: PASS（22 tests passed）

- [ ] **Step 5: Type-check, format, commit**

```bash
deno check claude/skills/reviewing-skills/scripts/validate-skill.ts
deno fmt claude/skills/reviewing-skills/scripts/validate-skill.ts claude/skills/reviewing-skills/scripts/validate-skill.test.ts
git add claude/skills/reviewing-skills/scripts/validate-skill.ts claude/skills/reviewing-skills/scripts/validate-skill.test.ts
git commit -m "feat(skills): add validateContent orchestration and result formatting

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: FS + Tier-2 — `validateSkill`, `defaultHasTests`, `defaultRunTests`, fixtures

**Files:**
- Modify: `claude/skills/reviewing-skills/scripts/validate-skill.ts`
- Modify: `claude/skills/reviewing-skills/scripts/validate-skill.test.ts`
- Create: `claude/skills/reviewing-skills/scripts/fixtures/passing-script/SKILL.md`
- Create: `claude/skills/reviewing-skills/scripts/fixtures/passing-script/scripts/sample.test.ts`
- Create: `claude/skills/reviewing-skills/scripts/fixtures/failing-script/SKILL.md`
- Create: `claude/skills/reviewing-skills/scripts/fixtures/failing-script/scripts/sample.test.ts`

- [ ] **Step 1: Create fixtures**

`fixtures/passing-script/SKILL.md`:

```
---
name: passing-script
description: A fixture skill whose script tests pass. Use only in validator tests.
---
# Passing fixture
body.
```

`fixtures/passing-script/scripts/sample.test.ts`:

```typescript
import { assertEquals } from "jsr:@std/assert";
Deno.test("sample: passes", () => {
  assertEquals(1 + 1, 2);
});
```

`fixtures/failing-script/SKILL.md`:

```
---
name: failing-script
description: A fixture skill whose script tests fail. Use only in validator tests.
---
# Failing fixture
body.
```

`fixtures/failing-script/scripts/sample.test.ts`:

```typescript
import { assertEquals } from "jsr:@std/assert";
Deno.test("sample: fails on purpose", () => {
  assertEquals(1 + 1, 3);
});
```

- [ ] **Step 2: Add failing tests**

Update the import in `validate-skill.test.ts` to add the new symbols and `join`:

```typescript
import { join } from "jsr:@std/path";
import {
  checkBody,
  checkDescription,
  checkName,
  defaultHasTests,
  defaultRunTests,
  formatResult,
  hasCritical,
  parseFrontmatter,
  validateContent,
  validateSkill,
} from "./validate-skill.ts";
```

Append (note `FIXTURES` constant and the DI-based unit tests + two subprocess integration tests):

```typescript
const FIXTURES = new URL("./fixtures", import.meta.url).pathname;

Deno.test("validateSkill: clean skill, no scripts => PASS, tests not run", async () => {
  const r = await validateSkill("/fake/demo", "demo", {
    readTextFile: () => Promise.resolve(VALID_SKILL),
    hasTests: () => Promise.resolve(false),
  });
  assertEquals(hasCritical(r.violations), false);
  assertEquals(r.scriptTests.ran, false);
});

Deno.test("validateSkill: passing scripts => no C4", async () => {
  const r = await validateSkill("/fake/demo", "demo", {
    readTextFile: () => Promise.resolve(VALID_SKILL),
    hasTests: () => Promise.resolve(true),
    runTests: () => Promise.resolve({ passed: true, output: "ok" }),
  });
  assertEquals(r.scriptTests.ran, true);
  assertEquals(r.violations.some((x) => x.check.startsWith("C4")), false);
});

Deno.test("validateSkill: failing scripts => C4 Critical", async () => {
  const r = await validateSkill("/fake/demo", "demo", {
    readTextFile: () => Promise.resolve(VALID_SKILL),
    hasTests: () => Promise.resolve(true),
    runTests: () => Promise.resolve({ passed: false, output: "boom" }),
  });
  assertEquals(r.violations.some((x) => x.check.startsWith("C4")), true);
  assertEquals(hasCritical(r.violations), true);
});

Deno.test("defaultHasTests: detects scripts/*.test.ts", async () => {
  assertEquals(await defaultHasTests(`${FIXTURES}/passing-script`), true);
});

Deno.test("defaultHasTests: false when no scripts dir", async () => {
  assertEquals(await defaultHasTests("/nonexistent/skill"), false);
});

Deno.test("defaultRunTests: passing fixture => passed true", async () => {
  const r = await defaultRunTests(`${FIXTURES}/passing-script`);
  assertEquals(r.passed, true);
});

Deno.test("defaultRunTests: failing fixture => passed false", async () => {
  const r = await defaultRunTests(`${FIXTURES}/failing-script`);
  assertEquals(r.passed, false);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `deno test --allow-read --allow-run --allow-write --allow-env claude/skills/reviewing-skills/scripts/validate-skill.test.ts`
Expected: FAIL (`validateSkill`/`defaultHasTests`/`defaultRunTests` not exported).

- [ ] **Step 4: Implement FS + Tier-2 layer**

Add to the top imports of `validate-skill.ts`:

```typescript
import { join } from "jsr:@std/path";
```

Append to `validate-skill.ts`:

```typescript
export type ValidateDeps = {
  readTextFile?: (path: string | URL) => Promise<string>;
  hasTests?: (skillDir: string) => Promise<boolean>;
  runTests?: (skillDir: string) => Promise<{ passed: boolean; output: string }>;
};

/** True when the skill has at least one scripts/*.test.ts file. */
export async function defaultHasTests(skillDir: string): Promise<boolean> {
  try {
    for await (const entry of Deno.readDir(join(skillDir, "scripts"))) {
      if (entry.isFile && entry.name.endsWith(".test.ts")) return true;
    }
  } catch {
    return false; // no scripts/ dir
  }
  return false;
}

/**
 * Run a skill's scripts/ tests. Skill tests are the author's own trusted local
 * code, so we grant `-A` to avoid false failures (e.g. tests using temp dirs).
 */
export async function defaultRunTests(
  skillDir: string,
): Promise<{ passed: boolean; output: string }> {
  const { code, stdout, stderr } = await new Deno.Command("deno", {
    args: ["test", "-A", join(skillDir, "scripts")],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const dec = new TextDecoder();
  return { passed: code === 0, output: dec.decode(stdout) + dec.decode(stderr) };
}

/** Validate one skill directory: Tier-1 content checks + Tier-2 script tests. */
export async function validateSkill(
  skillDir: string,
  skillName: string,
  deps: ValidateDeps = {},
): Promise<SkillResult> {
  const readTextFile = deps.readTextFile ?? Deno.readTextFile;
  const hasTests = deps.hasTests ?? defaultHasTests;
  const runTests = deps.runTests ?? defaultRunTests;

  const content = await readTextFile(join(skillDir, "SKILL.md"));
  const violations = validateContent(content);

  let scriptTests = { ran: false, passed: true, output: "" };
  if (await hasTests(skillDir)) {
    const result = await runTests(skillDir);
    scriptTests = { ran: true, passed: result.passed, output: result.output };
    if (!result.passed) {
      violations.push({ severity: "Critical", check: "C4 scripts", detail: "scripts/ tests failed" });
    }
  }
  return { skill: skillName, violations, scriptTests };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `deno test --allow-read --allow-run --allow-write --allow-env claude/skills/reviewing-skills/scripts/validate-skill.test.ts`
Expected: PASS（29 tests passed）

- [ ] **Step 6: Type-check, format, commit**

```bash
deno check claude/skills/reviewing-skills/scripts/validate-skill.ts
deno fmt claude/skills/reviewing-skills/scripts/validate-skill.ts claude/skills/reviewing-skills/scripts/validate-skill.test.ts
git add claude/skills/reviewing-skills/scripts/validate-skill.ts claude/skills/reviewing-skills/scripts/validate-skill.test.ts claude/skills/reviewing-skills/scripts/fixtures
git commit -m "feat(skills): add validateSkill with Tier-2 script test runner

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: CLI — `skillsDir`, `listSkills`, `main`, entrypoint

**Files:**
- Modify: `claude/skills/reviewing-skills/scripts/validate-skill.ts`
- Modify: `claude/skills/reviewing-skills/scripts/validate-skill.test.ts`

- [ ] **Step 1: Add failing tests**

Update the import in `validate-skill.test.ts` to add `listSkills`:

```typescript
import {
  checkBody,
  checkDescription,
  checkName,
  defaultHasTests,
  defaultRunTests,
  formatResult,
  hasCritical,
  listSkills,
  parseFrontmatter,
  validateContent,
  validateSkill,
} from "./validate-skill.ts";
```

Append (unit test for `listSkills` + two subprocess integration tests that run the CLI with a temp skills dir via `VALIDATE_SKILLS_DIR`):

```typescript
const SCRIPT = new URL("./validate-skill.ts", import.meta.url).pathname;

Deno.test("listSkills: lists dirs with SKILL.md, skips others, sorted", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(tmp, "beta"));
    await Deno.writeTextFile(join(tmp, "beta", "SKILL.md"), "x");
    await Deno.mkdir(join(tmp, "alpha"));
    await Deno.writeTextFile(join(tmp, "alpha", "SKILL.md"), "x");
    await Deno.mkdir(join(tmp, "shared")); // no SKILL.md → skipped
    assertEquals(await listSkills(tmp), ["alpha", "beta"]);
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

async function runCli(args: string[], skillsDir: string) {
  const { code, stdout } = await new Deno.Command("deno", {
    args: ["run", "--allow-read", "--allow-run", "--allow-env", SCRIPT, ...args],
    env: { VALIDATE_SKILLS_DIR: skillsDir },
    stdout: "piped",
    stderr: "piped",
  }).output();
  return { code, out: new TextDecoder().decode(stdout) };
}

Deno.test("CLI: valid skill exits 0 with PASS", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(tmp, "good"));
    await Deno.writeTextFile(join(tmp, "good", "SKILL.md"), VALID_SKILL);
    const { code, out } = await runCli(["good"], tmp);
    assertEquals(code, 0);
    assertEquals(out.includes("good: PASS"), true);
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

Deno.test("CLI: --all exits 1 when any skill has a Critical", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(tmp, "good"));
    await Deno.writeTextFile(join(tmp, "good", "SKILL.md"), VALID_SKILL);
    await Deno.mkdir(join(tmp, "bad"));
    await Deno.writeTextFile(join(tmp, "bad", "SKILL.md"), "# no frontmatter");
    const { code, out } = await runCli(["--all"], tmp);
    assertEquals(code, 1);
    assertEquals(out.includes("bad: FAIL"), true);
    assertEquals(out.includes("good: PASS"), true);
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test --allow-read --allow-run --allow-write --allow-env claude/skills/reviewing-skills/scripts/validate-skill.test.ts`
Expected: FAIL (`listSkills` not exported; CLI subprocess prints nothing / errors).

- [ ] **Step 3: Implement the CLI**

Add `dirname, fromFileUrl` to the path import at the top of `validate-skill.ts`:

```typescript
import { dirname, fromFileUrl, join } from "jsr:@std/path";
```

Append to `validate-skill.ts`:

```typescript
/** Resolve the skills directory: env override (for tests) or relative to this file. */
function skillsDir(): string {
  const override = Deno.env.get("VALIDATE_SKILLS_DIR");
  if (override) return override;
  // this file lives at claude/skills/reviewing-skills/scripts/validate-skill.ts
  return join(dirname(fromFileUrl(import.meta.url)), "..", "..");
}

/** List immediate subdirectories that contain a SKILL.md, sorted. */
export async function listSkills(dir: string): Promise<string[]> {
  const names: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (!entry.isDirectory) continue;
    try {
      await Deno.stat(join(dir, entry.name, "SKILL.md"));
      names.push(entry.name);
    } catch {
      // no SKILL.md (e.g. shared/) → skip
    }
  }
  return names.sort();
}

async function main(): Promise<void> {
  const args = Deno.args;
  const dir = skillsDir();

  let targets: string[];
  if (args[0] === "--all") {
    targets = await listSkills(dir);
  } else if (args[0] && !args[0].startsWith("-")) {
    targets = [args[0]];
  } else {
    console.error("usage: validate-skill <skill-name> | --all");
    Deno.exit(2);
  }

  let failed = 0;
  for (const name of targets) {
    try {
      const result = await validateSkill(join(dir, name), name);
      console.log(formatResult(result));
      if (hasCritical(result.violations)) failed++;
    } catch (e) {
      // fail-closed: a skill we cannot validate counts as a failure.
      console.log(`${name}: FAIL\n  [Critical] E0 validate: ${(e as Error).message}`);
      failed++;
    }
  }
  Deno.exit(failed > 0 ? 1 : 0);
}

if (import.meta.main) {
  await main();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test --allow-read --allow-run --allow-write --allow-env claude/skills/reviewing-skills/scripts/validate-skill.test.ts`
Expected: PASS（32 tests passed）

- [ ] **Step 5: Smoke-test the CLI against the real repo**

Run: `deno run --allow-read --allow-run --allow-env claude/skills/reviewing-skills/scripts/validate-skill.ts --all`
Expected: prints one line per skill; every existing skill shows `PASS` (Warnings allowed). Exit code 0. If any existing skill shows a Critical, STOP and report it (do not "fix" the skill here — note it for follow-up; AC5 expects existing skills to pass Critical).

- [ ] **Step 6: Type-check, lint, format, commit**

```bash
deno check claude/skills/reviewing-skills/scripts/validate-skill.ts
deno lint claude/skills/reviewing-skills/scripts/validate-skill.ts
deno fmt claude/skills/reviewing-skills/scripts/validate-skill.ts claude/skills/reviewing-skills/scripts/validate-skill.test.ts
git add claude/skills/reviewing-skills/scripts/validate-skill.ts claude/skills/reviewing-skills/scripts/validate-skill.test.ts
git commit -m "feat(skills): add validate-skill CLI with --all and fail-closed gate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Wire into `/create-skill` + docs

**Files:**
- Modify: `claude/commands/create-skill.md`
- Modify: `claude/skills/reviewing-skills/SKILL.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Insert the deterministic gate into `/create-skill`**

In `claude/commands/create-skill.md`, find the start of the review phase:

```markdown
## [3/3] レビューと自動修正
```

Insert this new section immediately BEFORE that line:

```markdown
## [2.5/3] 決定論ゲート（validate-skill）

reviewing-skills（定性レビュー）の前に、決定論的なテストゲートを実行する。

```bash
deno run --allow-read --allow-run --allow-env \
  $HOME/.claude/skills/reviewing-skills/scripts/validate-skill.ts <スキル名>
```

- **Critical あり（exit 1）**: 出力された違反（`[Critical] C2 name: ...` 等）を [3/3] の自動修正ループ（最大3回）に渡して修正し、再実行する。Critical が無くなるまで先に進まない（fail-closed）。
- **Critical 無し（exit 0）**: Warning は記録しつつ [3/3] のレビューへ進む。

```

- [ ] **Step 2: Add the deterministic arm to reviewing-skills SKILL.md**

In `claude/skills/reviewing-skills/SKILL.md`, find:

```markdown
### ステップ2: 読み込みと分析

1. 対象のSKILL.mdファイルを完全に読み込む
2. [best-practices.md](references/best-practices.md) でチェックリストを確認
```

Replace with:

```markdown
### ステップ2: 読み込みと分析

1. **決定論ゲートを先に実行**（機械判定可能な項目を自動チェック）:
   `deno run --allow-read --allow-run --allow-env scripts/validate-skill.ts <skill-name>`
   Critical はここで確実に検出される。本スキルは残りの**定性的**項目に集中する。
2. 対象のSKILL.mdファイルを完全に読み込む
3. [best-practices.md](references/best-practices.md) でチェックリストを確認
```

- [ ] **Step 3: Add the boundary note to CLAUDE.md**

In `CLAUDE.md`, find the review-skill guidance block:

```markdown
| コード変更のレビュー | `/review` | バグ・品質・セキュリティの自動チェック |
```

After the table that contains it, locate the end of the `### レビュー系スキルの使い分け` section and append this paragraph at its end (after the last table row of that section):

```markdown

**スキル品質の2層**: `validate-skill`（`reviewing-skills/scripts/`）は決定論的・実行可能なゲート（frontmatter・name・行数・scripts テスト）。`reviewing-skills` は LLM による定性レビュー（「何を/いつ」「例の質」「用語一貫性」）。`/create-skill` は前者をゲート、後者を品質レビューとして両方走らせる。
```

- [ ] **Step 4: Verify docs**

```bash
grep -q "2.5/3" claude/commands/create-skill.md && echo "create-skill OK"
grep -q "決定論ゲート" claude/skills/reviewing-skills/SKILL.md && echo "reviewing-skills OK"
grep -q "スキル品質の2層" CLAUDE.md && echo "CLAUDE.md OK"
```
Expected: all three `OK`.

- [ ] **Step 5: Commit**

```bash
git add claude/commands/create-skill.md claude/skills/reviewing-skills/SKILL.md CLAUDE.md
git commit -m "docs: wire validate-skill gate into create-skill and reviewing-skills

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full validator test suite**

Run: `deno test --allow-read --allow-run --allow-write --allow-env claude/skills/reviewing-skills/scripts/validate-skill.test.ts`
Expected: PASS（32 tests passed）

- [ ] **Step 2: Quality gates**

```bash
deno check claude/skills/reviewing-skills/scripts/validate-skill.ts
deno lint claude/skills/reviewing-skills/scripts/validate-skill.ts
deno fmt --check claude/skills/reviewing-skills/scripts/validate-skill.ts claude/skills/reviewing-skills/scripts/validate-skill.test.ts
```
Expected: all clean.

- [ ] **Step 3: Acceptance — real-repo `--all` audit (AC5)**

Run: `deno run --allow-read --allow-run --allow-env claude/skills/reviewing-skills/scripts/validate-skill.ts --all; echo "exit=$?"`
Expected: every existing skill prints `PASS` (Warnings allowed). If `vcsdd-lite` has scripts tests, they run and pass. Note: if exit=1 due to a pre-existing skill Critical, report it as a finding (out of SP2 scope to fix the offending skill, per spec §12) — but investigate whether it's a validator false-positive first.

- [ ] **Step 4: Acceptance — gate semantics spot-check (AC2/AC3/AC4)**

```bash
# AC2: Critical blocks
deno run --allow-read --allow-run --allow-env claude/skills/reviewing-skills/scripts/validate-skill.ts --all >/dev/null; echo "all exit=$?"
# AC4: failing-script fixture => exit 1 via single-skill mode using env override
VALIDATE_SKILLS_DIR=claude/skills/reviewing-skills/scripts/fixtures \
  deno run --allow-read --allow-run --allow-env \
  claude/skills/reviewing-skills/scripts/validate-skill.ts failing-script; echo "failing-script exit=$?"
```
Expected: `failing-script exit=1` (C4). `passing-script` would be exit 0.

- [ ] **Step 5: Confirm acceptance criteria**

Verify against spec §13:
1. valid skill → PASS/exit 0 ✓ (Step 1 CLI tests + Step 3)
2. structural Criticals → exit 1 ✓ (tests)
3. Warnings don't block ✓ (tests)
4. script test fail → C4/exit 1 ✓ (Step 4)
5. `--all` audit, existing skills Critical 0 ✓ (Step 3)
6. fixtures tests pass ✓ (Step 1)
7. `/create-skill` runs the gate ✓ (Task 6)
8. perms `--allow-read` (+`--allow-run` Tier 2, `--allow-env` override) ✓

Report PASS/FAIL per criterion.

---

## Self-Review (plan author)

- **Spec coverage**: Tier-1 (§4)→T2/T3; Tier-2 (§5)→T4; location/boundary (§6)→T4 path + T6 docs; create-skill integration (§7)→T6; CLI/I-O (§8)→T5; fail-closed (§9)→T5 `main` try/catch + Tier-2 C4; testing/fixtures (§10)→T1-T5; file inventory (§11)→all; scope (§12) respected (no git hook, no --json, no LLM eval); AC (§13)→T7. All covered.
- **Test counts** are cumulative: T1=4, T2=16, T3=22, T4=29, T5=32. These are the expected `deno test` totals after each task.
- **Permissions**: validator runs with `--allow-read --allow-run --allow-env`; Tier-2 spawns `deno test -A` (trusted local skill code). Stated in T4 and §9.
- **DI for testability**: `validateSkill` takes `ValidateDeps` (readTextFile/hasTests/runTests) so Tier-1+gate logic is unit-tested without FS/subprocess; `defaultRunTests`/`defaultHasTests`/CLI are covered by fixture + subprocess tests. `VALIDATE_SKILLS_DIR` env override makes `--all` testable against temp dirs.
- **Open items (spec §15) resolved here**: skills dir = env override else import.meta.url; Tier-2 perms = `-A`; output format = `<skill>: PASS|FAIL` + `  [Severity] check: detail`; `--all` prints one result block per skill.
