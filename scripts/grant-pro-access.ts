#!/usr/bin/env node
/**
 * Admin Script: Grant Pro Access to Users
 *
 * Usage:
 *   npx tsx scripts/grant-pro-access.ts <email> [options]
 *
 * Options:
 *   --expires <date>    Set expiration date (YYYY-MM-DD), default: 2099-12-31
 *   --credits <number>  Add bonus top-up credits (Pro only feature)
 *   --dry-run           Show what would happen without making changes
 *   --help              Show this help message
 *
 * Examples:
 *   npx tsx scripts/grant-pro-access.ts user@example.com
 *   npx tsx scripts/grant-pro-access.ts user@example.com --expires 2025-12-31
 *   npx tsx scripts/grant-pro-access.ts user@example.com --credits 50
 *   npx tsx scripts/grant-pro-access.ts user@example.com --dry-run
 */

// Load .env.local file manually (required for standalone script execution)
import { readFileSync } from 'fs';
import { resolve } from 'path';

try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
} catch {
  console.error('⚠️  Warning: Could not load .env.local file');
  console.error('   Make sure .env.local exists in the project root or environment variables are set via system\n');
}

// Import dependencies after environment is loaded
import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

interface GrantProOptions {
  email: string;
  expiresAt?: Date;
  bonusCredits?: number;
  dryRun?: boolean;
}

function parseArgs(): GrantProOptions | null {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    showHelp();
    return null;
  }

  const email = args[0];
  if (!email || email.startsWith('--')) {
    console.error('❌ Error: Email address is required as first argument\n');
    showHelp();
    return null;
  }

  const options: GrantProOptions = { email };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--expires') {
      const dateStr = args[++i];
      if (!dateStr) {
        console.error('❌ Error: --expires requires a date (YYYY-MM-DD)');
        return null;
      }
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        console.error(`❌ Error: Invalid date format: ${dateStr}`);
        return null;
      }
      options.expiresAt = date;
    } else if (arg === '--credits') {
      const credits = parseInt(args[++i], 10);
      if (isNaN(credits) || credits < 0) {
        console.error('❌ Error: --credits requires a positive number');
        return null;
      }
      options.bonusCredits = credits;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else {
      console.error(`❌ Error: Unknown option: ${arg}\n`);
      showHelp();
      return null;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Admin Script: Grant Pro Access to Users

Usage:
  npx tsx scripts/grant-pro-access.ts <email> [options]

Options:
  --expires <date>    Set expiration date (YYYY-MM-DD), default: 2099-12-31
  --credits <number>  Add bonus top-up credits (Pro only feature)
  --dry-run           Show what would happen without making changes
  --help              Show this help message

Examples:
  # Grant lifetime Pro access
  npx tsx scripts/grant-pro-access.ts user@example.com

  # Grant Pro access until specific date
  npx tsx scripts/grant-pro-access.ts user@example.com --expires 2025-12-31

  # Grant Pro + 50 bonus credits
  npx tsx scripts/grant-pro-access.ts user@example.com --credits 50

  # Check what would happen (dry run)
  npx tsx scripts/grant-pro-access.ts user@example.com --dry-run
  `);
}

function displayUser(user: typeof users.$inferSelect, label: string) {
  console.log(`\n${label}:`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Tier: ${user.tier || 'none'}`);
  console.log(`  Status: ${user.subscriptionStatus || 'none'}`);
  console.log(`  Period End: ${user.subscriptionCurrentPeriodEnd || 'none'}`);
  console.log(`  Top-up Credits: ${user.topupCredits}`);
  console.log(`  Stripe Customer: ${user.stripeCustomerId || 'none'}`);
  console.log(`  Stripe Subscription: ${user.stripeSubscriptionId || 'none'}`);
}

async function grantProAccess(options: GrantProOptions): Promise<void> {
  const periodEnd = options.expiresAt || new Date('2099-12-31');
  const periodStart = Math.floor(Date.now() / 1000);

  console.log(`\n🔍 Looking up user: ${options.email}`);

  // Fetch current user
  const [user] = await db.select().from(users).where(eq(users.email, options.email));

  if (!user) {
    console.error(`❌ Error: User not found with email: ${options.email}`);
    console.error('   Make sure the user has logged in at least once.');
    return;
  }

  displayUser(user, '📋 Current User');

  // Prepare updates
  const updates: Partial<typeof users.$inferInsert> = {
    tier: 'pro',
    subscriptionStatus: 'active',
    subscriptionCurrentPeriodStart: periodStart,
    subscriptionCurrentPeriodEnd: Math.floor(periodEnd.getTime() / 1000),
    cancelAtPeriodEnd: 0,
  };

  if (options.bonusCredits && options.bonusCredits > 0) {
    updates.topupCredits = (user.topupCredits || 0) + options.bonusCredits;
  }

  console.log(`\n📝 Planned Changes:`);
  console.log(`  Subscription Tier: ${user.tier || 'none'} → pro`);
  console.log(`  Subscription Status: ${user.subscriptionStatus || 'none'} → active`);
  console.log(`  Period Start: ${new Date(periodStart * 1000).toISOString()}`);
  console.log(`  Period End: ${user.subscriptionCurrentPeriodEnd ? new Date(user.subscriptionCurrentPeriodEnd * 1000).toISOString() : 'none'} → ${periodEnd.toISOString()}`);
  if (options.bonusCredits && options.bonusCredits > 0) {
    console.log(`  Top-up Credits: ${user.topupCredits || 0} → ${updates.topupCredits} (+${options.bonusCredits})`);
  }

  if (options.dryRun) {
    console.log(`\n✅ Dry run complete - no changes made`);
    return;
  }

  // Execute update
  console.log(`\n⚙️  Applying changes...`);
  const [updatedUser] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, user.id))
    .returning();

  displayUser(updatedUser, '✅ Updated User');

  console.log(`\n🎉 Successfully granted Pro access to ${options.email}`);
  if (periodEnd.getFullYear() === 2099) {
    console.log(`   (Lifetime access granted)`);
  } else {
    console.log(`   (Access expires: ${periodEnd.toISOString().split('T')[0]})`);
  }
}

async function main() {
  const options = parseArgs();

  if (!options) {
    process.exit(1);
  }

  try {
    await grantProAccess(options);
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

main();
