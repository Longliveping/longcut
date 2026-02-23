import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { userVideos, videoAnalyses } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { VideoGrid } from './video-grid';

interface VideoAnalysis {
  id: string;
  youtube_id: string;
  title: string;
  author: string;
  duration: number;
  thumbnail_url: string;
  topics: any;
  created_at: string;
  slug: string | null;
}

interface UserVideo {
  id: string;
  user_id: string;
  video_id: string;
  accessed_at: string;
  is_favorite: boolean;
  notes: string | null;
  video: VideoAnalysis;
}

export default async function MyVideosPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/');
  }
  const user = session.user;

  // Fetch user's video history with video details using SQLite
  const userData = await db
    .select({
      id: userVideos.id,
      user_id: userVideos.userId,
      video_analysis_id: userVideos.videoAnalysisId,
      is_favorite: userVideos.isFavorite,
      created_at: userVideos.createdAt,
      video: {
        id: videoAnalyses.id,
        youtube_id: videoAnalyses.youtubeId,
        title: videoAnalyses.title,
        author: videoAnalyses.author,
        duration: videoAnalyses.duration,
        thumbnail_url: videoAnalyses.thumbnailUrl,
        topics: videoAnalyses.topics,
        created_at: videoAnalyses.createdAt,
      }
    })
    .from(userVideos)
    .leftJoin(videoAnalyses, eq(userVideos.videoAnalysisId, videoAnalyses.id))
    .where(eq(userVideos.userId, user.id))
    .orderBy(desc(userVideos.createdAt));

  // Convert to expected format
  const formattedUserVideos: UserVideo[] = userData
    .filter((row): row is typeof row & { video: NonNullable<typeof row.video> } => row.video !== null)
    .map(row => ({
      id: row.id,
      user_id: row.user_id,
      video_id: row.video_analysis_id,
      accessed_at: new Date(Number(row.created_at) * 1000).toISOString(),
      is_favorite: Boolean(row.is_favorite),
      notes: null,
      video: {
        id: row.video.id ?? '',
        youtube_id: row.video.youtube_id ?? '',
        title: row.video.title ?? '',
        author: row.video.author ?? '',
        duration: row.video.duration ?? 0,
        thumbnail_url: row.video.thumbnail_url ?? '',
        topics: row.video.topics ?? null,
        created_at: new Date(Number(row.video.created_at) * 1000).toISOString(),
        slug: null,
      }
    }));

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Videos</h1>
        <p className="text-muted-foreground">
          Your analyzed videos are saved here. Click on any video to continue where you left off.
        </p>
      </div>

      {formattedUserVideos && formattedUserVideos.length > 0 ? (
        <VideoGrid videos={formattedUserVideos} />
      ) : (
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground mb-4">
            You haven&apos;t analyzed any videos yet.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            Analyze Your First Video
          </Link>
        </div>
      )}
    </div>
  );
}
