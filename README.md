# AI Question Bank Platform

Modern mobile-first question-bank platform built with React, Vite, TailwindCSS, Express, Firebase Firestore caching, Gemini API, React Router, Zustand, Axios, Framer Motion, and react-window.

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
