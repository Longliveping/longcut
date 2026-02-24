import { getStripeClient } from '../lib/stripe-client';
import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function syncAllSubscriptions() {
  const stripe = getStripeClient();

  console.log('\n🔄 Syncing all subscriptions from Stripe to database...\n');

  // Get all pro users from database
  const proUsers = await db.select({
    id: users.id,
    email: users.email,
    tier: users.tier,
    subscriptionStatus: users.subscriptionStatus,
    cancelAtPeriodEnd: users.cancelAtPeriodEnd,
    stripeSubscriptionId: users.stripeSubscriptionId,
  }).from(users).where(
    and(
      eq(users.tier, 'pro'),
    )
  );

  const usersWithSubscription = proUsers.filter(u => u.stripeSubscriptionId);

  console.log(`Found ${usersWithSubscription.length} pro subscriptions in database\n`);

  let synced = 0;
  let errors = 0;
  let mismatches = 0;

  for (const user of usersWithSubscription) {
    try {
      console.log(`\n📊 Processing: ${user.email || user.id}`);
      console.log(`   Subscription ID: ${user.stripeSubscriptionId}`);

      // Fetch from Stripe
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId!);

      const dbCancelFlag = Boolean(user.cancelAtPeriodEnd);
      const stripeCancelFlag = Boolean(subscription.cancel_at_period_end);

      console.log(`   Stripe: status=${subscription.status}, cancel_at_period_end=${stripeCancelFlag}`);
      console.log(`   DB: status=${user.subscriptionStatus}, cancel_at_period_end=${dbCancelFlag}`);

      // Check if there's a mismatch
      const hasMismatch =
        user.subscriptionStatus !== subscription.status ||
        dbCancelFlag !== stripeCancelFlag;

      if (hasMismatch) {
        mismatches++;
        console.log(`   ⚠️  MISMATCH DETECTED - syncing...`);

        const updatePayload = {
          subscriptionStatus: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end ? 1 : 0,
          subscriptionCurrentPeriodStart: subscription.current_period_start,
          subscriptionCurrentPeriodEnd: subscription.current_period_end,
        };

        try {
          await db.update(users).set(updatePayload).where(eq(users.id, user.id));
          console.log(`   ✅ Synced successfully`);
          synced++;
        } catch (updateError: any) {
          console.error(`   ❌ Update failed:`, updateError.message);
          errors++;
        }
      } else {
        console.log(`   ✓ Already in sync`);
      }

    } catch (error: any) {
      console.error(`   ❌ Error:`, error.message);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📈 Sync Summary:`);
  console.log(`   Total subscriptions: ${usersWithSubscription.length}`);
  console.log(`   Mismatches found: ${mismatches}`);
  console.log(`   Successfully synced: ${synced}`);
  console.log(`   Errors: ${errors}`);
  console.log('\n' + '='.repeat(60) + '\n');
}

syncAllSubscriptions().catch(console.error);
