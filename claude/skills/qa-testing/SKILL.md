---
name: qa-testing
description: Chrome DevTools MCP を活用した Web アプリケーションの QA 検証を実行します。スモークテスト、クリティカルパス、レスポンシブ、OGP/メタタグ、アクセシビリティ、セキュリティの6フェーズで包括的に検証し、不具合を GitHub Issue として起票します。「QA して」「本番検証」「テスト実行」などのリクエストで起動。
---

# QA Testing Skill

## 概要

Chrome DevTools MCP ツールを活用し、Web アプリケーションの品質を6フェーズで包括的に検証する。
各フェーズでスクリーンショット撮影、コンソールエラー確認、ネットワークリクエスト検査を行い、
発見した不具合は GitHub Issue として起票する。

## 前提条件

- Chrome DevTools MCP サーバーが接続済みであること
- 対象 URL が決まっていること
- `gh` CLI が認証済みであること（Issue 起票用）

## 入力

ユーザーから以下を確認する（AskUserQuestion で）:

1. **対象 URL**: 検証対象の Web アプリケーション URL
2. **検証スコープ**: 全フェーズ or 特定フェーズのみ
3. **ビューポート**: デフォルト（モバイル/タブレット/デスクトップ）or カスタム
4. **Issue 起票先**: GitHub リポジトリ（例: `owner/repo`）

## ワークフロー

### Phase 1: スモークテスト

主要ページが正常に読み込まれることを確認する。

```
手順:
1. 各ページに navigate_page で遷移
2. take_snapshot でページ構造を確認
3. take_screenshot でビジュアル保存
4. list_console_messages で JS エラーを確認
5. list_network_requests で 4xx/5xx エラーを確認
```

**チェック項目**:
- [ ] トップページ（`/`）が読み込まれる
- [ ] 主要ページが HTTP 200 を返す
- [ ] コンソールに Error レベルのメッセージがない
- [ ] ネットワークリクエストに 4xx/5xx がない
- [ ] ページタイトルが正しく設定されている

### Phase 2: クリティカルパス検証

ユーザーの主要フローが動作することを確認する。

```
手順:
1. navigate_page でフロー開始ページへ遷移
2. take_snapshot で UI 要素を確認
3. fill / click で操作を実行
4. wait_for で遷移完了を確認
5. 各ステップで take_screenshot を保存
6. list_console_messages / list_network_requests で異常確認
```

**チェック項目**:
- [ ] ログインフローが完了する
- [ ] 新規登録フローが完了する
- [ ] 主要機能の CRUD が動作する
- [ ] ナビゲーションが正しく機能する
- [ ] フォームバリデーションが動作する

### Phase 3: レスポンシブ検証

複数のビューポートサイズで表示を確認する。

```
ビューポート定義:
- mobile:  { width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }
- tablet:  { width: 768, height: 1024, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
- desktop: { width: 1440, height: 900, deviceScaleFactor: 1 }

手順:
1. emulate で各ビューポートを設定
2. navigate_page で対象ページへ遷移
3. take_screenshot で各サイズの表示を保存
4. take_snapshot で要素の重なり・はみ出しを確認
```

**チェック項目**:
- [ ] モバイルで横スクロールが発生しない
- [ ] タッチターゲットが 44px 以上
- [ ] テキストが読みやすいサイズ
- [ ] ナビゲーションがモバイル対応
- [ ] 画像がビューポートに収まる

### Phase 4: OGP / メタタグ検証

SNS シェア時の表示を確認する。

```
手順:
1. navigate_page で対象ページへ遷移
2. evaluate_script で meta タグを抽出:
   () => {
     const metas = document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"], meta[name="viewport"]');
     return Array.from(metas).map(m => ({
       property: m.getAttribute('property') || m.getAttribute('name'),
       content: m.getAttribute('content')
     }));
   }
3. og:image URL にアクセスして画像が存在するか確認
```

**チェック項目**:
- [ ] `og:title` が設定されている
- [ ] `og:description` が設定されている
- [ ] `og:image` が設定され、画像が存在する
- [ ] `og:url` が正しい
- [ ] `twitter:card` が設定されている
- [ ] `viewport` メタタグが正しい
- [ ] `lang` 属性が設定されている

### Phase 5: アクセシビリティ検証

基本的なアクセシビリティ要件を確認する。

```
手順:
1. navigate_page で対象ページへ遷移
2. take_snapshot(verbose=true) でアクセシビリティツリーを取得
3. evaluate_script で見出し階層を確認:
   () => {
     const headings = document.querySelectorAll('h1,h2,h3,h4,h5,h6');
     return Array.from(headings).map(h => ({ level: h.tagName, text: h.textContent?.trim() }));
   }
4. evaluate_script でフォームラベルを確認:
   () => {
     const inputs = document.querySelectorAll('input,select,textarea');
     return Array.from(inputs).map(i => ({
       type: i.type, name: i.name,
       hasLabel: !!i.labels?.length || !!i.getAttribute('aria-label') || !!i.getAttribute('aria-labelledby')
     }));
   }
```

**チェック項目**:
- [ ] `lang` 属性が `<html>` に設定されている
- [ ] 見出し階層がスキップしていない（h1 → h3 等）
- [ ] フォーム入力にラベルが紐づいている
- [ ] 画像に alt テキストがある
- [ ] フォーカス可能な要素にフォーカスリングがある
- [ ] カラーコントラストが十分

### Phase 6: セキュリティ基本チェック

基本的なセキュリティヘッダーと設定を確認する。

```
手順:
1. list_network_requests でメインドキュメントのリクエストを取得
2. get_network_request でレスポンスヘッダーを確認
3. evaluate_script でページ上の機密情報露出を確認:
   () => {
     const scripts = document.querySelectorAll('script');
     const patterns = [/api[_-]?key/i, /secret/i, /password/i, /token/i];
     return Array.from(scripts).filter(s =>
       patterns.some(p => p.test(s.textContent || ''))
     ).map(s => s.textContent?.substring(0, 200));
   }
```

**チェック項目**:
- [ ] HTTPS が強制されている（HTTP → HTTPS リダイレクト）
- [ ] `Strict-Transport-Security` ヘッダーが存在
- [ ] `X-Content-Type-Options: nosniff` が存在
- [ ] `X-Frame-Options` が設定されている
- [ ] API キーがフロントエンドソースに直接露出していない
- [ ] Cookie に `Secure` / `HttpOnly` フラグがある

## 不具合 Issue テンプレート

発見した不具合は以下の形式で `gh issue create` する:

```bash
gh issue create \
  --title "不具合の簡潔な説明" \
  --label "bug" \
  --body "$(cat <<'EOF'
## 環境
- URL: {対象URL}
- ビューポート: {サイズ}
- ブラウザ: Chrome (DevTools MCP)
- 検証日: {日付}

## 再現手順
1. {ステップ1}
2. {ステップ2}
3. ...

## 期待動作
{期待される動作}

## 実際の動作
{実際に起こった動作}

## スクリーンショット
{スクリーンショットがあれば添付}

## 追加情報
- QA Phase: {フェーズ名}
- コンソールエラー: {あれば記載}
- ネットワークエラー: {あれば記載}
EOF
)"
```

## 出力

QA 完了後、以下のサマリーを出力する:

```
# QA 検証サマリー

## 検証対象
- URL: {URL}
- 日時: {日時}
- ブランチ: {ブランチ名}

## 結果

| Phase | 状態 | 発見事項 |
|-------|------|---------|
| 1. スモークテスト | PASS/FAIL | ... |
| 2. クリティカルパス | PASS/FAIL | ... |
| 3. レスポンシブ | PASS/FAIL | ... |
| 4. OGP/メタタグ | PASS/FAIL | ... |
| 5. アクセシビリティ | PASS/FAIL | ... |
| 6. セキュリティ | PASS/FAIL | ... |

## 起票した Issue
- #XX: {タイトル}
- #YY: {タイトル}

## 総合判定
{PASS / CONDITIONAL PASS / FAIL}
```
