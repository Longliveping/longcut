import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { getVideoByYoutubeId, linkVideoToUser } from '@/lib/api/videos';

async function handler(req: NextRequest) {
  try {
    const { videoId } = await req.json();

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    const session = await requireSession();
    const user = session.user;

    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Check if video exists in video_analyses table
    const video = await getVideoByYoutubeId(videoId);

    if (!video) {
      return NextResponse.json(
        {
          error: 'Video not found in analyses',
          details: 'The video must be analyzed before it can be linked to your account',
          videoId
        },
        { status: 404 }
      );
    }

    // Link video to user (uses onConflictDoNothing internally)
    linkVideoToUser(user.id, video.id);

    return NextResponse.json({
      success: true,
      message: 'Video successfully linked to user account'
    });

  } catch (error) {
    console.error('Error in link-video endpoint:', error);
    return NextResponse.json(
      { error: 'An error occurred while linking the video' },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(handler, {
  requireAuth: true,
  rateLimit: RATE_LIMITS.AUTH_GENERATION,
  maxBodySize: 1024 * 1024, // 1MB
  allowedMethods: ['POST']
});
