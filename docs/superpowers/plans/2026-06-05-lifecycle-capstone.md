# Lifecycle Capstone (SP5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A docs-only capstone that ties SP1-4 into one self-evolving-skills lifecycle map — a canonical `docs/self-evolving-skills.md` overview + a consolidated CLAUDE.md section.

**Architecture:** No code. Create one overview document (lifecycle diagram + tool table + 4-role table + data flow + index of SP1-4 specs/plans), then add a `### Self-Evolving Skills` section to CLAUDE.md and trim the now-overloaded lifecycle paragraph so detail lives in the overview doc.

**Tech Stack:** Markdown. Verification via `test -f` (link targets), `grep`, and confirming code is unchanged (validate-skill / catalog-skills / reviewing-skills still green).

**Spec:** `docs/superpowers/specs/2026-06-05-lifecycle-capstone-design.md`

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `docs/self-evolving-skills.md` | Canonical lifecycle map + 4-role table + index (the deliverable) |
| `CLAUDE.md` | Add `### Self-Evolving Skills` section; trim the overloaded lifecycle paragraph |

No executable code → no unit tests. "Tests" are: link targets exist, CLAUDE.md greps pass, and code stays green (no `.ts`/skill `.md` touched).

> NOTE FOR ALL TASKS: documentation feature. Do NOT invent unit tests or run `deno test` for new behavior. Verification steps are `test -f`, `grep`, and the unchanged-code checks.

---

## Task 1: The overview document

**Files:**
- Create: `docs/self-evolving-skills.md`

- [ ] **Step 1: Write the overview document**

Create `docs/self-evolving-skills.md` with EXACTLY this content:

````markdown
# Self-Evolving Skills

このリポジトリのスキルエコシステムに [MUSE-Autoskill](https://arxiv.org/html/2605.27366v1)（Self-Evolving Agents via Skill Creation, Memory, Management, and Evaluation）を適用した全体像。スキルを「使い捨ての成果物」ではなく、**経験を蓄積し改善され続ける長寿命の資産**として扱う。

## 制約と方針

論文はエージェントの**ランタイム**が `create → evaluate → register → remember → refine → manage` を回す機構を提案する。この repo は**ランタイムではなく設定資産（dotfiles）**なので、同じループを **コマンド・規約・フック・索引文書の協調**として実現する。ランタイム自動実行は持たず、**編集の確定は常に人の関門 `/commit` を通す**（破壊的変更をレビュー無しで確定させない）。

## ライフサイクル

```
create ─▶ evaluate ─▶ register ─▶ remember ─▶ refine ─▶ manage
  │                                                        │
  └──────────────────────── ループ ───────────────────────┘

create    : /create-skill（スキルの誕生）
evaluate  : validate-skill（決定論ゲート）＋ reviewing-skills（LLM 定性）
register  : /commit（人の関門で確定）
remember  : skill-memory フックが .memory.md を注入・蓄積
refine    : /refine-skill = refining-skills（SKILL.md 改善＋lessons.md 昇格）
manage    : /skill-catalog = catalog-skills（advisory 俯瞰・refine 推奨）
```

manage（catalog）が「どのスキルを refine すべきか」を示し、refine→evaluate と回ることでループが閉じる。

## 道具一覧

| 道具 | ステージ | 消費 → 生成 | 起動 | 権限 |
|------|---------|------------|------|------|
| `/create-skill` | Creation | 要件 → 新スキル | コマンド | — |
| `skill-memory.ts` フック | Memory | スキル使用 → `.memory.md` 注入 | PostToolUse 自動 | `--allow-env --allow-read` |
| `validate-skill.ts` | Evaluation | SKILL.md → PASS/FAIL（構造＋scripts テスト） | `/create-skill` ゲート / 手動 | `--allow-read --allow-run` |
| `refining-skills` | Refinement | validate＋`.memory.md` → SKILL.md 改善＋`lessons.md` 昇格 | `/refine-skill` | （判断・編集） |
| `catalog-skills.ts` | Management | validate(Tier-1)＋`.memory.md`＋fs → 健全性表＋推奨 | `/skill-catalog` | `--allow-read --allow-env` |

## 4つの役割（＋メモリ）

| 役割 | 道具 | 性質 | 終了コード |
|------|------|------|-----------|
| **gate** | `validate-skill` | 決定論ゲート（通らなければブロック） | 0 / 1 / 2 |
| **action** | `refining-skills` | 既存スキルを経験駆動で改善 | — |
| **management** | `catalog-skills` | 全スキルの advisory 俯瞰 | 常に 0 |
| **qualitative** | `reviewing-skills` | LLM 定性レビュー | — |
| memory | `skill-memory.ts` フック | スキル固有の経験を注入 | （fail-open） |

## データフロー

1. **remember**: スキル使用時にフックが `~/.claude/skills/<name>/.memory.md` を注入。失敗・入力の癖・Tips が蓄積される（gitignore・私的・マシンローカル）。
2. **manage**: `/skill-catalog` が `validate-skill`(Tier-1)＋`.memory.md`＋fs を集約し、要 refine スキル（Warning または Failure Modes あり）と重複候補を advisory に提示する。
3. **refine**: `/refine-skill` が validate の Warning ＋ `.memory.md` をシグナルに SKILL.md を改善し、普遍的な教訓を `references/lessons.md`（committed）へ昇格、`.memory.md` から prune する。
4. **register**: 改善は編集まで。確定はユーザーが `/commit`（committer）で行う。

## 索引（各 SP の設計と計画）

| SP | ステージ | spec | plan |
|----|---------|------|------|
| SP1 | Memory | [per-skill-memory-design](superpowers/specs/2026-06-05-per-skill-memory-design.md) | [per-skill-memory](superpowers/plans/2026-06-05-per-skill-memory.md) |
| SP2 | Evaluation | [skill-test-gate-design](superpowers/specs/2026-06-05-skill-test-gate-design.md) | [skill-test-gate](superpowers/plans/2026-06-05-skill-test-gate.md) |
| SP3 | Refinement | [skill-refinement-design](superpowers/specs/2026-06-05-skill-refinement-design.md) | [skill-refinement](superpowers/plans/2026-06-05-skill-refinement.md) |
| SP4 | Management | [skill-catalog-design](superpowers/specs/2026-06-05-skill-catalog-design.md) | [skill-catalog](superpowers/plans/2026-06-05-skill-catalog.md) |
| SP5 | Capstone | [lifecycle-capstone-design](superpowers/specs/2026-06-05-lifecycle-capstone-design.md) | [lifecycle-capstone](superpowers/plans/2026-06-05-lifecycle-capstone.md) |

## ステータス

SP1-5 完了・master マージ済み。Creation は既存の `/create-skill` が担う。論文の Memory / Evaluation / Refinement / Management が揃い、本文書がそれを1つの自己進化ループとして提示する。
````

(The outer ```` ```markdown ```` fence delimits this prompt only. The FILE content starts at `# Self-Evolving Skills` and ends at the last status line. The file legitimately CONTAINS one inner triple-backtick fence around the lifecycle ASCII block — keep it. Do not wrap the whole file in an extra fence.)

- [ ] **Step 2: Verify the file exists and all index links resolve**

Run (from repo root):
```bash
test -f docs/self-evolving-skills.md && echo "doc OK"
for f in \
  docs/superpowers/specs/2026-06-05-per-skill-memory-design.md \
  docs/superpowers/plans/2026-06-05-per-skill-memory.md \
  docs/superpowers/specs/2026-06-05-skill-test-gate-design.md \
  docs/superpowers/plans/2026-06-05-skill-test-gate.md \
  docs/superpowers/specs/2026-06-05-skill-refinement-design.md \
  docs/superpowers/plans/2026-06-05-skill-refinement.md \
  docs/superpowers/specs/2026-06-05-skill-catalog-design.md \
  docs/superpowers/plans/2026-06-05-skill-catalog.md \
  docs/superpowers/specs/2026-06-05-lifecycle-capstone-design.md \
  docs/superpowers/plans/2026-06-05-lifecycle-capstone.md \
; do test -f "$f" && echo "OK $f" || echo "MISSING $f"; done
```
Expected: `doc OK` and every link target `OK ...` (no `MISSING`). The link paths in the doc are relative to `docs/` (e.g. `superpowers/specs/...`), and the targets are listed here relative to the repo root (`docs/superpowers/...`) — both point at the same files.

- [ ] **Step 3: Commit**

```bash
git add docs/self-evolving-skills.md
git commit -m "docs: add self-evolving-skills lifecycle overview (SP5 capstone)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: CLAUDE.md consolidation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the `### Self-Evolving Skills` section**

In `CLAUDE.md`, find this heading (it is the SP1 memory section, currently around line 329):
```markdown
### Per-Skill Memory (`.memory.md`)
```
Insert this NEW section IMMEDIATELY BEFORE that `### Per-Skill Memory` heading (with a blank line after it):
```markdown
### Self-Evolving Skills（自己進化スキル）

スキルを経験から自己改善させるライフサイクル（MUSE-Autoskill 適用）。全体像・データフロー・各サブプロジェクトの索引は **[docs/self-evolving-skills.md](docs/self-evolving-skills.md)** を参照。

| 役割 | 道具 | 性質 |
|------|------|------|
| gate | `validate-skill`（`/create-skill` 内・手動） | 決定論ゲート（通らなければブロック） |
| action | `refining-skills`（`/refine-skill`） | 既存スキルを経験駆動で改善 |
| management | `catalog-skills`（`/skill-catalog`） | 全スキルの advisory 俯瞰（常に exit 0） |
| qualitative | `reviewing-skills` | LLM 定性レビュー |
| memory | `skill-memory.ts` フック | スキル固有の経験を `.memory.md` に注入・蓄積 |

```

- [ ] **Step 2: Trim the overloaded lifecycle paragraph**

In `CLAUDE.md`, find this exact paragraph (currently line 311 — it has crammed-in SP3/SP4 detail):
```markdown
**スキルのライフサイクル**: `/create-skill`（誕生）→ `validate-skill`＋`reviewing-skills`（評価）→ 使用中に `.memory.md` へ経験蓄積（per-skill メモリ）→ `/refine-skill`＝`refining-skills`（既存スキルを経験駆動で改善し、普遍的教訓を `references/lessons.md` へ昇格）。`refining-skills` だけが `.memory.md` を消費する。改善は編集までで、確定は `/commit`。 全スキルの健全性は `/skill-catalog`（`catalog-skills.ts`, advisory・非破壊・常に exit 0）で一望でき、refine 推奨や重複候補を示す。
```
Replace it with this concise version (core one-liner + pointer; detail now lives in the overview doc and the new section):
```markdown
**スキルのライフサイクル**: `/create-skill`（誕生）→ `validate-skill`＋`reviewing-skills`（評価）→ `.memory.md` へ経験蓄積 → `/refine-skill`（改善）→ `/skill-catalog`（俯瞰）。改善は編集までで確定は `/commit`。全体像・4役割・データフローは [docs/self-evolving-skills.md](docs/self-evolving-skills.md)（および上の「Self-Evolving Skills」節）を参照。
```

- [ ] **Step 3: Verify**

```bash
grep -q "### Self-Evolving Skills" CLAUDE.md && echo "section OK"
grep -q "docs/self-evolving-skills.md" CLAUDE.md && echo "pointer OK"
# the crammed detail should be gone from the lifecycle paragraph:
grep -q "advisory・非破壊・常に exit 0）で一望でき" CLAUDE.md && echo "STILL CRAMMED (bad)" || echo "paragraph trimmed OK"
```
Expected: `section OK`, `pointer OK`, `paragraph trimmed OK`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: consolidate self-evolving-skills into a CLAUDE.md section

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Overview doc + links**

```bash
test -f docs/self-evolving-skills.md && echo "doc OK"
grep -c "superpowers/specs/\|superpowers/plans/" docs/self-evolving-skills.md
```
Expected: `doc OK`; the grep count ≥ 10 (5 specs + 5 plans linked).

- [ ] **Step 2: CLAUDE.md consolidation present + trimmed**

```bash
grep -q "### Self-Evolving Skills" CLAUDE.md && echo "section OK"
grep -q "advisory・非破壊・常に exit 0）で一望でき" CLAUDE.md && echo "STILL CRAMMED (bad)" || echo "trimmed OK"
```
Expected: `section OK`, `trimmed OK`.

- [ ] **Step 3: No code changed — SP1-4 still green (regression guard)**

```bash
S=claude/skills/reviewing-skills/scripts
git diff --name-only master..HEAD -- '*.ts' claude/skills/refining-skills/SKILL.md claude/commands/ claude/hooks/ claude/settings.json | grep -v '^docs/' || echo "no code/skill files changed beyond docs (good)"
deno run --allow-read --allow-run --allow-env $S/validate-skill.ts --all >/dev/null 2>&1; echo "validate --all exit=$?"
deno run --allow-read --allow-env $S/catalog-skills.ts >/dev/null 2>&1; echo "catalog exit=$?"
deno run --allow-read --allow-run --allow-env $S/validate-skill.ts reviewing-skills; echo "reviewing-skills exit=$?"
```
Expected: the diff line shows ONLY docs changes for SP5 (no `.ts`, no skill/command/hook/settings changes in SP5's commits); `validate --all exit=0`; `catalog exit=0`; `reviewing-skills: PASS`, exit 0.

Note: the `git diff --name-only master..HEAD` here compares the SP5 worktree branch tip to master. Since SP1-4 are already merged to master, only SP5's docs commits should appear — confirm they are all under `docs/` and `CLAUDE.md` (CLAUDE.md is documentation, acceptable).

- [ ] **Step 4: Confirm acceptance criteria (spec §8)**

Verify each AC 1-6:
1. `docs/self-evolving-skills.md` has lifecycle diagram + tool table + 4-role table + data flow + index + status — Step 1 + read ✓
2. index links resolve — Task 1 Step 2 ✓
3. CLAUDE.md `### Self-Evolving Skills` section (4-role table + pointer) — Step 2 ✓
4. lifecycle paragraph trimmed, detail delegated — Step 2 ✓
5. no code changed; validate/catalog/reviewing unchanged — Step 3 ✓
6. overview doc concise (<500 lines) — `wc -l docs/self-evolving-skills.md` (expect well under 500) ✓

Report PASS/FAIL per criterion.

---

## Self-Review (plan author)

- **Spec coverage**: overview doc (§3)→Task 1; CLAUDE.md consolidation (§4)→Task 2; verification (§5)→Task 3; files (§6)→Tasks 1-2; scope (§7) respected (docs only, no code/new skills); AC (§8)→Task 3. All covered.
- **No code** → no `deno test`; verification is `test -f` / `grep` / unchanged-code checks. Stated in header.
- **No placeholders**: full overview-doc content inline; CLAUDE.md edits give exact find/replace text (the line-311 paragraph quoted verbatim).
- **Consistency**: the doc's relative links (`superpowers/...`, resolved from `docs/`) and Task 1 Step 2's repo-root paths (`docs/superpowers/...`) point at the same files. The 4-role table is identical in the overview doc and the CLAUDE.md section (gate/action/management/qualitative/memory). `docs/self-evolving-skills.md` path consistent across both files.
- **Open items (spec §10)**: ASCII diagram = the flow-line + legend form (robust, no fragile column alignment); table columns chosen; the trimmed paragraph text is given verbatim in Task 2 Step 2.
- **Regression guard**: Task 3 Step 3 explicitly confirms SP1-4 code is untouched and still green — the capstone must not break the merged subsystem.
