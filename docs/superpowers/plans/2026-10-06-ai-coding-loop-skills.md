# AI Coding Loop Skills — Implementation Plan

> **For agentic workers:** This plan was executed in a single autonomous session. Steps use checkbox (`- [ ]`) syntax; RED/GREEN observations are recorded in §Results so the next refinement (`/refine-skill`) starts from evidence, not memory.

**Goal:** Align the dotfiles skill set with mizchi's "俺のAIプログラミング手法 (2026/10/05)": add the missing loop-design and exploration skills, vendor the formal-methods skill the article names, and apply the article's criteria (C1–C5) as an audit of existing skills.

**Spec:** `docs/superpowers/specs/2026-10-06-ai-coding-loop-skills-design.md`

**Testing discipline:** `superpowers:writing-skills` (RED baseline without the skill → GREEN with the skill) for the two original skills; `validate-skill --all` + `catalog-skills` for the whole set; `diff` against upstream for the vendored skill.

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `claude/skills/designing-ai-loop/SKILL.md` | NEW: loop design workflow (考える順番 → 指標 → 停止 → エスカレーション → 失敗分類) |
| `claude/skills/designing-ai-loop/references/metrics-catalog.md` | NEW: metric catalog (determinism, CI cost, measurement commands) |
| `claude/skills/exploring-improvements/SKILL.md` | NEW: perspective-driven exploration → Umbrella Issue |
| `claude/skills/formal-methods-reconciler/` | NEW (vendored): SKILL.md (= upstream SKILL-ja.md + provenance) + references/ ×4 |
| `claude/skills/vcsdd-lite/SKILL.md`, `references/output-templates.md` | MODIFY: templates moved out (≤500 lines), Phase 5 row, related skills |
| `claude/skills/ship-check/SKILL.md` | MODIFY: fix dangling `designing-refactoring`, add exploring-improvements |
| `claude/skills/{plan-first,takt-orchestration,developing}/SKILL.md` | MODIFY: cross-reference designing-ai-loop |
| `claude/skills/reviewing-skills/references/best-practices.md` | MODIFY: §9 Loop-Readiness と Unlearning (C1–C5) |
| `CLAUDE.md` | MODIFY: ループ系スキルの使い分け |

---

## Task 1: Vendor `formal-methods-reconciler`

- [x] Pin upstream `mizchi/skills` main SHA; fetch `SKILL-ja.md` + `references/*.md`
- [x] Write `SKILL.md` = frontmatter + provenance comment + upstream body; copy references verbatim
- [x] Verify: body after provenance `diff`-identical to upstream; references `cmp` identical

## Task 2: Audit fixes on existing skills

- [x] `vcsdd-lite`: move 仕様書/レビューレポート templates to `references/output-templates.md`; add Phase 5 形式モデル化 row; related skills
- [x] `ship-check`: replace `designing-refactoring` (non-existent) with `/techdebt`; add `exploring-improvements`
- [x] `best-practices.md`: add §9 (C1 数値化 / C2 ペルソナより視点 / C3 既知知識 / C4 失敗分類 / C5 鮮度)
- [x] `plan-first` / `takt-orchestration` / `developing`: cross-references
- [x] `CLAUDE.md`: ループ系スキルの使い分け
- [x] `claude-real-video` C2 (reserved word in name): recorded as deferred in spec §5.4

## Task 3: RED baselines (no skill)

- [x] Scenario A (loop design, fictional `acme-cli`): subagent writes `scratchpad/red-A.md`, reports sections + discretionary fill-ins
- [x] Scenario B (exploration + Umbrella Issue, fictional `acme-api`): subagent writes `scratchpad/red-B.md`
- [x] Record gaps in §Results

## Task 4: `designing-ai-loop` (GREEN)

- [x] Write SKILL.md addressing the Scenario A gaps; ≤300 lines (138)
- [x] Write `references/metrics-catalog.md` (88 lines)
- [x] `validate-skill designing-ai-loop` → PASS
- [x] GREEN run: fresh subagent + skill on Scenario A → `scratchpad/green-A.md`; compare with RED (REFACTOR applied, re-validated PASS)

## Task 5: `exploring-improvements` (GREEN)

- [x] Write SKILL.md addressing the Scenario B gaps; ≤250 lines (137)
- [x] `validate-skill exploring-improvements` → PASS
- [x] GREEN run: fresh subagent + skill on Scenario B → `scratchpad/green-B.md`; compare with RED (REFACTOR applied, re-validated PASS)

## Task 6: Final verification

- [x] `validate-skill --all`: Critical only the pre-existing `claude-real-video` C2 (plus pre-existing W1 on figma-design-ops / zundamon-video)
- [x] `catalog-skills`: `vcsdd-lite` 491 lines `ok`; designing-ai-loop / exploring-improvements / formal-methods-reconciler `ok`
- [x] Every skill name mentioned in a 関連スキル section exists under `claude/skills/` (or commands/agents)
- [x] `git status` shows only intended files; no commit (user confirms via `/commit`)

---

## Results

### RED (baseline without skill)

**Scenario B — exploration (`red-B.md`, 1,180 lines / 69 KB, 12 min, 2 tool uses).** The baseline was thorough but the *shape* was wrong for the article's loop:

| Observed | Article's expectation | Gap class |
|----------|----------------------|-----------|
| 16 issue drafts written before any exploration (10 "起票できる" + 5 conditional + tracking), contradicting its own principle "根拠なし Issue 禁止" | Findings first; one Umbrella Issue filled from evidence | wrong shape |
| Themes chosen from "既知の不満" + generic checklists; no "誰にとって・何の数値" declared up front | 視点 = who + which number, declared before exploring | missing element |
| Ends with a 3-lane human 着手順; no handoff to /goal / ralph-loop | Umbrella Issue → loop consumes top-down | missing element |
| "専門内は精査 / 専門外はレビューへ" absent | present in article | missing element |
| Safety: read-only + spike branch stated; no sandbox rule for attack/load probes | Docker/sandbox, localhost-only for penetration | partial |
| 3 person-day plan, labels/colour scheme, bulk `gh` script | lightweight: declare 視点 → delegate → one Issue | over-production |

Form chosen for the skill: **output recipe** (what the deliverable IS: 視点と指標 3 行 → 発見ログ列 → 1 Umbrella Issue template → ループへの受け渡し) plus a short 赤信号 table for the observed shape failures. No prohibition list.

**Scenario A — loop design (`red-A.md`, 899 lines / 62 KB, 23 min, 14 tool uses).** The baseline designed a complete nightly platform (launchd plist, `run.sh`, `gate.sh`, allow/deny `settings.json`, fine-grained PAT, CI re-verification workflow, 5-phase rollout, 8-week targets, budgets) before running the loop once.

| Observed | Article's expectation | Gap class |
|----------|----------------------|-----------|
| No "AI に任せられるか / ブロッカー" step; starts from "automate everything" | 委譲判定 is step 1 | missing element |
| 5 goals (G1–G5) in parallel with 8-week targets; no trade-off priority | 主指標 1 + ガード ≤2, explicit priority, "やらないこと" | wrong shape |
| Gates on wall-clock: hyperfine mean +5 %, test wall time +10 % | deterministic metrics (RSS / counts); wall-clock not a CI gate | anti-pattern |
| No 試走 (一度やらせて観察); Phase 0 staged rollout instead | run once, record what worked / didn't, then automate | missing element |
| 12 failure modes classified by symptom, each with its own mechanism | 3 causes: コンテキスト / 権限 / 性能, each with its remedy | wrong shape |
| Escalation expressed only as hard deny lists (Terraform, release.sh) | deny + "着手せず報告" path to a human | partial |
| Invented CLI flags for similarity / cccc / Vitest (self-flagged) | metrics catalog with checked invocations | missing reference |
| Good: metrics are numeric with commands; completion-promise used; morning review as the human gate | — | kept |

Form chosen: **recipe** (考える順番 as 6 steps → fixed `docs/loops/<name>.md` template ≤100 lines → 起動表) plus 赤信号 table. Infrastructure is explicitly "the loop's first task, not the design".

### GREEN (with skill)

**Scenario B (`green-B.md`, 441 lines / 29 KB, 6.5 min, 3 tool uses).** Followed the recipe: one 視点 (SRE / 可観測性) with the 3-line declaration, safety-boundary table, 7-column findings log in every prompt, **one** Umbrella Issue whose 発見 section is left empty (no fabricated `path:line`) and whose 未検証 section carries the known complaints with measurement steps, and a ループへの受け渡し block (targets, stop condition, escalation, `ralph-loop` command). Follow-up perspectives queued as 3-line declarations without issues. Reported 12 discretionary fills; 5 were skill gaps and were folded back (REFACTOR): perspective ordering when complaints span several 視点, priority scale, findings-log location, parallel split unit, `exploration` label creation, and 保守性 metrics for test gaps.

**Scenario A (`green-A.md`, 61 lines / 8 KB, 5 min, 5 tool uses).** Followed the 6-step recipe: 委譲判定 in one line with conditions; 主指標 1 (ESLint warning 数, measured with `--no-inline-config` to close the `eslint-disable` loophole) + ガード 2 (test pass count, max RSS as "前回比 +5 % 以内"); priority line, CI budget, やらないこと; 試走 1/2 defined with an empty results table and `___` baselines (no fabricated numbers); stop condition with a completion-promise; escalation as deny **and** "着手せず報告"; failures folded into コンテキスト / 権限 / 性能; infrastructure (deny settings, rules file, cron) pushed into the Issue as first tasks; manual start for the first two nights. Reported 6 skill gaps, all folded back (REFACTOR): draft-before-試走 allowed but marked 草稿, completion-promise semantics, "ガード違反で破棄が 2 回連続" wording, state kept in the Issue checklist with 1 iteration = 1 item = 1 PR, manual start before scheduling, and two generalizable escalation items (metric-touching config, test skip/delete/snapshot).

| | RED-A | GREEN-A | RED-B | GREEN-B |
|---|---|---|---|---|
| Size | 899 lines | 61 lines | 1,180 lines | 441 lines |
| Wall time | 23 min | 5 min | 12 min | 6.5 min |
| 委譲判定 / 視点宣言 | absent | present | absent | present |
| Metric shape | 5 goals, wall-clock gates | 1 + 2 guards, deterministic | — | 3 metrics with current value or measurement |
| Failure handling | 12 symptoms | 3 causes | — | — |
| Issue shape | — | — | 16 drafts pre-exploration | 1 Umbrella, findings empty until measured |
| Loop handoff | ralph-loop inside a custom platform | ralph-loop command + Issue as state | none (human lanes) | designing-ai-loop + ralph-loop |

### Catalog overlap candidates (advisory, judged)

`catalog-skills` flags the new skills against `developing`, `takt-orchestration`, `qa-testing`, `ship-check`, `creating-rules` and each other on shared vocabulary (ループ / テスト / セキュリティ / issue). The overlap is in vocabulary, not role: each pair's boundary is written in the 関連スキル section of both skills and in the CLAUDE.md ループ系 table (input → design → execution; 監査 vs 探索). No merge.

### Deferred (from the audit)

- `claude-real-video` C2 reserved-word name (vendored product name) — spec §5.4
- Description batch rewrite for 名乗り型 descriptions (4 design skills) — spec §2.3
- Node.js 18 requirement lines in 4 skills (article assumes Node 24+) — spec §2.3
- `figma-design-ops` / `zundamon-video` W1 (>500 lines) — `/refine-skill`
