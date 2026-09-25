/**
 * Corrects rows that were promoted from CBSE SAMPLE papers while carrying
 * official_source = true.
 *
 * A sample paper is research-only under the board publishing rule: it shows the
 * exam pattern but is not a genuine previous-year question. Leaving the flag on
 * meant that any future loosening of OFFICIAL_PAPER_KINDS would have surfaced
 * sample-paper content to students labelled as authentic.
 *
 * The rows are kept (the content is real and useful as practice) but demoted, so
 * the verified-board filter excludes them.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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
    process.env[n] = v;
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RESEARCH_ONLY_KINDS = ['sample_paper', 'specimen_paper', 'marking_scheme', 'answer_key', 'syllabus'];
const apply = process.argv.includes('--apply');

async function main() {
  const { data, error } = await supabase
    .from('question_bank')
    .select('id, board, class_name, subject, chapter, source_kind, source_years')
    .eq('official_source', true)
    .in('source_kind', RESEARCH_ONLY_KINDS);

  if (error) throw new Error(error.message);
  if (!data.length) {
    console.log('No mislabelled rows found.');
    return;
  }

  const agg = {};
  for (const r of data) {
    const k = [r.board, r.class_name, r.subject, r.source_kind].join(' | ');
    agg[k] = (agg[k] || 0) + 1;
  }
  console.log(`${data.length} row(s) marked official_source=true with a research-only source_kind:`);
  for (const [k, v] of Object.entries(agg).sort()) console.log('  ' + String(v).padStart(3) + '  ' + k);

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to demote these rows to official_source=false.');
    return;
  }

  const { error: updateError } = await supabase
    .from('question_bank')
    .update({ official_source: false })
    .in('id', data.map((r) => r.id));
  if (updateError) throw new Error(updateError.message);
  console.log(`\nDemoted ${data.length} row(s) to official_source=false.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
