# E2E Tests for Authentication

This directory contains end-to-end tests for the LongCut authentication system using Playwright.

## Directory Structure

```
e2e/
├── auth/
│   ├── page-objects/       # Page Object Model classes
│   │   ├── BasePage.ts
│   │   ├── HomePage.ts
│   │   ├── AuthModalPage.ts
│   │   ├── UserMenuPage.ts
│   │   └── AuthCallbackPage.ts
│   ├── helpers/            # Test helper functions
│   │   ├── auth-helpers.ts
│   │   ├── browser-helpers.ts
│   │   └── test-helpers.ts
│   ├── tests/              # Test specifications
│   │   ├── sign-in.spec.ts
│   │   ├── sign-up.spec.ts
│   │   ├── sign-out.spec.ts
│   │   └── session-persistence.spec.ts
│   └── fixtures/           # Test fixtures
│       └── auth.fixture.ts
├── config/                 # Configuration files
│   ├── test-config.ts
│   └── environments.ts
└── fixtures/               # Global fixtures
```

## Setup

### 1. Install Dependencies

```bash
npm install
npm install -D @playwright/test
```

### 2. Install Playwright Browsers

```bash
npm run test:e2e:install
```

### 3. Configure Environment Variables

Copy `.env.test` to `.env.test.local` and update with your values:

```bash
cp .env.test .env.test.local
```

Required variables:
- `TEST_BASE_URL`: Base URL for tests (default: http://localhost:3000)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (for test user management)

### 4. Start Development Server

```bash
npm run dev
```

## Running Tests

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Tests in UI Mode

```bash
npm run test:e2e:ui
```

### Run Tests in Headed Mode

```bash
npm run test:e2e:headed
```

### Debug Tests

```bash
npm run test:e2e:debug
```

### Run Specific Test Suites

```bash
# Sign in tests
npm run test:e2e:sign-in

# Sign up tests
npm run test:e2e:sign-up

# Sign out tests
npm run test:e2e:sign-out

# Session persistence tests
npm run test:e2e:session
```

### Run Tests on Specific Browsers

```bash
# Chromium only
npm run test:e2e:chromium

# Firefox only
npm run test:e2e:firefox

# WebKit (Safari) only
npm run test:e2e:webkit

# Mobile Chrome
npm run test:e2e:mobile
```

### View Test Report

```bash
npm run test:e2e:report
```

## Test Coverage

### Sign In Tests (`sign-in.spec.ts`)

- TC-001: Successful sign in with valid credentials
- TC-002: Failed sign in with invalid credentials
- TC-003: Failed sign in with wrong password
- TC-004: Failed sign in with non-existent email
- TC-005: Form validation for empty fields
- TC-006: Form validation for invalid email format
- TC-007: Sign in modal opens and closes correctly
- TC-008: Sign in redirects correctly after success
- TC-009: Modal has correct title and description
- TC-010: Modal has all required input fields
- TC-011: Modal has sign in button
- TC-012: Tabs switch correctly between sign in and sign up
- TC-013: User can sign out after signing in

### Sign Up Tests (`sign-up.spec.ts`)

- TC-001: Successful sign up with valid credentials
- TC-002: Failed sign up with existing email
- TC-003: Form validation for weak password
- TC-004: Form validation for invalid email format
- TC-005: Form validation for empty fields
- TC-006: Minimum password length validation
- TC-007: Success message displays correctly
- TC-008: Can close success message
- TC-009: Sign up form has all required fields
- TC-010: Sign up button shows loading state
- TC-011: Terms of service mention
- TC-012: Form clears when switching tabs
- TC-013: Sign up tab is active
- TC-014: Create Account button text
- TC-015: Password placeholder mentions minimum length

### Sign Out Tests (`sign-out.spec.ts`)

- TC-001: Sign out from user menu
- TC-002: Sign out clears authentication state
- TC-003: Sign out clears localStorage
- TC-004: Sign out closes user menu
- TC-005: Can sign in again after sign out
- TC-006: Sign out redirects to home page
- TC-007: Sign out button is visible in user menu
- TC-008: User menu shows correct menu items
- TC-009: Sign out works from any page
- TC-010: User avatar is visible when signed in
- TC-011: User menu shows account email
- TC-012: User menu has navigation links

### Session Persistence Tests (`session-persistence.spec.ts`)

- TC-001: Session persists across page reload
- TC-002: Session persists across navigation
- TC-003: Session persists across browser tabs
- TC-004: Session data stored in localStorage
- TC-005: Session restored from localStorage
- TC-006: Session expires after sign out
- TC-007: Session persists after closing browser
- TC-008: Session handles token refresh
- TC-009: Clearing localStorage signs user out
- TC-010: Session persists across back/forward navigation
- TC-011: User data accessible after page reload
- TC-012: Session state consistent across rapid navigation
- TC-013: Pending video ID stored in sessionStorage
- TC-014: SessionStorage cleared on sign out

## Page Object Model

The tests use the Page Object Model pattern for maintainability:

### BasePage
Provides common functionality for all pages:
- Navigation
- Waiting for elements
- Screenshots
- Input handling
- LocalStorage/SessionStorage operations

### HomePage
Handles home page interactions:
- URL input
- Mode selection
- Auth modal triggering
- Sign in button

### AuthModalPage
Handles authentication modal:
- Sign in form
- Sign up form
- OAuth buttons
- Error/success messages
- Tab switching

### UserMenuPage
Handles user menu when authenticated:
- Opening/closing menu
- Navigation items
- Sign out
- User profile display

### AuthCallbackPage
Handles OAuth callback processing:
- Success/error detection
- URL parsing
- Redirect handling

## Configuration

### Test Configuration (`e2e/config/test-config.ts`)

Centralized configuration for:
- Timeouts
- Retry policies
- Artifacts (screenshots, videos, traces)
- Test data
- Feature flags

### Environment Configuration (`e2e/config/environments.ts`)

Environment-specific settings:
- Base URLs
- Supabase credentials
- OAuth provider settings
- Browser launch options
- Feature flags per environment

## Test Helpers

### Auth Helpers (`auth-helpers.ts`)
- Generate test users
- Create/delete users via API
- Auth state management
- Email/password generation

### Browser Helpers (`browser-helpers.ts`)
- Screenshots
- Console logging
- Network requests
- Storage operations
- Viewport handling

### Test Helpers (`test-helpers.ts`)
- Test data generation
- Assertion helpers
- Wait helpers
- Retry logic
- String/url utilities

## Debugging

### Visual Debugging

Run tests in UI mode:
```bash
npm run test:e2e:ui
```

### Step-by-Step Debugging

Run tests in debug mode:
```bash
npm run test:e2e:debug
```

### Screenshots

Screenshots are automatically captured on failure and saved to `test-results/screenshots/`.

### Traces

Traces are captured on retry and can be viewed:
```bash
npx playwright show-trace test-results/traces/[trace-file].zip
```

### Videos

Videos are recorded for each test and saved to `test-results/videos/`.

## CI/CD Integration

The tests are configured to run in CI environments:
- Headless mode by default
- Retry failed tests
- Generate JUnit reports
- Upload artifacts (screenshots, videos, traces)

Example GitHub Actions workflow:

```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npm run test:e2e
  env:
    TEST_BASE_URL: ${{ secrets.TEST_BASE_URL }}
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: test-results/
```

## Best Practices

1. **Use Page Objects**: Always interact with pages through Page Object classes
2. **Wait for Elements**: Use explicit waits instead of arbitrary timeouts
3. **Clean Up**: Sign out and clear data after each test
4. **Descriptive Tests**: Use clear test names that describe what is being tested
5. **Test Isolation**: Each test should be independent and not rely on other tests
6. **Error Handling**: Properly handle and report errors
7. **Screenshots on Failure**: Leverage automatic screenshot capture for debugging

## Troubleshooting

### Tests Fail to Connect

- Ensure the dev server is running on the expected port
- Check `TEST_BASE_URL` in `.env.test.local`

### Sign In/Sign Up Tests Fail

- Verify Supabase credentials are correct
- Check that email auth is enabled in Supabase
- Ensure test users don't already exist

### Browser Launch Issues

- Install browser dependencies: `npm run test:e2e:install`
- Check system requirements for Playwright

### Timeout Errors

- Increase timeout in `playwright.config.ts`
- Check for slow network conditions
- Verify the app is responding quickly enough
