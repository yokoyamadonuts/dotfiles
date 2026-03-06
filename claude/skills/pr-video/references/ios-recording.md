# iOS アプリ録画ガイド

## 目次

- [概要](#概要)
- [方式比較](#方式比較)
- [方式A: Xcode Simulator + xcrun simctl](#方式a-xcode-simulator--xcrun-simctl)
- [方式B: Maestro フレームワーク](#方式b-maestro-フレームワーク)
- [方式C: Detox (React Native)](#方式c-detox-react-native)
- [方式D: idb + ios-simulator-skill（推奨）](#方式d-idb--ios-simulator-skill推奨)
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
| **idb + ios-simulator-skill** | **a11yツリーでセマンティック操作、座標フォールバック** | **idb + Python 依存** | **ネイティブ iOS（推奨）** |

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

## 方式D: idb + ios-simulator-skill（推奨）

前セッションで AppOverview 動画作成時に実証済み。アクセシビリティツリーでセマンティック操作し、座標フォールバックで確実にタップする。

**前提:**
- idb-companion: `brew install idb-companion`
- fb-idb (Python client): `pip3 install fb-idb`
- ios-simulator-skill: `~/.claude/skills/ios-simulator-skill/`

### nav() ヘルパー関数パターン

すべての録画スクリプトで共通のヘルパーを定義：

```bash
SCRIPTS="$HOME/.claude/skills/ios-simulator-skill/ios-simulator-skill/scripts"
nav() { python3 "$SCRIPTS/navigator.py" --udid "$UDID" "$@" 2>&1 || true; }
```

`|| true` で `set -e` 環境でもスクリプトが停止しないようにする。

### navigator.py 主要フラグ

| フラグ | 説明 | 例 |
|--------|------|-----|
| `--find-text TEXT` | テキストでファジー検索 | `--find-text "波の記録" --tap` |
| `--find-exact TEXT` | テキストで完全一致検索 | `--find-exact "保存" --tap` |
| `--find-type TYPE` | 要素タイプで検索 | `--find-type Button --tap` |
| `--find-id ID` | アクセシビリティIDで検索 | `--find-id "save-button" --tap` |
| `--tap` | 見つかった要素をタップ | `--find-text "次へ" --tap` |
| `--tap-at X,Y` | 座標を直接タップ | `--tap-at 215,845` |
| `--enter-text TEXT` | テキスト入力 | `--find-type TextField --enter-text "朝散歩"` |
| `--index N` | N番目の一致をタップ (0-based) | `--find-type Button --index 2 --tap` |
| `--list` | タップ可能要素を一覧表示 | `--list` |
| `--udid UDID` | デバイスUDID指定 | 自動検出可、明示指定推奨 |

### screen_mapper.py による画面確認

操作前に画面構造を確認する：

```bash
python3 "$SCRIPTS/screen_mapper.py" --udid "$UDID" --verbose --hints
```

出力例から座標やアクセシビリティラベルを確認し、`nav()` の引数に反映する。

### 座標リファレンス（iPhone 17 Pro — idb 402×874 points）

**重要**: idb の座標系は 402×874 points。UIKit の 393×852 とは異なる。
`idb ui describe-all` で実際の AXFrame を確認して使用する。

| 位置 | 座標 (x, y) | AXFrame 根拠 |
|------|-------------|-------------|
| タブバー 左 (段取り) | 67, 832 | {0, 791, 402, 83} の左1/3 |
| タブバー 中 (日課) | 201, 832 | 中央1/3 |
| タブバー 右 (設定) | 335, 832 | 右1/3 |
| セグメントピッカー 左 | 108, 192 | {16, 176, 370, 31} の左半分 |
| セグメントピッカー 右 | 294, 192 | 右半分 |
| バリアントピッカー 左 | 108, 230 | {16, 215, 370, 31} の左半分 |
| バリアントピッカー 右 | 294, 230 | 右半分 |
| 編集ボタン (nav bar) | 354, 84 | {326, 66, 56, 36} |
| スケジュールを作成 | 201, 355 | {32, 333, 338, 44} |
| 今日の振り返りをする | 201, 753 | {16, 731, 370, 44} |
| FAB (右下) | 350, 720 | 概算 — describe-all で要確認 |

### 完全な録画テンプレート

```bash
#!/bin/bash
# record-feature.sh — 機能別デモ録画テンプレート

UDID="$(xcrun simctl list devices booted -j | python3 -c '
import json, sys
data = json.load(sys.stdin)
for runtime, devices in data.get("devices", {}).items():
    for d in devices:
        if d.get("state") == "Booted":
            print(d["udid"]); sys.exit(0)
' 2>/dev/null)"

if [ -z "$UDID" ]; then echo "No booted simulator found"; exit 1; fi

SCRIPTS="$HOME/.claude/skills/ios-simulator-skill/ios-simulator-skill/scripts"
nav() { python3 "$SCRIPTS/navigator.py" --udid "$UDID" "$@" 2>&1 || true; }
APP_BUNDLE="com.yokoyamadonuts.LivingWithJim"
OUTPUT="/tmp/feature-demo.mp4"

# 1. アプリリセット + ステータスバー
xcrun simctl terminate "$UDID" "$APP_BUNDLE" 2>/dev/null || true
xcrun simctl privacy "$UDID" reset all "$APP_BUNDLE" 2>/dev/null || true
xcrun simctl status_bar "$UDID" override \
  --time "9:41" --batteryState charged --batteryLevel 100 \
  --wifiBars 3 --cellularBars 4 --cellularMode active --dataNetwork wifi

# 2. アプリ起動 + 安定待ち
xcrun simctl launch "$UDID" "$APP_BUNDLE"
sleep 3

# 3. 録画開始
xcrun simctl io "$UDID" recordVideo --codec h264 --force "$OUTPUT" &
RECORD_PID=$!
sleep 1

# 4. 機能固有の操作（ここをカスタマイズ）
nav --find-text "次へ" --tap; sleep 1
# ... 各機能の操作

# 5. 録画停止
sleep 1
kill -INT "$RECORD_PID"
wait "$RECORD_PID" 2>/dev/null

echo "Done: $OUTPUT"
```

### UserDefaults リセット（TCA @Shared(.appStorage) 対応）

**重要**: `xcrun simctl spawn defaults write` はアプリコンテナの plist に書き込まない。TCA の `@Shared(.appStorage("key"))` を使うアプリでは以下の手順が必須：

```bash
APP_BUNDLE="com.yokoyamadonuts.LivingWithJim"

# 1. アプリ終了
xcrun simctl terminate "$UDID" "$APP_BUNDLE" 2>/dev/null || true
sleep 1

# 2. コンテナパスを取得して plist を直接削除
CONTAINER="$(xcrun simctl get_app_container "$UDID" "$APP_BUNDLE" data 2>/dev/null)"
PLIST="$CONTAINER/Library/Preferences/$APP_BUNDLE.plist"
rm -f "$PLIST"

# 3. cfprefsd キャッシュをクリア（これがないとメモリキャッシュが残る）
xcrun simctl spawn "$UDID" launchctl kickstart -k system/com.apple.cfprefsd.xpc.daemon 2>/dev/null || true
sleep 1

# 4. アプリ起動（デフォルト値で起動される）
xcrun simctl launch "$UDID" "$APP_BUNDLE"
```

**復元時**（録画後に元の状態に戻す）:

```bash
plutil -create binary1 "$PLIST" 2>/dev/null || true
plutil -insert isOnboarded -bool true "$PLIST" 2>/dev/null || true
```

### canProceed ゲートのあるフローの録画

オンボーディング等で「次へ」ボタンが無効化されるステップがある場合、先にアクション（ブロック追加等）を実行してからボタンをタップする：

```bash
# 例: OnboardingFeature の canProceed: !todayBlocks.isEmpty
# タイムラインの空きスペースをタップしてブロック追加
tap 250 450
sleep 1.5
# ブロック追加後「次へ」が有効になる
tap 236 802
```

### オンボーディング座標リファレンス

| 位置 | 座標 (x, y) | AXFrame 根拠 |
|------|-------------|-------------|
| 次へ (Step 1 — 戻るなし) | 213, 802 | {40, 780, 346, 44} |
| 次へ (Step 2+ — 戻るあり) | 236, 802 | {86, 780, 300, 44} |
| 戻る | 31, 802 | {16, 780, 30, 44} |
| タイムライン 空きスペース | 250, 450 | 概算 — 6h あたり |

### スケジュールエディター座標リファレンス

| 位置 | 座標 (x, y) | AXFrame 根拠 |
|------|-------------|-------------|
| スケジュール名 TextField | 201, 200 | {32, 187, 338, 25} |
| 時間ブロックを追加 (初期) | 201, 311 | {16, 285, 370, 52} |
| 時間ブロックを追加 (1個追加後) | 201, 420 | {16, 394, 370, 52} |
| カテゴリ PopUp | 201, 369 | {32, 352, 338, 34} |
| 保存 (nav bar 右上) | 370, 120 | 概算 |
| キャンセル (nav bar 左上) | 120, 120 | 概算 |

### トラブルシューティング

| 問題 | 原因 | 解決策 |
|------|------|--------|
| `nav()` がスクリプトを停止する | `set -e` でエラー時に即終了 | `\|\| true` を付ける、`set -e` を使わない |
| タップが効かない | 座標ずれ、要素がまだ表示されていない | `sleep` を増やす、`screen_mapper.py` で座標確認 |
| キーボードが表示されない | テキストフィールドがフォーカスされていない | `--find-type TextField --tap` → `sleep 0.5` → `--enter-text` |
| 録画が真っ黒 | アプリ起動前に録画開始 | `sleep 3` でアプリ安定を待つ |
| idb 接続エラー | idb-companion が起動していない | `idb_companion --udid $UDID` で手動起動 |
| 日本語入力できない | `idb ui text` は ASCII キーコードのみ | `printf "テキスト" \| xcrun simctl pbcopy $UDID` → Cmd+V でペースト |
| 座標がずれる | UIKit 393×852 と idb 402×874 の差異 | `idb ui describe-all` で実際の AXFrame を確認 |
| セグメントピッカーが反応しない | SwiftUI Picker(.segmented) のタップ判定 | `idb ui describe-all` で正確な y 座標を確認し `idb ui tap` で直接タップ |
| `simctl spawn defaults write` が効かない | アプリコンテナ外に書き込まれる | plist 直接削除 + `cfprefsd` kill（上記「UserDefaults リセット」参照） |
| オンボーディングが表示されない | UserDefaults のメモリキャッシュ | `cfprefsd` の kill が必須。plist 削除だけでは不十分 |
| 「次へ」ボタンが無効 | canProceed ゲート（ブロック追加等が必要） | フロー内でアクション実行後にタップ（上記参照） |

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
