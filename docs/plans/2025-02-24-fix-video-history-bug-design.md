# Design: Fix Video History Duplicate and Toast Bug

**Date:** 2025-02-24
**Status:** Approved

## Problem Statement

When opening a video from the user's history (My Videos page):
1. A "Video saved to your library!" toast appears incorrectly (video is already saved)
2. Duplicate video entries appear in the history list

## Root Cause

1. **Missing unique constraint:** The `userVideos` table lacks a unique constraint on `(userId, videoAnalysisId)`, allowing duplicate entries
2. **Missing API response field:** `/api/link-video` doesn't return `alreadyLinked: true`, so the client always shows the toast

## Solution: Complete Fix (Option 1)

Fix both the database constraint AND the API response.

### Changes Required

#### 1. Database Schema (`lib/db/schema.ts`)

Add a unique constraint on the `userVideos` table:

```typescript
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const userVideos = sqliteTable('user_videos', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  videoAnalysisId: text('video_analysis_id').references(() => videoAnalyses.id),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  uniqueUserVideo: uniqueIndex('unique_user_video').on(table.userId, table.videoAnalysisId)
}));
```

#### 2. API Endpoint (`app/api/link-video/route.ts`)

Check if already linked and return status:

```typescript
import { db } from '@/lib/db';
import { userVideos } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function handler(req: NextRequest) {
  // ... existing validation ...

  const video = await getVideoByYoutubeId(videoId);
  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  // Check if already linked
  const existingLink = await db.select()
    .from(userVideos)
    .where(and(
      eq(userVideos.userId, user.id),
      eq(userVideos.videoAnalysisId, video.id)
    ))
    .limit(1);

  const alreadyLinked = existingLink.length > 0;

  // Only link if not already linked
  if (!alreadyLinked) {
    await linkVideoToUser(user.id, video.id);
  }

  return NextResponse.json({
    success: true,
    alreadyLinked,
    message: alreadyLinked
      ? 'Video already in your library'
      : 'Video successfully linked to your account'
  });
}
```

#### 3. Database Migration

Clean up existing duplicates and add unique index:

```sql
-- Remove duplicates, keeping earliest entry
DELETE FROM user_videos
WHERE id NOT IN (
  SELECT MIN(id) FROM user_videos
  GROUP BY user_id, video_analysis_id
);

-- Create unique index
CREATE UNIQUE INDEX unique_user_video ON user_videos(user_id, video_analysis_id);
```

## Testing Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| New user analyzes video | One entry created, toast shown once |
| Open video from history | No toast, no duplicate |
| Post-auth linking | Toast only if new link created |
| Concurrent requests | Unique constraint prevents duplicates |

## Implementation Notes

- Client code at `app/analyze/[videoId]/page.tsx:522-525` already checks `data.alreadyLinked`
- `linkVideoToUser` function uses `.onConflictDoNothing()` which will work correctly with the unique constraint
- No changes needed to client-side code or `linkVideoToUser` function
