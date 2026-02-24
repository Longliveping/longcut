import * as dotenv from 'dotenv';
import * as postmark from 'postmark';
import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { getHtmlBody, getSubject } from '../lib/email/templates/monthly-update';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Check for required environment variables
const POSTMARK_SERVER_TOKEN = process.env.POSTMARK_SERVER_TOKEN;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://longcut.ai';

if (!POSTMARK_SERVER_TOKEN) {
  console.error('Error: POSTMARK_SERVER_TOKEN is not set.');
  process.exit(1);
}

const client = new postmark.ServerClient(POSTMARK_SERVER_TOKEN);

interface User {
  id: string;
  email: string;
}

async function sendNewsletter() {
  console.log('Starting newsletter distribution...');

  // 1. Fetch ALL users with emails (newsletter subscribers would need a subscribed field added)
  console.log('Fetching all users...');

  const allUsers = await db.select({
    id: users.id,
    email: users.email,
  }).from(users);

  const usersWithEmail = allUsers.filter(u => u.email);

  if (usersWithEmail.length === 0) {
    console.log('No users found.');
    return;
  }

  console.log(`Found ${usersWithEmail.length} total users.`);

  let successCount = 0;
  let errorCount = 0;

  // 2. Iterate and send
  for (const user of usersWithEmail) {
    if (!user.email) continue;

    const unsubscribeUrl = `${NEXT_PUBLIC_APP_URL}/newsletter/unsubscribe?uid=${user.id}`;
    const htmlBody = getHtmlBody(unsubscribeUrl);
    const subject = getSubject();

    try {
      await client.sendEmail({
        "From": "zara@longcut.ai",
        "To": user.email,
        "Subject": subject,
        "HtmlBody": htmlBody,
        "MessageStream": "broadcast"
      });
      console.log(`[OK] Sent to ${user.email}`);
      successCount++;
    } catch (e: any) {
      console.error(`[FAIL] Failed to send to ${user.email}: ${e.message}`);
      errorCount++;
    }

    // Small delay to avoid hitting rate limits
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('-----------------------------------');
  console.log(`Finished.`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors:  ${errorCount}`);
}

sendNewsletter().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
