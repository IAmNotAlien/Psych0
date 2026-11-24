// Seed Supabase with PSYCH0 demo content so PERSISTENT mode isn't blank.
// Usage: NODE_TLS_REJECT_UNAUTHORIZED=0 NODE_PATH=/tmp/ps0-dbtool/node_modules node seed-supabase.js
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
  const s = JSON.parse(fs.readFileSync('/tmp/ps0-seed.json', 'utf8'));
  const env = parseEnvFile('/tmp/ps0-prod.env');
  const conn =
    env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL || env.POSTGRES_PRISMA_URL;
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();

  for (const p of s.posts) {
    await client.query(
      `insert into posts (id, slug, title, date, tags, cover, pinned, published, body)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (id) do update set slug=$2, title=$3, date=$4, tags=$5,
         cover=$6, pinned=$7, published=$8, body=$9, updated_at=now()`,
      [p.id, p.slug, p.title, p.date || null, p.tags || [], p.cover || '',
        !!p.pinned, p.published !== false, p.body || '']
    );
  }
  for (const p of s.projects) {
    await client.query(
      `insert into projects (id, slug, title, status, year, role, stack, cover, links, featured, body)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (id) do update set slug=$2, title=$3, status=$4, year=$5, role=$6,
         stack=$7, cover=$8, links=$9, featured=$10, body=$11, updated_at=now()`,
      [p.id, p.slug, p.title, p.status || 'WIP', p.year || '', p.role || '',
        p.stack || [], p.cover || '', JSON.stringify(p.links || []),
        !!p.featured, p.body || '']
    );
  }
  for (const e of s.embeds) {
    await client.query(
      `insert into embeds (id, title, url, note, h)
       values ($1,$2,$3,$4,$5)
       on conflict (id) do update set title=$2, url=$3, note=$4, h=$5, updated_at=now()`,
      [e.id, e.title, e.url, e.note || '', e.h || 420]
    );
  }
  await client.query(
    `update site set data=$1, updated_at=now() where id=1`,
    [JSON.stringify(s.site)]
  );

  for (const t of ['posts', 'projects', 'embeds']) {
    const c = await client.query(`select count(*)::int as n from ${t}`);
    console.log(`${t}: ${c.rows[0].n} rows`);
  }
  await client.end();
  console.log('SEED COMPLETE');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
