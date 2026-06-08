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
