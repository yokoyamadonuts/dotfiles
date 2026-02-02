---
description: "TDD（テスト駆動開発）ワークフローを実行。RED→GREEN→REFACTORサイクルをガイドし、80%以上のカバレッジを維持。"
argument-hint: "[機能説明]"
allowed-tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "TodoWrite", "AskUserQuestion"]
---

# /tdd - テスト駆動開発コマンド

RED → GREEN → REFACTOR サイクルをガイドし、テストファーストで機能を実装します。

## 使い方

```
/tdd ユーザー認証機能を実装
/tdd calculateTotal関数のバグを修正
```

---

## [1/6] 要件の確認

### 引数の解析

```
引数: $ARGUMENTS
```

引数が空の場合:
```javascript
AskUserQuestion({
  questions: [
    {
      question: "どのような機能を実装しますか？",
      header: "機能",
      options: [
        { label: "新機能追加", description: "新しい機能を実装" },
        { label: "バグ修正", description: "既存のバグを再現テストから修正" },
        { label: "リファクタリング", description: "テストを維持しながらコード改善" }
      ],
      multiSelect: false
    }
  ]
})
```

---

## [2/6] インターフェース設計

### 型定義を先に作成

```typescript
// 例: types.ts
interface CalculationResult {
  total: number;
  tax: number;
  items: LineItem[];
}

interface Calculator {
  calculateSubtotal(items: CartItem[]): number;
  calculateTax(subtotal: number, rate?: number): number;
  calculateTotal(items: CartItem[]): CalculationResult;
}
```

### 関数シグネチャの確定

- 入力パラメータの型
- 戻り値の型
- 例外の種類

---

## [3/6] RED - 失敗するテストを書く

### テストファイルの作成

言語に応じた規約でテストファイルを作成:

| 言語 | テストファイル | 配置 |
|------|---------------|------|
| Go | `*_test.go` | 同一ディレクトリ |
| Rust | `#[cfg(test)] mod tests` または `tests/*.rs` | モジュール内または `tests/` |
| TypeScript | `*.test.ts` | 同一ディレクトリ |

### テストケースの作成

```typescript
// calculator.test.ts
describe('Calculator', () => {
  describe('calculateSubtotal', () => {
    it('should return 0 for empty cart', () => {
      const calc = new Calculator();
      expect(calc.calculateSubtotal([])).toBe(0);
    });

    it('should sum item prices', () => {
      const calc = new Calculator();
      const items = [
        { price: 100, quantity: 2 },
        { price: 50, quantity: 1 },
      ];
      expect(calc.calculateSubtotal(items)).toBe(250);
    });

    it('should throw for negative quantity', () => {
      const calc = new Calculator();
      const items = [{ price: 100, quantity: -1 }];
      expect(() => calc.calculateSubtotal(items)).toThrow();
    });
  });
});
```

### テスト実行（失敗を確認）

```bash
# TypeScript
npm test -- calculator.test.ts

# Go
go test -v ./... -run TestCalculator

# Rust
cargo test calculator
```

**重要**: テストが「正しい理由で」失敗することを確認:
- 実装がない → TypeError/コンパイルエラー
- 実装が不完全 → アサーションエラー

---

## [4/6] GREEN - 最小限の実装

### テストを通す最小限のコード

```typescript
// calculator.ts
class Calculator {
  calculateSubtotal(items: CartItem[]): number {
    if (items.some(item => item.quantity < 0)) {
      throw new Error('Quantity cannot be negative');
    }
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
}
```

### テスト実行（成功を確認）

```bash
npm test -- calculator.test.ts
# ✓ should return 0 for empty cart
# ✓ should sum item prices
# ✓ should throw for negative quantity
```

---

## [5/6] REFACTOR - コード改善

### テストが通った状態でリファクタリング

改善の観点:
- [ ] 命名の改善
- [ ] 重複の除去
- [ ] 複雑度の削減
- [ ] パフォーマンス最適化

### リファクタリング後もテスト通過を確認

```bash
npm test
# All tests passing
```

---

## [6/6] 繰り返し

### 次のテストケースへ

1. 次の機能のテストを追加（RED）
2. 実装（GREEN）
3. リファクタリング（REFACTOR）
4. カバレッジ確認

### カバレッジ確認

```bash
# TypeScript
npm test -- --coverage

# Go
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Rust
cargo tarpaulin
```

**目標カバレッジ**:
- 一般コード: 80%以上
- 金融計算: 100%
- 認証・認可: 100%
- セキュリティ: 100%

---

## エッジケースチェックリスト

各関数で以下をテスト:

- [ ] null/undefined 値
- [ ] 空の配列/オブジェクト
- [ ] 不正な型
- [ ] 境界値（最小/最大）
- [ ] エラー条件
- [ ] 非同期のタイムアウト
- [ ] 大量データ
- [ ] 特殊文字/Unicode

---

## /tdd 使用時の禁止事項

### やってはいけないこと

1. **テストなしで実装を始める**
   - 必ずテストを先に書く

2. **テストを書く前に実装を修正**
   - 失敗するテストを確認してから実装

3. **一度に大量のコードを書く**
   - 小さなステップで進める

4. **実装の詳細をテスト**
   - ユーザーが見える振る舞いをテスト

---

## 言語別ガイドリンク

詳細な言語別ガイドは以下を参照:
- Go: `.claude/rules/backend/go/testing.md`
- Rust: `.claude/rules/backend/rust/testing.md`
- TypeScript: `.claude/skills/writing-tests/references/react-typescript.md`
