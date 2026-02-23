import Stripe from 'stripe';

import { getStripeClient } from '@/lib/stripe-client';
import { addTopupCredits } from '@/lib/subscription-manager';

export interface TopupValues {
  credits: number;
  amountCents: number;
}

export interface TopupProcessingResult {
  creditsAdded: number;
  totalCredits: number | null;
  alreadyApplied: boolean;
}

const DEFAULT_CREDITS = 20;
const DEFAULT_AMOUNT_CENTS = 299;

function normalizePaymentIntentId(
  paymentIntent: Stripe.Checkout.Session['payment_intent']
): string | null {
  if (!paymentIntent) {
    return null;
  }

  if (typeof paymentIntent === 'string') {
    return paymentIntent;
  }

  return paymentIntent.id ?? null;
}

export async function extractTopupValuesFromSession(
  session: Stripe.Checkout.Session
): Promise<TopupValues> {
  const stripe = getStripeClient();

  try {
    const sessionWithItems =
      session.line_items?.data?.length && session.line_items.data[0]?.price
        ? session
        : await stripe.checkout.sessions.retrieve(session.id, {
            expand: ['line_items', 'line_items.data.price'],
          });

    const lineItem = sessionWithItems.line_items?.data?.[0];

    if (!lineItem || !lineItem.price) {
      console.warn('No line items found in checkout session, using defaults');
      return { credits: DEFAULT_CREDITS, amountCents: DEFAULT_AMOUNT_CENTS };
    }

    const price = lineItem.price as Stripe.Price;
    const creditsFromMetadata =
      price.metadata && typeof price.metadata.credits === 'string'
        ? parseInt(price.metadata.credits, 10)
        : NaN;

    const credits = Number.isFinite(creditsFromMetadata)
      ? creditsFromMetadata
      : DEFAULT_CREDITS;

    const amountCents =
      typeof price.unit_amount === 'number' ? price.unit_amount : DEFAULT_AMOUNT_CENTS;

    return { credits, amountCents };
  } catch (error) {
    console.error('Failed to extract top-up values from Stripe, using defaults:', error);
    return { credits: DEFAULT_CREDITS, amountCents: DEFAULT_AMOUNT_CENTS };
  }
}

export async function processTopupCheckout(
  session: Stripe.Checkout.Session
): Promise<TopupProcessingResult | null> {
  const userId = session.metadata?.userId;

  if (!userId) {
    console.error('Unable to process top-up: missing userId metadata');
    return null;
  }

  const paymentIntentId = normalizePaymentIntentId(session.payment_intent ?? null);

  if (!paymentIntentId) {
    console.error('Unable to process top-up: missing payment intent');
    return null;
  }

  if (session.metadata?.priceType !== 'topup') {
    return null;
  }

  const { credits } = await extractTopupValuesFromSession(session);

  // Add top-up credits using our SQLite implementation
  const addResult = await addTopupCredits(userId, credits);

  if (!addResult.success) {
    console.error('Failed to add top-up credits:', addResult.error);
    throw new Error(`Failed to add top-up credits: ${addResult.error}`);
  }

  // Return result
  return {
    creditsAdded: credits,
    totalCredits: null, // Would need to fetch current credits
    alreadyApplied: false,
  };
}
