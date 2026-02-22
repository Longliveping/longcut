import { NextRequest, NextResponse } from 'next/server'
import { getVideoByYoutubeId } from '@/lib/api/videos'

export async function GET(req: NextRequest) {
  const youtubeId = req.nextUrl.searchParams.get('youtubeId')

  if (!youtubeId) {
    return NextResponse.json({ error: 'Missing youtubeId' }, { status: 400 })
  }

  const cached = await getVideoByYoutubeId(youtubeId)

  if (!cached) {
    return NextResponse.json({ cached: false })
  }

  // Parse JSON fields
  const analysis = {
    ...cached,
    transcript: cached.transcript ? JSON.parse(cached.transcript) : null,
    topics: cached.topics ? JSON.parse(cached.topics) : null,
    summary: cached.summary ? JSON.parse(cached.summary) : null,
    suggestedQuestions: cached.suggestedQuestions ? JSON.parse(cached.suggestedQuestions) : null,
  }

  return NextResponse.json({ cached: true, analysis })
}
