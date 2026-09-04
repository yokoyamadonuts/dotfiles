# nvim × herdr 統合 設計書

作成日: 2026-09-04
対象: `vim/lua/modules/ai/`
前提: herdr 0.8.0 / nvim 0.11.5

## 背景

nvim には AI 連携が2系統ある。

| 実装 | 方式 |
|---|---|
| `vim/lua/modules/ai/` (自作) | tmux ペイン + markdown 入力バッファ |
| `vim/lua/plugins/ai/claudecode.lua` | `coder/claudecode.nvim` (WebSocket/MCP) |

自作モジュールは `tmux.lua` を「外部状態を持たない純粋な tmux ラッパー」として切っており、統合全体が約12個の関数を通じてのみ tmux と話している。この境界が保たれているため、バックエンド差し替えとして移植できる。

## 決定事項

1. **tmux をやめ herdr に一本化する。** nvim は herdr ペイン内で動かす。`modules/ai/tmux.lua` は削除。
2. **エージェントは全て「名前付きエージェント」として統一して扱う。** `:Claude` で起こす相棒も、worktree に配置するエージェントも同じ仕組み。違いは cwd と名前だけ。
3. **バックエンド抽象は挟まない。** 一本化する以上 tmux 実装は死にコードになるため (YAGNI)。socket API 直叩きも採らない (プロトコルにバージョンがあり、公式は CLI をサポート面と明言している)。

## スコープ

1. 入力バッファからのプロンプト送信 (既存機能の移植)
2. エージェント出力を nvim バッファに取り込む
3. 艦隊の状態一覧とフォーカス移動
4. worktree エージェントの起動

## 最大の制約: 同期から非同期への書き換え

現行 `tmux.lua` は `vim.fn.system()` を使う。同期呼び出しで nvim をブロックするが、tmux コマンドは数ミリ秒で返るため問題にならなかった。

herdr では成立しない。

- `agent start` は**エージェントが検出可能になるまで返らない** (既定30秒タイムアウト)
- `tab create` 直後のペインはシェル起動中で `agent_pane_busy` になるため、待ちループが要る

同期のままだと nvim が最大30秒フリーズする。**移植の本体はコマンド文字列の差し替えではなく、非同期化である。** nvim 0.11.5 なので `vim.system()` を使う。

## モジュール構成

```
modules/ai/
  herdr.lua    [新] herdr CLI ラッパー。非同期・状態なし
  agent.lua    [新] エージェント生成/解決
  buffer.lua   [改] 入力バッファ UI。scroll 系4つを落とし on_load_output を追加
  output.lua   [新] エージェント出力を scratch バッファに取り込む
  fleet.lua    [新] agent list の telescope ピッカー
  init.lua     [改] コマンドとキーマップのみ
  tmux.lua     [削除]
```

依存方向は一方向に保つ。

```
init.lua ──→ agent.lua ──→ herdr.lua   (nvim UI に依存しない層)
   ├───────→ fleet.lua  ──→ herdr.lua
   ├───────→ output.lua ──→ herdr.lua
   └───────→ buffer.lua                (バックエンド非依存の純 UI)
```

`herdr.lua` は nvim の UI API を一切呼ばない。`buffer.lua` は herdr を知らない。`init.lua` だけが両方を知る。

### 削除する状態

```lua
-- init.lua から消える
local state = { claude_pane = nil, codex_pane = nil }
local function validate_pane(pane_id) ... end
local function get_current_pane_id() ... end
```

herdr の `agent list` がエージェント名で引ける台帳を持つため、nvim 側でペイン ID を追跡する必要がない。tmux には `pane_current_command` を grep する手段しかなかったが、herdr はエージェントを一級の概念として持つ。

### 残す状態

```lua
local in_flight = {}   -- name -> true
```

`:Claude` を素早く2回叩いた時にタブを2つ作らないためのガード。「今このプロセスが生成処理中か」という一時状態であり、削除した恒久的な台帳とは性質が異なる。

## エージェント生成フロー

`agent.ensure(name, cwd, kind, args, cb)` に集約する。`:Claude` も `:AgentAdd` もこれを呼ぶ。

```
1. herdr agent list                     → name が生きていれば即 cb(name)
2. herdr tab create --cwd <cwd> --label <name> --no-focus
                                        → .result.root_pane.pane_id / .result.tab.tab_id
3. herdr pane process-info --pane <p>   → シェルが前面に単独になるまで poll (上限10秒)
4. herdr agent start <name> --kind <kind> --pane <p> --timeout 60000 [-- <args>]
5. 3 or 4 が失敗 → herdr tab close <tab> で回収してから cb(nil, err)
```

herdr ペイン内 (`HERDR_ENV=1`) の場合、手順2に `--workspace` を付けて自分の workspace に固定する。省略するとフォーカス中の workspace が使われ、それは別クライアントのものかもしれない。workspace ID は `herdr pane current --current` の `.result.pane.workspace_id` から取る。

### シェル待ちの判定

```
[.result.process_info.foreground_processes[].pid] == [.result.process_info.shell_pid]
```

実測: `tab create` の0.02秒後には前面プロセスが5つ (`readlink, bash, bash, bash, fish`) あり、0.24秒で `fish` 単独に収束した。`config.fish` が rbenv / nodenv / gcloud の init を走らせるため、この時間は環境依存で一定ではない。

### 非同期の組み方

5段のチェーンに poll ループと失敗時クリーンアップが挟まるため、素のネストコールバックでは深さ5になる。**コルーチンで包む。**

```lua
-- herdr.lua 内。vim.system のコールバックで resume する薄いラッパー
local function await(cmd)   -- coroutine.yield して結果を受け取る
```

`ensure` 本体が手順1〜5を縦に書いた形になり、エラー処理も `if err then cleanup(); return end` と線形に書ける。

### 名前の導出

herdr の制約は `[a-z][a-z0-9_-]{0,31}`。`:Claude` は git root の basename から導出する。

| 場所 | エージェント名 |
|---|---|
| `~/dev/dotfiles` | `dotfiles-claude` |
| `~/.worktrees/dotfiles-feature-x` | `dotfiles-feature-x-claude` |

小文字化し、不正文字を `-` に置換し、kind 接尾辞を含めて32文字に切り詰める。kind を接尾辞にするのは、同じディレクトリで `:Claude` と `:Codex` を併用した時に別エージェントとして共存させるため。worktree ごとに自然に別名になり、そのまま艦隊の一員として一覧に出る。

`:AgentAdd` のように名前が明示された場合はそれを使う (サニタイズと長さ検証は行う)。

## 機能別 I/F

### 1. 入力バッファ (既存の移植)

コマンドとキーマップは全て現状維持。`:Claude [args]` / `:Codex [args]`、`<leader>ac` / `<leader>ar` / `<leader>aC` / `<leader>xx` / `<leader>xr` / `<leader>xc`。

`agent start` の `-- <agent-args...>` に渡せるため、`<leader>ar` → `-- -r`、`<leader>aC` → `-- -c` がそのまま成立する。

| 操作 | 現行 (tmux) | 新 (herdr) |
|---|---|---|
| 送信 | `send-keys -l` + `Enter` の2回 | `agent prompt <name> "<text>"` |
| 割り込み | `send-keys C-c` | `agent send-keys <name> ctrl+c` |
| Shift-Tab | `send-keys S-Tab` | `agent send-keys <name> shift+tab` |

キー名の語彙が違う。herdr は `shift+tab` / `ctrl+c` / `esc` / `enter` を受け付け、tmux 式の `S-Tab` は `unsupported key S-Tab` として**拒否する** (実測)。`herdr.lua` に変換表を持つ。

Codex 用の `text = content .. "\n"` という特例は不要になる。`agent prompt` は本文と Enter をアトミックに送り、ペインの bracketed-paste 状態も考慮するため。

### 2. 出力取り込み

`buffer.lua` の `on_scroll_up` / `on_scroll_down` / `on_scroll_line_up` / `on_scroll_line_down` を落とし、`on_load_output` を追加する。herdr にスクロールコマンドは無い。

入力バッファのキーマップは全て**ノーマルモードの buffer-local**。現行は `<CR>` 送信 / `q` 閉じる / `<C-x><C-x>` 割り込み / `<C-d>` `<C-u>` `<C-n>` `<C-p>` スクロール / `<S-Tab>` 送信。

スクロール4つを外すと `<C-d>` `<C-u>` `<C-n>` `<C-p>` が nvim 標準の挙動に戻る (半ページ移動など)。出力取り込みには未使用の `<C-o>` を割り当てる。`<C-o>` はノーマルモードでは jumplist 後退の標準マッピングだが、buffer-local かつ入力用の一時バッファであり、既存設計も `<C-d>` / `<C-u>` を上書きしていたため許容する。

- `<C-o>` (入力バッファ内) → 出力を分割で開く
- `:AgentOutput [name]` → 単独でも開ける
- 内容は `agent read <name> --source recent-unwrapped --lines 500`
- scratch バッファ (`modifiable=false`, `bufhidden=wipe`)

`read` は 0.8.0 では**生テキストを返す** (0.7.1 は JSON だった) ため JSON パースは不要。

スクロールを失う代わりに `/` 検索・yank・`:cbuffer` での quickfix 送りが使えるようになる。

### 3. 艦隊ピッカー

`:AgentFleet` → telescope (導入済み) で `agent list` を一覧。

- 表示: `<status> <name> <cwd>`
- 並び: `blocked` → `working` → `idle` の優先度順
- `<CR>` → `agent focus <name>`
- `<C-o>` → そのエージェントの出力を開く
- `<C-p>` → そのエージェント宛の入力バッファを開く

`<C-p>` により入力バッファが相棒専用ではなくなり、艦隊の任意のエージェントに向けられる。

### 4. worktree エージェント起動

`:AgentAdd <name> [branch]` → `git worktree add` してから `agent.ensure()` を呼ぶ。

worktree のパスは `$WORKTREE_BASE` (未設定なら `$HOME/.worktrees`) 配下に `<repo>-<name>`。絶対パスを渡す。相対パスは nvim の cwd に解決され、worktree 内で実行した場合に入れ子になる。

fish の `agent-add` と重複するのは「パス導出 + `git worktree add`」の数行のみ。タブ作成・シェル待ち・`agent start` は `agent.ensure()` に集約されているため、`fish -c 'agent-add ...'` に外注するより素直と判断した。fish への依存とエラーの文字列スクレイピングを避けられる。

## エラー処理

`herdr.lua` は全コマンドで「終了コード → JSON デコード → `.error` 検査」の順に確認する。herdr のサーバエラーは終了コード1で stdout に JSON を返す (実測: `{"error":{"code":"agent_pane_busy","message":"..."}}`)。`.error.message` を `vim.notify` に流す。

| 状況 | 挙動 |
|---|---|
| サーバ停止 | 全コマンドで即中断。「`herdr` で起動してください」と通知 |
| herdr ペイン外 | 中断しない。workspace 固定だけ諦めて続行 |
| シェルが10秒で落ち着かない | 作ったタブを閉じて中断 |
| `agent start` 失敗 | 同上。`.error.message` を通知 |
| 名前衝突 (別 cwd に同名) | 新規作成せず警告し、既存へのフォーカスを提案 |
| 起動後に信頼ダイアログ | ペインへフォーカスを飛ばしユーザーに渡す。**自動応答しない** |

herdr ペイン外でも中断しない点は現行と方針を変える。tmux 版は `is_in_tmux()` が false なら即エラーだったが、herdr では `agent prompt` も `agent focus` もサーバさえ生きていれば外から動く。ペイン内であることを要求するのは workspace 固定だけ。fish の `agent-add` と同じ方針。

信頼ダイアログは `:AgentAdd` で新しい worktree に初めて Claude を起動する際に実際に起こりうる。herdr がこれを `blocked` と分類しないことがあり、`agent_status` が `idle` に見えるのに実際は止まっている。導入済みの `claude/skills/herdr-swarm/` も同じ罠に「絶対に自動応答するな、ユーザーに渡せ」というルールを置いているため、nvim 側も同じ規律に揃える。承認を機械が押す経路を作らない。

## テスト

| 対象 | 方法 |
|---|---|
| 純粋関数 (名前サニタイズ・キー名変換・エラー抽出) | `nvim --headless -l` で単体テスト |
| `herdr.lua` のエラー経路 | PATH 先頭に偽 `herdr` スクリプトを置き定型 JSON を返させる |
| `agent.ensure` の非同期チェーン | 手動スモークのチェックリスト |

テストフレームワークは導入しない。既存の `vim-themis` は Vim script 用、`vim-test` はプロジェクトコード用で、自前 Lua モジュール用の基盤は無い。純粋関数は `nvim -l` だけで書け、CLI ラッパーはスタブバイナリで追い込める。非同期チェーン全体の偽装は、得られる確信に対してコストが見合わない。

名前導出とキー変換は `herdr.lua` 内の純粋関数として置くため、herdr を1回も起動せずにテストできる。

## スコープ外

- `coder/claudecode.nvim` (`<leader>cc` / `<leader>cf`) は変更しない。WebSocket/MCP 経由の別系統であり、tmux/herdr のどちらにも依存していない。
- fish の `agent-add` / `agent-fleet` / `agent-open` は変更しない。
- herdr 設定 (`herdr/config.toml`) の変更。tmux を廃止しても prefix `Ctrl+s` はそのままでよい (衝突相手が無くなるため)。

## 既知のコスト

- tmux ベースのワークフローを失う。`modules/ai/` は herdr 内でのみ動くようになる。
- `:AgentAdd` と fish `agent-add` でパス導出ロジックが重複する。
- `buffer.lua` のスクロール操作 (`<C-u>` / `<C-d>` / `<C-n>` / `<C-p>`) が無くなる。出力取り込みで代替する。これらのキーは nvim 標準の挙動に戻る。
- 相棒エージェントの出力を「見ながら書く」体験が変わる。tmux 版はペインを遠隔スクロールしていたが、herdr 版はその時点の出力をバッファに取り込む形になる。追従して見たい場合は取り込み直す必要がある。
