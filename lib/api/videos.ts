import { db } from '../db'
import { videoAnalyses, userVideos } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import type { Topic, TranscriptSegment } from '../types'

export interface VideoAnalysis {
  id: string
  youtubeId: string
  userId: string | null
  title: string
  author: string | null
  thumbnailUrl: string | null
  duration: number | null
  transcript: TranscriptSegment[]
  topics: Topic[]
  summary: any
  suggestedQuestions: string[]
  createdAt: number
  updatedAt: number
}

export async function getVideoByYoutubeId(youtubeId: string) {
  const result = await db.select()
    .from(videoAnalyses)
    .where(eq(videoAnalyses.youtubeId, youtubeId))
  return result[0] || null
}

export async function createVideoAnalysis(data: {
  youtubeId: string
  userId?: string
  title: string
  author?: string
  thumbnailUrl?: string
  duration?: number
  transcript?: TranscriptSegment[]
  topics?: Topic[]
  summary?: any
  suggestedQuestions?: string[]
}) {
  const now = Math.floor(Date.now() / 1000)
  const analysis = {
    id: crypto.randomUUID(),
    youtubeId: data.youtubeId,
    userId: data.userId || null,
    title: data.title,
    author: data.author || null,
    thumbnailUrl: data.thumbnailUrl || null,
    duration: data.duration || null,
    transcript: JSON.stringify(data.transcript || []),
    topics: JSON.stringify(data.topics || []),
    summary: JSON.stringify(data.summary || null),
    suggestedQuestions: JSON.stringify(data.suggestedQuestions || []),
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(videoAnalyses).values(analysis)
  return analysis
}

export async function updateVideoAnalysis(id: string, data: Partial<Omit<VideoAnalysis, 'id' | 'youtubeId' | 'createdAt'>>) {
  const now = Math.floor(Date.now() / 1000)
  const updateData: any = { ...data, updatedAt: now }
  if (data.transcript) updateData.transcript = JSON.stringify(data.transcript)
  if (data.topics) updateData.topics = JSON.stringify(data.topics)
  if (data.summary) updateData.summary = JSON.stringify(data.summary)
  if (data.suggestedQuestions) updateData.suggestedQuestions = JSON.stringify(data.suggestedQuestions)

  const result = await db.update(videoAnalyses)
    .set(updateData)
    .where(eq(videoAnalyses.id, id))
    .returning()
  return result[0] || null
}

export async function linkVideoToUser(userId: string, videoAnalysisId: string) {
  const now = Math.floor(Date.now() / 1000)
  const link = {
    id: crypto.randomUUID(),
    userId,
    videoAnalysisId,
    isFavorite: false,
    createdAt: now,
  }
  await db.insert(userVideos).values(link).onConflictDoNothing()
  return link
}

export async function getUserVideos(userId: string) {
  const result = await db.select({
    videoAnalysis: videoAnalyses,
    isFavorite: userVideos.isFavorite,
  })
    .from(userVideos)
    .innerJoin(videoAnalyses, eq(userVideos.videoAnalysisId, videoAnalyses.id))
    .where(eq(userVideos.userId, userId))
  return result
}

export async function toggleVideoFavorite(userId: string, videoAnalysisId: string) {
  const existing = await db.select()
    .from(userVideos)
    .where(and(
      eq(userVideos.userId, userId),
      eq(userVideos.videoAnalysisId, videoAnalysisId)
    ))

  if (!existing[0]) {
    return null
  }

  const newFavorite = existing[0].isFavorite ? false : true
  const result = await db.update(userVideos)
    .set({ isFavorite: newFavorite })
    .where(and(
      eq(userVideos.userId, userId),
      eq(userVideos.videoAnalysisId, videoAnalysisId)
    ))
    .returning()
  return result[0] || null
}

export async function setVideoFavorite(
  userId: string,
  videoAnalysisId: string,
  isFavorite: boolean
) {
  const existing = await db.select()
    .from(userVideos)
    .where(and(
      eq(userVideos.userId, userId),
      eq(userVideos.videoAnalysisId, videoAnalysisId)
    ))

  if (existing[0]) {
    const result = await db.update(userVideos)
      .set({ isFavorite })
      .where(and(
        eq(userVideos.userId, userId),
        eq(userVideos.videoAnalysisId, videoAnalysisId)
      ))
      .returning()
    return result[0] || null
  } else {
    const now = Math.floor(Date.now() / 1000)
    const link = {
      id: crypto.randomUUID(),
      userId,
      videoAnalysisId,
      isFavorite,
      createdAt: now,
    }
    const result = await db.insert(userVideos)
      .values(link)
      .returning()
    return result[0] || null
  }
}

function transformVideoAnalysis(dbResult: any): VideoAnalysis | null {
  if (!dbResult) return null
  
  return {
    id: dbResult.id,
    youtubeId: dbResult.youtubeId,
    userId: dbResult.userId,
    title: dbResult.title,
    author: dbResult.author,
    thumbnailUrl: dbResult.thumbnailUrl,
    duration: dbResult.duration,
    transcript: typeof dbResult.transcript === 'string' 
      ? JSON.parse(dbResult.transcript || '[]') 
      : (dbResult.transcript || []),
    topics: typeof dbResult.topics === 'string' 
      ? JSON.parse(dbResult.topics || '[]') 
      : (dbResult.topics || []),
    summary: typeof dbResult.summary === 'string' 
      ? JSON.parse(dbResult.summary) 
      : dbResult.summary,
    suggestedQuestions: typeof dbResult.suggestedQuestions === 'string' 
      ? JSON.parse(dbResult.suggestedQuestions || '[]') 
      : (dbResult.suggestedQuestions || []),
    createdAt: dbResult.createdAt,
    updatedAt: dbResult.updatedAt,
  }
}

export async function getVideoAnalysisByYoutubeId(youtubeId: string): Promise<VideoAnalysis | null> {
  const result = await db.select()
    .from(videoAnalyses)
    .where(eq(videoAnalyses.youtubeId, youtubeId))
  return transformVideoAnalysis(result[0])
}
