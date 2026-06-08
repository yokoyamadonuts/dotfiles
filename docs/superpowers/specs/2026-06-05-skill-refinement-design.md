# SP3: Skill Refinement — 設計書

> **親プロジェクト**: "Self-Evolving Skills" — MUSE-Autoskill（[arXiv:2605.27366v1](https://arxiv.org/html/2605.27366v1)）をこの dotfiles のスキルエコシステムに適用する。
> **サブプロジェクト**: 5 分割のうち SP3（Refinement ステージ）。
> **ステータス**: 設計承認済み。
> **日付**: 2026-06-05。
> **前提**: SP1（per-skill メモリ）・SP2（テストゲート）は実装・master マージ済み。

---

## 1. 背景と動機

### 1.1 元論文の Refinement ステージ

MUSE-Autoskill は「テスト失敗・ランタイムフィードバックをトリガにスキルを自動改善する（automatic refinement）」を提案する。スキルは固定資産ではなく、失敗を糧に**改善され続ける**。

### 1.2 この repo での Refinement

SP3 はライフサイクルの後半 `remember → refine → 再evaluate` を閉じる。`create-skill` は新規スキルの誕生（`create→evaluate→register`）を担うが、**既存スキルを生涯にわたり経験駆動で改善する**のは SP3 だけ。SP3 が消費するシグナル:

- **validate-skill（SP2）** の Critical/Warning（決定論的な構造の問題）。
- **`.memory.md`（SP1）** の Failure Modes / Input Quirks / Promotion Candidates（蓄積された運用経験）。

### 1.3 なぜ「スクリプト」ではなく「スキル/コマンド」か

SP1（メモリ読込フック）・SP2（バリデータ）は決定論的な TS コードだった。しかし **Refinement = SKILL.md の内容編集 = LLM の判断作業**。よって SP3 の本体は**markdown のスキル＋コマンド**（この repo の `developing`スキル＋`/impl`コマンド型）。新規スクリプトは作らず、gather は既存の `validate-skill` 実行＋`.memory.md` 読込で賄う。

### 1.4 ランタイム非依存の制約

論文の「ランタイム出力の品質を検知して自動 refine」は、スキル出力の良し悪しを判定するランタイムが無い dotfiles では再現不可。SP3 が使えるのは **静的シグナル（validate-skill）と蓄積メモ（.memory.md）** のみ。トリガーも手動（後述）。

---

## 2. 確定した設計判断

| # | 判断軸 | 選択 | 根拠 |
|---|-------|------|------|
| D1 | スコープ | **フルループ**（gather→diagnose→improve→re-validate→promote） | 論文 Refinement を完全に体現。SP1+SP2 のシグナルを束ねる |
| D2 | トリガー | **手動コマンド** `/refine-skill <name>` | 内容編集は破壊的になりうる。フック自動編集は危険。「どれを refine すべきか」の検知は SP4(Management) に分離 |
| D3 | コミット | **自動コミットしない**（編集まで。確定は人が `/commit`） | SP1(gitignore)/SP2(ゲートのみ) と一貫。編集と確定の分離（committer 思想） |

---

## 3. アーキテクチャ

- **`refining-skills` スキル**（本体：ワークフロー＋判断ガイド）。
- **`/refine-skill <name>` コマンド**（薄い起動口。引数なしなら AskUserQuestion で対象を尋ねる）。
- **CLAUDE.md** に境界1行＋スキル/コマンド対応表へ追加。

新規実行コードなし。消費する既存資産: `validate-skill`(SP2)、`.memory.md`/`references/lessons.md`(SP1)。

## 4. Refinement ループ（6ステップ）

```
/refine-skill <name>
  ① Gather   : validate-skill <name> 実行 + ~/.claude/skills/<name>/.memory.md 読込
               + 既存 references/lessons.md 読込（重複昇格を避ける）
               → シグナル皆無（validate clean かつ memory 無し）なら「refine 不要」で停止
  ② Diagnose : シグナルを具体的改善に変換
  ③ Improve  : SKILL.md / references を編集（判断。best-practices 準拠）
  ④ Re-validate: validate-skill <name> 再実行（最大3回ループ）
  ⑤ Promote  : 普遍的 Promotion Candidates → references/lessons.md、.memory.md から除去
  ⑥ Report   : 変更点・昇格内容・残課題
```

### ②Diagnose のマッピング

| シグナル | 改善アクション |
|---------|--------------|
| validate Warning: body>500行 | 詳細を `references/` に分割し SKILL.md を短縮 |
| validate Warning: "When to Use" 見出し | description に移動 |
| validate Critical（万一） | 構造を修正（frontmatter/name 等） |
| `.memory.md` Failure Modes | SKILL.md にガードレール・注意を追記 |
| `.memory.md` Input Quirks | 必要な前処理を SKILL.md に明文化 |
| `.memory.md` Tips | 普遍的なら SKILL.md に織り込み |

### ④Re-validate ループ

`validate-skill <name>` を再実行。**新規 Critical が無く、Warning が解消または正当化**されるまで ②→④ を最大3回。収束しなければ報告して停止（無限ループ防止）。

## 5. シグナル源と「refine 不要」

シグナルが何も無い場合（validate clean かつ `.memory.md` 不在）は、即座に「このスキルに refine すべき点はありません」と報告して終了。**空状態でも安全に動く**（現状の repo はメモリ未蓄積＝まさに空）。

## 6. 昇格（durability 判断）

- **昇格基準**: `.memory.md` の Promotion Candidates のうち、**複数タスクで再現しプロジェクト非依存で普遍的**と確認できたものだけ。一度きりの癖・プロジェクト固有な事項は昇格しない（それらは agent-memory の領分）。
- **昇格先**: `claude/skills/<name>/references/lessons.md`（committed、SP1 で確立）。SKILL.md 本体には足さない（`reviewing-skills`/validate-skill の 500行制限を圧迫しないため）。100行を超えたら lessons.md に目次を付ける。
- **昇格後の prune**: 昇格した Promotion Candidates と、SKILL.md に反映済みになった Failure Modes を `.memory.md` から削除（私的メモリは「未解決の生経験」のみ保持）。
- `references/lessons.md` は SKILL.md が通常の references 機構で参照する（必要時にロード）。

## 7. 安全性

- **手動トリガーのみ**: フックで SKILL.md を自動編集しない。
- **自動コミットしない**: refine は編集まで。レビュー後にユーザーが `/commit`（committer エージェント）で確定。破壊的変更をレビュー無しで確定させない。
- **ループ上限3回**（create-skill と同じ）。収束しなければ報告して停止。
- **意図保存**: 編集前に対象 SKILL.md を熟読し、設計意図を保ったまま改善（リライトで壊さない）。改善は最小差分を旨とする。
- **昇格の慎重さ**: 迷ったら昇格しない（`.memory.md` に留める）。誤昇格は committed 資産を汚す。

## 8. 境界（役割分担）

| | 対象 | 駆動 | `.memory.md` 消費 |
|---|------|------|------|
| `/create-skill` | 新規スキル（誕生） | 作成時 | ✗ |
| `reviewing-skills` | 任意 | オンデマンド定性レビュー | ✗ |
| `validate-skill`(SP2) | 任意 | 決定論ゲート | ✗ |
| **`refining-skills`(SP3)** | **既存スキル（生涯）** | **経験駆動** | **✓** |

`.memory.md`（蓄積経験）を消費して改善＋昇格するのは SP3 のみ。他と重複しない。

## 9. ファイル一覧

| パス | 種別 | 内容 |
|------|------|------|
| `claude/skills/refining-skills/SKILL.md` | 新規 | Refinement ワークフロー＋判断ガイド（≤500行） |
| `claude/commands/refine-skill.md` | 新規 | `/refine-skill <name>` 起動口 |
| `CLAUDE.md` | 変更 | 境界記載・スキル/コマンド表に追加 |

> SKILL.md が長くなる場合は `claude/skills/refining-skills/references/` に分割（例: `promotion-criteria.md`, `diagnosis-patterns.md`）。

## 10. 検証（実行コード無し）

SP3 は markdown のみ。ユニットテストは無く、検証は:

1. **参照整合性**: refining-skills/SKILL.md と /refine-skill が、`validate-skill` のパス（`$HOME/.claude/skills/reviewing-skills/scripts/validate-skill.ts`）、`.memory.md`（`~/.claude/skills/<name>/.memory.md`）、`lessons.md`（`references/lessons.md`）を正しく参照している。
2. **空状態ドライラン**: シグナルの無いスキル（例: 既存の任意スキル）に対し、ループが「refine 不要」で停止し**何も編集しない**ことを確認。
3. **テストゲート（SP2）合格**: 新設 `refining-skills` 自身が `validate-skill refining-skills` で PASS（frontmatter・name・行数）。
4. **reviewing-skills セルフレビュー**: `reviewing-skills` でベストプラクティス照合。

## 11. スコープ

**IN（SP3）**:
- `refining-skills` スキル（6ステップループ＋昇格判断ガイド）
- `/refine-skill` コマンド
- CLAUDE.md 境界・対応表更新
- 昇格ワークフロー（Promotion Candidates → lessons.md、.memory.md prune）の文書化

**OUT（後続 SP / YAGNI）**:
- 「どのスキルを refine すべきか」の自動検知・nudge（→ SP4 Management）
- 自動コミット
- ランタイム出力品質の自動評価（ランタイム非依存のため不可）
- 昇格の機械的自動化スクリプト（判断が要るため markdown ワークフローに留める）

## 12. 受け入れ基準

1. `/refine-skill <name>` がシグナルを gather（validate-skill 実行＋.memory.md 読込）して提示する。
2. シグナルが無いスキルでは「refine 不要」で停止し、ファイルを一切編集しない。
3. validate Warning（body>500・"When to Use" 等）に対し、references 分割や description 移動などの改善を行い、再 validate で Warning が解消/正当化される。
4. `.memory.md` の Promotion Candidates のうち普遍的なものを `references/lessons.md` へ移し、`.memory.md` から除去する（durability 判断付き）。
5. refine は編集のみで自動コミットしない。
6. `refining-skills` 自身が `validate-skill` で PASS、`reviewing-skills` のベストプラクティスに準拠。
7. ループは最大3回で収束しなければ報告して停止。
8. 境界が CLAUDE.md に明記され、create-skill/reviewing-skills/validate-skill と重複しない。

## 13. ロードマップ上の位置

```
                    ┌─────────────────────────────────────┐
                    │  SP5: ライフサイクル統合 (capstone)     │
                    └─────────────────────────────────────┘
                          ▲          ▲          ▲
   ┌────────────────┐    ┌────────────────────┐
   │ ★ SP3:          │    │ SP4: Management     │
   │  Refinement     │    │ (検知/カタログ/prune) │
   └────────────────┘    └────────────────────┘
        ▲       ▲                  ▲
   ┌──────────────┐   ┌──────────────────┐
   │ SP2:         │   │ SP1: per-skill    │  ✅ 完了・マージ済
   │  Test-Gate   │✅ │   メモリ           │
   └──────────────┘   └──────────────────┘
```

SP3 は SP1（`.memory.md`）と SP2（`validate-skill`）の両シグナルを消費する。SP4 Management は「どのスキルを refine すべきか」を検知して SP3 を呼ぶ関係になる（SP3 完了後）。

## 14. 実装時に確定する事項（オープン）

- refining-skills/SKILL.md の references 分割要否（500行に収まるなら単一ファイル）。
- `/refine-skill` 引数なし時の対象選択 UI（AskUserQuestion か `validate-skill --all` 提示か）。
- 「Warning の正当化」をどう記録するか（例: body>500 が意図的なら lessons.md か SKILL.md に理由を残す）。
- 昇格時の lessons.md フォーマット（日付・出所の記載粒度）。
