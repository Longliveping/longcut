import { NextRequest, NextResponse } from 'next/server';
import { toggleFavoriteRequestSchema, formatValidationError } from '@/lib/validation';
import { z } from 'zod';
import { withSecurity } from '@/lib/security-middleware';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { requireSession } from '@/lib/auth/server';
import { getVideoAnalysisByYoutubeId, setVideoFavorite } from '@/lib/api/videos';

async function handler(req: NextRequest) {
  try {
    // Parse and validate request body
    const body = await req.json();

    let validatedData;
    try {
      validatedData = toggleFavoriteRequestSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: formatValidationError(error)
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const { videoId, isFavorite } = validatedData;

    // Get authenticated user
    const session = await requireSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get the video analysis by YouTube ID
    const video = await getVideoAnalysisByYoutubeId(videoId);
    
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Set favorite status (upsert logic handled by setVideoFavorite)
    const result = await setVideoFavorite(session.user.id, video.id, isFavorite);

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to update favorite status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      isFavorite: result.isFavorite
    });

  } catch (error) {
    // Log error details server-side only
    console.error('Error toggling favorite:', error);

    // Return generic error message to client
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(handler, {
  requireAuth: true,
  rateLimit: RATE_LIMITS.AUTH_GENERATION,
  maxBodySize: 1024 * 1024, // 1MB
  allowedMethods: ['POST']
  // CSRF protection not needed as authentication is already required
});
