---
name: agent-memory
description: 作業中断時に進捗を記憶し、再開時に思い出す機能。「記憶して」「覚えて」で要点をマークダウンとして保存し、「思い出して」で検索・復帰できます。
---

# Agent Memory

作業中の発見・決定事項・調査結果を永続化し、後で参照できる記憶領域。

## 発動トリガー

以下のフレーズで自動発動:
- 保存: 「記憶して」「覚えておいて」「保存して」「メモして」
- 検索: 「思い出して」「前回の○○」「○○について覚えてる？」

## プロアクティブな使用

以下の場合は自発的に記憶を活用する:

### 保存すべきタイミング
- 複雑なバグの原因特定と解決策を発見した時
- アーキテクチャ上の重要な決定を行った時
- 外部ライブラリの使い方で試行錯誤した結果
- 調査に時間がかかった内容

### 検索すべきタイミング
- 関連する作業を始める前
- 「前にも似たことやった気がする」と感じた時
- ユーザーが過去の作業に言及した時

## メモリの場所

```
.claude/skills/agent-memory/memories/
├── {カテゴリ}/
│   ├── {トピック}.md
│   └── ...
└── ...
```

## フォルダ構造

カテゴリフォルダはkebab-caseで命名:

```
memories/
├── architecture-decisions/   # アーキテクチャ決定
├── bug-investigations/       # バグ調査
├── library-usage/            # ライブラリ使い方
├── performance-tuning/       # パフォーマンス改善
└── project-context/          # プロジェクト固有の文脈
```

カテゴリは固定ではなく、内容に応じて柔軟に作成・整理する。

## フロントマター（必須）

すべてのメモリファイルに以下を含める:

```yaml
---
summary: "1-2行の要約（検索用キーワードを含める）"
created: YYYY-MM-DD
---
```

### オプションフィールド

```yaml
---
summary: "Issue #123 の調査結果と解決方針"
created: 2025-01-15
updated: 2025-01-20
status: in-progress  # in-progress | resolved | blocked | abandoned
tags: [authentication, jwt, security]
related: [auth-refactoring.md, jwt-implementation.md]
---
```

**重要**: summaryは「このファイルを読むべきか」を判断するための要約。具体的かつ検索しやすい表現で書く。

## 検索ワークフロー

効率的な段階的開示（Progressive Disclosure）:

### 1. カテゴリ一覧を確認
```bash
ls .claude/skills/agent-memory/memories/
```

### 2. summary行のみを検索（高速）
```bash
rg "^summary:" .claude/skills/agent-memory/memories/ --no-ignore --hidden
```

### 3. キーワードでsummaryを絞り込み
```bash
rg "^summary:.*認証" .claude/skills/agent-memory/memories/ --no-ignore --hidden
```

### 4. タグで検索
```bash
rg "^tags:.*\[.*jwt.*\]" .claude/skills/agent-memory/memories/ --no-ignore --hidden
```

### 5. 全文検索（summary検索で見つからない場合のみ）
```bash
rg "検索ワード" .claude/skills/agent-memory/memories/ --no-ignore --hidden
```

**原則**: まずsummaryで判断し、必要なファイルのみ読み込む。

## メモリ操作

### 保存（重複チェック付き）

**重要**: 新規作成前に必ず類似ファイルを検索し、統合を検討する。

#### ステップ1: 類似ファイルの検索

```bash
# 1. 同じカテゴリ内のファイル一覧を確認
ls .claude/skills/agent-memory/memories/{category}/

# 2. キーワードでsummaryを検索（複数キーワードで試す）
rg "^summary:.*{キーワード1}" .claude/skills/agent-memory/memories/ --no-ignore --hidden
rg "^summary:.*{キーワード2}" .claude/skills/agent-memory/memories/ --no-ignore --hidden

# 3. タグで検索
rg "^tags:.*{関連タグ}" .claude/skills/agent-memory/memories/ --no-ignore --hidden
```

#### ステップ2: 統合判断

| 検索結果 | アクション |
|---------|-----------|
| 類似ファイルなし | 新規作成 |
| 同一トピックのファイルあり | **既存ファイルに追記** |
| 関連するが別トピック | 新規作成 + `related`フィールドでリンク |

**統合すべきケース**:
- 同じ機能/ライブラリについての追加調査
- 以前の調査の続き・更新
- 同じバグの再発・追加情報

**別ファイルにすべきケース**:
- 異なる問題・異なる解決策
- 独立したトピック（たまたまキーワードが一致）

#### ステップ3a: 既存ファイルに追記（類似ファイルがある場合）

```bash
# 既存ファイルを読み込み
cat .claude/skills/agent-memory/memories/{category}/{existing-file}.md

# 追記（updatedを更新し、新しいセクションを追加）
```

追記時のフォーマット:
```markdown
---
summary: "更新された要約（新しい発見を含める）"
created: 2025-01-15
updated: 2025-02-03  # ← 追加/更新
status: in-progress
tags: [tag1, tag2, new-tag]  # ← 必要に応じてタグ追加
---

## 背景・コンテキスト
[既存の内容]

## 発見・結論
[既存の内容]

### 追加調査 (2025-02-03)  # ← 日付付きで追記
[新しい発見・情報]

## 詳細
[既存 + 新規の内容]

## 次のステップ
[更新された残作業]
```

#### ステップ3b: 新規作成（類似ファイルがない場合）

```bash
# カテゴリフォルダを作成（必要な場合）
mkdir -p .claude/skills/agent-memory/memories/{category}

# メモリファイルを作成
cat > .claude/skills/agent-memory/memories/{category}/{topic}.md << 'EOF'
---
summary: "1-2行の要約"
created: YYYY-MM-DD
---

## 背景・コンテキスト
[なぜこの調査・作業を行ったか]

## 発見・結論
[主要な発見事項]

## 詳細
[具体的な内容、コード例など]

## 次のステップ
[残作業、今後の展開]
EOF
```

### 更新

既存メモリの内容を更新する場合:
1. `updated` フィールドを追加・更新
2. 必要に応じて `status` を更新
3. 新しい発見を追記

### 削除

不要になったメモリは削除:
```bash
rm .claude/skills/agent-memory/memories/{category}/{topic}.md
```

### 整理・統合

#### 統合すべきサイン

以下の状態になったら統合を検討:
- 同じカテゴリに5つ以上のファイルがある
- 似たトピックのファイルが複数存在する
- ファイル名の末尾に `-2`, `-v2`, `-続き` などがついている

#### 統合手順

1. **関連ファイルを特定**
   ```bash
   # カテゴリ内のファイル一覧
   ls -la .claude/skills/agent-memory/memories/{category}/

   # summary一覧で関連性を確認
   rg "^summary:" .claude/skills/agent-memory/memories/{category}/ --no-ignore --hidden
   ```

2. **統合ファイルを作成**
   - 最も包括的なファイルをベースにする
   - 他のファイルの内容をセクションとして追加
   - 日付順に情報を整理

3. **元ファイルを削除**
   ```bash
   rm .claude/skills/agent-memory/memories/{category}/{old-file}.md
   ```

#### 統合テンプレート

```markdown
---
summary: "統合された包括的な要約"
created: 2025-01-10  # 最初の調査日
updated: 2025-02-03
status: resolved
tags: [統合されたタグ一覧]
consolidated_from: [file1.md, file2.md, file3.md]  # 統合元を記録
---

## 概要
[統合されたトピックの全体像]

## 調査履歴

### 初回調査 (2025-01-10)
[file1.mdの内容]

### 追加調査 (2025-01-20)
[file2.mdの内容]

### 最終解決 (2025-02-03)
[file3.mdの内容]

## 結論・ベストプラクティス
[学んだことのまとめ]
```

## コンテンツガイドライン

### 含めるべき内容

- **Context（背景）**: なぜこの作業を行ったか
- **State（状態）**: 作業時点での状況
- **Details（詳細）**: 具体的な発見、コード例、設定値
- **Next Steps（次のステップ）**: 残作業、今後の展開

### 記述の原則

1. **再開のために書く**: 後で文脈を失っても続けられるように
2. **自己完結**: そのファイルだけで理解できるように
3. **常に最新**: 古い情報は更新または削除
4. **実用的に**: 抽象的すぎず、具体的なアクションにつながる内容

## 例: 調査メモリ

```yaml
---
summary: "NextAuth.js v5でのJWTセッション設定方法と注意点"
created: 2025-01-15
status: resolved
tags: [nextauth, jwt, authentication]
---
```

```markdown
## 背景
ユーザー認証をNextAuth.js v5で実装中、JWTセッションの設定でハマった。

## 発見
- v5では `jwt` callback の引数が変更されている
- `session.strategy: "jwt"` は明示的に設定が必要
- トークン更新は `trigger: "update"` で検知

## 解決策
[具体的なコード例]

## 次のステップ
- リフレッシュトークンの実装
- セッション有効期限の調整
```
