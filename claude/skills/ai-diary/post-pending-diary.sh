#!/bin/bash
# 1日の終わりに、その日の「下書き(pending)」を日記APIへ投稿する定時ジョブ。
# launchd から毎日 23:30 に実行される。デバイス非依存（$HOME/.config/diary のみ参照）。
#
# 設計: 知能はライブ、投稿は単純。
#   - 日中、Claude(ライブセッション)が素材を受け取り、その日の日記を作文して
#     ~/.config/diary/pending/<YYYY-MM-DD>.json に「POSTボディそのもの」として保存する。
#     例: {"body":"...","title":"...","author":"ai","entry_date":"2026-06-30","categories":["..."]}
#   - このスクリプトはLLM不要。pending をそのまま API に送るだけ。
#   - 素材ゼロの日は pending が無いので何も投稿しない。
#   - 成功したら posted/ へ退避するので二重投稿しない(冪等)。
set -euo pipefail

DIARY_DIR="$HOME/.config/diary"
ENV_FILE="$DIARY_DIR/cron.env"          # DIARY_API_URL / DIARY_TOKEN を定義
PENDING_DIR="$DIARY_DIR/pending"
POSTED_DIR="$DIARY_DIR/posted"
LOG="$DIARY_DIR/cron.log"

mkdir -p "$DIARY_DIR" "$PENDING_DIR" "$POSTED_DIR"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

if [ ! -f "$ENV_FILE" ]; then
  log "cron.env が無いためスキップ ($ENV_FILE)"
  exit 0
fi
# shellcheck disable=SC1090
source "$ENV_FILE"   # provides DIARY_API_URL, DIARY_TOKEN

: "${DIARY_API_URL:?DIARY_API_URL is not set in cron.env}"
: "${DIARY_TOKEN:?DIARY_TOKEN is not set in cron.env}"

TODAY="$(date '+%Y-%m-%d')"
PENDING="$PENDING_DIR/$TODAY.json"

if [ ! -f "$PENDING" ]; then
  log "$TODAY の下書きが無いため投稿なし"
  exit 0
fi

RESP_FILE="$DIARY_DIR/.last_response.json"
HTTP=$(curl -s -o "$RESP_FILE" -w "%{http_code}" \
  -X POST "$DIARY_API_URL/api/entries" \
  -H "Authorization: Bearer $DIARY_TOKEN" \
  -H "content-type: application/json" \
  --data-binary @"$PENDING")

if [ "$HTTP" = "201" ]; then
  mv "$PENDING" "$POSTED_DIR/$TODAY.json"
  log "$TODAY の日記を投稿 (HTTP 201)"
else
  log "$TODAY の投稿に失敗 (HTTP $HTTP) resp=$(cat "$RESP_FILE" 2>/dev/null)"
  exit 1
fi
