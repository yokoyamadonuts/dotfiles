# AI コーディングループ対応: スキル群の精査と追加 — 設計書

> **出典**: mizchi「俺のAIプログラミング手法 (2026/10/05)」 https://zenn.dev/mizchi/articles/ai-coding-loop-formal
> **目的**: 記事が示す「人間が判断基準と評価指標を設計し、AI が自律ループで回す」モデルに、この dotfiles のスキル群を揃える。
> **ステータス**: 設計確定（自律実行。レビューはブランチ差分で行う）。
> **日付**: 2026-10-06。
> **前提**: Self-Evolving Skills（SP1-5）実装済み。`validate-skill` / `catalog-skills` / `refining-skills` が利用可能。

---

## 1. 記事の要点と、この repo への写像

記事は「棚卸し」であり、形式的定義ではなく **運用の判断基準の集合** である。スキルに落とせる主張を 7 つに圧縮する。

| # | 記事の主張 | スキルへの含意 |
|---|-----------|--------------|
| A1 | 人間の役割は「モデル性能の評価・ループ構築・評価指標策定・イテレーション検証・テスト/CI の優先度付け」 | ループの入口で人間が決めるべき項目を固定する |
| A2 | 考える順番: AI に任せられるか → 完了定義を数値化 → 一度やらせる → 自動化できるか → 失敗を「コンテキスト不足 / 権限不足 / 性能不足」に分類 | 意思決定の順序そのものがワークフロー |
| A3 | 評価指標は決定的な数値（RSS・hyperfine・lint warning 数・循環的複雑度・重複率・mutation kill 率・VRT 一致率）。主観判断が残るとユーザーが都度呼ばれる | 指標カタログと「人間が呼ばれる地点」の明示 |
| A4 | 探索的改善は「視点」を固定して丸投げし、発見は Umbrella Issue に集約して /goal に渡す | 探索 → Issue → ループ のパイプ |
| A5 | 常にアンラーニング: ペルソナ呪文は古い。グローバルプロンプトは「選択肢があるときの判断基準」だけ。スキルは陳腐化が速い | 既存スキルの精査基準 |
| A6 | 形式手法: 問いの形でツールを選ぶ（Z3 / TLA+ / Quint / Alloy / Lean）。形式化をテストオラクルに、反例をテストケースに、例え話で説明 | 形式手法の導入手順を独立スキルに |
| A7 | 理解する: E2E ケース名 → テスト → 関数シグネチャの順で読む。マージ自動化は安全/危険で分岐（DB スキーマ・Terraform は人間へ） | ループ設計のエスカレーション基準と読む順序 |

### 1.1 既存スキルのカバー状況

| 記事の主張 | 既存の担い手 | 判定 |
|-----------|-------------|------|
| A1/A2/A3 ループ設計・指標 | `developing`（品質基準の言語化 = テスト品質の基準のみ）、`plan-first`（完了条件チェックボックス）、`takt-orchestration`（実行ハーネス）、`ralph-wiggum:ralph-loop`（最小ループ） | **無い**: 「何を目標に・どの数値で・いつ止め・いつ人を呼ぶか」を決める工程がどこにも無い |
| A4 探索的改善 | `ship-check`（リリース前監査）、`/techdebt`（負債検出）、`qa-testing`（Web QA） | **部分**: いずれも「監査」であり、視点を選んで探索し Umbrella Issue に集約してループへ渡す出口が無い |
| A5 アンラーニング | `reviewing-skills` best-practices（「Claude が既に知っている情報を含まない」） | **部分**: ペルソナ・数値化・失敗分類の観点が無い |
| A6 形式手法 | `vcsdd-lite` Phase 5（証明実行の項目表のみ） | **部分**: 問いの形 → ツール選定、反例 → テスト、ドメイン語への翻訳が無い。記事が参照する `formal-methods-reconciler` がそのまま埋める |
| A7 理解・エスカレーション | `design-intent`（変更単位の WHY）| **無い**（ただし単独スキルにする価値は低い。§6 参照） |

---

## 2. 既存スキルの精査（Audit）

### 2.1 精査基準（記事由来）

| 基準 | 問い | 出典 |
|------|------|------|
| **C1 数値化** | 完了条件・合否が数値または機械判定で表せるか。主観判断が残る地点が明示されているか | A3 |
| **C2 ペルソナ** | 「あなたは優秀な〜」「〜として振る舞え」型の名乗りではなく、視点（誰にとって何の数値が大事か）と評価軸で指示しているか | A5 / A4 |
| **C3 既知知識** | モデルが既に知っている一般論を長々と再掲していないか。判断基準・既定値・例外に絞れているか | A5 |
| **C4 失敗分類** | ループで使うスキルが、失敗をコンテキスト不足 / 権限不足 / 性能不足へ切り分ける導線を持つか | A2 |
| **C5 鮮度** | モデル・ツール・バージョン依存の記述に再確認の手がかりがあるか | A5 |

加えて、repo 既存の決定論ゲート `validate-skill` と `catalog-skills` の結果（VAL / LINES）を併記する。

### 2.2 結果: ループ関連スキル（記事の対象領域）

| スキル | VAL | C1 | C2 | C3 | C4 | C5 | 判定 | 対応 |
|--------|-----|----|----|----|----|----|------|------|
| `developing` | ok | ○ フェーズ別カバレッジ・リスク表 | – | △ TDD 一般論・テストピラミッド説明が長い | ✗ | ○ | keep | 関連スキルに `designing-ai-loop` 追記（quality-bar → ループ指標の入力）。C3 の短縮は `/refine-skill` に委ねる |
| `writing-tests` | ok | ○ QA 6 技法・必須ケース | – | △ | – | ○ | keep | 変更なし |
| `vcsdd-lite` | **W1 555 行** | ○ Phase 6 収束シグナル・exit 0 | △ Builder/Adversary 指示が「あなたは〜」型。サブエージェント向け役割＋具体ルールなので許容 | – | △ Phase 4 フィードバック | ○ | **refine** | 仕様書・レビューレポートの 2 テンプレートを `references/output-templates.md` へ分割して 500 行以下に。Phase 5 に `formal-methods-reconciler` 連携を 1 行追加。関連スキル追記 |
| `plan-first` | ok | △ 完了条件はチェックボックスのみ | – | – | – | ○ | keep+ | テンプレの完了条件に「数値化できる条件を優先」を 1 行追記。関連スキル追記 |
| `planning-tasks` / `analyzing-requirements` | ok | △ 非機能要件に数値あり | – | – | – | ○ | keep | 変更なし |
| `design-intent` / `devils-advocate` | ok | ✗ 主観レビュー | – | – | – | ○ | keep | 人間ゲートが目的のスキルであり、C1 違反ではなく設計意図。変更なし |
| `takt-orchestration` | ok | ✗ ピースの完了条件を数値で定める導線なし | △ ペルソナファイル例は takt の facets 仕様に従う例として許容 | – | △ ループモニター上限あり | △ Node.js 18 要件 | keep+ | 関連スキルに `designing-ai-loop`（ゴール・指標 → ピースの完了条件）追記 |
| `herdr` / `herdr-swarm` | ok | – | – | – | ○ 上限・停止ルール | ○ | keep | 上流 verbatim vendor のため編集しない |
| `ship-check` | ok | ○ PASS/WARN/FAIL | – | – | △ | ○ | **fix** | 関連スキルの `designing-refactoring` は存在しないスキル（壊れた参照）。`/techdebt` に差し替え、`exploring-improvements` を追記 |
| `qa-testing` | ok | ○ 6 フェーズ・Issue 起票 | – | – | – | ○ | keep | 変更なし |
| `creating-rules` | ok | – | – | ○ | – | ○ | keep | 記事の「グローバルプロンプトは判断基準だけ」と同じ思想。変更なし |
| `reviewing-skills` / `refining-skills` | ok | – | – | – | – | ○ | **extend** | `references/best-practices.md` に C1–C5 を「Loop-Readiness と Unlearning」節として追加し、精査を再実行可能にする |
| `agent-memory` | ok | – | – | – | – | △ 例示日付のみ | keep | 変更なし |

### 2.3 結果: 記事の対象外スキル（一括判定）

| 観点 | 該当 | 判定 |
|------|------|------|
| C2 名乗り型 description | `building-design-system`「Apple プリンシパルデザイナーとして」、`writing-ui-design-spec`「Apple シニア UI デザイナーとして」、`building-brand-identity`、`figma-design-ops` | **deferred**: 本文には評価軸（HIG・9 段階タイポ等）があり、害は無い。description は trigger 契約なので、本文編集と混ぜず **別バッチ** で一括見直しする（`optimizing-descriptions` の方針）。`critiquing-design` は「視点＋19 軸」で C2 を満たす |
| C5 Node.js 18 要件 | `zundamon-video`, `zero-cost-infra`, `takt-orchestration`, `pr-video` | **deferred**: 記事は Node 24+ を前提。各ツールの実際の要件を確認してから更新（本変更の範囲外） |
| VAL W1（500 行超） | `figma-design-ops` 624, `zundamon-video` 517 | **deferred**: `/refine-skill` の対象。記事の領域外 |
| VAL C2（name） | `claude-real-video` | **deferred**（§5.4）: 名前に予約語 `claude` を含む。上流製品名のため改名は別判断 |
| その他（ポケモン・動画・X・プロダクト系） | – | keep: 記事の主張と無関係 |

---

## 3. 確定した設計判断

| # | 判断軸 | 選択 | 根拠 |
|---|-------|------|------|
| D1 | ループ設計の置き場 | 新規スキル **`designing-ai-loop`** | 既存の `developing`（テスト品質）・`takt`（実行）・`ralph-loop`（反復）のどれも「目標・指標・停止・エスカレーション」を決めない。工程として独立 |
| D2 | 探索的改善の置き場 | 新規スキル **`exploring-improvements`** | 監査系（ship-check / techdebt）とは出口が違う（Umbrella Issue → ループ）。トリガーも「視点で洗い出す」で独立 |
| D3 | 形式手法 | **`formal-methods-reconciler` を上流から verbatim vendor** | 記事が名指しするスキル。評価シナリオ付きで上流が検証済み。ライセンスは repo README の方針で MIT。`herdr` / `claude-real-video` の vendor 前例に従う |
| D4 | vendor の範囲 | `SKILL-ja.md`（本文）＋ `references/` 4 本。`agents/` `evals/` `README.md` と姉妹スキル `formal-methods-drift-guard` は含めない | 日本語優先の repo。drift-guard は「既にモデルがある」段階のスキルで、今は YAGNI。本文の相互参照は provenance コメントで補う |
| D5 | 言語 | 新規 2 本は日本語、vendor は上流の日本語版 | repo 慣習 |
| D6 | コマンド追加 | しない | description トリガーで足りる。`/create-skill` 系の慣習でもコマンドは必須ではない |
| D7 | 既存スキルの編集範囲 | 壊れた参照の修正・500 行超過の分割・相互参照の追記・best-practices の拡張のみ | 記事の主張に直接対応する最小差分。description の一括見直しと既知知識の削減は別バッチ |
| D8 | 確定 | コミットしない | repo のライフサイクル規約（改善は編集まで、確定は `/commit`） |

---

## 4. 新規スキルの設計

### 4.1 `designing-ai-loop`

- **役割**: 「AI に任せる仕事」を自律ループに載せられる形に設計し、`docs/loops/<name>.md` に書き出す。
- **入力**: 対象リポジトリ（任意）、達成したいこと、既存の `docs/quality-bar.md` / Umbrella Issue（あれば）。
- **ワークフロー**（記事の「考える順番」をそのまま工程にする）:
  0. 対象の把握（既存リポなら「現状の構成を読み取って解説」。読む順は E2E ケース名 → テスト → シグネチャ）
  1. 委譲判定（AI に任せられるか・ブロッカーは何か）
  2. 完了定義と評価指標（数値化。`references/metrics-catalog.md` から選び、優先順位とトレードオフ、CI コストを決める）
  3. 一度やらせて観察（小さく実行、行動ログを見る）
  4. 自動化判定（判断基準を文書化できるか。主観判断が残る地点＝人間が呼ばれる地点を明示）
  5. 失敗分類（コンテキスト不足 → 指示・守るべきテストを追加 / 権限不足 → 付与を検討 / 性能不足 → 記録して寝かせる）
  6. ループ定義書を出力し、実行ハーネス（`ralph-loop` / `/loop` / `takt` / `herdr-swarm`）へ渡す
- **エスカレーション基準**（既定値）: DB スキーマ・IaC（Terraform）・認証/認可・課金・本番設定・削除/公開系は人間へ。
- **出力テンプレート**: ゴール / 指標（現在値・目標値・計測コマンド・決定性）/ 優先順位とトレードオフ / 停止条件 / エスカレーション / 失敗時の切り分け / 起動コマンド。
- **references**: `metrics-catalog.md`（指標の決定性・CI コスト・計測コマンド例）。
- **境界**: `developing`（テスト品質の基準）は入力、`takt` / `herdr-swarm` / `ralph-loop` は出力先、`exploring-improvements` は仕事の供給元。

### 4.2 `exploring-improvements`

- **役割**: 視点を固定してコードベースの改善点を探索し、優先順位付きの Umbrella Issue に集約する。探索は読み取り専用、修正はループで行う。
- **ワークフロー**: 視点選択 → 安全境界（Docker/サンドボックス、localhost 限定、本番禁止）→ 探索（視点別プロンプト）→ 発見の記録（場所・症状・影響・指標・修正案・リスク）→ Umbrella Issue 化（`gh issue create`、チェックリスト、優先順位）→ 専門内は精査・専門外はレビュー依頼 → `designing-ai-loop` へ。
- **視点カタログ**（本文に表で保持）: SRE（テレメトリ計装）/ セキュリティ攻撃側 / パフォーマンス・N+1 / 保守性（テストを壊さないリファクタ）/ 最新研究との比較 / 依存関係 / DX。各行に「問い・指標・典型プロンプト・注意」。
- **出力テンプレート**: Umbrella Issue 本文。
- **境界**: `ship-check` / `qa-testing` はリリース判定の監査、`/techdebt` は負債の機械検出。本スキルは「仕事を見つけてループに渡す」。

### 4.3 `formal-methods-reconciler`（vendor）

- 上流 `mizchi/skills/formal-methods-reconciler` @ `62f580819410cb1d398e4d7f234bbd0aad1c1a15`。
- `SKILL.md` = 上流 `SKILL-ja.md` ＋ provenance コメント（出典・SHA・ライセンス根拠・再同期コマンド・未 vendor の範囲）。
- `references/`: `tool-selection.md`, `domain-ledger.md`, `research-patterns.md`, `reference-implementations.md`（verbatim）。
- `vcsdd-lite` Phase 5 と相互参照。

---

## 5. 既存ファイルへの変更

### 5.1 スキル本体

| ファイル | 変更 |
|---------|------|
| `vcsdd-lite/SKILL.md` | 仕様書・レビューレポートテンプレートを `references/output-templates.md` へ移動（500 行以下に）。Phase 5 表に形式モデル化の行を追加。関連スキルに `formal-methods-reconciler` / `designing-ai-loop` |
| `vcsdd-lite/references/output-templates.md` | 新規（移動先） |
| `ship-check/SKILL.md` | 壊れた参照 `designing-refactoring` → `/techdebt`。`exploring-improvements` 追記 |
| `plan-first/SKILL.md` | 完了条件の数値化を 1 行。関連スキル追記 |
| `takt-orchestration/SKILL.md` | 関連スキル追記 |
| `developing/SKILL.md` | 関連スキル追記 |
| `reviewing-skills/references/best-practices.md` | 「9. Loop-Readiness と Unlearning」節（C1–C5）追加 |

### 5.2 CLAUDE.md

- 「レビュー系スキルの使い分け」の後に **「ループ系スキルの使い分け」** 節を追加（origin の CLAUDE.md スリム化と統合した際に `docs/skills-guide.md` へ移動）: `exploring-improvements` → `designing-ai-loop` → 実行（`ralph-loop` / `takt` / `herdr-swarm`）、`formal-methods-reconciler` ↔ `vcsdd-lite` の関係表。

### 5.3 docs

- 本設計書と実装計画（`docs/superpowers/plans/2026-10-06-ai-coding-loop-skills.md`）。

### 5.4 `claude-real-video` の Critical（保留）

`validate-skill claude-real-video` の結果は `C2 name: contains reserved word "claude"`（frontmatter 破損ではない）。名前は上流製品 `claude-real-video`（CLI `crv`）そのものであり、改名は vendor verbatim の方針と `.memory.md` のキー（ディレクトリ名）に影響する。本変更では触らず、次のどちらかをユーザー判断に委ねる:

- ディレクトリと `name` を `watching-videos` に改名し、provenance コメントに上流名を残す（ゲートに通る）
- `validate-skill` に「vendored skill は C2 予約語チェックを免除」する仕組みを足す（ゲートの意味を変える）

W3（本文の "When to Use" 見出し）も上流由来で同じ扱い。

---

## 6. 意図的に除外するもの（YAGNI）

| 候補 | 除外理由 |
|------|---------|
| `explaining-codebase`（A7 理解する） | 「現状の構成を読み取って解説して」はプロンプト 1 行で足り、記事自身がスキルの陳腐化を警告する領域。読む順序（E2E → テスト → シグネチャ）は `designing-ai-loop` のステップ 0 に 1 行で吸収 |
| マルチエージェント判定スキル | 記事が「決定的な解がない」と明言。実行は `herdr-swarm` / `takt` / `superpowers:dispatching-parallel-agents` で足りる |
| マージ自動化 | 記事でも TODO。エスカレーション基準として `designing-ai-loop` に吸収 |
| `formal-methods-drift-guard` の vendor | モデルが存在してから必要になる。provenance コメントに導入手順を残す |
| description の名乗り型を一括書き換え | trigger 契約の変更は観測後に別バッチ（§2.3） |
| CLAUDE.md の縮約（A5「グローバルプロンプトは判断基準だけ」） | スキル精査の範囲外。所見として残す |

---

## 7. テスト

| 対象 | 方法 |
|------|------|
| 新規 2 本（原作） | **RED**: スキル無しのサブエージェントに同じ課題（架空リポのループ設計 / 探索計画と Issue 草案）を解かせ、欠けた要素と裁量で埋めた点を記録 → **GREEN**: スキルを読ませた新規サブエージェントで再実行し、欠落が埋まったことを確認 |
| 全スキル | `validate-skill --all` で Critical 0。`catalog-skills` で `vcsdd-lite` の W1 解消を確認 |
| vendor | 上流ファイルとの `diff` が provenance コメント以外に無いこと |
| 相互参照 | 関連スキル節に書いたスキル名がすべて `claude/skills/` に実在すること（壊れた参照の再発防止） |

---

## 8. 受け入れ基準

- [ ] `claude/skills/designing-ai-loop/`（SKILL.md ≤ 300 行、references/metrics-catalog.md）
- [ ] `claude/skills/exploring-improvements/`（SKILL.md ≤ 250 行）
- [ ] `claude/skills/formal-methods-reconciler/`（SKILL.md + references/ 4 本、provenance あり）
- [ ] `vcsdd-lite` が 500 行以下、`ship-check` の壊れた参照が無い
- [ ] `best-practices.md` に C1–C5 がある
- [ ] CLAUDE.md にループ系の使い分け表がある
- [ ] RED/GREEN の差分が本設計書 §7 の基準で確認できる（結果は plan に記録）
- [ ] `validate-skill --all` Critical 0

## 9. 実装時に確定する事項（オープン）

- エスカレーション既定値の最終形（DB / IaC / 認証 / 課金 / 本番 / 削除）はユーザーの判断で増減する。
- RED で観測された欠落に応じて、新規スキルの節立ては最小限に調整する（事前の節案に固執しない）。
