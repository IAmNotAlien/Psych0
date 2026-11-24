#!/usr/bin/env bash
# ============================================================
# psych0 — post to your den straight from the terminal
# ============================================================
# SETUP (once):
#   export PSYCH0_URL="https://psych0.vercel.app"
#   export PSYCH0_TOKEN="p0k_…"        # create in STUDIO → SETTINGS → API TOKENS
# USAGE:
#   psych0 quick "thought that just happened"          # one-line post
#   psych0 post "TITLE" -b "markdown body"             # body inline
#   echo "long body…" | psych0 post "TITLE"            # body from stdin
#   psych0 post "TITLE" --publish                      # publish now (default: draft)
#   psych0 list                                        # recent public posts
#   psych0 health                                      # backend status
# ============================================================
set -euo pipefail

PSYCH0_URL="${PSYCH0_URL:-}"
PSYCH0_TOKEN="${PSYCH0_TOKEN:-}"

die() { printf 'psych0: %s\n' "$1" >&2; exit 1; }
need_token() { [ -n "$PSYCH0_TOKEN" ] || die "PSYCH0_TOKEN not set — create a token in STUDIO → SETTINGS → API TOKENS"; }
need_url() { [ -n "$PSYCH0_URL" ] || die "PSYCH0_URL not set — e.g. export PSYCH0_URL=https://psych0.vercel.app"; }

usage() {
  grep '^#' "$0" | sed -n '2,16p' | sed 's/^# \{0,2\}//'
  exit 0
}

cmd="${1:-help}"
shift || true

case "$cmd" in
  help|-h) usage ;;
  quick)
    text="${1:-}"
    [ -n "$text" ] || die 'usage: psych0 quick "text"'
    need_url; need_token
    jq -n --arg b "$text" '{title: "FROM THE TERMINAL", body: $b, tags: ["cli"]}' > /tmp/p0payload.json
    ;;
  post)
    title="${1:-}"
    [ -n "$title" ] || die 'usage: psych0 post "TITLE" [-b "body"] [--publish]  (or pipe body via stdin)'
    shift
    body=""; publish="false"
    while [ $# -gt 0 ]; do
      case "$1" in
        -b|--body) body="${2:-}"; shift 2 ;;
        --publish) publish="true"; shift ;;
        *) die "unknown flag: $1" ;;
      esac
    done
    if [ -z "$body" ] && [ ! -t 0 ]; then body="$(cat)"; fi   # body from stdin
    [ -n "$body" ] || die "no body — use -b \"text\", pipe stdin, or type something"
    need_url; need_token
    jq -n --arg t "$title" --arg b "$body" --arg p "$publish" \
      '{title: $t, body: $b, tags: ["cli"], publish: ($p == "true")}' > /tmp/p0payload.json
    ;;
  list)
    need_url
    curl -fsS "$PSYCH0_URL/api/posts" | jq -r '.posts[] | "\(.date)  \(.slug)  \(.title)"' 2>/dev/null \
      || curl -fsS "$PSYCH0_URL/api/posts"
    exit 0 ;;
  health)
    need_url
    curl -fsS "$PSYCH0_URL/api/health" | jq .
    exit 0 ;;
  *) die "unknown command: $cmd — try psych0 help" ;;
esac

res="$(curl -fsS -X POST "$PSYCH0_URL/api/hook" \
  -H "Authorization: Bearer $PSYCH0_TOKEN" \
  -H "Content-Type: application/json" \
  --data @/tmp/p0payload.json)" || die "request failed — check PSYCH0_URL / token"
rm -f /tmp/p0payload.json

echo "$res" | jq -e . >/dev/null 2>&1 || { echo "$res"; exit 0; }
echo "$res" | jq -r '"✔ saved → " + (.url // "?") + (if .published then " (LIVE)" else " (draft — review in the studio)" end)'
