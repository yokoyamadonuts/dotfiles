# デザインシステム — セクション詳細仕様

各セクションで定義すべき内容の詳細テンプレート。

## 目次
1. [カラーシステム](#カラーシステム)
2. [タイポグラフィ](#タイポグラフィ)
3. [グリッド](#グリッドシステム)
4. [スペーシング](#スペーシングシステム)
5. [アイコノグラフィ](#アイコノグラフィ)
6. [エレベーション](#エレベーション--シャドウ)
7. [モーション](#モーション)
8. [コンポーネント](#コンポーネント)
9. [デザインパターン](#デザインパターン)
10. [デザイントークン](#デザイントークン-json)
11. [Do / Don't](#do--dont)
12. [アクセシビリティ](#アクセシビリティ)
13. [開発者ガイド](#開発者ガイド)

---

## カラーシステム

定義すべきカテゴリ:

| カテゴリ | 内容 |
|---------|------|
| プライマリパレット | 背景色、カード色、リセスド色、アクセント色（3色以内）|
| テキストカラー | 3段階（主要/副次/プレースホルダー）+ コントラスト比明記 |
| セマンティックカラー | destructive, success, caution, info + 使用ルール |
| ドメイン固有カラー | アプリ独自の意味を持つ色（あれば）|
| ダークモード | 全色の Dark variant。アクセント色は明度+10%。背景色は温かみのあるダーク |
| High Contrast | `accessibilityContrast` 対応。テキスト・ボーダー強化 |
| 使用ルール | 5つ以上のルール（CTA数制限、純白純黒禁止等）|

**コントラスト要件**:
- テキスト: WCAG AA (4.5:1) 以上
- 大テキスト (18pt bold+): 3:1 以上
- UIコンポーネント: 3:1 以上

---

## タイポグラフィ

定義すべき要素:

| 要素 | 内容 |
|------|------|
| フォントファミリー | 2-3ファミリー。用途・雰囲気を明記 |
| タイプスケール | **9段階** |
| 特殊スタイル | ドメイン固有のスタイル（ボタン、タブ等）|
| レスポンシブスケール | Dynamic Type / rem スケーリング対応表 |
| ルール | 5つ以上 |

### 9段階スケールテンプレート

```
| Level | Token | Size | Line Height | Weight | Font | 用途 |
|-------|-------|------|-------------|--------|------|------|
| Display | display | 32px | 40px (1.25) | Bold | [Primary] | ヒーロータイトル |
| Title 1 | title1 | 24px | 32px (1.33) | Bold | [Primary] | 画面タイトル |
| Title 2 | title2 | 20px | 28px (1.40) | SemiBold | [Primary] | セクション見出し |
| Title 3 | title3 | 18px | 24px (1.33) | SemiBold | [Primary] | カード見出し |
| Body | body | 16px | 24px (1.50) | Regular | [Primary] | 本文 |
| Body Small | bodySmall | 14px | 20px (1.43) | Regular | [Primary] | 補助テキスト |
| Caption | caption | 13px | 18px (1.38) | Regular | [Primary] | メタ情報 |
| Caption Small | captionSmall | 11px | 16px (1.45) | Medium | [System] | バッジ |
| Overline | overline | 10px | 14px (1.40) | SemiBold | [System] | カテゴリラベル |
```

---

## グリッドシステム

- 12カラムグリッド
- デバイス別レイアウト表（5+デバイス: margin, column width, 主要レイアウト）
- カラムスパンガイド（コンポーネント別: Phone / Tablet）
- セーフエリア対応

---

## スペーシングシステム

- **8px ベース**: xxs(4), xs(8), sm(12), md(16), lg(24), xl(32), xxl(48), xxxl(64)
- コンポーネント内スペーシング表
- コーナーラディウス: 7段階 (none(0), xs(4), sm(8), md(12), lg(16), xl(24), full(9999))
- タッチターゲット: 最小44px、推奨48px

---

## アイコノグラフィ

- プラットフォームネイティブ優先（SF Symbols / Material Icons）
- カスタムアイコンはドメイン固有のみ
- サイズは8の倍数: 16/20/24/32px
- 色はコンテキストに従う

---

## エレベーション & シャドウ

5段階: flat, low, medium, high, highest
- ダークモードではシャドウ → ボーダーに切り替え

---

## モーション

| Token | Duration | 用途 |
|-------|----------|------|
| fast | 150ms | ボタンフィードバック |
| normal | 250ms | カード展開 |
| slow | 400ms | モーダル表示 |
| gentle | 500ms | 大きな状態変化 |
| spring | response 0.4, damping 0.7 | 物理的な動き |

- Reduce Motion 対応必須

---

## コンポーネント

### 必須カテゴリ

| カテゴリ | 最低数 | コンポーネント例 |
|---------|-------|---------------|
| Buttons | 2 | Button (5 variants), FAB |
| Cards | 2 | Card, domain-specific cards |
| Inputs | 3 | TextField, Toggle, Slider, domain pickers |
| Feedback | 3 | Toast, Dialog, Skeleton, ProgressBar |
| Navigation | 3 | TabBar, NavigationBar, Sheet/Modal |
| Layout | 3 | SectionHeader, Divider, EmptyState, List |
| Data Display | 3 | Badge, Chip, Avatar, Stepper |
| Domain | 4+ | アプリ固有のコンポーネント |

**規模ガイド**: 小規模アプリ: 20+、中規模: 25+、大規模: 30+

### コンポーネント仕様テンプレート

各コンポーネントに以下を含める:

```markdown
### N.N [ComponentName]

#### バリアント
| Style/Variant | ... | 用途 |

#### サイズ（該当する場合）
| Size | Height | Font | Padding | Radius |

#### 状態
| State | 変化 |
| Default / Pressed / Disabled / Loading / Error / ... |

#### 構造（ASCII図）
┌─ ComponentName ─────────────────┐
│ [Layout structure]               │
└──────────────────────────────────┘

#### アクセシビリティ
- accessibilityRole
- accessibilityLabel / accessibilityHint
- タッチターゲット 44×44px

#### コード
[language]
// 基本使用例
// バリアント例
```

---

## デザインパターン

最低3つの画面構成パターン:

- **Pattern A: リスト画面** — ナビバー + コンテンツリスト + FAB + タブバー
- **Pattern B: フォーム画面** — モーダルナビバー + 入力フィールド群 + CTA
- **Pattern C: ダッシュボード画面** — セグメント + カード群 + アクション

各パターンにASCII wireframeを含める。

追加:
- インタラクション（スワイプ、プルリフレッシュ、ハプティクス）
- エラーハンドリング（バリデーション、通信エラー、致命的エラー）

---

## デザイントークン (JSON)

全トークンを構造化JSONで出力:

```json
{
  "[app]-design-tokens": {
    "version": "1.0.0",
    "color": {
      "light": { "background": {}, "text": {}, "accent": {}, "semantic": {} },
      "dark": { "background": {}, "text": {}, "accent": {}, "semantic": {} }
    },
    "typography": { "fontFamily": {}, "scale": {}, "special": {} },
    "spacing": {},
    "radius": {},
    "elevation": {},
    "motion": {},
    "touchTarget": {},
    "grid": {}
  }
}
```

---

## Do / Don't

以下のカテゴリごとに5-6項目:

- カラー / タイポグラフィ / コンポーネント / モーション / インタラクション / トーン & ライティング

フォーマット:
```
| Do | Don't |
|----|-------|
| ✅ [推奨される行動] | ❌ [避けるべき行動] |
```

---

## アクセシビリティ

- VoiceOver / TalkBack 対応表（主要コンポーネント別）
- Dynamic Type / フォントスケーリング
- カラーコントラスト要件（WCAG AA）
- Reduce Motion 対応
- タッチターゲット要件（最小44px）
- フォーカスインジケーター

---

## 開発者ガイド

- 推奨ファイル構造（Tokens/ Theme/ Components/ のサブディレクトリ分類）
- 命名規則（接頭辞ルール）
- コンポーネント作成テンプレート（Environment key対応）
- トークン使用ガイドライン（Do: トークン / Don't: マジックナンバー）
- ダークモード実装パターン
- テスト方法（スナップショットテスト）
- 付録: コンポーネント一覧表（#, Name, Category, Variants, States）
