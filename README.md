# RoleReady AI

RoleReady AI is an agentic mock interview and job-readiness platform. It turns a candidate's resume into a personalized preparation workspace with resume analysis, role-based job recommendations, adaptive interview questions, audio/video interview signals, and a final coaching report.

Instead of showing fixed demo data or generic questions, the app unlocks its workflow after resume upload and adapts the experience around the user's actual profile.

## Features

- Resume upload for PDF/TXT resumes
- Resume parsing and structured candidate analysis
- Inferred best-fit roles, extracted skills, weak areas, and interview focus areas
- Resume-gated dashboard, analysis, jobs, interview, and report sections
- Resume-based job recommendations with match scores and priority labels
- Live job source fallback handling
- Searchable target-role dropdown for interview configuration
- Configurable interview length with minimum 5 questions
- Adaptive question generation based on resume, role, answers, and transcript
- Live camera/microphone interview support
- Pre-recorded interview upload support
- Audio/video signal estimates such as speaking activity, pauses, clarity, confidence, engagement, and stress
- Final readiness report with technical, communication, confidence, and engagement scores
- Report export/download support
- Light/dark mode
- Polished landing page and authenticated home page

## Tech Stack

- Frontend: React via single-file `app.html`
- Backend: Node.js + Express
- Resume upload: Multer
- PDF parsing: `pdf-parse`
- AI providers: OpenAI and Gemini, with local fallback agents
- Job discovery: Adzuna where supported, Remotive fallback, local fallback pool
- Styling: custom CSS in `app.html`

## Project Structure

```text
.
├── app.html              # Single-page React frontend
├── server.js             # Express API server and agent logic
├── package.json          # Node scripts and dependencies
├── ARCHITECTURE.md       # Architecture/design document
├── DEMO_README.md        # Demo recording guide and narration
└── README.md             # Project README
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root.

```env
PORT=3001

OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-flash-lite-latest

ADZUNA_APP_ID=your_adzuna_app_id
ADZUNA_APP_KEY=your_adzuna_app_key
ADZUNA_COUNTRY=us
ADZUNA_LOCATION=United States
```

Notes:

- The app still works without AI quota because it includes fallback agents.
- Adzuna does not support every country code. If unsupported, the backend falls back to Remotive or local job recommendations.
- Do not commit `.env` to GitHub.

### 3. Start the app

```bash
npm start
```

Open:

```text
http://localhost:3001/
```

Do not open `app.html` directly with `file://`, because backend APIs such as resume parsing, job recommendations, and report generation require the Express server.

## End-to-End User Flow

1. Open the landing page.
2. Sign in or create an account.
3. Upload a PDF/TXT resume.
4. View parsed resume intelligence and inferred roles.
5. Open job recommendations and review match scores.
6. Configure a target role and number of interview questions.
7. Start a live interview or upload a prerecorded interview.
8. Answer adaptive questions.
9. Generate the final readiness report.
10. Export/download the report.

## Core Backend APIs

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/signup` | Create local prototype account |
| `POST /api/auth/login` | Log in with local account |
| `POST /api/auth/oauth` | Simulated provider login |
| `GET /api/auth/me` | Resolve current auth token |
| `POST /api/analyze-resume` | Upload and analyze resume |
| `POST /api/recommend-jobs` | Generate resume-based job recommendations |
| `POST /api/interview-turn` | Generate/adapt interview question |
| `POST /api/generate-report` | Generate final coaching report |

## Agent Workflow

### Resume Analysis Agent

Parses the uploaded resume and extracts:

- candidate details
- skills
- projects
- experience level
- best-fit roles
- interview focus areas
- weak or missing areas

### Job Recommendation Agent

Ranks jobs against the candidate profile using:

- role match
- skill overlap
- missing-skill gaps
- posting freshness
- inferred priority

The backend first attempts configured live sources and then falls back gracefully if an API fails.

### Interview Agent

Generates adaptive interview questions using:

- resume analysis
- target role
- selected question count
- previous answer
- transcript history
- current scores

The interview can increase difficulty for strong answers or simplify follow-ups when the candidate gives a short or weak answer.

### Report Agent

Aggregates:

- resume analysis
- interview transcript
- technical score
- communication score
- confidence score
- engagement score
- audio/video signals
- job recommendations

It returns strengths, gaps, preparation plan, and readiness scores.

## Scoring Approach

RoleReady AI combines resume evidence, interview answers, and browser-side audio/video signals.

Technical scoring rewards:

- architecture depth
- role-relevant skills
- project explanation
- trade-off reasoning
- debugging/testing discussion
- scalability and deployment awareness

Communication and confidence scoring considers:

- answer structure
- answer length and clarity
- speaking activity
- pause count
- engagement
- confidence proxy

Audio/video signals are lightweight prototype heuristics and are not meant to be used as production hiring assessments.

## Demo Checklist

For a short hackathon demo, show:

- resume upload and parsing
- inferred job roles and skills
- job recommendations with match scores
- interview role dropdown and question count
- adaptive question flow
- audio/video or prerecorded interview option
- final coaching report
- export/download report
- light/dark mode and polished hero page

## Limitations

- Authentication is prototype-level and not production OAuth.
- Resume/session data is not stored in a production database.
- Audio/video analysis uses browser-side heuristics.
- External job APIs can fail or vary by country.
- Fallback analysis is less nuanced than live AI model output.
- PDF parsing quality depends on resume formatting.

## Future Improvements

- Add persistent database storage.
- Add real Google/GitHub OAuth.
- Store reports and interviews per user.
- Add production-grade resume parsing.
- Add stronger multimodal interview analysis.
- Improve scoring calibration with real datasets.
- Deploy with HTTPS and secure environment variables.
- Add shareable candidate reports.

## One-Line Pitch

RoleReady AI turns a candidate's resume into an adaptive interview coach that recommends jobs, runs role-specific mock interviews, analyzes performance, and generates a personalized readiness report.
