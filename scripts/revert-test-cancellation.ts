import { getStripeClient } from '../lib/stripe-client';
import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function revertTestCancellation(subscriptionId: string) {
  const stripe = getStripeClient();

  console.log(`\n🔄 Reverting test cancellation for subscription: ${subscriptionId}\n`);

  // Fetch actual state from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  console.log('📊 Actual Stripe state:');
  console.log(`   status: ${subscription.status}`);
  console.log(`   cancel_at_period_end: ${subscription.cancel_at_period_end}\n`);

  // Find the user
  const [user] = await db.select({
    id: users.id,
    email: users.email,
  }).from(users).where(eq(users.stripeSubscriptionId, subscriptionId));

  if (!user) {
    console.error('❌ Could not find user');
    return;
  }

  // Sync with real Stripe data
  const updatePayload = {
    subscriptionStatus: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end ? 1 : 0,
    subscriptionCurrentPeriodStart: subscription.current_period_start,
    subscriptionCurrentPeriodEnd: subscription.current_period_end,
  };

  await db.update(users).set(updatePayload).where(eq(users.id, user.id));

  console.log('✅ Database synced with actual Stripe state\n');
}

const subscriptionId = process.argv[2] || 'sub_1SS3LGFxv4zxL2QR05DuM6ot';
revertTestCancellation(subscriptionId).catch(console.error);
