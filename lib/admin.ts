const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

/**
 * Check if an email address is the admin user
 */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!ADMIN_EMAIL || !email) return false;
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/**
 * Check if a user object represents the admin
 */
export function isAdminUser(user: { email: string } | null | undefined): boolean {
  if (!user) return false;
  return isAdminEmail(user.email);
}

/**
 * Require admin access - throws if user is not admin
 */
export function requireAdmin(user: { email: string } | null | undefined): void {
  if (!isAdminUser(user)) {
    throw new Error('Admin access required');
  }
}
