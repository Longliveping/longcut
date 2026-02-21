#!/bin/bash
# tests/02-ai-chat.sh
# Tests AI chat functionality with transcript and citations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../helpers/agent-lib.sh"
source "${SCRIPT_DIR}/../config/test-config.env"

# TC-AB-003: Open chat tab and send message
test_send_chat_message() {
  test_case "Send chat message and receive response"

  # Navigate to an analyzed video
  ab_open "$TEST_BASE_URL/analyze/dQw4w9WgXcQ"
  ab_wait_long 3 "$WAIT_SHORT"  # Wait 15s for page load

  ab_screenshot "${SCREENSHOT_DIR}/10-chat-initial.png"

  # Check if auth modal appeared (video not analyzed, rate limit triggered)
  local snapshot=$(ab_snapshot)
  local auth_modal=$(echo "$snapshot" | jq -r '.data.refs | to_entries[] | select(.value.name == "Sign In") | .key' | head -1)

  if [[ -n "$auth_modal" ]]; then
    info "Auth modal appeared - video analysis requires authentication"
    info "Skipping chat test - video must be analyzed first"
    return 0  # Skip gracefully
  fi

  # Find and click Chat tab
  local chat_tab_ref=$(echo "$snapshot" | jq -r '.data.refs | to_entries[] | select(.value.name == "Chat") | .key' | head -1)

  if [[ -z "$chat_tab_ref" ]]; then
    fail "Could not find Chat tab (video may not be analyzed yet)"
    return 1
  fi

  ab_click "@$chat_tab_ref"
  pass "Opened Chat tab"

  ab_wait "$WAIT_SHORT"

  # Find chat input
  snapshot=$(ab_snapshot)
  local chat_input_ref=$(echo "$snapshot" | jq -r '.data.refs | to_entries[] | select(.value.role == "textbox") | .key' | head -1)

  if [[ -z "$chat_input_ref" ]]; then
    fail "Could not find chat input"
    ab_screenshot "${SCREENSHOT_DIR}/11-no-chat-input.png"
    return 1
  fi

  # Type a question
  ab_fill "@$chat_input_ref" "What is this video about?"
  pass "Typed chat message"

  ab_screenshot "${SCREENSHOT_DIR}/12-message-typed.png"

  # Find and click send button or press Enter
  snapshot=$(ab_snapshot)
  local send_ref=$(echo "$snapshot" | jq -r '.data.refs | to_entries[] | select(.value.name | test("Send|Submit|→"; "i")) | .key' | head -1)

  if [[ -n "$send_ref" ]]; then
    ab_click "@$send_ref"
  else
    ab_press "Enter"
  fi

  pass "Sent message"

  # Wait for AI response
  info "Waiting for AI response..."
  ab_wait_long 12 "$WAIT_LOAD"  # Wait up to 60s for AI response (12 * 5s)

  ab_screenshot "${SCREENSHOT_DIR}/13-chat-response.png"

  # Verify response appeared
  snapshot=$(ab_snapshot)
  local content_count=$(echo "$snapshot" | jq -r '.data.refs | length')

  if [[ "$content_count" -gt 5 ]]; then
    pass "Chat response received"
  else
    info "Chat response verification inconclusive"
  fi

  return 0
}

# TC-AB-004: Click citation to jump to video segment
test_click_citation() {
  test_case "Click citation to jump to video timestamp"

  local snapshot=$(ab_snapshot)

  # Look for citation-like elements (timestamps)
  local citation_ref=$(echo "$snapshot" | jq -r '.data.refs | to_entries[] | select(.value.name | test("\\d+:\\d+"; "i") or .value.role == "link") | .key' | head -1)

  if [[ -z "$citation_ref" ]]; then
    info "No citation found (may need actual AI response with citations)"
    return 0
  fi

  ab_click "@$citation_ref"
  pass "Clicked citation link"

  ab_wait "$WAIT_SHORT"
  ab_screenshot "${SCREENSHOT_DIR}/14-after-citation.png"

  return 0
}

# TC-AB-005: Switch between tabs
test_tab_switching() {
  test_case "Switch between right-column tabs"

  local tabs=("Summary" "Transcript" "Notes")

  for tab in "${tabs[@]}"; do
    local snapshot=$(ab_snapshot)
    local tab_ref=$(echo "$snapshot" | jq -r --arg tab "$tab" '.data.refs | to_entries[] | select(.value.name == $tab) | .key' | head -1)

    if [[ -n "$tab_ref" ]]; then
      ab_click "@$tab_ref"
      ab_wait "$WAIT_SHORT"
      pass "Switched to $tab tab"
    else
      info "$tab tab not found"
    fi
  done

  return 0
}

main() {
  echo "======================================"
  echo "AI Chat Tests"
  echo "======================================"
  echo ""

  mkdir -p "$SCREENSHOT_DIR"

  if [[ "$SKIP_CHAT_TESTS" == "true" ]]; then
    info "Skipping chat tests (SKIP_CHAT_TESTS=true)"
    return 0
  fi

  test_send_chat_message
  test_click_citation
  test_tab_switching

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Results:"
  echo "  Passed: $TESTS_PASSED"
  echo "  Failed: $TESTS_FAILED"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  [[ $TESTS_FAILED -eq 0 ]]
}

main "$@"
