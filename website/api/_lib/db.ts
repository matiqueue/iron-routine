import { neon } from '@neondatabase/serverless';

export type NeonSql = ReturnType<typeof neon<false, false>>;

let cachedSql: NeonSql | null = null;
let schemaReadyPromise: Promise<void> | null = null;

export function getSql(): NeonSql {
  if (!cachedSql) {
    const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!conn) {
      throw new Error('DATABASE_URL environment variable is not configured.');
    }
    cachedSql = neon(conn);
  }
  return cachedSql;
}

export async function ensureSchema(): Promise<void> {
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  schemaReadyPromise = (async () => {
    const sql = getSql();

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        clerk_user_id TEXT,
        email TEXT NOT NULL,
        provider TEXT NOT NULL,
        display_name TEXT NOT NULL,
        nickname TEXT,
        nickname_updated_at TIMESTAMPTZ,
        avatar_url TEXT,
        e2ee_public_key TEXT,
        e2ee_key_updated_at TIMESTAMPTZ,
        backup_summary JSONB,
        last_synced_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_lower_uidx
      ON users (LOWER(nickname))
      WHERE nickname IS NOT NULL
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS oauth_attempts (
        attempt_id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        is_new_account BOOLEAN NOT NULL DEFAULT TRUE,
        token TEXT,
        user_payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS cloud_backups (
        user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
        encrypted_blob JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS athlete_profiles (
        user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
        avatar_color TEXT DEFAULT '#10B981',
        avatar_url TEXT,
        gender TEXT NOT NULL DEFAULT 'male',
        overall_rank TEXT NOT NULL DEFAULT 'F',
        overall_progress_pct INTEGER NOT NULL DEFAULT 0,
        balance_score_pct INTEGER NOT NULL DEFAULT 100,
        streak INTEGER NOT NULL DEFAULT 0,
        total_workouts INTEGER NOT NULL DEFAULT 0,
        total_sets INTEGER NOT NULL DEFAULT 0,
        weekly_workouts INTEGER NOT NULL DEFAULT 0,
        top_muscles JSONB NOT NULL DEFAULT '[]'::jsonb,
        recent_prs JSONB NOT NULL DEFAULT '[]'::jsonb,
        last_workout_at TEXT,
        last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        status_note TEXT,
        show_activity BOOLEAN NOT NULL DEFAULT TRUE,
        cheers_count INTEGER NOT NULL DEFAULT 0,
        cheered_by JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS friendships (
        user_a TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        user_b TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_a, user_b)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS friend_requests (
        id TEXT PRIMARY KEY,
        from_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        to_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (from_user_id, to_user_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS social_activities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        subtitle TEXT,
        rank_tier TEXT,
        cheers_count INTEGER NOT NULL DEFAULT 0,
        cheered_by JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS cheer_bursts (
        id TEXT PRIMARY KEY,
        from_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        to_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        activity_id TEXT,
        burst_count INTEGER NOT NULL DEFAULT 1,
        delivered BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS cheer_bursts_recipient_idx
      ON cheer_bursts (to_user_id, delivered, created_at ASC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS social_activities_user_created_idx
      ON social_activities (user_id, created_at DESC)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        pair_key TEXT NOT NULL,
        sender_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        recipient_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        is_encrypted BOOLEAN NOT NULL DEFAULT TRUE,
        ciphertext TEXT NOT NULL,
        nonce TEXT NOT NULL,
        sender_public_key TEXT NOT NULL,
        recipient_public_key TEXT NOT NULL,
        alg TEXT NOT NULL DEFAULT 'x25519-xsalsa20-poly1305',
        reactions JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS chat_messages_pair_created_idx
      ON chat_messages (pair_key, created_at ASC)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS chat_read_state (
        user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        friend_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, friend_id)
      )
    `;

    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
    await sql`ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
    await sql`ALTER TABLE social_activities ADD COLUMN IF NOT EXISTS cheers_count INTEGER NOT NULL DEFAULT 0`;
  })().catch((err) => {
    schemaReadyPromise = null;
    throw err;
  });

  return schemaReadyPromise;
}

export async function wipeAllDatabaseTables(): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    TRUNCATE TABLE
      chat_read_state,
      chat_messages,
      social_activities,
      friend_requests,
      friendships,
      athlete_profiles,
      cloud_backups,
      oauth_attempts,
      users
    RESTART IDENTITY CASCADE
  `;
}
