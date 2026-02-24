/**
 * UserMenuPage - Page Object for the user menu dropdown
 * Handles user menu interactions when authenticated
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class UserMenuPage extends BasePage {
  // User menu elements
  readonly userMenuButton: Locator;
  readonly userMenuDropdown: Locator;
  readonly userEmail: Locator;
  readonly accountLabel: Locator;
  readonly manageBillingButton: Locator;
  readonly upgradePlanButton: Locator;
  readonly myVideosButton: Locator;
  readonly notesButton: Locator;
  readonly settingsButton: Locator;
  readonly signOutButton: Locator;

  // Unauthenticated state
  readonly signInButton: Locator;

  constructor(page: Page, baseUrl?: string) {
    super(page, baseUrl);

    // User menu elements - Lucia auth uses avatar button for authenticated users
    this.userMenuButton = page.locator('button:has(.avatar), button:has([data-radix-dropdown-menu-trigger])');
    this.userMenuDropdown = page.locator('[role="menu"], [data-radix-dropdown-menu-content]');

    // Authenticated menu items
    this.userEmail = this.userMenuDropdown.locator('.text-muted-foreground, p.text-xs');
    this.accountLabel = this.userMenuDropdown.locator('p.text-sm.font-medium');
    this.manageBillingButton = this.userMenuDropdown.locator('a:has-text("Manage Billing")');
    this.upgradePlanButton = this.userMenuDropdown.locator('a:has-text("Upgrade Plan")');
    this.myVideosButton = this.userMenuDropdown.locator('a:has-text("Videos")');
    this.notesButton = this.userMenuDropdown.locator('a:has-text("Notes")');
    this.settingsButton = this.userMenuDropdown.locator('a:has-text("Settings")');
    this.signOutButton = this.userMenuDropdown.locator('*:has-text("Sign out")');

    // Unauthenticated state
    this.signInButton = page.locator('button:has-text("Sign In")');
  }

  /**
   * Open the user menu dropdown
   */
  async openMenu(): Promise<void> {
    await this.waitForVisible(this.userMenuButton);
    await this.clickWithRetry(this.userMenuButton);
    await this.waitForVisible(this.userMenuDropdown);
  }

  /**
   * Close the user menu dropdown
   */
  async closeMenu(): Promise<void> {
    if (await this.userMenuDropdown.isVisible()) {
      await this.page.mouse.click(0, 0);
      await this.waitForHidden(this.userMenuDropdown);
    }
  }

  /**
   * Check if user is signed in (menu button visible)
   */
  async isUserSignedIn(): Promise<boolean> {
    return await this.isVisible(this.userMenuButton);
  }

  /**
   * Check if sign in button is visible (user not signed in)
   */
  async isSignInButtonVisible(): Promise<boolean> {
    return await this.isVisible(this.signInButton);
  }

  /**
   * Get user email from menu
   */
  async getUserEmail(): Promise<string> {
    await this.openMenu();
    await this.waitForVisible(this.userEmail);
    const email = await this.getText(this.userEmail);
    await this.closeMenu();
    return email;
  }

  /**
   * Get account label text
   */
  async getAccountLabel(): Promise<string> {
    await this.openMenu();
    await this.waitForVisible(this.accountLabel);
    const label = await this.getText(this.accountLabel);
    await this.closeMenu();
    return label;
  }

  /**
   * Click "Manage Billing" or "Upgrade Plan" button
   */
  async clickBilling(): Promise<void> {
    await this.openMenu();
    if (await this.isVisible(this.manageBillingButton)) {
      await this.clickWithRetry(this.manageBillingButton);
    } else if (await this.isVisible(this.upgradePlanButton)) {
      await this.clickWithRetry(this.upgradePlanButton);
    }
  }

  /**
   * Navigate to My Videos
   */
  async goToMyVideos(): Promise<void> {
    await this.openMenu();
    await this.clickWithRetry(this.myVideosButton);
  }

  /**
   * Navigate to Notes
   */
  async goToNotes(): Promise<void> {
    await this.openMenu();
    await this.clickWithRetry(this.notesButton);
  }

  /**
   * Navigate to Settings
   */
  async goToSettings(): Promise<void> {
    await this.openMenu();
    await this.clickWithRetry(this.settingsButton);
  }

  /**
   * Click Sign Out button
   */
  async clickSignOut(): Promise<void> {
    await this.openMenu();
    await this.clickWithRetry(this.signOutButton);
  }

  /**
   * Complete sign out flow
   */
  async signOut(): Promise<void> {
    await this.clickSignOut();
    // Wait for sign in button to appear (indicating successful sign out)
    await this.waitForVisible(this.signInButton);
    await expect(this.userMenuButton).not.toBeVisible();
  }

  /**
   * Get user avatar initials
   */
  async getAvatarInitials(): Promise<string> {
    await this.openMenu();
    const avatarFallback = this.userMenuButton.locator('.avatar-fallback, [data-radix-avatar-fallback]');
    await this.waitForVisible(avatarFallback);
    const initials = await this.getText(avatarFallback);
    await this.closeMenu();
    return initials;
  }

  /**
   * Check if menu dropdown is open
   */
  async isMenuOpen(): Promise<boolean> {
    return await this.userMenuDropdown.isVisible();
  }

  /**
   * Get all visible menu items
   */
  async getMenuItems(): Promise<string[]> {
    await this.openMenu();
    const menuItems = this.userMenuDropdown.locator('[role="menuitem"], a, button');
    const count = await menuItems.count();
    const items: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await menuItems.nth(i).innerText();
      if (text.trim()) {
        items.push(text.trim());
      }
    }

    await this.closeMenu();
    return items;
  }

  /**
   * Check if menu item is visible
   */
  async isMenuItemVisible(itemText: string): Promise<boolean> {
    await this.openMenu();
    const menuItem = this.userMenuDropdown.locator(`*:has-text("${itemText}")`);
    const visible = await this.isVisible(menuItem);
    await this.closeMenu();
    return visible;
  }

  /**
   * Wait for user menu to be ready (signed in state)
   */
  async waitForUserMenu(): Promise<void> {
    await this.waitForVisible(this.userMenuButton);
  }

  /**
   * Wait for sign in button (signed out state)
   */
  async waitForSignInButton(): Promise<void> {
    await this.waitForVisible(this.signInButton);
  }

  /**
   * Check if user has pro subscription
   */
  async hasProSubscription(): Promise<boolean> {
    return await this.isMenuItemVisible('Manage Billing');
  }

  /**
   * Check if user has free subscription
   */
  async hasFreeSubscription(): Promise<boolean> {
    return await this.isMenuItemVisible('Upgrade Plan');
  }
}
