---
name: harness-engineering
description: Claude Codeのハーネス（CLAUDE.md、Hooks、Skills、MCP、Permissions、Rules）を特定プロジェクトに最適化して構築・改善します。新規プロジェクトのClaude Code環境セットアップ、既存プロジェクトのハーネス改善、チーム開発向けのClaude Code標準化が必要な場合に使用します。
---

# ハーネスエンジニアリング

## 概要

Claude Codeの「ハーネス」とは、Claudeの振る舞いを制御・最適化するための設定レイヤー群（CLAUDE.md、Hooks、Skills、MCP、Rules、Permissions）の総称である。このスキルは、特定のプロジェクトに対してハーネスを調査・設計・実装し、Claude Codeの開発生産性を最大化する。

**ハーネスの構成要素:**

```
ハーネス = CLAUDE.md（記憶・指示）
         + Hooks（決定論的な自動化）
         + Skills（再利用ワークフロー）
         + Rules（パス固有ルール）
         + MCP Servers（外部ツール統合）
         + Permissions（安全性制御）
```

## コアワークフロー

### ステップ1: プロジェクト現状調査

対象プロジェクトのClaude Code環境を包括的に調査する。

**調査対象:**

```javascript
// 1. 既存ハーネス構成の確認
Glob(pattern="**/CLAUDE.md")
Glob(pattern="**/CLAUDE.local.md")
Glob(pattern="**/.claude/settings.json")
Glob(pattern="**/.claude/settings.local.json")
Glob(pattern="**/.claude/commands/**/*.md")
Glob(pattern="**/.claude/skills/**/SKILL.md")
Glob(pattern="**/.claude/rules/**/*.md")
Glob(pattern="**/.claude/hooks/**")

// 2. プロジェクト特性の確認
Read(file_path="package.json")       // or Cargo.toml, go.mod, etc.
Read(file_path=".gitignore")
Glob(pattern="**/*.test.*")          // テスト構成
Glob(pattern="**/Dockerfile*")       // コンテナ構成
Glob(pattern="**/.github/workflows/**") // CI/CD
```

**調査結果のまとめ:**

| 項目 | 確認内容 |
|------|---------|
| 言語・フレームワーク | 主要言語、フレームワーク、ビルドツール |
| テスト環境 | テストランナー、テストコマンド、カバレッジツール |
| リンター・フォーマッター | ESLint, Prettier, rustfmt 等 |
| CI/CD | GitHub Actions, CircleCI 等 |
| 既存ハーネス | CLAUDE.md の有無と内容 |
| チーム構成 | ソロ開発 or チーム開発 |

### ステップ2: ハーネス設計方針の決定

AskUserQuestionで方針を確認する：

```javascript
AskUserQuestion({
  questions: [
    {
      question: "ハーネスの構築範囲はどこまでですか？",
      header: "構築範囲",
      options: [
        {
          label: "フル構築",
          description: "CLAUDE.md + Hooks + Rules + MCP をすべて最適化"
        },
        {
          label: "CLAUDE.mdのみ",
          description: "プロジェクト指示ファイルの作成・改善に集中"
        },
        {
          label: "Hooks + 自動化",
          description: "フック設定による自動化に集中"
        },
        {
          label: "改善のみ",
          description: "既存ハーネスの問題点を特定し改善"
        }
      ],
      multiSelect: false
    },
    {
      question: "このプロジェクトの開発スタイルは？",
      header: "開発スタイル",
      options: [
        {
          label: "ソロ開発",
          description: "個人プロジェクト。CLAUDE.local.md 中心"
        },
        {
          label: "チーム開発",
          description: "複数人。CLAUDE.md をGitにコミット"
        },
        {
          label: "OSS",
          description: "コントリビューター向けのガイドも含む"
        }
      ],
      multiSelect: false
    }
  ]
})
```

### ステップ3: CLAUDE.md の設計・作成

**3つの黄金律に従う:**

1. **200行以下** - 長すぎると指示の遵守率が低下する
2. **具体的に書く** - 「適切に」ではなく「2スペースインデント」
3. **Claudeが推測できないことだけ書く** - 標準的な言語規約は不要

**必須セクション構造:**

```markdown
# CLAUDE.md

## プロジェクト概要
[1-2文でプロジェクトの目的と技術スタックを説明]

## 開発コマンド
[Claudeが推測できないビルド・テスト・リントコマンド]

## コードスタイル
[プロジェクト固有の規約のみ。標準規約は書かない]

## アーキテクチャ
[ディレクトリ構造の意図、レイヤー分離のルール]

## 重要な注意事項
[地雷原: 触ってはいけないファイル、既知の制約]
```

**効果的な記述パターン:**

```markdown
# ✅ 良い例: 具体的で簡潔
## 開発コマンド
- テスト: `npm test -- --watch` (単一ファイル: `npm test -- path/to/file`)
- リント: `npm run lint` (自動修正: `npm run lint:fix`)
- ビルド: `npm run build`

## コードスタイル
- インポート順: React → 外部ライブラリ → 内部モジュール → 型
- コンポーネントは名前付きexport（default export禁止）
- APIレスポンスの型は src/types/api/ に定義

# ❌ 悪い例: 曖昧で冗長
## コードスタイル
- きれいなコードを書いてください
- ベストプラクティスに従ってください
- テストを忘れないでください
```

**やってはいけないこと:**

- 標準的な言語規約を繰り返す（TypeScriptの型の使い方など）
- 変更頻度の高い情報を書く（すぐ陳腐化する）
- 長い入門書やチュートリアルを書く
- ファイル一覧を羅列する（Claudeは自分で探索できる）

### ステップ4: Hooks の設計・実装

**Hooks vs CLAUDE.md の使い分け:**

| 特性 | CLAUDE.md | Hooks |
|------|-----------|-------|
| 実行保証 | なし（LLM判断） | あり（決定論的） |
| 柔軟性 | 高い（自然言語） | 低い（シェルコマンド） |
| 用途 | ガイドライン、規約 | 自動化、ガードレール |

**推奨Hooks構成:**

#### SessionStart: 環境初期化
```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "if command -v direnv &>/dev/null; then direnv export json 2>/dev/null | jq -r 'to_entries[] | \"export \\(.key)=\\(.value)\"' ; fi",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

#### PostToolUse: 自動フォーマット
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "file=$(jq -r '.tool_input.file_path // .tool_input.filePath // empty'); if [ -n \"$file\" ] && [ -f \"$file\" ]; then npx prettier --write \"$file\" 2>/dev/null; fi",
            "timeout": 10000
          }
        ]
      }
    ]
  }
}
```

#### PreToolUse: 危険操作のブロック
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "cmd=$(jq -r '.tool_input.command // empty'); if echo \"$cmd\" | grep -qE '(rm -rf /|drop table|--force|--no-verify)'; then echo 'BLOCKED: Dangerous command detected' >&2; exit 2; fi",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

#### Stop: テスト確認
```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo '{\"decision\": \"block\", \"reason\": \"テストを実行して全てパスすることを確認してください\"}'",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

**Hook設計の原則:**
- 高速に保つ（timeout 10秒以下）
- 冪等にする（何度実行しても同じ結果）
- 失敗時のフォールバックを考慮（exit 0でスキップ可能に）
- stderrにユーザー向けメッセージを出力

### ステップ5: Rules の設計

パス固有のルールで、特定ディレクトリのファイルに追加指示を与える。

**Rulesの配置:**
```
.claude/rules/
├── api.md          # src/api/** 向け
├── components.md   # src/components/** 向け
└── tests.md        # **/*.test.* 向け
```

**Rule ファイルのフォーマット:**
```markdown
---
paths:
  - "src/api/**/*.ts"
---

# API開発ルール
- すべてのエンドポイントに入力バリデーションを実装
- エラーレスポンスは標準形式 { error: string, code: number } を使用
- レート制限ミドルウェアを適用
- リクエスト/レスポンスの型を src/types/api/ に定義
```

**Rules vs CLAUDE.md の使い分け:**
- CLAUDE.md: プロジェクト全体に適用するルール
- Rules: 特定のファイルパターンにのみ適用するルール

### ステップ6: MCP Servers の統合

**推奨MCP構成:**

```json
{
  "mcpServers": {
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    }
  }
}
```

**MCP設定のスコープ選択:**

| スコープ | 設定ファイル | 用途 |
|---------|------------|------|
| 個人用 | `~/.claude/settings.json` | 全プロジェクトで使うMCP |
| チーム共有 | `.claude/settings.json` | Git管理、チーム標準 |
| ローカル | `.claude/settings.local.json` | 個人のAPI キー等 |

### ステップ7: Permissions の設定

**権限モードの選択:**

```javascript
AskUserQuestion({
  questions: [
    {
      question: "権限モードはどれを使用しますか？",
      header: "権限モード",
      options: [
        {
          label: "allowedTools（推奨）",
          description: "許可するツールを明示的にリスト。最も安全"
        },
        {
          label: "permission-prompt-tool",
          description: "ツール使用時に都度確認。初期導入向け"
        },
        {
          label: "bypassPermissions",
          description: "自動承認ルール。信頼できるコマンドのみ"
        }
      ],
      multiSelect: false
    }
  ]
})
```

**Permission Rules の設計:**
```json
{
  "permissions": {
    "allow": [
      "Read",
      "Glob",
      "Grep",
      "Bash(npm test*)",
      "Bash(npm run lint*)",
      "Bash(npm run build*)",
      "Bash(git status*)",
      "Bash(git diff*)",
      "Bash(git log*)"
    ],
    "deny": [
      "Bash(rm -rf*)",
      "Bash(git push --force*)",
      "Bash(git reset --hard*)"
    ]
  }
}
```

### ステップ8: ハーネス品質チェックリスト

すべての設定を実装した後、以下のチェックリストで品質を検証する。

**CLAUDE.md チェック:**
- [ ] 200行以下に収まっているか
- [ ] Claudeが推測できない情報のみ記載しているか
- [ ] ビルド・テスト・リントコマンドが明記されているか
- [ ] プロジェクト固有のアーキテクチャルールがあるか
- [ ] 曖昧な表現（「適切に」「きれいに」）がないか

**Hooks チェック:**
- [ ] タイムアウトが適切に設定されているか（10秒以下推奨）
- [ ] 冪等性が保たれているか
- [ ] エラー時のフォールバックが考慮されているか
- [ ] stderrでユーザー向けメッセージを出力しているか

**Rules チェック:**
- [ ] pathsパターンが正しいか
- [ ] CLAUDE.mdと重複していないか
- [ ] パス固有の情報のみ記載しているか

**MCP チェック:**
- [ ] 必要なMCPサーバーが設定されているか
- [ ] APIキー等の秘密情報がGitに含まれていないか
- [ ] settings.local.json が .gitignore に追加されているか

**Permissions チェック:**
- [ ] 安全なコマンドがallow に含まれているか
- [ ] 危険なコマンドがdenyに含まれているか
- [ ] 日常的な開発で不要な確認ダイアログが出ないか

### ステップ9: 出力ファイルの生成

調査結果と設計に基づき、以下のファイルを生成する：

```
<project-root>/
├── CLAUDE.md                      # プロジェクト指示
├── .claude/
│   ├── settings.json              # チーム共有設定（Hooks, MCP, Permissions）
│   ├── settings.local.json        # 個人設定（.gitignore対象）
│   └── rules/
│       └── <path-specific>.md     # パス固有ルール
└── .gitignore                     # settings.local.json を追加
```

## ハーネス改善パターン

既存ハーネスを改善する場合の典型パターン：

### パターン1: CLAUDE.md肥大化
**症状:** 300行超え、指示が守られない
**対処:** 
- Rules に分離可能なパス固有ルールを移動
- 冗長な説明を削除し、コマンド例に置き換え
- `@path/to/detail.md` で詳細を外部化

### パターン2: 手動フォーマット修正の繰り返し
**症状:** Claudeが書いたコードを毎回手動でフォーマット
**対処:** PostToolUse Hook でフォーマッター自動実行

### パターン3: 危険コマンドの実行
**症状:** rm -rf や force push を確認なしに実行
**対処:** PreToolUse Hook + deny Permission で二重防御

### パターン4: ライブラリAPIの古い知識
**症状:** 廃止されたAPIを使おうとする
**対処:** context7 MCP の導入 + CLAUDE.mdに「context7で最新ドキュメントを確認」を記載

## 関連スキル

- `creating-rules` - Rulesファイルの作成に特化
- `reviewing-skills` - 作成したSkillの品質レビュー
- `developing` - TDD + アーキテクチャ設計による開発
