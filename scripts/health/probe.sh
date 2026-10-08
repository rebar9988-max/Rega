#!/usr/bin/env bash
# Shared HTTP probe for .github/workflows/production-health.yml (read-only; sourced, not executed).
#
#   probe <expected-status> <url> [extra curl args...]
#
# Retries at most PROBE_ATTEMPTS times, and only for transient failures: transport errors (000) and 5xx.
# A deterministic mismatch (e.g. 200 where 401 was expected, or a 4xx) fails immediately. Every retry is logged
# together with the layer that answered (server, cf-ray, Cloudflare error code), and the first error is kept so a
# recovery never hides that the route failed. Results: PROBE_CODE, PROBE_ATTEMPT, PROBE_FIRST_ERROR,
# and the last response in $PROBE_BODY / $PROBE_HEADERS.
PROBE_ATTEMPTS=${PROBE_ATTEMPTS:-3}
PROBE_UA=${PROBE_UA:-"rega-ci-smoke-test/1.0 (+github-actions)"}
PROBE_BODY=${PROBE_BODY:-$(mktemp)}
PROBE_HEADERS=${PROBE_HEADERS:-$(mktemp)}
PROBE_RETRIES_LOG=${PROBE_RETRIES_LOG:-${RUNNER_TEMP:-/tmp}/probe-retries.log}

probe_describe() { # one line naming the layer that answered the last response
  local server ray cferr ctype snippet
  server=$(grep -i '^server:' "$PROBE_HEADERS" | tail -1 | tr -d '\r' | cut -d' ' -f2-)
  ray=$(grep -i '^cf-ray:' "$PROBE_HEADERS" | tail -1 | tr -d '\r' | cut -d' ' -f2-)
  ctype=$(grep -i '^content-type:' "$PROBE_HEADERS" | tail -1 | tr -d '\r' | cut -d' ' -f2-)
  # Cloudflare's own error pages name their code ("error code: 1102", "Error 1102"); the app's JSON names its own.
  cferr=$(grep -oiE '(error code:? ?|Error )1[0-9]{3}' "$PROBE_BODY" 2>/dev/null | head -1)
  snippet=$(head -c 160 "$PROBE_BODY" 2>/dev/null | tr -d '\r\n' | tr -s ' ')
  printf 'server=%s cf-ray=%s content-type=%s cf-error=%s body=%q' "${server:-?}" "${ray:-?}" "${ctype:-?}" "${cferr:-none}" "$snippet"
}

probe() {
  local expected=$1 url=$2; shift 2
  PROBE_FIRST_ERROR=""
  for PROBE_ATTEMPT in $(seq 1 "$PROBE_ATTEMPTS"); do
    : > "$PROBE_BODY"; : > "$PROBE_HEADERS"
    PROBE_CODE=$(curl -sS -m 25 -A "$PROBE_UA" -D "$PROBE_HEADERS" -o "$PROBE_BODY" -w '%{http_code}' "$@" "$url" 2>/dev/null) || PROBE_CODE=000
    [ "$PROBE_CODE" = "$expected" ] && break
    case "$PROBE_CODE" in
      000|5??)
        local detail; detail="HTTP $PROBE_CODE $(probe_describe)"
        [ -z "$PROBE_FIRST_ERROR" ] && PROBE_FIRST_ERROR="$detail"
        if [ "$PROBE_ATTEMPT" -lt "$PROBE_ATTEMPTS" ]; then
          echo "retry $PROBE_ATTEMPT/$PROBE_ATTEMPTS $url -> $detail" | tee -a "$PROBE_RETRIES_LOG"
          sleep $((PROBE_ATTEMPT * 3))
        fi ;;
      *) break ;;
    esac
  done
  if [ "$PROBE_CODE" = "$expected" ] && [ -n "$PROBE_FIRST_ERROR" ]; then
    echo "::warning::$url recovered after $PROBE_ATTEMPT attempt(s); first error: $PROBE_FIRST_ERROR"
  fi
  [ "$PROBE_CODE" = "$expected" ]
}

# probe_fail <label> — standard failure line with the original and the final error.
probe_fail() {
  echo "::error::FAIL $1 -> HTTP $PROBE_CODE (expected $2) after $PROBE_ATTEMPT attempt(s); $(probe_describe)${PROBE_FIRST_ERROR:+; first error: $PROBE_FIRST_ERROR}"
}
