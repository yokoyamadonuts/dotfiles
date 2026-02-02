---
description: "ビルドエラー・型エラーを最小限の変更で解決。build-error-resolverエージェントを起動してエラーを順次修正。"
argument-hint: "[--all | --type-only]"
allowed-tools: ["Task", "Bash", "Read", "Grep", "Glob", "Edit", "TodoWrite"]
---

# /build-fix - ビルドエラー修正コマンド

ビルドエラーを最小限の変更で迅速に解決します。

## 使い方

```
/build-fix          # すべてのビルドエラーを修正
/build-fix --type-only  # 型エラーのみ修正
```

---

## [1/4] エラー収集

### 引数の解析

```
引数: $ARGUMENTS
- --type-only: 型チェックエラーのみ
- --all または 空: すべてのビルドエラー
```

### 言語検出とエラー収集

#### TypeScript/JavaScript

```bash
# 型チェック
npx tsc --noEmit 2>&1 | head -100

# ビルド
npm run build 2>&1 | grep -A 3 "error"
```

#### Go

```bash
# コンパイル
go build ./... 2>&1

# 静的解析
go vet ./... 2>&1
```

#### Rust

```bash
# 高速チェック
cargo check 2>&1

# ビルド
cargo build 2>&1
```

### エラーサマリー表示

```
検出されたエラー: N 件

型エラー:
1. src/components/User.tsx:15 - Type 'string | undefined' is not assignable to type 'string'
2. src/services/api.ts:42 - Argument of type 'null' is not assignable

インポートエラー:
3. src/utils/index.ts:5 - Module not found: './helper'

設定エラー:
4. tsconfig.json - Missing "outDir" option
```

---

## [2/4] エラー分類

### カテゴリ分け

| カテゴリ | 優先度 | 例 |
|---------|--------|-----|
| 型不一致 | 高 | Type 'X' is not assignable to type 'Y' |
| null/undefined | 高 | Object is possibly 'undefined' |
| インポート | 中 | Module not found |
| 設定 | 中 | tsconfig/cargo.toml エラー |
| 依存関係 | 低 | Version mismatch |

---

## [3/4] 順次修正

### 各エラーについて

1. **最小限の修正を特定**
2. **修正を適用**
3. **再ビルドで確認**
4. **新しいエラーがないか確認**

### 修正パターン

#### null/undefined

```typescript
// Before
const value = obj.prop;

// After - オプション1: オプショナルチェーン
const value = obj?.prop;

// After - オプション2: デフォルト値
const value = obj.prop ?? defaultValue;
```

#### 型不一致

```typescript
// Before
function process(data) { ... }

// After - 型を明示
function process(data: DataType) { ... }
```

#### ジェネリクス制約

```typescript
// Before
function get<T>(item: T) { return item.id; }

// After - 制約を追加
function get<T extends { id: string }>(item: T) { return item.id; }
```

---

## [4/4] 検証

### ビルド成功確認

```bash
# TypeScript
npx tsc --noEmit && echo "✅ 型チェック通過"
npm run build && echo "✅ ビルド成功"

# Go
go build ./... && echo "✅ ビルド成功"

# Rust
cargo build && echo "✅ ビルド成功"
```

### 成功基準

- [ ] 型チェック通過
- [ ] ビルド成功
- [ ] Lint通過
- [ ] 新しいエラーなし
- [ ] 変更行数が最小限

---

## 修正レポート

```markdown
# ビルドエラー修正レポート

## 修正前: X 件のエラー

## 修正内容

### 1. `src/components/User.tsx:15`
- **エラー**: Type 'string | undefined' is not assignable
- **修正**: オプショナルチェーンを追加
- **変更**: 1行

### 2. `src/services/api.ts:42`
- **エラー**: Argument of type 'null' is not assignable
- **修正**: 型パラメータを追加
- **変更**: 1行

## 検証結果

- TypeScript: ✅ Pass
- Build: ✅ Pass
- 総変更行数: 2行
```

---

## 注意事項

### やるべきこと

- 最小限の変更で修正
- 1エラーずつ修正して確認
- 型システムを尊重

### やってはいけないこと

- リファクタリング
- パフォーマンス最適化
- ロジック変更
- any型の乱用
