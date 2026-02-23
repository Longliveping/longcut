import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(_req: NextRequest) {
  // Stripe integration not available in local SQLite deployment
  return NextResponse.json(
    { error: 'Stripe integration not available for local deployment' },
    { status: 501 }
  );
}

export const POST = handler;
