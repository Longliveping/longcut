import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { videoAnalyses } from "@/lib/db/schema";
import { sql, count, eq } from "drizzle-orm";
import { withSecurity, SECURITY_PRESETS } from "@/lib/security-middleware";

interface VideoAnalysisRow {
  youtubeId: string;
  title: string | null;
  author: string | null;
  duration: number | null;
  thumbnailUrl: string | null;
  language: string | null;
}

const RANDOM_BATCH_SIZE = 5;
const MAX_RANDOM_ATTEMPTS = 6;
const FALLBACK_BATCH_SIZE = 40;

async function fetchVideoBatch(
  start: number,
  end: number
): Promise<VideoAnalysisRow[]> {
  // Select only needed columns - avoid fetching large transcript field
  const { data } = await db
    .select({
      youtubeId: videoAnalyses.youtubeId,
      title: videoAnalyses.title,
      author: videoAnalyses.author,
      duration: videoAnalyses.duration,
      thumbnailUrl: videoAnalyses.thumbnailUrl,
      language: videoAnalyses.language,
    })
    .from(videoAnalyses)
    .where(sql`(${videoAnalyses.topics} IS NOT NULL)`)
    .orderBy(sql`${videoAnalyses.createdAt} DESC`)
    .limit(end - start + 1)
    .offset(start);

  return data || [];
}

function selectEnglishVideo(batch: VideoAnalysisRow[]): VideoAnalysisRow | null {
  return batch.find((row) => {
    if (!row.language) {
      // If language is not set, assume English (older records)
      return true;
    }
    return row.language === 'en' || row.language.startsWith('en-');
  }) ?? null;
}

async function getRandomEnglishVideo(
  totalCount: number
): Promise<VideoAnalysisRow | null> {
  if (totalCount <= 0) {
    return null;
  }

  const lastIndex = totalCount - 1;

  for (let attempt = 0; attempt < MAX_RANDOM_ATTEMPTS; attempt += 1) {
    const randomIndex = Math.floor(Math.random() * totalCount);
    const startIndex = randomIndex;
    const endIndex = Math.min(lastIndex, randomIndex + RANDOM_BATCH_SIZE - 1);

    const batch = await fetchVideoBatch(startIndex, endIndex);
    const englishCandidate = selectEnglishVideo(batch);

    if (englishCandidate) {
      return englishCandidate;
    }
  }

  const fallbackEnd = Math.min(lastIndex, FALLBACK_BATCH_SIZE - 1);
  const fallbackBatch = await fetchVideoBatch(0, fallbackEnd);
  return selectEnglishVideo(fallbackBatch);
}

async function handler() {
  try {
    // Get total count of videos with topics
    const [{ value: totalCount }] = await db
      .select({ value: count() })
      .from(videoAnalyses)
      .where(sql`(${videoAnalyses.topics} IS NOT NULL)`);

    if (!totalCount || totalCount <= 0) {
      return NextResponse.json(
        { error: "No analyzed videos are available yet." },
        { status: 404 }
      );
    }

    const randomVideo = await getRandomEnglishVideo(totalCount);

    if (!randomVideo) {
      console.warn("No English video found for feeling lucky request.");
      return NextResponse.json(
        { error: "No English analyzed videos are available yet." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      youtubeId: randomVideo.youtubeId,
      title: randomVideo.title,
      author: randomVideo.author,
      duration: randomVideo.duration,
      thumbnail: randomVideo.thumbnailUrl,
      url: `https://www.youtube.com/watch?v=${randomVideo.youtubeId}`,
    });
  } catch (error) {
    console.error("Unexpected error while resolving feeling lucky request:", error);
    return NextResponse.json(
      { error: "Unable to load a sample video right now." },
      { status: 500 }
    );
  }
}

export const GET = withSecurity(handler, SECURITY_PRESETS.PUBLIC);
