const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const batchArg = process.argv[2];
if (!batchArg) {
  console.error('Usage: node scripts/research-download-batch.js <path-to-batch.json>');
  process.exit(1);
}

const batchPath = path.join(root, batchArg);
const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
const outDir = path.join(path.dirname(batchPath), 'documents');
fs.mkdirSync(outDir, { recursive: true });

function fileNameFor(doc) {
  const base = path.basename(new URL(doc.url).pathname);
  const safeSubject = doc.subject.replace(/[^a-z0-9]+/gi, '');
  return `${doc.class}_${safeSubject}_${doc.type}_${base}`;
}

async function main() {
  const results = [];
  for (const doc of batch.documents) {
    const fname = fileNameFor(doc);
    const destPath = path.join(outDir, fname);
    try {
      const res = await fetch(doc.url, { redirect: 'follow' });
      if (!res.ok) {
        results.push({ ...doc, status: 'failed', failure_reason: `HTTP ${res.status}` });
        console.log(`FAILED ${res.status}  ${doc.url}`);
        continue;
      }
      const contentType = res.headers.get('content-type') || '';
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(destPath, buf);
      const checksum = crypto.createHash('sha256').update(buf).digest('hex');
      results.push({
        ...doc,
        status: 'downloaded',
        local_path: path.relative(root, destPath),
        checksum,
        bytes: buf.length,
        content_type: contentType,
      });
      console.log(`OK  ${buf.length.toString().padStart(8)} bytes  ${doc.url}`);
    } catch (err) {
      results.push({ ...doc, status: 'failed', failure_reason: err.message });
      console.log(`ERROR  ${doc.url}  ${err.message}`);
    }
  }

  const outMeta = path.join(path.dirname(batchPath), `${path.basename(batchPath, '.json')}_results.json`);
  fs.writeFileSync(outMeta, JSON.stringify({ ...batch, documents: results }, null, 2));
  console.log(`\nWrote results to ${path.relative(root, outMeta)}`);
  const failed = results.filter((r) => r.status === 'failed');
  console.log(`${results.length - failed.length}/${results.length} downloaded, ${failed.length} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
