# Question-Bank

Modern mobile-first AI Question Bank platform built with React, Vite, TailwindCSS, Express, Firebase Firestore caching, Gemini API, React Router, Zustand, Axios, Framer Motion, and react-window.

Flow: Board -> Class -> Subject -> Chapter -> Generate Questions.

## Features

- Supports ICSE, CBSE, State Boards, College, UPSC, JPSC, SSC, Banking, Railway, NEET, and JEE.
- Generates 100 structured questions with MCQ, short answer, long answer, true/false, assertion-reason, and numerical types.
- Checks Firestore cache first, then generates from Gemini when cache is blank or missing.
- Mobile-friendly dark glass UI with compact sidebar, 3D gradient buttons, search, print, PDF, and copy options.
- Supports large scrollable question content, markdown tables, code blocks, and math formulas.

## Setup

```bash
npm install
copy .env.example .env
npm run dev
```

Fill `.env` with your real `GEMINI_API_KEY` and Firebase Admin credentials before using live generation and Firestore caching.

## Scripts

```bash
npm run dev       # React + Express in development
npm run build     # production client build
npm start         # Express API server
npm run check     # lint + build
```

## API

`POST /api/questions/generate`

```json
{
  "board": "ICSE",
  "className": "Class 10",
  "subject": "Computer Applications",
  "chapter": "Arrays"
}
```

The API checks Firestore first. Cache hits return immediately. Cache misses generate 100 structured questions with Gemini and save the normalized payload to Firestore.

## Supabase Comments

Add these environment variables in Vercel:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_key
SUPABASE_COMMENTS_TABLE=comments
ADMIN_PHONE=9835379900
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_public_anon_key
```

Create the comments table in Supabase by running `supabase/comments.sql` in the Supabase SQL Editor, or use this SQL:

```sql
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  board text not null,
  comment text not null,
  page_path text,
  created_at timestamptz not null default now()
);
```

Enable phone OTP in Supabase Auth for admin comment viewing. Only the verified admin phone `9835379900` can read submitted comments.
