# Zed + herdr — AI エージェント運用

Zed と herdr を役割分担して、複数の Claude Code エージェントを並走させる開発環境。

## 役割分担

| ツール | 役割 |
|--------|------|
| **herdr** | エージェント艦隊の管制塔。git worktree ごとに Claude Code CLI を並走させ、🔴blocked / 🟡working / 🔵done / 🟢idle を一望。socket API で制御。 |
| **Zed** | 集中編集 + in-editor エージェント。herdr で回している worktree を開き、インライン差分でレビュー・修正。認証はスレッド内 `/login`。 |
| **git worktree** | 各エージェントの作業空間を分離（`$WORKTREE_BASE=~/.worktrees`）。既存の `wt` 系関数と連動。 |

## セットアップ済みの内容

- **Zed** (`zed/settings.json`): `agent_servers."Claude Code"` を ACP アダプタ (`npx @zed-industries/claude-code-acp`) で宣言。vim モード / Cica / Ayu Dark。
- **herdr** (`herdr/config.toml`): prefix `Ctrl+s`（tmux と統一）、fish シェル、tokyo-night。キーバインド:
  - `prefix + alt+z` → 現在ペインの cwd を Zed で開く
  - `prefix + alt+c` → 使い捨てペインで Claude Code 起動
- **状態連携** (`claude/hooks/herdr-agent-state.sh` + `claude/settings.json` の SessionStart フック): herdr ペイン内 (`HERDR_ENV=1`) の Claude Code の状態を herdr に通知。外では no-op。

## fish ヘルパー

| コマンド | 動作 |
|----------|------|
| `agent-add <name> [branch]` | worktree を作り、その中で Claude Code を herdr エージェントとして起動 |
| `agent-fleet` | 艦隊の一覧と状態を表示（`herdr agent list`） |
| `agent-open [name]` | worktree（省略時は現在地）を Zed で開く |

## 典型ワークフロー

```fish
herdr                      # 艦隊を起動 / アタッチ
agent-add feature-x        # worktree + Claude エージェントを1体投入
agent-add bugfix-y main    # main から別エージェントを投入
agent-fleet                # 🔴 が付いた（入力待ちの）エージェントを探す
# → 対応したいものを herdr 上で選択
agent-open feature-x       # そのworktreeを Zed で開いてレビュー・手直し
```

herdr 側の CLI 制御（スクリプト/オーケストレーション用、herdr 0.8.0）:

```fish
herdr agent list                                   # 状態付き一覧
herdr agent wait <target> --until blocked          # blocked になるまで待つ
herdr agent read <target> --source recent          # 直近出力を読む
herdr agent prompt <target> "続けて" --wait         # 入力 + Enter を送る
herdr agent focus <target>                         # フォーカス移動
```

`herdr agent --help` と `herdr agent`（サブコマンド無し）は別の内容を返す。
**後者が完全なシグネチャ**なので、コマンドを調べる時はグループ名を単体で実行する。

## Claude 用スキル

| スキル | 役割 |
|--------|------|
| `claude/skills/herdr/` | herdr 公式。CLI リファレンス（ID 体系・状態遷移・read source の使い分け） |
| `claude/skills/herdr-swarm/` | queen/bee 並列委譲パターン（ryutaroM/rsnug-cli 由来, MIT） |

どちらも `HERDR_ENV=1` ゲート付きで、herdr ペインの外では発火しない。

## 注意点

- **prefix 衝突**: herdr を tmux の**中**で使う場合、`Ctrl+s` が衝突する。`herdr/config.toml` の `prefix` を `ctrl+b` に変える。
- **herdr 統合の再インストール**: `herdr integration install claude` を再実行すると `claude/settings.json` を herdr が全体整形（キー並べ替え・末尾改行削除）し直す。差分が荒れたら手で戻すか、SessionStart フックだけ残す。
- **状態連携は herdr 内でのみ有効**: フックは `HERDR_ENV=1`（herdr ペイン）でしか発火しない。通常ターミナルの Claude には影響なし。
- **0.8.0 で `agent start` の意味論が変わった**: レイアウトを作らなくなり `--cwd` が消えた。既存ペインを要求する（`--kind KIND --pane ID`）。`agent-add` はこれに合わせてタブを先に作る2段構えになっている。
- **新規タブは即座には使えない**: `tab create` 直後のペインはシェル起動チェーンが前面に居るため `agent start` が `agent_pane_busy` を返す。`agent-add` は `pane process-info` でシェルが単独になるまで待つ。自前でスクリプトを書く時も同じ待ちが要る。
- **`herdr status server` は停止中でも exit 0**: 稼働判定には使えない。`fish/functions/__herdr_running.fish` が `herdr agent list` の終了コードで判定している。
