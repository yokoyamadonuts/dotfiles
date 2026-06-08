# Skill Catalog (SP4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An advisory skill-health catalog — `catalog-skills.ts` (+ `/skill-catalog`) that aggregates `validate-skill` (Tier-1), `.memory.md`, and filesystem signals across all skills and recommends refine / merge candidates.

**Architecture:** A Deno/TS module of pure functions (keyword extraction, overlap detection, failure-mode counting, recommendation, formatting) plus a DI'd aggregator (`catalogEntry`) and a CLI (`main`, always exit 0). It REUSES `validate-skill.ts` exports (`validateContent`, `parseFrontmatter`, `defaultHasTests`, `listSkills`, `skillsDir`) — no re-implementation of validation. Lives in `reviewing-skills/scripts/` next to `validate-skill.ts`. Uses Tier-1 validation only (no `deno test` subprocess), so it runs with `--allow-read --allow-env` only.

**Tech Stack:** Deno 2.x, `jsr:@std/path`, `jsr:@std/assert`. Same conventions as `validate-skill.ts` (SP2).

**Spec:** `docs/superpowers/specs/2026-06-05-skill-catalog-design.md`

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `claude/skills/reviewing-skills/scripts/catalog-skills.ts` | Catalog: pure helpers + `catalogEntry` + CLI |
| `claude/skills/reviewing-skills/scripts/catalog-skills.test.ts` | Unit (inline/DI) + subprocess integration tests |
| `claude/skills/reviewing-skills/scripts/validate-skill.ts` | MODIFY: export `skillsDir` (1 word) for reuse |
| `claude/commands/skill-catalog.md` | `/skill-catalog` invoker |
| `claude/skills/reviewing-skills/SKILL.md` | Mention catalog as the management view |
| `CLAUDE.md` | Boundary + correspondence row |

Names/signatures (defined where noted): `extractKeywords`, `findOverlaps`, `Overlap` (T1); `countFailureModes`, `recommend`, `Recommend` (T2); `catalogEntry`, `CatalogEntry`, `CatalogDeps` (T3); `formatCatalog`, `main` (T4). Cumulative `deno test` totals: T1=4, T2=7, T3=9, T4=12.

---

## Task 1: Keyword extraction + overlap detection (pure)

**Files:**
- Create: `claude/skills/reviewing-skills/scripts/catalog-skills.ts`
- Create: `claude/skills/reviewing-skills/scripts/catalog-skills.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `catalog-skills.test.ts`:

```typescript
import { assertEquals } from "jsr:@std/assert";
import { extractKeywords, findOverlaps } from "./catalog-skills.ts";

Deno.test("extractKeywords: latin >=4 and katakana runs, minus stopwords", () => {
  const kw = extractKeywords("design-intent", "A design skill. デザイン意図をレビュー。");
  assertEquals(kw.includes("design"), true);
  assertEquals(kw.includes("intent"), true);
  assertEquals(kw.includes("デザイン"), true);
  assertEquals(kw.includes("skill"), false); // stopword
});

Deno.test("extractKeywords: drops latin shorter than 4 chars", () => {
  const kw = extractKeywords("x", "use AI now");
  assertEquals(kw.includes("use"), false); // 3 chars
  assertEquals(kw.includes("now"), false);
});

Deno.test("findOverlaps: flags pairs sharing >=2 keywords", () => {
  const o = findOverlaps([
    { name: "a", keywords: ["design", "system", "color"] },
    { name: "b", keywords: ["design", "system", "video"] },
    { name: "c", keywords: ["video", "audio"] },
  ]);
  assertEquals(o.length, 1);
  assertEquals(o[0].a, "a");
  assertEquals(o[0].b, "b");
  assertEquals([...o[0].shared].sort().join(","), "design,system");
});

Deno.test("findOverlaps: <2 shared not flagged", () => {
  const o = findOverlaps([
    { name: "a", keywords: ["design"] },
    { name: "b", keywords: ["design"] },
  ]);
  assertEquals(o.length, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test claude/skills/reviewing-skills/scripts/catalog-skills.test.ts`
Expected: FAIL (module / exports missing).

- [ ] **Step 3: Write the implementation**

Create `catalog-skills.ts`:

```typescript
// Advisory skill-health catalog (SP4: Management stage).
// Aggregates validate-skill (Tier-1) + .memory.md + filesystem signals across
// all skills and recommends refine / merge candidates. Advisory only: always
// exits 0. Reuses validate-skill.ts exports — no re-implementation of validation.

// Stopwords: latin filler + generic skill vocabulary, and a few katakana terms.
// (Kanji is intentionally NOT extracted, which avoids common-kanji noise.)
const STOPWORDS = new Set([
  "skill",
  "skills",
  "claude",
  "code",
  "this",
  "that",
  "with",
  "from",
  "into",
  "your",
  "when",
  "uses",
  "used",
  "using",
  "リクエスト",
  "スキル",
]);

export type Overlap = { a: string; b: string; shared: string[] };

/** Extract significant keywords: latin words >=4 chars + katakana runs >=3,
 *  lowercased, minus stopwords. Approximate by design (no morphological analysis). */
export function extractKeywords(name: string, description: string): string[] {
  // Split hyphen/underscore in the NAME so kebab ids (design-intent) tokenize
  // into component words; descriptions keep compounds (pull-request) intact.
  const text = `${name.replace(/[-_]/g, " ")} ${description}`.toLowerCase();
  const latin = text.match(/[a-z][a-z0-9-]{3,}/g) ?? [];
  const katakana = text.match(/[゠-ヿ]{3,}/g) ?? [];
  const out = new Set<string>();
  for (const w of [...latin, ...katakana]) {
    if (!STOPWORDS.has(w)) out.add(w);
  }
  return [...out];
}

/** Find skill pairs sharing >= minShared significant keywords (advisory). */
export function findOverlaps(
  entries: { name: string; keywords: string[] }[],
  minShared = 2,
): Overlap[] {
  const out: Overlap[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      const setB = new Set(b.keywords);
      const shared = a.keywords.filter((k) => setB.has(k));
      if (shared.length >= minShared) {
        out.push({ a: a.name, b: b.name, shared });
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test claude/skills/reviewing-skills/scripts/catalog-skills.test.ts`
Expected: PASS（4 tests passed）

- [ ] **Step 5: Type-check, format, commit**

```bash
deno check claude/skills/reviewing-skills/scripts/catalog-skills.ts
deno fmt claude/skills/reviewing-skills/scripts/catalog-skills.ts claude/skills/reviewing-skills/scripts/catalog-skills.test.ts
git add claude/skills/reviewing-skills/scripts/catalog-skills.ts claude/skills/reviewing-skills/scripts/catalog-skills.test.ts
git commit -m "feat(skills): add catalog keyword extraction and overlap detection

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Failure-mode counting + recommendation (pure)

**Files:**
- Modify: `claude/skills/reviewing-skills/scripts/catalog-skills.ts`
- Modify: `claude/skills/reviewing-skills/scripts/catalog-skills.test.ts`

- [ ] **Step 1: Add failing tests**

Update the import line in `catalog-skills.test.ts` to:

```typescript
import {
  countFailureModes,
  extractKeywords,
  findOverlaps,
  recommend,
} from "./catalog-skills.ts";
```

Append:

```typescript
Deno.test("countFailureModes: counts bullets under the heading only", () => {
  const mem = "## ⚠️ Failure Modes\n- a\n- b\n\n## 🔧 Input Quirks\n- c\n";
  assertEquals(countFailureModes(mem), 2);
});

Deno.test("countFailureModes: zero when no Failure Modes section", () => {
  assertEquals(countFailureModes("## Tips\n- x\n- y\n"), 0);
});

Deno.test("recommend: refine on any signal, ok otherwise", () => {
  assertEquals(recommend(0, 0, 0), "ok");
  assertEquals(recommend(0, 1, 0), "refine");
  assertEquals(recommend(1, 0, 0), "refine");
  assertEquals(recommend(0, 0, 3), "refine");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test claude/skills/reviewing-skills/scripts/catalog-skills.test.ts`
Expected: FAIL (`countFailureModes`/`recommend` not exported).

- [ ] **Step 3: Implement**

Append to `catalog-skills.ts`:

```typescript
export type Recommend = "refine" | "ok";

/** Count "- " bullets under the "## ... Failure Modes" heading (until the next "## "). */
export function countFailureModes(memoryContent: string): number {
  let inSection = false;
  let count = 0;
  for (const line of memoryContent.split("\n")) {
    if (/^##\s/.test(line)) {
      inSection = /failure modes/i.test(line);
      continue;
    }
    if (inSection && /^\s*-\s+/.test(line)) count++;
  }
  return count;
}

/** Per-skill recommendation from validation + memory signals. */
export function recommend(
  criticals: number,
  warnings: number,
  failureModes: number,
): Recommend {
  return criticals > 0 || warnings > 0 || failureModes > 0 ? "refine" : "ok";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test claude/skills/reviewing-skills/scripts/catalog-skills.test.ts`
Expected: PASS（7 tests passed）

- [ ] **Step 5: Type-check, format, commit**

```bash
deno check claude/skills/reviewing-skills/scripts/catalog-skills.ts
deno fmt claude/skills/reviewing-skills/scripts/catalog-skills.ts claude/skills/reviewing-skills/scripts/catalog-skills.test.ts
git add claude/skills/reviewing-skills/scripts/catalog-skills.ts claude/skills/reviewing-skills/scripts/catalog-skills.test.ts
git commit -m "feat(skills): add failure-mode counting and recommendation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `catalogEntry` aggregator (reuses validate-skill, DI)

**Files:**
- Modify: `claude/skills/reviewing-skills/scripts/catalog-skills.ts`
- Modify: `claude/skills/reviewing-skills/scripts/catalog-skills.test.ts`

- [ ] **Step 1: Add failing tests**

Update the import block in `catalog-skills.test.ts` to add `catalogEntry`:

```typescript
import {
  catalogEntry,
  countFailureModes,
  extractKeywords,
  findOverlaps,
  recommend,
} from "./catalog-skills.ts";
```

Append:

```typescript
Deno.test("catalogEntry: aggregates signals via DI (memory => refine)", async () => {
  const e = await catalogEntry("/skills", "demo", {
    readTextFile: (p) => {
      const s = String(p);
      if (s.endsWith("SKILL.md")) {
        return Promise.resolve(
          "---\nname: demo\ndescription: A demo design skill. デザイン.\n---\n# Demo\nbody",
        );
      }
      if (s.endsWith(".memory.md")) {
        return Promise.resolve("## ⚠️ Failure Modes\n- a\n- b\n");
      }
      return Promise.reject(new Error("nope"));
    },
    hasTests: () => Promise.resolve(false),
    exists: (p) => Promise.resolve(String(p).endsWith(".memory.md")),
    home: "/home/u",
  });
  assertEquals(e.name, "demo");
  assertEquals(e.criticals, 0);
  assertEquals(e.warnings, 0);
  assertEquals(e.memoryFailureModes, 2);
  assertEquals(e.hasLessons, false);
  assertEquals(e.recommend, "refine");
  assertEquals(e.keywords.includes("design"), true);
});

Deno.test("catalogEntry: clean skill, no memory => ok", async () => {
  const e = await catalogEntry("/skills", "clean", {
    readTextFile: () =>
      Promise.resolve("---\nname: clean\ndescription: A clean skill.\n---\n# Clean\nshort"),
    hasTests: () => Promise.resolve(false),
    exists: () => Promise.resolve(false),
    home: "/home/u",
  });
  assertEquals(e.recommend, "ok");
  assertEquals(e.memoryFailureModes, 0);
  assertEquals(e.hasLessons, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test --allow-read --allow-env claude/skills/reviewing-skills/scripts/catalog-skills.test.ts`
Expected: FAIL (`catalogEntry` not exported).

- [ ] **Step 3: Implement (add imports + the aggregator)**

Add to the TOP of `catalog-skills.ts` (above the STOPWORDS const):

```typescript
import { join } from "jsr:@std/path";
import {
  defaultHasTests,
  parseFrontmatter,
  validateContent,
} from "./validate-skill.ts";
```

Append to `catalog-skills.ts`:

```typescript
export type CatalogEntry = {
  name: string;
  criticals: number;
  warnings: number;
  bodyLines: number;
  hasTests: boolean;
  memoryFailureModes: number;
  hasLessons: boolean;
  keywords: string[];
  recommend: Recommend;
};

export type CatalogDeps = {
  readTextFile?: (path: string | URL) => Promise<string>;
  hasTests?: (skillDir: string) => Promise<boolean>;
  exists?: (path: string) => Promise<boolean>;
  home?: string;
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Aggregate one skill's health signals. Tier-1 validation only (no subprocess). */
export async function catalogEntry(
  skillsRoot: string,
  name: string,
  deps: CatalogDeps = {},
): Promise<CatalogEntry> {
  const readTextFile = deps.readTextFile ?? Deno.readTextFile;
  const hasTests = deps.hasTests ?? defaultHasTests;
  const exists = deps.exists ?? fileExists;
  const home = deps.home ?? Deno.env.get("HOME") ?? "";
  const skillDir = join(skillsRoot, name);

  const content = await readTextFile(join(skillDir, "SKILL.md"));
  const violations = validateContent(content);
  const criticals = violations.filter((v) => v.severity === "Critical").length;
  const warnings = violations.filter((v) => v.severity === "Warning").length;

  const parsed = parseFrontmatter(content);
  const bodyLines = parsed.ok ? parsed.body.split("\n").length : 0;
  const description = parsed.ok ? String(parsed.frontmatter.description ?? "") : "";
  const keywords = extractKeywords(name, description);

  const tests = await hasTests(skillDir);
  const hasLessons = await exists(join(skillDir, "references", "lessons.md"));

  let memoryFailureModes = 0;
  const memPath = home ? join(home, ".claude", "skills", name, ".memory.md") : "";
  if (memPath && (await exists(memPath))) {
    try {
      memoryFailureModes = countFailureModes(await readTextFile(memPath));
    } catch {
      // fail soft: unreadable memory => treat as no failure modes
    }
  }

  return {
    name,
    criticals,
    warnings,
    bodyLines,
    hasTests: tests,
    memoryFailureModes,
    hasLessons,
    keywords,
    recommend: recommend(criticals, warnings, memoryFailureModes),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test --allow-read --allow-env claude/skills/reviewing-skills/scripts/catalog-skills.test.ts`
Expected: PASS（9 tests passed）

- [ ] **Step 5: Type-check, format, commit**

```bash
deno check claude/skills/reviewing-skills/scripts/catalog-skills.ts
deno fmt claude/skills/reviewing-skills/scripts/catalog-skills.ts claude/skills/reviewing-skills/scripts/catalog-skills.test.ts
git add claude/skills/reviewing-skills/scripts/catalog-skills.ts claude/skills/reviewing-skills/scripts/catalog-skills.test.ts
git commit -m "feat(skills): add catalogEntry aggregator reusing validate-skill

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Formatter + CLI (export skillsDir, main, exit 0)

**Files:**
- Modify: `claude/skills/reviewing-skills/scripts/validate-skill.ts` (export `skillsDir`)
- Modify: `claude/skills/reviewing-skills/scripts/catalog-skills.ts`
- Modify: `claude/skills/reviewing-skills/scripts/catalog-skills.test.ts`

- [ ] **Step 1: Export `skillsDir` from validate-skill.ts**

In `claude/skills/reviewing-skills/scripts/validate-skill.ts`, find:

```typescript
/** Resolve the skills directory: env override (for tests) or relative to this file. */
function skillsDir(): string {
```

Change that one line to add `export`:

```typescript
/** Resolve the skills directory: env override (for tests) or relative to this file. */
export function skillsDir(): string {
```

Verify validate-skill is unaffected:
Run: `deno test --allow-read --allow-run --allow-write --allow-env claude/skills/reviewing-skills/scripts/validate-skill.test.ts`
Expected: PASS（37 tests passed） — unchanged.

- [ ] **Step 2: Add failing tests**

Update the import block in `catalog-skills.test.ts` to add `formatCatalog` and `join`:

```typescript
import { join } from "jsr:@std/path";
import {
  catalogEntry,
  countFailureModes,
  extractKeywords,
  findOverlaps,
  formatCatalog,
  recommend,
} from "./catalog-skills.ts";
```

Append:

```typescript
Deno.test("formatCatalog: table + overlap section", () => {
  const out = formatCatalog(
    [{
      name: "alpha",
      criticals: 0,
      warnings: 1,
      bodyLines: 612,
      hasTests: false,
      memoryFailureModes: 0,
      hasLessons: false,
      keywords: ["x"],
      recommend: "refine",
    }],
    [{ a: "alpha", b: "beta", shared: ["design"] }],
  );
  assertEquals(out.includes("alpha"), true);
  assertEquals(out.includes("W1"), true);
  assertEquals(out.includes("refine"), true);
  assertEquals(out.includes("OVERLAP CANDIDATES"), true);
  assertEquals(out.includes("alpha ~ beta"), true);
});

Deno.test("formatCatalog: no overlaps => none", () => {
  const out = formatCatalog([], []);
  assertEquals(out.includes("OVERLAP CANDIDATES: none"), true);
});

const SCRIPT = new URL("./catalog-skills.ts", import.meta.url).pathname;

Deno.test("CLI: lists skills and exits 0 (advisory)", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(tmp, "alpha"));
    await Deno.writeTextFile(
      join(tmp, "alpha", "SKILL.md"),
      "---\nname: alpha\ndescription: Alpha skill.\n---\n# Alpha\nbody",
    );
    const { code, stdout } = await new Deno.Command("deno", {
      args: ["run", "--allow-read", "--allow-env", SCRIPT],
      env: { VALIDATE_SKILLS_DIR: tmp },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const out = new TextDecoder().decode(stdout);
    assertEquals(code, 0);
    assertEquals(out.includes("alpha"), true);
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `deno test --allow-read --allow-run --allow-write --allow-env claude/skills/reviewing-skills/scripts/catalog-skills.test.ts`
Expected: FAIL (`formatCatalog` not exported; CLI prints nothing).

- [ ] **Step 4: Implement formatter + CLI**

Add `listSkills, skillsDir` to the validate-skill import at the top of `catalog-skills.ts`:

```typescript
import {
  defaultHasTests,
  listSkills,
  parseFrontmatter,
  skillsDir,
  validateContent,
} from "./validate-skill.ts";
```

Append to `catalog-skills.ts`:

```typescript
/** Render the catalog as a human-readable table + overlap section. */
export function formatCatalog(entries: CatalogEntry[], overlaps: Overlap[]): string {
  const lines: string[] = [];
  lines.push(
    `${"SKILL".padEnd(30)} ${"VAL".padEnd(5)} ${"LINES".padStart(5)} TEST MEM LESS  REC`,
  );
  for (const e of entries) {
    const val = e.criticals > 0
      ? `C${e.criticals}`
      : e.warnings > 0
      ? `W${e.warnings}`
      : "ok";
    lines.push(
      `${e.name.padEnd(30)} ${val.padEnd(5)} ${String(e.bodyLines).padStart(5)} ` +
        `${e.hasTests ? "yes" : "no "}  ${String(e.memoryFailureModes).padStart(3)} ` +
        `${e.hasLessons ? "yes" : "no "}  ${e.recommend}`,
    );
  }
  lines.push("");
  if (overlaps.length === 0) {
    lines.push("OVERLAP CANDIDATES: none");
  } else {
    lines.push("OVERLAP CANDIDATES (advisory — human judges):");
    for (const o of overlaps) {
      lines.push(`  ${o.a} ~ ${o.b}  (shared: ${o.shared.join(", ")})`);
    }
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const dir = skillsDir();
  const names = await listSkills(dir);
  const entries: CatalogEntry[] = [];
  for (const name of names) {
    try {
      entries.push(await catalogEntry(dir, name));
    } catch (e) {
      // advisory: skip skills we can't read, note on stderr.
      console.error(`skip ${name}: ${(e as Error).message}`);
    }
  }
  const overlaps = findOverlaps(
    entries.map((e) => ({ name: e.name, keywords: e.keywords })),
  );
  console.log(formatCatalog(entries, overlaps));
  // advisory only — always exit 0 (no Deno.exit needed).
}

if (import.meta.main) {
  await main();
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `deno test --allow-read --allow-run --allow-write --allow-env claude/skills/reviewing-skills/scripts/catalog-skills.test.ts`
Expected: PASS（12 tests passed）

- [ ] **Step 6: Smoke-test against the real repo**

Run: `deno run --allow-read --allow-env claude/skills/reviewing-skills/scripts/catalog-skills.ts; echo "exit=$?"`
Expected: a table of all skills + an OVERLAP CANDIDATES section, `exit=0`. Confirm `figma-design-ops`, `vcsdd-lite`, `zundamon-video` show `W1` and `refine` (they are >500 lines). Paste the output.

- [ ] **Step 7: Type-check, lint, format, commit**

```bash
deno check claude/skills/reviewing-skills/scripts/catalog-skills.ts
deno lint claude/skills/reviewing-skills/scripts/catalog-skills.ts claude/skills/reviewing-skills/scripts/catalog-skills.test.ts
deno fmt claude/skills/reviewing-skills/scripts/catalog-skills.ts claude/skills/reviewing-skills/scripts/catalog-skills.test.ts claude/skills/reviewing-skills/scripts/validate-skill.ts
git add claude/skills/reviewing-skills/scripts/catalog-skills.ts claude/skills/reviewing-skills/scripts/catalog-skills.test.ts claude/skills/reviewing-skills/scripts/validate-skill.ts
git commit -m "feat(skills): add catalog formatter and CLI; export skillsDir

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `/skill-catalog` command + docs

**Files:**
- Create: `claude/commands/skill-catalog.md`
- Modify: `claude/skills/reviewing-skills/SKILL.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Create the command**

Create `claude/commands/skill-catalog.md` with EXACTLY this content:

````markdown
---
description: "全スキルの健全性カタログを表示。validate-skill + .memory.md + fs を集約し refine/merge 候補を advisory に提示。"
argument-hint: ""
---

# /skill-catalog - スキル健全性カタログ

全スキルの健全性を一望し、手を入れるべきスキルを示す（advisory・非破壊・常に exit 0）。

> **依存**: `validate-skill`（SP2, Tier-1 を再利用）, `.memory.md`（SP1）, アクション先は `/refine-skill`（SP3）。

## 実行

```bash
deno run --allow-read --allow-env \
  $HOME/.claude/skills/reviewing-skills/scripts/catalog-skills.ts
```

出力: スキル別の validate / 行数 / tests / memory(Failure Modes 数) / lessons ＋推奨（refine / ok）＋ OVERLAP CANDIDATES。

## 推奨の扱い

- **refine**: `/refine-skill <name>` で改善する（SP3）。
- **merge? 候補（OVERLAP）**: 人が判断する。重複なら手動でマージ。ヒューリスティックは過検出ありうる前提。
- カタログは「地図」。破壊的アクションはしない。
````

- [ ] **Step 2: Add catalog mention to reviewing-skills SKILL.md**

In `claude/skills/reviewing-skills/SKILL.md`, find the line (added in SP2):
```markdown
1. **決定論ゲートを先に実行**（機械判定可能な項目を自動チェック）:
   `deno run --allow-read --allow-run --allow-env scripts/validate-skill.ts <skill-name>`
   Critical はここで確実に検出される。本スキルは残りの**定性的**項目に集中する。
```
Immediately AFTER that numbered item (item 1), insert a new note paragraph (not a list item), indented to align under the list:
```markdown

   関連: 全スキルの健全性を一望するには `scripts/catalog-skills.ts`（`/skill-catalog`）。どのスキルを refine すべきかの advisory な地図を出す（非破壊・常に exit 0）。
```

- [ ] **Step 3: Add the correspondence row + boundary to CLAUDE.md**

In `CLAUDE.md`, find the `### Skills vs Commands (関係性ガイド)` table and the `/refine-skill` row added in SP3:
```markdown
| `/refine-skill` | `refining-skills` | 既存スキルの経験駆動改善（validate-skill + .memory.md） |
```
Add this row immediately after it:
```markdown
| `/skill-catalog` | （スクリプト直接） | 全スキルの健全性カタログ（advisory・refine/merge 候補） |
```

Then find the `**スキルのライフサイクル**:` paragraph (added in SP3) and append this sentence to the END of that same paragraph (before the paragraph's closing — i.e., add after the last sentence "改善は編集までで、確定は `/commit`。"):
```markdown
 全スキルの健全性は `/skill-catalog`（`catalog-skills.ts`, advisory・非破壊・常に exit 0）で一望でき、refine 推奨や重複候補を示す。
```

- [ ] **Step 4: Verify docs**

```bash
test -f claude/commands/skill-catalog.md && echo "command OK"
grep -q "catalog-skills.ts" claude/skills/reviewing-skills/SKILL.md && echo "reviewing-skills OK"
grep -q "skill-catalog" CLAUDE.md && echo "CLAUDE.md OK"
```
Expected: all three OK.

- [ ] **Step 5: Commit**

```bash
git add claude/commands/skill-catalog.md claude/skills/reviewing-skills/SKILL.md CLAUDE.md
git commit -m "docs: add /skill-catalog command and document the management view

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full catalog test suite**

Run: `deno test --allow-read --allow-run --allow-write --allow-env claude/skills/reviewing-skills/scripts/catalog-skills.test.ts`
Expected: PASS（12 tests passed）

- [ ] **Step 2: validate-skill still green (skillsDir export is non-breaking)**

Run: `deno test --allow-read --allow-run --allow-write --allow-env claude/skills/reviewing-skills/scripts/validate-skill.test.ts`
Expected: PASS（37 tests passed）

- [ ] **Step 3: Quality gates**

```bash
deno check claude/skills/reviewing-skills/scripts/catalog-skills.ts
deno lint claude/skills/reviewing-skills/scripts/catalog-skills.ts claude/skills/reviewing-skills/scripts/catalog-skills.test.ts
deno fmt --check claude/skills/reviewing-skills/scripts/catalog-skills.ts claude/skills/reviewing-skills/scripts/catalog-skills.test.ts claude/skills/reviewing-skills/scripts/validate-skill.ts
```
Expected: all clean.

- [ ] **Step 4: reviewing-skills still PASSes its own gate (now runs BOTH test suites)**

Run: `deno run --allow-read --allow-run --allow-env claude/skills/reviewing-skills/scripts/validate-skill.ts reviewing-skills; echo "exit=$?"`
Expected: `reviewing-skills: PASS`, `exit=0`. (Tier-2 now runs validate-skill.test.ts AND catalog-skills.test.ts — both must pass. The `--ignore fixtures` still applies.)

- [ ] **Step 5: Whole-repo audit + catalog on real repo (AC6)**

```bash
deno run --allow-read --allow-run --allow-env claude/skills/reviewing-skills/scripts/validate-skill.ts --all; echo "validate exit=$?"
deno run --allow-read --allow-env claude/skills/reviewing-skills/scripts/catalog-skills.ts; echo "catalog exit=$?"
```
Expected: validate `--all` all PASS, exit 0. catalog prints the full table + overlaps, exit 0. Confirm the 3 long skills show `refine`.

- [ ] **Step 6: Confirm acceptance criteria (spec §13)**

Verify each AC 1-8:
1. catalog lists all skills with validate/lines/tests/memory/lessons — Step 5 ✓
2. refine recommended for Warnings/Failure Modes — Step 5 (3 long skills) ✓
3. overlap candidates shown (advisory) — Step 5 ✓
4. reuses validate-skill exports — code imports ✓
5. exit 0 always — Steps 5/1 ✓
6. all 38 existing skills appear; 3 W1 skills → refine — Step 5 ✓
7. tests pass + check/lint/fmt clean — Steps 1-3 ✓
8. boundary in CLAUDE.md, no usage-tracking/auto-actions — Task 5 + code ✓

Report PASS/FAIL per criterion.

---

## Self-Review (plan author)

- **Spec coverage**: signals (§4)→T3 catalogEntry; recommendation (§5)→T2 recommend; overlap (§6)→T1; reuse/testability (§7)→T3/T4 imports + DI; CLI (§8)→T4 (exit 0); boundary (§9)→T5 docs; testing (§10)→T1-T4; files (§11)→all; scope (§12) respected (no usage-tracking, no auto-actions, no --json); AC (§13)→T6. All covered.
- **Cumulative test counts**: T1=4, T2=7, T3=9, T4=12. Stated per task.
- **Reuse / DRY**: imports `validateContent`, `parseFrontmatter`, `defaultHasTests`, `listSkills`, `skillsDir` from validate-skill.ts. `skillsDir` is newly exported (T4 Step 1, non-breaking, re-verified by validate-skill's 37 tests).
- **Least privilege**: catalog uses Tier-1 only (no `deno test` subprocess) → runs with `--allow-read --allow-env` (no `--allow-run`). Test file needs broader perms for its own subprocess test (that's the runner, not the script).
- **Placeholders**: full code in every step; CLAUDE.md/SKILL.md edits give exact anchors + text.
- **Type consistency**: `CatalogEntry`/`Overlap`/`Recommend`/`CatalogDeps` defined once and reused; `catalogEntry(skillsRoot, name, deps)` 3-arg consistent in tests + main; `recommend(criticals, warnings, failureModes)` 3-arg consistent.
- **Dogfood/no-regression**: adding catalog-skills.test.ts makes validating reviewing-skills run both suites (T6 Step 4); skillsDir export re-verified (T6 Step 2).
- **Open items (spec §15)**: stopword list + threshold (=2) chosen here; failure-mode parse = bullets under "Failure Modes" heading; table format defined in formatCatalog; imports are function-level.
