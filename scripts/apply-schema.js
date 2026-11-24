// Apply supabase/schema.sql to the provisioned Supabase Postgres database.
// Usage: NODE_PATH=/tmp/ps0-dbtool/node_modules node apply-schema.js
const fs = require('fs');
const { Client } = require('pg');

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
  const conn =
    env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL || env.POSTGRES_PRISMA_URL;
  if (!conn) {
    console.error('NO_CONNECTION_STRING; keys:', Object.keys(env).join(','));
    process.exit(1);
  }
  console.log('connecting to host:', new URL(conn.replace('postgresql://', 'http://')).host);

  const client = new Client({
    connectionString: conn,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const sql = fs.readFileSync('/home/z/my-project/supabase/schema.sql', 'utf8');
  await client.query(sql);
  console.log('SCHEMA APPLIED');

  const tables = await client.query(
    `select table_name from information_schema.tables
     where table_schema='public' order by table_name`
  );
  console.log('tables:', tables.rows.map((r) => r.table_name).join(', '));

  for (const t of tables.rows.map((r) => r.table_name)) {
    const c = await client.query(`select count(*)::int as n from "${t}"`);
    console.log(`  ${t}: ${c.rows[0].n} rows`);
  }
  await client.end();
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
