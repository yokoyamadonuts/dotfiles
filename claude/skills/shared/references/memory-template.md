# `.memory.md` テンプレート

各スキルの `claude/skills/<name>/.memory.md` はこの形式に従う。
ファイル自体は gitignore 対象（私的・マシンローカル）。全セクション任意。

下記をコピーして使う（先頭の `---` ブロックは YAML フロントマター）:

    ---
    skill: <skill-name>
    updated: YYYY-MM-DD
    uses: 0
    ---

    ## ⚠️ Failure Modes
    - [YYYY-MM-DD] <何が失敗したか> → <原因と回避策>

    ## 🔧 Input Quirks
    - <特別な前処理が要る入力パターン>

    ## 💡 Tips
    - <結果が改善した非自明な使い方>

    ## ⬆️ Promotion Candidates
    - <普遍的で references/lessons.md へ昇格すべき教訓>
