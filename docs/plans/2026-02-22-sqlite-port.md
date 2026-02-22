# SQLite Port Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Supabase with SQLite as the primary database while maintaining all application functionality.

**Architecture:** Use Drizzle ORM for type-safe database access and better-auth for simple local authentication. All existing API routes and components remain unchanged from the UI perspective.

**Tech Stack:** Drizzle ORM, better-sqlite3, better-auth, drizzle-kit

---

## Prerequisites

### Task 0: Create Git Worktree

**Files:**
- Create: `../longcut-sqlite/` (new worktree directory)

**Step 1: Create worktree from main branch**

```bash
cd /root/workspace/longcut
git worktree add ../longcut-sqlite -b feature/sqlite-port
```

Expected: New directory `../longcut-sqlite` created with `feature/sqlite-port` branch checked out

**Step 2: Navigate to worktree**

```bash
cd /root/workspace/longcut-sqlite
git status
```

Expected: Shows "On branch feature/sqlite-port" with clean working tree

**Step 3: Verify worktree listing**

```bash
cd /root/workspace/longcut
git worktree list
```

Expected: Shows two worktrees - main repo and the new sqlite-port worktree

---

## Phase 1: Foundation (Dependencies & Configuration)

### Task 1: Install Drizzle ORM Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install core dependencies**

```bash
cd /root/workspace/longcut-sqlite
npm install drizzle-orm better-sqlite3 better-auth
```

Expected: Packages installed successfully

**Step 2: Install dev dependencies**

```bash
npm install -D drizzle-kit @types/better-sqlite3
```

Expected: Dev packages installed successfully

**Step 3: Commit dependencies**

```bash
git add package.json package-lock.json
git commit -m "deps: add drizzle-orm, better-sqlite3, better-auth"
```

### Task 2: Create Drizzle Configuration

**Files:**
- Create: `drizzle.config.ts`

**Step 1: Create config file**

```typescript
import type { Config } from 'drizzle-kit'

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'sqlite',
  driver: 'better-sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || './local.db',
  },
} satisfies Config
```

**Step 2: Create .env.local entry**

```bash
# Add to .env.local
echo "DATABASE_URL=./local.db" >> .env.local
```

**Step 3: Verify config**

```bash
npx drizzle-kit studio
```

Expected: Drizzle Studio starts (may show empty DB)

**Step 4: Commit**

```bash
git add drizzle.config.ts .env.local
git commit -m "feat: add drizzle configuration"
```

### Task 3: Create Database Schema

**Files:**
- Create: `lib/db/schema.ts`

**Step 1: Create schema file**

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  expiresAt: integer('expires_at').notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
})

export const videoAnalyses = sqliteTable('video_analyses', {
  id: text('id').primaryKey(),
  youtubeId: text('youtube_id').notNull().unique(),
  userId: text('user_id').references(() => users.id),
  title: text('title').notNull(),
  author: text('author'),
  thumbnailUrl: text('thumbnail_url'),
  duration: integer('duration'),
  transcript: text('transcript'), // JSON string
  topics: text('topics'), // JSON string
  summary: text('summary'), // JSON string
  suggestedQuestions: text('suggested_questions'), // JSON string
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const userVideos = sqliteTable('user_videos', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  videoAnalysisId: text('video_analysis_id').notNull().references(() => videoAnalyses.id),
  isFavorite: integer('is_favorite').notNull().default(0),
  createdAt: integer('created_at').notNull(),
})

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  videoId: text('video_id').notNull().references(() => videoAnalyses.id),
  source: text('source').notNull(), // 'chat' | 'takeaways' | 'transcript' | 'custom'
  sourceId: text('source_id'),
  text: text('text').notNull(),
  metadata: text('metadata'), // JSON string
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})
```

**Step 2: Generate initial migration**

```bash
npx drizzle-kit generate
```

Expected: Creates migration file in `lib/db/migrations/`

**Step 3: Commit**

```bash
git add lib/db/schema.ts lib/db/migrations/
git commit -m "feat: define database schema"
```

### Task 4: Create Database Client

**Files:**
- Create: `lib/db/index.ts`

**Step 1: Create database client**

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'

const dbPath = process.env.DATABASE_URL || './local.db'

const sqlite = new Database(dbPath)

// Enable foreign keys
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

export default db
```

**Step 2: Test the client**

```bash
node -e "const db = require('./lib/db/index.ts').default; console.log('DB connected')"
```

Expected: No errors, DB file created if not exists

**Step 3: Commit**

```bash
git add lib/db/index.ts
git commit -m "feat: create database client"
```

### Task 5: Add Migration Runner

**Files:**
- Create: `lib/db/migrate.ts`

**Step 1: Create migration script**

```typescript
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import Database from 'better-sqlite3'
import { db } from './index'

export async function runMigrations() {
  await migrate(db, { migrationsFolder: './lib/db/migrations' })
  console.log('Migrations completed')
}

// Run if called directly
if (require.main === module) {
  runMigrations().then(() => process.exit(0))
}
```

**Step 2: Run migrations**

```bash
npx tsx lib/db/migrate.ts
```

Expected: "Migrations completed" message

**Step 3: Verify tables created**

```bash
sqlite3 local.db ".tables"
```

Expected: Shows all tables (users, sessions, video_analyses, user_videos, notes)

**Step 4: Commit**

```bash
git add lib/db/migrate.ts local.db
git commit -m "feat: add migration runner"
```

---

## Phase 2: Authentication (better-auth)

### Task 6: Configure better-auth

**Files:**
- Create: `lib/auth/config.ts`

**Step 1: Create auth config**

```typescript
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '../db'
import * as schema from '../db/schema'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: schema.users,
      session: schema.sessions,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  advanced: {
    cookiePrefix: 'longcut',
    crossSubDomainCookies: {
      enabled: false,
    },
  },
})

export type Session = typeof auth.$Infer.Session
```

**Step 2: Create server helpers**

Create `lib/auth/server.ts`:

```typescript
import { auth } from './config'
import { headers } from 'next/headers'

export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  return session
}

export async function requireSession() {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}
```

**Step 3: Commit**

```bash
git add lib/auth/
git commit -m "feat: configure better-auth"
```

### Task 7: Create Auth API Routes

**Files:**
- Create: `app/api/auth/sign-in/route.ts`
- Create: `app/api/auth/sign-up/route.ts`
- Create: `app/api/auth/sign-out/route.ts`

**Step 1: Create sign-in route**

```typescript
import { auth } from '@/lib/auth/config'
import { headers } from 'next/headers'

export async function POST(req: Request) {
  const body = await req.json()
  const result = await auth.api.signInEmail({
    body: {
      email: body.email,
      password: body.password,
    },
    headers: await headers(),
  })
  return Response.json(result)
}
```

**Step 2: Create sign-up route**

```typescript
import { auth } from '@/lib/auth/config'
import { headers } from 'next/headers'

export async function POST(req: Request) {
  const body = await req.json()
  const result = await auth.api.signUpEmail({
    body: {
      email: body.email,
      password: body.password,
      name: body.name,
    },
    headers: await headers(),
  })
  return Response.json(result)
}
```

**Step 3: Create sign-out route**

```typescript
import { auth } from '@/lib/auth/config'
import { headers } from 'next/headers'

export async function POST(req: Request) {
  const result = await auth.api.signOut({
    headers: await headers(),
  })
  return Response.json(result)
}
```

**Step 4: Commit**

```bash
git add app/api/auth/
git commit -m "feat: add auth API routes"
```

---

## Phase 3: Data Access Layer

### Task 8: Create User CRUD Operations

**Files:**
- Create: `lib/api/users.ts`

**Step 1: Create user operations**

```typescript
import { db } from '../db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '../utils'

export async function createUser(data: {
  email: string
  passwordHash: string
  name?: string
}) {
  const now = Math.floor(Date.now() / 1000)
  const user = {
    id: generateId(),
    email: data.email,
    passwordHash: data.passwordHash,
    name: data.name || null,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(users).values(user)
  return user
}

export async function getUserByEmail(email: string) {
  const result = await db.select().from(users).where(eq(users.email, email))
  return result[0] || null
}

export async function getUserById(id: string) {
  const result = await db.select().from(users).where(eq(users.id, id))
  return result[0] || null
}

export async function updateUser(userId: string, data: { name?: string }) {
  const now = Math.floor(Date.now() / 1000)
  const result = await db.update(users)
    .set({ ...data, updatedAt: now })
    .where(eq(users.id, userId))
    .returning()
  return result[0]
}
```

**Step 2: Commit**

```bash
git add lib/api/users.ts
git commit -m "feat: add user CRUD operations"
```

### Task 9: Create Video CRUD Operations

**Files:**
- Create: `lib/api/videos.ts`

**Step 1: Create video operations**

```typescript
import { db } from '../db'
import { videoAnalyses, userVideos } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { generateId } from '../utils'
import type { VideoAnalysis, Topic, TranscriptSegment } from '../types'

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
    id: generateId(),
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
  return result[0]
}

export async function linkVideoToUser(userId: string, videoAnalysisId: string) {
  const now = Math.floor(Date.now() / 1000)
  const link = {
    id: generateId(),
    userId,
    videoAnalysisId,
    isFavorite: 0,
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

  const newFavorite = existing[0].isFavorite === 0 ? 1 : 0
  const result = await db.update(userVideos)
    .set({ isFavorite: newFavorite })
    .where(and(
      eq(userVideos.userId, userId),
      eq(userVideos.videoAnalysisId, videoAnalysisId)
    ))
    .returning()
  return result[0]
}
```

**Step 2: Commit**

```bash
git add lib/api/videos.ts
git commit -m "feat: add video CRUD operations"
```

### Task 10: Create Notes CRUD Operations

**Files:**
- Create: `lib/api/notes.ts`

**Step 1: Create notes operations**

```typescript
import { db } from '../db'
import { notes } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { generateId } from '../utils'
import type { Note, NoteSource } from '../types'

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
    id: generateId(),
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
    metadata: n.metadata ? JSON.parse(n.metadata) : null,
  }))
}

export async function getAllNotes(userId: string) {
  const result = await db.select()
    .from(notes)
    .where(eq(notes.userId, userId))
  return result.map(n => ({
    ...n,
    metadata: n.metadata ? JSON.parse(n.metadata) : null,
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
```

**Step 2: Commit**

```bash
git add lib/api/notes.ts
git commit -m "feat: add notes CRUD operations"
```

---

## Phase 4: API Route Migration

### Task 11: Migrate /api/check-video-cache

**Files:**
- Modify: `app/api/check-video-cache/route.ts`

**Step 1: Write failing test**

Create `tests/api/check-video-cache.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestDB } from '../setup'
import { db } from '../../lib/db'
import { createVideoAnalysis } from '../../lib/api/videos'

describe('GET /api/check-video-cache', () => {
  beforeAll(async () => {
    const testDb = createTestDB()
    await createVideoAnalysis({
      youtubeId: 'test_123',
      title: 'Test Video',
    })
  })

  afterAll(async () => {
    await db.delete(videoAnalyses).where(eq(videoAnalyses.youtubeId, 'test_123'))
  })

  it('should return cached video analysis', async () => {
    const response = await fetch(`http://localhost:3000/api/check-video-cache?youtubeId=test_123`)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.youtubeId).toBe('test_123')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test tests/api/check-video-cache.test.ts
```

Expected: FAIL - route still uses Supabase

**Step 3: Implement route**

```typescript
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
```

**Step 4: Run test to verify it passes**

```bash
npm test tests/api/check-video-cache.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add app/api/check-video-cache/route.ts tests/api/check-video-cache.test.ts
git commit -m "feat: migrate check-video-cache to SQLite"
```

### Task 12: Migrate /api/video-analysis

**Files:**
- Modify: `app/api/video-analysis/route.ts`

**Step 1: Update route implementation**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getVideoByYoutubeId, createVideoAnalysis, updateVideoAnalysis } from '@/lib/api/videos'

export async function GET(req: NextRequest) {
  const youtubeId = req.nextUrl.searchParams.get('youtubeId')

  if (!youtubeId) {
    return NextResponse.json({ error: 'Missing youtubeId' }, { status: 400 })
  }

  const analysis = await getVideoByYoutubeId(youtubeId)

  if (!analysis) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(analysis)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const existing = await getVideoByYoutubeId(body.youtubeId)

  if (existing) {
    const updated = await updateVideoAnalysis(existing.id, body)
    return NextResponse.json(updated)
  }

  const created = await createVideoAnalysis(body)
  return NextResponse.json(created, { status: 201 })
}
```

**Step 2: Add test**

Create `tests/api/video-analysis.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '../../lib/db'
import { videoAnalyses } from '../../lib/db/schema'
import { eq } from 'drizzle-orm'

describe('POST /api/video-analysis', () => {
  afterEach(async () => {
    await db.delete(videoAnalyses).where(eq(videoAnalyses.youtubeId, 'test_new'))
  })

  it('should create new video analysis', async () => {
    const response = await fetch('http://localhost:3000/api/video-analysis', {
      method: 'POST',
      body: JSON.stringify({
        youtubeId: 'test_new',
        title: 'New Test Video',
      }),
    })

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.youtubeId).toBe('test_new')
  })

  it('should update existing analysis', async () => {
    // Create first
    await fetch('http://localhost:3000/api/video-analysis', {
      method: 'POST',
      body: JSON.stringify({
        youtubeId: 'test_new',
        title: 'Original Title',
      }),
    })

    // Update
    const response = await fetch('http://localhost:3000/api/video-analysis', {
      method: 'POST',
      body: JSON.stringify({
        youtubeId: 'test_new',
        title: 'Updated Title',
      }),
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.title).toBe('Updated Title')
  })
})
```

**Step 3: Run tests**

```bash
npm test tests/api/video-analysis.test.ts
```

Expected: PASS

**Step 4: Commit**

```bash
git add app/api/video-analysis/route.ts tests/api/video-analysis.test.ts
git commit -m "feat: migrate video-analysis to SQLite"
```

### Task 13: Migrate /api/notes

**Files:**
- Modify: `app/api/notes/route.ts`

**Step 1: Update route implementation**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/server'
import { getNotesByVideo, createNote, deleteNote } from '@/lib/api/notes'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const youtubeId = req.nextUrl.searchParams.get('youtubeId')

  if (!youtubeId) {
    return NextResponse.json({ error: 'Missing youtubeId' }, { status: 400 })
  }

  // Get video by youtubeId first to get the video ID
  const { getVideoByYoutubeId } = await import('@/lib/api/videos')
  const video = await getVideoByYoutubeId(youtubeId)

  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  const notes = await getNotesByVideo(session.user.id, video.id)
  return NextResponse.json({ notes })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  // Get video by youtubeId
  const { getVideoByYoutubeId } = await import('@/lib/api/videos')
  const video = await getVideoByYoutubeId(body.youtubeId)

  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  const note = await createNote({
    userId: session.user.id,
    videoId: video.id,
    source: body.source,
    sourceId: body.sourceId,
    text: body.text,
    metadata: body.metadata,
  })

  return NextResponse.json(note, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  const deleted = await deleteNote(body.noteId, session.user.id)

  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
```

**Step 2: Add /api/notes/all route**

Create `app/api/notes/all/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/server'
import { getAllNotes } from '@/lib/api/notes'

export async function GET() {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const notes = await getAllNotes(session.user.id)
  return NextResponse.json({ notes })
}
```

**Step 3: Add tests**

Create `tests/api/notes.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '../../lib/db'
import { notes, users, videoAnalyses } from '../../lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '../../lib/utils'

describe('POST /api/notes', () => {
  let testUserId: string
  let testVideoId: string

  beforeEach(async () => {
    testUserId = generateId()
    testVideoId = generateId()

    // Create test user
    await db.insert(users).values({
      id: testUserId,
      email: `test-${testUserId}@example.com`,
      passwordHash: 'hash',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Create test video
    await db.insert(videoAnalyses).values({
      id: testVideoId,
      youtubeId: 'test_notes_video',
      title: 'Test Video',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  })

  afterEach(async () => {
    await db.delete(notes).where(eq(notes.userId, testUserId))
    await db.delete(users).where(eq(users.id, testUserId))
    await db.delete(videoAnalyses).where(eq(videoAnalyses.id, testVideoId))
  })

  it('should create note with valid session', async () => {
    // This test would need auth session setup
    // For now, test the underlying function
    const { createNote } = await import('../../lib/api/notes')

    const note = await createNote({
      userId: testUserId,
      videoId: testVideoId,
      source: 'custom',
      text: 'Test note content',
    })

    expect(note).toBeDefined()
    expect(note.text).toBe('Test note content')
  })
})
```

**Step 4: Run tests**

```bash
npm test tests/api/notes.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add app/api/notes/route.ts app/api/notes/all/route.ts tests/api/notes.test.ts
git commit -m "feat: migrate notes API to SQLite"
```

### Task 14: Migrate /api/toggle-favorite

**Files:**
- Modify: `app/api/toggle-favorite/route.ts`

**Step 1: Update route implementation**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/server'
import { toggleVideoFavorite, getVideoByYoutubeId, linkVideoToUser } from '@/lib/api/videos'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { youtubeId } = body

  if (!youtubeId) {
    return NextResponse.json({ error: 'Missing youtubeId' }, { status: 400 })
  }

  const video = await getVideoByYoutubeId(youtubeId)

  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  // Ensure video is linked to user
  await linkVideoToUser(session.user.id, video.id)

  // Toggle favorite
  const result = await toggleVideoFavorite(session.user.id, video.id)

  return NextResponse.json({
    isFavorite: result?.isFavorite === 1,
  })
}
```

**Step 2: Commit**

```bash
git add app/api/toggle-favorite/route.ts
git commit -m "feat: migrate toggle-favorite to SQLite"
```

### Task 15: Remove Supabase Client References

**Files:**
- Delete: `lib/supabase/` directory

**Step 1: Remove Supabase directory**

```bash
rm -rf lib/supabase
```

**Step 2: Verify no imports remain**

```bash
grep -r "from.*supabase" app/ components/ contexts/ lib/ --exclude-dir=node_modules
```

Expected: No results (or only in comments)

**Step 3: Fix any remaining imports**

If any imports found, update them to use new libraries.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove Supabase client directory"
```

---

## Phase 5: Frontend Integration

### Task 16: Update Auth Context

**Files:**
- Modify: `contexts/auth-context.tsx`

**Step 1: Update auth context to use better-auth**

```typescript
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@/lib/auth/config'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check session on mount
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user)
      })
      .finally(() => setLoading(false))
  }, [])

  const signIn = async (email: string, password: string) => {
    const res = await fetch('/api/auth/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.message || 'Sign in failed')
    }

    const data = await res.json()
    setUser(data.user)
  }

  const signUp = async (email: string, password: string, name?: string) => {
    const res = await fetch('/api/auth/sign-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.message || 'Sign up failed')
    }

    const data = await res.json()
    setUser(data.user)
  }

  const signOut = async () => {
    await fetch('/api/auth/sign-out', { method: 'POST' })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

**Step 2: Add session API route**

Create `app/api/auth/session/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/server'

export async function GET() {
  const session = await getSession()
  return NextResponse.json({ user: session?.user || null })
}
```

**Step 3: Commit**

```bash
git add contexts/auth-context.tsx app/api/auth/session/route.ts
git commit -m "feat: update auth context for better-auth"
```

### Task 17: Update Middleware

**Files:**
- Modify: `middleware.ts`

**Step 1: Replace Supabase session refresh with better-auth**

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Add security headers
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // better-auth handles session cookies automatically
  // No manual refresh needed like Supabase

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Step 2: Commit**

```bash
git add middleware.ts
git commit -m "refactor: update middleware for better-auth"
```

---

## Phase 6: Testing & Cleanup

### Task 18: Run Full Test Suite

**Files:**
- Test: All tests

**Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass

**Step 2: Fix any failing tests**

If tests fail, debug and fix issues one at a time.

**Step 3: Commit fixes**

```bash
git add .
git commit -m "test: fix failing tests after SQLite migration"
```

### Task 19: Run Type Checking

**Files:**
- All TypeScript files

**Step 1: Run type check**

```bash
npx tsc --noEmit
```

Expected: No type errors

**Step 2: Fix any type errors**

Commit fixes separately.

**Step 3: Commit**

```bash
git add .
git commit -m "fix: resolve type checking errors"
```

### Task 20: Remove Supabase Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Remove Supabase packages**

```bash
npm uninstall @supabase/supabase-js @supabase/ssr
```

Expected: Packages removed successfully

**Step 2: Update .env.local**

Remove or comment out Supabase-related env vars:
```bash
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

**Step 3: Commit**

```bash
git add package.json package-lock.json .env.local
git commit -m "deps: remove Supabase dependencies"
```

### Task 21: Documentation Updates

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Update README.md**

Replace Supabase setup with SQLite/better-auth setup instructions.

**Step 2: Update CLAUDE.md**

Update architecture documentation to reflect new stack.

**Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: update for SQLite stack"
```

### Task 22: Clean Up Supabase Files

**Files:**
- Delete: `supabase/` directory

**Step 1: Remove Supabase directory**

```bash
rm -rf supabase/
```

**Step 2: Verify clean state**

```bash
git status
```

Expected: Only expected changes shown

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove Supabase migration files"
```

---

## Phase 7: Final Verification

### Task 23: End-to-End Testing

**Files:**
- Test: E2E tests

**Step 1: Run E2E tests**

```bash
npm run test:e2e
```

Expected: All E2E tests pass with new auth

**Step 2: Manual testing checklist**

- [ ] Sign up new account
- [ ] Sign in with valid credentials
- [ ] Sign in with invalid credentials (fails)
- [ ] Analyze a video (cached/uncached)
- [ ] Create notes
- [ ] Toggle favorites
- [ ] Sign out
- [ ] Persist session across page reloads

**Step 3: Fix any issues found**

Commit fixes separately.

**Step 4: Final commit**

```bash
git add .
git commit -m "test: pass E2E tests with SQLite migration"
```

### Task 24: Merge Preparation

**Files:**
- Git workflow

**Step 1: Switch to main branch**

```bash
cd /root/workspace/longcut
git checkout main
git pull
```

**Step 2: Review changes**

```bash
git diff main..feature/sqlite-port --stat
```

Expected: Shows all modified/deleted/added files

**Step 3: Merge feature branch**

```bash
git merge feature/sqlite-port
```

**Step 4: Clean up worktree**

```bash
git worktree remove ../longcut-sqlite
```

**Step 5: Delete feature branch**

```bash
git branch -d feature/sqlite-port
```

**Step 6: Final commit**

```bash
git commit -m "chore: merge SQLite port feature branch"
```

---

## Summary

This implementation plan:

1. Creates isolated git worktree for development
2. Sets up Drizzle ORM with SQLite
3. Configures better-auth for authentication
4. Migrates all Supabase-dependent API routes
5. Updates frontend auth context
6. Maintains test coverage throughout
7. Cleanly removes Supabase dependencies

**Total tasks:** 24
**Estimated time:** 4-6 hours
**Commit frequency:** Every task (DRY, frequent commits)
