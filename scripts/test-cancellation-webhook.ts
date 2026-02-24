import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';

async function testCancellationWebhook(subscriptionId: string) {
  console.log(`\n🧪 Testing cancellation webhook for subscription: ${subscriptionId}\n`);

  // Find the user
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

  console.log(`👤 Found user: ${user.email || user.id}`);
  console.log('📊 Current state:');
  console.log(`   Tier: ${user.tier}`);
  console.log(`   Status: ${user.subscriptionStatus}`);
  console.log(`   Cancel at period end: ${user.cancelAtPeriodEnd}\n`);

  // Simulate a Stripe subscription object with cancel_at_period_end = true
  const mockCancelledSubscription: Partial<Stripe.Subscription> = {
    id: subscriptionId,
    status: 'active',
    cancel_at_period_end: true,
    current_period_start: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
    current_period_end: Math.floor(Date.now() / 1000) + (29 * 86400), // 29 days from now
  } as any;

  console.log('🔄 Simulating subscription.updated webhook with cancellation...');
  console.log('   Simulated data:');
  console.log(`     status: active`);
  console.log(`     cancel_at_period_end: true`);
  console.log(`     period_end: ${new Date(mockCancelledSubscription.current_period_end! * 1000).toISOString()}\n`);

  // Map to database update (same as webhook handler does)
  const updatePayload = {
    subscriptionStatus: mockCancelledSubscription.status,
    cancelAtPeriodEnd: mockCancelledSubscription.cancel_at_period_end ? 1 : 0,
    subscriptionCurrentPeriodStart: mockCancelledSubscription.current_period_start,
    subscriptionCurrentPeriodEnd: mockCancelledSubscription.current_period_end,
  };

  console.log('📝 Update payload:', JSON.stringify(updatePayload, null, 2), '\n');

  // Apply the update
  await db.update(users).set(updatePayload).where(eq(users.id, user.id));

  console.log('✅ Database updated successfully!\n');

  // Verify the update
  const [updatedUser] = await db.select({
    tier: users.tier,
    subscriptionStatus: users.subscriptionStatus,
    cancelAtPeriodEnd: users.cancelAtPeriodEnd,
    subscriptionCurrentPeriodEnd: users.subscriptionCurrentPeriodEnd,
  }).from(users).where(eq(users.id, user.id));

  console.log('✅ New state in database:');
  console.log(`   Tier: ${updatedUser?.tier}`);
  console.log(`   Status: ${updatedUser?.subscriptionStatus}`);
  console.log(`   Cancel at period end: ${updatedUser?.cancelAtPeriodEnd}`);
  console.log(`   Period end: ${updatedUser?.subscriptionCurrentPeriodEnd}`);

  console.log('\n🎯 Expected UI behavior:');
  if (updatedUser?.cancelAtPeriodEnd) {
    const endDate = new Date(updatedUser.subscriptionCurrentPeriodEnd! * 1000);
    console.log(`   - Status should show: "Cancels on ${endDate.toLocaleDateString()}"`);
    console.log(`   - Warning alert should appear`);
    console.log(`   - AlertCircle icon should display`);
  } else {
    console.log(`   - Status should show: "Active"`);
  }

  console.log('\n✅ Test complete! Refresh your settings page to see the changes.\n');
}

// Get subscription ID from command line
const subscriptionId = process.argv[2];

if (!subscriptionId) {
  console.error('❌ Usage: npx tsx scripts/test-cancellation-webhook.ts <subscription_id>');
  console.error('\nAvailable subscriptions:');
  console.error('  sub_1SS3LGFxv4zxL2QR05DuM6ot (zzzsamuel12@gmail.com)');
  console.error('  sub_1SRbo8Fxv4zxL2QRUQXccAVA (zhangsamuel1221@gmail.com)');
  console.error('  sub_1SQpNGFxv4zxL2QR0WpzRd7G (zhangsamuel12@gmail.com)');
  console.error('  sub_1SRyYRFxv4zxL2QRAjDUSWf5 (thatzara@gmail.com)');
  process.exit(1);
}

testCancellationWebhook(subscriptionId).catch(console.error);
