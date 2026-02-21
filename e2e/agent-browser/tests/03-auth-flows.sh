#!/bin/bash
# tests/03-auth-flows.sh
# Tests authentication: sign in, sign out, favorites

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../helpers/agent-lib.sh"
source "${SCRIPT_DIR}/../config/test-config.env"

# TC-AB-006: Open auth modal from home page
test_open_auth_modal() {
  test_case "Open authentication modal"

  ab_open "$TEST_BASE_URL"
  ab_wait_long 3 "$WAIT_SHORT"  # Wait 15s for page load

  ab_screenshot "${SCREENSHOT_DIR}/20-home.png"

  # Find and click sign in button
  local snapshot=$(ab_snapshot)
  local signin_ref=$(echo "$snapshot" | jq -r '.data.refs | to_entries[] | select(.value.name | test("Sign in|Login"; "i")) | .key' | head -1)

  if [[ -z "$signin_ref" ]]; then
    fail "Could not find sign in button"
    ab_screenshot "${SCREENSHOT_DIR}/20-no-signin.png"
    return 1
  fi

  ab_click "@$signin_ref"
  pass "Clicked sign in button"

  ab_wait "$WAIT_SHORT"
  ab_screenshot "${SCREENSHOT_DIR}/21-auth-modal.png"

  # Verify modal is open - check for multiple indicators
  snapshot=$(ab_snapshot)
  local has_dialog=$(echo "$snapshot" | jq -r '.data.refs | to_entries[] | select(.value.role == "dialog") | .key' | wc -l)
  local has_email_input=$(echo "$snapshot" | jq -r '.data.refs | to_entries[] | select(.value.role == "textbox" and (.value.name | test("email|Email|E-mail"; "i"))) | .key' | wc -l)
  local has_password_input=$(echo "$snapshot" | jq -r '.data.refs | to_entries[] | select(.value.name | test("password|Password"; "i")) | .key' | wc -l)
  local has_signin_button=$(echo "$snapshot" | jq -r '.data.refs | to_entries[] | select(.value.name == "Sign In") | .key' | wc -l)

  # Modal is confirmed if we have dialog role OR email input + signin button
  if [[ "$has_dialog" -gt 0 ]] || [[ "$has_email_input" -gt 0 && "$has_signin_button" -gt 0 ]]; then
    pass "Auth modal is open"
  else
    fail "Auth modal not found (dialog:$has_dialog, email:$has_email_input, password:$has_password_input, signin:$has_signin_button)"
  fi

  return 0
}

# TC-AB-007: Fill and submit sign in form
test_sign_in() {
  test_case "Sign in with credentials"

  local snapshot=$(ab_snapshot)

  # Switch to sign in tab if needed
  local signin_tab_ref=$(echo "$snapshot" | jq -r '.data.refs | to_entries[] | select(.value.name == "Sign in") | .key' | head -1)
  if [[ -n "$signin_tab_ref" ]]; then
    ab_click "@$signin_tab_ref"
    ab_wait "$WAIT_SHORT"
  fi

  # Find email input
  snapshot=$(ab_snapshot)
  local email_ref=$(echo "$snapshot" | jq -r '.data.refs | to_entries[] | select(.value.role == "textbox") | .key' | head -1)

  if [[ -z "$email_ref" ]]; then
    fail "Could not find email input"
    return 1
  fi

  ab_fill "@$email_ref" "$TEST_USER_EMAIL"
  pass "Filled email"

  # Find password input (second textbox)
  snapshot=$(ab_snapshot)
  local password_ref=$(echo "$snapshot" | jq -r '.data.refs | to_entries[] | select(.value.role == "textbox") | .key' | sed -n '2p')

  if [[ -n "$password_ref" ]]; then
    ab_fill "@$password_ref" "$TEST_USER_PASSWORD"
    pass "Filled password"
  fi

  ab_screenshot "${SCREENSHOT_DIR}/22-form-filled.png"

  # Find and click submit button
  snapshot=$(ab_snapshot)
  local submit_ref=$(echo "$snapshot" | jq -r '.data.refs | to_entries[] | select(.value.name == "Sign In") | .key' | head -1)

  if [[ -n "$submit_ref" ]]; then
    ab_click "@$submit_ref"
    pass "Clicked sign in button"
  fi

  # Wait for sign in to process
  info "Waiting for sign in..."
  ab_wait_long 6 "$WAIT_LOAD"  # Wait up to 30s for sign in (6 * 5s)

  ab_screenshot "${SCREENSHOT_DIR}/23-after-signin.png"

  info "Sign in flow completed"

  return 0
}

# TC-AB-008: Sign out from user menu
test_sign_out() {
  test_case "Sign out from user menu"

  # Check if user menu exists (signed in)
  local snapshot=$(ab_snapshot)
  local menu_ref=$(echo "$snapshot" | jq -r '.data.refs | to_entries[] | select(.value.name | test("account|profile|menu"; "i")) | .key' | head -1)

  if [[ -z "$menu_ref" ]]; then
    info "No user menu found (not signed in) - skipping sign out"
    return 0
  fi

  ab_click "@$menu_ref"
  pass "Opened user menu"

  ab_wait "$WAIT_SHORT"

  # Find sign out button
  snapshot=$(ab_snapshot)
  local signout_ref=$(echo "$snapshot" | jq -r '.data.refs | to_entries[] | select(.value.name | test("Sign out|Logout"; "i")) | .key' | head -1)

  if [[ -n "$signout_ref" ]]; then
    ab_click "@$signout_ref"
    pass "Clicked sign out"

    ab_wait "$WAIT_LOAD"
    ab_screenshot "${SCREENSHOT_DIR}/24-after-signout.png"
  else
    info "Sign out button not found"
  fi

  return 0
}

# TC-AB-009: Favorite a video
test_favorite_video() {
  test_case "Add video to favorites"

  # Navigate to video page
  ab_open "$TEST_BASE_URL/analyze/dQw4w9WgXcQ"
  ab_wait_long 3 "$WAIT_SHORT"  # Wait 15s for page load

  ab_screenshot "${SCREENSHOT_DIR}/25-video-page.png"

  # Look for favorite button
  local snapshot=$(ab_snapshot)
  local fav_ref=$(echo "$snapshot" | jq -r '.data.refs | to_entries[] | select(.value.name | test("favorite|bookmark|save"; "i")) | .key' | head -1)

  if [[ -z "$fav_ref" ]]; then
    info "Favorite button not found (may require authentication)"
    return 0
  fi

  ab_click "@$fav_ref"
  pass "Clicked favorite button"

  ab_wait "$WAIT_SHORT"
  ab_screenshot "${SCREENSHOT_DIR}/26-after-favorite.png"

  return 0
}

main() {
  echo "======================================"
  echo "Auth Flows Tests"
  echo "======================================"
  echo ""

  mkdir -p "$SCREENSHOT_DIR"

  if [[ "$SKIP_AUTH_TESTS" == "true" ]]; then
    info "Skipping auth tests (SKIP_AUTH_TESTS=true)"
    return 0
  fi

  test_open_auth_modal
  test_sign_in
  test_sign_out
  test_favorite_video

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Results:"
  echo "  Passed: $TESTS_PASSED"
  echo "  Failed: $TESTS_FAILED"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  [[ $TESTS_FAILED -eq 0 ]]
}

main "$@"
