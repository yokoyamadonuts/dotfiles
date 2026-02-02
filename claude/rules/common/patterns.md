---
paths: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]
description: 推奨デザインパターン。
---

# デザインパターン

## API レスポンス形式

### 標準形式

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

// 使用例
async function getUsers(): Promise<ApiResponse<User[]>> {
  try {
    const users = await db.users.findMany();
    return {
      success: true,
      data: users,
      pagination: {
        page: 1,
        pageSize: 20,
        total: 100,
        hasMore: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: 'ユーザーの取得に失敗しました',
      },
    };
  }
}
```

## カスタムフックパターン

### デバウンス

```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// 使用例
function SearchInput() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery) {
      searchApi(debouncedQuery);
    }
  }, [debouncedQuery]);

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

### データフェッチ

```typescript
interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

function useFetch<T>(url: string): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Fetch failed');
      const json = await response.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
```

## リポジトリパターン

### 汎用インターフェース

```typescript
interface Repository<T, ID = string> {
  findAll(): Promise<T[]>;
  findById(id: ID): Promise<T | null>;
  create(data: Omit<T, 'id'>): Promise<T>;
  update(id: ID, data: Partial<T>): Promise<T>;
  delete(id: ID): Promise<void>;
}

// 実装例
class UserRepository implements Repository<User> {
  constructor(private db: Database) {}

  async findAll(): Promise<User[]> {
    return this.db.users.findMany();
  }

  async findById(id: string): Promise<User | null> {
    return this.db.users.findUnique({ where: { id } });
  }

  async create(data: Omit<User, 'id'>): Promise<User> {
    return this.db.users.create({ data });
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    return this.db.users.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.db.users.delete({ where: { id } });
  }
}
```

## サービスレイヤーパターン

```typescript
class UserService {
  constructor(
    private userRepository: Repository<User>,
    private emailService: EmailService,
  ) {}

  async createUser(data: CreateUserDTO): Promise<User> {
    // バリデーション
    const validated = UserSchema.parse(data);

    // 重複チェック
    const existing = await this.userRepository.findByEmail(validated.email);
    if (existing) {
      throw new ConflictError('Email already exists');
    }

    // ユーザー作成
    const user = await this.userRepository.create(validated);

    // ウェルカムメール送信
    await this.emailService.sendWelcome(user.email);

    return user;
  }
}
```

## コンポーネント合成パターン

```typescript
interface LayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  footer?: React.ReactNode;
}

function Layout({ children, header, sidebar, footer }: LayoutProps) {
  return (
    <div className="layout">
      {header && <header className="layout-header">{header}</header>}
      <div className="layout-body">
        {sidebar && <aside className="layout-sidebar">{sidebar}</aside>}
        <main className="layout-main">{children}</main>
      </div>
      {footer && <footer className="layout-footer">{footer}</footer>}
    </div>
  );
}

// 使用例
function Dashboard() {
  return (
    <Layout
      header={<Navigation />}
      sidebar={<Sidebar />}
      footer={<Footer />}
    >
      <DashboardContent />
    </Layout>
  );
}
```

## スケルトンプロジェクト戦略

新機能を構築する際:

1. **テンプレートを探す**
   - 実績のあるスターターテンプレートを検索

2. **評価**
   - セキュリティ
   - 拡張性
   - プロジェクトとの適合性

3. **適応**
   - 最適なテンプレートをベースに
   - プロジェクト要件に合わせてカスタマイズ
