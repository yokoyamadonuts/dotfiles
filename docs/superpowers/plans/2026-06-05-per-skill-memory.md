# Per-Skill Memory (SP1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 各スキルに任意の `.memory.md`（私的・gitignore）を持たせ、そのスキル使用時に PostToolUse フックが内容を自動注入する仕組みを TDD で実装する。

**Architecture:** 1 本の Deno フック `claude/hooks/skill-memory.ts` が `Skill` ツール使用後に発火し、`tool_input.skill` から `~/.claude/skills/<name>/.memory.md` を解決・読込し、`hookSpecificOutput.additionalContext` として注入する。プラグイン名前空間付きスキル・ファイル無し・各種エラーは全て fail open（no-op）。書込は CLAUDE.md 規約、昇格は `references/lessons.md`（手動）。

**Tech Stack:** Deno 2.x（TypeScript）、`jsr:@std/path`、`jsr:@std/assert`（テスト）、`jq`（settings 検証）。

**設計書:** [docs/superpowers/specs/2026-06-05-per-skill-memory-design.md](../specs/2026-06-05-per-skill-memory-design.md)

---

## File Structure

| パス | 責務 | 種別 |
|------|------|------|
| `claude/hooks/skill-memory.ts` | フック本体（純粋関数 + stdin/stdout glue） | 新規 |
| `claude/hooks/skill-memory.test.ts` | ユニット + 統合テスト | 新規 |
| `claude/hooks/types.ts` | `SkillToolParams` 型を追加 | 変更 |
| `claude/settings.json` | `PostToolUse` に `Skill` matcher 追加 | 変更 |
| `.gitignore`（root） | `claude/skills/*/.memory.md` を追加 | 変更 |
| `CLAUDE.md` | per-skill メモリの書込規約・境界・昇格を追記 | 変更 |
| `claude/skills/shared/references/memory-template.md` | `.memory.md` の正準テンプレ | 新規 |

`install.sh` は変更不要（`~/.claude/hooks` と `~/.claude/settings.json` は既にシンボリックリンク済みで、新ファイルは自動的に対象になる）。

---

## Task 1: Pure helpers — `memoryPath` と `truncate`

**Files:**
- Create: `claude/hooks/skill-memory.ts`
- Test: `claude/hooks/skill-memory.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

Create `claude/hooks/skill-memory.test.ts`:

```typescript
import { assertEquals } from "jsr:@std/assert";
import { MAX_INJECT_LINES, memoryPath, truncate } from "./skill-memory.ts";

Deno.test("memoryPath: repo-local skill resolves under ~/.claude/skills", () => {
  assertEquals(
    memoryPath("pptx", "/home/u"),
    "/home/u/.claude/skills/pptx/.memory.md",
  );
});

Deno.test("memoryPath: plugin-namespaced skill returns null", () => {
  assertEquals(memoryPath("superpowers:brainstorming", "/home/u"), null);
});

Deno.test("memoryPath: empty skill returns null", () => {
  assertEquals(memoryPath("", "/home/u"), null);
});

Deno.test("truncate: text within limit is unchanged", () => {
  assertEquals(truncate("a\nb\nc", MAX_INJECT_LINES, "/p/.memory.md"), "a\nb\nc");
});

Deno.test("truncate: oversized text is capped with a marker", () => {
  const text = Array.from({ length: 250 }, (_, i) => `L${i}`).join("\n");
  const out = truncate(text, MAX_INJECT_LINES, "/p/.memory.md");
  const lines = out.split("\n");
  assertEquals(lines[0], "L0");
  assertEquals(lines[MAX_INJECT_LINES - 1], `L${MAX_INJECT_LINES - 1}`);
  assertEquals(out.includes("(truncated; full memory at /p/.memory.md)"), true);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `deno test claude/hooks/skill-memory.test.ts`
Expected: FAIL — `Module not found "./skill-memory.ts"`（まだ本体が無い）

- [ ] **Step 3: 最小実装を書く**

Create `claude/hooks/skill-memory.ts`:

```typescript
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
  return `${lines.slice(0, maxLines).join("\n")}\n\n(truncated; full memory at ${path})`;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `deno test claude/hooks/skill-memory.test.ts`
Expected: PASS（5 tests passed）

- [ ] **Step 5: フォーマット & コミット**

```bash
deno fmt claude/hooks/skill-memory.ts claude/hooks/skill-memory.test.ts
git add claude/hooks/skill-memory.ts claude/hooks/skill-memory.test.ts
git commit -m "feat(hooks): add skill-memory path resolution and truncation helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Memory loading — `loadMemoryContext` と `buildOutput`

**Files:**
- Modify: `claude/hooks/types.ts`
- Modify: `claude/hooks/skill-memory.ts`
- Test: `claude/hooks/skill-memory.test.ts`

- [ ] **Step 1: 失敗するテストを追加**

First, **update the existing import line** at the top of `claude/hooks/skill-memory.test.ts` to add the new symbols (do not add a second import from the same module):

```typescript
import {
  buildOutput,
  loadMemoryContext,
  MAX_INJECT_LINES,
  memoryPath,
  truncate,
} from "./skill-memory.ts";
```

Then append these tests:

```typescript
Deno.test("loadMemoryContext: returns formatted context for existing memory", async () => {
  const ctx = await loadMemoryContext("pptx", {
    home: "/home/u",
    readTextFile: () => Promise.resolve("## Tips\n- resize images to 1280px"),
  });
  assertEquals(ctx?.includes("Skill memory: pptx"), true);
  assertEquals(ctx?.includes("- resize images to 1280px"), true);
});

Deno.test("loadMemoryContext: missing file fails open (null)", async () => {
  const ctx = await loadMemoryContext("pptx", {
    home: "/home/u",
    readTextFile: () => Promise.reject(new Deno.errors.NotFound("nope")),
  });
  assertEquals(ctx, null);
});

Deno.test("loadMemoryContext: plugin-namespaced skill no-ops (null)", async () => {
  const ctx = await loadMemoryContext("anthropic-skills:docx", {
    home: "/home/u",
    readTextFile: () => Promise.resolve("must not be read"),
  });
  assertEquals(ctx, null);
});

Deno.test("loadMemoryContext: whitespace-only memory returns null", async () => {
  const ctx = await loadMemoryContext("pptx", {
    home: "/home/u",
    readTextFile: () => Promise.resolve("   \n  \n"),
  });
  assertEquals(ctx, null);
});

Deno.test("buildOutput: produces PostToolUse additionalContext JSON", () => {
  const json = JSON.parse(buildOutput("hello"));
  assertEquals(json.hookSpecificOutput.hookEventName, "PostToolUse");
  assertEquals(json.hookSpecificOutput.additionalContext, "hello");
  assertEquals(json.suppressOutput, true);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `deno test claude/hooks/skill-memory.test.ts`
Expected: FAIL — `loadMemoryContext`/`buildOutput` が export されていない

- [ ] **Step 3: `SkillToolParams` 型を types.ts に追加**

Append to `claude/hooks/types.ts` (before the final `// Generic tool params type` comment, or at end of file):

```typescript
// Skill tool parameters (used by the skill-memory PostToolUse hook)
export type SkillToolParams = {
  skill: string;
  args?: string;
};
```

- [ ] **Step 4: `loadMemoryContext` と `buildOutput` を実装**

Append to `claude/hooks/skill-memory.ts`:

```typescript
type LoadDeps = {
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
```

- [ ] **Step 5: テストが通ることを確認**

Run: `deno test claude/hooks/skill-memory.test.ts`
Expected: PASS（10 tests passed）

- [ ] **Step 6: 型チェック & フォーマット & コミット**

```bash
deno check claude/hooks/skill-memory.ts
deno fmt claude/hooks/skill-memory.ts claude/hooks/skill-memory.test.ts claude/hooks/types.ts
git add claude/hooks/skill-memory.ts claude/hooks/skill-memory.test.ts claude/hooks/types.ts
git commit -m "feat(hooks): load and format per-skill memory for injection

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Request handling + entrypoint — `handle` と `main`

**Files:**
- Modify: `claude/hooks/skill-memory.ts`
- Test: `claude/hooks/skill-memory.test.ts`

- [ ] **Step 1: 失敗するユニット + 統合テストを追加**

First, **replace the import block** at the top of `claude/hooks/skill-memory.test.ts` with this (adds `handle` and `join`):

```typescript
import { assertEquals } from "jsr:@std/assert";
import { join } from "jsr:@std/path";
import {
  buildOutput,
  handle,
  loadMemoryContext,
  MAX_INJECT_LINES,
  memoryPath,
  truncate,
} from "./skill-memory.ts";
```

Then append these tests:

```typescript
Deno.test("handle: non-Skill tool no-ops (null)", async () => {
  const out = await handle(
    { tool_name: "Bash", tool_input: { skill: "pptx" } },
    { home: "/home/u", readTextFile: () => Promise.resolve("x") },
  );
  assertEquals(out, null);
});

Deno.test("handle: Skill tool with memory returns JSON output", async () => {
  const out = await handle(
    { tool_name: "Skill", tool_input: { skill: "pptx" } },
    { home: "/home/u", readTextFile: () => Promise.resolve("## Tips\n- note") },
  );
  assertEquals(out !== null, true);
  assertEquals(JSON.parse(out!).hookSpecificOutput.additionalContext.includes("note"), true);
});

Deno.test("handle: Skill tool without memory returns null", async () => {
  const out = await handle(
    { tool_name: "Skill", tool_input: { skill: "pptx" } },
    { home: "/home/u", readTextFile: () => Promise.reject(new Deno.errors.NotFound("x")) },
  );
  assertEquals(out, null);
});

Deno.test("integration: happy path injects memory via stdin/stdout", async () => {
  const tmp = await Deno.makeTempDir();
  try {
    const skillDir = join(tmp, ".claude", "skills", "demoskill");
    await Deno.mkdir(skillDir, { recursive: true });
    await Deno.writeTextFile(join(skillDir, ".memory.md"), "## Tips\n- demo note");

    const child = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-env",
        "--allow-read",
        new URL("./skill-memory.ts", import.meta.url).pathname,
      ],
      env: { HOME: tmp },
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    }).spawn();

    const writer = child.stdin.getWriter();
    await writer.write(
      new TextEncoder().encode(
        JSON.stringify({ tool_name: "Skill", tool_input: { skill: "demoskill" } }),
      ),
    );
    await writer.close();

    const { code, stdout } = await child.output();
    assertEquals(code, 0);
    const json = JSON.parse(new TextDecoder().decode(stdout));
    assertEquals(json.hookSpecificOutput.additionalContext.includes("demo note"), true);
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
});

Deno.test("integration: malformed stdin fails open (exit 0, no stdout)", async () => {
  const child = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-env",
      "--allow-read",
      new URL("./skill-memory.ts", import.meta.url).pathname,
    ],
    env: { HOME: "/tmp" },
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();

  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode("not json{{"));
  await writer.close();

  const { code, stdout } = await child.output();
  assertEquals(code, 0);
  assertEquals(new TextDecoder().decode(stdout).trim(), "");
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `deno test --allow-run --allow-read --allow-write --allow-env claude/hooks/skill-memory.test.ts`
Expected: FAIL — `handle` が export されていない

- [ ] **Step 3: `handle` と `main` を実装**

First, **add the type import at the top** of `claude/hooks/skill-memory.ts`, directly below the existing `import { join } from "jsr:@std/path";` line:

```typescript
import type { PostToolUseHookData, SkillToolParams } from "./types.ts";
```

Then **append the handler and entrypoint at the end** of the file:

```typescript
/**
 * Core request handler. Returns the JSON string to print to stdout, or `null`
 * when nothing should be emitted (non-Skill tool, no skill name, no memory).
 */
export async function handle(
  data: Partial<PostToolUseHookData<SkillToolParams>>,
  deps: LoadDeps = {},
): Promise<string | null> {
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
```

最終的な `claude/hooks/skill-memory.ts` の import 構成は次の3行（先頭）になる:

```typescript
import { join } from "jsr:@std/path";
import type { PostToolUseHookData, SkillToolParams } from "./types.ts";
```

- [ ] **Step 4: テストが通ることを確認**

Run: `deno test --allow-run --allow-read --allow-write --allow-env claude/hooks/skill-memory.test.ts`
Expected: PASS（15 tests passed）

- [ ] **Step 5: 型チェック & lint & フォーマット**

```bash
deno check claude/hooks/skill-memory.ts
deno lint claude/hooks/skill-memory.ts
deno fmt claude/hooks/skill-memory.ts claude/hooks/skill-memory.test.ts
```
Expected: いずれもエラーなし

- [ ] **Step 6: コミット**

```bash
git add claude/hooks/skill-memory.ts claude/hooks/skill-memory.test.ts
git commit -m "feat(hooks): add skill-memory request handler and entrypoint

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: フックを settings.json に登録

**Files:**
- Modify: `claude/settings.json`

- [ ] **Step 1: PostToolUse に Skill matcher を追加**

Edit `claude/settings.json`. Match this exact block:

```json
            "command": "deno run --allow-env --allow-run --allow-read --allow-write $GHQ_ROOT/github.com/skanehira/dotfiles/claude/hooks/format.ts"
          }
        ]
      }
    ],
```

Replace with:

```json
            "command": "deno run --allow-env --allow-run --allow-read --allow-write $GHQ_ROOT/github.com/skanehira/dotfiles/claude/hooks/format.ts"
          }
        ]
      },
      {
        "matcher": "Skill",
        "hooks": [
          {
            "type": "command",
            "command": "deno run --allow-env --allow-read $GHQ_ROOT/github.com/skanehira/dotfiles/claude/hooks/skill-memory.ts"
          }
        ]
      }
    ],
```

- [ ] **Step 2: JSON が壊れていないこと & エントリ存在を検証**

Run:
```bash
jq '.hooks.PostToolUse | length' claude/settings.json
```
Expected: `2`

Run:
```bash
jq -r '.hooks.PostToolUse[] | select(.matcher=="Skill") | .hooks[0].command' claude/settings.json
```
Expected: `deno run --allow-env --allow-read $GHQ_ROOT/github.com/skanehira/dotfiles/claude/hooks/skill-memory.ts`

- [ ] **Step 3: コミット**

```bash
git add claude/settings.json
git commit -m "feat(hooks): register skill-memory PostToolUse hook on Skill tool

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: 私的メモリを gitignore

**Files:**
- Modify: `.gitignore`（repo root）

- [ ] **Step 1: gitignore パターンを追加**

Edit `.gitignore`. Match:

```
.DS_Store
```

Replace with:

```
.DS_Store

# per-skill メモリは私的な作業領域として除外（普遍的教訓は references/lessons.md へ昇格）
claude/skills/*/.memory.md
```

- [ ] **Step 2: 無視が効くことを検証**

Run:
```bash
mkdir -p claude/skills/pptx && touch claude/skills/pptx/.memory.md
git check-ignore claude/skills/pptx/.memory.md
```
Expected: `claude/skills/pptx/.memory.md`（＝無視対象として一致）

Run（後始末。`pptx` ディレクトリが他で使われていなければ削除。`.memory.md` のみ作った場合は安全に消す）:
```bash
rm claude/skills/pptx/.memory.md
rmdir claude/skills/pptx 2>/dev/null || true
```

- [ ] **Step 3: コミット**

```bash
git add .gitignore
git commit -m "chore: gitignore per-skill .memory.md files

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: メモリテンプレ + CLAUDE.md 規約・境界・昇格

**Files:**
- Create: `claude/skills/shared/references/memory-template.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: 正準テンプレを作成**

Create `claude/skills/shared/references/memory-template.md` with this exact content (the example uses a 4-space-indented code block, so there are no nested fences to escape):

```markdown
# `.memory.md` テンプレート

各スキルの `claude/skills/<name>/.memory.md` はこの形式に従う。
ファイル自体は gitignore 対象（私的・マシンローカル）。全セクション任意。

下記をコピーして使う（先頭の `---` ブロックは YAML フロントマター）:

    ---
    skill: <skill-name>
    updated: YYYY-MM-DD
    uses: 0
    ---

    ## ⚠️ Failure Modes
    - [YYYY-MM-DD] <何が失敗したか> → <原因と回避策>

    ## 🔧 Input Quirks
    - <特別な前処理が要る入力パターン>

    ## 💡 Tips
    - <結果が改善した非自明な使い方>

    ## ⬆️ Promotion Candidates
    - <普遍的で references/lessons.md へ昇格すべき教訓>
```

- [ ] **Step 2: CLAUDE.md に per-skill メモリ節を追加**

Edit `CLAUDE.md`. Match this exact block:

```markdown
### Creating New Skills

1. Create `claude/skills/<skill-name>/SKILL.md`
2. Define triggers, workflow, and expected output
3. Run `cd claude && ./install.sh` to deploy
```

Replace with:

```markdown
### Creating New Skills

1. Create `claude/skills/<skill-name>/SKILL.md`
2. Define triggers, workflow, and expected output
3. Run `cd claude && ./install.sh` to deploy

### Per-Skill Memory (`.memory.md`)

各スキルは任意の `claude/skills/<name>/.memory.md`（gitignore・私的）に「そのスキル固有の運用知識」を蓄積する。MUSE-Autoskill の per-skill メモリをこの repo に適用したもの。

**読み込み（自動）**: `skill-memory.ts` フックがスキル使用時に該当 `.memory.md` を自動注入する。手動操作は不要。

**書き込み（規約・あなたの判断）**: スキル使用後、そのスキル**固有の**以下を見つけたら `.memory.md` に日付付きで追記する（テンプレ: `claude/skills/shared/references/memory-template.md`）:
- スキルが失敗し、原因と回避策を特定した（→ Failure Modes）
- 入力に特別な前処理が必要だった（→ Input Quirks）
- 非自明なより良い使い方を見つけた（→ Tips）

記録しない: 一度きりの些末事、スキルと無関係な一般知識。

**agent-memory との境界**:
- *スキル自身の挙動・癖* → `.memory.md`（例: 「pptx は macOS でフォント埋込が落ちる」）
- *問題・ドメイン・プロジェクト知識* → `agent-memory`（例: 「Issue #123 の JWT 調査結果」）

**昇格（手動）**: `.memory.md` の `Promotion Candidates` が複数タスクで再現し普遍的と確認できたら、`claude/skills/<name>/references/lessons.md`（committed）へ移し、`.memory.md` からは削除する。SKILL.md 本体には足さない（`reviewing-skills` の 500 行制限を圧迫しないため）。
```

> **learning mode のユーザー貢献ポイント**: 上の「書き込み（規約）」の "記録すべき/しない" 基準は、運用者の判断（記録過多 vs 記録漏れのトレードオフ）が最も反映される箇所。実行時、この 5–10 行をユーザー自身に書いてもらう・調整してもらうのが理想。計画としては上記の完全な既定文面を採用し、ユーザーの上書きは任意とする。

- [ ] **Step 3: 検証（壊れていないこと）**

Run:
```bash
test -f claude/skills/shared/references/memory-template.md && echo "template OK"
grep -q "Per-Skill Memory" CLAUDE.md && echo "CLAUDE.md OK"
```
Expected: `template OK` と `CLAUDE.md OK` の両方

- [ ] **Step 4: コミット**

```bash
git add claude/skills/shared/references/memory-template.md CLAUDE.md
git commit -m "docs: add per-skill memory convention, boundary, and template

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: 最終検証（全スイート + 受け入れ基準）

**Files:** なし（検証のみ）

- [ ] **Step 1: 全テスト通過を確認**

Run: `deno test --allow-run --allow-read --allow-write --allow-env claude/hooks/skill-memory.test.ts`
Expected: PASS（15 tests passed）

- [ ] **Step 2: 型 & lint & フォーマット確認**

Run:
```bash
deno check claude/hooks/skill-memory.ts
deno lint claude/hooks/
deno fmt --check claude/hooks/
```
Expected: いずれもエラーなし（fmt 差分が出たら `deno fmt claude/hooks/` で修正し再確認）

- [ ] **Step 3: 受け入れ基準チェックリスト（設計書 §13）**

設計書の受け入れ基準に対し、各々どのタスク/テストが満たすか確認:

- [ ] AC1 メモリ注入: integration「happy path」テストで実証
- [ ] AC2 メモリ無しで従来動作: `loadMemoryContext: missing file fails open` + `handle: ...without memory returns null`
- [ ] AC3 プラグインで no-op: `loadMemoryContext: plugin-namespaced skill no-ops`
- [ ] AC4 gitignore: Task 5 Step 2 の `git check-ignore` で実証
- [ ] AC5 T1–T6: 全テスト PASS
- [ ] AC6 CLAUDE.md に規約・境界: Task 6 Step 3 の grep
- [ ] AC7 最小権限: settings.json の command が `--allow-env --allow-read` のみ（Task 4 Step 2 の jq 出力で確認）

- [ ] **Step 4: 差分が出た場合のみコミット**

```bash
# fmt 修正など未コミット差分がある場合のみ
git add -A && git commit -m "chore: finalize per-skill memory (SP1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review（プラン作成者によるチェック）

**1. Spec coverage（設計書 §ごと）:**
- §4 データモデル → Task 6（テンプレ）+ Task 5（gitignore）
- §5 読込フック → Task 1–3（helpers / load / handle・main）+ Task 4（登録）
- §6 書込規約 → Task 6（CLAUDE.md）
- §7 昇格パス → Task 6（CLAUDE.md 昇格節）
- §8 境界 → Task 6（CLAUDE.md 境界表）
- §9 エラー処理 → fail open（loadMemoryContext catch / main catch）+ stderr ログ
- §10 テスト T1–T6 → Task 1–3 の各テスト（T1 happy, T2 missing, T3 plugin, T4 malformed stdin, T5 truncate, T6 non-Skill）
- §11 ファイル一覧 → 全タスクで網羅
- §13 受け入れ基準 → Task 7
- ギャップ: なし

**2. Placeholder scan:** "TBD"/"TODO"/"後で" なし。全 step に実コード/実コマンド/期待出力あり。

**3. Type consistency:** `memoryPath(skill, home)`, `truncate(text, maxLines, path)`, `loadMemoryContext(skill, deps)`, `buildOutput(context)`, `handle(data, deps)`, `SkillToolParams`, `MAX_INJECT_LINES`, `LoadDeps` — 全タスク間でシグネチャ一貫。`PostToolUseHookData<SkillToolParams>` の参照も types.ts の追加と一致。

> 実装上の小注意（Task 3）: テストファイル冒頭の import に `import { join } from "jsr:@std/path";` を必ず追加すること（integration テストで `join` を使用）。`deno fmt` が import 並びを整える。
