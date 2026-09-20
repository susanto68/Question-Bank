const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const root = path.join(__dirname, '..');
for (const f of ['.env.local', '.env']) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const [n, ...r] = t.split('=');
    if (!n || process.env[n]) continue;
    let v = r.join('=').trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[n] = v.replace(/\n/g, '\n');
  }
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/apply-sql.js <path-to-sql-under-supabase>');
  process.exit(1);
}

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
if (!connectionString) {
  console.error('Missing POSTGRES_URL_NON_POOLING / POSTGRES_URL / POSTGRES_PRISMA_URL.');
  process.exit(1);
}

async function main() {
  const sql = fs.readFileSync(path.join(root, file), 'utf8');
  // Supabase's pooler presents a self-signed chain; the sslmode params in the
  // connection string would otherwise force full verification and fail.
  const url = new URL(connectionString);
  for (const k of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(k);
  const client = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Applied ' + file);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
