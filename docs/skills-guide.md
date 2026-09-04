# スキル・コマンド・エージェント使い分けガイド

Claude Code 設定（`claude/`）に含まれるスキル・コマンド・エージェントの選択ガイド。
各スキルの説明（description）はセッションに自動ロードされるため、ここでは**関係性と使い分け**のみを扱う。

## レイヤーの役割分担

| レイヤー | 配置 | 役割 |
|---------|------|------|
| スキル | `claude/skills/` | 方法論・知識のSSOT（on-demand ロード） |
| コマンド | `claude/commands/` | スキル/エージェントを起動する薄いオーケストレータ |
| エージェント | `claude/agents/` | Task起動用のペルソナ + スキルにない実例のみ保持 |
| ルール | `claude/rules/` | `paths:` frontmatter による条件付き制約（自動注入） |

**原則**: 同じ知識を2箇所に書かない。コマンド・エージェントはSSOTを参照する。

## コマンドとスキルの対応

| コマンド | 使用するスキル | 備考 |
|---------|---------------|------|
| `/impl` | `developing`, `writing-tests` | TDDワークフローをフェーズ承認ゲート付きで実行（旧 `/tdd` を統合） |
| `/spec` | `analyzing-requirements`, `planning-tasks` | 設計→タスク生成 |
| `/review` | （5観点レビューを直接実行） | code-reviewer/security-reviewerエージェントと連携 |
| `/build-fix` | - | `build-error-resolver` エージェントに委譲 |
| `/refactor-clean` | - | `refactor-cleaner` エージェントに委譲 |
| `/techdebt` | - | 重複コード・TODO/FIXME の棚卸し（refactor-cleanより広く浅い） |
| `/create-skill` | `skill-creator`, `reviewing-skills` | validate-skill をゲートに使用 |
| `/refine-skill` | `refining-skills` | validate-skill + `.memory.md` で経験駆動改善 |
| `/skill-catalog` | （スクリプト直接） | 全スキルの健全性カタログ（advisory） |
| `/write-prd` | `write-prd` | ソクラテス式質問+マルチ視点レビュー |
| `/product-strategy` | `product-strategy`, `competitive-research`, `devils-advocate` | Rumelt's Kernel戦略策定 |
| `/devils-advocate` | `devils-advocate` | 計画のストレステスト |
| `/analyze-data` | `analyze-data` | ファネル/A/Bテスト分析 |
| `/pptx` | `pptx` | Markdown→PowerPoint変換 |
| `/mvp-scaffolding` | `mvp-scaffolding`, `build-or-buy` | MVPスタック選定+初期構築 |
| `/ship-check` | `ship-check` | リリース前品質監査 |
| `/design-intent` | `design-intent` | 設計意図・メンタルモデル共有レビュー |
| `/build-or-buy` | `build-or-buy`, `competitive-research` | Build vs Buy意思決定 |
| `/validate-idea` | `validate-idea` | コード前のアイデア検証 |
| `/launch-playbook` | `launch-playbook` | マルチプラットフォームローンチ |
| `/build-in-public` | `build-in-public` | Build in Publicコンテンツ戦略 |

コミットは `committer` エージェント（Task起動）が担当する。

## 計画系スキルの使い分け

| 状況 | 使うスキル | 出力先 |
|------|-----------|--------|
| シンプルなタスク（1-2日） | `plan-first` | `docs/plans/` |
| 大規模な機能設計 | `analyzing-requirements` → `planning-tasks` | `docs/DESIGN.md` → `docs/TODO.md` |

**迷ったら**: まず `plan-first` で軽く計画を書く。複雑だと気づいたら `analyzing-requirements` に切り替え。

## プロダクト系スキルの使い分け

| 状況 | 使うスキル | 出力先 |
|------|-----------|--------|
| 機能仕様の作成 | `write-prd` | `docs/prd-*.md` |
| 戦略策定 | `product-strategy` | `docs/strategy-*.md` |
| 計画のストレステスト | `devils-advocate` | 対話中 or レポート |
| 競合・技術比較 | `competitive-research` | `docs/research-*.md` |
| データ分析 | `analyze-data` | `docs/analysis-*.md` |
| プレゼン生成 | `pptx` | `*.pptx` |
| MVP初期構築 | `mvp-scaffolding` | `docs/scaffolding-*.md` |
| Build vs Buy判定 | `build-or-buy` | `docs/decisions/build-or-buy-*.md` |
| リリース前監査 | `ship-check` | `docs/ship-check-*.md` |
| 設計意図レビュー | `design-intent` | `docs/design-intent-*.md` |
| アイデア検証 | `validate-idea` | `docs/validation-*.md` |
| ローンチ計画 | `launch-playbook` | `docs/launch-plan-*.md` |
| コンテンツ戦略 | `build-in-public` | `docs/content-strategy-*.md` |

**典型的なワークフロー:**
1. `mvp-scaffolding` → スタック選定+Buy vs Build判定（新規プロジェクト時）
2. `competitive-research` → 競合調査
3. `product-strategy` → 戦略策定（competitive-research と devils-advocate を内部で起動）
4. `write-prd` → 戦略に基づくPRD作成
5. `analyzing-requirements` → PRDから技術設計（DESIGN.md）
6. `planning-tasks` → 設計からタスク分解（TODO.md）
7. `ship-check` → リリース前のプロダクト品質監査

**インディー開発者ワークフロー:**
```
validate-idea → mvp-scaffolding → developing(Vibe Coding) → ship-check
→ launch-playbook → build-in-public → analyze-data(Kill or Keep)
```
→ 詳細は [docs/indie-dev-roadmap.md](indie-dev-roadmap.md) を参照

## レビュー系スキルの使い分け

```
/review          → 技術品質チェック（WHAT: コード品質、セキュリティ、テスト等）
/design-intent   → 設計意図・出荷判断（WHY: なぜこの設計か、トレードオフ、メンタルモデル）
committer        → 両方パス後にコミット（エージェント）
```

| 状況 | 使う道具 | 目的 |
|------|-----------|------|
| コード変更のレビュー | `/review` | バグ・品質・セキュリティの自動チェック |
| 設計判断の確認 | `/design-intent` | WHY・トレードオフの対話的共有 |
| AI生成コードの検証 | `/design-intent` | 作者の理解度確認 |
| 出荷可否判断 | `/review` + `/design-intent` | 技術品質 + 設計意図の両面で判断 |

重大度は全レビュー系で **Critical / Warning / Info** の3段階に統一。

## TDD系スキルの関係

```
developing (親スキル: TDDワークフロー全体・設計原則のSSOT)
    └── writing-tests (サブスキル: テスト作成・命名・QA 6技法)
```

- 実行コマンド: `/impl`（フェーズゲート付きオーケストレータ）
- 実例集: `tdd-guide` エージェント（統合/E2E/モックの例のみ）
- 条件付きルール: `claude/rules/common/testing.md`（カバレッジ基準・失敗時対応）

## 文章規範スキル（横断適用）

`japanese-tech-writing` は他スキルが生成する日本語ドキュメントの文章品質を律する横断スキル。
日本語で技術文書を書く・推敲するとき、description のトリガーで自動起動する。
社会発信・音声・スライド系（x-growth, build-in-public, zundamon-video, pr-video, pptx）は register が異なるため対象外。

## スキル品質とライフサイクル

`/create-skill`（誕生）→ `validate-skill`＋`reviewing-skills`（評価）→ `.memory.md` へ経験蓄積
→ `/refine-skill`（改善）→ `/skill-catalog`（俯瞰）。

詳細は [docs/self-evolving-skills.md](self-evolving-skills.md) を参照。
