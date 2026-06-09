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
| `validate-skill.ts` | Evaluation | SKILL.md → PASS/FAIL（構造＋scripts テスト） | `/create-skill` ゲート / 手動 | `--allow-read --allow-run --allow-env` |
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
