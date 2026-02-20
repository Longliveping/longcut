# Agent-Browser E2E Tests

AI-powered browser automation tests using [agent-browser](https://github.com/vercel-labs/agent-browser).

## About

This test suite complements the existing Playwright E2E tests by using agent-browser's unique **snapshot + reference pattern**. Instead of CSS selectors, elements are identified by AI-friendly references (`@e1`, `@e2`, etc.) generated from accessibility trees.

## Prerequisites

1. **Install agent-browser:**
   ```bash
   npm install -g agent-browser
   agent-browser install
   ```

2. **Install jq** (for JSON parsing):
   ```bash
   # macOS
   brew install jq

   # Linux
   sudo apt-get install jq
   ```

3. **Start dev server:**
   ```bash
   npm run dev
   ```

## Configuration

Copy the example config and add your credentials:

```bash
cp config/test-config.env config/test-config.local.env
# Edit test-config.local.env with your values
```

Environment variables (with defaults):

| Variable | Default | Description |
|----------|---------|-------------|
| `TEST_BASE_URL` | `http://localhost:3000` | App URL |
| `TEST_USER_EMAIL` | `test@example.com` | Test user email |
| `TEST_USER_PASSWORD` | `TestPass123!` | Test user password |
| `SCREENSHOT_DIR` | `./test-results/agent-browser/screenshots` | Screenshot path |
| `SKIP_AUTH_TESTS` | `false` | Skip auth tests |
| `SKIP_VIDEO_TESTS` | `false` | Skip video tests |
| `SKIP_CHAT_TESTS` | `false` | Skip chat tests |

## Running Tests

Run all tests:
```bash
cd e2e/agent-browser
./run-all.sh
```

Run individual test:
```bash
./tests/01-video-analysis.sh
./tests/02-ai-chat.sh
./tests/03-auth-flows.sh
```

With overrides:
```bash
SKIP_AUTH_TESTS=true ./tests/03-auth-flows.sh
TEST_BASE_URL=http://localhost:3000 ./tests/01-video-analysis.sh
```

## Test Coverage

| ID | Test | Description |
|----|------|-------------|
| TC-AB-001 | Video Analysis | Paste URL → analyze → view highlights |
| TC-AB-002 | Playback | Click topic to play segment |
| TC-AB-003 | Chat | Send message, receive response |
| TC-AB-004 | Citations | Click citation to jump video |
| TC-AB-005 | Tabs | Switch between Summary/Transcript/Notes |
| TC-AB-006 | Auth Modal | Open sign in modal |
| TC-AB-007 | Sign In | Fill and submit credentials |
| TC-AB-008 | Sign Out | Sign out from menu |
| TC-AB-009 | Favorites | Add video to favorites |

## Artifacts

Screenshots are saved to `test-results/agent-browser/screenshots/` for debugging failed tests.

## How It Works

1. **Open**: `agent-browser open <url>`
2. **Snapshot**: `agent-browser snapshot -i --json` → returns refs
3. **Parse**: `jq` extracts element references from JSON
4. **Interact**: Use refs (`@e1`, `@e2`) for click/fill
5. **Verify**: Assertions check expected state
6. **Cleanup**: Browser closes automatically

## Comparison with Playwright

| Aspect | Playwright | agent-browser |
|--------|-----------|---------------|
| Language | TypeScript | Bash |
| Selectors | CSS/XPath | Reference tags |
| Use Case | Fixed tests | AI exploration |
| Reporting | HTML report | Console output |

Both test suites can coexist and test the same functionality.

## Troubleshooting

**agent-browser not found:**
```bash
npm install -g agent-browser
```

**jq not found:**
```bash
brew install jq  # macOS
sudo apt-get install jq  # Linux
```

**Tests timeout:**
- Ensure dev server is running
- Check `TEST_BASE_URL` is correct
- Increase `WAIT_LOAD` timeout

**Elements not found:**
- Page may still be loading
- Use `--headed` mode (visible browser) to debug:
  ```bash
  HEADLESS= ./tests/01-video-analysis.sh
  ```
