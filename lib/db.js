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
  // Inbox: design invites and other things that happened, per person.
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    design_id TEXT REFERENCES designs(id) ON DELETE CASCADE,
    actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    actor_name TEXT,
    data JSONB,
    status TEXT NOT NULL DEFAULT 'new',
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC)`,
  // Everyone who has opened a design (signed-in people and named guests), so the owner can see and manage them.
  `CREATE TABLE IF NOT EXISTS design_visitors (
    design_id TEXT NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
    visitor_key TEXT NOT NULL,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    guest_token TEXT,
    guest_name TEXT,
    visits INT NOT NULL DEFAULT 1,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (design_id, visitor_key)
  )`,
  // Version history: a snapshot before each editing session (at most one every 10 minutes) plus named versions.
  `CREATE TABLE IF NOT EXISTS design_versions (
    id BIGSERIAL PRIMARY KEY,
    design_id TEXT NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    name TEXT,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    size INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS design_versions_idx ON design_versions (design_id, created_at DESC)`,
  // Each person's brand kit (colors, fonts, logos).
  `CREATE TABLE IF NOT EXISTS brand_kits (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  // Who is in a design right now with live cursors on (rows older than a few seconds are ignored).
  `CREATE TABLE IF NOT EXISTS design_presence (
    design_id TEXT NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
    sess TEXT NOT NULL,
    user_id TEXT,
    name TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '',
    page INT NOT NULL DEFAULT 0,
    x REAL,
    y REAL,
    sel TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (design_id, sess)
  )`,
  // Uploaded videos and audio (too big to keep inside a design), stored in pieces of up to 3 MB.
  `CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    mime TEXT NOT NULL,
    size BIGINT NOT NULL,
    parts INT NOT NULL,
    ready BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS media_owner_idx ON media (owner_id)`,
  `CREATE TABLE IF NOT EXISTS media_parts (
    media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    idx INT NOT NULL,
    data BYTEA NOT NULL,
    PRIMARY KEY (media_id, idx)
  )`,
  `ALTER TABLE designs ADD COLUMN IF NOT EXISTS saved_by TEXT`,
  `ALTER TABLE designs ADD COLUMN IF NOT EXISTS saved_client TEXT`,
  // Jace Photos: photos people upload in their Photos tab; public ones are the community library.
  `CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    width INT NOT NULL DEFAULT 0,
    height INT NOT NULL DEFAULT 0,
    mime TEXT NOT NULL,
    size INT NOT NULL DEFAULT 0,
    thumb TEXT NOT NULL DEFAULT '',
    public BOOLEAN NOT NULL DEFAULT TRUE,
    uses INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS photos_public_idx ON photos (public, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS photos_owner_idx ON photos (owner_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS photo_data (
    photo_id TEXT PRIMARY KEY REFERENCES photos(id) ON DELETE CASCADE,
    data BYTEA NOT NULL
  )`,
  // Apps people make (web pages shown in the editor's Apps tab) and who added which.
  `CREATE TABLE IF NOT EXISTS apps (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT '🧩',
    url TEXT NOT NULL,
    public BOOLEAN NOT NULL DEFAULT TRUE,
    installs INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS apps_public_idx ON apps (public, installs DESC)`,
  `CREATE TABLE IF NOT EXISTS app_installs (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, app_id)
  )`,
  // Built-in AI: how many requests each person made each day (for the daily limit).
  `CREATE TABLE IF NOT EXISTS ai_usage (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    count INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  )`,
  // Pictures, fonts and short sounds used in designs, stored once by their content (SHA-256), so saving a
  // design only sends small links instead of megabytes of picture data.
  `CREATE TABLE IF NOT EXISTS blobs (
    hash TEXT PRIMARY KEY,
    owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    mime TEXT NOT NULL,
    size INT NOT NULL,
    data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  // Folders and stars for organizing designs.
  `CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE designs ADD COLUMN IF NOT EXISTS folder_id TEXT`,
  `CREATE TABLE IF NOT EXISTS stars (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    design_id TEXT NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, design_id)
  )`,
  // Remote presenting: which slide the presenter is on, so viewers can follow along.
  `CREATE TABLE IF NOT EXISTS live_presents (
    design_id TEXT PRIMARY KEY REFERENCES designs(id) ON DELETE CASCADE,
    presenter_id TEXT,
    presenter_name TEXT NOT NULL DEFAULT '',
    page INT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
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
