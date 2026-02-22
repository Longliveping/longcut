import { db } from '../db'
import { notes } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import type { NoteSource } from '../types'

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export async function createNote(data: {
  userId: string
  videoId: string
  source: NoteSource
  sourceId?: string
  text: string
  metadata?: any
}) {
  const now = Math.floor(Date.now() / 1000)
  const note = {
    id: crypto.randomUUID(),
    userId: data.userId,
    videoId: data.videoId,
    source: data.source,
    sourceId: data.sourceId || null,
    text: data.text,
    metadata: JSON.stringify(data.metadata || null),
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(notes).values(note)
  return note
}

export async function getNotesByVideo(userId: string, videoId: string) {
  const result = await db.select()
    .from(notes)
    .where(and(
      eq(notes.userId, userId),
      eq(notes.videoId, videoId)
    ))
  return result.map(n => ({
    ...n,
    metadata: safeJsonParse(n.metadata),
  }))
}

export async function getAllNotes(userId: string) {
  const result = await db.select()
    .from(notes)
    .where(eq(notes.userId, userId))
  return result.map(n => ({
    ...n,
    metadata: safeJsonParse(n.metadata),
  }))
}

export async function deleteNote(noteId: string, userId: string) {
  const result = await db.delete(notes)
    .where(and(
      eq(notes.id, noteId),
      eq(notes.userId, userId)
    ))
    .returning()
  return result[0] || null
}
