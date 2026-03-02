---
name: zero-cost-infra
description: Cloudflare Workers/R2/D1、Resend、Better Auth を活用し、固定費ゼロ・従量課金ベースのフルスタック構成を設計・構築する。個人開発やMVP立ち上げ時のインフラコスト最適化に特化。「0円で運用したい」「無料枠でインフラ組みたい」「Cloudflare で構成を作って」「コストゼロのスタック」などで起動。
---

# 0円インフラ構築スキル

## 概要

従量課金 + 無料枠を最大活用し、固定費ゼロでスケール前提のインフラ構成を設計・構築する。個人開発初期のトラフィック規模なら無料枠内で収まるスタックを選定し、成長後もスムーズにスケールできる構成を実現する。

**設計原則:**
- 固定費ゼロ（サーバー常時起動なし、イベント駆動）
- 従量課金モデル（伸びてから払う）
- エッジファースト（Cloudflare 基盤）

## 前提条件

- Node.js 18+
- Cloudflare アカウント（Free プラン）
- Wrangler CLI（`npm install -D wrangler`）
- 独自ドメイン（任意だが推奨）

## 推奨スタック

### Infrastructure

| レイヤー | サービス | 無料枠 | 用途 |
|---------|---------|--------|------|
| Compute | Cloudflare Workers | 10万リクエスト/日 | API / SSR / BFF |
| Storage | Cloudflare R2 | 10GB + 100万リクエスト/月 | 画像・ファイル保存 |
| DB | Cloudflare D1 | 5GB + 500万行読取/日 | リレーショナルDB |
| DB (代替) | Turso | 9GB + 500M行読取/月 | D1 より高機能が必要な場合 |
| Queue | Cloudflare Queues | 100万メッセージ/月 | 非同期処理 |
| KV | Cloudflare KV | 10万読取/日 | セッション・キャッシュ |

### メール

| サービス | 無料枠 | 用途 |
|---------|--------|------|
| Resend | 3,000通/月 + 1ドメイン | トランザクションメール |
| Cloudflare Email Routing | 無制限受信 | メール受信・転送 |

### 認証

| サービス | 特徴 | 用途 |
|---------|------|------|
| Better Auth | OSS、Workers 対応、多プロバイダ | 認証基盤 |

## コアワークフロー

### ステップ1: 要件ヒアリング

`AskUserQuestion` で以下を確認：

1. **アプリ種別**: SaaS / ツール / メディア / EC
2. **必要な機能**: 認証 / DB / ストレージ / メール / Queue
3. **想定ユーザー数**: ~100 / ~1,000 / ~10,000
4. **フレームワーク**: Hono / Remix / Next.js / Astro

### ステップ2: プロジェクト初期化

```bash
# Cloudflare Workers プロジェクト作成
npm create cloudflare@latest my-app -- --template hono
cd my-app

# 依存関係
npm install hono better-auth @auth/core resend
npm install -D wrangler @cloudflare/workers-types
```

### ステップ3: インフラリソース作成

```toml
# wrangler.toml
name = "my-app"
main = "src/index.ts"
compatibility_date = "2025-01-01"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "my-app-db"
database_id = "" # wrangler d1 create で生成

# R2 Storage
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "my-app-storage"

# KV Namespace
[[kv_namespaces]]
binding = "KV"
id = "" # wrangler kv namespace create で生成

# Queue
[[queues.producers]]
binding = "QUEUE"
queue = "my-app-queue"

[[queues.consumers]]
queue = "my-app-queue"
max_batch_size = 10
max_retries = 3
```

```bash
# リソース作成
wrangler d1 create my-app-db
wrangler r2 bucket create my-app-storage
wrangler kv namespace create KV
wrangler queues create my-app-queue

# 検証: 作成されたリソースを確認
wrangler d1 list
wrangler r2 bucket list
```

### ステップ4: 認証セットアップ（Better Auth）

```typescript
// src/auth.ts
import { betterAuth } from 'better-auth';
import { D1Dialect } from 'kysely-d1';

export function createAuth(env: Env) {
  return betterAuth({
    database: {
      dialect: new D1Dialect({ database: env.DB }),
      type: 'sqlite',
    },
    emailAndPassword: { enabled: true },
    // OAuth プロバイダ（必要に応じて追加）
    // socialProviders: {
    //   google: { clientId: env.GOOGLE_ID, clientSecret: env.GOOGLE_SECRET },
    //   github: { clientId: env.GITHUB_ID, clientSecret: env.GITHUB_SECRET },
    // },
  });
}
```

### ステップ5: メール設定（Resend）

```typescript
// src/email.ts
import { Resend } from 'resend';

export function createMailer(env: Env) {
  const resend = new Resend(env.RESEND_API_KEY);

  return {
    async sendVerification(to: string, token: string) {
      const { error } = await resend.emails.send({
        from: 'noreply@yourdomain.com',
        to,
        subject: 'メールアドレスの確認',
        html: `<a href="https://yourdomain.com/verify?token=${encodeURIComponent(token)}">確認する</a>`,
      });
      if (error) throw new Error(`Email send failed: ${error.message}`);
    },
  };
}
```

### ステップ6: API エントリポイント

```typescript
// src/index.ts
import { Hono } from 'hono';
import { createAuth } from './auth';
import { createMailer } from './email';

type Bindings = {
  DB: D1Database;
  STORAGE: R2Bucket;
  KV: KVNamespace;
  QUEUE: Queue;
  RESEND_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// 認証ルート
app.all('/api/auth/**', async (c) => {
  try {
    const auth = createAuth(c.env);
    return await auth.handler(c.req.raw);
  } catch (e) {
    console.error('Auth error:', e);
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

// API ルート
app.get('/api/health', (c) => c.json({ status: 'ok' }));

export default app;
```

### ステップ7: デプロイ

```bash
# ローカル開発
wrangler dev

# 本番デプロイ
wrangler deploy

# シークレット設定
wrangler secret put RESEND_API_KEY
```

### ステップ8: 無料枠モニタリング

Cloudflare Dashboard → Workers & Pages → Analytics で使用量を確認。

**アラート設定（上限の80%で警告）:**
- Workers: 8万リクエスト/日（上限10万の80%）
- R2: 8GB（上限10GBの80%）
- D1: 400万行読取/日（上限500万の80%）

## アンチパターン

| やってはいけないこと | 代わりにやること |
|---------------------|-----------------|
| Workers 内で重い計算（50ms超） | Queue に投げて非同期処理 |
| R2 を CDN 代わりに直接公開 | Cloudflare CDN 経由で配信 |
| D1 に大量 INSERT を同期実行 | バッチ INSERT or Queue 経由 |
| 認証を自前実装 | Better Auth を使う |
| 固定 IP / 常時起動サーバーを前提にした設計 | イベント駆動 + エッジ実行に設計変更 |
| 無料枠を超えた後の対応を考えない | ステップ8のモニタリングを初期から設定 |

## 品質チェックリスト

- [ ] `wrangler dev` でローカル起動できる
- [ ] D1 マイグレーションが正常に動作する
- [ ] Better Auth で認証フローが動作する（サインアップ→ログイン→セッション）
- [ ] Resend でメール送信できる
- [ ] R2 にファイルアップロードできる
- [ ] `wrangler deploy` で本番デプロイできる
- [ ] Cloudflare Dashboard で使用量が確認できる
- [ ] すべてのシークレットが `wrangler secret` で管理されている

## 無料枠まとめ

詳細な各サービスの無料枠比較と超過時の料金は [references/free-tier-limits.md](references/free-tier-limits.md) を参照。

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| Workers デプロイ失敗 | `wrangler.toml` の設定不備 | `compatibility_date` と binding 名を確認 |
| D1 クエリが遅い | インデックス未作成 | `CREATE INDEX` で適切なインデックスを追加 |
| Resend 送信エラー | ドメイン未検証 | Resend Dashboard で DNS レコード（SPF/DKIM）を設定 |
| Better Auth セッション切れ | KV 未設定 | セッションストアに KV を指定 |
| R2 アクセス拒否 | CORS 未設定 | `wrangler r2 bucket cors` で CORS ルールを追加 |

## 出力ファイル

| ファイル | 説明 |
|---------|------|
| `wrangler.toml` | Cloudflare Workers 設定 |
| `src/index.ts` | API エントリポイント |
| `src/auth.ts` | Better Auth 設定 |
| `src/email.ts` | Resend メール送信 |
| `migrations/` | D1 スキーママイグレーション |

## Tips

- **D1 vs Turso**: D1 はシンプルで Cloudflare 統合が完璧。Turso は複数リージョン対応や ORM サポートが充実
- **Queue 活用**: メール送信、画像処理、ログ記録など非同期でよい処理は Queue に逃がす
- **カスタムドメイン**: Cloudflare DNS を使えば SSL 証明書も自動で無料
- **スケール戦略**: 無料枠超過時は Paid プラン（Workers $5/月~）に移行。アーキテクチャ変更不要

## 関連スキル

- **mvp-scaffolding**: プロジェクト初期構築（スタック選定→本スキルでインフラ構築）
- **developing**: TDD ワークフローでの機能実装
- **plan-first**: 大規模構成の計画策定
