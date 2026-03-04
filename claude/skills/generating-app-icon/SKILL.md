---
name: generating-app-icon
description: CoreGraphics + AppKit のSwiftスクリプトでiOSアプリアイコン（1024x1024 PNG）を自動生成する。ブランドカラーとキャラクターデザインを反映した再現可能なアイコン生成パイプライン。「アイコンを生成」「アイコンを更新」「アプリアイコン」「app icon」で起動。
---

# App Icon Generator

CoreGraphics + AppKit を使った Swift スクリプトで iOS アプリアイコンを自動生成する。

## 前提条件

- macOS + Xcode（AppKit / CoreGraphics が利用可能）
- Xcode 16+ の単一 1024x1024 PNG 形式

## Process

### Phase 1: 現状確認

以下を並列で確認する:

1. **既存スクリプト**: プロジェクト内の `Scripts/generate-app-icon.swift` を検索
2. **ブランドカラー**: デザインシステムのカラー定義を取得（Colors.swift 等）
3. **出力先**: `Assets.xcassets/AppIcon.appiconset/` の構成確認
4. **Contents.json**: `filename` キーが正しく設定されているか確認（Xcode 16+ 形式）

Contents.json の正しい形式（Xcode 16+ 単一画像形式）:

```json
{
  "images": [
    {
      "filename": "AppIcon.png",
      "idiom": "universal",
      "platform": "ios",
      "size": "1024x1024"
    }
  ],
  "info": { "author": "xcode", "version": 1 }
}
```

### Phase 2: デザイン方針の確認

ユーザーに変更内容を確認:

- **キャラクター変更**: 顔の要素（表情、アクセサリ）の変更があるか
- **カラー変更**: 背景色やアクセントカラーの変更があるか
- **テキスト変更**: アイコン内テキストの変更があるか

変更なしの場合は既存スクリプトを再実行するだけでよい。

### Phase 3: スクリプト作成・実行

#### スクリプトのテンプレート構造

```swift
#!/usr/bin/env swift
import AppKit
import CoreGraphics
import Foundation

// 1. hex → NSColor 変換ヘルパー
func color(hex: String) -> NSColor { ... }

// 2. ブランドカラー定義
let primaryColor = color(hex: "#XXXXXX")

// 3. 1024x1024 NSBitmapImageRep キャンバス作成
let size = 1024
guard let rep = NSBitmapImageRep(...) else { exit(1) }
guard let ctx = NSGraphicsContext(bitmapImageRep: rep) else { exit(1) }
NSGraphicsContext.current = ctx
let cg = ctx.cgContext
let s = CGFloat(size)

// 4. 描画（do {} ブロックで各ステップを分離）
do { /* Background */ }
do { /* Character / Logo */ }
do { /* Accents */ }
do { /* Text */ }

// 5. PNG 保存（#filePath から相対パスで出力先を自動決定）
NSGraphicsContext.restoreGraphicsState()
guard let pngData = rep.representation(using: .png, properties: [:]) else { exit(1) }
let outputPath = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent()
    .deletingLastPathComponent()
    .appendingPathComponent("App/Assets.xcassets/AppIcon.appiconset/AppIcon.png")
try pngData.write(to: outputPath)
```

#### CoreGraphics 描画の注意

- 座標系は左下が原点（UIKit と異なる）
- `s * 0.5` 形式で相対座標を使い、サイズ変更に対応
- `do { }` ブロックで描画ステップを分離し、CGContext の状態を管理
- `NSAttributedString.draw(at:)` でテキスト描画

#### 実行

iOS プロジェクトルートをカレントディレクトリとして:

```bash
swift Scripts/generate-app-icon.swift
```

### Phase 4: 検証

1. **ファイル検証**: `file` コマンドで PNG 1024x1024 を確認
2. **視覚確認**: Read ツールで生成画像を目視確認
3. **Contents.json**: `"filename": "AppIcon.png"` が存在するか確認
4. **ビルド検証**: xcodebuild でビルドが通るか確認

### project.yml / Xcode 設定

- `ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon` をビルド設定に追加
- LaunchScreen は `UILaunchScreen.UIColorName` で Info.plist に設定可能（storyboard 不要）

## トラブルシューティング

| 問題 | 原因 | 対処 |
|------|------|------|
| `swift` コマンドでエラー | macOS 以外で実行 | AppKit は macOS 専用。macOS で実行する |
| アイコンが Simulator に反映されない | DerivedData キャッシュ | `rm -rf ~/Library/Developer/Xcode/DerivedData` で削除後リビルド |
| Contents.json にファイル名がない | `filename` キー未設定 | `"filename": "AppIcon.png"` を追加 |
| ビルドエラー: No AppIcon | ASSETCATALOG_COMPILER_APPICON_NAME 未設定 | ビルド設定に `ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon` を追加 |
