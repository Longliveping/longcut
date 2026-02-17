/**
 * Authentication Fixtures
 * Reusable test fixtures for authentication E2E tests
 */

import { test as base } from '@playwright/test';
import { HomePage } from '../page-objects/HomePage';
import { AuthModalPage } from '../page-objects/AuthModalPage';
import { UserMenuPage } from '../page-objects/UserMenuPage';
import { AuthCallbackPage } from '../page-objects/AuthCallbackPage';
import * as authHelpers from '../helpers/auth-helpers';

export type AuthFixtures = {
  homePage: HomePage;
  authModalPage: AuthModalPage;
  userMenuPage: UserMenuPage;
  authCallbackPage: AuthCallbackPage;
};

export const test = base.extend<AuthFixtures>({
  homePage: async ({ page }, use) => {
    const homePage = new HomePage(page);
    await use(homePage);
  },

  authModalPage: async ({ page }, use) => {
    const authModalPage = new AuthModalPage(page);
    await use(authModalPage);
  },

  userMenuPage: async ({ page }, use) => {
    const userMenuPage = new UserMenuPage(page);
    await use(userMenuPage);
  },

  authCallbackPage: async ({ page }, use) => {
    const authCallbackPage = new AuthCallbackPage(page);
    await use(authCallbackPage);
  },
});

/**
 * Fixture for authenticated user
 */
export const authenticatedTest = base.extend<AuthFixtures & { authenticatedUser: authHelpers.TestUser }>({
  homePage: async ({ page }, use) => {
    const homePage = new HomePage(page);
    await use(homePage);
  },

  authModalPage: async ({ page }, use) => {
    const authModalPage = new AuthModalPage(page);
    await use(authModalPage);
  },

  userMenuPage: async ({ page }, use) => {
    const userMenuPage = new UserMenuPage(page);
    await use(userMenuPage);
  },

  authCallbackPage: async ({ page }, use) => {
    const authCallbackPage = new AuthCallbackPage(page);
    await use(authCallbackPage);
  },

  authenticatedUser: async ({ page, homePage, authModalPage, userMenuPage }, use) => {
    // Create test user and sign in
    const testUser = authHelpers.generateValidSignupData();

    await homePage.goto();
    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignUp();

    await authModalPage.fillSignUpForm(testUser.email, testUser.password);
    await authModalPage.clickSignUp();
    await authModalPage.closeSuccessMessage();

    // Sign in
    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignIn();
    await authModalPage.fillSignInForm(testUser.email, testUser.password);
    await authModalPage.clickSignIn();

    // Wait for sign in
    await page.waitForTimeout(2000);

    await use(testUser);

    // Cleanup: sign out
    if (await userMenuPage.isUserSignedIn()) {
      await userMenuPage.openMenu();
      await userMenuPage.clickSignOut();
    }
  },
});

export { expect } from '@playwright/test';
