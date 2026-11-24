// Apply supabase/migrate-1.sql + ensure the public 'media' storage bucket.
// Usage: NODE_TLS_REJECT_UNAUTHORIZED=0 NODE_PATH=/home/z/my-project/node_modules node apply-migrate.js
const fs = require('fs');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

function parseEnvFile(path) {
  const out = {};
  for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)="?(.*)"?\s*$/);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2];
  }
  return out;
}

(async () => {
  const env = parseEnvFile('/tmp/ps0-prod.env');
  const conn = env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL;
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const sql = fs.readFileSync('/home/z/my-project/supabase/migrate-1.sql', 'utf8');
  await client.query(sql);
  console.log('MIGRATION APPLIED');
  const tables = await client.query(
    `select table_name from information_schema.tables where table_schema='public' order by table_name`
  );
  console.log('tables:', tables.rows.map((r) => r.table_name).join(', '));
  const col = await client.query(
    `select column_name from information_schema.columns where table_name='posts' and column_name='publish_at'`
  );
  console.log('posts.publish_at exists:', col.rows.length === 1);
  await client.end();

  // storage bucket (public read) — idempotent
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { error } = await sb.storage.createBucket('media', { public: true, fileSizeLimit: 15728640 });
  if (error && !/already exists|Duplicate/i.test(error.message)) throw new Error('bucket: ' + error.message);
  console.log('storage bucket media: ready');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
