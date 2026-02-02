# MCP (Model Context Protocol) 設定

Claude CodeでMCPサーバーを使用するための設定ガイド。

## 概要

- `mcp.json.template` - テンプレートファイル（dotfilesで管理）
- `~/.config/claude/mcp.json` - 実際の設定ファイル（install.shで生成）

## セットアップ

```bash
cd claude && ./install.sh
```

初回実行時、`mcp.json.template`から`~/.config/claude/mcp.json`が生成される。
`envsubst`がインストールされていれば環境変数が展開される。

## MCPサーバーの追加

### CLIから追加（推奨）

```bash
# PostgreSQL
claude mcp add postgres -- npx -y @bytebase/dbhub --dsn "$POSTGRES_DSN"

# GitHub
claude mcp add github -- npx -y @anthropic/mcp-server-github

# Filesystem
claude mcp add filesystem -- npx -y @anthropic/mcp-server-filesystem ~/docs
```

### テンプレートに追加

`mcp.json.template`を編集して環境変数を使った設定を追加：

```json
{
  "mcpServers": {
    "postgres": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@bytebase/dbhub", "--dsn", "${POSTGRES_DSN}"]
    },
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

環境変数を`.zshrc`や`.envrc`で設定：

```bash
export POSTGRES_DSN="postgresql://user:pass@localhost:5432/mydb"
export GITHUB_TOKEN="ghp_xxxx"
```

## よく使うMCPサーバー

| サーバー | 用途 | インストール |
|---------|------|------------|
| `@bytebase/dbhub` | PostgreSQL/MySQL接続 | `npx -y @bytebase/dbhub` |
| `@anthropic/mcp-server-github` | GitHub操作 | `npx -y @anthropic/mcp-server-github` |
| `@anthropic/mcp-server-filesystem` | ファイルアクセス | `npx -y @anthropic/mcp-server-filesystem` |
| `@anthropic/mcp-server-fetch` | HTTPリクエスト | `npx -y @anthropic/mcp-server-fetch` |

## 設定の確認

```bash
# 現在のMCP設定を確認
cat ~/.config/claude/mcp.json

# Claude Code内で確認
claude
> /mcp
```

## 注意事項

- 認証情報（トークン、パスワード）は環境変数で管理
- `mcp.json.template`には実際の認証情報を書かない
- 新しい環境では`install.sh`実行後、環境変数を設定してから再生成
