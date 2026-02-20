#!/bin/bash
# run-all.sh - Run all agent-browser tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Source config
source "config/test-config.env"

# Overall counters
OVERALL_PASSED=0
OVERALL_FAILED=0
OVERALL_TESTS=0

echo "╔════════════════════════════════════════╗"
echo "║   Agent-Browser E2E Test Suite        ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Configuration:"
echo "  Base URL: $TEST_BASE_URL"
echo "  Headed mode: ${HEADLESS:-yes (visible)}"
echo ""

# Run each test file
for test_file in tests/*.sh; do
  if [[ -f "$test_file" ]]; then
    TEST_NAME=$(basename "$test_file")

    echo ""
    echo "▶ Running: $TEST_NAME"
    echo "────────────────────────────────────────"

    # Run test and capture exit code
    if bash "$test_file"; then
      ((OVERALL_PASSED++)) || true
    else
      ((OVERALL_FAILED++)) || true
    fi
    ((OVERALL_TESTS++)) || true
  fi
done

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   Overall Results                      ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "  Test suites run:  $OVERALL_TESTS"
echo "  Suites passed:    $OVERALL_PASSED"
echo "  Suites failed:    $OVERALL_FAILED"
echo ""

if [[ $OVERALL_FAILED -eq 0 ]]; then
  echo -e "${GREEN}✓ All test suites passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ $OVERALL_FAILED test suite(s) failed${NC}"
  exit 1
fi
