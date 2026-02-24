import { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { videoAnalyses } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { buildVideoSlug } from '@/lib/utils';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch all videos with their slugs and update times
  const videos = await db
    .select({
      youtubeId: videoAnalyses.youtubeId,
      title: videoAnalyses.title,
      updatedAt: videoAnalyses.updatedAt,
    })
    .from(videoAnalyses)
    .orderBy(desc(videoAnalyses.updatedAt))
    .limit(50000); // Google's sitemap limit

  const normalizeSlug = (video: { youtubeId: string; title: string | null }) => {
    const youtubeId = video.youtubeId ?? '';
    const canonicalSlug = youtubeId ? buildVideoSlug(video.title, youtubeId) : null;
    return canonicalSlug || null;
  };

  // Generate URLs for all video pages
  const videoUrls: MetadataRoute.Sitemap = videos
    .map(video => {
      const slug = normalizeSlug(video);

      if (!slug) {
        return null;
      }

      return {
        url: `https://longcut.ai/v/${slug}`,
        lastModified: new Date(video.updatedAt * 1000),
        changeFrequency: 'monthly' as const,
        priority: 0.8
      };
    })
    .filter(Boolean) as MetadataRoute.Sitemap;

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: 'https://longcut.ai',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0
    },
    {
      url: 'https://longcut.ai/pricing',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9
    },
    {
      url: 'https://longcut.ai/library',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7
    }
  ];

  return [...staticPages, ...videoUrls];
}

// Generate at request time, revalidate every hour
export const dynamic = 'force-dynamic';
export const revalidate = 3600;
