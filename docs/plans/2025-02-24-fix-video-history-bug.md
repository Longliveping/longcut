# Fix Video History Duplicate and Toast Bug Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the bug where opening a video from history shows an unwanted "Video saved" toast and creates duplicate entries in the user's video library.

**Architecture:** (1) Add unique constraint to `userVideos` table schema, (2) Modify `/api/link-video` endpoint to return `alreadyLinked` status, (3) Run database migration to clean up existing duplicates.

**Tech Stack:** Next.js 15, Drizzle ORM, SQLite, TypeScript

---

## Task 1: Update Database Schema with Unique Constraint

**Files:**
- Modify: `lib/db/schema.ts:56-62`

**Step 1: Read current schema to understand imports**

```bash
head -5 lib/db/schema.ts
```

Expected: See current imports from `drizzle-orm/sqlite-core`

**Step 2: Add uniqueIndex import to schema imports**

Edit the import line at the top of `lib/db/schema.ts` to include `uniqueIndex`:

```typescript
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'
```

**Step 3: Add unique constraint to userVideos table definition**

Replace the `userVideos` table definition (around lines 56-62) with:

```typescript
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

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No TypeScript errors

**Step 5: Commit schema changes**

```bash
git add lib/db/schema.ts
git commit -m "feat: add unique constraint on userVideos (userId, videoAnalysisId)"
```

---

## Task 2: Generate Drizzle Migration

**Files:**
- Create: `drizzle/<timestamp>_add_unique_user_videos_index.sql`

**Step 1: Generate migration using Drizzle**

```bash
npx drizzle-kit generate
```

Expected: New migration file created in `drizzle/` directory

**Step 2: Review generated migration file**

```bash
cat drizzle/*.sql | tail -20
```

Expected: SQL containing `CREATE UNIQUE INDEX` statement

**Step 3: Add custom SQL to clean duplicates before index creation**

Edit the generated migration file to add duplicate cleanup at the top:

```sql
-- Clean up existing duplicates (keep earliest entry)
DELETE FROM user_videos
WHERE id NOT IN (
  SELECT MIN(id) FROM user_videos
  GROUP BY user_id, video_analysis_id
);

-- Then the generated CREATE UNIQUE INDEX statement
```

**Step 4: Commit migration**

```bash
git add drizzle/
git commit -m "feat: add migration for unique user videos index with duplicate cleanup"
```

---

## Task 3: Update link-video API Endpoint

**Files:**
- Modify: `app/api/link-video/route.ts`

**Step 1: Read current endpoint implementation**

```bash
cat app/api/link-video/route.ts
```

Expected: See current handler that calls `linkVideoToUser` without checking existing links

**Step 2: Add imports for db and userVideos**

Add these imports at the top of the file:

```typescript
import { db } from '@/lib/db';
import { userVideos } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
```

**Step 3: Modify handler to check existing links**

Replace the handler function (after the `getVideoByYoutubeId` check) with:

```typescript
async function handler(req: NextRequest) {
  try {
    const { videoId } = await req.json();

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    const session = await requireSession();
    const user = session.user;

    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Check if video exists in video_analyses table
    const video = await getVideoByYoutubeId(videoId);

    if (!video) {
      return NextResponse.json(
        {
          error: 'Video not found in analyses',
          details: 'The video must be analyzed before it can be linked to your account',
          videoId
        },
        { status: 404 }
      );
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

  } catch (error) {
    console.error('Error in link-video endpoint:', error);
    return NextResponse.json(
      { error: 'An error occurred while linking the video' },
      { status: 500 }
    );
  }
}
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No TypeScript errors

**Step 5: Commit API changes**

```bash
git add app/api/link-video/route.ts
git commit -m "feat: return alreadyLinked status in link-video endpoint"
```

---

## Task 4: Apply Database Migration

**Files:**
- Modify: `<database file>` (defaults to `./local.db`)

**Step 1: Stop development server if running**

```bash
pkill -f "next dev" || true
```

**Step 2: Apply migration using Drizzle push**

```bash
npx drizzle-kit push
```

Expected: Confirmation that schema was updated successfully

**Step 3: Verify unique index exists**

```bash
sqlite3 local.db ".indexes user_videos"
```

Expected: See `unique_user_video` index listed

**Step 4: Verify no duplicate entries exist**

```bash
sqlite3 local.db "SELECT user_id, video_analysis_id, COUNT(*) as count FROM user_videos GROUP BY user_id, video_analysis_id HAVING count > 1;"
```

Expected: Empty result (no duplicates)

**Step 5: Commit any config changes if needed**

```bash
git add drizzle.config.ts 2>/dev/null || true
git commit -m "chore: update drizzle config after migration" || true
```

---

## Task 5: Manual Testing

**Files:**
- Test: Manual browser testing

**Step 1: Start development server**

```bash
npm run dev
```

Expected: Server starts on http://localhost:3000

**Step 2: Test scenario 1 - Open video from history**

1. Navigate to http://localhost:3000/my-videos
2. Click on an existing video in your library
3. Observe: NO "Video saved to your library!" toast should appear

**Step 3: Test scenario 2 - Verify no duplicates**

1. Refresh the My Videos page
2. Observe: Each video appears only once in the list

**Step 4: Test scenario 3 - New video analysis**

1. Navigate to home page
2. Analyze a new video (not previously analyzed)
3. Observe: "Video saved to your library!" toast appears once
4. Navigate to My Videos
5. Observe: New video appears exactly once

**Step 5: Check browser console for errors**

Open browser DevTools Console and verify no errors related to video linking

---

## Task 6: Final Verification and Cleanup

**Files:**
- None (verification only)

**Step 1: Run ESLint to check for code quality issues**

```bash
npm run lint
```

Expected: No new linting errors

**Step 2: Build production bundle to verify**

```bash
npm run build
```

Expected: Build succeeds without errors

**Step 3: Verify git status**

```bash
git status
```

Expected: All changes committed

**Step 4: View final commit history**

```bash
git log --oneline -5
```

Expected: Commits from this implementation plan visible

---

## Implementation Notes

- **Client code compatibility:** The client at `app/analyze/[videoId]/page.tsx:522-525` already checks `data.alreadyLinked` before showing toast, so no client changes are needed
- **onConflictDoNothing:** The `linkVideoToUser` function uses `.onConflictDoNothing()` which will now work correctly with the unique constraint
- **Migration safety:** The duplicate cleanup SQL keeps the earliest entry (lowest ID) for each user/video pair
- **Race conditions:** The unique constraint prevents duplicates even with concurrent requests

## Testing Checklist

- [ ] Schema change compiles without errors
- [ ] Migration generated successfully
- [ ] Migration applied to database
- [ ] API endpoint returns `alreadyLinked: true` for existing links
- [ ] Opening video from history shows NO toast
- [ ] No duplicate entries in My Videos page
- [ ] New video analysis shows toast once
- [ ] ESLint passes
- [ ] Production build succeeds
