# RoleReady AI Architecture

## Problem Summary and User Journey

RoleReady AI helps candidates move from a static resume to a personalized interview readiness plan. Most interview preparation tools provide generic questions or canned feedback. This project instead uses the candidate's own resume, selected target role, interview answers, and optional audio/video signals to generate adaptive questions and a final readiness report.

The user journey starts on a public hero page that explains the product. After signing in, the user uploads a resume. Until a resume is uploaded, analysis, jobs, interview, and report sections remain locked. Once uploaded, the backend parses the resume and extracts skills, projects, weak areas, and best-fit roles. The user can then choose or search for a target role, select the number of interview questions, and start an adaptive mock interview. The system generates role-specific questions, captures typed answers, and can also analyze live camera/microphone signals or a pre-recorded interview upload. At the end, RoleReady AI generates a report with scores, strengths, gaps, preparation plan, job recommendations, and export/download support.

## High-Level Architecture

RoleReady AI is built as a lightweight full-stack prototype with a single-page React frontend in `app.html` and an Express backend in `server.js`.

### Frontend Modules

- **Landing/Home UI:** public hero, authenticated hero, light/dark mode, animated grid background, click effects.
- **Auth UI:** local signup/login plus Google/GitHub-style provider login simulation through backend auth endpoints.
- **Dashboard:** resume upload, parsed resume preview, remove/replace resume flow, locked-state gating.
- **Analysis:** resume intelligence, extracted skills, best-fit roles, and missing areas.
- **Jobs:** role-based job recommendations from live sources where available, with fallback ranking.
- **Interview:** target role combobox, question count selector, adaptive question flow, answer capture, camera/mic enablement, and pre-recorded upload.
- **Report:** aggregated readiness report, interview gaps, preparation plan, job recap, and PDF/HTML export.

### Backend Modules / Agents

- **Resume Analysis Agent:** accepts uploaded PDF/TXT resume, extracts text, and produces candidate profile plus structured analysis.
- **Interview Turn Agent:** receives resume analysis, target role, transcript, and current answer, then returns the next adaptive question, difficulty, reasoning, and score updates.
- **Audio/Video Signal Layer:** browser-side capture tracks speaking, clarity, pauses, confidence, eye-contact/posture proxy values, engagement, and stress signals.
- **Report Agent:** combines resume analysis, transcript, scores, audio/video metrics, and job recommendations into a final readiness report.
- **Job Recommendation Agent:** attempts live job search through Adzuna where supported, then Remotive, then local fallback jobs ranked against resume skills.

### Data Flow

1. User signs in and receives a local auth token.
2. User uploads resume to `POST /api/analyze-resume`.
3. Backend parses resume text and calls the configured AI provider, falling back to safe local analysis if quota or API errors occur.
4. Frontend stores the parsed candidate profile and unlocks analysis, jobs, interview, and report sections.
5. Jobs page calls `POST /api/recommend-jobs` with resume analysis.
6. Interview page calls `POST /api/interview-turn` for the first question and each follow-up.
7. Browser gathers live audio/video metrics during the interview, and stores recording URLs locally for preview.
8. Report page calls `POST /api/generate-report` with resume analysis, transcript, scores, audio/video signals, and jobs.
9. User exports/downloads the report.

### Interfaces

Primary backend interfaces:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/oauth`
- `GET /api/auth/me`
- `POST /api/analyze-resume`
- `POST /api/recommend-jobs`
- `POST /api/interview-turn`
- `POST /api/generate-report`

## Key Design Choices and Trade-Offs

### Latency

The app uses fallback agents so the demo remains responsive even when AI quota or external APIs fail. Resume parsing and report generation can use OpenAI/Gemini when available, but local fallback logic ensures the user still receives useful output. The trade-off is that fallback output is less nuanced than model-generated analysis, but it avoids blocking the flow during a hackathon demo.

### Scalability

The prototype stores most session state in frontend memory and local browser state rather than a production database. This keeps the demo fast and simple, but it is not multi-device or persistent enough for production. A scalable version would move users, resumes, transcripts, reports, and recordings into a database/object store, with background jobs for parsing and report generation.

### Model Selection

The backend is designed to use configured AI providers such as OpenAI or Gemini for structured JSON generation. The model tasks are constrained to resume analysis, interview question generation, and report writing. This keeps prompts focused and outputs easier to validate. Smaller/fast models are preferred for latency and cost, while fallback deterministic scoring protects the user journey from API failures.

### External Job APIs

The job recommendation agent first tries live job APIs, but gracefully falls back when a provider rejects a country code, has no results, or is unavailable. This avoids exposing raw API errors to users. The trade-off is that fallback jobs are less real-time, but the product experience remains complete.

## Scoring Approach

RoleReady AI aggregates three major signal groups:

### Technical Signals

Technical score is based on the adaptive interview transcript and resume-role alignment. The system rewards answers that include project depth, architecture, trade-offs, debugging/testing, scalability, APIs, databases, deployment, impact, and role-relevant skills. Short or vague answers lower the score and cause the interview agent to reduce difficulty or ask scaffolded follow-ups.

### Communication and Confidence Signals

Communication score uses answer length, clarity, structure, and live audio proxies. The browser audio analyzer estimates speaking activity, silence, pause count, and clarity from microphone input. Confidence is derived from clarity, speaking consistency, engagement, and video proxy signals.

### Audio/Video Signals

The browser captures camera/mic permission-based metrics during the interview. Current signals include:

- audio level and speaking detection
- pause count and silence streaks
- clarity estimate
- confidence estimate
- eye-contact/posture proxy values
- engagement and stress estimates

These are lightweight browser-side heuristics suitable for a prototype. They are combined with typed-answer scoring to avoid making the report depend only on visual/audio assumptions.

### Aggregation

The final report combines:

- resume analysis and best-fit role
- interview transcript and adaptive question performance
- technical, communication, confidence, and engagement scores
- audio/video metrics
- strengths and weaknesses
- preparation plan and job recommendations

The report agent calculates overall readiness from technical and communication performance, then adds confidence and engagement as supporting dimensions. Weak areas are generated from both resume gaps and interview behavior, but interview readiness and gaps are only unlocked after a mock interview.

## Limitations, Assumptions, and Next Steps

### Limitations

- Current auth is prototype-level and not production OAuth.
- Resume/session data is not stored in a persistent production database.
- Audio/video intelligence uses browser-side heuristics, not deep facial or speech models.
- External job APIs may vary by country and availability.
- Fallback AI provides useful continuity but less personalization than live model calls.
- PDF parsing quality depends on the resume format.

### Assumptions

- Users upload PDF or TXT resumes.
- Users are preparing for technical, product, data, or software-adjacent roles.
- The browser supports modern camera/microphone APIs.
- AI providers or fallback agents are available during demo.
- The primary goal is a working hackathon prototype, not a production hiring assessment tool.

### Next Steps

- Add a database for persistent users, resumes, interviews, and reports.
- Replace simulated provider auth with real Google/GitHub OAuth.
- Add production-grade resume parsing and structured extraction.
- Use stronger multimodal models for audio/video interview analysis.
- Add calibration datasets for scoring consistency.
- Add real job search provider configuration by region.
- Deploy the app with secure environment variables and HTTPS.
- Add recruiter/candidate sharing links for generated reports.
