const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const root = path.join(__dirname, '..');

function loadEnvFile(filename) {
  const filePath = path.join(root, filename);
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [name, ...rest] = trimmed.split('=');
    if (!name || process.env[name]) continue;
    let value = rest.join('=').trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[name] = value.replace(/\\n/g, '\n');
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
  console.error('Missing POSTGRES_URL_NON_POOLING, POSTGRES_URL, or POSTGRES_PRISMA_URL.');
  process.exit(1);
}

async function main() {
  const sql = fs.readFileSync(path.join(root, 'supabase', 'question_agent_metadata.sql'), 'utf8');
  const url = new URL(connectionString);
  url.searchParams.delete('sslmode');
  url.searchParams.delete('sslcert');
  url.searchParams.delete('sslkey');
  url.searchParams.delete('sslrootcert');

  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  await client.query(sql);
  await client.end();

  console.log('Question agent metadata migration applied.');
}

main().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exit(1);
});
