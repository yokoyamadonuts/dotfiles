# vcsdd-lite Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存 `vsdd` スキルを `vcsdd-lite` にリネームし、Coherence-Driven Development（CoDD）の概念とCoherence Engine Graph（CEG）操作用の4スクリプトを追加する。

**Architecture:** dotfiles の `claude/skills/vsdd/` を `git mv` で `claude/skills/vcsdd-lite/` にリネーム。配下に `SKILL.md`（既存改修）、`references/`（CoDD詳細を退避）、`scripts/`（Deno TypeScript 製の coherence 操作 CLI 4本 + 共通ヘルパ + コロケーションテスト + fixtures）を配置。`~/.claude/skills` への symlink によりインストール作業なしで反映される。

**Tech Stack:**
- Deno（TypeScript ランタイム、テストランナー、JSR標準ライブラリ）
- `jsr:@std/yaml`, `jsr:@std/path`, `jsr:@std/fs`, `jsr:@std/assert`
- 既存スキル: `developing`（TDD）、`writing-tests`（コロケーション）

**Spec:** [docs/superpowers/specs/2026-05-19-vcsdd-lite-skill-design.md](../specs/2026-05-19-vcsdd-lite-skill-design.md)

---

## File Structure

新規作成・変更されるファイル一覧（プロジェクトルート = `/Volumes/Partition_Case_Sensitive/Workspace/dotfiles/`）：

```
claude/skills/vsdd/                        → リネーム → claude/skills/vcsdd-lite/
claude/skills/vcsdd-lite/
├── SKILL.md                               # MODIFY: 既存412行 → ~480行
├── references/
│   ├── coherence.md                       # CREATE: ~150行
│   ├── strict-vs-lean.md                  # CREATE: ~80行
│   └── trace-templates.md                 # CREATE: ~60行
└── scripts/
    ├── _types.ts                          # CREATE: 共通型
    ├── _frontmatter.ts                    # CREATE: YAMLパース
    ├── _frontmatter.test.ts               # CREATE: TDDテスト
    ├── coherence-scan.ts                  # CREATE: scan本体
    ├── coherence-scan.test.ts             # CREATE: TDDテスト
    ├── coherence-validate.ts              # CREATE: validate本体
    ├── coherence-validate.test.ts         # CREATE: TDDテスト
    ├── coherence-impact.ts                # CREATE: impact本体
    ├── coherence-impact.test.ts           # CREATE: TDDテスト
    ├── coherence-trace.ts                 # CREATE: trace本体
    ├── coherence-trace.test.ts            # CREATE: TDDテスト
    └── fixtures/
        ├── valid-feature/
        │   ├── specs/auth-flow.md
        │   ├── specs/session-mgmt.md
        │   └── expected-coherence.json
        ├── cycle/
        │   ├── specs/a.md
        │   ├── specs/b.md
        │   └── expected-issues.json
        ├── missing-ref/
        │   ├── specs/orphan-spec.md
        │   └── expected-issues.json
        ├── orphan/
        │   ├── specs/root.md
        │   ├── specs/orphan.md
        │   └── expected-issues.json
        └── incomplete-bead/
            ├── specs/spec-only.md
            └── expected-issues.json

claude/install.sh                          # MODIFY: Deno存在チェック追加（任意）
```

各ファイル責務:
- `_types.ts`: 全スクリプト間で共有される TypeScript 型定義
- `_frontmatter.ts`: マークダウンファイルから YAML frontmatter を抽出・検証する純粋関数
- `coherence-scan.ts`: spec ファイルを走査し `coherence.json` を生成する CLI
- `coherence-validate.ts`: `coherence.json` を読み整合性違反を検出する CLI
- `coherence-impact.ts`: 逆向きBFSで影響範囲を計算する CLI
- `coherence-trace.ts`: 要件IDからspec/test/impl/verifyへのトレースを表示する CLI
- `references/coherence.md`: CEGモデル、frontmatter完全仕様、信頼度バンド詳細
- `references/strict-vs-lean.md`: モード比較表、Sprint契約の書き方
- `references/trace-templates.md`: bead identifier命名規則、トレース表テンプレート
- `SKILL.md`: メインフロー記述、references への参照、Phase 0〜6 ワークフロー

---

## 前提条件

- Deno がインストールされていること（`deno --version` でv1.40 以上を確認、未インストールなら `curl -fsSL https://deno.land/install.sh | sh`）
- ワーキングディレクトリは worktree のルート `/Volumes/Partition_Case_Sensitive/Workspace/dotfiles/.claude/worktrees/sharp-euclid-453b82/`
- 全コマンドはこの worktree ルートから実行する想定

---

### Task 1: ディレクトリリネーム

**Files:**
- Move: `claude/skills/vsdd/` → `claude/skills/vcsdd-lite/`

- [ ] **Step 1: 現在の状態を確認**

Run: `ls claude/skills/vsdd/`
Expected: `SKILL.md` のみ表示

- [ ] **Step 2: git mv でリネーム**

```bash
git mv claude/skills/vsdd claude/skills/vcsdd-lite
```

- [ ] **Step 3: リネーム結果を確認**

Run: `ls claude/skills/vcsdd-lite/ && ls claude/skills/vsdd 2>&1`
Expected:
```
SKILL.md
ls: claude/skills/vsdd: No such file or directory
```

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "refactor: rename vsdd skill directory to vcsdd-lite

Prepares for Coherence-Driven Development (CoDD) integration.
Plugin sc30gsw/vcsdd-claude-code uses 'vcsdd' namespace, so we use
'vcsdd-lite' to avoid collision.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 共通型定義の作成

**Files:**
- Create: `claude/skills/vcsdd-lite/scripts/_types.ts`

- [ ] **Step 1: scripts/ ディレクトリ作成**

```bash
mkdir -p claude/skills/vcsdd-lite/scripts
```

- [ ] **Step 2: _types.ts を作成**

Create `claude/skills/vcsdd-lite/scripts/_types.ts`:

```typescript
export type NodeType = "req" | "spec" | "design" | "test" | "impl" | "verify";
export type Confidence = "green" | "amber" | "gray";
export type EdgeKind = "depends_on" | "satisfies" | "verified_by" | "verifies";
export type Status = "draft" | "reviewed" | "locked";
export type Mode = "lean" | "strict";

export interface FrontmatterCoherence {
  depends_on?: string[];
  satisfies?: string[];
  verified_by?: string[];
  beads?: string[];
}

export interface NodeFrontmatter {
  id: string;
  type: NodeType;
  feature: string;
  coherence?: FrontmatterCoherence;
  confidence?: Confidence;
  status?: Status;
  last_reviewed?: string;
}

export interface CoherenceNode {
  type: NodeType;
  path: string;
  confidence: Confidence;
  status?: Status;
  depends_on: string[];
  satisfies: string[];
  verified_by: string[];
  beads: string[];
}

export interface Edge {
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface Bead {
  members: string[];
  completeness: "full" | "partial";
}

export type IssueSeverity = "error" | "warning" | "info";
export type IssueKind =
  | "missing_reference"
  | "cycle"
  | "orphan"
  | "type_mismatch"
  | "incomplete_bead"
  | "gray_in_locked_spec";

export interface Issue {
  severity: IssueSeverity;
  kind: IssueKind;
  node?: string;
  field?: string;
  target?: string;
  members?: string[];
  cycle?: string[];
  message: string;
}

export interface Summary {
  total_nodes: number;
  confidence_distribution: Record<Confidence, number>;
  cycles_detected: number;
  missing_references: number;
  orphans: number;
}

export interface CoherenceGraph {
  $schema: "vcsdd-lite-coherence-v1";
  version: string;
  feature: string;
  scanned_at: string;
  scanner_version: string;
  mode: Mode;
  nodes: Record<string, CoherenceNode>;
  edges: Edge[];
  beads: Record<string, Bead>;
  issues: Issue[];
  summary: Summary;
}

export const SCANNER_VERSION = "vcsdd-lite/0.1";
export const SCHEMA_VERSION = "vcsdd-lite-coherence-v1" as const;
export const VALID_NODE_TYPES: NodeType[] = ["req", "spec", "design", "test", "impl", "verify"];
```

- [ ] **Step 3: 型チェックで構文を検証**

Run: `deno check claude/skills/vcsdd-lite/scripts/_types.ts`
Expected: エラーなし、何も出力されない or "Check ..."

- [ ] **Step 4: コミット**

```bash
git add claude/skills/vcsdd-lite/scripts/_types.ts
git commit -m "feat(vcsdd-lite): add shared TypeScript types for coherence scripts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Frontmatter ヘルパ（TDD）

**Files:**
- Create: `claude/skills/vcsdd-lite/scripts/_frontmatter.test.ts`
- Create: `claude/skills/vcsdd-lite/scripts/_frontmatter.ts`

- [ ] **Step 1: RED — 失敗するテストを書く**

Create `claude/skills/vcsdd-lite/scripts/_frontmatter.test.ts`:

```typescript
import { assertEquals, assertThrows } from "jsr:@std/assert";
import { extractFrontmatter, FrontmatterError } from "./_frontmatter.ts";

Deno.test("extractFrontmatter: valid spec frontmatter", () => {
  const content = `---
id: spec:auth-flow
type: spec
feature: user-auth
coherence:
  depends_on:
    - design:user-schema
  satisfies:
    - req:user-login
---
# Body content
`;
  const result = extractFrontmatter(content, "test.md");
  assertEquals(result?.id, "spec:auth-flow");
  assertEquals(result?.type, "spec");
  assertEquals(result?.feature, "user-auth");
  assertEquals(result?.coherence?.depends_on, ["design:user-schema"]);
  assertEquals(result?.coherence?.satisfies, ["req:user-login"]);
});

Deno.test("extractFrontmatter: returns null when no frontmatter", () => {
  const result = extractFrontmatter("# No frontmatter here\n", "test.md");
  assertEquals(result, null);
});

Deno.test("extractFrontmatter: throws on invalid YAML", () => {
  const content = `---
id: spec:bad
type: [unclosed
---
`;
  assertThrows(
    () => extractFrontmatter(content, "test.md"),
    FrontmatterError,
    "Invalid YAML",
  );
});

Deno.test("extractFrontmatter: throws when id missing", () => {
  const content = `---
type: spec
feature: user-auth
---
`;
  assertThrows(
    () => extractFrontmatter(content, "test.md"),
    FrontmatterError,
    "Missing or invalid 'id'",
  );
});

Deno.test("extractFrontmatter: throws when type missing", () => {
  const content = `---
id: spec:bad
feature: user-auth
---
`;
  assertThrows(
    () => extractFrontmatter(content, "test.md"),
    FrontmatterError,
    "Missing or invalid 'type'",
  );
});

Deno.test("extractFrontmatter: throws when feature missing", () => {
  const content = `---
id: spec:bad
type: spec
---
`;
  assertThrows(
    () => extractFrontmatter(content, "test.md"),
    FrontmatterError,
    "Missing or invalid 'feature'",
  );
});

Deno.test("extractFrontmatter: throws on invalid type value", () => {
  const content = `---
id: spec:bad
type: notarealtype
feature: user-auth
---
`;
  assertThrows(
    () => extractFrontmatter(content, "test.md"),
    FrontmatterError,
    "Invalid type",
  );
});

Deno.test("extractFrontmatter: accepts minimal valid frontmatter", () => {
  const content = `---
id: req:minimal
type: req
feature: user-auth
---
`;
  const result = extractFrontmatter(content, "test.md");
  assertEquals(result?.id, "req:minimal");
  assertEquals(result?.coherence, undefined);
});

Deno.test("extractFrontmatter: preserves optional fields", () => {
  const content = `---
id: spec:full
type: spec
feature: user-auth
confidence: green
status: reviewed
last_reviewed: 2026-05-19
---
`;
  const result = extractFrontmatter(content, "test.md");
  assertEquals(result?.confidence, "green");
  assertEquals(result?.status, "reviewed");
  assertEquals(result?.last_reviewed, "2026-05-19");
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `deno test --allow-read claude/skills/vcsdd-lite/scripts/_frontmatter.test.ts`
Expected: FAIL（モジュール `./_frontmatter.ts` が存在しないため "Module not found" エラー）

- [ ] **Step 3: GREEN — 最小実装を書く**

Create `claude/skills/vcsdd-lite/scripts/_frontmatter.ts`:

```typescript
import { parse as parseYaml } from "jsr:@std/yaml";
import type { NodeFrontmatter } from "./_types.ts";
import { VALID_NODE_TYPES } from "./_types.ts";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export class FrontmatterError extends Error {
  constructor(message: string, public readonly file: string) {
    super(`${file}: ${message}`);
    this.name = "FrontmatterError";
  }
}

export function extractFrontmatter(
  content: string,
  filePath: string,
): NodeFrontmatter | null {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return null;

  let parsed: unknown;
  try {
    parsed = parseYaml(match[1]);
  } catch (e) {
    throw new FrontmatterError(
      `Invalid YAML: ${(e as Error).message}`,
      filePath,
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new FrontmatterError("Frontmatter must be an object", filePath);
  }

  const fm = parsed as Record<string, unknown>;

  if (typeof fm.id !== "string" || fm.id.length === 0) {
    throw new FrontmatterError("Missing or invalid 'id' field", filePath);
  }
  if (typeof fm.type !== "string" || fm.type.length === 0) {
    throw new FrontmatterError("Missing or invalid 'type' field", filePath);
  }
  if (typeof fm.feature !== "string" || fm.feature.length === 0) {
    throw new FrontmatterError("Missing or invalid 'feature' field", filePath);
  }

  if (!(VALID_NODE_TYPES as string[]).includes(fm.type)) {
    throw new FrontmatterError(
      `Invalid type: ${fm.type} (must be one of: ${VALID_NODE_TYPES.join(", ")})`,
      filePath,
    );
  }

  return parsed as NodeFrontmatter;
}
```

- [ ] **Step 4: テストを再実行して GREEN を確認**

Run: `deno test --allow-read claude/skills/vcsdd-lite/scripts/_frontmatter.test.ts`
Expected: 全9テスト PASS

- [ ] **Step 5: コミット**

```bash
git add claude/skills/vcsdd-lite/scripts/_frontmatter.ts claude/skills/vcsdd-lite/scripts/_frontmatter.test.ts
git commit -m "feat(vcsdd-lite): add frontmatter parser with validation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: テストフィクスチャ作成（5シナリオ）

**Files:**
- Create: `claude/skills/vcsdd-lite/scripts/fixtures/valid-feature/specs/auth-flow.md`
- Create: `claude/skills/vcsdd-lite/scripts/fixtures/valid-feature/specs/session-mgmt.md`
- Create: `claude/skills/vcsdd-lite/scripts/fixtures/valid-feature/expected-coherence.json`
- Create: `claude/skills/vcsdd-lite/scripts/fixtures/cycle/specs/a.md`
- Create: `claude/skills/vcsdd-lite/scripts/fixtures/cycle/specs/b.md`
- Create: `claude/skills/vcsdd-lite/scripts/fixtures/cycle/expected-issues.json`
- Create: `claude/skills/vcsdd-lite/scripts/fixtures/missing-ref/specs/orphan-spec.md`
- Create: `claude/skills/vcsdd-lite/scripts/fixtures/missing-ref/expected-issues.json`
- Create: `claude/skills/vcsdd-lite/scripts/fixtures/orphan/specs/root.md`
- Create: `claude/skills/vcsdd-lite/scripts/fixtures/orphan/specs/orphan.md`
- Create: `claude/skills/vcsdd-lite/scripts/fixtures/orphan/expected-issues.json`
- Create: `claude/skills/vcsdd-lite/scripts/fixtures/incomplete-bead/specs/spec-only.md`
- Create: `claude/skills/vcsdd-lite/scripts/fixtures/incomplete-bead/expected-issues.json`

- [ ] **Step 1: valid-feature/specs/auth-flow.md を作成**

Create `claude/skills/vcsdd-lite/scripts/fixtures/valid-feature/specs/auth-flow.md`:

```markdown
---
id: spec:auth-flow
type: spec
feature: valid-feature
coherence:
  depends_on:
    - design:user-schema
  satisfies:
    - req:user-login
  verified_by:
    - test:auth-edge-cases
  beads:
    - bead:B-001-login
confidence: green
status: reviewed
---

# Auth Flow Specification
```

- [ ] **Step 2: valid-feature/specs/session-mgmt.md を作成**

Create `claude/skills/vcsdd-lite/scripts/fixtures/valid-feature/specs/session-mgmt.md`:

```markdown
---
id: spec:session-mgmt
type: spec
feature: valid-feature
coherence:
  depends_on:
    - design:token-store
  satisfies:
    - req:session-persistence
  verified_by:
    - test:session-tests
  beads:
    - bead:B-002-session
confidence: green
status: reviewed
---

# Session Management Specification
```

- [ ] **Step 3: valid-feature/expected-coherence.json を作成**

Create `claude/skills/vcsdd-lite/scripts/fixtures/valid-feature/expected-coherence.json`:

```json
{
  "feature": "valid-feature",
  "nodes": {
    "spec:auth-flow": {
      "type": "spec",
      "confidence": "green",
      "status": "reviewed",
      "depends_on": ["design:user-schema"],
      "satisfies": ["req:user-login"],
      "verified_by": ["test:auth-edge-cases"],
      "beads": ["bead:B-001-login"]
    },
    "spec:session-mgmt": {
      "type": "spec",
      "confidence": "green",
      "status": "reviewed",
      "depends_on": ["design:token-store"],
      "satisfies": ["req:session-persistence"],
      "verified_by": ["test:session-tests"],
      "beads": ["bead:B-002-session"]
    }
  },
  "edge_count": 6,
  "issues_count": 0
}
```

(注: scan が生成する完全な `coherence.json` ではなく、テストで比較する重要フィールドだけを抽出した期待値スナップショット。`path` や `scanned_at` のような環境依存・時刻依存フィールドは比較対象から除外する)

- [ ] **Step 4: cycle/ シナリオを作成**

Create `claude/skills/vcsdd-lite/scripts/fixtures/cycle/specs/a.md`:

```markdown
---
id: spec:a
type: spec
feature: cycle
coherence:
  depends_on:
    - spec:b
---

# A
```

Create `claude/skills/vcsdd-lite/scripts/fixtures/cycle/specs/b.md`:

```markdown
---
id: spec:b
type: spec
feature: cycle
coherence:
  depends_on:
    - spec:a
---

# B
```

Create `claude/skills/vcsdd-lite/scripts/fixtures/cycle/expected-issues.json`:

```json
{
  "expected_kinds": ["cycle"],
  "min_errors": 1
}
```

- [ ] **Step 5: missing-ref/ シナリオを作成**

Create `claude/skills/vcsdd-lite/scripts/fixtures/missing-ref/specs/orphan-spec.md`:

```markdown
---
id: spec:orphan
type: spec
feature: missing-ref
coherence:
  depends_on:
    - design:nonexistent-node
---

# Orphan Spec
```

Create `claude/skills/vcsdd-lite/scripts/fixtures/missing-ref/expected-issues.json`:

```json
{
  "expected_kinds": ["missing_reference"],
  "min_errors": 1
}
```

- [ ] **Step 6: orphan/ シナリオを作成**

Create `claude/skills/vcsdd-lite/scripts/fixtures/orphan/specs/root.md`:

```markdown
---
id: req:root
type: req
feature: orphan
---

# Root Requirement
```

Create `claude/skills/vcsdd-lite/scripts/fixtures/orphan/specs/orphan.md`:

```markdown
---
id: design:orphan
type: design
feature: orphan
---

# Orphan Design (no incoming edges)
```

Create `claude/skills/vcsdd-lite/scripts/fixtures/orphan/expected-issues.json`:

```json
{
  "expected_kinds": ["orphan"],
  "min_warnings": 1
}
```

- [ ] **Step 7: incomplete-bead/ シナリオを作成**

Create `claude/skills/vcsdd-lite/scripts/fixtures/incomplete-bead/specs/spec-only.md`:

```markdown
---
id: spec:lonely
type: spec
feature: incomplete-bead
coherence:
  beads:
    - bead:B-incomplete
---

# Spec only in bead (missing req/test/impl/verify members)
```

Create `claude/skills/vcsdd-lite/scripts/fixtures/incomplete-bead/expected-issues.json`:

```json
{
  "expected_kinds": ["incomplete_bead"],
  "min_info": 1
}
```

- [ ] **Step 8: フィクスチャの整合性を手動確認**

Run: `find claude/skills/vcsdd-lite/scripts/fixtures -type f | sort`
Expected: 13ファイル列挙される
```
claude/skills/vcsdd-lite/scripts/fixtures/cycle/expected-issues.json
claude/skills/vcsdd-lite/scripts/fixtures/cycle/specs/a.md
claude/skills/vcsdd-lite/scripts/fixtures/cycle/specs/b.md
claude/skills/vcsdd-lite/scripts/fixtures/incomplete-bead/expected-issues.json
claude/skills/vcsdd-lite/scripts/fixtures/incomplete-bead/specs/spec-only.md
claude/skills/vcsdd-lite/scripts/fixtures/missing-ref/expected-issues.json
claude/skills/vcsdd-lite/scripts/fixtures/missing-ref/specs/orphan-spec.md
claude/skills/vcsdd-lite/scripts/fixtures/orphan/expected-issues.json
claude/skills/vcsdd-lite/scripts/fixtures/orphan/specs/orphan.md
claude/skills/vcsdd-lite/scripts/fixtures/orphan/specs/root.md
claude/skills/vcsdd-lite/scripts/fixtures/valid-feature/expected-coherence.json
claude/skills/vcsdd-lite/scripts/fixtures/valid-feature/specs/auth-flow.md
claude/skills/vcsdd-lite/scripts/fixtures/valid-feature/specs/session-mgmt.md
```

- [ ] **Step 9: コミット**

```bash
git add claude/skills/vcsdd-lite/scripts/fixtures/
git commit -m "feat(vcsdd-lite): add test fixtures for 5 coherence scenarios

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: coherence-scan TDD

**Files:**
- Create: `claude/skills/vcsdd-lite/scripts/coherence-scan.test.ts`
- Create: `claude/skills/vcsdd-lite/scripts/coherence-scan.ts`

- [ ] **Step 1: RED — coherence-scan.test.ts を作成**

Create `claude/skills/vcsdd-lite/scripts/coherence-scan.test.ts`:

```typescript
import { assertEquals, assert } from "jsr:@std/assert";
import { scanFeature } from "./coherence-scan.ts";

const FIXTURES = new URL("./fixtures", import.meta.url).pathname;

Deno.test("scanFeature: valid-feature builds correct graph", async () => {
  const graph = await scanFeature(`${FIXTURES}/valid-feature`, "valid-feature");

  assertEquals(graph.feature, "valid-feature");
  assertEquals(Object.keys(graph.nodes).length, 2);
  assert("spec:auth-flow" in graph.nodes);
  assert("spec:session-mgmt" in graph.nodes);

  const authFlow = graph.nodes["spec:auth-flow"];
  assertEquals(authFlow.type, "spec");
  assertEquals(authFlow.depends_on, ["design:user-schema"]);
  assertEquals(authFlow.satisfies, ["req:user-login"]);
  assertEquals(authFlow.beads, ["bead:B-001-login"]);
});

Deno.test("scanFeature: generates edges for all coherence relations", async () => {
  const graph = await scanFeature(`${FIXTURES}/valid-feature`, "valid-feature");

  // 2 specs × 3 relations (depends_on/satisfies/verified_by) = 6 edges
  assertEquals(graph.edges.length, 6);

  // Check at least one of each kind exists
  const kinds = new Set(graph.edges.map((e) => e.kind));
  assert(kinds.has("depends_on"));
  assert(kinds.has("satisfies"));
  assert(kinds.has("verified_by"));
});

Deno.test("scanFeature: collects beads with member sets", async () => {
  const graph = await scanFeature(`${FIXTURES}/valid-feature`, "valid-feature");

  assert("bead:B-001-login" in graph.beads);
  const bead = graph.beads["bead:B-001-login"];
  assertEquals(bead.members.includes("spec:auth-flow"), true);
});

Deno.test("scanFeature: respects manual confidence override", async () => {
  const graph = await scanFeature(`${FIXTURES}/valid-feature`, "valid-feature");

  // Both specs have confidence: green in their frontmatter
  assertEquals(graph.nodes["spec:auth-flow"].confidence, "green");
  assertEquals(graph.nodes["spec:session-mgmt"].confidence, "green");
});

Deno.test("scanFeature: throws on duplicate node id", async () => {
  const tmpDir = await Deno.makeTempDir();
  const specs = `${tmpDir}/specs`;
  await Deno.mkdir(specs, { recursive: true });
  const dupFrontmatter = `---
id: spec:dup
type: spec
feature: dup
---
`;
  await Deno.writeTextFile(`${specs}/a.md`, dupFrontmatter);
  await Deno.writeTextFile(`${specs}/b.md`, dupFrontmatter);

  try {
    let threw = false;
    try {
      await scanFeature(tmpDir, "dup");
    } catch (e) {
      threw = true;
      assert((e as Error).message.includes("Duplicate"));
    }
    assert(threw, "Expected scanFeature to throw on duplicate id");
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});

Deno.test("scanFeature: summary counts are accurate", async () => {
  const graph = await scanFeature(`${FIXTURES}/valid-feature`, "valid-feature");

  assertEquals(graph.summary.total_nodes, 2);
  assertEquals(graph.summary.confidence_distribution.green, 2);
  assertEquals(graph.summary.confidence_distribution.amber, 0);
  assertEquals(graph.summary.confidence_distribution.gray, 0);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `deno test --allow-read --allow-write claude/skills/vcsdd-lite/scripts/coherence-scan.test.ts`
Expected: FAIL（"Module not found: ./coherence-scan.ts"）

- [ ] **Step 3: GREEN — coherence-scan.ts を実装**

Create `claude/skills/vcsdd-lite/scripts/coherence-scan.ts`:

```typescript
#!/usr/bin/env -S deno run --allow-read --allow-write
import { walk } from "jsr:@std/fs/walk";
import { relative, join } from "jsr:@std/path";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { extractFrontmatter, FrontmatterError } from "./_frontmatter.ts";
import type {
  Bead,
  CoherenceGraph,
  CoherenceNode,
  Confidence,
  Edge,
  EdgeKind,
  Summary,
} from "./_types.ts";
import { SCANNER_VERSION, SCHEMA_VERSION } from "./_types.ts";

const CWD = Deno.cwd();

export async function scanFeature(
  featureDir: string,
  featureName: string,
  mode: "lean" | "strict" = "lean",
): Promise<CoherenceGraph> {
  const specsDir = join(featureDir, "specs");

  const nodes: Record<string, CoherenceNode> = {};
  const beadMembers: Record<string, Set<string>> = {};

  for await (const entry of walk(specsDir, {
    exts: [".md"],
    includeDirs: false,
  })) {
    const content = await Deno.readTextFile(entry.path);
    let fm;
    try {
      fm = extractFrontmatter(content, entry.path);
    } catch (e) {
      if (e instanceof FrontmatterError) {
        console.error(`Warning: ${e.message}`);
        continue;
      }
      throw e;
    }
    if (!fm) continue;
    if (fm.feature !== featureName) continue;

    if (fm.id in nodes) {
      throw new Error(`Duplicate node id: ${fm.id} (in ${entry.path})`);
    }

    const coherence = fm.coherence ?? {};
    const node: CoherenceNode = {
      type: fm.type,
      path: relative(CWD, entry.path),
      confidence: fm.confidence ?? "gray",
      status: fm.status,
      depends_on: coherence.depends_on ?? [],
      satisfies: coherence.satisfies ?? [],
      verified_by: coherence.verified_by ?? [],
      beads: coherence.beads ?? [],
    };
    nodes[fm.id] = node;

    for (const beadId of node.beads) {
      if (!(beadId in beadMembers)) beadMembers[beadId] = new Set();
      beadMembers[beadId].add(fm.id);
    }
  }

  // Auto-confidence (only if frontmatter did not specify)
  // Re-scan to apply autoComputed defaults
  for (const [id, node] of Object.entries(nodes)) {
    if (await wasConfidenceManuallySet(node.path)) continue;
    node.confidence = computeConfidence(id, node, nodes);
  }

  const edges = buildEdges(nodes);
  const beads = buildBeads(beadMembers);
  const summary = buildSummary(nodes);

  return {
    $schema: SCHEMA_VERSION,
    version: "1.0",
    feature: featureName,
    scanned_at: new Date().toISOString(),
    scanner_version: SCANNER_VERSION,
    mode,
    nodes,
    edges,
    beads,
    issues: [],
    summary,
  };
}

async function wasConfidenceManuallySet(filePath: string): Promise<boolean> {
  const content = await Deno.readTextFile(join(CWD, filePath));
  return /^confidence:\s*\S/m.test(content.split(/^---/m)[1] ?? "");
}

function buildEdges(nodes: Record<string, CoherenceNode>): Edge[] {
  const edges: Edge[] = [];
  for (const [from, node] of Object.entries(nodes)) {
    for (const to of node.depends_on) {
      edges.push({ from, to, kind: "depends_on" });
    }
    for (const to of node.satisfies) {
      edges.push({ from, to, kind: "satisfies" });
    }
    for (const to of node.verified_by) {
      edges.push({ from, to, kind: "verified_by" });
    }
  }
  return edges;
}

function buildBeads(
  beadMembers: Record<string, Set<string>>,
): Record<string, Bead> {
  const result: Record<string, Bead> = {};
  for (const [beadId, members] of Object.entries(beadMembers)) {
    result[beadId] = {
      members: [...members].sort(),
      completeness: members.size >= 5 ? "full" : "partial",
    };
  }
  return result;
}

function computeConfidence(
  id: string,
  node: CoherenceNode,
  allNodes: Record<string, CoherenceNode>,
): Confidence {
  const hasMissing =
    [...node.depends_on, ...node.satisfies, ...node.verified_by]
      .some((target) => !(target in allNodes));
  if (hasMissing) return "gray";

  if (node.type === "spec") {
    if (node.satisfies.length >= 1 && node.verified_by.length >= 1) {
      return "green";
    }
    if (node.satisfies.length >= 1 || node.verified_by.length >= 1) {
      return "amber";
    }
    return "gray";
  }
  return "amber";
}

function buildSummary(nodes: Record<string, CoherenceNode>): Summary {
  const dist: Record<Confidence, number> = { green: 0, amber: 0, gray: 0 };
  for (const node of Object.values(nodes)) {
    dist[node.confidence]++;
  }
  return {
    total_nodes: Object.keys(nodes).length,
    confidence_distribution: dist,
    cycles_detected: 0,
    missing_references: 0,
    orphans: 0,
  };
}

// CLI entry
if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["feature", "out", "mode"],
    boolean: ["dry-run"],
    default: { mode: "lean" },
  });

  if (!args.feature) {
    console.error("Error: --feature <name> is required");
    Deno.exit(2);
  }

  const featureDir = join(CWD, "docs", "vcsdd", args.feature);
  try {
    await Deno.stat(featureDir);
  } catch {
    console.error(`Error: feature directory not found: ${featureDir}`);
    Deno.exit(2);
  }

  const graph = await scanFeature(featureDir, args.feature, args.mode as "lean" | "strict");

  const outPath = args.out ?? join(featureDir, "coherence.json");
  const json = JSON.stringify(graph, null, 2);

  if (args["dry-run"]) {
    console.log(json);
  } else {
    await Deno.writeTextFile(outPath, json);
    console.log(`Wrote ${outPath}`);
  }
}
```

- [ ] **Step 4: テストを再実行して GREEN を確認**

Run: `deno test --allow-read --allow-write claude/skills/vcsdd-lite/scripts/coherence-scan.test.ts`
Expected: 全6テスト PASS

- [ ] **Step 5: コミット**

```bash
git add claude/skills/vcsdd-lite/scripts/coherence-scan.ts claude/skills/vcsdd-lite/scripts/coherence-scan.test.ts
git commit -m "feat(vcsdd-lite): implement coherence-scan script (frontmatter → JSON)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: coherence-validate TDD

**Files:**
- Create: `claude/skills/vcsdd-lite/scripts/coherence-validate.test.ts`
- Create: `claude/skills/vcsdd-lite/scripts/coherence-validate.ts`

- [ ] **Step 1: RED — coherence-validate.test.ts を作成**

Create `claude/skills/vcsdd-lite/scripts/coherence-validate.test.ts`:

```typescript
import { assertEquals, assert } from "jsr:@std/assert";
import { validateGraph } from "./coherence-validate.ts";
import { scanFeature } from "./coherence-scan.ts";

const FIXTURES = new URL("./fixtures", import.meta.url).pathname;

Deno.test("validateGraph: valid-feature produces no errors", async () => {
  const graph = await scanFeature(`${FIXTURES}/valid-feature`, "valid-feature");
  const result = validateGraph(graph);
  // valid-feature has external nodes (design:user-schema etc.) not present,
  // so missing_reference errors are expected. Filter for cycle only.
  const cycles = result.issues.filter((i) => i.kind === "cycle");
  assertEquals(cycles.length, 0);
});

Deno.test("validateGraph: detects cycle A→B→A", async () => {
  const graph = await scanFeature(`${FIXTURES}/cycle`, "cycle");
  const result = validateGraph(graph);
  const cycles = result.issues.filter((i) => i.kind === "cycle");
  assert(cycles.length >= 1, "Expected at least one cycle issue");
  assertEquals(cycles[0].severity, "error");
});

Deno.test("validateGraph: detects missing_reference", async () => {
  const graph = await scanFeature(`${FIXTURES}/missing-ref`, "missing-ref");
  const result = validateGraph(graph);
  const missing = result.issues.filter((i) => i.kind === "missing_reference");
  assert(missing.length >= 1);
  assertEquals(missing[0].severity, "error");
  assertEquals(missing[0].target, "design:nonexistent-node");
});

Deno.test("validateGraph: detects orphan nodes (non-req)", async () => {
  const graph = await scanFeature(`${FIXTURES}/orphan`, "orphan");
  const result = validateGraph(graph);
  const orphans = result.issues.filter((i) => i.kind === "orphan");
  assert(orphans.length >= 1);
  // req nodes excluded from orphan check
  const orphanIds = orphans.map((o) => o.node);
  assert(!orphanIds.includes("req:root"));
  assert(orphanIds.includes("design:orphan"));
});

Deno.test("validateGraph: detects incomplete_bead", async () => {
  const graph = await scanFeature(`${FIXTURES}/incomplete-bead`, "incomplete-bead");
  const result = validateGraph(graph);
  const incomplete = result.issues.filter((i) => i.kind === "incomplete_bead");
  assert(incomplete.length >= 1);
  assertEquals(incomplete[0].severity, "info");
});

Deno.test("validateGraph: verdict is 'fail' when errors present", async () => {
  const graph = await scanFeature(`${FIXTURES}/cycle`, "cycle");
  const result = validateGraph(graph);
  assertEquals(result.verdict, "fail");
});

Deno.test("validateGraph: verdict is 'pass' when only info issues", async () => {
  const graph = await scanFeature(`${FIXTURES}/incomplete-bead`, "incomplete-bead");
  const result = validateGraph(graph);
  // incomplete-bead has spec:lonely which is orphan (warning) but no errors
  const hasErrors = result.issues.some((i) => i.severity === "error");
  if (!hasErrors) {
    assertEquals(result.verdict, "pass");
  }
});

Deno.test("validateGraph: --strict treats warnings as fail", async () => {
  const graph = await scanFeature(`${FIXTURES}/orphan`, "orphan");
  const result = validateGraph(graph, { strict: true });
  assertEquals(result.verdict, "fail");
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `deno test --allow-read --allow-write claude/skills/vcsdd-lite/scripts/coherence-validate.test.ts`
Expected: FAIL（"Module not found"）

- [ ] **Step 3: GREEN — coherence-validate.ts を実装**

Create `claude/skills/vcsdd-lite/scripts/coherence-validate.ts`:

```typescript
#!/usr/bin/env -S deno run --allow-read
import { parseArgs } from "jsr:@std/cli/parse-args";
import { join } from "jsr:@std/path";
import type { CoherenceGraph, Issue } from "./_types.ts";

const CWD = Deno.cwd();

export interface ValidationResult {
  feature: string;
  validated_at: string;
  verdict: "pass" | "fail";
  errors: number;
  warnings: number;
  info: number;
  issues: Issue[];
}

export interface ValidateOptions {
  strict?: boolean;
}

export function validateGraph(
  graph: CoherenceGraph,
  options: ValidateOptions = {},
): ValidationResult {
  const issues: Issue[] = [];

  issues.push(...findMissingReferences(graph));
  issues.push(...findCycles(graph));
  issues.push(...findOrphans(graph));
  issues.push(...findTypeMismatches(graph));
  issues.push(...findIncompleteBeads(graph));
  issues.push(...findGrayInLockedSpecs(graph));

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const info = issues.filter((i) => i.severity === "info").length;

  const verdict =
    errors > 0 || (options.strict && warnings > 0) ? "fail" : "pass";

  return {
    feature: graph.feature,
    validated_at: new Date().toISOString(),
    verdict,
    errors,
    warnings,
    info,
    issues,
  };
}

function findMissingReferences(graph: CoherenceGraph): Issue[] {
  const issues: Issue[] = [];
  const nodeIds = new Set(Object.keys(graph.nodes));
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.to)) {
      issues.push({
        severity: "error",
        kind: "missing_reference",
        node: edge.from,
        field: edge.kind,
        target: edge.to,
        message: `Referenced node not found: ${edge.to} (from ${edge.from}.${edge.kind})`,
      });
    }
  }
  return issues;
}

function findCycles(graph: CoherenceGraph): Issue[] {
  const issues: Issue[] = [];
  const adj: Record<string, string[]> = {};
  for (const id of Object.keys(graph.nodes)) adj[id] = [];
  for (const edge of graph.edges) {
    if (edge.kind === "depends_on" && edge.to in adj) {
      adj[edge.from].push(edge.to);
    }
  }

  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): string[] | null {
    if (stack.has(node)) {
      const idx = path.indexOf(node);
      return path.slice(idx).concat(node);
    }
    if (visited.has(node)) return null;
    visited.add(node);
    stack.add(node);
    path.push(node);
    for (const next of adj[node] ?? []) {
      const cycle = dfs(next);
      if (cycle) return cycle;
    }
    stack.delete(node);
    path.pop();
    return null;
  }

  for (const id of Object.keys(graph.nodes)) {
    if (!visited.has(id)) {
      const cycle = dfs(id);
      if (cycle) {
        issues.push({
          severity: "error",
          kind: "cycle",
          cycle,
          message: `Cycle detected: ${cycle.join(" → ")}`,
        });
        break;
      }
    }
  }
  return issues;
}

function findOrphans(graph: CoherenceGraph): Issue[] {
  const issues: Issue[] = [];
  const inDegree: Record<string, number> = {};
  for (const id of Object.keys(graph.nodes)) inDegree[id] = 0;
  for (const edge of graph.edges) {
    if (edge.to in inDegree) inDegree[edge.to]++;
  }
  for (const [id, deg] of Object.entries(inDegree)) {
    const node = graph.nodes[id];
    if (deg === 0 && node.type !== "req") {
      issues.push({
        severity: "warning",
        kind: "orphan",
        node: id,
        message: `Node has no incoming edges: ${id}`,
      });
    }
  }
  return issues;
}

function findTypeMismatches(graph: CoherenceGraph): Issue[] {
  const issues: Issue[] = [];
  const VERIFIED_BY_TARGETS = new Set(["test", "verify"]);
  for (const [id, node] of Object.entries(graph.nodes)) {
    for (const target of node.verified_by) {
      const targetNode = graph.nodes[target];
      if (!targetNode) continue;
      if (!VERIFIED_BY_TARGETS.has(targetNode.type)) {
        issues.push({
          severity: "warning",
          kind: "type_mismatch",
          node: id,
          field: "verified_by",
          target,
          message: `verified_by target must be test/verify, got ${targetNode.type}`,
        });
      }
    }
  }
  return issues;
}

function findIncompleteBeads(graph: CoherenceGraph): Issue[] {
  const issues: Issue[] = [];
  const REQUIRED_TYPES = ["req", "spec", "test", "impl", "verify"];
  for (const [beadId, bead] of Object.entries(graph.beads)) {
    const types = new Set(
      bead.members
        .map((m) => graph.nodes[m]?.type)
        .filter((t): t is string => Boolean(t)),
    );
    const missing = REQUIRED_TYPES.filter((t) => !types.has(t));
    if (missing.length > 0) {
      issues.push({
        severity: "info",
        kind: "incomplete_bead",
        node: beadId,
        members: [...types],
        message: `Bead missing types: ${missing.join(", ")}`,
      });
    }
  }
  return issues;
}

function findGrayInLockedSpecs(graph: CoherenceGraph): Issue[] {
  const issues: Issue[] = [];
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (node.status === "locked" && node.confidence === "gray") {
      issues.push({
        severity: "warning",
        kind: "gray_in_locked_spec",
        node: id,
        message: `Locked node has gray confidence: ${id}`,
      });
    }
  }
  return issues;
}

if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["feature", "format"],
    boolean: ["strict"],
    default: { format: "json" },
  });

  if (!args.feature) {
    console.error("Error: --feature <name> is required");
    Deno.exit(2);
  }

  const path = join(CWD, "docs", "vcsdd", args.feature, "coherence.json");
  const graph: CoherenceGraph = JSON.parse(await Deno.readTextFile(path));
  const result = validateGraph(graph, { strict: args.strict });

  if (args.format === "md") {
    console.log(`# Coherence Validation: ${result.feature}\n`);
    console.log(`**Verdict**: ${result.verdict === "pass" ? "✅ PASS" : "❌ FAIL"} (${result.errors} errors, ${result.warnings} warnings, ${result.info} info)\n`);
    for (const sev of ["error", "warning", "info"] as const) {
      const filtered = result.issues.filter((i) => i.severity === sev);
      if (filtered.length === 0) continue;
      console.log(`## ${sev[0].toUpperCase()}${sev.slice(1)}s`);
      for (const issue of filtered) {
        console.log(`- \`${issue.kind}\` ${issue.message}`);
      }
      console.log();
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
  }

  if (result.verdict === "fail") Deno.exit(1);
}
```

- [ ] **Step 4: テストを再実行して GREEN を確認**

Run: `deno test --allow-read --allow-write claude/skills/vcsdd-lite/scripts/coherence-validate.test.ts`
Expected: 全8テスト PASS

- [ ] **Step 5: コミット**

```bash
git add claude/skills/vcsdd-lite/scripts/coherence-validate.ts claude/skills/vcsdd-lite/scripts/coherence-validate.test.ts
git commit -m "feat(vcsdd-lite): implement coherence-validate script (6 check kinds)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: coherence-impact TDD

**Files:**
- Create: `claude/skills/vcsdd-lite/scripts/coherence-impact.test.ts`
- Create: `claude/skills/vcsdd-lite/scripts/coherence-impact.ts`

- [ ] **Step 1: RED — coherence-impact.test.ts を作成**

Create `claude/skills/vcsdd-lite/scripts/coherence-impact.test.ts`:

```typescript
import { assertEquals, assert } from "jsr:@std/assert";
import { computeImpact } from "./coherence-impact.ts";
import type { CoherenceGraph } from "./_types.ts";

function makeGraph(): CoherenceGraph {
  return {
    $schema: "vcsdd-lite-coherence-v1",
    version: "1.0",
    feature: "test",
    scanned_at: "2026-05-19T00:00:00Z",
    scanner_version: "vcsdd-lite/0.1",
    mode: "lean",
    nodes: {
      "design:schema":    { type: "design", path: "p", confidence: "green", depends_on: [],            satisfies: [],            verified_by: [],            beads: [] },
      "spec:flow":        { type: "spec",   path: "p", confidence: "green", depends_on: ["design:schema"], satisfies: ["req:root"], verified_by: ["test:flow"], beads: [] },
      "test:flow":        { type: "test",   path: "p", confidence: "green", depends_on: [],            satisfies: [],            verified_by: [],            beads: [] },
      "req:root":         { type: "req",    path: "p", confidence: "green", depends_on: [],            satisfies: [],            verified_by: [],            beads: [] },
      "impl:service":     { type: "impl",   path: "p", confidence: "green", depends_on: ["spec:flow"], satisfies: [],            verified_by: [],            beads: [] },
    },
    edges: [
      { from: "spec:flow",    to: "design:schema", kind: "depends_on" },
      { from: "spec:flow",    to: "req:root",      kind: "satisfies" },
      { from: "spec:flow",    to: "test:flow",     kind: "verified_by" },
      { from: "impl:service", to: "spec:flow",     kind: "depends_on" },
    ],
    beads: {},
    issues: [],
    summary: { total_nodes: 5, confidence_distribution: { green: 5, amber: 0, gray: 0 }, cycles_detected: 0, missing_references: 0, orphans: 0 },
  };
}

Deno.test("computeImpact: design:schema affects spec:flow at depth 1", () => {
  const graph = makeGraph();
  const result = computeImpact(graph, "design:schema", 5);

  assertEquals(result.root, "design:schema");
  assert(result.affected.depth_1.some((a) => a.id === "spec:flow"));
});

Deno.test("computeImpact: propagates to depth 2", () => {
  const graph = makeGraph();
  const result = computeImpact(graph, "design:schema", 5);

  // depth_1: spec:flow
  // depth_2: impl:service (depends_on spec:flow)
  assert(result.affected.depth_2?.some((a) => a.id === "impl:service"));
});

Deno.test("computeImpact: respects max depth", () => {
  const graph = makeGraph();
  const result = computeImpact(graph, "design:schema", 1);

  assert(result.affected.depth_1.length > 0);
  assertEquals(result.affected.depth_2, undefined);
});

Deno.test("computeImpact: throws on unknown node", () => {
  const graph = makeGraph();
  let threw = false;
  try {
    computeImpact(graph, "spec:nonexistent", 5);
  } catch (e) {
    threw = true;
    assert((e as Error).message.includes("not found"));
  }
  assert(threw);
});

Deno.test("computeImpact: by_type aggregates correctly", () => {
  const graph = makeGraph();
  const result = computeImpact(graph, "design:schema", 5);

  assert(result.by_type.spec >= 1);
  assert(result.by_type.impl >= 1);
});

Deno.test("computeImpact: no self-loop in result", () => {
  const graph = makeGraph();
  const result = computeImpact(graph, "design:schema", 5);

  const allIds: string[] = [];
  for (const depthArr of Object.values(result.affected)) {
    if (Array.isArray(depthArr)) allIds.push(...depthArr.map((a) => a.id));
  }
  assert(!allIds.includes("design:schema"));
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `deno test --allow-read claude/skills/vcsdd-lite/scripts/coherence-impact.test.ts`
Expected: FAIL（"Module not found"）

- [ ] **Step 3: GREEN — coherence-impact.ts を実装**

Create `claude/skills/vcsdd-lite/scripts/coherence-impact.ts`:

```typescript
#!/usr/bin/env -S deno run --allow-read
import { parseArgs } from "jsr:@std/cli/parse-args";
import { join } from "jsr:@std/path";
import type { CoherenceGraph, NodeType } from "./_types.ts";

const CWD = Deno.cwd();

export interface AffectedNode {
  id: string;
  via: string;
  confidence: string;
}

export interface ImpactResult {
  root: string;
  max_depth: number;
  affected: Record<string, AffectedNode[]>;
  total_affected: number;
  by_type: Record<NodeType, number>;
}

export function computeImpact(
  graph: CoherenceGraph,
  rootId: string,
  maxDepth: number,
): ImpactResult {
  if (!(rootId in graph.nodes)) {
    throw new Error(`Node not found: ${rootId}`);
  }

  // Build inverse adjacency: incoming edges to each node
  const inverseAdj: Record<string, Array<{ from: string; kind: string }>> = {};
  for (const id of Object.keys(graph.nodes)) inverseAdj[id] = [];
  for (const edge of graph.edges) {
    if (edge.to in inverseAdj) {
      inverseAdj[edge.to].push({ from: edge.from, kind: edge.kind });
    }
  }

  const affected: Record<string, AffectedNode[]> = {};
  const visited = new Set<string>([rootId]);
  let queue: Array<{ id: string; via: string; depth: number }> = [];

  for (const incoming of inverseAdj[rootId]) {
    queue.push({ id: incoming.from, via: incoming.kind, depth: 1 });
  }

  while (queue.length > 0) {
    const next: typeof queue = [];
    for (const item of queue) {
      if (visited.has(item.id)) continue;
      if (item.depth > maxDepth) continue;
      visited.add(item.id);

      const key = `depth_${item.depth}`;
      if (!affected[key]) affected[key] = [];
      affected[key].push({
        id: item.id,
        via: item.via,
        confidence: graph.nodes[item.id].confidence,
      });

      for (const incoming of inverseAdj[item.id]) {
        next.push({
          id: incoming.from,
          via: `${item.id}→${incoming.kind}`,
          depth: item.depth + 1,
        });
      }
    }
    queue = next;
  }

  const allAffected = Object.values(affected).flat();
  const byType: Record<NodeType, number> = {
    req: 0, spec: 0, design: 0, test: 0, impl: 0, verify: 0,
  };
  for (const a of allAffected) {
    const t = graph.nodes[a.id].type;
    byType[t]++;
  }

  return {
    root: rootId,
    max_depth: maxDepth,
    affected,
    total_affected: allAffected.length,
    by_type: byType,
  };
}

if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["feature", "node", "format"],
    default: { format: "json", depth: "5" },
  });

  if (!args.feature || !args.node) {
    console.error("Error: --feature <name> and --node <id> are required");
    Deno.exit(2);
  }

  const depth = parseInt(String((args as Record<string, unknown>).depth ?? "5"), 10);
  const path = join(CWD, "docs", "vcsdd", args.feature, "coherence.json");
  const graph: CoherenceGraph = JSON.parse(await Deno.readTextFile(path));
  const result = computeImpact(graph, args.node, depth);

  if (args.format === "md") {
    console.log(`# Impact Analysis: ${result.root}\n`);
    console.log(`**Total affected**: ${result.total_affected} nodes\n`);
    for (const [key, nodes] of Object.entries(result.affected)) {
      const depthN = key.replace("depth_", "");
      console.log(`## Depth ${depthN}`);
      for (const n of nodes as AffectedNode[]) {
        const icon = n.confidence === "green" ? "🟢" : n.confidence === "amber" ? "🟡" : "⚫";
        console.log(`- ${icon} \`${n.id}\` (via ${n.via})`);
      }
      console.log();
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}
```

- [ ] **Step 4: テストを再実行して GREEN を確認**

Run: `deno test --allow-read claude/skills/vcsdd-lite/scripts/coherence-impact.test.ts`
Expected: 全6テスト PASS

- [ ] **Step 5: コミット**

```bash
git add claude/skills/vcsdd-lite/scripts/coherence-impact.ts claude/skills/vcsdd-lite/scripts/coherence-impact.test.ts
git commit -m "feat(vcsdd-lite): implement coherence-impact script (reverse BFS)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: coherence-trace TDD

**Files:**
- Create: `claude/skills/vcsdd-lite/scripts/coherence-trace.test.ts`
- Create: `claude/skills/vcsdd-lite/scripts/coherence-trace.ts`

- [ ] **Step 1: RED — coherence-trace.test.ts を作成**

Create `claude/skills/vcsdd-lite/scripts/coherence-trace.test.ts`:

```typescript
import { assertEquals, assert } from "jsr:@std/assert";
import { traceReq } from "./coherence-trace.ts";
import type { CoherenceGraph } from "./_types.ts";

function makeGraph(): CoherenceGraph {
  return {
    $schema: "vcsdd-lite-coherence-v1",
    version: "1.0",
    feature: "test",
    scanned_at: "2026-05-19T00:00:00Z",
    scanner_version: "vcsdd-lite/0.1",
    mode: "lean",
    nodes: {
      "req:login":      { type: "req",    path: "p", confidence: "green", depends_on: [],                satisfies: [],            verified_by: [],            beads: ["bead:B-1"] },
      "spec:login":     { type: "spec",   path: "p", confidence: "green", depends_on: [],                satisfies: ["req:login"], verified_by: ["test:login"], beads: ["bead:B-1"] },
      "test:login":     { type: "test",   path: "p", confidence: "green", depends_on: [],                satisfies: ["req:login"], verified_by: [],            beads: ["bead:B-1"] },
      "impl:login":     { type: "impl",   path: "p", confidence: "green", depends_on: ["spec:login"],    satisfies: ["req:login"], verified_by: [],            beads: ["bead:B-1"] },
      "verify:login":   { type: "verify", path: "p", confidence: "green", depends_on: [],                satisfies: ["req:login"], verified_by: [],            beads: ["bead:B-1"] },
    },
    edges: [],
    beads: { "bead:B-1": { members: ["req:login","spec:login","test:login","impl:login","verify:login"], completeness: "full" } },
    issues: [],
    summary: { total_nodes: 5, confidence_distribution: { green: 5, amber: 0, gray: 0 }, cycles_detected: 0, missing_references: 0, orphans: 0 },
  };
}

Deno.test("traceReq: full trace for complete req", () => {
  const graph = makeGraph();
  const result = traceReq(graph, "req:login");

  assertEquals(result.req, "req:login");
  assertEquals(result.specs.length, 1);
  assertEquals(result.tests.length, 1);
  assertEquals(result.impls.length, 1);
  assertEquals(result.verifies.length, 1);
  assertEquals(result.completeness_percent, 100);
});

Deno.test("traceReq: detects missing verification dimension", () => {
  const graph = makeGraph();
  delete graph.nodes["verify:login"];

  const result = traceReq(graph, "req:login");
  assertEquals(result.verifies.length, 0);
  assert(result.completeness_percent < 100);
  assert(result.missing.includes("verify"));
});

Deno.test("traceReq: throws on unknown req", () => {
  const graph = makeGraph();
  let threw = false;
  try {
    traceReq(graph, "req:nonexistent");
  } catch (e) {
    threw = true;
    assert((e as Error).message.includes("not found"));
  }
  assert(threw);
});

Deno.test("traceReq: only spec=>req via satisfies", () => {
  const graph = makeGraph();
  // Remove satisfies link from impl
  graph.nodes["impl:login"].satisfies = [];

  const result = traceReq(graph, "req:login");
  assertEquals(result.impls.length, 0);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `deno test --allow-read claude/skills/vcsdd-lite/scripts/coherence-trace.test.ts`
Expected: FAIL（"Module not found"）

- [ ] **Step 3: GREEN — coherence-trace.ts を実装**

Create `claude/skills/vcsdd-lite/scripts/coherence-trace.ts`:

```typescript
#!/usr/bin/env -S deno run --allow-read
import { parseArgs } from "jsr:@std/cli/parse-args";
import { join } from "jsr:@std/path";
import type { CoherenceGraph, NodeType } from "./_types.ts";

const CWD = Deno.cwd();

export interface TraceResult {
  req: string;
  specs: string[];
  tests: string[];
  impls: string[];
  verifies: string[];
  missing: NodeType[];
  completeness_percent: number;
}

export function traceReq(graph: CoherenceGraph, reqId: string): TraceResult {
  if (!(reqId in graph.nodes)) {
    throw new Error(`Requirement not found: ${reqId}`);
  }

  const specs: string[] = [];
  const tests: string[] = [];
  const impls: string[] = [];
  const verifies: string[] = [];

  for (const [id, node] of Object.entries(graph.nodes)) {
    if (!node.satisfies.includes(reqId)) continue;
    switch (node.type) {
      case "spec":   specs.push(id);    break;
      case "test":   tests.push(id);    break;
      case "impl":   impls.push(id);    break;
      case "verify": verifies.push(id); break;
    }
  }

  const dims: Array<[NodeType, string[]]> = [
    ["spec", specs],
    ["test", tests],
    ["impl", impls],
    ["verify", verifies],
  ];
  const present = dims.filter(([, arr]) => arr.length > 0).length;
  const missing = dims.filter(([, arr]) => arr.length === 0).map(([t]) => t);

  return {
    req: reqId,
    specs,
    tests,
    impls,
    verifies,
    missing,
    completeness_percent: Math.round((present / 4) * 100),
  };
}

function formatMarkdown(result: TraceResult, graph: CoherenceGraph): string {
  const lines: string[] = [];
  lines.push(`# Traceability: ${result.req}\n`);

  const sections: Array<[string, string[], string]> = [
    ["✅ Specification", result.specs, "spec"],
    ["✅ Tests",          result.tests, "test"],
    ["✅ Implementation", result.impls, "impl"],
    ["✅ Verification",   result.verifies, "verify"],
  ];
  for (const [title, ids, kind] of sections) {
    const status = ids.length > 0 ? title : title.replace("✅", "❌");
    lines.push(`## ${status}`);
    if (ids.length === 0) {
      lines.push(`_(missing ${kind})_`);
    } else {
      for (const id of ids) {
        lines.push(`- \`${id}\` → ${graph.nodes[id].path}`);
      }
    }
    lines.push("");
  }
  lines.push(`## Completeness: ${result.completeness_percent}% (${4 - result.missing.length}/4 dimensions covered)`);
  return lines.join("\n");
}

if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["feature", "req", "bead", "format"],
    default: { format: "md" },
  });

  if (!args.feature || (!args.req && !args.bead)) {
    console.error("Error: --feature <name> and either --req or --bead is required");
    Deno.exit(2);
  }

  const path = join(CWD, "docs", "vcsdd", args.feature, "coherence.json");
  const graph: CoherenceGraph = JSON.parse(await Deno.readTextFile(path));

  if (args.req) {
    const result = traceReq(graph, args.req);
    if (args.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatMarkdown(result, graph));
    }
  } else if (args.bead) {
    const bead = graph.beads[args.bead];
    if (!bead) {
      console.error(`Bead not found: ${args.bead}`);
      Deno.exit(2);
    }
    if (args.format === "json") {
      console.log(JSON.stringify({ bead: args.bead, ...bead }, null, 2));
    } else {
      console.log(`# Bead: ${args.bead}\n`);
      console.log(`**Completeness**: ${bead.completeness}\n`);
      console.log(`## Members`);
      for (const id of bead.members) {
        console.log(`- \`${id}\` (${graph.nodes[id]?.type ?? "unknown"})`);
      }
    }
  }
}
```

- [ ] **Step 4: テストを再実行して GREEN を確認**

Run: `deno test --allow-read claude/skills/vcsdd-lite/scripts/coherence-trace.test.ts`
Expected: 全4テスト PASS

- [ ] **Step 5: 全テストを一括実行して回帰確認**

Run: `deno test --allow-read --allow-write claude/skills/vcsdd-lite/scripts/`
Expected: 5ファイル合計33テスト PASS

- [ ] **Step 6: コミット**

```bash
git add claude/skills/vcsdd-lite/scripts/coherence-trace.ts claude/skills/vcsdd-lite/scripts/coherence-trace.test.ts
git commit -m "feat(vcsdd-lite): implement coherence-trace script (req → 4-dim trace)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: references/coherence.md 作成

**Files:**
- Create: `claude/skills/vcsdd-lite/references/coherence.md`

- [ ] **Step 1: references/ ディレクトリ作成**

```bash
mkdir -p claude/skills/vcsdd-lite/references
```

- [ ] **Step 2: coherence.md を作成**

Create `claude/skills/vcsdd-lite/references/coherence.md`:

```markdown
# Coherence-Driven Development (CoDD) リファレンス

VCSDD-lite の核心である Coherence Engine Graph (CEG) の詳細仕様。

## CEG とは

仕様・テスト・実装・検証のノードを頂点、依存関係をエッジとする有向グラフ。frontmatter から自動構築され、変更時の影響範囲をBFSで算出する。

## ノードID命名規則

すべてのCEGノードは `<type>:<slug>` 形式の識別子を持つ。

| プレフィクス | 種別 | 例 |
|---|---|---|
| `req:` | 要件（ビジネスレベル） | `req:user-login`, `req:password-reset` |
| `spec:` | 振る舞い仕様 | `spec:auth-flow`, `spec:session-mgmt` |
| `design:` | 設計成果物（データスキーマ・UI等） | `design:user-schema`, `design:token-store` |
| `test:` | テストスイート（観点単位） | `test:auth-edge-cases`, `test:token-fuzz` |
| `impl:` | 実装モジュール | `impl:auth-service`, `impl:token-validator` |
| `verify:` | 形式検証ハーネス | `verify:prop-token-invariant` |
| `bead:` | トレーサビリティ束 | `bead:B-001-login-flow` |

## frontmatter 完全仕様

`docs/vcsdd/<feature>/specs/*.md` の冒頭：

\`\`\`yaml
---
id: spec:auth-flow
type: spec
feature: user-auth
coherence:
  depends_on:
    - design:user-schema
  satisfies:
    - req:user-login
  verified_by:
    - test:auth-edge-cases
  beads:
    - bead:B-001-login-flow
confidence: green
status: draft
last_reviewed: 2026-05-19
---
\`\`\`

### フィールド意味

| フィールド | 必須 | 意味 |
|---|---|---|
| `id` | ✅ | ノードIDの正規形（feature内で一意） |
| `type` | ✅ | `req`/`spec`/`design`/`test`/`impl`/`verify` |
| `feature` | ✅ | フィーチャー名 |
| `coherence.depends_on` | ⚪ | 上流ノード |
| `coherence.satisfies` | ⚪ | このノードが満たす上位要件 |
| `coherence.verified_by` | ⚪ | このノードを検証する下流ノード |
| `coherence.beads` | ⚪ | 所属するtraceabilityバンドル |
| `confidence` | ⚪ | scan結果上書き可能 |
| `status` | ⚪ | レビューゲート通過状態（`draft`/`reviewed`/`locked`） |
| `last_reviewed` | ⚪ | ISO日付 |

## 信頼度バンド判定ルール

scan-scriptが各ノードの `confidence` を以下のルールで自動評価。手動指定（frontmatterの `confidence`）が常に優先される。

| バンド | 条件 |
|---|---|
| 🟢 Green | `type=spec` の場合：`satisfies` ≥1個 かつ `verified_by` ≥1個 かつ全参照解決済み |
| 🟡 Amber | 参照は解決するが束（bead）が不完全 |
| ⚫ Gray | 参照解決エラーあり / orphan / 一切のbead未所属 |

## 整合性違反の種類

`coherence-validate.ts` が検出する問題：

| kind | severity | 説明 |
|---|---|---|
| `missing_reference` | error | 存在しないノードへの参照 |
| `cycle` | error | A→B→...→A の循環依存（depends_onのみ） |
| `orphan` | warning | 誰からも参照されないノード（要件以外） |
| `type_mismatch` | warning | verified_by の to が test/verify でない |
| `incomplete_bead` | info | beadメンバーが req/spec/test/impl/verify を全て含まない |
| `gray_in_locked_spec` | warning | `status:locked` かつ `confidence:gray` |

## 影響伝播 BFS アルゴリズム

\`coherence-impact.ts\` の擬似コード：

\`\`\`
inverse_adj = build_inverse_adjacency(graph)
visited = {root}
queue = [(target, "depends_on→...", 1) for each (target, kind) in inverse_adj[root]]

while queue not empty:
  next_layer = []
  for (node, via, depth) in queue:
    if node in visited or depth > maxDepth: continue
    visited.add(node)
    affected[f"depth_{depth}"].append({id: node, via: via, confidence: ...})
    for (incoming, kind) in inverse_adj[node]:
      next_layer.append((incoming, f"{node}→{kind}", depth + 1))
  queue = next_layer
\`\`\`

**注意**: edge方向は「上流→下流」ではない。**変更ノードに依存する側を遡る**ため、逆BFS。

## 循環検出アルゴリズム

`coherence-validate.ts` は DFS による back-edge 検出を使用：

1. `depends_on` エッジのみで隣接リスト構築（他のkindは循環判定の対象外）
2. 全ノードを起点として visited / recursion-stack を管理しながらDFS
3. 既にスタックに乗っているノードに到達したら循環確定
4. 最初に見つかった循環パスを返却（複数循環があっても1つだけレポート）

## なぜ depends_on のみ循環チェックか

`satisfies` / `verified_by` は意味的にも構造的にも別軸：
- `satisfies`: 多対一（複数のspecが同じreqを満たす）の関係。循環してても矛盾ではない
- `verified_by`: 検証側を指す逆向き。循環は「相互検証」の意味になり得る

`depends_on` のみが「ビルド/参照順序の依存」を表現し、循環があれば本当に壊れる。

## bead identifier

要件→spec→test→impl→verify の全次元を一つの束ねIDで紐付ける概念。

- 単一の bead が `req` / `spec` / `test` / `impl` / `verify` の5タイプを含む場合 `completeness: full`
- いずれか欠落していれば `partial` で `incomplete_bead` issue を生成

トレース時は `--bead` 指定で全メンバーをタイプ別表示、`--req` 指定で関連 spec/test/impl/verify を逆引き表示。

## scan出力 JSON スキーマ

`$schema: vcsdd-lite-coherence-v1` バージョン。詳細は `scripts/_types.ts` を参照。
```

- [ ] **Step 3: コミット**

```bash
git add claude/skills/vcsdd-lite/references/coherence.md
git commit -m "docs(vcsdd-lite): add coherence reference (CEG model, BFS, cycle detection)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: references/strict-vs-lean.md 作成

**Files:**
- Create: `claude/skills/vcsdd-lite/references/strict-vs-lean.md`

- [ ] **Step 1: strict-vs-lean.md を作成**

Create `claude/skills/vcsdd-lite/references/strict-vs-lean.md`:

```markdown
# VCSDD-lite モード: lean vs strict

VCSDD-lite には 2つの運用モードがある。Phase 1 開始時に決定し、coherence.json の `mode` フィールドに記録される。

## 比較表

| 項目 | lean | strict |
|---|---|---|
| Sprint契約（事前約束書） | リスク時のみ | 必須（Phase 3前に作成） |
| 契約レビュー（Adversary） | オプション | 必須 |
| 敵対的レビュー反復回数 | 最大3回 | 最大5回 |
| 形式検証（Phase 5） | 選択的（高リスクのみ） | 必須 |
| coherence-validate `--strict` フラグ | OFF推奨 | ON推奨（warningsもfail扱い） |
| `status: locked` の運用 | spec確定時のみ | レビュー通過の各次元で適用 |
| 自動コミット（git tag） | しない | しない（plugin限定の機能） |

## 適用判断

### lean を使うべきケース

- プロトタイプ
- 個人ツール
- MVP段階のプロダクト
- 1-3人のチーム
- イテレーション速度優先

### strict を使うべきケース

- 金融・決済システム
- 認証・認可・暗号化コンポーネント
- インフラ・ネットワークレイヤ
- ライフセーフティ（医療・自動運転）
- 長期保守される基盤コード（5年以上）
- 規制対応（GDPR/PCI-DSS等）

## Sprint契約（strict mode）

Phase 3 の敵対的レビュー前に Builder が以下を明文化：

\`\`\`markdown
# Sprint Contract: <feature> Phase 3

## Pre-Conditions
- 前提とする状態
- 期待される入力

## Post-Conditions
- 保証する出力
- 不変条件

## Out of Scope
- 今回は対応しないこと
- 将来のフェーズに先送りする項目

## Acceptance Criteria
- Phase 3 通過の客観的判断基準
- ベンチマーク数値
- カバレッジ閾値
\`\`\`

Adversary は契約を起点に「この契約自体が守られているか」を検証する。契約のないコードは攻撃対象が定まらず、レビュー精度が落ちる。

## モード切替

lean → strict への昇格は許される。逆（strict → lean）は禁止：

- 一度 locked になった spec を draft に戻すと依存追跡が破綻する
- カバレッジ要求を緩めると後続フィーチャーの整合性が崩れる

新フィーチャー単位でのみ lean を選択可能。既存 strict フィーチャーから派生する場合も strict 継承が原則。
```

- [ ] **Step 2: コミット**

```bash
git add claude/skills/vcsdd-lite/references/strict-vs-lean.md
git commit -m "docs(vcsdd-lite): add strict-vs-lean mode reference

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: references/trace-templates.md 作成

**Files:**
- Create: `claude/skills/vcsdd-lite/references/trace-templates.md`

- [ ] **Step 1: trace-templates.md を作成**

Create `claude/skills/vcsdd-lite/references/trace-templates.md`:

```markdown
# Trace Templates

bead identifier 命名規則とトレーサビリティ表のテンプレート集。

## bead 命名規則

形式: `bead:B-<連番3桁>-<スラッグ>`

例:
- `bead:B-001-login-flow`
- `bead:B-002-password-reset`
- `bead:B-003-mfa-enrollment`

### スラッグの書き方

- 小文字 kebab-case
- ビジネス要件の名称を反映（実装詳細ではなく）
- 3〜5単語以内

良い例: `bead:B-001-login-flow`、`bead:B-007-billing-cycle`
悪い例: `bead:B-001-LoginController`（実装詳細）、`bead:B-002-fix-bug`（変更内容）

## 連番管理

- フィーチャー単位ではなく**プロジェクト全体で連番**
- 削除されたbead番号は欠番のまま再利用しない
- 100番台 = コア機能、200番台 = サポート機能、等のセマンティック区分も任意で可

## トレーサビリティ表テンプレート

`docs/vcsdd/<feature>/traceability.md` に作成（任意、scan結果で十分なら省略可）:

\`\`\`markdown
# Traceability Matrix: <feature>

| Bead | Requirement | Spec | Tests | Impl | Verify | Status |
|------|-------------|------|-------|------|--------|--------|
| `bead:B-001-login-flow` | `req:user-login` | `spec:auth-flow` | `test:auth-edge-cases`, `test:auth-fuzz` | `impl:auth-service` | `verify:prop-token-invariant` | 🟢 Full |
| `bead:B-002-password-reset` | `req:password-reset` | `spec:password-reset-flow` | `test:reset-edge-cases` | `impl:reset-service` | _missing_ | 🟡 Partial |
\`\`\`

## Phase完了時のチェックリスト

各Phase完了時に bead 単位で確認：

\`\`\`markdown
## Phase 6 Convergence Check: <feature>

For each bead in feature:
- [ ] req member exists and is reviewed
- [ ] spec member exists, status: locked, confidence: green
- [ ] test member exists, all tests green, mutation score > 80%
- [ ] impl member exists, no TODO/FIXME
- [ ] verify member exists, all properties passed

If any bead has `partial` completeness, justify why and update spec/refs.
\`\`\`

## CLI による自動トレース

手動表を書く前に、まず `coherence-trace.ts` で機械生成を試す：

\`\`\`bash
deno run --allow-read ~/.claude/skills/vcsdd-lite/scripts/coherence-trace.ts \\
  --feature user-auth --req req:user-login --format md > traceability-snippet.md
\`\`\`

このsnippetをコピーして traceability.md に貼り、必要なら手動で補強する。
```

- [ ] **Step 2: コミット**

```bash
git add claude/skills/vcsdd-lite/references/trace-templates.md
git commit -m "docs(vcsdd-lite): add trace templates reference (bead naming, matrices)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: SKILL.md — frontmatter更新 + Verifierロール + モードセクション追加

**Files:**
- Modify: `claude/skills/vcsdd-lite/SKILL.md`

- [ ] **Step 1: 既存 frontmatter を新仕様に置換**

Edit `claude/skills/vcsdd-lite/SKILL.md`, replace lines 1-4 (`---\nname: vsdd\n...\n---`) with:

```yaml
---
name: vcsdd-lite
description: VSDD（仕様駆動+TDD+敵対的検証+形式検証）にCoherence-Driven Development（CoDD）を統合した軽量パイプライン。仕様・テスト・実装・検証の依存グラフ（CEG）を追跡し、変更時の影響範囲を自動分析。正確性が重要なシステム（金融・インフラ・セキュリティ等）の開発に使用。「VCSDDで開発」「coherence チェック」「影響範囲分析」「仕様駆動で実装」「形式検証付きで開発」「VSDDで開発」「adversarial reviewして」で起動。
---
```

- [ ] **Step 2: Verifierロールを「ロール定義」セクションに追加**

Edit `claude/skills/vcsdd-lite/SKILL.md`, find the table starting with `| ロール | 担当 | 機能 |` and replace it with:

```markdown
| ロール | 担当 | 機能 |
|--------|------|------|
| **Architect** | 人間（開発者） | 戦略的ビジョン、ドメイン専門知識、仕様承認、紛争調停 |
| **Builder** | Claude（メインAI） | 仕様作成、テスト生成、コード実装、リファクタリング、CEG構築 |
| **Adversary** | 別モデル or 別コンテキスト | 容赦なき批判的レビュー。仕様・テスト・実装・CEG整合性すべてを攻撃 |
| **Verifier** | Builderと別コンテキスト or 別モデル | 形式検証ツールのコーディネート、プロパティテスト・ファジング実行管理 |
```

- [ ] **Step 3: 「適用判断」の後にモードセクションを挿入**

Edit `claude/skills/vcsdd-lite/SKILL.md`, after the section `## 適用判断` (and its content), insert before `## コアワークフロー`:

```markdown
## モード（lean / strict）

VCSDD-lite は2つの運用モードを持つ。Phase 1 開始時に決定し、`docs/vcsdd/<feature>/coherence.json` の `mode` フィールドに記録される。

| モード | 用途 | 厳格度 |
|---|---|---|
| **lean** | プロトタイプ、MVP、個人プロジェクト | Sprint契約・形式検証は選択的 |
| **strict** | 金融・認証・インフラ・長期保守コード | Sprint契約・形式検証・敵対的レビュー全て必須 |

詳細は **references/strict-vs-lean.md** を参照。

```

- [ ] **Step 4: 型チェック & コミット**

Run: `git diff claude/skills/vcsdd-lite/SKILL.md | head -50`
Expected: name変更、Verifier追加、モード節追加が反映されている

```bash
git add claude/skills/vcsdd-lite/SKILL.md
git commit -m "feat(vcsdd-lite): update SKILL.md frontmatter, add Verifier role, add mode section

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: SKILL.md — Phase 1c Coherence Mapping 追加 + 1c→1d renumber

**Files:**
- Modify: `claude/skills/vcsdd-lite/SKILL.md`

- [ ] **Step 1: 既存の "#### 1c: 仕様レビューゲート" を "#### 1d: 仕様レビューゲート" にリネーム**

Edit `claude/skills/vcsdd-lite/SKILL.md`, find `#### 1c: 仕様レビューゲート` and replace `1c:` with `1d:` (single occurrence).

- [ ] **Step 2: 1d の直前に 1c Coherence Mapping セクションを挿入**

Edit `claude/skills/vcsdd-lite/SKILL.md`, before `#### 1d: 仕様レビューゲート`, insert:

```markdown
#### 1c: Coherence Mapping（CoDD核心）

**仕様・テスト・実装・検証の依存関係をCEGに登録する。**

##### frontmatter の必須化

`docs/vcsdd/<feature>/specs/*.md` の冒頭に必ず以下のfrontmatterを付与：

\`\`\`yaml
---
id: spec:<slug>
type: spec
feature: <feature-name>
coherence:
  depends_on: [...]   # 上流ノード
  satisfies: [...]    # 満たす要件
  verified_by: [...]  # 検証するtest/verify
  beads: [...]        # トレース束
---
\`\`\`

詳細は **references/coherence.md** を参照。

##### CEG構築

\`\`\`bash
deno run --allow-read --allow-write \\
  ~/.claude/skills/vcsdd-lite/scripts/coherence-scan.ts --feature <feature>
\`\`\`

`docs/vcsdd/<feature>/coherence.json` が生成される。

##### Phase 1c 完了条件

- 全 spec ファイルに frontmatter が付与されている
- `coherence-scan.ts` が成功（エラーなく完了）
- `coherence-validate.ts` の verdict が `pass` または errors=0 のみ
- 信頼度バンドの green が全 spec の80%以上

```

- [ ] **Step 3: 確認 & コミット**

Run: `grep -n "^#### 1[a-d]:" claude/skills/vcsdd-lite/SKILL.md`
Expected:
```
:1a: 振る舞い仕様（Behavioral Specification）
:1b: 検証アーキテクチャ（Verification Architecture）
:1c: Coherence Mapping（CoDD核心）
:1d: 仕様レビューゲート
```

```bash
git add claude/skills/vcsdd-lite/SKILL.md
git commit -m "feat(vcsdd-lite): add Phase 1c Coherence Mapping, renumber existing 1c→1d

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: SKILL.md — Phase 4 影響伝播 + Phase 6 CEG整合性 強化

**Files:**
- Modify: `claude/skills/vcsdd-lite/SKILL.md`

- [ ] **Step 1: Phase 4 の末尾に影響伝播分析セクションを追記**

Edit `claude/skills/vcsdd-lite/SKILL.md`, find the section `### Phase 4 — フィードバック統合ループ` and at the end of the table/content (before `### Phase 5 — 形式硬化`), insert:

```markdown

#### 4a: 影響伝播分析（CoDD強化）

Adversaryが仕様レベル欠陥を指摘した場合、修正が他ノードに波及するかをCEGで確認：

\`\`\`bash
deno run --allow-read \\
  ~/.claude/skills/vcsdd-lite/scripts/coherence-impact.ts \\
  --feature <feature> --node <changed-node-id> --format md
\`\`\`

影響範囲に含まれる全ノードを再レビュー対象とする。影響伝播BFSアルゴリズムの詳細は **references/coherence.md** を参照。

```

- [ ] **Step 2: Phase 6 の表に CEG整合性ディメンションを追加**

Edit `claude/skills/vcsdd-lite/SKILL.md`, find the table starting with `| 次元 | 収束シグナル |` in `### Phase 6 — 収束（Convergence）` and replace it with:

```markdown
| 次元 | 収束シグナル |
|------|-------------|
| **仕様** | Adversaryの指摘が表現の微修正レベルに留まる |
| **テスト** | Adversaryが意味のある未テストシナリオを見つけられない。ミューテーションテストの殺傷率が高い |
| **実装** | Adversaryがコードに存在しない問題を捏造し始める |
| **検証** | Phase 1bカタログのすべてのプロパティが形式証明を通過。ファザーが何も見つけない。純粋境界が維持 |
| **CEG整合性** | `coherence-validate.ts --strict` が exit code 0、全 spec が confidence: green、bead completeness: full |
```

- [ ] **Step 3: Phase 6 完了基準として scripts 実行を明示**

Edit `claude/skills/vcsdd-lite/SKILL.md`, find `**Maximum Viable Refinement** 到達 = **Zero-Slop** ソフトウェア。` and insert before it:

```markdown
**Phase 6 自動チェック**:
\`\`\`bash
deno run --allow-read --allow-write \\
  ~/.claude/skills/vcsdd-lite/scripts/coherence-scan.ts --feature <feature>
deno run --allow-read \\
  ~/.claude/skills/vcsdd-lite/scripts/coherence-validate.ts --feature <feature> --strict
\`\`\`

両方がexit 0で完了し、かつ4次元すべてが独立して敵対的レビューを生存したときに完了。

```

- [ ] **Step 4: コミット**

```bash
git add claude/skills/vcsdd-lite/SKILL.md
git commit -m "feat(vcsdd-lite): strengthen Phase 4 (impact analysis) and Phase 6 (CEG check)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: SKILL.md — scripts使用法 + トレーサビリティ + 出力パス更新

**Files:**
- Modify: `claude/skills/vcsdd-lite/SKILL.md`

- [ ] **Step 1: 「コアワークフロー」の後・「トレーサビリティチェーン」の前に Coherenceスクリプト使用法セクションを挿入**

Edit `claude/skills/vcsdd-lite/SKILL.md`, find `## トレーサビリティチェーン` (which currently exists in original vsdd skill) and insert before it:

```markdown
## Coherence スクリプト使用法

VCSDD-lite は CEG 操作のために4つの Deno TypeScript スクリプトを提供する。

### スクリプト一覧

| スクリプト | 用途 | 主要オプション |
|---|---|---|
| `coherence-scan.ts` | frontmatter → coherence.json 生成 | `--feature <name>` `--out <path>` `--mode lean\|strict` `--dry-run` |
| `coherence-validate.ts` | 整合性違反検出（6種類） | `--feature <name>` `--strict` `--format json\|md` |
| `coherence-impact.ts` | 影響範囲BFS分析 | `--feature <name>` `--node <id>` `--depth <N>` `--format md` |
| `coherence-trace.ts` | req → spec/test/impl/verify トレース | `--feature <name>` `--req <id>` または `--bead <id>` |

### 共通仕様

- 作業ディレクトリ: プロジェクトルート（`docs/vcsdd/` がある場所）
- Exit code: `0` 成功 / `1` validation error / `2` usage error
- 全スクリプトは `--allow-read`（書き込みする scan は `--allow-write` も）が必要

### 典型的な実行フロー

\`\`\`bash
# 1. CEG構築
deno run --allow-read --allow-write \\
  ~/.claude/skills/vcsdd-lite/scripts/coherence-scan.ts --feature user-auth

# 2. 整合性チェック
deno run --allow-read \\
  ~/.claude/skills/vcsdd-lite/scripts/coherence-validate.ts --feature user-auth --format md

# 3. 影響範囲確認（仕様変更時）
deno run --allow-read \\
  ~/.claude/skills/vcsdd-lite/scripts/coherence-impact.ts \\
  --feature user-auth --node design:user-schema --format md

# 4. 要件トレース
deno run --allow-read \\
  ~/.claude/skills/vcsdd-lite/scripts/coherence-trace.ts \\
  --feature user-auth --req req:user-login
\`\`\`

### テスト

\`\`\`bash
deno test --allow-read --allow-write ~/.claude/skills/vcsdd-lite/scripts/
\`\`\`

```

- [ ] **Step 2: 既存「トレーサビリティチェーン」セクションを bead identifier 概念で拡張**

Edit `claude/skills/vcsdd-lite/SKILL.md`, find the section `## トレーサビリティチェーン` and replace its content with:

```markdown
## トレーサビリティチェーン

VCSDD-liteの全成果物は **bead identifier** で双方向に追跡可能：

\`\`\`
仕様要件 → 検証プロパティ → テストケース → 実装 → 敵対的レビュー → 形式証明
                    ↑
              bead:B-XXX-<slug> で全次元を束ねる
\`\`\`

- 「このコード行はなぜ存在するか？」→ bead経由で要件まで遡れる
- 「このモジュールはなぜ純粋関数か？」→ Phase 1bの純粋境界マップに遡れる
- `coherence-trace.ts --req <id>` で機械的にトレース表を生成可能

bead 命名規則と表テンプレートは **references/trace-templates.md** を参照。

```

- [ ] **Step 3: 「出力ファイル」セクションのパスを `docs/vcsdd/<feature>/` レイアウトに更新**

Edit `claude/skills/vcsdd-lite/SKILL.md`, find `## 出力ファイル` section and replace its first lines with:

```markdown
## 出力ファイル

VCSDD-lite は機能ごとに以下のディレクトリ構造を生成する：

\`\`\`
docs/vcsdd/<feature>/
├── specs/                    # 振る舞い仕様（frontmatter必須）
│   ├── behavioral-spec.md
│   └── verification-arch.md
├── coherence.json            # CEG（coherence-scan.ts が生成）
├── reviews/                  # 敵対的レビュー記録
│   └── sprint-N-review.md
├── evidence/                 # Phase 2a/2b 証拠
│   ├── red-phase.log
│   └── green-phase.log
├── verification/             # Phase 5 形式検証結果
│   └── prop-results.md
└── traceability.md           # 手動補強したトレース表（任意）
\`\`\`

旧テンプレート（参考）:

- `docs/vsdd-spec-[feature].md` → `docs/vcsdd/<feature>/specs/behavioral-spec.md`
- `docs/vsdd-review-[YYYY-MM-DD].md` → `docs/vcsdd/<feature>/reviews/sprint-N-review.md`

```

- [ ] **Step 4: SKILL.md 全体行数を確認**

Run: `wc -l claude/skills/vcsdd-lite/SKILL.md`
Expected: 460-510 行（既存412 + 追加70 ±誤差）

- [ ] **Step 5: コミット**

```bash
git add claude/skills/vcsdd-lite/SKILL.md
git commit -m "feat(vcsdd-lite): add scripts usage, expand traceability, update output paths

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: 全テスト + 型チェック + 手動E2Eテスト

**Files:**
- Create (temporary): `docs/vcsdd/example-feature/specs/example.md`

- [ ] **Step 1: 全 Deno テストを実行**

Run: `deno test --allow-read --allow-write claude/skills/vcsdd-lite/scripts/`
Expected: 全テスト PASS（合計 33 テスト程度）

- [ ] **Step 2: 全スクリプトの型チェック**

Run: `deno check claude/skills/vcsdd-lite/scripts/*.ts`
Expected: エラーなし

- [ ] **Step 3: カバレッジ取得**

```bash
rm -rf coverage && deno test --allow-read --allow-write --coverage=coverage claude/skills/vcsdd-lite/scripts/
deno coverage coverage --include='claude/skills/vcsdd-lite/scripts/coherence-' --include='claude/skills/vcsdd-lite/scripts/_frontmatter'
```
Expected: line coverage 80% 以上

- [ ] **Step 4: サンプルfeature作成**

```bash
mkdir -p docs/vcsdd/example-feature/specs
```

Create `docs/vcsdd/example-feature/specs/example.md`:

```markdown
---
id: spec:example-flow
type: spec
feature: example-feature
coherence:
  depends_on:
    - design:example-schema
  satisfies:
    - req:example-action
  verified_by:
    - test:example-cases
  beads:
    - bead:B-999-example
confidence: green
status: draft
---

# Example Flow Specification

This is a demonstration spec for verifying the vcsdd-lite scripts.
```

- [ ] **Step 5: scan を実行**

Run: `deno run --allow-read --allow-write claude/skills/vcsdd-lite/scripts/coherence-scan.ts --feature example-feature`
Expected: `Wrote docs/vcsdd/example-feature/coherence.json`

- [ ] **Step 6: validate を実行**

Run: `deno run --allow-read claude/skills/vcsdd-lite/scripts/coherence-validate.ts --feature example-feature --format md`
Expected: missing_reference warning（design:example-schema 等が存在しないため）を含む人間可読出力

- [ ] **Step 7: impact を実行**

Run: `deno run --allow-read claude/skills/vcsdd-lite/scripts/coherence-impact.ts --feature example-feature --node spec:example-flow --format md`
Expected: `# Impact Analysis: spec:example-flow` ヘッダ + 空または該当ノード一覧

- [ ] **Step 8: trace を実行**

Run: `deno run --allow-read claude/skills/vcsdd-lite/scripts/coherence-trace.ts --feature example-feature --req req:example-action`
Expected: `# Traceability: req:example-action` + spec/test/impl/verify 各次元の存在状況表示

- [ ] **Step 9: サンプルfeature削除**

```bash
rm -rf docs/vcsdd/example-feature
```

- [ ] **Step 10: 何もコミットせず（一時ファイル削除のみ）、次タスクへ**

Run: `git status`
Expected: clean working tree

---

### Task 17: install.sh Deno警告追加 + 最終検証

**Files:**
- Modify: `claude/install.sh`

- [ ] **Step 1: install.sh の末尾近くに Deno 警告ブロックを追加**

Edit `claude/install.sh`, find the last `if [[ ! -e $MCP_CONFIG_FILE ]]; then` block, and after the final `fi` closing that block, append:

```bash

# Optional dependency check for vcsdd-lite skill scripts
if ! command -v deno &> /dev/null; then
  echo ""
  echo "Note: 'deno' not found. vcsdd-lite skill scripts (coherence-scan/validate/impact/trace) require Deno."
  echo "Install: curl -fsSL https://deno.land/install.sh | sh"
  echo "(The vcsdd-lite skill itself works without scripts — they are optional automation.)"
fi
```

- [ ] **Step 2: install.sh の構文を bash で検証**

Run: `bash -n claude/install.sh`
Expected: 出力なし（構文エラーなし）

- [ ] **Step 3: 最終的なファイル構成を確認**

Run:
```bash
ls -R claude/skills/vcsdd-lite/ | head -40
ls claude/skills/vsdd 2>&1
```
Expected:
- `claude/skills/vcsdd-lite/` 配下に `SKILL.md`, `references/` (3 files), `scripts/` (12 files + fixtures/)
- `ls claude/skills/vsdd` は "No such file or directory"

- [ ] **Step 4: git log で履歴追跡可能か確認**

Run: `git log --follow --oneline claude/skills/vcsdd-lite/SKILL.md | head -5`
Expected: 最低5コミット以上の履歴。最古コミットがVSDD時代の `feat: add VSDD (Verified Spec-Driven Development) skill`

- [ ] **Step 5: SKILL.md トリガーの確認**

Run: `grep -c "VCSDD\|VSDD\|coherence" claude/skills/vcsdd-lite/SKILL.md`
Expected: 5以上（description + 各セクション）

- [ ] **Step 6: 完了基準 — 全テスト最終実行**

Run: `deno test --allow-read --allow-write claude/skills/vcsdd-lite/scripts/`
Expected: 全テスト PASS

- [ ] **Step 7: コミット**

```bash
git add claude/install.sh
git commit -m "chore: add Deno availability warning to install.sh for vcsdd-lite

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 8: 完了報告**

実装完了。以下を確認：
- ✅ 17 タスク完遂
- ✅ 旧 `vsdd` → `vcsdd-lite` リネーム（git履歴維持）
- ✅ 4 coherence スクリプト + 2 ヘルパー + 5 テストファイル + 5 fixture シナリオ
- ✅ references/ 3 ファイル
- ✅ SKILL.md に Phase 1c / 4a / 6 強化を反映
- ✅ install.sh に Deno 警告追加
- ✅ `deno test` 全 pass, line coverage 80%+
- ✅ 手動 E2E（scan→validate→impact→trace）成功

---

## 完了基準

実装が完了したと言える条件（spec の Section 5.6 完了基準より転記）：

- [ ] `vcsdd-lite` がスキル一覧に出現
- [ ] 起動トリガー有効（"VCSDDで開発" "coherenceチェック" "VSDDで開発"）
- [ ] Phase 1c が SKILL.md にある（`grep "Coherence Mapping" claude/skills/vcsdd-lite/SKILL.md`）
- [ ] 4スクリプト + 2ヘルパーが型チェック通過（`deno check scripts/*.ts`）
- [ ] 全自動テスト pass（`deno test --allow-read --allow-write claude/skills/vcsdd-lite/scripts/` exit 0）
- [ ] カバレッジ 80% 以上（`deno coverage` で確認）
- [ ] 手動E2E成功（scan→validate→impact→trace）
- [ ] 旧 `claude/skills/vsdd/` ディレクトリ削除
- [ ] git履歴追跡可能（`git log --follow` でVSDD時代まで辿れる）
