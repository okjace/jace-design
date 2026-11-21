import 'server-only';
import path from 'node:path';
import crypto from 'node:crypto';

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
  // ---- Later additions (kept at the end so they run after every table exists) ----
  `ALTER TABLE designs ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE designs ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT ''`,
  `CREATE INDEX IF NOT EXISTS designs_template_idx ON designs (is_template, visibility, created_at DESC)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS access_token TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS token_expires TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS token_scope TEXT NOT NULL DEFAULT ''`,
  // Sharing permissions: what "anyone with the link" may do, and whether they must ask first.
  `ALTER TABLE designs ADD COLUMN IF NOT EXISTS link_perms JSONB NOT NULL DEFAULT '{"view":true,"comment":true,"download":true,"print":true,"remix":true,"edit":false}'::jsonb`,
  `ALTER TABLE designs ADD COLUMN IF NOT EXISTS require_request BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE shares ADD COLUMN IF NOT EXISTS perms JSONB`,
  `ALTER TABLE comments ALTER COLUMN user_id DROP NOT NULL`,
  `ALTER TABLE comments ADD COLUMN IF NOT EXISTS guest_name TEXT`,
  `CREATE TABLE IF NOT EXISTS access_requests (
    id TEXT PRIMARY KEY,
    design_id TEXT NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    guest_token TEXT,
    guest_name TEXT,
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    perms JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS access_requests_design_idx ON access_requests (design_id, status)`,
  `ALTER TABLE designs ADD COLUMN IF NOT EXISTS thumb TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS share_defaults JSONB`,
  // Repair designs saved by an earlier version that stored the JSON as one big string.
  `UPDATE designs SET data = (data #>> '{}')::jsonb WHERE jsonb_typeof(data) = 'string'`,
];

let clientPromise;

const decode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

// Split a connection string by hand so passwords with @ # / ? : etc. work even when they
// weren't percent-encoded (the host is whatever follows the LAST @).
function splitUrl(url) {
  const m = url.match(/^postgres(?:ql)?:\/\/([^:/@]+):(.*)@([^@/:?#]+)(?::(\d+))?(?:\/([^?#]*))?/);
  if (!m) return null;
  return { username: decode(m[1]), password: decode(m[2]), host: m[3], port: m[4] ? Number(m[4]) : 5432, database: decode(m[5] || 'postgres') };
}

async function makeClient() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  let client;
  if (url) {
    // Any Postgres works (Supabase, Neon, RDS…). On Supabase use the pooled "Transaction" connection
    // string (port 6543); prepare:false keeps it compatible with that pooler.
    const { default: postgres } = await import('postgres');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    const opts = { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 15, ssl: local ? false : 'require', onnotice: () => {} };
    const parts = splitUrl(url);
    const sql = parts ? postgres({ ...parts, ...opts }) : postgres(url, opts);
    client = { query: async (text, params = []) => [...(await sql.unsafe(text, params))] };
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = process.env.VERCEL ? '/tmp/jace-design-db' : path.join(process.cwd(), '.data', 'db');
    const db = new PGlite(dir);
    await db.waitReady;
    client = { query: async (text, params = []) => (await db.query(text, params)).rows };
  }
  await ensureSchema(client);
  return client;
}

// Only run the setup statements when they change: a fingerprint of SCHEMA is stored in the
// database, so a normal cold start costs one quick query instead of dozens of round trips.
const SCHEMA_VERSION = crypto.createHash('sha1').update(SCHEMA.join('\n')).digest('hex').slice(0, 16);

async function ensureSchema(client) {
  try {
    const rows = await client.query(`SELECT value FROM jd_meta WHERE key = 'schema'`);
    if (rows[0]?.value === SCHEMA_VERSION) return;
  } catch {
    // jd_meta doesn't exist yet: first run.
  }
  for (const stmt of SCHEMA) await client.query(stmt);
  await client.query(`CREATE TABLE IF NOT EXISTS jd_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  await client.query(
    `INSERT INTO jd_meta (key, value) VALUES ('schema', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [SCHEMA_VERSION]
  );
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
