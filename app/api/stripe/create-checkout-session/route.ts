import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';

async function handler(_req: NextRequest) {
  // Stripe integration not available in local SQLite deployment
  return NextResponse.json(
    { error: 'Stripe integration not available for local deployment' },
    { status: 501 }
  );
}

export const POST = withSecurity(handler, SECURITY_PRESETS.AUTHENTICATED);
