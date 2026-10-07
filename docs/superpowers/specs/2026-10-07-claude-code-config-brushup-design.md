# Claude Code 設定のブラッシュアップ（2.1.210 → 2.1.292 時点の仕様に合わせる） — 設計書

> **目的**: `claude/` 配下（settings / hooks / commands / agents / skills / rules / MCP）を、現行の Claude Code 公式ドキュメントと変更履歴（インストール済み 2.1.210 → 上流最新 2.1.292）に照らして棚卸しし、乖離と陳腐化を直す。
> **ステータス**: 設計確定（自律実行。レビューはブランチ差分で行う）。
> **日付**: 2026-10-07。
> **根拠**: 公式 docs（settings-reference / hooks / skills / sub-agents / memory / env-vars / goal）を取得して照合。変更履歴は `anthropics/claude-code` の CHANGELOG.md。

---

## 1. 調査で判明した事実

### 1.1 最重要: ライブ設定とリポの乖離

| 項目 | 事実 |
|------|------|
| `~/.claude/settings.json` | **通常ファイル**（`install.sh` が想定するシンボリックリンクではない）。`claude/settings.json` とは別物として 2025-12 以降それぞれ更新されてきた |
| リポ側にしか無いもの | `Stop` / `Notification` / `PostToolUse(Write\|Edit\|MultiEdit)` / `PostToolUse(Skill)` の 4 フック、`enableAllProjectMcpServers`、`spinnerTipsEnabled`、`learnMode`、`includeCoAuthoredBy`、`permissions.defaultMode: bypassPermissions`、`env.CLAUDE_CODE_MAX_OUTPUT_TOKENS` |
| ライブ側にしか無いもの | `model: claude-fable-5-1[1m]`、`effortLevel: xhigh`、`tui: fullscreen`、`theme: dark-daltonized`、通知系 3 キー、`env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`、`permissions.allow: [mcp__pencil]`、有効プラグイン 18 件、marketplace `vcsdd-claude-code` |
| 帰結 | **format / notify / skill-memory の各フックは一度も動いていない**（CLAUDE.md が説明する Per-Skill Memory の自動注入も未稼働。`catalog-skills` の MEM 列が全スキル 0 なのはこのため） |
| さらに | リポ側フックのコマンドは `$GHQ_ROOT/github.com/skanehira/dotfiles/...` を参照するが、このマシンでは `GHQ_ROOT` が未設定で、リンクしても解決しない。`notify.ts` が呼ぶ `terminal-notifier` も未インストール |

### 1.2 ドキュメントとの照合（settings / hooks）

| 対象 | 現状 | 公式の現在 | 判定 |
|------|------|-----------|------|
| `includeCoAuthoredBy` | リポで `true` | v2.0.62 で deprecated。`attribution`（`commit` / `pr` / `sessionUrl`、または `false`）に置換 | 削除（未設定＝既定の attribution と同じ） |
| `alwaysThinkingEnabled: true` | 両方にある | `true` は no-op（thinking は既定で on。`false` にする用途のみ） | 削除 |
| `learnMode` | リポのみ | settings-reference に存在しない | 削除（学習スタイルは `learning-output-style` プラグインが担う） |
| `env.CLAUDE_CODE_MAX_OUTPUT_TOKENS: 16000` | リポのみ | 「既定と上限はモデル依存」。autocompact の調整は `CLAUDE_CODE_AUTO_COMPACT_WINDOW` が担当 | 削除（モデル既定に戻す） |
| `permissions.defaultMode: bypassPermissions` | リポのみ | user 設定でのみ有効（project では無視） | 採用しない（ライブで数か月使っていない設定を復活させない。必要なら `--permission-mode` か再追加） |
| PostToolUse matcher `MultiEdit` | リポ | ツールが存在しない（docs に記載なし） | `Write\|Edit` に変更。`types.ts` / `format.ts` から除去 |
| `Notification` matcher `""` | リポ | 12 種の `notification_type` がある | `permission_prompt\|idle_prompt\|agent_needs_input\|agent_completed` に絞る |
| `Stop` フック入力 | `title/message` を想定 | `last_assistant_message` / `stop_hook_active` 等を受け取る | 最後のメッセージ末尾を通知本文にする |
| `StopFailure` | 未使用 | API エラー（rate_limit 等）で `Stop` の代わりに発火 | 通知フックを追加 |
| フック共通フィールド | `types.ts` は旧形 | `cwd` / `permission_mode` / `effort` / `tool_use_id` / `scratchpad_dir` 等 | `types.ts` を公式の形に書き直す |
| コマンドフック `async` / `timeout` | 未指定 | `async: true` で非ブロッキング、`timeout` 秒 | 通知系は `async`、全フックに `timeout` |
| `effortLevel` | ライブ `xhigh` | 有効。`/effort` は v2.1.251 以降 `modelSettings` にモデル別保存 | 維持 |
| `preferredNotifChannel` / `inputNeededNotifEnabled` / `agentPushNotifEnabled` / `tui` / `theme` | ライブ | いずれも settings-reference に記載 | リポに取り込む |
| `feedbackSurveyState` | ライブ | 内部状態 | リポに持ち込まない（Claude Code が必要なら再生成） |

### 1.3 ドキュメントとの照合（skills / agents / rules / MCP）

| 対象 | 現状 | 公式の現在 | 判定 |
|------|------|-----------|------|
| agents `tools: … Task …` | `architect` / `planner` | v2.1.63 で `Task` → `Agent`（別名として残る） | `Agent` に改名。本文の「Task tool」表記も揃える |
| skills frontmatter | `name` / `description`（＋1 本に `argument-hint` / `allowed-tools`） | `effort` / `context: fork` / `agent` / `paths` / `disable-model-invocation` / `user-invocable` / `hooks` / `when_to_use` が追加 | 今回は追加しない（描述トリガーで足りている。`disable-model-invocation` は `Skill` ツール経由の呼び出しも止めるため、コマンドから起動するスキルには不適） |
| `claude/commands/*.md` | 11 本 | 引き続きサポート。新規は skills 推奨 | 移行しない（動作しており、移行は別作業） |
| `.claude/rules` `paths` | 文字列／配列 | 両方有効。v2.1.288 で Write / Edit 時の読み込み修正 | 変更なし |
| MCP | `~/.config/claude/mcp.json` をテンプレートから生成 | Claude Code は読まない。user スコープは `~/.claude.json`（`claude mcp add --scope user`）、project は `.mcp.json` | テンプレートと生成処理を削除し、`MCP.md` を書き直す |
| `/goal` | 昨日のスキルは `ralph-loop` を「記事の /goal 相当」と説明 | `/goal <条件>` が組み込み（別モデルが毎ターン条件を判定。条件は「測れる終了状態＋確認方法＋制約」） | `designing-ai-loop` / `exploring-improvements` / CLAUDE.md の起動表に `/goal` を第一候補として追加 |
| CLAUDE.md の分量 | 402 行 | 目安 200 行以下 | **保留**（§4）。構成変更は利用者の運用に関わるため提案に留める |
| hooks テスト | `deno test` が 1 件失敗 | `Deno.makeTempDir` に `--allow-write` が必要 | README に実行コマンドを明記（コードの欠陥ではない） |

### 1.4 プラグイン

| プラグイン | 判定 | 理由 |
|-----------|------|------|
| `explanatory-output-style` と `learning-output-style` の同時有効 | `explanatory` を無効 | learning は explanatory の説明機能を含む。両方有効だと system prompt に同じ指示が二重に入る |
| `claude-opus-4-5-migration` | 無効 | 一回限りの移行用。`~/.claude.json` に `opus45MigrationComplete` あり |
| その他 16 件 | 維持 | ライブの選択をそのまま採用 |

### 1.5 変更履歴 2.1.211 → 2.1.292 から採用したもの

| version | 変更 | 対応 |
|---------|------|------|
| 2.1.233 / 2.1.268 | TodoWrite / TaskCreate 系のタスク管理ツールは Opus 4.8・Sonnet 5・Fable 5 以降では提供されない。`CLAUDE_CODE_ENABLE_TODO_TOOLS=1` で復活 | このリポのコマンド・スキル・エージェントは TodoWrite を多用するため、`env.CLAUDE_CODE_ENABLE_TODO_TOOLS: "1"` を設定 |
| 2.1.269 | Bash が編集したファイルを `tool_response.bashEditDiff` で PostToolUse に渡す（auto mode では既定で記録） | auto mode では Claude が Bash で編集するため、format フックの matcher を `Write\|Edit\|Bash` にし、`format.ts` が `changedFiles` を整形 |
| 2.1.286 | ユーザースキルに `verify` があると、コミット直前に自動で実行される（docs / tests のみのコミットは除く） | `claude/skills/verify` を新設（既存の検証コマンドだけを実行し、PASS / FAIL を報告。修正はしない） |
| 2.1.223 / 2.1.233 | 組み込み `/review` は `/code-review` の別名。ユーザーの `/review` コマンドがそれを覆い隠す | 意図的に維持（独自 5 観点レビュー）。組み込みは `/code-review` で呼べる |
| 2.1.261 / 2.1.283 | `/skill-doctor`（未使用スキルとコンテキストコスト）、`/doctor prompt-audit`（古い書き方・古いパス・矛盾の検出） | `/skill-catalog` のドキュメントに保守コマンドとして追記 |
| 2.1.287 | MCP サーバーの `alwaysLoad: false` でツール定義をツール検索の背後に遅延 | `MCP.md` に追記 |
| 2.1.284 | 権限モード未設定のセッションは auto mode で開始（`permissions.defaultMode` で上書き可） | 統合後の設定は未設定＝auto。§4 に記載 |
| 2.1.212 | Agent ツールの `mode` パラメータ廃止、サブエージェントは親の権限モードを継承 | 変更なし（情報） |
| 2.1.275 | claude.ai で有効にしたスキル・プラグインを端末セッションに同期。`syncClaudeAiSkills` / `syncClaudeAiPlugins: false` で停止 | 既定のまま。§4 に記載 |

---

## 2. 確定した設計判断

| # | 判断 | 選択 | 根拠 |
|---|------|------|------|
| D1 | 統合の優先順位 | **ライブ設定を正、リポのフックを加える** | ライブは利用者が `/config` 等で育てた現在の好み。リポはフックと再現性のために存在する |
| D2 | ライブの置き換え | **しない**（リポを正しくし、`install.sh` が乖離を警告し採用コマンドを出す） | 全セッションに即時影響する設定の差し替えは利用者の操作で行う |
| D3 | フックの参照経路 | `$HOME/.claude/hooks/<file>`（herdr と同じ） | `GHQ_ROOT` に依存しない。`~/.claude/hooks` はリポへのリンク |
| D4 | 通知の実装 | `terminal-notifier` があれば使い、無ければ `osascript`。失敗は常に exit 0 | 追加インストール無しで動く。フックが壊れてもセッションを止めない |
| D5 | 非推奨・無効キーの扱い | 削除 | 残しても効かない。`attribution` は既定のままで良いので未設定 |
| D6 | skills / commands の構造変更 | 見送り | 現行仕様で有効。移行は価値に対して差分が大きい |
| D7 | `/goal` の反映 | 昨日の 2 スキルと CLAUDE.md の起動表を更新 | 記事の `/goal` が組み込みになっており、`ralph-loop` は固定回数反復の代替に格下げ |

---

## 3. 変更一覧

| ファイル | 変更 |
|---------|------|
| `claude/settings.json` | ライブ＋リポのフックを統合。非推奨キー削除、`Write\|Edit\|Bash`、`Notification` matcher、`StopFailure` 追加、`async` / `timeout`、`$HOME` 経路、`CLAUDE_CODE_ENABLE_TODO_TOOLS`、プラグイン 2 件無効 |
| `claude/hooks/notify.ts` | 入力の `title` 欠落に対応、`notification_type` / `last_assistant_message` / `error` を本文に、`osascript` フォールバック、fail-open |
| `claude/hooks/types.ts` | 公式のフック入力の形に書き直し（共通フィールド、`MultiEdit` 除去、Write の `{filePath, type}`） |
| `claude/hooks/format.ts` | `MultiEdit` の case を除去。`Bash` の `bashEditDiff.changedFiles` を整形 |
| `claude/hooks/README.md` | 型・テストコマンド・通知仕様を更新 |
| `claude/agents/{architect,planner}.md` | `Task` → `Agent`。`committer` / `doc-updater` の本文表記も |
| `claude/install.sh` | settings.json が通常ファイルなら警告＋採用コマンド表示。MCP テンプレート生成を削除。Deno 注記を更新 |
| `claude/mcp.json.template` | 削除 |
| `claude/MCP.md` | 現行のスコープ（user = `~/.claude.json`、project = `.mcp.json`）と `claude mcp` 操作に書き直し |
| `claude/skills/designing-ai-loop/SKILL.md`、`claude/skills/exploring-improvements/SKILL.md`、`CLAUDE.md` | `/goal` を起動の第一候補に |
| `claude/skills/verify/SKILL.md` | 新設（2.1.286 のコミット前自動実行フック先） |
| `claude/commands/{build-fix,refactor-clean}.md` | `allowed-tools` の `Task` → `Agent` |
| `claude/commands/skill-catalog.md` | `/skill-doctor` / `/doctor prompt-audit` / `claude plugin validate` を保守コマンドとして追記 |
| `CLAUDE.md` | インストール先の誤記（`~/.config/claude/`）を修正、レビュー系の流れに `verify` を追加 |

---

## 4. 保留（利用者の判断）

| 項目 | 内容 | 推奨 |
|------|------|------|
| ライブ settings の採用 | `install.sh` が出す「Adopt」コマンド（バックアップしてリンク）を実行する | 実行推奨。`feedbackSurveyState` と `/effort` のモデル別保存（`modelSettings`）は以後リポ側ファイルに書き込まれるので、差分が出たら `/commit` で取り込む |
| Claude Code の更新 | 2.1.210 → 2.1.292（`claude update`）。`/skill-doctor`（2.1.261）、`maxEffortLevel`（2.1.267）、`attribution: false`（2.1.281）、rules の Write/Edit 時読み込み修正（2.1.288）などが含まれる | 推奨 |
| CLAUDE.md の縮約 | 402 行 → 200 行目安。候補: 「Custom Skills」以下の対応表群を `docs/skills-guide.md` に移し、CLAUDE.md には判断基準（どの系統をいつ使うか）だけ残す | 別作業として提案 |
| `statusLine` | 未設定。モデル・コンテキスト使用量・ブランチの表示が可能 | 好みで |
| `permissions.defaultMode` | 未設定（= default）。常時 bypass したければ user 設定に `"defaultMode": "bypassPermissions"` | 好みで |
| `claude/commands` → skills | 11 本の移行 | 新規作成分から skills にする |
| `syncClaudeAiSkills` / `syncClaudeAiPlugins` | claude.ai 側で有効にしたスキル・プラグインが端末にも同期される（2.1.275） | dotfiles だけで管理したければ両方 `false` |
| `cc-plugin-you-should-know@builtin` | 見落としを別エージェントが指摘する組み込み mod（2.1.287、telemetry 有効時） | 試すなら `/plugin enable cc-plugin-you-should-know@builtin` |
| `keybindings.json` | `confirm:yes` / `confirm:no`、`effortSlider:*` 等を割り当て可能 | 好みで |

---

## 5. 検証

- `jq . claude/settings.json` が通る
- `deno check` が hooks 3 本で通る。`deno test --allow-read --allow-write --allow-env --allow-run` が 19 件 pass
- `notify.ts` を Notification 入力でドライラン → exit 0（`osascript` 経路）
- `validate-skill` が `designing-ai-loop` / `exploring-improvements` / `verify` で PASS
- `format.ts` に Bash の `bashEditDiff` 入力を与えて exit 0（空リストで no-op）
- `grep` で `MultiEdit` / `.config/claude` / `mcp.json.template` / `Task` の残存が無い
