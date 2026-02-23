import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';
import { ensureUserVideoLink } from '@/lib/video-save-utils';
import { requireSession } from '@/lib/auth/server';

/**
 * Verifies and creates a user_videos link if missing.
 *
 * This is a fallback mechanism for when the initial save in /api/video-analysis
 * fails but the video exists. The client can call this endpoint to ensure
 * the video appears in the user's history.
 */
async function handler(req: NextRequest) {
  try {
    const { videoId } = await req.json();

    if (!videoId || typeof videoId !== 'string') {
      return NextResponse.json(
        { error: 'videoId is required' },
        { status: 400 }
      );
    }

    const session = await requireSession();
    const user = session.user;

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const result = await ensureUserVideoLink(user.id, videoId);

    if (result.error && !result.linked) {
      console.error(
        `[verify-video-link] Failed to link video ${videoId} for user ${user.id}:`,
        result.error
      );
      return NextResponse.json(
        { linked: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      linked: result.linked,
      videoId: result.videoId,
      error: result.error,
    });
  } catch (error) {
    console.error('[verify-video-link] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to verify video link' },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(handler, SECURITY_PRESETS.AUTHENTICATED);
