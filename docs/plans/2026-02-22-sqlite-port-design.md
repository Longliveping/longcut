# SQLite Port Design

**Date:** 2026-02-22
**Author:** Claude Code
**Status:** Approved

## Overview

Replace Supabase with SQLite as the primary database while maintaining all current application functionality. Use Drizzle ORM for type-safe database access and better-auth for simple local authentication.

## Motivation

- Remove dependency on Supabase (user preference)
- Self-contained database with no external service dependency
- Simpler deployment model for traditional servers
- Direct file-based database access for easier debugging

## Architecture

### High-Level Approach

Replace Supabase clients and API calls with a local SQLite database accessed through Drizzle ORM. Auth moves from Supabase Auth to better-auth with session management via cookies.

### Key Changes

| Before | After |
|--------|-------|
| `lib/supabase/` | `lib/db/` (Drizzle instance) |
| Supabase Auth | better-auth with cookie sessions |
| Supabase client queries | Drizzle ORM queries |
| `supabase/migrations/` | `lib/db/migrations/` (drizzle-kit) |
| Middleware session refresh | better-auth `authRequest().validate()` |

### What Stays the Same

- All Next.js API routes (same endpoints, same contracts)
- Frontend components (same props, same data flow)
- User experience from UI perspective
- CSRF protection via existing middleware

## Database Schema

### Users Table

Replaces `auth.users` from Supabase Auth.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,           -- UUID v4
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,   -- argon2id hash
  name TEXT,
  created_at INTEGER NOT NULL,   -- Unix timestamp
  updated_at INTEGER NOT NULL
);
```

### Sessions Table

Managed by better-auth.

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT
);
```

### Video Analyses Table

Cache for processed video data.

```sql
CREATE TABLE video_analyses (
  id TEXT PRIMARY KEY,
  youtube_id TEXT UNIQUE NOT NULL,
  user_id TEXT,                   -- nullable for anonymous analyses
  title TEXT NOT NULL,
  author TEXT,
  thumbnail_url TEXT,
  duration INTEGER,
  transcript TEXT,                -- JSON string
  topics TEXT,                    -- JSON string
  summary TEXT,                   -- JSON string
  suggested_questions TEXT,       -- JSON string
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### User Videos Table

User history and favorites.

```sql
CREATE TABLE user_videos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  video_analysis_id TEXT NOT NULL REFERENCES video_analyses(id),
  is_favorite INTEGER DEFAULT 0,  -- 0 or 1 (SQLite has no bool)
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, video_analysis_id)
);
```

### Notes Table

User notes on video content.

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  video_id TEXT NOT NULL REFERENCES video_analyses(id),
  source TEXT NOT NULL,           -- 'chat' | 'takeaways' | 'transcript' | 'custom'
  source_id TEXT,                 -- optional reference
  text TEXT NOT NULL,
  metadata TEXT,                  -- JSON string
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Schema Notes

- Unix timestamps (integers) instead of datetime for simplicity
- Boolean values stored as 0/1 integers
- JSON fields stored as TEXT (SQLite has flexible JSON support via `json_extract()`)

## Directory Structure

### New Files

```
lib/
├── db/
│   ├── index.ts              # Drizzle instance export
│   ├── schema.ts             # All table definitions
│   └── migrations/           # SQL migration files (auto-generated)
├── auth/
│   ├── config.ts             # better-auth configuration
│   └── server.ts             # Auth server helpers
└── api/                      # NEW: Replaced lib/supabase/ functions
    ├── videos.ts             # Video analysis CRUD
    ├── notes.ts              # Notes CRUD
    └── users.ts              # User profile operations

drizzle.config.ts             # Drizzle kit configuration
```

### Removed Files

- `lib/supabase/` → entirely removed
- `supabase/migrations/` → replaced by `lib/db/migrations/`

### Modified Files

- `middleware.ts` → Update to use better-auth session handling
- All API routes → Replace Supabase client calls with Drizzle queries
- `contexts/auth-context.tsx` → Use better-auth React hooks

## Data Flows

### Authentication Flow

```
1. User submits email/password → /api/auth/sign-in
2. better-auth validates credentials via Drizzle
3. Session created in sessions table
4. HTTP-only cookie set with session token
5. Middleware validates cookie on protected routes
```

### Video Analysis Flow

```
1. Transcript fetched from Supadata (no change)
2. AI generates topics/summary (no change)
3. BEFORE: supabase.from('video_analyses').upsert()
   AFTER: db.insert(video_analyses).onConflictDoUpdate()
4. Cache check uses SELECT query with youtube_id
5. User videos linked via user_videos table
```

### Notes Flow

```
1. Frontend calls /api/notes with CSRF token (no change)
2. Route validates session from cookie
3. Drizzle query: db.insert(notes).values()
4. Response returns created note
```

## Error Handling

### Drizzle-Specific Errors

| Error Type | Example | Handling |
|------------|---------|----------|
| Unique constraint | Duplicate email/user | Return 400 with specific field error |
| Foreign key | Invalid video_id | Return 404, log for debugging |
| Not found | User/video doesn't exist | Return 404, generic message to user |
| Database locked | Concurrent writes | Retry with exponential backoff |

### Better-Auth Errors

| Error | Example | Handling |
|-------|---------|----------|
| Invalid credentials | Wrong password | Return 401 with "Invalid email or password" |
| Session expired | Old cookie | Clear cookie, redirect to sign-in |
| Email already exists | Registration collision | Return 400, prompt to sign in |

### Error Wrapper Pattern

```typescript
async function dbQuery<T>(fn: () => Promise<T>) {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new ApiError(400, 'Resource already exists')
    }
    if (error instanceof ForeignKeyConstraintError) {
      throw new ApiError(404, 'Referenced resource not found')
    }
    throw error  // Unknown errors - 500
  }
}
```

## Testing

### Database Testing

Use `:memory:` SQLite database for fast, isolated tests.

```typescript
// test/setup.ts
export function createTestDB() {
  const db = drizzle(sqlite(':memory:'), { schema })
  migrate(db, { migrationsFolder: 'lib/db/migrations' })
  return db
}
```

### Test Coverage Areas

1. **Auth tests** (`__tests__/auth.test.ts`)
   - Sign up with valid email
   - Sign up with duplicate email (fails)
   - Sign in with valid credentials
   - Sign in with wrong password (fails)
   - Session validation
   - Session expiry

2. **Video CRUD tests** (`__tests__/videos.test.ts`)
   - Create video analysis
   - Fetch cached analysis by youtube_id
   - Link video to user
   - Toggle favorite status
   - Anonymous vs user-owned videos

3. **Notes tests** (`__tests__/notes.test.ts`)
   - Create note with valid sources
   - Fetch notes by video
   - Fetch all notes across videos
   - Delete note
   - User isolation

4. **API route integration tests** (`tests/api/*.test.ts`)
   - Existing E2E tests adapted for new auth
   - CSRF protection validation

## Git Worktree Workflow

### Creating Worktree

```bash
# From main branch
git worktree add ../longcut-sqlite -b feature/sqlite-port
```

### Development

```bash
cd ../longcut-sqlite
# Work normally - commits go to feature/sqlite-port branch
```

### Cleanup

```bash
# When done or if abandoning
git worktree remove ../longcut-sqlite
```

## Implementation Dependencies

- `drizzle-orm` - ORM for SQLite
- `better-sqlite3` - SQLite driver
- `drizzle-kit` - Migration tool
- `better-auth` - Authentication library
- `@types/better-sqlite3` - TypeScript types

## Success Criteria

- All existing features work with SQLite
- Auth flow complete (sign up, sign in, sessions)
- Video cache persists correctly
- Notes CRUD functional
- All existing tests pass
- New tests for auth and database operations
- Clean removal of Supabase dependencies
