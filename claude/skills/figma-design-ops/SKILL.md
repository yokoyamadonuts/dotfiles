---
name: figma-design-ops
description: Use when converting design descriptions, UI specs, or wireframes into Figma-ready implementation specifications. Triggers on「Figma仕様」「Figma用に変換」「Design Ops」「Figmaスペック」「デザインをFigmaに」.
---

# Figma Design Ops

シニアデザインエンジニアとして、任意のデザイン記述を Figma 実装に必要な仕様書に変換する。

## 入力

ユーザーから `[DESIGN DESCRIPTION]` を受け取る。これは以下のいずれか:

- UI 仕様書（`docs/ios-ui-spec.md` 等）
- デザインシステム定義
- ワイヤーフレーム記述
- 画面設計のテキスト描写
- 既存アプリのリデザイン要件

## 出力

`docs/` ディレクトリに Figma 仕様書（`figma-spec-[name].md`）を生成する。全10セクション構成。

## Process

### Phase 1: コンテキスト収集

以下を並列で調査する:

1. **既存デザイン資産**: `docs/` 配下のデザインシステム、UI 仕様書、ブランドガイドラインを読み込む
2. **プラットフォーム特定**: iOS / Android / Web / マルチプラットフォームを判定
3. **既存 Figma ファイル**: `.pen` ファイルがあれば構造を確認（pencil MCP ツール使用）
4. **デバイスプリセット**: ターゲットデバイスのフレームサイズを確定

**重要**: 既存のデザインシステムトークンを最大限再利用する。矛盾する新規定義を作らない。

→ コンテキストをユーザーに確認

### Phase 2: フレーム & レイアウト設計（§1-§5）

以下の5セクションを出力:

- §1 フレーム構造
- §2 グリッド
- §3 Constraints
- §4 レスポンシブルール
- §5 Auto Layout

→ ユーザー確認

### Phase 3: コンポーネント & トークン設計（§6-§7）

以下の2セクションを出力:

- §6 コンポーネント設計
- §7 デザイントークン

→ ユーザー確認

### Phase 4: インタラクション & ハンドオフ（§8-§10）

以下の3セクションを出力:

- §8 プロトタイプフロー
- §9 Dev ハンドオフ仕様
- §10 アクセシビリティノート

→ 最終レビュー

---

## §1 フレーム構造

画面ツリーと Figma ページ/フレーム構成を定義する。

### 1.1 ページ構成

| Figma ページ | 内容 |
|-------------|------|
| 🎨 Design System | トークン、コンポーネント一覧 |
| 📱 Screens | 全画面フレーム |
| 🔄 Flows | プロトタイプフロー |
| 📐 Specs | 開発者向けハンドオフ |

### 1.2 フレーム命名規則

```
Screen/[ScreenName]/[State]

例:
Screen/Home/Default
Screen/Home/Empty
Screen/Home/Loading
Screen/Settings/Default
```

### 1.3 フレームサイズ（デバイスプリセット）

| デバイス | 幅 | 高さ | Scale |
|---------|-----|------|-------|
| iPhone 15 Pro | 393 | 852 | @3x |
| iPhone 15 Pro Max | 430 | 932 | @3x |
| iPhone SE (3rd) | 375 | 667 | @2x |
| iPad Pro 11" | 834 | 1194 | @2x |
| iPad Pro 12.9" | 1024 | 1366 | @2x |
| Android (Material) | 360 | 800 | mdpi基準 |
| Desktop (1440) | 1440 | 900 | @1x |
| Desktop (1920) | 1920 | 1080 | @1x |

### 1.4 画面ツリーテンプレート

```
[App Name]
├── [Tab/Section 1]
│   ├── [Screen A] — Default / Empty / Loading / Error
│   └── [Screen B] — Default / Detail
├── [Tab/Section 2]
│   ├── [Screen C] — Default / Edit
│   └── [Screen D] — Default
├── [Modal/Sheet]
│   ├── [Modal A] — Default
│   └── [Sheet B] — Default
└── [Onboarding]
    ├── Step 1
    ├── Step 2
    └── Step N
```

---

## §2 グリッド

Figma Layout Grid の設定値を定義する。

### 2.1 デバイス別グリッド定義

| プロパティ | Mobile (393px) | Tablet (834px) | Desktop (1440px) |
|-----------|---------------|----------------|------------------|
| Type | Stretch | Stretch | Stretch |
| Count | 4 | 8 | 12 |
| Margin | 16px | 24px | 80px |
| Gutter | 8px | 16px | 24px |

### 2.2 Figma 設定テンプレート

```
Layout Grid:
  Column Grid:
    Count: [N]
    Type: Stretch
    Width: Auto
    Offset: [Margin]px
    Gutter: [Gutter]px
    Color: FF0000 / 10% opacity

  Row Grid (任意):
    Count: Auto
    Height: 8px
    Color: 0000FF / 10% opacity
```

---

## §3 Constraints

各要素の Constraints 設定を定義する。

### 3.1 Constraints ルール表

| 要素タイプ | Horizontal | Vertical | 備考 |
|-----------|-----------|----------|------|
| ヘッダー / ナビバー | Left & Right | Top | 幅は親に追従 |
| タブバー | Left & Right | Bottom | 幅は親に追従 |
| コンテンツエリア | Left & Right | Top & Bottom | Safe Area 内 |
| FAB | Right | Bottom | 固定位置 |
| モーダル | Center | Center | オーバーレイ |
| サイドバー | Left | Top & Bottom | 固定幅 |
| カード（リスト内） | Left & Right | Top | Auto Layout 内では不要 |
| アイコン（ナビ内） | Center | Center | 親フレーム内中央 |

### 3.2 Safe Area 対応

```
iOS:
  Top: Dynamic Island / Notch 対応 → Status Bar Height
  Bottom: Home Indicator 対応 → 34px

Android:
  Top: Status Bar → 24dp
  Bottom: Navigation Bar → 48dp
```

---

## §4 レスポンシブルール

ブレイクポイントとリフロー規則を定義する。

### 4.1 ブレイクポイント

| 名前 | 幅 | グリッド列数 | ターゲット |
|------|-----|-----------|-----------|
| xs | < 375px | 4 | iPhone SE |
| sm | 375-429px | 4 | iPhone 標準 |
| md | 430-767px | 4 | iPhone Max |
| lg | 768-1023px | 8 | iPad |
| xl | 1024-1439px | 12 | iPad Pro / Laptop |
| 2xl | ≥ 1440px | 12 | Desktop |

### 4.2 リフロールール

| パターン | sm (Mobile) | lg (Tablet) | xl (Desktop) |
|---------|-------------|-------------|--------------|
| カードグリッド | 1列 | 2列 | 3-4列 |
| ナビゲーション | Tab Bar (Bottom) | Sidebar | Sidebar + TopNav |
| フォーム | 1カラム | 1カラム | 2カラム |
| リスト | Full Width | Max 600px centered | Max 600px + Detail pane |
| HStack→VStack | VStack | HStack | HStack |

### 4.3 Figma フレーム切り替え

```
Component Set:
  Property: Breakpoint
  Values: Mobile / Tablet / Desktop
  → 各 Variant で Auto Layout 方向を変更
```

---

## §5 Auto Layout

全コンポーネント・フレームの Auto Layout 設定を定義する。

### 5.1 Auto Layout プロパティテンプレート

| プロパティ | 設定値 | 説明 |
|-----------|-------|------|
| Direction | Vertical / Horizontal / Wrap | レイアウト方向 |
| Padding (Top) | `[N]`px | 上パディング |
| Padding (Right) | `[N]`px | 右パディング |
| Padding (Bottom) | `[N]`px | 下パディング |
| Padding (Left) | `[N]`px | 左パディング |
| Item Spacing | `[N]`px | 子要素間のスペース |
| Primary Axis Align | Min / Center / Max / Space Between | 主軸整列 |
| Counter Axis Align | Min / Center / Max / Baseline | 交差軸整列 |
| Resizing (W) | Hug / Fill / Fixed `[N]`px | 幅のリサイズ挙動 |
| Resizing (H) | Hug / Fill / Fixed `[N]`px | 高さのリサイズ挙動 |

### 5.2 代表的パターン

| コンポーネント | Direction | Spacing | Padding | W Resize | H Resize |
|--------------|-----------|---------|---------|----------|----------|
| Screen Root | Vertical | 0 | 0,0,0,0 | Fixed (device) | Fixed (device) |
| Card | Vertical | 12 | 16,16,16,16 | Fill | Hug |
| Button | Horizontal | 8 | 12,24,12,24 | Hug | Hug |
| Nav Bar | Horizontal | 0 | 0,16,0,16 | Fill | Fixed 44 |
| Tab Bar | Horizontal | 0 | 0,0,0,0 | Fill | Fixed 49 |
| List Item | Horizontal | 12 | 12,16,12,16 | Fill | Hug |
| Form Field | Vertical | 4 | 0,0,0,0 | Fill | Hug |
| Modal | Vertical | 16 | 24,24,24,24 | Fixed / Fill | Hug |
| Section Header | Horizontal | 8 | 0,16,0,16 | Fill | Hug |
| Chip / Tag | Horizontal | 4 | 6,12,6,12 | Hug | Hug |

### 5.3 ネスト構造テンプレート

```
[Screen Root] — Vertical, Fill × Fixed
  ├── [Nav Bar] — Horizontal, Fill × Fixed 44
  │   ├── [Back Icon] — Fixed 24 × 24
  │   ├── [Title] — Fill × Hug
  │   └── [Action Icon] — Fixed 24 × 24
  ├── [Scroll Content] — Vertical, Fill × Fill, spacing: 16
  │   ├── [Section A] — Vertical, Fill × Hug, spacing: 12
  │   │   ├── [Section Header] — Horizontal, Fill × Hug
  │   │   └── [Card List] — Vertical, Fill × Hug, spacing: 8
  │   └── [Section B] — Vertical, Fill × Hug, spacing: 12
  └── [Tab Bar] — Horizontal, Fill × Fixed 49
```

---

## §6 コンポーネント設計

Figma コンポーネントの Variants・Properties・Slot パターンを定義する。

### 6.1 命名規則

```
[Category]/[ComponentName]

例:
Button/Primary
Button/Secondary
Card/WaveLog
Card/Routine
Input/TextField
Input/TextArea
Navigation/TabBar
Navigation/NavBar
```

### 6.2 Variants マトリクス テンプレート

| Component | Property | Values |
|-----------|----------|--------|
| Button | Style | Primary / Secondary / Ghost / Destructive |
| Button | Size | Small / Medium / Large |
| Button | State | Default / Hover / Pressed / Disabled / Loading |
| Button | Icon | None / Leading / Trailing / Only |
| Card | Type | Default / Compact / Expanded |
| Card | State | Default / Selected / Disabled |
| Input | Type | Text / Password / Search / Number |
| Input | State | Default / Focus / Error / Disabled / Filled |
| Toggle | State | Off / On |
| Toggle | Disabled | False / True |

### 6.3 Component Properties テンプレート

| Property Type | 名前例 | 値 | 用途 |
|--------------|--------|-----|------|
| Boolean | showIcon | true/false | アイコン表示切替 |
| Boolean | showBadge | true/false | バッジ表示切替 |
| Instance Swap | leadingIcon | Icon/* | 先頭アイコン差替 |
| Instance Swap | trailingIcon | Icon/* | 末尾アイコン差替 |
| Text | label | "Button" | ボタンラベル |
| Text | placeholder | "Enter text" | プレースホルダー |
| Enum | variant | primary/secondary | スタイル切替 |
| Enum | size | sm/md/lg | サイズ切替 |

### 6.4 Slot パターン

```
[Component]
  ├── [Slot: Leading] — Instance Swap (Default: Icon/Placeholder)
  ├── [Content]
  │   ├── [Slot: Title] — Text Property
  │   └── [Slot: Subtitle] — Text Property
  └── [Slot: Trailing] — Instance Swap (Default: Icon/ChevronRight)
```

---

## §7 デザイントークン

Figma Variables としてのデザイントークンを定義する。

### 7.1 Variables 構造

```
Collection: Primitives
  Mode: Value
  ├── color/
  │   ├── gray/50   → #F9FAFB
  │   ├── gray/100  → #F3F4F6
  │   ├── ...
  │   ├── brand/50  → #[HEX]
  │   └── brand/900 → #[HEX]
  ├── space/
  │   ├── 0  → 0
  │   ├── 1  → 4
  │   ├── 2  → 8
  │   ├── 3  → 12
  │   ├── 4  → 16
  │   ├── 5  → 20
  │   ├── 6  → 24
  │   ├── 8  → 32
  │   └── 10 → 40
  └── radius/
      ├── none → 0
      ├── sm   → 4
      ├── md   → 8
      ├── lg   → 12
      ├── xl   → 16
      └── full → 9999

Collection: Semantic
  Mode: Light / Dark
  ├── bg/
  │   ├── primary      → {Primitives.color/white} / {Primitives.color/gray/900}
  │   ├── secondary    → {Primitives.color/gray/50} / {Primitives.color/gray/800}
  │   └── surface      → {Primitives.color/white} / {Primitives.color/gray/850}
  ├── fg/
  │   ├── primary      → {Primitives.color/gray/900} / {Primitives.color/white}
  │   ├── secondary    → {Primitives.color/gray/600} / {Primitives.color/gray/400}
  │   └── disabled     → {Primitives.color/gray/400} / {Primitives.color/gray/600}
  ├── border/
  │   ├── default      → {Primitives.color/gray/200} / {Primitives.color/gray/700}
  │   └── focus        → {Primitives.color/brand/500} / {Primitives.color/brand/400}
  └── accent/
      ├── default      → {Primitives.color/brand/500} / {Primitives.color/brand/400}
      └── hover        → {Primitives.color/brand/600} / {Primitives.color/brand/300}
```

### 7.2 テキストスタイル テンプレート

| スタイル名 | Font | Size | Line Height | Letter Spacing | Weight |
|-----------|------|------|-------------|---------------|--------|
| Display/Large | [Font] | 34 | 41 (1.2×) | -0.4 | Bold |
| Display/Medium | [Font] | 28 | 34 (1.2×) | -0.3 | Bold |
| Heading/Large | [Font] | 22 | 28 (1.27×) | -0.2 | Semibold |
| Heading/Medium | [Font] | 17 | 22 (1.29×) | -0.1 | Semibold |
| Body/Large | [Font] | 17 | 25 (1.47×) | 0 | Regular |
| Body/Medium | [Font] | 15 | 22 (1.47×) | 0 | Regular |
| Body/Small | [Font] | 13 | 18 (1.38×) | 0 | Regular |
| Caption | [Font] | 12 | 16 (1.33×) | 0 | Regular |
| Label/Large | [Font] | 15 | 20 (1.33×) | 0 | Medium |
| Label/Small | [Font] | 11 | 13 (1.18×) | 0.1 | Medium |

### 7.3 エフェクトスタイル テンプレート

| スタイル名 | Type | X | Y | Blur | Spread | Color |
|-----------|------|---|---|------|--------|-------|
| Shadow/sm | Drop Shadow | 0 | 1 | 2 | 0 | #000000 / 5% |
| Shadow/md | Drop Shadow | 0 | 4 | 8 | -2 | #000000 / 10% |
| Shadow/lg | Drop Shadow | 0 | 8 | 24 | -4 | #000000 / 10% |
| Shadow/xl | Drop Shadow | 0 | 20 | 40 | -8 | #000000 / 15% |
| Blur/bg | Background Blur | — | — | 16 | — | — |

---

## §8 プロトタイプフロー

画面遷移とインタラクションの Figma プロトタイプ設定を定義する。

### 8.1 フロー定義テンプレート

| # | From | To | Trigger | Animation | Duration | Easing |
|---|------|----|---------|-----------|----------|--------|
| 1 | Screen/Home | Screen/Detail | On Click | Smart Animate | 300ms | Ease Out |
| 2 | Screen/Detail | Screen/Home | On Click (Back) | Smart Animate | 300ms | Ease Out |
| 3 | Screen/Home | Modal/Create | On Click (FAB) | Move In (Bottom) | 400ms | Spring |
| 4 | Modal/Create | Screen/Home | On Click (Close) | Move Out (Bottom) | 300ms | Ease In |
| 5 | Screen/Any | Sheet/Filter | On Click | Slide In (Bottom) | 300ms | Spring |

### 8.2 トリガー種別

| トリガー | 用途 | 例 |
|---------|------|-----|
| On Click | タップ・クリック | ボタン、リスト項目 |
| On Drag | スワイプ・ドラッグ | カルーセル、スワイプ削除 |
| While Hovering | ホバー（Desktop） | ツールチップ、ボタン hover |
| While Pressing | 長押し | コンテキストメニュー |
| After Delay | 自動遷移 | スプラッシュ → ホーム（2000ms） |
| Mouse Enter / Leave | マウス追跡 | インタラクティブカーソル |
| Key/Gamepad | キーボード | Escape でモーダル閉じ |

### 8.3 アニメーション設定

| Type | 用途 | 推奨 Duration | Easing |
|------|------|--------------|--------|
| Smart Animate | 画面遷移（同構造） | 300ms | Ease Out |
| Move In / Out | モーダル・シート | 300-400ms | Spring(damping:0.85) |
| Dissolve | フェードイン・アウト | 200ms | Ease In Out |
| Slide In / Out | ドロワー・パネル | 300ms | Ease Out |
| Push | スタックナビゲーション | 350ms | Spring |
| Instant | 状態切替（タブ） | 0ms | — |

### 8.4 フロー命名

```
Flow 1: "Main Flow" — 開始フレーム: Screen/Home/Default
Flow 2: "Onboarding" — 開始フレーム: Screen/Onboarding/Welcome
Flow 3: "Create Item" — 開始フレーム: Screen/Home/Default
```

---

## §9 Dev ハンドオフ仕様

開発者が Figma から実装に移すための対応表を定義する。

### 9.1 CSS プロパティマッピング

| Figma プロパティ | CSS / SwiftUI | 例 |
|----------------|---------------|-----|
| Fill (Solid) | `background-color` / `.background()` | `#FFFFFF` → `background-color: #fff` |
| Fill (Gradient) | `background: linear-gradient()` | — |
| Stroke | `border` | `1px solid #E5E7EB` |
| Corner Radius | `border-radius` / `.cornerRadius()` | `8px` |
| Drop Shadow | `box-shadow` / `.shadow()` | `0 4px 8px rgba(0,0,0,0.1)` |
| Auto Layout (V) | `flex-direction: column` / `VStack` | — |
| Auto Layout (H) | `flex-direction: row` / `HStack` | — |
| Auto Layout (Wrap) | `flex-wrap: wrap` / `LazyVGrid` | — |
| Gap | `gap` / `spacing:` | `8px` |
| Padding | `padding` / `.padding()` | `16px` |
| Fill Container | `flex: 1` / `.frame(maxWidth: .infinity)` | — |
| Hug Contents | `width: fit-content` / implicit | — |
| Fixed | `width: [N]px` / `.frame(width:)` | — |

### 9.2 エクスポート設定

| アセットタイプ | フォーマット | サイズ | 用途 |
|-------------|------------|-------|------|
| Icon | SVG | 24×24 (base) | Web / Android |
| Icon | PDF | 24×24 (base) | iOS (Asset Catalog) |
| Icon (Raster) | PNG | @1x, @2x, @3x | iOS fallback |
| Illustration | SVG | Original | Web |
| Illustration | PNG | @1x, @2x, @3x | iOS |
| App Icon | PNG | 1024×1024 | App Store |
| Favicon | PNG | 16, 32, 180, 192, 512 | Web |

### 9.3 トークン → CSS 変数マッピング

```css
/* Primitives */
--color-gray-50: #F9FAFB;
--color-gray-100: #F3F4F6;
--space-1: 4px;
--space-2: 8px;
--radius-md: 8px;

/* Semantic (Light) */
--bg-primary: var(--color-white);
--fg-primary: var(--color-gray-900);
--border-default: var(--color-gray-200);
--accent-default: var(--color-brand-500);
```

```swift
// SwiftUI — Design Tokens
extension Color {
    static let bgPrimary = Color("bgPrimary")       // Asset Catalog
    static let fgPrimary = Color("fgPrimary")
    static let accentDefault = Color("accentDefault")
}

extension CGFloat {
    static let space1: CGFloat = 4
    static let space2: CGFloat = 8
    static let radiusMd: CGFloat = 8
}
```

### 9.4 コンポーネント → コード命名対応表

| Figma コンポーネント | CSS Class / SwiftUI View | ファイル |
|--------------------|--------------------------|---------|
| Button/Primary | `.btn-primary` / `PrimaryButton` | `Button.swift` |
| Card/Default | `.card` / `CardView` | `Card.swift` |
| Input/TextField | `.input-field` / `JimTextField` | `TextField.swift` |
| Navigation/TabBar | `.tab-bar` / `MainTabView` | `TabBar.swift` |

---

## §10 アクセシビリティノート

WCAG 準拠と各プラットフォームのアクセシビリティ対応を定義する。

### 10.1 コントラスト比

| 要素 | 基準 | 最小比率 | チェック方法 |
|------|------|---------|-------------|
| 通常テキスト (< 18px) | WCAG AA | 4.5:1 | Figma Plugin: "Contrast" |
| 大テキスト (≥ 18px Bold / ≥ 24px) | WCAG AA | 3:1 | 同上 |
| UI コンポーネント（ボーダー等） | WCAG AA | 3:1 | 同上 |
| 非テキスト（アイコン） | WCAG AA | 3:1 | 同上 |
| AAA 推奨 | WCAG AAA | 7:1 / 4.5:1 | 可能な範囲で |

### 10.2 フォーカス順序（Tab Order）

```
[Screen]
  1. Nav Bar (Back → Title → Action)
  2. Content Area (Top → Bottom, Left → Right)
     2a. Section Header
     2b. Interactive Items (順序通り)
  3. FAB / CTA
  4. Tab Bar (Tab 1 → Tab 2 → Tab 3)
```

### 10.3 ARIA ロール / ラベル対応表

| Figma コンポーネント | ARIA Role | ARIA Label | iOS Accessibility |
|--------------------|-----------|------------|-------------------|
| Button/* | `button` | ボタンラベル | `.accessibilityLabel()` |
| Input/* | `textbox` | フィールド名 | `.accessibilityLabel()` |
| Card/* | `article` | カードタイトル | `.accessibilityElement(children:)` |
| Toggle/* | `switch` | トグル説明 | `.accessibilityValue()` |
| Tab Bar Item | `tab` | タブ名 | `.accessibilityLabel()` + `.accessibilityAddTraits(.isSelected)` |
| Modal | `dialog` | モーダルタイトル | UIAccessibility.post(.screenChanged) |
| Alert | `alert` | アラートメッセージ | `.accessibilityAddTraits(.isModal)` |

### 10.4 タッチターゲット

| プラットフォーム | 最小サイズ | 推奨サイズ | 根拠 |
|---------------|----------|----------|------|
| iOS | 44×44 pt | 48×48 pt | Apple HIG |
| Android | 48×48 dp | 48×48 dp | Material Design |
| Web | 44×44 px | 48×48 px | WCAG 2.5.8 |

### 10.5 Reduce Motion 代替

| 通常アニメーション | Reduce Motion 時 | 実装 |
|-----------------|-----------------|------|
| Smart Animate (300ms) | Dissolve (150ms) | `@Environment(\.accessibilityReduceMotion)` |
| Spring Animation | Instant / Dissolve | `prefers-reduced-motion: reduce` |
| Parallax Scroll | Static | Figma: 別 Variant |
| Auto-play Video | Poster Image (静止画) | `<video>` の autoplay 無効化 |
| Progress Animation | Static progress bar | アニメーション条件分岐 |

---

## 品質チェックリスト

Phase 完了時に以下を検証する:

- [ ] 全10セクション（§1-§10）が含まれている
- [ ] Auto Layout 設定が全コンポーネントに定義されている
- [ ] Variants マトリクスが state × style を網羅している
- [ ] デザイントークンが Figma Variables 形式（Collection / Mode / Value）で定義されている
- [ ] テキストスタイルが全階層（Display → Caption）をカバーしている
- [ ] コントラスト比が WCAG AA 以上
- [ ] CSS マッピングが全トークンをカバーしている
- [ ] コンポーネント命名規則が `Category/ComponentName` で一貫している
- [ ] エクスポート設定に @1x/@2x/@3x が含まれている
- [ ] アクセシビリティノートに ARIA + iOS 両方の対応がある
- [ ] プロトタイプフローに Duration + Easing が明記されている
- [ ] Reduce Motion 代替が定義されている

## 重要原則

1. **既存資産の尊重**: デザインシステム・ブランドガイドラインのトークンをそのまま Figma Variables に翻訳する。独自の値を作らない
2. **Figma ネイティブ**: Auto Layout、Variants、Variables、Component Properties など Figma のネイティブ機能を最大限活用する
3. **Dev ハンドオフ最優先**: 開発者が迷わず実装できる粒度の仕様。CSS/SwiftUI 両方のマッピングを提供する
4. **アクセシビリティファースト**: WCAG AA、タッチターゲット 44px+、Reduce Motion 対応を全コンポーネントに
5. **プラットフォーム適応**: iOS (HIG)、Android (Material)、Web それぞれの慣習を尊重する
