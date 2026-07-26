import { boards, getChapters, getClasses, getSubjects } from '@/data/catalog';
import { QuestionPayload } from '@/services/ai';
import { ensureQuestionSet, getQuestionSetStatus, QuestionBankSourceMetadata } from '@/services/questionBank';

export type QuestionRefreshTarget = QuestionPayload & {
  priority?: number;
};

export type AgentSource = {
  title: string;
  url: string;
  kind: 'official' | 'official-search' | 'web-search';
  year?: number;
  snippet?: string;
  reachable?: boolean;
};

export type AgentRunOptions = {
  board?: string;
  className?: string;
  subject?: string;
  chapter?: string;
  limit?: number;
  offset?: number;
  forceRegenerate?: boolean;
  dryRun?: boolean;
  enableWebSearch?: boolean;
};

type BoardSourceProfile = {
  match: string[];
  sources: Array<{ title: string; url: string }>;
};

const DEFAULT_BATCH_LIMIT = 2;
const MAX_BATCH_LIMIT = 8;

const boardSourceProfiles: BoardSourceProfile[] = [
  {
    match: ['CBSE'],
    sources: [
      { title: 'CBSE Previous Years Question Papers', url: 'https://www.cbse.gov.in/cbsenew/question-paper.html' },
      { title: 'CBSE Academic Question Bank', url: 'https://cbseacademic.nic.in/qbclass12.html' },
      { title: 'CBSE Curriculum Archive', url: 'https://cbseacademic.nic.in/curriculum_archive.html' },
    ],
  },
  {
    match: ['ICSE', 'ISC'],
    sources: [
      { title: 'CISCE Official Website', url: 'https://cisce.org/' },
      { title: 'CISCE Publications', url: 'https://cisce.org/publications/' },
      { title: 'CISCE Specimen Question Papers', url: 'https://cisce.org/specimen-question-papers/' },
    ],
  },
  {
    match: ['Jharkhand Board'],
    sources: [
      { title: 'Jharkhand Academic Council', url: 'https://jac.jharkhand.gov.in/' },
    ],
  },
  {
    match: ['Bihar Board'],
    sources: [
      { title: 'Bihar School Examination Board', url: 'https://secondary.biharboardonline.com/' },
    ],
  },
  {
    match: ['UP Board'],
    sources: [
      { title: 'UPMSP Official Website', url: 'https://upmsp.edu.in/' },
    ],
  },
  {
    match: ['West Bengal Board'],
    sources: [
      { title: 'WBBSE Official Website', url: 'https://wbbse.wb.gov.in/' },
      { title: 'WBCHSE Official Website', url: 'https://wbchse.wb.gov.in/' },
    ],
  },
  {
    match: ['Maharashtra Board'],
    sources: [
      { title: 'Maharashtra State Board', url: 'https://mahahsscboard.in/' },
    ],
  },
  {
    match: ['Karnataka Board'],
    sources: [
      { title: 'Karnataka School Examination and Assessment Board', url: 'https://kseab.karnataka.gov.in/' },
    ],
  },
  {
    match: ['Tamil Nadu Board'],
    sources: [
      { title: 'Tamil Nadu Directorate of Government Examinations', url: 'https://dge.tn.gov.in/' },
    ],
  },
  {
    match: ['Kerala Board'],
    sources: [
      { title: 'Kerala Pareeksha Bhavan', url: 'https://pareekshabhavan.kerala.gov.in/' },
      { title: 'Kerala DHSE', url: 'https://dhsekerala.gov.in/' },
    ],
  },
  {
    match: ['UPSC', 'NDA', 'CDS'],
    sources: [
      { title: 'UPSC Previous Question Papers', url: 'https://upsc.gov.in/examinations/previous-question-papers' },
    ],
  },
  {
    match: ['JEE'],
    sources: [
      { title: 'NTA JEE Main', url: 'https://jeemain.nta.ac.in/' },
    ],
  },
  {
    match: ['NEET'],
    sources: [
      { title: 'NTA NEET', url: 'https://neet.nta.nic.in/' },
    ],
  },
  {
    match: ['SSC'],
    sources: [
      { title: 'Staff Selection Commission', url: 'https://ssc.gov.in/' },
    ],
  },
  {
    match: ['Railway (RRB)'],
    sources: [
      { title: 'Railway Recruitment Board', url: 'https://www.rrbcdg.gov.in/' },
    ],
  },
  {
    match: ['Banking (IBPS)'],
    sources: [
      { title: 'IBPS Official Website', url: 'https://www.ibps.in/' },
    ],
  },
  {
    match: ['CUET'],
    sources: [
      { title: 'NTA CUET UG', url: 'https://exams.nta.ac.in/CUET-UG/' },
    ],
  },
  {
    match: ['CAT'],
    sources: [
      { title: 'IIM CAT', url: 'https://iimcat.ac.in/' },
    ],
  },
];

function normalize(value: string | undefined): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function matchesFilter(actual: string, filter?: string): boolean {
  if (!filter) return true;
  const actualKey = normalize(actual);
  const filterKey = normalize(filter);
  return actualKey === filterKey || actualKey.includes(filterKey) || filterKey.includes(actualKey);
}

function dayOfYear(date = new Date()): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const now = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((now - start) / 86400000);
}

export function getLastFiveQuestionYears(date = new Date()): number[] {
  const currentYear = date.getUTCFullYear();
  return Array.from({ length: 5 }, (_, index) => currentYear - index);
}

function getSourceProfile(boardName: string): BoardSourceProfile {
  return boardSourceProfiles.find((profile) => profile.match.some((name) => matchesFilter(boardName, name))) || {
    match: [boardName],
    sources: [
      { title: `${boardName} official website search`, url: `https://www.google.com/search?q=${encodeURIComponent(`${boardName} previous year question papers official`)}` },
    ],
  };
}

export function buildAgentTargets(options: AgentRunOptions = {}): QuestionRefreshTarget[] {
  const boardCandidates = boards.filter((board) => matchesFilter(board.name, options.board) || matchesFilter(board.id, options.board));
  const targets: QuestionRefreshTarget[] = [];

  for (const board of boardCandidates.length ? boardCandidates : boards) {
    const classes = getClasses(board.id).filter((className) => matchesFilter(className, options.className));

    for (const className of classes) {
      const subjects = getSubjects(board.id, className).filter((subject) => matchesFilter(subject, options.subject));

      for (const subject of subjects) {
        const chapters = getChapters(subject).filter((chapter) => matchesFilter(chapter, options.chapter));

        for (const chapter of chapters) {
          targets.push({
            board: board.name,
            className,
            subject,
            chapter,
            priority: board.id === 'cbse' || board.id === 'icse' || board.id === 'isc' ? 1 : 2,
          });
        }
      }
    }
  }

  const sortedTargets = targets.sort((a, b) =>
    (a.priority || 9) - (b.priority || 9) ||
    a.board.localeCompare(b.board) ||
    a.className.localeCompare(b.className) ||
    a.subject.localeCompare(b.subject) ||
    a.chapter.localeCompare(b.chapter)
  );

  const limit = Math.min(Math.max(Number(options.limit || DEFAULT_BATCH_LIMIT), 1), MAX_BATCH_LIMIT);
  const offset = Number.isFinite(options.offset)
    ? Math.max(Number(options.offset), 0)
    : (dayOfYear() * limit) % Math.max(sortedTargets.length, 1);

  if (!sortedTargets.length) {
    return [];
  }

  return Array.from({ length: Math.min(limit, sortedTargets.length) }, (_, index) => (
    sortedTargets[(offset + index) % sortedTargets.length]
  ));
}

function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function pickRelevantLines(text: string, target: QuestionRefreshTarget, years: number[]): string[] {
  const terms = [
    target.board,
    target.className,
    target.subject,
    target.chapter,
    'question paper',
    'previous year',
    'sample paper',
    'specimen',
    ...years.map(String),
  ].map(normalize).filter(Boolean);

  return text
    .split(/[\r\n.]+/)
    .map(compactText)
    .filter((line) => line.length >= 30)
    .filter((line) => {
      const normalizedLine = normalize(line);
      return terms.some((term) => term.length > 2 && normalizedLine.includes(term));
    })
    .slice(0, 8);
}

async function fetchText(url: string, timeoutMs = 7000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AI-Question-Bank-Agent/1.0',
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text') && !contentType.includes('json') && !contentType.includes('html')) {
      return '';
    }

    return (await response.text()).slice(0, 200000);
  } finally {
    clearTimeout(timeout);
  }
}

function flattenDuckDuckGoTopics(topics: any[], output: string[] = []): string[] {
  for (const topic of topics || []) {
    if (topic.Text) {
      output.push(topic.Text);
    }
    if (Array.isArray(topic.Topics)) {
      flattenDuckDuckGoTopics(topic.Topics, output);
    }
  }
  return output;
}

async function searchWebSources(target: QuestionRefreshTarget, years: number[]): Promise<AgentSource[]> {
  const query = `${target.board} ${target.className} ${target.subject} ${target.chapter} ${years.join(' ')} previous year board question paper official`;
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;

  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'AI-Question-Bank-Agent/1.0' } });
    if (!response.ok) {
      throw new Error(`search status ${response.status}`);
    }

    const data = await response.json();
    return [
      data.AbstractText,
      ...flattenDuckDuckGoTopics(data.RelatedTopics || []),
    ]
      .map((snippet) => compactText(String(snippet || '')))
      .filter(Boolean)
      .slice(0, 6)
      .map((snippet) => ({
        title: 'Web search evidence',
        url,
        kind: 'web-search',
        snippet,
        reachable: true,
      }));
  } catch (error) {
    console.warn(`[agent] Web search skipped for ${target.board} ${target.subject}: ${error instanceof Error ? error.message : 'unknown error'}`);
    return [];
  }
}

export async function researchTargetSources(target: QuestionRefreshTarget, enableWebSearch = true) {
  const years = getLastFiveQuestionYears();
  const profile = getSourceProfile(target.board);
  const sources: AgentSource[] = [];

  for (const source of profile.sources.slice(0, 3)) {
    const sourceRecord: AgentSource = {
      title: source.title,
      url: source.url,
      kind: 'official',
      reachable: false,
    };

    try {
      const raw = await fetchText(source.url);
      const text = htmlToText(raw);
      const snippets = pickRelevantLines(text, target, years);
      sourceRecord.reachable = true;
      sourceRecord.snippet = snippets.join(' ');
    } catch (error) {
      sourceRecord.snippet = `Could not fetch page during this run: ${error instanceof Error ? error.message : 'unknown error'}`;
    }

    sources.push(sourceRecord);
  }

  if (enableWebSearch) {
    sources.push(...await searchWebSources(target, years));
  }

  const usableSnippets = sources
    .map((source) => compactText(source.snippet || ''))
    .filter(Boolean)
    .slice(0, 10);
  const reachableOfficialSources = sources.filter((source) => source.kind === 'official' && source.reachable);
  const sourceKind = usableSnippets.length && reachableOfficialSources.length
    ? 'official-source-ai'
    : usableSnippets.length
      ? 'web-source-ai'
      : 'ai-generated';
  const sourceList = sources
    .slice(0, 6)
    .map((source) => `- ${source.title}: ${source.url}${source.reachable === false ? ' (not reachable in this run)' : ''}`)
    .join('\n');
  const snippetList = usableSnippets.map((snippet) => `- ${snippet}`).join('\n');

  return {
    years,
    sourceKind,
    primarySource: reachableOfficialSources[0] || sources[0],
    sources,
    brief: [
      `Target: ${target.board} / ${target.className} / ${target.subject} / ${target.chapter}`,
      `Last-five-year window to consider: ${years.join(', ')}`,
      'Source priority: official board previous-year papers, specimen/sample papers, curriculum archive, then web evidence.',
      sourceList ? `Source candidates:\n${sourceList}` : '',
      snippetList ? `Extracted evidence snippets:\n${snippetList}` : 'No exact source text was reachable in this run.',
      'Generate board-authentic questions from reachable source evidence and the current syllabus. Do not claim a question is a verbatim previous-year item unless the exact wording appears in the evidence.',
    ].filter(Boolean).join('\n\n').slice(0, 3000),
  };
}

export async function runQuestionRefreshAgents(options: AgentRunOptions = {}) {
  const targets = buildAgentTargets(options);
  const agentRunId = `agent-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`;
  const results = [];

  for (const target of targets) {
    const research = await researchTargetSources(target, options.enableWebSearch !== false);
    const metadata: QuestionBankSourceMetadata = {
      sourceUrl: research.primarySource?.url,
      sourceTitle: research.primarySource?.title,
      sourceYears: research.years,
      sourceKind: research.sourceKind,
      sourceCheckedAt: new Date().toISOString(),
      agentRunId,
    };

    if (options.dryRun) {
      results.push({
        target,
        dryRun: true,
        sourceKind: research.sourceKind,
        sourceUrl: metadata.sourceUrl,
        sourceYears: metadata.sourceYears,
      });
      continue;
    }

    const generation = await ensureQuestionSet(
      { ...target, sourceBrief: research.brief },
      {
        forceRegenerate: options.forceRegenerate !== false,
        agentRefresh: true,
        allowStarterOnMiss: false,
        saveStarterFallback: false,
        sourceMetadata: metadata,
      }
    );
    const status = await getQuestionSetStatus(target);

    results.push({
      target,
      source: generation.source,
      saved: generation.source !== 'starter',
      stored: status.count,
      expected: status.expected,
      ready: status.ready,
      sourceKind: status.source || metadata.sourceKind,
      sourceUrl: status.sourceUrl || metadata.sourceUrl,
      sourceYears: status.sourceYears || metadata.sourceYears,
      agentRunId,
    });
  }

  return {
    agentRunId,
    totalTargets: targets.length,
    results,
  };
}
