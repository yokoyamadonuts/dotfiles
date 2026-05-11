---
name: writing-tests
description: TDD方法論に従ってテストを作成します。テストファイルの配置（コロケーション）、命名規則、テスト構造のベストプラクティスに従います。React/TypeScript、Go、Rustで適切なパターンを使い分けます。「テストを書いて」「テストを作成」「単体テストを追加」などのリクエストで起動します。
---

# テスト作成

TDD方法論に従ってテストを作成する。

> **親スキル**: `developing`
> 本スキルは`developing`スキルのサブスキルとして、テスト作成に特化した詳細ガイドラインを提供する。
> TDDワークフロー全体（RED→GREEN→REFACTOR）については`developing`スキルを参照。

## ワークフロー

### ステップ1: テスト対象の確認

テスト対象のコードを読み込み、以下を把握する：
- 対象の機能/メソッドの責務
- 入力と出力の型
- エッジケースと境界条件
- 依存関係（モックが必要か）

### ステップ2: 言語/フレームワークの特定

プロジェクトの言語を特定し、対応するリファレンスを参照する：

| 言語/フレームワーク | リファレンス |
|-------------------|-------------|
| React + TypeScript | [references/react-typescript.md](references/react-typescript.md) |
| Go | [references/go.md](references/go.md) |
| Rust | [references/rust.md](references/rust.md) |

### ステップ3: テストファイルの配置

**共通原則: コロケーション** - テストは実装の近くに配置する。

#### React + TypeScript
```
src/features/auth/
├── LoginForm.tsx
├── LoginForm.test.tsx    # コンポーネントと同じディレクトリ
├── useAuth.ts
└── useAuth.test.ts
```

#### Go
```
pkg/auth/
├── handler.go
├── handler_test.go       # 同ディレクトリに _test.go
├── service.go
└── service_test.go
```

#### Rust
```
src/
├── lib.rs                # 単体テストは #[cfg(test)] mod tests {} でモジュール内
└── user.rs
tests/                    # 統合テストは tests/ ディレクトリ
└── user_integration.rs
```

詳細は各言語のリファレンスを参照。

### ステップ4: テスト命名

テスト名には3要素を含める：
1. **何を**（対象の機能/メソッド）
2. **どういう条件で**（入力/状態）
3. **どうなるか**（期待する結果）

| 言語 | パターン | 例 |
|------|---------|---|
| React/TS | `describe` + `it` | `it('returns zero when cart is empty')` |
| Go | `Test関数_should結果_when条件` | `TestCalculateTotal_shouldReturnZero_whenCartIsEmpty` |
| Rust | `関数_returns結果_when条件` | `calculate_total_returns_zero_when_cart_is_empty` |

### ステップ5: テスト構造

**AAA (Arrange-Act-Assert) パターン**を基本とする。

#### React + TypeScript
```typescript
it('displays user name when data is loaded', async () => {
  // Arrange
  const mockUser = { name: 'John' }
  server.use(rest.get('/api/user', (req, res, ctx) => res(ctx.json(mockUser))))

  // Act
  render(<UserProfile />)

  // Assert
  expect(await screen.findByText('John')).toBeInTheDocument()
})
```

#### Go
```go
func TestUserRepository_FindByID_shouldReturnUser_whenExists(t *testing.T) {
    // Arrange
    db := setupTestDB(t)
    repo := NewUserRepository(db)
    expected := &User{ID: "1", Name: "John"}
    repo.Create(expected)

    // Act
    actual, err := repo.FindByID("1")

    // Assert
    require.NoError(t, err)
    assert.Equal(t, expected.Name, actual.Name)
}
```

#### Rust
```rust
#[test]
fn user_repository_find_by_id_returns_user_when_exists() {
    // Arrange
    let db = setup_test_db();
    let repo = UserRepository::new(&db);
    let expected = User::new("1", "John");
    repo.create(&expected).unwrap();

    // Act
    let actual = repo.find_by_id("1").unwrap();

    // Assert
    assert_eq!(expected.name, actual.name);
}
```

詳細は各言語のリファレンスを参照。

### ステップ6: テストの種類と優先度

**テスティングトロフィー**（優先順位）：

1. **単体テスト**（基盤）: 高速、集中、多数
2. **統合テスト**（中間）: コンポーネント間の相互作用
3. **E2Eテスト**（頂点）: 最小限だが重要なユーザーフロー

### ステップ7: モック

依存性注入を活用してテスト可能にする。詳細は各言語のリファレンスを参照。

## 必須テストケース

- **正常系**: 期待通りの入力で期待通りの出力
- **エッジケース**: 境界値、空の入力、最大値/最小値
- **エラー系**: 不正な入力、例外処理

## テスト観点フレームワーク（QA 6技法）

> **AI駆動開発において、テストコードそのものより「観点整理」の方が重要。**
> 観点が曖昧なまま AI にテストを書かせると、正常系に偏った浅いテストになる。
> JSTQB FL（ソフトウェアテスト技術者資格）の体系に基づく以下の6技法を、
> **テスト着手前に明示的に列挙する**こと。

### 1. 同値分割（Equivalence Partitioning）

入力値を「同じ動作をする集合」にグループ化し、各集合から代表値を選ぶ。

**例**: 予約人数（1〜4名は有効、0以下・5以上は無効）
```
| 同値クラス       | 範囲       | 代表値 | 期待動作      |
|----------------|-----------|--------|-------------|
| 無効（小さすぎ） | n <= 0    | 0      | エラー       |
| 有効             | 1 <= n <=4 | 2      | 正常受付     |
| 無効（大きすぎ） | n >= 5    | 5      | エラー       |
```

### 2. 境界値分析（Boundary Value Analysis）

境界の前後（off-by-one）を重点的にテストする。**AIが `>=` と `>` を間違えやすい盲点**。

**例**: 予約人数 1〜4 名なら、テストすべきは `0, 1, 4, 5`。

```typescript
test.each([
  [0, 'エラー'],   // 下限の外
  [1, '受付'],     // 下限
  [4, '受付'],     // 上限
  [5, 'エラー'],   // 上限の外
])('予約人数 %i は %s となる', (n, expected) => { ... })
```

### 3. デシジョンテーブル（Decision Table）

複数条件の組み合わせを表で網羅する。**先に表を作らせてからコード生成させる**（→ 二段階依頼）。

**例**: 割引適用ロジック
```
| 会員? | 購入額>5000 | クーポン? | 割引率 |
|------|------------|----------|--------|
| Y    | Y          | Y        | 30%    |
| Y    | Y          | N        | 20%    |
| Y    | N          | Y        | 15%    |
| Y    | N          | N        | 10%    |
| N    | Y          | Y        | 15%    |
| N    | Y          | N        |  5%    |
| N    | N          | Y        | 10%    |
| N    | N          | N        |  0%    |
```

各行が1テストケースになる。

### 4. 状態遷移テスト（State Transition Testing）

業務システムの状態（下書き→申請→承認→公開等）の遷移ルールと、**不正な遷移ができないこと**を検証。

```
正常遷移: draft → submitted → approved → published
不正遷移: draft → published（直接公開不可）
        approved → submitted（巻き戻し不可）
```

各遷移をテストし、「遷移先にいない時の操作」も明示的にテストする。

### 5. エラー推測（Error Guessing）

過去の障害パターンを事前に洗い出す。AI には**経験ベースの欠陥パターンを明示的に渡す**。

**典型的なエラーパターン**:
- 二重送信 / 二重クリック
- タイムゾーン / DST 境界
- ネットワーク失敗時の中途半端な状態（部分書き込み）
- 並行アクセス（同一リソースへの同時更新）
- nil / undefined / 空配列 / 空文字列
- Unicode（絵文字、サロゲートペア、結合文字）
- 数値オーバーフロー / 浮動小数点誤差
- ファイル/接続のリークと枯渇

### 6. チェックリスト化（Checklist）

機能カテゴリ別に再利用可能なチェックリストを用意。

**フォーム送信機能の例**:
- [ ] 正常系: 全項目正しい入力 → 成功
- [ ] バリデーション: 必須項目欠落、形式不正、最大長超過
- [ ] API失敗時: 4xx/5xx でエラー表示、リトライ可能
- [ ] 二重送信防止: 連打で1回しか送信されない
- [ ] 競合: 別タブで同データを更新中の保存
- [ ] 中断: 送信中にページ遷移した場合

## AI へのテスト依頼パターン（二段階依頼）

### ❌ 弱い依頼（避ける）
```
「この機能のテストを書いてください」
```
→ 正常系に偏った浅いテストになる。

### ✅ 強い依頼（最低限）
```
「同値分割・境界値分析・デシジョンテーブル・状態遷移・エラー推測を
 含めてテストを書いてください」
```
→ 観点が明示されるが、それでも漏れが出る。

### 🏆 最適形（二段階依頼）

**Step 1: 観点整理フェーズ（コード生成しない）**
```
[機能仕様] に対し、テスト観点を整理してください。
コードはまだ書かないでください。以下を出力:

1. 入力パラメータの同値クラス表
2. 各パラメータの境界値リスト
3. 条件組み合わせのデシジョンテーブル
4. 状態遷移図（該当する場合）
5. 想定されるエラーパターン（エラー推測）
6. 機能カテゴリ別チェックリスト
```

**Step 2: コード生成フェーズ（観点表を入力に）**
```
上記の観点表に基づき、テストコードを生成してください。
各テストケースの先頭コメントに、対応する観点表の行番号を記載してください。
```

この二段階により、観点と実装の**双方向トレーサビリティ**が得られ、レビューと保守が容易になる。

## セルフレビュー

テスト作成後、以下のチェックリストで確認する。
**問題がある場合は修正し、すべての項目がクリアされるまで繰り返す。**

- [ ] テスト名が3要素（何を、条件、結果）を含んでいる
- [ ] AAA/Given-When-Thenパターンに従っている
- [ ] 正常系・エッジケース・エラー系をカバー
- [ ] **6技法の観点整理を実施した**（同値分割/境界値/デシジョンテーブル/状態遷移/エラー推測/チェックリスト）
- [ ] **境界値テスト**を境界の両側（off-by-one）でカバー
- [ ] **デシジョンテーブル**を網羅（条件組み合わせの漏れなし）
- [ ] テストが独立していて他のテストに依存しない
- [ ] モックが適切に使用されている
- [ ] テストが高速に実行できる
