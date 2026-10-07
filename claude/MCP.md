# MCP (Model Context Protocol) 設定

Claude Code で MCP サーバーを使うための設定ガイド。

## 設定の置き場所（Claude Code が実際に読む場所）

| スコープ | ファイル | 追加コマンド | 用途 |
|---------|---------|-------------|------|
| user | `~/.claude.json`（Claude Code が管理。手で編集しない） | `claude mcp add --scope user <name> -- <cmd>` | このマシン全体で使うサーバー |
| project | `<repo>/.mcp.json`（コミットして共有） | `claude mcp add --scope project <name> -- <cmd>` | リポジトリ固有のサーバー |
| local | `<repo>/.claude/settings.local.json`（gitignore） | `claude mcp add --scope local <name> -- <cmd>` | 自分だけ・そのリポだけ |

`~/.config/claude/mcp.json` は Claude Code の読み込み対象ではない（旧テンプレートは廃止）。

project スコープの `.mcp.json` を無確認で有効にするには、`claude/settings.json` の `enableAllProjectMcpServers: true`（設定済み）を使う。

## よく使う操作

```bash
claude mcp list                 # 登録済みサーバーと接続状態
claude mcp get <name>           # 1 つの設定を表示
claude mcp remove <name>        # 削除
claude mcp add --scope user chrome-devtools -- npx -y chrome-devtools-mcp@latest
```

滅多に使わないサーバーには設定エントリに `"alwaysLoad": false` を付けると、そのサーバーのツール定義がツール検索の背後に遅延され、毎セッションのコンテキストを節約できる（2.1.287 以降）。

`.mcp.json` では `${ENV_VAR}` 形式の環境変数展開が使える（トークンを直書きしない）:

```json
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

## このマシンの user スコープ（2026-10 時点）

- `chrome-devtools`: `npx -y chrome-devtools-mcp@latest`（`qa-testing` / `web-perf` スキルが使う）
- `pencil`: Pencil.app 同梱の MCP サーバー（`permissions.allow` に `mcp__pencil` を許可済み）

新しいマシンでは上の `claude mcp add --scope user` を実行して再現する。
