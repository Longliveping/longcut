import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { getVideoByYoutubeId, linkVideoToUser } from '@/lib/api/videos';
import { db } from '@/lib/db';
import { userVideos } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

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

    // Check if already linked
    const existingLink = await db.select()
      .from(userVideos)
      .where(and(
        eq(userVideos.userId, user.id),
        eq(userVideos.videoAnalysisId, video.id)
      ))
      .limit(1);

    const alreadyLinked = existingLink.length > 0;

    // Only link if not already linked
    if (!alreadyLinked) {
      await linkVideoToUser(user.id, video.id);
    }

    return NextResponse.json({
      success: true,
      alreadyLinked,
      message: alreadyLinked
        ? 'Video already in your library'
        : 'Video successfully linked to your account'
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
