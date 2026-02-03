# /techdebt - Technical Debt Cleanup

セッション終了時や適宜、技術的負債を検出・削除するコマンド。

## 実行内容

以下の順序で技術的負債を検出・提案する：

### 1. 重複コードの検出

```bash
# 類似コードブロックを検出
jscpd --reporters console --ignore "**/node_modules/**,**/dist/**,**/.git/**" .
```

または手動検索:
- 同一ロジックの関数が複数箇所に存在
- コピペされたコードブロック
- 似たような処理の繰り返し

### 2. 未使用コードの検出

**TypeScript/JavaScript:**
```bash
# 未使用エクスポートを検出
npx ts-prune
# または
npx knip
```

**Go:**
```bash
# 未使用コードを検出
staticcheck ./...
```

**Rust:**
```bash
# 未使用警告を確認
cargo clippy -- -W dead_code
```

### 3. 依存関係の整理

```bash
# 未使用依存関係の検出
npx depcheck  # Node.js
cargo machete # Rust
```

### 4. TODO/FIXMEの棚卸し

```bash
rg "TODO|FIXME|HACK|XXX" --type-add 'code:*.{ts,tsx,js,jsx,go,rs}' -t code
```

## 出力形式

検出結果を以下の形式で報告：

```markdown
## 技術的負債レポート

### 重複コード
| ファイル1 | ファイル2 | 行数 | 提案 |
|-----------|-----------|------|------|
| src/a.ts:10-30 | src/b.ts:15-35 | 20 | 共通関数に抽出 |

### 未使用コード
- `src/utils/old.ts` - ファイル全体が未使用
- `src/types.ts:export OldType` - 未使用エクスポート

### 未使用依存関係
- `lodash` - 参照なし
- `moment` - dayjsに移行済み

### TODO/FIXME
| ファイル | 行 | 内容 | 優先度 |
|----------|-----|------|--------|
| src/api.ts | 42 | TODO: エラーハンドリング追加 | High |
```

## オプション

- `--fix` : 安全に削除できるものは自動削除
- `--report` : レポートのみ生成（変更なし）
- `--scope=<path>` : 特定ディレクトリのみ検査

## 注意事項

- 削除前に必ず確認を求める
- テストが通ることを確認してから削除
- 大きな変更は別ブランチで実施
