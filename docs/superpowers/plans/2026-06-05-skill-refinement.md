# Skill Refinement (SP3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An experience-driven refinement workflow — a `refining-skills` skill + `/refine-skill` command that gathers signals (validate-skill + `.memory.md`), improves an existing skill's SKILL.md, re-validates, and promotes durable lessons to `references/lessons.md`.

**Architecture:** Markdown-only (no executable code). A `refining-skills` SKILL.md holds the 6-step loop and judgment guidance; a thin `/refine-skill` command invokes it; CLAUDE.md documents the boundary. It reuses SP2's `validate-skill` (deterministic gate) and SP1's `.memory.md`/`lessons.md` — no new scripts. Refinement is LLM-judgment work (editing SKILL.md), so the "tests" are structural verification: the new skill must PASS `validate-skill`, references must resolve, and an empty-state dry-run must no-op.

**Tech Stack:** Markdown (Claude Code skill + command). Verification via SP2's `validate-skill.ts` (Deno) and `grep`.

**Spec:** `docs/superpowers/specs/2026-06-05-skill-refinement-design.md`

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `claude/skills/refining-skills/SKILL.md` | The refinement workflow (6 steps) + promotion/judgment guidance |
| `claude/commands/refine-skill.md` | `/refine-skill <name>` thin invoker that runs the skill |
| `CLAUDE.md` | Boundary note + skills/commands correspondence row |

No executable code → no unit tests. Verification: `validate-skill refining-skills` PASS, reference-integrity `grep`s, empty-state dry-run reasoning.

> NOTE FOR ALL TASKS: this is a documentation/workflow feature. "Tests" are the verification steps shown. There is no `deno test`. Do NOT invent unit tests.

---

## Task 1: `refining-skills` skill

**Files:**
- Create: `claude/skills/refining-skills/SKILL.md`

- [ ] **Step 1: Write the skill file**

Create `claude/skills/refining-skills/SKILL.md` with EXACTLY this content:

```markdown
---
name: refining-skills
description: 既存スキルを経験駆動で改善する。validate-skill の検証結果と .memory.md の蓄積経験をシグナルに SKILL.md を改善し、普遍的な教訓を references/lessons.md へ昇格する。「スキルを改善して」「refineして」「このスキルを磨いて」「skill refinement」「スキルを育てて」などのリクエストで起動。
---

# スキル改善（Refinement）

既存スキルを、蓄積された経験（.memory.md）と決定論的検証（validate-skill）のシグナルから改善する。MUSE-Autoskill の Refinement ステージをこの repo に適用したもの。

## 起動条件

- 「<スキル名> を改善 / refine / 磨いて / 育てて」
- スキルが繰り返し失敗し、.memory.md に Failure Modes が溜まったとき
- validate-skill --all で Warning が出たスキルを直したいとき

## 役割の境界

| | 対象 | 駆動 | .memory.md 消費 |
|---|------|------|------|
| /create-skill | 新規スキル | 作成時 | ✗ |
| reviewing-skills | 任意 | オンデマンド定性 | ✗ |
| validate-skill | 任意 | 決定論ゲート | ✗ |
| **refining-skills（本スキル）** | **既存スキル** | **経験駆動** | **✓** |

本スキルだけが `.memory.md`（蓄積経験）を消費して改善＋昇格する。

## ワークフロー（6ステップ）

### ① Gather（シグナル収集）

対象スキル `<name>` について:

1. 決定論ゲートを実行:
   `deno run --allow-read --allow-run --allow-env $HOME/.claude/skills/reviewing-skills/scripts/validate-skill.ts <name>`
   → Critical / Warning を取得。
2. 私的メモリを読む: `~/.claude/skills/<name>/.memory.md`（存在すれば）。
   → Failure Modes / Input Quirks / Tips / Promotion Candidates。
3. 昇格済み教訓を読む: `claude/skills/<name>/references/lessons.md`（存在すれば）。
   → 重複昇格を避ける。

**シグナルが皆無**（validate clean かつ .memory.md 不在）なら「このスキルに改善点はありません」と報告して**終了**（何も編集しない）。

### ② Diagnose（診断）

| シグナル | 改善アクション |
|---------|--------------|
| Warning: body>500行 | 詳細を references/ に分割し SKILL.md を短縮 |
| Warning: "When to Use" 見出し | description に移動 |
| Critical（万一） | 構造を修正（frontmatter / name） |
| Failure Modes | SKILL.md にガードレール・注意を追記 |
| Input Quirks | 必要な前処理を SKILL.md に明文化 |
| Tips | 普遍的なら SKILL.md に織り込み |

### ③ Improve（改善・判断）

- 対象 SKILL.md を**熟読**し設計意図を把握してから編集する。
- **最小差分**で改善。リライトで意図を壊さない。
- best-practices 準拠（500 行制限。超えるなら references/ へ分割）。

### ④ Re-validate（再検証）

`validate-skill <name>` を再実行。**新規 Critical が無く、Warning が解消または正当化**されるまで ②〜④ を**最大 3 回**。収束しなければ報告して停止。

### ⑤ Promote（昇格）

`.memory.md` の Promotion Candidates のうち昇格基準を満たすものだけを:

1. `claude/skills/<name>/references/lessons.md` に追記（committed）。
2. `.memory.md` から該当項目を削除。
3. SKILL.md に反映済みの Failure Modes も `.memory.md` から削除。

**昇格基準**:
- 複数タスクで再現した（一度きりでない）。
- プロジェクト非依存で普遍的（プロジェクト固有は agent-memory の領分）。
- **迷ったら昇格しない**（.memory.md に残す）。誤昇格は committed 資産を汚す。

### ⑥ Report（報告）

- 変更したファイル / 昇格した教訓 / 残った未解決シグナル。
- 「改善は編集まで。レビュー後に /commit で確定してください」。

## 安全ルール

- **手動起動のみ**。フックで SKILL.md を自動編集しない。
- **自動コミットしない**。編集まで。確定はユーザーが /commit（committer）で。
- ループ上限 3 回。収束しなければ報告して停止。
- 迷ったら昇格しない・編集を最小に。

## 空状態での動作

現状この repo はメモリ未蓄積。シグナルが溜まるまで本スキルは「改善点なし」を返す。これは正常（仕組みが先、経験が後）。
```

- [ ] **Step 2: Verify the skill passes the deterministic gate (SP2)**

Run: `deno run --allow-read --allow-run --allow-env claude/skills/reviewing-skills/scripts/validate-skill.ts refining-skills`
Expected: `refining-skills: PASS` (no Critical; ideally no Warning — confirm body ≤500 lines). Exit 0.

- [ ] **Step 3: Verify reference integrity**

Run: `grep -c "validate-skill.ts" claude/skills/refining-skills/SKILL.md && grep -c ".memory.md" claude/skills/refining-skills/SKILL.md && grep -c "references/lessons.md" claude/skills/refining-skills/SKILL.md`
Expected: each ≥1 (the skill references the SP2 validator, the SP1 memory file, and the promotion target).

- [ ] **Step 4: Commit**

```bash
git add claude/skills/refining-skills/SKILL.md
git commit -m "feat(skills): add refining-skills (experience-driven refinement workflow)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `/refine-skill` command

**Files:**
- Create: `claude/commands/refine-skill.md`

- [ ] **Step 1: Write the command file**

Create `claude/commands/refine-skill.md` with EXACTLY this content:

```markdown
---
description: "既存スキルを経験駆動で改善する。validate-skill と .memory.md のシグナルから SKILL.md を改善し、普遍的教訓を lessons.md へ昇格。"
argument-hint: "[スキル名]"
---

# /refine-skill - スキル改善コマンド

既存スキルを `refining-skills` スキルのワークフローで改善する。

> **関連スキル**: `refining-skills` — 6 ステップの改善ループ（gather→diagnose→improve→re-validate→promote）と昇格判断。本コマンドはそのワークフローを起動する。
> **依存**: `validate-skill`（SP2 の決定論ゲート）, `.memory.md` / `references/lessons.md`（SP1）。

## 使い方

```
/refine-skill pptx
/refine-skill            # 引数なし → 対象を尋ねる
```

---

## [1/2] 対象スキルの特定

- `$1` があればそれを対象スキル名とする。
- 空の場合、`validate-skill --all` を実行して Warning のあるスキルを提示し、AskUserQuestion で対象を選んでもらう:

```bash
deno run --allow-read --allow-run --allow-env \
  $HOME/.claude/skills/reviewing-skills/scripts/validate-skill.ts --all
```

---

## [2/2] refining-skills の実行

Skill ツールで `refining-skills` を起動し、対象スキル名を渡す:

```javascript
Skill({ skill: "refining-skills", args: "<スキル名>" })
```

`refining-skills` が gather → diagnose → improve → re-validate → promote → report を実行する。

---

## 重要な注意事項

- **自動コミットしない**。改善後は `/commit`（committer）でレビューして確定する。
- シグナルが無ければ「改善点なし」で終了し、ファイルを編集しない。
- 改善ループは最大 3 回。収束しなければ報告して停止。
```

- [ ] **Step 2: Verify command references**

Run: `grep -q "refining-skills" claude/commands/refine-skill.md && echo "skill ref OK" && grep -q "自動コミットしない" claude/commands/refine-skill.md && echo "safety note OK"`
Expected: `skill ref OK` and `safety note OK`.

- [ ] **Step 3: Commit**

```bash
git add claude/commands/refine-skill.md
git commit -m "feat(commands): add /refine-skill invoker for refining-skills

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Wire CLAUDE.md (boundary + correspondence)

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the command→skill correspondence row**

In `CLAUDE.md`, find the `### Skills vs Commands (関係性ガイド)` section's table. It has rows like:
```markdown
| `/impl` | `developing` | TDDワークフロー実行 |
```
Add this row to that table (after the `/impl` row, keeping table formatting):
```markdown
| `/refine-skill` | `refining-skills` | 既存スキルの経験駆動改善（validate-skill + .memory.md） |
```

- [ ] **Step 2: Extend the skill-quality boundary note (added in SP2)**

In `CLAUDE.md`, find the paragraph added in SP2 that starts with `**スキル品質の2層**:` (in the `### レビュー系スキルの使い分け` section). Immediately AFTER that paragraph, add a new paragraph:
```markdown
**スキルのライフサイクル**: `/create-skill`（誕生）→ `validate-skill`＋`reviewing-skills`（評価）→ 使用中に `.memory.md` へ経験蓄積（per-skill メモリ）→ `/refine-skill`＝`refining-skills`（既存スキルを経験駆動で改善し、普遍的教訓を `references/lessons.md` へ昇格）。`refining-skills` だけが `.memory.md` を消費する。改善は編集までで、確定は `/commit`。
```

- [ ] **Step 3: Verify**

Run: `grep -q "refine-skill" CLAUDE.md && echo "row OK" && grep -q "スキルのライフサイクル" CLAUDE.md && echo "lifecycle note OK"`
Expected: `row OK` and `lifecycle note OK`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document refining-skills lifecycle and /refine-skill mapping

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Final verification

**Files:** none (verification only)

- [ ] **Step 1: refining-skills passes its own deterministic gate**

Run: `deno run --allow-read --allow-run --allow-env claude/skills/reviewing-skills/scripts/validate-skill.ts refining-skills; echo "exit=$?"`
Expected: `refining-skills: PASS`, `exit=0`. (If a `[Warning] W1 body` appears for >500 lines, split the SKILL.md detail into `claude/skills/refining-skills/references/` and re-run — but the authored skill is well under 500 lines, so this should be clean.)

- [ ] **Step 2: Whole-repo audit still green (no regression)**

Run: `deno run --allow-read --allow-run --allow-env claude/skills/reviewing-skills/scripts/validate-skill.ts --all; echo "exit=$?"`
Expected: every skill PASS (including the new `refining-skills`), exit=0. The pre-existing 3 `W1 body` Warnings (figma-design-ops, vcsdd-lite, zundamon-video) may remain — they are advisory.

- [ ] **Step 3: Reference-integrity sweep**

Run:
```bash
grep -q "reviewing-skills/scripts/validate-skill.ts" claude/skills/refining-skills/SKILL.md && echo "validate ref OK"
grep -q "refining-skills" claude/commands/refine-skill.md && echo "command->skill OK"
grep -q "refine-skill" CLAUDE.md && echo "claude.md OK"
```
Expected: all three OK.

- [ ] **Step 4: Empty-state dry-run reasoning (AC2)**

Confirm by inspection (no skill currently has a `.memory.md`): running `/refine-skill refining-skills` would Gather → find validate PASS + no `.memory.md` → report "改善点なし" and stop WITHOUT editing. State explicitly that the skill's Step ① "シグナルが皆無 → 終了（何も編集しない）" path covers this, so the empty-state is safe.

- [ ] **Step 5: Confirm acceptance criteria (spec §12)**

Verify each AC 1-8 against the implemented files:
1. gather (validate-skill + .memory.md) — documented in skill ① ✓
2. no-signal → no edit — skill ① stop path ✓ (Step 4)
3. Warning → improve → re-validate — skill ②③④ ✓
4. promote durable candidates + prune .memory.md — skill ⑤ ✓
5. no auto-commit — skill safety + command notes ✓
6. refining-skills PASSes validate-skill + reviewing-skills best-practices — Step 1 ✓
7. loop ≤3 — skill ④ ✓
8. boundary in CLAUDE.md, no overlap — Task 3 ✓

Report PASS/FAIL per criterion.

---

## Self-Review (plan author)

- **Spec coverage**: workflow (§4)→Task 1 skill; command/trigger (§3, D2)→Task 2; boundary (§8)→Task 3; promotion (§6)→skill ⑤; safety (§7)→skill safety section + command notes; verification (§10)→Task 4; AC (§12)→Task 4 Step 5. All covered.
- **No executable code** → no `deno test`; verification is `validate-skill` PASS + grep + dry-run reasoning. This is intentional and stated in the header.
- **Dogfooding**: the new skill is validated by SP2's gate (Task 1 Step 2, Task 4 Step 1) — SP2 is SP3's quality gate.
- **No placeholders**: full SKILL.md and command content are inline. CLAUDE.md edits give exact anchor + exact text.
- **Consistency**: skill name `refining-skills`, command `/refine-skill`, invocation `Skill({skill:"refining-skills", args})` consistent across Tasks 1-3. The `refining-skills` name passes `^[a-z0-9-]+$` (validate-skill C2). Paths to `validate-skill.ts` and `.memory.md` match SP1/SP2 reality.
- **Open items (spec §14)**: no references/ split needed (SKILL.md <500 lines); empty-arg target selection = `validate-skill --all` + AskUserQuestion (Task 2); Warning-justification + lessons.md format left to the skill's judgment guidance.
