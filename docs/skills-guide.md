# スキル・コマンド・エージェント使い分けガイド

Claude Code 設定（`claude/`）に含まれるスキル・コマンド・エージェントの選択ガイド。
各スキルの説明（description）はセッションに自動ロードされるため、ここでは**関係性と使い分け**のみを扱う。

## レイヤーの役割分担

| レイヤー | 配置 | 役割 |
|---------|------|------|
| スキル | `claude/skills/` | 方法論・知識のSSOT（on-demand ロード） |
| コマンド | `claude/commands/` | スキル/エージェントを起動する薄いオーケストレータ |
| エージェント | `claude/agents/` | Agent ツール（旧 Task）起動用のペルソナ + スキルにない実例のみ保持 |
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

コミットは `committer` エージェント（Agent 起動）が担当する。

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
verify           → lint・型・テストの機械検証（Claude Code 2.1.286 以降はコミット直前に自動実行）
committer        → 上がパスしてからコミット（エージェント）
```

| 状況 | 使う道具 | 目的 |
|------|-----------|------|
| コード変更のレビュー | `/review` | バグ・品質・セキュリティの自動チェック |
| 設計判断の確認 | `/design-intent` | WHY・トレードオフの対話的共有 |
| AI生成コードの検証 | `/design-intent` | 作者の理解度確認 |
| 出荷可否判断 | `/review` + `/design-intent` | 技術品質 + 設計意図の両面で判断 |
| コミット前の機械検証 | `verify` スキル | プロジェクト既存の lint・型・テストを実行し PASS / FAIL を報告（修正はしない） |

重大度は全レビュー系で **Critical / Warning / Info** の3段階に統一。

## ループ系スキルの使い分け（AI コーディングループ）

出典: mizchi「俺のAIプログラミング手法 (2026/10/05)」。人間は「判断基準・評価指標・検証」を設計し、AI は数値ゴールに向けて自律ループで回す。設計の経緯と既存スキルの精査結果は [superpowers/specs/2026-10-06-ai-coding-loop-skills-design.md](superpowers/specs/2026-10-06-ai-coding-loop-skills-design.md)。

```
exploring-improvements  →  designing-ai-loop  →  実行ハーネス（/goal / ralph-loop / /loop / takt / herdr-swarm）
（視点で仕事を見つける）    （数値ゴール・停止条件・エスカレーションを決める）
```

| 状況 | 使うスキル | 出力先 |
|------|-----------|--------|
| 改善点を視点（SRE / セキュリティ攻撃側 / 性能 / 保守性）で洗い出したい | `exploring-improvements` | GitHub Umbrella Issue |
| AI に任せられるか判定し、評価指標・停止条件・エスカレーションを決めたい | `designing-ai-loop` | `docs/loops/<name>.md` |
| ループを実際に回したい | `/goal <条件>`（条件を満たすまで。組み込み）/ `/ralph-wiggum:ralph-loop`（固定回数反復）/ `takt-orchestration`（YAML ピース）/ `herdr-swarm`（並列） | — |
| 仕様・設定・並行処理の正しさを形式手法で突き合わせたい | `formal-methods-reconciler`（`vcsdd-lite` Phase 5 から参照） | 形式モデル＋反例テスト＋ドメイン語の台帳 |

**境界**: `developing` の `docs/quality-bar.md` はテスト品質の基準（ループ指標の入力）。`ship-check` / `qa-testing` はリリース判定の監査であり探索ではない。スキル自体の精査観点（数値化・ペルソナより視点・既知知識の再掲禁止・失敗分類・鮮度）は `reviewing-skills/references/best-practices.md` §9。

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

`natural-japanese`（[coji/natural-japanese](https://github.com/coji/natural-japanese)、MIT、プラグイン `natural-japanese@natural-japanese` として導入）は仕事の日本語全般の **自然さ・読みやすさ** を扱う。議事録・レポート・ガイド・企画書・ブログの執筆と推敲、AI 臭の診断（`/natural-japanese score <file>`）、`uv run` による形態素解析 lint（禁止語・翻訳調・単調なリズム・読解負荷）を持つ。

| 使い分け | スキル |
|---------|--------|
| 技術書・技術記事の原稿: 整形（一文一行・脚注・コラム記法）と論証の規範 | `japanese-tech-writing` |
| 仕事の文書全般: 結論から書く骨組み、AI 臭の除去、読みやすさの機械検査 | `natural-japanese` |
| 技術記事を仕上げる | 両方。構成と記法は `japanese-tech-writing`、文の自然さと lint は `natural-japanese`（natural-japanese 自身が「整形は別スキルの領域」と宣言している） |

## スキル品質とライフサイクル

`/create-skill`（誕生）→ `validate-skill`＋`reviewing-skills`（評価）→ `.memory.md` へ経験蓄積
→ `/refine-skill`（改善）→ `/skill-catalog`（俯瞰）。

詳細は [docs/self-evolving-skills.md](self-evolving-skills.md) を参照。
