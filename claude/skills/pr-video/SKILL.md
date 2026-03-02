---
name: pr-video
description: Playwright / iOS Simulator でデモ録画し、Remotion + TTS ナレーションでプロモーション動画を自動生成するパイプラインを構築・運用する。Web・iOS 両対応。Hook→Problem→Demo→CTA の4シーン構成。「PR動画を作って」「デモ動画を生成」「プロモーション動画」「iOSのデモ動画」「ナレーション付き動画」などで起動。
---

# PR動画自動生成スキル

## 概要

Web アプリ（Playwright）または iOS アプリ（Simulator / Maestro）でデモ操作を録画し、Remotion でブランド動画に合成するパイプラインを構築・運用する。AI ナレーション（TTS MCP Server）によるボイスオーバーにも対応。

**動画構成（4シーン）:**

| シーン | 秒数 | 内容 |
|----|------|------|
| Hook | 0-2s | ロゴ + キャッチコピー（Spring アニメーション） |
| Problem | 2-4s | 課題提示（フェードアップ） |
| Demo | 4-12s | Playwright 録画の再生 |
| CTA | 12-15s | 行動喚起 + URL |

## 前提条件

- Node.js 18+
- Playwright（`@playwright/test`）
- Remotion（`remotion`, `@remotion/cli`, `@remotion/bundler`, `@remotion/renderer`）
- ffmpeg（Remotion レンダリング用）

```bash
# 未インストールの場合
npm install -D @playwright/test
npm install remotion @remotion/cli @remotion/bundler @remotion/renderer
npx playwright install chromium
# Linux の場合は --with-deps でシステム依存も追加
# npx playwright install --with-deps chromium
```

**プラットフォーム注意:**
- ffmpeg: macOS は `brew install ffmpeg`、Ubuntu は `apt install ffmpeg`
- CI 環境（Ubuntu）では Playwright に `--with-deps` が必要

## ディレクトリ構成

```
project/
├── tests/e2e/demo/           # デモスクリプト
│   └── [feature].demo.ts
├── remotion/
│   ├── components/           # 再利用コンポーネント
│   │   ├── HookScene.tsx
│   │   ├── ProblemScene.tsx
│   │   ├── DemoScene.tsx
│   │   └── CtaScene.tsx
│   ├── compositions/         # 動画ごとのコンポジション
│   │   └── [Feature].tsx
│   ├── styles/
│   │   └── theme.ts          # テーマ・Spring設定
│   └── render-all.ts         # バッチレンダリング
├── public/remotion/videos/   # Playwright 録画出力先
├── out/                      # レンダリング済み MP4
├── playwright.demo.config.ts # デモ専用設定
└── .github/workflows/
    └── pr-video.yml          # 自動投稿（任意）
```

## コアワークフロー

### ステップ1: 動画スクリプト設計

録画前に台本を設計する。以下のテンプレートを埋める：

```markdown
## [機能名] デモ台本

### Hook（2秒）
- テキスト: "○○を、もっと速く。"

### Problem（2秒）
- テキスト: "従来の○○は△△が必要でした"

### Demo（8秒）
- 操作フロー:
  1. ページ遷移 → フォーム入力
  2. AI処理（ローディング表示）
  3. 結果表示
- ハイライト: [注目させたい操作]

### CTA（3秒）
- テキスト: "今すぐ試す →"
- URL: https://example.com
```

### ステップ2: 録画方式の選択

| 対象 | 録画方式 | 設定ガイド |
|------|---------|-----------|
| Web アプリ | Playwright | 本スキル ステップ2a |
| iOS アプリ（ネイティブ） | xcrun simctl + XCUITest or Maestro | [references/ios-recording.md](references/ios-recording.md) |
| iOS アプリ（React Native） | Detox | [references/ios-recording.md](references/ios-recording.md) |

iOS の場合は reference を参照して録画し、ステップ5 へ進む（録画ファイルを `DemoScene` に渡す流れは共通）。

### ステップ2a: Playwright デモ設定の作成（Web）

E2E テストとは別にデモ専用設定を作成する：

```typescript
// playwright.demo.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/demo',
  workers: 1, // 順次実行（録画の安定性のため）
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1920, height: 1080 },
    video: {
      mode: 'on',
      size: { width: 1920, height: 1080 },
    },
    // 認証済みセッション（必要な場合）
    // storageState: 'tests/e2e/.auth/user.json',
  },
  outputDir: './test-results/demo',
});
```

**ポイント:**
- `workers: 1` で順次実行し録画を安定させる
- `1920x1080` で Full HD 録画
- `video.mode: 'on'` で自動録画

### ステップ3: デモスクリプト作成

テストではなくデモスクリプト（操作の脚本）として書く：

```typescript
// tests/e2e/demo/[feature].demo.ts
import { test, expect } from '@playwright/test';

test('[機能名] デモ', async ({ page }) => {
  // --- Next.js エラーオーバーレイを非表示 ---
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  });

  // --- API モック（一貫した結果のため） ---
  await page.route('**/api/predict', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    await new Promise((r) => setTimeout(r, 700)); // 処理感を演出
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        result: `${body.input} の予測結果`,
      }),
    });
  });

  // --- デモ操作 ---
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // 自然なタイピング（1文字ずつ）
  const input = page.getByRole('textbox', { name: '検索' });
  await input.click();
  await input.pressSequentially('月次レポート', { delay: 100 });

  // カーソル移動で注目を誘導
  const button = page.getByRole('button', { name: '生成' });
  await button.hover();
  await page.waitForTimeout(300);
  await button.click();

  // 結果を待つ
  await expect(page.getByText('予測結果')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(1500); // 結果を見せる間

  // --- 録画を保存 ---
  await page.video()?.saveAs('public/remotion/videos/[feature].webm');
});
```

**重要テクニック:**
- `pressSequentially()`: 1文字ずつタイピングで自然な操作感
- `mouse.move()` / `hover()`: カーソルで視線を誘導
- `page.route()`: API モックで一貫した結果
- `addStyleTag()`: 開発用オーバーレイを非表示
- `waitForTimeout()`: 結果を見せる「間」を作る

### ステップ4: デモ録画実行

```bash
npx playwright test --config=playwright.demo.config.ts
```

録画は `public/remotion/videos/[feature].webm` に保存される。

### ステップ5: Remotion コンポーネント作成

6つの再利用コンポーネントとテーマファイルを作成する。テンプレートは [references/remotion-components.md](references/remotion-components.md) を参照。

**テーマ設定（`remotion/styles/theme.ts`）:** `VIDEO_CONFIG`(1920x1080, 30fps, 450フレーム) / `GRADIENTS`(4種) / `SPRINGS`(4種)

**シーンコンポーネント:**

| コンポーネント | Props | Spring | 用途 |
|---------------|-------|--------|------|
| `HookScene` | `title`, `gradient?` | bouncy + smooth | ロゴ・キャッチコピー |
| `ProblemScene` | `text` | gentle + smooth | 課題提示（フェードアップ） |
| `DemoScene` | `videoSrc`, `playbackRate?` | smooth | Web/iOS 録画再生 |
| `CtaScene` | `text`, `url`, `gradient?` | snappy + smooth | 行動喚起 |
| `NarrationScene` | `text`, `audioSrc?`, `background?` | smooth | TTS ナレーション付きテキスト |
| `DeviceFrame` | `videoSrc`, `playbackRate?`, `device?` | smooth | iPhone/iPad フレーム内表示 |

`NarrationScene` / `DeviceFrame` は [references/tts-narration.md](references/tts-narration.md) / [references/ios-recording.md](references/ios-recording.md) を参照。

### ステップ5a: TTS ナレーション追加（任意）

AI ナレーションを追加する場合。詳細は [references/tts-narration.md](references/tts-narration.md) を参照。

| 方式 | 特徴 | 推奨用途 |
|------|------|---------|
| Qwen3-TTS (MLX) | ローカル実行、無料、Apple Silicon 必須 | プロトタイプ、英語 |
| Google Cloud / Gemini TTS | 高品質日本語 | 本番動画 |

**デュアルエージェント戦略（推奨）:**
1. **音声生成エージェント**: TTS MCP Server でシーンごとの `.wav` を生成
2. **動画編集エージェント**: Remotion で音声付き動画を合成
3. 並列実行で効率化

追加コンポーネント: `NarrationScene`（テンプレートは reference 参照）

### ステップ6: コンポジション組み立て

`Sequence` でシーンを配置する：

```tsx
// remotion/compositions/Feature.tsx
import { Composition, Sequence } from 'remotion';
import { VIDEO_CONFIG } from '../styles/theme';
import { HookScene } from '../components/HookScene';
import { ProblemScene } from '../components/ProblemScene';
import { DemoScene } from '../components/DemoScene';
import { CtaScene } from '../components/CtaScene';

const SCENE_FRAMES = {
  hook: { from: 0, duration: 60 },      // 0-2s
  problem: { from: 60, duration: 60 },   // 2-4s
  demo: { from: 120, duration: 240 },    // 4-12s
  cta: { from: 360, duration: 90 },      // 12-15s
} as const;

export const FeatureVideo: React.FC = () => (
  <>
    <Sequence {...SCENE_FRAMES.hook}>
      <HookScene title="レポート作成を、もっと速く。" />
    </Sequence>
    <Sequence {...SCENE_FRAMES.problem}>
      <ProblemScene text="従来は手作業で3時間かかっていました" />
    </Sequence>
    <Sequence {...SCENE_FRAMES.demo}>
      <DemoScene
        videoSrc="http://localhost:3000/remotion/videos/feature.webm"
        playbackRate={1.2}
      />
    </Sequence>
    <Sequence {...SCENE_FRAMES.cta}>
      <CtaScene text="今すぐ試す →" url="https://example.com" />
    </Sequence>
  </>
);

// Root に登録
export const RemotionRoot: React.FC = () => (
  <Composition
    id="Feature"
    component={FeatureVideo}
    {...VIDEO_CONFIG}
  />
);
```

**セグメント別再生速度の例:**

```tsx
// 操作部分は等速、処理待ちは3倍速
<Sequence from={120} durationInFrames={90}>
  <DemoScene videoSrc={src} playbackRate={0.8} /> {/* 入力シーン: ゆっくり */}
</Sequence>
<Sequence from={210} durationInFrames={50}>
  <DemoScene videoSrc={src} playbackRate={3} /> {/* 処理シーン: 早送り */}
</Sequence>
<Sequence from={260} durationInFrames={100}>
  <DemoScene videoSrc={src} playbackRate={1} /> {/* 結果シーン: 等速 */}
</Sequence>
```

### ステップ7: プレビューと調整

```bash
npx remotion studio
```

ブラウザでプレビューしながら以下を調整：
- シーンの切り替えタイミング
- `playbackRate` の値
- テキスト内容とフォントサイズ
- Spring アニメーションのパラメータ

### ステップ8: バッチレンダリング

```typescript
// remotion/render-all.ts
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';

const COMPOSITIONS = [
  'Feature',
  // 追加の動画IDをここに列挙
] as const;

async function main() {
  const bundled = await bundle({
    entryPoint: path.resolve('./remotion/index.ts'),
  });

  const failed: string[] = [];

  for (const id of COMPOSITIONS) {
    try {
      console.log(`Rendering ${id}...`);
      const composition = await selectComposition({ serveUrl: bundled, id });
      await renderMedia({
        composition,
        serveUrl: bundled,
        codec: 'h264',
        outputLocation: `out/${id}.mp4`,
      });
      console.log(`Done: out/${id}.mp4`);
    } catch (err) {
      console.error(`Failed to render ${id}:`, err);
      failed.push(id);
    }
  }

  if (failed.length > 0) {
    console.error(`\nFailed compositions: ${failed.join(', ')}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

```bash
npx tsx remotion/render-all.ts
```

### ステップ9: GitHub Actions 自動投稿（任意）

```yaml
# .github/workflows/pr-video.yml
name: PR Video

on:
  workflow_dispatch:
    inputs:
      composition:
        description: 'レンダリングする Composition ID'
        required: true
        type: string

jobs:
  render:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Record demos
        run: npx playwright test --config=playwright.demo.config.ts

      - name: Render video
        run: npx tsx remotion/render-all.ts

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: videos
          path: out/*.mp4

      # --- X 自動投稿（任意） ---
      # - name: Post to X
      #   env:
      #     X_API_KEY: ${{ secrets.X_API_KEY }}
      #     X_API_SECRET: ${{ secrets.X_API_SECRET }}
      #     X_ACCESS_TOKEN: ${{ secrets.X_ACCESS_TOKEN }}
      #     X_ACCESS_SECRET: ${{ secrets.X_ACCESS_SECRET }}
      #   run: node scripts/post-to-x.js out/${{ inputs.composition }}.mp4
```

## アンチパターン

| やってはいけないこと | 代わりにやること |
|---------------------|-----------------|
| `fill()` で瞬間入力 | `pressSequentially()` で1文字ずつ |
| 本番 API を直接呼ぶ | `page.route()` でモック |
| `waitForTimeout` のハードコード秒数だけに依存 | `expect().toBeVisible()` と組み合わせる |
| テーマ値の散在 | `theme.ts` に集約 |
| 並列 workers で録画 | `workers: 1` で順次実行 |
| 開発用オーバーレイの放置 | `addStyleTag()` で非表示 |
| 1動画に全シーンべた書き | 4つの再利用コンポーネントに分離 |
| Simulator のステータスバーそのまま録画 | `xcrun simctl status_bar override` で時刻・電波固定 |
| TTS 音声をシーンごと短文で生成 | 長文で一括生成して話者一貫性を維持 |

## 品質チェックリスト

### デモ録画（Web / iOS 共通）

- [ ] 1920x1080（Web）または適切なデバイス解像度（iOS）で録画
- [ ] タイピングが自然（`pressSequentially` / 1文字ずつ入力）
- [ ] API モックで結果が一貫している
- [ ] 開発用オーバーレイが非表示
- [ ] 操作の間に適切な「間」がある
- [ ] iOS: ステータスバーが `simctl status_bar override` で固定

### 動画合成

- [ ] Hook→Problem→Demo→CTA の4幕構成
- [ ] テーマ値が `theme.ts` に集約されている
- [ ] Spring アニメーションが滑らか
- [ ] 再生速度が操作内容に合っている

### レンダリング

- [ ] H.264 コーデックで出力
- [ ] 15秒以内に収まっている（SNS 最適）
- [ ] 音声なしで内容が伝わる（TTS ナレーションは補助的に）
- [ ] TTS 使用時: 音声長とシーンフレーム数が一致

### デプロイ（任意）

- [ ] GitHub Actions が正常に動作する
- [ ] シークレット（API キー）が安全に管理されている

## 出力ファイル

| ファイル | 説明 |
|---------|------|
| `playwright.demo.config.ts` | デモ専用 Playwright 設定 |
| `tests/e2e/demo/[feature].demo.ts` | デモスクリプト（Web） |
| `remotion/styles/theme.ts` | テーマ・Spring 設定 |
| `remotion/components/*.tsx` | 再利用コンポーネント（6種） |
| `remotion/compositions/[Feature].tsx` | コンポジション |
| `remotion/render-all.ts` | バッチレンダリングスクリプト |
| `public/remotion/videos/*.webm` | Playwright 録画（Web） |
| `public/remotion/videos/*.mp4` | iOS Simulator 録画 |
| `public/remotion/audio/*.wav` | TTS ナレーション音声 |
| `out/*.mp4` | レンダリング済み動画 |
| `.github/workflows/pr-video.yml` | CI/CD（任意） |

## Tips

- **再生速度**: 入力シーンは `0.8x`、処理待ちは `2-3x`、結果表示は `1x` が目安
- **新動画追加フロー**: デモスクリプト作成 → コンポジション作成 → `COMPOSITIONS` 配列に追加 → レンダリング
- **SNS 最適化**: 15秒以内、音声なしで内容が伝わる構成にする
- **Spring 選択**: UI操作は `snappy`、テキスト表示は `smooth`、ロゴは `bouncy`
- **iOS 録画**: `DeviceFrame` でデバイスフレーム付き表示、縦長は `IOS_VIDEO_CONFIG` を使用
- **TTS ナレーション**: デュアルエージェント戦略（音声生成 + 動画編集を並列）で効率化

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| Playwright 録画が空 | `video.mode` 未設定 | `playwright.demo.config.ts` で `video: { mode: 'on' }` を確認 |
| 録画が途中で切れる | テスト早期終了 | `waitForTimeout()` で結果表示の間を追加 |
| Remotion レンダリング失敗 | ffmpeg 未インストール | `ffmpeg -version` で確認、なければインストール |
| CI で Playwright 起動失敗 | ブラウザ依存不足 | `npx playwright install --with-deps chromium` を使用 |
| 動画にエラーオーバーレイ表示 | Next.js dev overlay | `addStyleTag()` で非表示にする |
| iOS Simulator 録画が開始しない | Simulator 未起動 | `xcrun simctl boot "iPhone 16 Pro"` で起動 |
| TTS 音声が中国語風に聞こえる | Qwen3-TTS の日本語課題 | Google Cloud TTS / Gemini TTS に切り替え |

## 関連スキル

- **qa-testing**: Chrome DevTools MCP を使った QA 検証
- **developing**: TDD ワークフローでの機能実装
- **plan-first**: 大規模パイプラインの計画策定
