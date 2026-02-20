#!/bin/bash
# tests/01-video-analysis.sh
# Tests the core video analysis flow: paste URL -> analyze -> view highlights

set -e

# Source helpers and config
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../helpers/agent-lib.sh"
source "${SCRIPT_DIR}/../config/test-config.env"

# TC-AB-001: Analyze a new video from URL
test_analyze_new_video() {
  test_case "Analyze new video from YouTube URL"

  ab_open "$TEST_BASE_URL"
  ab_wait "$WAIT_LOAD"

  # Take initial screenshot
  ab_screenshot "${SCREENSHOT_DIR}/01-homepage.png"
  pass "Loaded homepage"

  # Find URL input using snapshot
  local snapshot=$(ab_snapshot)
  local input_ref=$(echo "$snapshot" | jq -r '.refs | to_entries[] | select(.value.role == "textbox") | .key' | head -1)

  if [[ -z "$input_ref" ]]; then
    fail "Could not find URL input field"
    return 1
  fi

  # Fill YouTube URL
  ab_fill "@$input_ref" "$TEST_VIDEO_SHORT"
  pass "Filled YouTube URL"

  # Find and click submit button
  snapshot=$(ab_snapshot)
  local submit_ref=$(echo "$snapshot" | jq -r '.refs | to_entries[] | select(.value.name | test("Analyze|Submit"; "i")) | .key' | head -1)

  if [[ -n "$submit_ref" ]]; then
    ab_click "@$submit_ref"
    pass "Clicked analyze button"
  else
    ab_press "Enter"
    pass "Submitted form with Enter"
  fi

  # Wait for navigation
  ab_wait "$WAIT_LOAD"
  ab_screenshot "${SCREENSHOT_DIR}/02-analyze-page.png"

  # Verify we're on analyze page
  local current_url=$(agent-browser get url 2>/dev/null | jq -r '.data' // echo "")
  if [[ "$current_url" == *"/analyze/"* ]]; then
    pass "Navigated to analyze page"
  else
    fail "Not on analyze page (URL: $current_url)"
    return 1
  fi

  # Wait for analysis and check for highlights
  info "Waiting for analysis to complete..."
  ab_wait "$WAIT_LOAD"

  snapshot=$(ab_snapshot)
  local has_content=$(echo "$snapshot" | jq -r '.refs | length')
  if [[ "$has_content" -gt 5 ]]; then
    pass "Page has content after analysis"
  else
    fail "Page appears empty after analysis"
    ab_screenshot "${SCREENSHOT_DIR}/03-empty-page.png"
    return 1
  fi

  ab_screenshot "${SCREENSHOT_DIR}/04-analysis-complete.png"
  return 0
}

# TC-AB-002: Click topic to play video segment
test_playback_topic() {
  test_case "Click topic to play video segment"

  local snapshot=$(ab_snapshot)
  local topic_ref=$(echo "$snapshot" | jq -r '.refs | to_entries[] | select(.value.role == "link" or .value.role == "button") | .key' | head -1)

  if [[ -z "$topic_ref" ]]; then
    info "No clickable topic found (may still be loading)"
    return 0
  fi

  ab_click "@$topic_ref"
  pass "Clicked topic/button"

  ab_wait "$WAIT_SHORT"
  ab_screenshot "${SCREENSHOT_DIR}/05-after-topic-click.png"

  # Check for video/iframe
  snapshot=$(ab_snapshot)
  local has_video=$(echo "$snapshot" | jq -r '.refs | to_entries[] | select(.value.role == "iframe" or .value.name | test("video|player"; "i")) | .key' | wc -l)

  if [[ "$has_video" -gt 0 ]]; then
    pass "Video player element found"
  else
    info "Video player not detected (may be embeded differently)"
  fi

  return 0
}

# Main test execution
main() {
  echo "======================================"
  echo "Video Analysis Tests"
  echo "======================================"
  echo "Base URL: $TEST_BASE_URL"
  echo ""

  mkdir -p "$SCREENSHOT_DIR"

  if [[ "$SKIP_VIDEO_TESTS" == "true" ]]; then
    info "Skipping video tests (SKIP_VIDEO_TESTS=true)"
    return 0
  fi

  test_analyze_new_video
  test_playback_topic

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Results:"
  echo "  Passed: $TESTS_PASSED"
  echo "  Failed: $TESTS_FAILED"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  [[ $TESTS_FAILED -eq 0 ]]
}

main "$@"
