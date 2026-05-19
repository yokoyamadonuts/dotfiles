# Coherence-Driven Development (CoDD) リファレンス

VCSDD-lite の核心である Coherence Engine Graph (CEG) の詳細仕様。

## CEG とは

仕様・テスト・実装・検証のノードを頂点、依存関係をエッジとする有向グラフ。frontmatter から自動構築され、変更時の影響範囲をBFSで算出する。

## ノードID命名規則

すべてのCEGノードは `<type>:<slug>` 形式の識別子を持つ。

| プレフィクス | 種別 | 例 |
|---|---|---|
| `req:` | 要件（ビジネスレベル） | `req:user-login`, `req:password-reset` |
| `spec:` | 振る舞い仕様 | `spec:auth-flow`, `spec:session-mgmt` |
| `design:` | 設計成果物（データスキーマ・UI等） | `design:user-schema`, `design:token-store` |
| `test:` | テストスイート（観点単位） | `test:auth-edge-cases`, `test:token-fuzz` |
| `impl:` | 実装モジュール | `impl:auth-service`, `impl:token-validator` |
| `verify:` | 形式検証ハーネス | `verify:prop-token-invariant` |
| `bead:` | トレーサビリティ束 | `bead:B-001-login-flow` |

## frontmatter 完全仕様

`docs/vcsdd/<feature>/specs/*.md` の冒頭：

```yaml
---
id: spec:auth-flow
type: spec
feature: user-auth
coherence:
  depends_on:
    - design:user-schema
  satisfies:
    - req:user-login
  verified_by:
    - test:auth-edge-cases
  beads:
    - bead:B-001-login-flow
confidence: green
status: draft
last_reviewed: 2026-05-19
---
```

### フィールド意味

| フィールド | 必須 | 意味 |
|---|---|---|
| `id` | ✅ | ノードIDの正規形（feature内で一意） |
| `type` | ✅ | `req`/`spec`/`design`/`test`/`impl`/`verify` |
| `feature` | ✅ | フィーチャー名 |
| `coherence.depends_on` | ⚪ | 上流ノード |
| `coherence.satisfies` | ⚪ | このノードが満たす上位要件 |
| `coherence.verified_by` | ⚪ | このノードを検証する下流ノード |
| `coherence.beads` | ⚪ | 所属するtraceabilityバンドル |
| `confidence` | ⚪ | scan結果上書き可能 |
| `status` | ⚪ | レビューゲート通過状態（`draft`/`reviewed`/`locked`） |
| `last_reviewed` | ⚪ | ISO日付 |

## 信頼度バンド判定ルール

scan-scriptが各ノードの `confidence` を以下のルールで自動評価。手動指定（frontmatterの `confidence`）が常に優先される。

| バンド | 条件 |
|---|---|
| 🟢 Green | `type=spec` の場合：`satisfies` ≥1個 かつ `verified_by` ≥1個 かつ全参照解決済み |
| 🟡 Amber | 参照は解決するが束（bead）が不完全 |
| ⚫ Gray | 参照解決エラーあり / orphan / 一切のbead未所属 |

## 整合性違反の種類

`coherence-validate.ts` が検出する問題：

| kind | severity | 説明 |
|---|---|---|
| `missing_reference` | error | 存在しないノードへの参照 |
| `cycle` | error | A→B→...→A の循環依存（depends_onのみ） |
| `orphan` | warning | 誰からも参照されないノード（要件以外） |
| `type_mismatch` | warning | verified_by の to が test/verify でない |
| `incomplete_bead` | info | beadメンバーが req/spec/test/impl/verify を全て含まない |
| `gray_in_locked_spec` | warning | `status:locked` かつ `confidence:gray` |

## 影響伝播 BFS アルゴリズム

`coherence-impact.ts` の擬似コード：

```
inverse_adj = build_inverse_adjacency(graph)
visited = {root}
queue = [(target, "depends_on→...", 1) for each (target, kind) in inverse_adj[root]]

while queue not empty:
  next_layer = []
  for (node, via, depth) in queue:
    if node in visited or depth > maxDepth: continue
    visited.add(node)
    affected[f"depth_{depth}"].append({id: node, via: via, confidence: ...})
    for (incoming, kind) in inverse_adj[node]:
      next_layer.append((incoming, f"{node}→{kind}", depth + 1))
  queue = next_layer
```

**注意**: edge方向は「上流→下流」ではない。**変更ノードに依存する側を遡る**ため、逆BFS。

## 循環検出アルゴリズム

`coherence-validate.ts` は DFS による back-edge 検出を使用：

1. `depends_on` エッジのみで隣接リスト構築（他のkindは循環判定の対象外）
2. 全ノードを起点として visited / recursion-stack を管理しながらDFS
3. 既にスタックに乗っているノードに到達したら循環確定
4. 最初に見つかった循環パスを返却（複数循環があっても1つだけレポート）

## なぜ depends_on のみ循環チェックか

`satisfies` / `verified_by` は意味的にも構造的にも別軸：
- `satisfies`: 多対一（複数のspecが同じreqを満たす）の関係。循環してても矛盾ではない
- `verified_by`: 検証側を指す逆向き。循環は「相互検証」の意味になり得る

`depends_on` のみが「ビルド/参照順序の依存」を表現し、循環があれば本当に壊れる。

## bead identifier

要件→spec→test→impl→verify の全次元を一つの束ねIDで紐付ける概念。

- 単一の bead が `req` / `spec` / `test` / `impl` / `verify` の5タイプを含む場合 `completeness: full`
- いずれか欠落していれば `partial` で `incomplete_bead` issue を生成

トレース時は `--bead` 指定で全メンバーをタイプ別表示、`--req` 指定で関連 spec/test/impl/verify を逆引き表示。

## scan出力 JSON スキーマ

`$schema: vcsdd-lite-coherence-v1` バージョン。詳細は `scripts/_types.ts` を参照。
