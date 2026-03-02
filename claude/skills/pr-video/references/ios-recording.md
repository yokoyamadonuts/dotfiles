# iOS アプリ録画ガイド

## 目次

- [概要](#概要)
- [方式比較](#方式比較)
- [方式A: Xcode Simulator + xcrun simctl](#方式a-xcode-simulator--xcrun-simctl)
- [方式B: Maestro フレームワーク](#方式b-maestro-フレームワーク)
- [方式C: Detox (React Native)](#方式c-detox-react-native)
- [録画を Remotion に統合](#録画を-remotion-に統合)
- [iOS 固有のアンチパターン](#ios-固有のアンチパターン)

## 概要

iOS アプリのデモ録画を自動化し、Remotion パイプラインに統合する。
Playwright がブラウザを録画するのと同様に、iOS Simulator の操作を録画して `DemoScene` に渡す。

## 方式比較

| 方式 | 利点 | 欠点 | 推奨用途 |
|------|------|------|---------|
| xcrun simctl | Xcode 標準、追加依存なし | スクリプト記述が低レベル | シンプルな録画 |
| Maestro | YAML で宣言的、学習コスト低 | ネイティブビューのみ | ネイティブ iOS アプリ |
| Detox | React Native 統合 | RN 専用、セットアップ複雑 | React Native アプリ |

## 方式A: Xcode Simulator + xcrun simctl

**前提:**
- macOS + Xcode インストール済み
- iOS Simulator が利用可能

### 録画スクリプト

```bash
#!/bin/bash
# scripts/record-ios-demo.sh

DEVICE_ID="${1:-booted}"  # デバイスID or "booted"
OUTPUT="${2:-public/remotion/videos/ios-demo.mp4}"
DURATION="${3:-15}"       # 最大録画秒数

echo "Recording iOS Simulator (${DURATION}s max)..."

# バックグラウンドで録画開始
xcrun simctl io "$DEVICE_ID" recordVideo \
  --codec h264 \
  --force "$OUTPUT" &
RECORD_PID=$!

# UI 操作を実行（別スクリプトまたは Maestro）
sleep "$DURATION"

# 録画停止
kill -INT "$RECORD_PID"
wait "$RECORD_PID" 2>/dev/null

echo "Saved: $OUTPUT"
```

### XCUITest でデモ操作を自動化

```swift
// UITests/DemoTests.swift
import XCTest

final class DemoRecording: XCTestCase {
    func testFeatureDemo() {
        let app = XCUIApplication()
        app.launch()

        // 自然な操作テンポ（各操作間に間を入れる）
        let searchField = app.textFields["検索"]
        searchField.tap()

        // 1文字ずつタイピング（Playwright の pressSequentially 相当）
        for char in "月次レポート" {
            searchField.typeText(String(char))
            Thread.sleep(forTimeInterval: 0.1)
        }

        Thread.sleep(forTimeInterval: 0.3)

        app.buttons["生成"].tap()

        // 結果表示を待つ
        let result = app.staticTexts["レポート完成"]
        XCTAssertTrue(result.waitForExistence(timeout: 5))

        Thread.sleep(forTimeInterval: 1.5)  // 結果を見せる間
    }
}
```

**実行:**

```bash
# Simulator 起動 + テスト実行 + 録画を並行
xcrun simctl boot "iPhone 16 Pro"
./scripts/record-ios-demo.sh booted public/remotion/videos/ios-demo.mp4 20 &
xcodebuild test \
  -scheme MyApp \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  -only-testing:UITests/DemoRecording/testFeatureDemo
kill %1  # 録画停止
```

## 方式B: Maestro フレームワーク

**前提:**
- Maestro CLI: `curl -Ls "https://get.maestro.mobile.dev" | bash`

### デモフロー定義（YAML）

```yaml
# demos/ios/feature.yaml
appId: com.example.myapp
---
- launchApp
- tapOn: "検索"
- inputText: "月次レポート"
  delay: 100  # ms per character
- tapOn: "生成"
- waitForAnimationToEnd
- assertVisible: "レポート完成"
- scroll:
    direction: DOWN
    distance: 200
```

**録画付き実行:**

```bash
# Maestro で録画付きフロー実行
maestro record demos/ios/feature.yaml \
  --output public/remotion/videos/ios-demo.mp4

# 解像度指定（Simulator 設定に依存）
# Simulator を事前に適切なデバイスで起動しておく
xcrun simctl boot "iPhone 16 Pro"
```

## 方式C: Detox (React Native)

```bash
npm install -D detox @detox/ios
```

```typescript
// e2e/demo/feature.demo.ts
import { device, element, by, expect } from 'detox';

describe('Feature Demo', () => {
  beforeAll(async () => {
    await device.launchApp();
    // Detox は artifacts で自動録画可能
  });

  it('records feature demo', async () => {
    await element(by.id('search-input')).tap();
    await element(by.id('search-input')).typeText('月次レポート');
    await element(by.text('生成')).tap();

    await waitFor(element(by.text('レポート完成')))
      .toBeVisible()
      .withTimeout(5000);

    // 結果を見せる
    await new Promise(r => setTimeout(r, 1500));
  });
});
```

**録画付き実行:**

```bash
# artifacts で録画を自動保存
detox test --configuration ios.sim.release \
  --artifacts-location public/remotion/videos/ \
  --record-videos all
```

## 録画を Remotion に統合

iOS 録画は MP4 形式で出力されるため、`DemoScene` にそのまま渡せる：

```tsx
// Playwright WebM と同じ DemoScene を使用
<Sequence from={120} durationInFrames={240}>
  <DemoScene
    videoSrc="http://localhost:3000/remotion/videos/ios-demo.mp4"
    playbackRate={1.2}
  />
</Sequence>
```

**iOS 用 VIDEO_CONFIG（縦長動画の場合）:**

```typescript
// remotion/styles/theme.ts に追加
export const IOS_VIDEO_CONFIG = {
  width: 1080,   // 9:16 縦長
  height: 1920,
  fps: 30,
  durationInFrames: 450,
} as const;

// または Simulator の枠付きで横長に収める
export const IOS_LANDSCAPE_CONFIG = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 450,
} as const;
```

### DeviceFrame コンポーネント

iOS 録画を iPhone フレーム内に表示する：

```tsx
// remotion/components/DeviceFrame.tsx
import { AbsoluteFill, OffthreadVideo, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { SPRINGS } from '../styles/theme';

type Props = {
  videoSrc: string;
  playbackRate?: number;
  device?: 'iphone' | 'ipad';
};

export const DeviceFrame: React.FC<Props> = ({
  videoSrc,
  playbackRate = 1,
  device = 'iphone',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = spring({ frame, fps, config: SPRINGS.smooth });

  const frameStyle = device === 'iphone'
    ? { width: 375, height: 812, borderRadius: 40 }
    : { width: 768, height: 1024, borderRadius: 20 };

  return (
    <AbsoluteFill
      style={{
        background: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
      }}
    >
      <div
        style={{
          ...frameStyle,
          overflow: 'hidden',
          border: '8px solid #333',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <OffthreadVideo
          src={videoSrc}
          playbackRate={playbackRate}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    </AbsoluteFill>
  );
};
```

## iOS 固有のアンチパターン

| やってはいけないこと | 代わりにやること |
|---------------------|-----------------|
| Simulator のステータスバーをそのまま録画 | `xcrun simctl status_bar override` で時刻・電波を固定 |
| 実機録画のみに依存 | Simulator 録画で再現性を確保 |
| ランダムなデバイスサイズ | `iPhone 16 Pro` 等を固定指定 |
| キーボードアニメーション待ちなし | `Thread.sleep` or `waitForAnimationToEnd` で間を取る |
| 通知バナーの映り込み | DND モード or `simctl` で通知無効化 |
