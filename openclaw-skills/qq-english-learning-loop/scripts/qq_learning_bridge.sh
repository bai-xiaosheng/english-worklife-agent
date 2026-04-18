#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${QQ_LEARNING_BACKEND_URL:-http://host.docker.internal:3000}"
BRIDGE_SECRET="${QQBOT_BRIDGE_SECRET:-}"
SOURCE="${QQ_LEARNING_SOURCE:-qqbot}"

USER_ID=""
DISPLAY_NAME=""
TEXT=""

usage() {
  cat <<'EOF'
Usage:
  qq_learning_bridge.sh --user <id> --text "<message>" [--name "<display_name>"] [--backend <url>] [--source <name>]

Environment:
  QQ_LEARNING_BACKEND_URL   Backend base URL (default: http://host.docker.internal:3000)
  QQBOT_BRIDGE_SECRET       Optional secret for x-bot-secret header
  QQ_LEARNING_SOURCE        Integration source tag (default: qqbot)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user)
      USER_ID="${2:-}"
      shift 2
      ;;
    --name)
      DISPLAY_NAME="${2:-}"
      shift 2
      ;;
    --text)
      TEXT="${2:-}"
      shift 2
      ;;
    --backend)
      BACKEND_URL="${2:-}"
      shift 2
      ;;
    --source)
      SOURCE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$USER_ID" || -z "$TEXT" ]]; then
  echo "Error: --user and --text are required." >&2
  usage
  exit 1
fi

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e ':a;N;$!ba;s/\n/\\n/g'
}

if command -v jq >/dev/null 2>&1; then
  payload="$(jq -n \
    --arg source "$SOURCE" \
    --arg externalUserId "$USER_ID" \
    --arg displayName "$DISPLAY_NAME" \
    --arg text "$TEXT" \
    '{source:$source, externalUserId:$externalUserId, displayName:$displayName, text:$text}')"
else
  payload="$(cat <<JSON
{
  "source": "$(json_escape "$SOURCE")",
  "externalUserId": "$(json_escape "$USER_ID")",
  "displayName": "$(json_escape "$DISPLAY_NAME")",
  "text": "$(json_escape "$TEXT")"
}
JSON
)"
fi

headers=(-H "Content-Type: application/json")
if [[ -n "$BRIDGE_SECRET" ]]; then
  headers+=(-H "x-bot-secret: ${BRIDGE_SECRET}")
fi

resp="$(curl -sS -X POST "${BACKEND_URL}/api/v1/integrations/qqbot/message" "${headers[@]}" -d "$payload")"

if command -v jq >/dev/null 2>&1; then
  echo "$resp" | jq -r '.reply // .error // .message // .'
else
  echo "$resp"
fi
