// Runs the question refresh agent directly (no Vercel function), so generation
// keeps working even when deployments are blocked and isn't bound by the
// serverless timeout. Used by .github/workflows/question-refresh.yml.
import { runQuestionRefreshAgents } from '@/services/questionAgents';

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

async function main() {
  for (const name of ['GROQ_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!optional(name)) throw new Error(`Missing required environment variable ${name}`);
  }

  const result = await runQuestionRefreshAgents({
    board: optional('BOARD'),
    className: optional('CLASS_NAME'),
    subject: optional('SUBJECT'),
    chapter: optional('CHAPTER'),
    limit: Number(optional('LIMIT') || 1),
    forceRegenerate: optional('FORCE_REGENERATE') !== 'false',
    enableWebSearch: true,
  });

  for (const item of result.results as Array<Record<string, any>>) {
    const t = item.target;
    console.log(`${t.board} / ${t.className} / ${t.subject} / ${t.chapter}: saved=${item.saved} stored=${item.stored}/${item.expected}`);
  }

  if (result.totalTargets > 0 && !result.results.some((item: Record<string, any>) => item.saved)) {
    // Fail loudly: a green run that saved nothing is how this broke unnoticed before.
    throw new Error('Refresh ran but saved no questions.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
