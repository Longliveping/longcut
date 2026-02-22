import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';
import { formatValidationError, noteDeleteSchema, noteInsertSchema } from '@/lib/validation';
import { z } from 'zod';
import { getVideoByYoutubeId } from '@/lib/api/videos';
import { getNotesByVideo, createNote as createNoteDb, deleteNote as deleteNoteDb } from '@/lib/api/notes';

const getNotesQuerySchema = z.object({
  youtubeId: z.string().optional(),
  videoId: z.string().optional()
}).refine(data => data.youtubeId || data.videoId, {
  message: 'Either youtubeId or videoId must be provided'
});

interface NoteRow {
  id: string;
  userId: string;
  videoId: string;
  source: string;
  sourceId: string | null;
  text: string;
  metadata: any;
  createdAt: number;
  updatedAt: number;
}

function mapNote(row: NoteRow) {
  return {
    id: row.id,
    userId: row.userId,
    videoId: row.videoId,
    source: row.source,
    sourceId: row.sourceId,
    text: row.text,
    metadata: row.metadata,
    createdAt: new Date(row.createdAt * 1000).toISOString(),
    updatedAt: new Date(row.updatedAt * 1000).toISOString(),
  };
}

async function handler(req: NextRequest) {
  const session = await getSession();

  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const userId = session.user.id;

  if (req.method === 'GET') {
    const { searchParams } = new URL(req.url);
    const youtubeId = searchParams.get('youtubeId');
    const videoIdParam = searchParams.get('videoId');

    try {
      const validated = getNotesQuerySchema.parse({ youtubeId, videoId: videoIdParam });

      let targetVideoId: string | undefined;

      // If videoId (UUID) is provided directly, skip the video lookup
      if (validated.videoId) {
        targetVideoId = validated.videoId;
      } else if (validated.youtubeId) {
        // Lookup by youtube_id
        const video = await getVideoByYoutubeId(validated.youtubeId);
        targetVideoId = video?.id;
      }

      if (!targetVideoId) {
        return NextResponse.json({ notes: [] });
      }

      const notes = await getNotesByVideo(userId, targetVideoId);

      return NextResponse.json({ notes: notes.map(mapNote) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: formatValidationError(error) },
          { status: 400 }
        );
      }

      console.error('Error fetching notes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch notes' },
        { status: 500 }
      );
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const validatedData = noteInsertSchema.parse(body);

      let targetVideoId: string | undefined;

      // If videoId (UUID) is provided directly, skip the video lookup
      if (validatedData.videoId) {
        targetVideoId = validatedData.videoId;
      } else if (validatedData.youtubeId) {
        // Lookup by youtube_id
        const video = await getVideoByYoutubeId(validatedData.youtubeId);
        targetVideoId = video?.id;
      }

      if (!targetVideoId) {
        return NextResponse.json(
          { error: 'Video not found' },
          { status: 404 }
        );
      }

      const note = await createNoteDb({
        userId,
        videoId: targetVideoId,
        source: validatedData.source,
        sourceId: validatedData.sourceId,
        text: validatedData.text,
        metadata: validatedData.metadata
      });

      return NextResponse.json({ note: mapNote(note as NoteRow) }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: formatValidationError(error) },
          { status: 400 }
        );
      }

      console.error('Error creating note:', error);
      return NextResponse.json(
        { error: 'Failed to save note' },
        { status: 500 }
      );
    }
  }

  if (req.method === 'DELETE') {
    try {
      const body = await req.json();
      const { noteId } = noteDeleteSchema.parse(body);

      const deletedNote = await deleteNoteDb(noteId, userId);

      if (!deletedNote) {
        return NextResponse.json(
          { error: 'Note not found or not authorized' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: formatValidationError(error) },
          { status: 400 }
        );
      }

      console.error('Error deleting note:', error);
      return NextResponse.json(
        { error: 'Failed to delete note' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export const GET = withSecurity(handler, SECURITY_PRESETS.AUTHENTICATED);
export const POST = withSecurity(handler, SECURITY_PRESETS.AUTHENTICATED);
export const DELETE = withSecurity(handler, SECURITY_PRESETS.AUTHENTICATED);
