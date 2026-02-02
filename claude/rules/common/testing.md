---
paths: ["**/*.test.*", "**/*_test.*", "**/*.spec.*", "**/tests/**"]
description: テストに関する必須ルール。TDD/80%カバレッジ必須。
---

# テストルール

## 必須要件

### 最低カバレッジ: 80%

```bash
# カバレッジ確認
npm test -- --coverage
go test -coverprofile=coverage.out ./...
cargo tarpaulin
```

### 100%カバレッジ必須の領域

- 金融計算
- 認証・認可
- セキュリティ関連
- コアビジネスロジック

## TDD必須

### RED → GREEN → REFACTOR

1. **RED**: 失敗するテストを先に書く
2. **GREEN**: テストを通す最小限の実装
3. **REFACTOR**: コード改善（テストは維持）

```typescript
// Step 1: RED - 失敗するテスト
describe('calculateTotal', () => {
  it('should return 0 for empty cart', () => {
    expect(calculateTotal([])).toBe(0); // 実装前なので失敗
  });
});

// Step 2: GREEN - 最小限の実装
function calculateTotal(items: Item[]): number {
  return 0; // テストを通す最小限
}

// Step 3: REFACTOR - 改善
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

## テスト構造

### AAA パターン

```typescript
it('should add item to cart', () => {
  // Arrange - 準備
  const cart = new Cart();
  const item = { id: '1', name: 'Product', price: 100 };

  // Act - 実行
  cart.addItem(item);

  // Assert - 検証
  expect(cart.items).toHaveLength(1);
  expect(cart.items[0]).toEqual(item);
});
```

### テスト名規則

```typescript
// 形式: should [期待する動作] when [条件]
it('should return error when email is invalid');
it('should redirect to dashboard when login succeeds');
it('should throw when quantity is negative');
```

## 必須テストカテゴリ

### 1. ユニットテスト

```typescript
// 単一関数の動作確認
describe('validateEmail', () => {
  it('should return true for valid email');
  it('should return false for invalid email');
  it('should handle edge cases');
});
```

### 2. 統合テスト

```typescript
// API + DB の連携確認
describe('POST /api/users', () => {
  it('should create user and persist to database');
  it('should return 400 for invalid input');
});
```

### 3. E2Eテスト（重要フローのみ）

```typescript
// クリティカルユーザージャーニー
test('user can complete checkout', async ({ page }) => {
  await page.goto('/products');
  await page.click('[data-testid="add-to-cart"]');
  await page.click('[data-testid="checkout"]');
  await expect(page.locator('[data-testid="success"]')).toBeVisible();
});
```

## エッジケース必須

各関数で以下をテスト:

- [ ] null/undefined
- [ ] 空の配列/オブジェクト
- [ ] 境界値（0, 最大値, 最小値）
- [ ] 不正な型
- [ ] エラー条件
- [ ] 大量データ

## モック戦略

### 外部依存はモック

```typescript
// 外部サービスをモック
jest.mock('../services/payment', () => ({
  processPayment: jest.fn().mockResolvedValue({ success: true }),
}));

// テストごとにリセット
beforeEach(() => {
  jest.clearAllMocks();
});
```

## テスト失敗時の対応

1. **テストの修正ではなく実装を修正**
2. テスト自体にバグがある場合のみテストを修正
3. 失敗原因を必ず特定してから修正

## 禁止事項

### やってはいけないこと

```typescript
// ❌ 実装の詳細をテスト
expect(component.state.isLoading).toBe(true);

// ✅ ユーザーが見える振る舞いをテスト
expect(screen.getByText('Loading...')).toBeVisible();
```

```typescript
// ❌ テスト間の依存
it('creates user', () => { /* user作成 */ });
it('updates user', () => { /* 前のテストのuserを使用 */ });

// ✅ 各テストが独立
it('updates user', () => {
  const user = createTestUser(); // 自分で準備
  // ...
});
```

## エージェント連携

- **tdd-guide**: TDDワークフローのガイド
- **e2e-runner**: Playwright E2Eテストの作成・実行
