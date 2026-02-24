# Admin User Design

**Date:** 2026-02-24
**Author:** Claude Code
**Status:** Approved

## Overview

Add a default admin user with superuser privileges and unlimited access to the entire system. The admin user is identified by an environment variable, bypassing all rate limits.

## Motivation

- Allow a designated admin user to have unlimited access for testing, debugging, and administrative tasks
- Simple configuration without database changes
- Easy to change admin email by updating environment variable

## Architecture

### High-Level Approach

Use an environment variable (`ADMIN_EMAIL`) to identify the admin user. The rate limiter checks if the requesting user is the admin and skips rate limiting entirely.

### Components

| Component | File | Purpose |
|-----------|------|---------|
| Admin helper | `lib/admin.ts` | Check if email/user is admin |
| Rate limiter update | `lib/rate-limiter.ts` | Skip rate limiting for admin |
| Environment config | `.env.local` | Store admin email |

### Data Flow

```
User Request
    │
    ▼
Rate Limiter.check()
    │
    ├─ Get user email from session
    │
    ├─ isAdminEmail(email)?
    │   │
    │   ├─ TRUE → Return allowed: true, remaining: ∞
    │   │
    │   └─ FALSE → Continue normal rate limiting
    │
    ▼
Process Request
```

## Implementation

### 1. New File: lib/admin.ts

```typescript
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
```

### 2. Modify: lib/rate-limiter.ts

In the `getIdentifier()` method, add admin bypass:

```typescript
// In getIdentifier(), after getting user:
if (user && isAdminEmail(user.email)) {
  return `admin:${user.id}`; // Special identifier for admin
}

// In check() method, after getting identifier:
if (identifier.startsWith('admin:')) {
  return {
    allowed: true,
    remaining: Number.MAX_SAFE_INTEGER,
    resetAt: new Date(Date.now() + 86400000) // 24 hours
  };
}
```

### 3. Environment: .env.local

```
ADMIN_EMAIL=admin@example.com
```

## Testing

1. Set `ADMIN_EMAIL` in `.env.local`
2. Create a user with that email
3. Verify rate limits are bypassed for admin user
4. Verify non-admin users still have rate limits

## Security Considerations

- Admin email comparison is case-insensitive
- If `ADMIN_EMAIL` is not set, admin check always returns false
- Rate limiter gracefully falls back to normal limits if admin check fails
