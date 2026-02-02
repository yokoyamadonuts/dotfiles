---
description: "デッドコード・重複コード・未使用依存関係を検出して安全に削除。refactor-cleanerエージェントを起動。"
argument-hint: "[--detect-only | --auto-fix]"
allowed-tools: ["Task", "Bash", "Read", "Grep", "Glob", "Edit", "TodoWrite", "AskUserQuestion"]
---

# /refactor-clean - コードクリーンアップコマンド

デッドコード、重複、未使用エクスポートを検出し、安全に削除します。

## 使い方

```
/refactor-clean              # 検出して確認後に修正
/refactor-clean --detect-only  # 検出のみ（修正しない）
/refactor-clean --auto-fix     # 検出して自動修正
```

---

## [1/5] 検出ツール実行

### 引数の解析

```
引数: $ARGUMENTS
- --detect-only: 検出のみ
- --auto-fix: 自動修正
- 空: 対話的に修正
```

### 言語別検出

#### TypeScript/JavaScript

```bash
# 包括的な検出
npx knip

# 未使用の依存関係
npx depcheck

# 未使用のエクスポート
npx ts-prune

# ESLint
npx eslint --rule 'no-unused-vars: error' .
```

#### Go

```bash
# 未使用コード検出
go vet ./...
staticcheck ./...

# 未使用の依存関係
go mod tidy -v
```

#### Rust

```bash
# 未使用コードの警告
cargo build 2>&1 | grep "warning: unused"

# Clippy
cargo clippy -- -W unused
```

---

## [2/5] 結果分類

### カテゴリ別整理

```markdown
## 検出結果

### 未使用のファイル (安全度: 高)
- `src/utils/deprecated.ts` - 6ヶ月以上変更なし
- `src/components/OldButton.tsx` - インポートなし

### 未使用のエクスポート (安全度: 中)
- `export function oldHelper()` in `src/utils/index.ts`
- `export const LEGACY_CONFIG` in `src/config.ts`

### 未使用の依存関係 (安全度: 高)
- `lodash` - 使用箇所なし
- `moment` - `dayjs`に置換済み

### 重複コード (安全度: 中)
- フェッチロジック: 5箇所で同じパターン
- バリデーション: 3箇所で重複

### 未使用の変数 (安全度: 高)
- `const unused` in `src/services/api.ts:45`
```

---

## [3/5] リスク評価

### 各項目の安全確認

```bash
# 使用箇所を検索
grep -rn "functionName" --include="*.{ts,tsx,js,jsx}"

# Git履歴で確認
git log -p --all -S "functionName" --since="6 months ago"

# 動的インポートを確認
grep -rn "import(" --include="*.{ts,tsx}"
```

### リスク分類

| リスク | 説明 | 確認方法 |
|--------|------|----------|
| 安全 | 明確に未使用 | grep検索で0件 |
| 要確認 | 動的インポートの可能性 | `import()` パターン確認 |
| 危険 | 公開APIの可能性 | エクスポート先を確認 |

---

## [4/5] 削除実行

### 削除の優先順位

1. **最も安全なものから**
   - 未使用のローカル変数
   - 未使用のインポート
   - 未使用のローカル関数

2. **中程度のリスク**
   - 未使用のファイル
   - 未使用の依存関係

3. **高リスク（要確認）**
   - エクスポートされた関数
   - 設定ファイル

### ユーザー確認

`--auto-fix`でない場合:

```javascript
AskUserQuestion({
  questions: [
    {
      question: "以下の項目を削除しますか？",
      header: "削除確認",
      options: [
        { label: "安全な項目のみ削除", description: "未使用変数・インポートのみ（推奨）" },
        { label: "すべて削除", description: "検出されたすべての項目を削除" },
        { label: "個別に選択", description: "削除する項目を1つずつ確認" },
        { label: "キャンセル", description: "削除せずに終了" }
      ],
      multiSelect: false
    }
  ]
})
```

---

## [5/5] 検証と記録

### テスト実行

```bash
# テストがすべて通過することを確認
npm test

# ビルドが成功することを確認
npm run build
```

### 削除ログ

`docs/DELETION_LOG.md` に記録:

```markdown
# コード削除ログ

## YYYY-MM-DD

### 削除内容

| 項目 | 場所 | 理由 | 確認方法 |
|------|------|------|----------|
| `oldHelper()` | src/utils/index.ts | 6ヶ月間未使用 | grep, git log |
| `lodash` | package.json | 使用箇所なし | depcheck |

### 影響

- 削除行数: 150行
- バンドルサイズ削減: 72KB (lodash)
- 依存関係削除: 1パッケージ

### 検証

- [x] 全テスト通過
- [x] ビルド成功
- [x] 開発環境で動作確認
```

---

## 保護対象（削除禁止）

以下は明示的な確認なしに削除しない:

- 認証・認可システム
- 決済・ウォレット連携
- データベースクライアント
- 重要なビジネスロジック
- 外部API連携
- セキュリティ関連コード

---

## 重複コードの統合例

### Before

```typescript
async function fetchUsers() {
  const res = await fetch('/api/users');
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

async function fetchPosts() {
  const res = await fetch('/api/posts');
  if (!res.ok) throw new Error('Failed');
  return res.json();
}
```

### After

```typescript
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

const fetchUsers = () => fetchJson<User[]>('/api/users');
const fetchPosts = () => fetchJson<Post[]>('/api/posts');
```

---

## 統合の判断基準

- 3回以上繰り返し → 抽出を検討
- 2回の繰り返し → 複雑さによる
- 1回のみ → そのまま維持
