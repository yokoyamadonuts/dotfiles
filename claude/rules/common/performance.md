---
paths: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.go", "**/*.rs"]
description: パフォーマンスに関するガイドライン。
---

# パフォーマンスルール

## モデル選択（Claude Code）

| モデル | ユースケース | 備考 |
|--------|-------------|------|
| Haiku 4.5 | 軽量エージェント、ペアプログラミング | Sonnetの90%の能力、3倍のコスト削減 |
| Sonnet 4.5 | 主要開発、マルチエージェント | デフォルト選択 |
| Opus 4.5 | 複雑なアーキテクチャ作業 | 最も深い推論が必要な場合 |

## コンテキスト効率

- コンテキストウィンドウの最後1/5は単純な操作用に確保
- 大規模リファクタリングはコンテキストを消費するため計画的に

## コード最適化

### アルゴリズム効率

```typescript
// ❌ O(n²) - 大規模データで問題
function findDuplicates(arr: number[]): number[] {
  return arr.filter((item, index) => arr.indexOf(item) !== index);
}

// ✅ O(n) - 効率的
function findDuplicates(arr: number[]): number[] {
  const seen = new Set<number>();
  const duplicates = new Set<number>();

  for (const item of arr) {
    if (seen.has(item)) {
      duplicates.add(item);
    }
    seen.add(item);
  }

  return Array.from(duplicates);
}
```

### メモリ効率

```typescript
// ❌ メモリを大量消費
function processLargeData(data: LargeData[]): Result[] {
  const copy = [...data]; // 全データをコピー
  return copy.map(item => transform(item));
}

// ✅ ストリーム処理
async function* processLargeData(data: AsyncIterable<LargeData>): AsyncGenerator<Result> {
  for await (const item of data) {
    yield transform(item);
  }
}
```

### N+1問題の回避

```typescript
// ❌ N+1クエリ
async function getPostsWithAuthors(postIds: string[]) {
  const posts = await db.posts.findMany({ where: { id: { in: postIds } } });

  // N回のクエリ
  for (const post of posts) {
    post.author = await db.users.findUnique({ where: { id: post.authorId } });
  }

  return posts;
}

// ✅ 1回のクエリ
async function getPostsWithAuthors(postIds: string[]) {
  return db.posts.findMany({
    where: { id: { in: postIds } },
    include: { author: true }, // JOINで取得
  });
}
```

### React パフォーマンス

```typescript
// ❌ 毎回新しいオブジェクトを作成
function Component({ items }) {
  return (
    <List
      style={{ margin: 10 }} // 毎回新しいオブジェクト
      onSort={() => items.sort()} // 毎回新しい関数
    />
  );
}

// ✅ メモ化
function Component({ items }) {
  const style = useMemo(() => ({ margin: 10 }), []);
  const handleSort = useCallback(() => items.sort(), [items]);

  return <List style={style} onSort={handleSort} />;
}
```

### 遅延読み込み

```typescript
// ❌ すべて同時に読み込み
import { HeavyComponent } from './HeavyComponent';

// ✅ 遅延読み込み
const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <HeavyComponent />
    </Suspense>
  );
}
```

## データベース最適化

### インデックスの活用

```sql
-- 頻繁にクエリされるカラムにインデックス
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_posts_author_created ON posts(author_id, created_at);
```

### ページネーション

```typescript
// ❌ 全件取得
const allPosts = await db.posts.findMany();

// ✅ カーソルベースのページネーション
const posts = await db.posts.findMany({
  take: 20,
  skip: cursor ? 1 : 0,
  cursor: cursor ? { id: cursor } : undefined,
  orderBy: { createdAt: 'desc' },
});
```

## キャッシュ戦略

```typescript
// Redis/メモリキャッシュの活用
async function getUser(id: string): Promise<User> {
  const cached = await cache.get(`user:${id}`);
  if (cached) return cached;

  const user = await db.users.findUnique({ where: { id } });
  await cache.set(`user:${id}`, user, 'EX', 3600); // 1時間

  return user;
}
```

## ビルドエラー対応

ビルドエラーが発生した場合:
1. **build-error-resolver** エージェントを使用
2. 最小限の変更で修正
3. パフォーマンス最適化は後で

## チェックリスト

- [ ] O(n²)以上のアルゴリズムがないか
- [ ] N+1クエリがないか
- [ ] 不要な再レンダリングがないか
- [ ] 大量データのメモリ保持がないか
- [ ] 適切なキャッシュが実装されているか
