import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/server';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';
import { getVideoByYoutubeId, updateVideoAnalysis } from '@/lib/api/videos';
import { eq } from 'drizzle-orm';

interface UpdateResult {
  success: boolean;
  video_id: string | null;
}

async function handler(req: NextRequest) {
  try {
    const {
      videoId,
      summary,
      suggestedQuestions
    } = await req.json();

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
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if video exists
    const video = await getVideoByYoutubeId(videoId);

    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Verify ownership - only owner can update
    if (video.userId !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to update this video analysis' },
        { status: 403 }
      );
    }

    // Update the video analysis
    const updated = await updateVideoAnalysis(video.id, {
      summary,
      suggestedQuestions
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update video analysis' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      videoId: video.id
    });

  } catch (error) {
    console.error('Error in update video analysis:', error);
    return NextResponse.json(
      { error: 'Failed to process update request' },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(handler, SECURITY_PRESETS.AUTHENTICATED);
