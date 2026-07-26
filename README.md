# AI-Powered Question Bank & Mock Test Ecosystem

A premium, cinematic, production-ready AI educational ecosystem built on Next.js App Router, TypeScript, Tailwind CSS, Framer Motion, Supabase PostgreSQL, and Firebase Authentication. Designed to be highly scalable and reusable for future educational modules.

---

## 🚀 Key Features

1. **Student Authentication (Firebase):** Secured by Firebase Auth supporting Google Login, Email/Password flows, session persistence, and secure token verification.
2. **Student Onboarding Flow:** Complete profile registration system capturing student curriculum boundaries (Board, Class, Subject) persisted permanently in Supabase.
3. **Database-First AI Caching:** Highly optimized architecture designed to reduce API consumption by 75–95%. Searches Supabase question_bank cache first, fallback to AI generation only on cache misses.
4. **Interactive Question Bank:** Comprehensive sidebar board lists and selection pages covering major curriculum frameworks (ICSE, CBSE, College, UPSC, Competitive Exams) with instant search, copy, and print-ready options.
5. **Mock Test Engine:** Dynamic 10-question evaluation engine with option shuffling, strict MCQ grading, self-grading write-ins, and automated certificate thresholds.
6. **Futuristic Certificate Generator:** Downloadable premium gold-bordered completion certificates powered by html2canvas, jsPDF, and animated celebration confetti.
7. **Visual Analytics Dashboard:** Detailed dashboard summarizing average test scores, earned certificates, conceptual strengths/weaknesses, and attempt lists.
8. **Mobile-First Glassmorphic Design:** Smooth micro-animations, particles, cinematic radial gradient layers, and fully responsive navigation drawers.

---

## 📁 Repository Structure

```
/src
  /app
    /api
      /questions
        route.ts            # Database-first AI-second Question API endpoint
      /comments
        /admin
          /send-otp
            route.ts        # Admin login SMS trigger / fallback API
          /verify-otp
            route.ts        # OTP validation and comments fetcher
        route.ts            # Comment submission and admin listing endpoint
    /board
      /[[...slug]]
        page.tsx            # Dynamic selection grids and question bank page
    /certificate
      /[certificateId]
        page.tsx            # Confetti & gold-border downloadable certificates
    /dashboard
      page.tsx              # Analytics dashboard, attempts table, certificate listings
    /mock-test
      page.tsx              # Test quiz engine with timer and grading
    /register
      page.tsx              # Onboarding syllabus registration form
    layout.tsx              # Root Layout, head metadata, and global Auth state
    globals.css             # Cinematic gradients, scrollbars, and markdown tables CSS
  /components
    AppShell.tsx            # Interactive navigation drawer, headers, PWA buttons
    CommentCenter.tsx       # Live comment drawers and OTP panels
    InstallButton.tsx       # PWA mobile installation modal
    EmptyState.tsx          # Reusable empty placeholder
    LoadingState.tsx        # Reusable Framer Motion spin loaders
    QuestionCard.tsx        # Math-enabled question presentation card
    QuestionList.tsx        # Smooth natural vertical list flow
    QuestionToolbar.tsx     # Search filtering and print/copy exports
    SelectionGrid.tsx       # Hover-active motion cards
    StepHeader.tsx          # Breadcrumb router headers
  /data
    catalog.ts              # TS curriculum database (ICSE, CBSE, Chapters, etc.)
    fallbackQuestions.ts    # Perception-enhancing starter sets
  /lib
    /firebase
      client.ts             # Firebase client SDK auth config
      admin.ts              # Firebase server-side Admin SDK config
    /supabase
      client.ts             # Supabase client SDK integration
      admin.ts              # Supabase server-side Admin SDK config
  /services
    ai.ts                   # Gemini generation, batching, and Groq fallback service
    api.ts                  # Client fetch calls for comments and admin OTPs
  /utils
    exportQuestions.ts      # Print and copy clipboard exports
/public                     # susanto-ganguly.png, PWA manifests, PWA icons
/supabase
  schema.sql                # Production database schema definitions (RLS, indexes)
```

---

## 🗄️ Database Architecture (Supabase)

The platform is designed around a relational database model in Supabase. The primary tables include:

1. **`students`**: Stores basic credentials linked to the student's unique Firebase UID.
2. **`question_bank`**: Primary repository for all structured generated questions. Serves as the AI cash layer, containing normalized question hashes for fast searches.
3. **`mock_tests`**: Keeps records of all mock test durations, scores, and syllabus categories.
4. **`mock_questions`**: Fine-grained mapping of question choices and correctness within a mock test.
5. **`certificates`**: Secure issue ledger mapping unique certificate achievements.
6. **`user_sessions`**: Tracks student login activity.
7. **`analytics_events`**: Record of student interface engagements (e.g. pages viewed, mock test triggers).

All tables are secured by Row Level Security (RLS) policies allowing read access to authenticated students and write operations to the Next.js backend using a service role key.

---

## 🛠️ Setup Instructions

### 1. Firebase Authentication Setup
1. Create a new project in the [Firebase Console](https://console.firebase.google.com/).
2. Navigate to **Build > Authentication**, enable **Email/Password** and **Google Sign-In**.
3. Go to Project Settings, add a Web App, and copy the client credentials:
   `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
4. Navigate to Project Settings > **Service Accounts**, click **Generate New Private Key**. Save the JSON file for server environment configurations.

### 2. Supabase Setup
1. Create a new project in the [Supabase Dashboard](https://supabase.com).
2. Go to the SQL Editor.
3. Open `supabase/schema.sql` from this codebase, copy the queries, paste, and click **Run** to set up tables, indexes, and RLS policies.
4. Copy the API keys from Project Settings > **API**: `Project URL` and `service_role` key.

### 3. Environment Variables Config (`.env` / Vercel)
Add the following keys to your deployment or local `.env` file:

```env
# General
NODE_ENV=production

# Client Firebase Credentials
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_client_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_client_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_client_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_client_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_client_app_id

# Server Firebase Admin Credentials
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_admin_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"

# Client Supabase Credentials
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_client_key

# Server Supabase Credentials
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_server_service_role_key
SUPABASE_COMMENTS_TABLE=comments

# AI API Configurations
GEMINI_API_KEY=your_google_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash
GEMINI_FALLBACK_MODELS=gemini-2.0-flash,gemini-2.5-flash,gemini-1.5-flash-latest
GEMINI_BATCH_SIZE=20
GEMINI_BATCH_CONCURRENCY=2
GEMINI_BATCH_TIMEOUT_MS=35000

# Fallback AI (Groq)
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_TIMEOUT_MS=60000

# Comments Admin Access
ADMIN_PHONE=9835379900
ADMIN_OTP_CODE=select_a_private_passcode_for_admin_login_without_sms
```

---

## ⚡ Vercel Deployment Steps

1. Install Vercel CLI locally or connect your GitHub repository directly in the [Vercel Dashboard](https://vercel.com).
2. Create a new project, select the import path corresponding to this repository.
3. Configure the framework preset as **Next.js**.
4. Paste all variables from your local `.env` into the **Environment Variables** panel in Project Settings. Ensure `FIREBASE_PRIVATE_KEY` wraps the newlines correctly.
5. Click **Deploy**. Vercel will build the bundle, compile types, and serve the application globally.

---

## Question Refresh Agent

The app uses a database-first architecture. Student pages call `/api/questions`; if Supabase already has the required Board + Class + Subject + Chapter set, the stored questions are returned immediately.

Background refresh is handled by an agent pipeline:

1. Planner agent selects catalog targets from `src/data/catalog.ts`.
2. Source-discovery agent checks official board/source pages and optional web evidence for the last five years.
3. Generation agent uses Gemini first, then Groq, with the source brief and board rules.
4. Validation agent enforces the 100-question standard, question types, difficulty mix, Bloom coverage, and duplicate prevention.
5. Persistence agent replaces the chapter set in Supabase only after validation.
6. Verifier agent reads Supabase back and reports the stored count.

Production automation:

- Vercel Cron calls `/api/agent/refresh?limit=2&forceRegenerate=true` daily from `vercel.json`.
- GitHub Actions can run the same refresh on a schedule or manually from `.github/workflows/question-refresh.yml`.
- Set `QUESTION_AGENT_SECRET` or `CRON_SECRET` in Vercel, and set matching `QUESTION_AGENT_SECRET` plus `QUESTION_BANK_BASE_URL` in GitHub repository secrets.

Local commands:

```bash
npm run agent:migrate
npm run agent:refresh
```

The migration adds source metadata columns to `question_bank` so refreshed records can store source URL, source years, source kind, checked timestamp, and agent run id.

---

## 📋 Production Deployment Checklist

- [ ] Firebase Email/Password and Google Authentication active in Firebase Console.
- [ ] Supabase database schemas generated cleanly with zero table conflict warnings.
- [ ] Supabase Row Level Security (RLS) policies successfully turned ON.
- [ ] Vercel environmental credentials synchronized and verified.
- [ ] SSL domain secure routing mapped in Vercel settings.
- [ ] Local build test completes with zero TypeScript type failures.
