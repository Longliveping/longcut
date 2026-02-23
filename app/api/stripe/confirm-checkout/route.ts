import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';
import { z } from 'zod';

const requestSchema = z.object({
  sessionId: z.string().min(1, 'Missing checkout session'),
});

async function handler(req: NextRequest) {
  try {
    const body = await req.json();
    requestSchema.parse(body);

    // Stripe integration not available in local SQLite deployment
    return NextResponse.json(
      { error: 'Stripe integration not available for local deployment' },
      { status: 501 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }

    console.error('Error confirming checkout session:', error);
    return NextResponse.json({ error: 'Failed to confirm checkout' }, { status: 500 });
  }
}

export const POST = withSecurity(handler, SECURITY_PRESETS.AUTHENTICATED);
