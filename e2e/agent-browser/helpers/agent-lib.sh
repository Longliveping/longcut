#!/bin/bash
# helpers/agent-lib.sh
# Core reusable functions for agent-browser tests

# Colors for output
readonly GREEN='\033[0;32m'
readonly RED='\033[0;31m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Core agent-browser wrappers
ab_open() {
  agent-browser open "$1" ${HEADLESS:+--headed $HEADLESS}
}

ab_snapshot() {
  agent-browser snapshot -i --json
}

ab_click() {
  agent-browser click "$1"
}

ab_fill() {
  agent-browser fill "$1" "$2"
}

ab_wait() {
  agent-browser wait "$1"
}

ab_screenshot() {
  local path="$1"
  mkdir -p "$(dirname "$path")"
  agent-browser screenshot "$path"
}

ab_close() {
  agent-browser close 2>/dev/null || true
}

ab_press() {
  agent-browser press "$1"
}

# Assertions
assert_visible() {
  local ref="$1"
  local msg="${2:-Element $ref should be visible}"

  if ab_snapshot | grep -q "\"ref\":\"$ref\""; then
    pass "$msg"
    return 0
  else
    fail "$msg"
    return 1
  fi
}

assert_text_contains() {
  local ref="$1"
  local expected="$2"
  local msg="${3:-Text should contain: $expected}"

  local text=$(agent-browser get text "$ref" 2>/dev/null || echo "")
  if echo "$text" | grep -qi "$expected"; then
    pass "$msg"
    return 0
  else
    fail "$msg (got: $text)"
    return 1
  fi
}

assert_url_contains() {
  local expected="$1"
  local msg="${2:-URL should contain: $expected}"

  local url=$(agent-browser get url 2>/dev/null | jq -r '.data' 2>/dev/null || echo "")
  if [[ "$url" == *"$expected"* ]]; then
    pass "$msg"
    return 0
  else
    fail "$msg (got: $url)"
    return 1
  fi
}

# Test helpers
pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((TESTS_PASSED++)) || true
}

fail() {
  echo -e "${RED}✗${NC} $1"
  ((TESTS_FAILED++)) || true
}

info() {
  echo -e "${YELLOW}→${NC} $1"
}

test_case() {
  local name="$1"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  info "TEST: $name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Cleanup on exit
cleanup() {
  info "Closing browser..."
  ab_close
}

trap cleanup EXIT
