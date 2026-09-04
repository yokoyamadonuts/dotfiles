#!/bin/bash
# 全 spec を nvim -l で実行する。1つでも落ちたら非ゼロで終了。
cd "$(dirname "$0")" || exit 1
fail=0
for spec in ai/*_spec.lua; do
  echo "== $spec"
  nvim -l "$spec" || fail=1
done
exit $fail
