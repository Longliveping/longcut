import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';
import { getAllNotes } from '@/lib/api/notes';
import { db } from '@/lib/db';
import { videoAnalyses } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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

interface VideoAnalysis {
  id: string;
  youtubeId: string;
  title: string;
  author: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
}

function mapNoteWithVideo(note: NoteRow, video: VideoAnalysis | null) {
  return {
    id: note.id,
    userId: note.userId,
    videoId: note.videoId,
    source: note.source,
    sourceId: note.sourceId,
    text: note.text,
    metadata: note.metadata,
    createdAt: new Date(note.createdAt * 1000).toISOString(),
    updatedAt: new Date(note.updatedAt * 1000).toISOString(),
    video: video ? {
      youtubeId: video.youtubeId,
      title: video.title,
      author: video.author,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
    } : null,
  };
}

async function handler(req: NextRequest) {
  const session = await getSession();

  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      // Fetch all notes for the user
      const notes = await getAllNotes(userId);

      // Get unique video IDs from notes (filter out null values)
      const videoIds = [...new Set(notes.map(note => note.videoId).filter((id): id is string => id !== null))];

      // Fetch all videos in parallel
      const videos = await Promise.all(
        videoIds.map(videoId =>
          db.select().from(videoAnalyses).where(eq(videoAnalyses.id, videoId)).limit(1)
        )
      );

      // Create a map of video ID to video data
      const videoMap = new Map<string, VideoAnalysis>();
      videos.forEach(result => {
        if (result[0]) {
          videoMap.set(result[0].id, {
            id: result[0].id,
            youtubeId: result[0].youtubeId,
            title: result[0].title,
            author: result[0].author,
            thumbnailUrl: result[0].thumbnailUrl,
            duration: result[0].duration,
          });
        }
      });

      // Map notes with video data, sorting by created_at descending
      const notesWithVideo = notes
        .map(note => mapNoteWithVideo(note as NoteRow, note.videoId ? (videoMap.get(note.videoId) || null) : null))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return NextResponse.json({ notes: notesWithVideo });
    } catch (error) {
      console.error('Error fetching all notes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch notes' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export const GET = withSecurity(handler, SECURITY_PRESETS.AUTHENTICATED);
