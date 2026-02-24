import { getStripeClient } from '../lib/stripe-client';
import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function syncSubscriptionFromStripe(subscriptionId: string) {
  const stripe = getStripeClient();

  console.log(`\nFetching subscription ${subscriptionId} from Stripe...`);

  try {
    // Fetch subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    console.log('\n📊 Stripe Subscription Data:');
    console.log(`  ID: ${subscription.id}`);
    console.log(`  Status: ${subscription.status}`);
    console.log(`  Cancel at period end: ${subscription.cancel_at_period_end}`);
    console.log(`  Current period end: ${subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : 'N/A'}`);

    // Find user by subscription ID
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      tier: users.tier,
      subscriptionStatus: users.subscriptionStatus,
      cancelAtPeriodEnd: users.cancelAtPeriodEnd,
    }).from(users).where(eq(users.stripeSubscriptionId, subscriptionId));

    if (!user) {
      console.error('❌ Could not find user with this subscription');
      return;
    }

    console.log(`\n👤 Found user: ${user.email || user.id}`);
    console.log('  Current DB state:');
    console.log(`    Tier: ${user.tier}`);
    console.log(`    Status: ${user.subscriptionStatus}`);
    console.log(`    Cancel at period end: ${user.cancelAtPeriodEnd}`);

    // Map Stripe data to database update
    const updatePayload = {
      subscriptionStatus: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ? 1 : 0,
      subscriptionCurrentPeriodStart: subscription.current_period_start,
      subscriptionCurrentPeriodEnd: subscription.current_period_end,
    };

    console.log('\n🔄 Updating database with Stripe data...');
    console.log('  Update payload:', JSON.stringify(updatePayload, null, 2));

    // Update the database
    await db.update(users).set(updatePayload).where(eq(users.id, user.id));

    console.log('✅ Successfully synced subscription from Stripe to database!');

    // Verify the update
    const [updatedUser] = await db.select({
      tier: users.tier,
      subscriptionStatus: users.subscriptionStatus,
      cancelAtPeriodEnd: users.cancelAtPeriodEnd,
      subscriptionCurrentPeriodEnd: users.subscriptionCurrentPeriodEnd,
    }).from(users).where(eq(users.id, user.id));

    console.log('\n✅ Updated DB state:');
    console.log(`  Tier: ${updatedUser?.tier}`);
    console.log(`  Status: ${updatedUser?.subscriptionStatus}`);
    console.log(`  Cancel at period end: ${updatedUser?.cancelAtPeriodEnd}`);
    console.log(`  Period end: ${updatedUser?.subscriptionCurrentPeriodEnd}`);

  } catch (error) {
    console.error('❌ Error syncing subscription:', error);
  }
}

// Get subscription ID from command line args
const subscriptionId = process.argv[2];

if (!subscriptionId) {
  console.error('❌ Usage: npx tsx scripts/sync-subscription-from-stripe.ts <subscription_id>');
  console.error('\nExample: npx tsx scripts/sync-subscription-from-stripe.ts sub_1ABC123...');
  process.exit(1);
}

syncSubscriptionFromStripe(subscriptionId).catch(console.error);
