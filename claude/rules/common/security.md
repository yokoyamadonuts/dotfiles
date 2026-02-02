---
paths: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.go", "**/*.rs", "**/*.py"]
description: セキュリティに関する必須ルール。すべてのコードで遵守。
---

# セキュリティルール

コミット前に必ず確認すべきセキュリティチェック項目。

## 必須チェック

### 1. シークレット管理

**禁止**: ハードコードされた秘密情報

```typescript
// ❌ 絶対禁止
const API_KEY = "sk-1234567890abcdef";
const PASSWORD = "admin123";

// ✅ 必ず環境変数を使用
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable is required");
}
```

**検出パターン**:
- `password`, `secret`, `api_key`, `token` を含む代入
- `ghp_`, `sk-`, `aws_`, `AKIA` などのプレフィックス

### 2. 入力検証

**必須**: すべてのユーザー入力を検証

```typescript
// ❌ 未検証
function processData(input: any) {
  return database.query(input);
}

// ✅ 検証済み
function processData(input: unknown) {
  const validated = schema.parse(input); // Zodなどで検証
  return database.query(validated);
}
```

### 3. SQLインジェクション防止

**必須**: パラメータ化クエリを使用

```typescript
// ❌ 危険：文字列連結
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ 安全：パラメータ化
const query = "SELECT * FROM users WHERE id = $1";
const result = await db.query(query, [userId]);
```

### 4. XSS防止

**必須**: ユーザー入力のサニタイズ

```typescript
// ❌ 危険：直接挿入（絶対にしない）
// element.innerHTML = userInput;

// ✅ 安全：textContentを使用
element.textContent = userInput;

// HTMLが必要な場合はDOMPurifyでサニタイズ
// element.innerHTML = DOMPurify.sanitize(userInput);
```

### 5. CSRF対策

**必須**: 状態変更リクエストにトークン

```typescript
// ✅ CSRFトークンを使用
fetch('/api/update', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify(data),
});
```

### 6. レート制限

**必須**: APIエンドポイントにレート制限

```typescript
// ✅ レート制限の実装
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // 最大100リクエスト
});

app.use('/api/', limiter);
```

### 7. 認証・認可

**必須**: アクセス制御の確認

```typescript
// ✅ 認可チェック
async function deleteResource(resourceId: string, userId: string) {
  const resource = await db.findById(resourceId);

  if (resource.ownerId !== userId) {
    throw new ForbiddenError('Not authorized');
  }

  await db.delete(resourceId);
}
```

### 8. エラーメッセージ

**禁止**: 機密情報の露出

```typescript
// ❌ 機密情報を露出（絶対NG）
catch (error) {
  res.status(500).json({
    error: error.message,
    stack: error.stack,
    query: sqlQuery,
  });
}

// ✅ 安全なエラーレスポンス
catch (error) {
  console.error(error); // ログには記録
  res.status(500).json({
    error: 'An unexpected error occurred',
    requestId: requestId,
  });
}
```

## 脆弱性発見時の対応

1. **即座に作業を中断**
2. **security-reviewer エージェントを起動**
3. **Critical問題を最優先で修正**
4. **漏洩した認証情報があれば即座に無効化**
5. **類似パターンをコードベース全体で検索**

## OWASP Top 10 チェックリスト

- [ ] A01:2021 - アクセス制御の不備
- [ ] A02:2021 - 暗号化の失敗
- [ ] A03:2021 - インジェクション
- [ ] A04:2021 - 安全でない設計
- [ ] A05:2021 - セキュリティ設定ミス
- [ ] A06:2021 - 脆弱なコンポーネント
- [ ] A07:2021 - 識別と認証の失敗
- [ ] A08:2021 - ソフトウェアとデータの整合性の不備
- [ ] A09:2021 - セキュリティログとモニタリングの失敗
- [ ] A10:2021 - サーバーサイドリクエストフォージェリ
