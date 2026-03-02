---
name: takt-orchestration
description: taktを使ったAIエージェントの宣言的オーケストレーションを設計・構築する。YAML定義のピース作成、ビルトインピースの選定・カスタマイズ、レビューループの設計、taktの導入・設定を支援。「taktでワークフローを作りたい」「レビューループを自動化したい」「taktの設定」「AIに自走させたい」「ベビーシッター問題を解決」などのリクエストで起動。
---

# takt オーケストレーションスキル

## 概要

[takt](https://github.com/nrslib/takt) を使い、AIエージェント（Claude Code / Codex / OpenCode 等）の作業を宣言的にオーケストレーションする。YAML定義でMovement（ステップ）を宣言し、実装→レビュー→修正のループを構造的に強制することで、AI品質の安定化とベビーシッター問題の解消を実現する。

### 解決する課題

| 課題 | 原因 | taktの解決策 |
|------|------|-------------|
| 品質の不安定性 | LLMが「動けばいい」実装をしがち | レビューMovementを構造的に必須化 |
| Context Rot | 長時間作業でルールが薄まる | Movement毎にセッションリフレッシュ |
| ベビーシッター問題 | 許可ダイアログで人が張り付き | 自動遷移で30分〜2時間自走可能 |
| Lost in the Middle | コンテキスト中盤の指示が軽視 | ステップ分離で各Movementに集中 |

## コアワークフロー

### ステップ1: 目的の把握

```javascript
AskUserQuestion({
  questions: [
    {
      question: "taktで何をしたいですか？",
      header: "目的",
      options: [
        { label: "新規導入", description: "taktをインストールして初期設定する" },
        { label: "ピース選定", description: "ビルトインピースから最適なものを選ぶ" },
        { label: "カスタムピース作成", description: "独自のワークフローをYAMLで定義する" },
        { label: "既存ピースの改善", description: "使用中のピースを改善・拡張する" }
      ],
      multiSelect: false
    },
    {
      question: "プロジェクトの種類は？",
      header: "プロジェクト",
      options: [
        { label: "フロントエンド", description: "React, Vue, Next.js等" },
        { label: "バックエンド", description: "API, サーバー, DB等" },
        { label: "フルスタック", description: "フロント + バックエンド両方" },
        { label: "インフラ/その他", description: "Terraform, CI/CD, ドキュメント等" }
      ],
      multiSelect: false
    }
  ]
})
```

### ステップ2: 導入・設定（新規導入の場合）

前提: Node.js 18+

#### インストール

```bash
npm install -g takt
```

#### グローバル設定（`~/.takt/config.yaml`）

```yaml
provider: claude        # claude | codex | opencode | cursor | copilot
model: sonnet          # 使用モデル
language: ja           # en | ja
```

#### API キー設定

```bash
# Claude Code使用時（APIキー不要 - CLIが認証を管理）
# 直接API使用時：
export TAKT_ANTHROPIC_API_KEY="your-api-key-here"

# その他のプロバイダ：
# TAKT_OPENAI_API_KEY, TAKT_OPENCODE_API_KEY,
# TAKT_CURSOR_API_KEY, TAKT_COPILOT_GITHUB_TOKEN
```

#### ディレクトリ構造

```
~/.takt/                    # グローバル設定
├── config.yaml             # プロバイダ・言語設定
├── pieces/                 # カスタムピース
└── facets/                 # ペルソナ・ポリシー・ナレッジ

.takt/                      # プロジェクト別設定
├── config.yaml
├── tasks.yaml              # タスクキュー
├── tasks/                  # タスク定義
└── runs/                   # 実行ログ
```

### ステップ3: ビルトインピース選定

目的に応じて推奨ピースを提案する。

| ピース | 用途 | 特徴 |
|--------|------|------|
| `default` | 汎用開発 | テスト先行 → 実装 → AIレビュー → 並列レビュー |
| `frontend-mini` | フロントエンド | 計画 → 実装 → 並列レビュー（軽量） |
| `backend-mini` | バックエンド | 計画 → 実装 → 並列レビュー（軽量） |
| `dual-mini` | フルスタック | フロント＋バックエンド対応 |
| `review` | コードレビュー専用 | 5視点並列レビュー（アーキ/セキュリティ/QA/テスト/要件） |
| `unit-test` | テスト作成 | テスト作成に特化 |
| `e2e-test` | E2Eテスト | E2Eテスト作成に特化 |
| `deep-research` | リサーチ | 深掘り調査 |
| `terraform` | インフラ | Terraform特化 |

```bash
# ピース切り替え
takt switch

# ビルトインをカスタマイズ用にエクスポート
takt eject default
```

### ステップ4: カスタムピース作成

#### ピースYAMLの基本構造

```yaml
name: my-piece
description: カスタムワークフローの説明
max_movements: 20                # 最大イテレーション数
initial_movement: plan           # 開始Movement

movements:
  - name: plan                   # Movement名
    edit: false                  # コード編集の可否
    persona: planner             # 使用ペルソナ
    knowledge: architecture      # 参照ナレッジ
    instruction: plan            # facets/instructions/ のファイル名
    rules:                       # 遷移ルール
      - condition: "要件が明確"
        next: implement
      - condition: "情報不足"
        next: ABORT

  - name: implement
    edit: true
    persona: coder
    policy:
      - coding
      - testing
    required_permission_mode: edit
    instruction: implement
    rules:
      - condition: "実装完了"
        next: review
      - condition: "ユーザー確認が必要"
        next: implement
        requires_user_input: true
        interactive_only: true

  - name: review
    edit: false                  # レビューでは編集禁止が重要
    persona: reviewer
    policy: review
    instruction: review-arch
    rules:
      - condition: "問題なし"
        next: COMPLETE
      - condition: "修正が必要"
        next: fix

  - name: fix
    edit: true
    persona: coder
    session: refresh             # コンテキストリフレッシュ
    instruction: fix
    pass_previous_response: false
    rules:
      - condition: "修正完了"
        next: review             # 必ずレビューに戻す
```

#### 並列Movement

```yaml
  - name: reviewers
    parallel:
      - name: arch-review
        edit: false
        persona: architecture-reviewer
        instruction: review-arch
        rules:
          - condition: approved
          - condition: needs_fix
      - name: security-review
        edit: false
        persona: security-reviewer
        instruction: review-security
        rules:
          - condition: approved
          - condition: needs_fix
    rules:
      - condition: all("approved")
        next: COMPLETE
      - condition: any("needs_fix")
        next: fix
```

#### ループモニター（無限ループ防止）

```yaml
loop_monitors:
  - cycle:
      - review
      - fix
    threshold: 3               # 3回繰り返したら判定
    judge:
      persona: supervisor
      instruction_template: |
        review ↔ fix のループが {cycle_count} 回繰り返されました。
        進捗があるか判断してください。
      rules:
        - condition: 進捗あり
          next: review
        - condition: 非生産的
          next: COMPLETE
```

### ステップ5: カスタムペルソナ・ポリシー作成

```bash
# ペルソナファイルの作成
# ~/.takt/facets/personas/my-reviewer.md
```

```markdown
# セキュリティレビュアー
あなたはセキュリティ専門のコードレビュアーです。
OWASP Top 10 を重点的にチェックしてください。
```

ピースで参照：`persona: my-reviewer`

### ステップ6: 実行

```bash
# 対話モードでタスク定義 → /go で実行
takt

# GitHub Issue をタスクとして実行
takt #42

# キューに追加してバッチ実行
takt add #6
takt add #12
takt run

# パイプラインモード（CI/CD向け）
takt --pipeline --task "Fix bug" --auto-pr

# タスク管理（マージ/リトライ/削除）
takt list
```

## ピース設計ガイドライン

### 重要な設計原則

1. **レビューは `edit: false`**: レビューMovementでは必ずコード編集を禁止する。AIが勝手に修正してレビューをスキップすることを防ぐ
2. **修正後は必ずレビューに戻す**: `fix → review` のループを閉じる。`fix → COMPLETE` は禁止
3. **`session: refresh`** を修正Movementで使用: Context Rotを防ぎ、クリーンなコンテキストで修正する
4. **`pass_previous_response: false`**: 修正Movementでは前のレスポンスを引き継がない方が、レポートベースで正確に修正できる
5. **`max_movements`** を設定: 無限ループの安全弁。通常10〜30

### アンチパターン

| やりがちなミス | なぜダメか | 正しい設計 |
|--------------|-----------|-----------|
| レビューで `edit: true` | AIが指摘せず勝手に修正 | `edit: false` を厳守 |
| fix → COMPLETE | レビューをバイパス | fix → review |
| ループモニターなし | 無限ループリスク | threshold 3〜5 で設定 |
| 全Movementに同一ペルソナ | 役割の曖昧化 | 実装/レビュー/修正で分ける |

## 参考リソース

- [takt GitHub リポジトリ](https://github.com/nrslib/takt)
- [Claude CodeとCodexの自動レビューループ実装ガイド](https://zenn.dev/nrs/articles/db4120beb0e601)
- [takt Discord コミュニティ](https://discord.gg/emy8b9dxNK)

## 関連スキル

- **developing**: TDDワークフロー（taktのdefaultピースと補完関係）
- **reviewing-skills**: スキルのレビュー（taktのreviewピースとは別用途）
- **plan-first**: 計画フェーズの設計（taktのplanMovementと類似の思想）
