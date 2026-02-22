import { NextRequest, NextResponse } from 'next/server'
import { getVideoByYoutubeId } from '@/lib/api/videos'
import { extractVideoId } from '@/lib/utils'

// Safe JSON parsing helper
function safeJsonParse<T>(str: string | null): T | null {
  if (!str) return null
  try {
    return JSON.parse(str) as T
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    const youtubeId = extractVideoId(url)
    
    if (!youtubeId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })
    }

    const cached = await getVideoByYoutubeId(youtubeId)

    if (!cached) {
      return NextResponse.json({ cached: false, videoId: youtubeId })
    }

    // Reconstruct original response structure for backward compatibility
    return NextResponse.json({
      cached: true,
      videoId: cached.youtubeId,
      transcript: safeJsonParse(cached.transcript),
      topics: safeJsonParse(cached.topics),
      videoInfo: {
        title: cached.title,
        author: cached.author,
        duration: cached.duration,
        thumbnail: cached.thumbnailUrl,
      },
      summary: safeJsonParse(cached.summary),
      suggestedQuestions: safeJsonParse(cached.suggestedQuestions),
      cacheDate: new Date(cached.createdAt * 1000).toISOString(),
      ownedByCurrentUser: false, // TODO: check session ownership
    })
  } catch (error) {
    console.error('Check video cache error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
