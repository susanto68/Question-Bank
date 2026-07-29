# Daily Question Agent Automation

This project uses a Vercel Cron job to refresh question-bank data once per hour.

## Recommended Scheduler

Use Vercel Cron as the main scheduler because the app, API route, and Supabase environment variables already live in Vercel.

Current schedule in `vercel.json`:

```json
{
      "path": "/api/agent/refresh?limit=3&forceRegenerate=true&enableWebSearch=true",
      "schedule": "0 * * * *"
}
```

This runs once every hour and processes up to 3 rotating catalog targets per run.

## What It Does

Each run calls:

```text
/api/agent/refresh
```

The agent then:

1. Selects a small rotating batch from the full catalog.
2. Searches known official source pages for the selected board or exam.
3. Uses the last five years as the research window.
4. Generates/refines a source-aware question set.
5. Stores results in Supabase with source metadata.
6. Skips starter fallback questions for agent refreshes.

## Required Vercel Environment Variables

Set these in Vercel Project Settings > Environment Variables:

```text
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
QUESTION_AGENT_ENABLE_WEB_SEARCH=1
CRON_SECRET=<random-private-string-at-least-16-characters>
```

Vercel automatically sends `CRON_SECRET` as an `Authorization: Bearer ...` header when invoking cron jobs. The route checks that header before running in production.

## How To Check It

After deployment:

1. Open Vercel Dashboard.
2. Go to the project.
3. Open Settings > Cron Jobs.
4. Confirm `/api/agent/refresh?limit=3&forceRegenerate=true&enableWebSearch=true` is active.
5. Open Logs and filter by:

```text
requestPath:/api/agent/refresh
```

## Manual Test

From your browser or API client, call the endpoint with the cron secret:

```text
GET https://your-domain.vercel.app/api/agent/refresh?limit=1&forceRegenerate=true&enableWebSearch=true
Authorization: Bearer <CRON_SECRET>
```

For local testing, run the app and visit:

```text
http://localhost:3000/api/agent/refresh?limit=1&dryRun=true
```

## Scaling Plan

Keep `limit=3` at first. This is safer while the agent still accumulates partial source-backed sets.

After logs are stable:

```text
limit=5
```

After source extraction is stronger and deduplication is complete:

```text
limit=10
```

Avoid very high hourly limits because PDF parsing, source search, and AI generation can time out or cost more.

## GitHub Actions Alternative

Use GitHub Actions only as a backup/manual runner. Do not run both GitHub Actions and Vercel Cron daily unless you add a database lock, otherwise the same chapter may refresh twice.

Best setup:

```text
Vercel Cron = hourly production refresh
GitHub Actions = manual backup trigger
```
