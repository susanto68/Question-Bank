/**
 * Downloads the genuine board question-paper archives listed in the manifest,
 * records a sha256 per archive, and unpacks the PDFs.
 *
 * Nothing here decides that a paper is official -- the manifest does, because
 * every URL in it was discovered from a board's own index page.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yauzl = require('yauzl');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const manifestPath = path.join(root, 'research/boards/batches/pyq-window.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const archiveDir = path.join(root, 'research/boards/archives');
const paperDir = path.join(root, 'research/boards/papers');
fs.mkdirSync(archiveDir, { recursive: true });
fs.mkdirSync(paperDir, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

function slug(s) {
  return String(s || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
}

function archiveName(doc) {
  // Marking schemes and question papers can share board/class/year/subject, so
  // the document type is part of the name to keep them apart on disk.
  const kind = doc.type === 'marking_scheme' ? 'MS' : 'QP';
  const ext = doc.url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'zip';
  return `${kind}_${slug(doc.board)}_${slug(doc.class)}_${doc.year}_${slug(doc.subject || 'ALL')}.${ext}`;
}

function unzip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    const written = [];
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      zip.readEntry();
      zip.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName) || !/\.pdf$/i.test(entry.fileName)) {
          return zip.readEntry();
        }
        zip.openReadStream(entry, (err2, stream) => {
          if (err2) return reject(err2);
          // Flatten: archive folder layout differs per board and per year.
          const out = path.join(destDir, slug(path.basename(entry.fileName, '.pdf')) + '.pdf');
          const ws = fs.createWriteStream(out);
          stream.pipe(ws);
          ws.on('close', () => { written.push(out); zip.readEntry(); });
          ws.on('error', reject);
        });
      });
      zip.on('end', () => resolve(written));
      zip.on('error', reject);
    });
  });
}

async function main() {
  const results = [];
  for (const doc of manifest.documents) {
    const name = archiveName(doc);
    const zipPath = path.join(archiveDir, name);
    const destDir = path.join(paperDir, path.basename(name, '.zip'));

    try {
      let buf;
      if (fs.existsSync(zipPath)) {
        buf = fs.readFileSync(zipPath);
      } else {
        if (doc.fetch_with === 'curl') {
          // cisce.org sits behind a WAF that rejects Node's TLS fingerprint,
          // so this host is fetched with curl rather than fetch().
          const args = ['-sSL', '--fail', '-A', UA, '-o', zipPath];
          if (doc.referer) args.push('-e', doc.referer);
          args.push(doc.url);
          execFileSync('curl', args, { stdio: ['ignore', 'ignore', 'pipe'] });
          buf = fs.readFileSync(zipPath);
        } else {
          const headers = { 'User-Agent': UA, Accept: '*/*' };
          if (doc.referer) headers.Referer = doc.referer;
          const res = await fetch(doc.url, { headers, redirect: 'follow' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          buf = Buffer.from(await res.arrayBuffer());
        }
        if (buf.length < 1024) throw new Error(`suspiciously small (${buf.length} bytes)`);
        const magic = buf.slice(0, 4).toString('latin1');
        const isZip = magic.startsWith('PK');
        const isPdf = magic === '%PDF';
        if (!isZip && !isPdf) throw new Error('not a zip or pdf');
        if (!fs.existsSync(zipPath)) fs.writeFileSync(zipPath, buf);
      }

      const checksum = crypto.createHash('sha256').update(buf).digest('hex');
      fs.mkdirSync(destDir, { recursive: true });
      let pdfs;
      if (zipPath.toLowerCase().endsWith('.pdf')) {
        // Some marking schemes are published as a bare PDF rather than an archive.
        const out = path.join(destDir, path.basename(zipPath));
        fs.copyFileSync(zipPath, out);
        pdfs = [out];
      } else {
        pdfs = await unzip(zipPath, destDir);
      }

      results.push({ ...doc, status: 'downloaded', checksum, bytes: buf.length, archive: path.relative(root, zipPath), pdf_count: pdfs.length, pdf_dir: path.relative(root, destDir) });
      console.log(`OK   ${String(buf.length).padStart(9)}b  ${String(pdfs.length).padStart(3)} pdf  ${name}`);
    } catch (err) {
      results.push({ ...doc, status: 'failed', failure_reason: err.message });
      console.log(`FAIL                        ${name}  -- ${err.message}`);
    }
  }

  const outPath = path.join(root, 'research/boards/batches/pyq-window_results.json');
  fs.writeFileSync(outPath, JSON.stringify({ ...manifest, downloaded_at: new Date().toISOString(), documents: results }, null, 2));
  const ok = results.filter((r) => r.status === 'downloaded');
  console.log(`\n${ok.length}/${results.length} archives, ${ok.reduce((n, r) => n + r.pdf_count, 0)} PDFs -> ${path.relative(root, outPath)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
