import 'server-only';
import path from 'node:path';

// One SQL code path for both environments:
//  - DATABASE_URL / POSTGRES_URL set → that Postgres database (e.g. Supabase)
//  - otherwise → PGlite (embedded Postgres) stored in .data/ for local development

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    name TEXT,
    picture TEXT,
    bio TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    email_notify BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS users_username_idx ON users (LOWER(username))`,
  `CREATE TABLE IF NOT EXISTS designs (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled design',
    width INT NOT NULL,
    height INT NOT NULL,
    data JSONB NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'private',
    remix_of TEXT,
    views INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS designs_owner_idx ON designs (owner_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS designs_public_idx ON designs (visibility, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS likes (
    design_id TEXT NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (design_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    design_id TEXT NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS comments_design_idx ON comments (design_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
  )`,
  `CREATE TABLE IF NOT EXISTS shares (
    design_id TEXT NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'view',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (design_id, user_id)
  )`,
];

let clientPromise;

async function makeClient() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  let client;
  if (url) {
    // Any Postgres works (Supabase, Neon, RDS…). On Supabase use the pooled "Transaction" connection
    // string (port 6543); prepare:false keeps it compatible with that pooler.
    const { default: postgres } = await import('postgres');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    const sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 15, ssl: local ? false : 'require', onnotice: () => {} });
    client = { query: async (text, params = []) => [...(await sql.unsafe(text, params))] };
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = process.env.VERCEL ? '/tmp/jace-design-db' : path.join(process.cwd(), '.data', 'db');
    const db = new PGlite(dir);
    await db.waitReady;
    client = { query: async (text, params = []) => (await db.query(text, params)).rows };
  }
  for (const stmt of SCHEMA) await client.query(stmt);
  return client;
}

/** Run a query and get the rows back. */
export async function q(text, params = []) {
  if (!clientPromise) {
    clientPromise = makeClient().catch((e) => {
      clientPromise = undefined;
      throw e;
    });
  }
  const client = await clientPromise;
  return client.query(text, params);
}

export async function one(text, params = []) {
  const rows = await q(text, params);
  return rows[0] || null;
}

export const usingEmbeddedDb = () => !(process.env.DATABASE_URL || process.env.POSTGRES_URL);
