---
paths: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.go", "**/*.rs"]
description: コーディングスタイルに関するルール。
---

# コーディングスタイルルール

## 基本原則

### 1. イミュータビリティ

```typescript
// ❌ ミュータブル
function updateUser(user: User, name: string) {
  user.name = name; // オブジェクトを直接変更
  return user;
}

// ✅ イミュータブル
function updateUser(user: User, name: string): User {
  return { ...user, name }; // 新しいオブジェクトを返す
}
```

### 2. ファイルサイズ

| 項目 | 推奨 | 最大 |
|------|------|------|
| ファイル行数 | 200-400行 | 800行 |
| 関数行数 | 20-30行 | 50行 |
| ネスト深度 | 2-3レベル | 4レベル |

### 3. ファイル構成

```
// ❌ 型別に分類
src/
  types/
  components/
  utils/

// ✅ 機能別に分類
src/
  features/
    auth/
      components/
      hooks/
      types.ts
    products/
      components/
      hooks/
      types.ts
```

## 命名規則

### 変数・関数

```typescript
// 動詞で始める関数名
function getUserById(id: string) { ... }
function calculateTotal(items: Item[]) { ... }
function validateEmail(email: string) { ... }

// 名詞の変数名
const userList = [];
const totalPrice = 0;
const isValid = true; // booleanは is/has/can 接頭辞
```

### コンポーネント

```typescript
// PascalCaseのコンポーネント名
function UserProfile() { ... }
function ProductCard() { ... }

// camelCaseのカスタムフック
function useAuth() { ... }
function useDebounce() { ... }
```

## エラーハンドリング

### 必須パターン

```typescript
// ✅ 包括的なエラーハンドリング
async function fetchUser(id: string): Promise<User> {
  try {
    const response = await api.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    if (error instanceof NetworkError) {
      throw new UserFetchError('ネットワークエラーが発生しました');
    }
    if (error instanceof NotFoundError) {
      throw new UserFetchError('ユーザーが見つかりません');
    }
    throw new UserFetchError('予期しないエラーが発生しました');
  }
}
```

### ユーザーフレンドリーなエラー

```typescript
// ❌ 生のエラー
catch (error) {
  alert(error.message);
}

// ✅ ユーザー向けメッセージ
catch (error) {
  console.error('Original error:', error);
  showToast('処理中にエラーが発生しました。再度お試しください。');
}
```

## 入力検証

### Zodスキーマ

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上必要です'),
  age: z.number().min(0).max(150).optional(),
});

type User = z.infer<typeof UserSchema>;

function createUser(input: unknown): User {
  return UserSchema.parse(input);
}
```

## コメント

### 良いコメント

```typescript
// ✅ なぜそうするのかを説明
// レースコンディションを防ぐため、ロックを取得してから更新
const lock = await acquireLock(resourceId);
try {
  await updateResource(resourceId, data);
} finally {
  await releaseLock(lock);
}
```

### 悪いコメント

```typescript
// ❌ コードを翻訳しただけ
// iをインクリメント
i++;

// ❌ 明らかなことを説明
// ユーザーを取得
const user = getUser();
```

## チェックリスト

コード品質確認:

- [ ] 変数名・関数名が意図を表現している
- [ ] 関数が50行以内
- [ ] ファイルが800行以内
- [ ] ネストが4レベル以内
- [ ] 適切なエラーハンドリング
- [ ] console.log/debugが残っていない
- [ ] マジックナンバーがない
- [ ] イミュータブルなデータ操作
- [ ] 不要なコメントがない
