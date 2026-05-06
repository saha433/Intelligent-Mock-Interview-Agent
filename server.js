import "dotenv/config";
import cors from "cors";
import crypto from "crypto";
import express from "express";
import multer from "multer";
import OpenAI from "openai";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("."));

const usersByEmail = new Map();
const sessions = new Map();

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    provider: user.provider,
  };
}

function createSession(user) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, user.id);
  return token;
}

function findUserById(id) {
  return [...usersByEmail.values()].find((user) => user.id === id);
}

function upsertUser({ name, email, provider, password }) {
  const normalizedEmail = email.toLowerCase();
  const existing = usersByEmail.get(normalizedEmail);
  if (existing) {
    if (name && ["User", "Google User", "GitHub User"].includes(existing.name)) existing.name = name;
    return existing;
  }
  const user = {
    id: crypto.randomUUID(),
    name: name || normalizedEmail.split("@")[0] || "User",
    email: normalizedEmail,
    provider,
    password: password || null,
  };
  usersByEmail.set(normalizedEmail, user);
  return user;
}

const fallbackAnalysis = {
  extractedSkills: [
    { name: "Python", level: 85, category: "Language" },
    { name: "React", level: 75, category: "Frontend" },
    { name: "SQL", level: 80, category: "Database" },
    { name: "REST APIs", level: 82, category: "Backend" },
    { name: "PostgreSQL", level: 78, category: "Database" },
    { name: "Docker", level: 65, category: "DevOps" },
    { name: "JavaScript", level: 72, category: "Language" },
    { name: "Node.js", level: 60, category: "Backend" },
  ],
  bestFitRoles: [
    {
      role: "Backend Developer",
      confidence: 91,
      reasoning: "Strong Python + REST API + PostgreSQL combination",
    },
    {
      role: "Full Stack Developer",
      confidence: 78,
      reasoning: "React + backend skills present, needs more TypeScript",
    },
    {
      role: "Data Engineer",
      confidence: 72,
      reasoning: "SQL + Python solid, missing Spark/Airflow experience",
    },
  ],
  interviewFocusAreas: [
    "Backend API design and REST principles",
    "Database optimization and indexing",
    "Docker containerization",
    "System design fundamentals",
    "Data structures & algorithms",
  ],
  weakMissingAreas: [
    {
      area: "System Design",
      severity: "high",
      suggestion: "Study distributed system patterns & CAP theorem",
    },
    {
      area: "Cloud (AWS/GCP)",
      severity: "high",
      suggestion: "Get hands-on with EC2, S3, Lambda",
    },
    {
      area: "Kubernetes",
      severity: "medium",
      suggestion: "Learn K8s basics and pod management",
    },
    {
      area: "Message Queues",
      severity: "medium",
      suggestion: "Learn Kafka or RabbitMQ basics",
    },
    {
      area: "CI/CD Pipelines",
      severity: "low",
      suggestion: "Practice GitHub Actions or Jenkins",
    },
  ],
};

const knownSkills = [
  "Python",
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Express",
  "Java",
  "C++",
  "SQL",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "REST APIs",
  "GraphQL",
  "Docker",
  "Kubernetes",
  "AWS",
  "GCP",
  "Azure",
  "FastAPI",
  "Django",
  "Flask",
  "TensorFlow",
  "PyTorch",
  "Pandas",
  "NumPy",
  "Power BI",
  "Tableau",
  "Excel",
];

function deriveCandidateProfile(resumeText) {
  const lines = resumeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstUsefulLine =
    lines.find((line) => /^[A-Z][A-Za-z .'-]{2,50}$/.test(line)) || lines[0] || "Candidate";
  const email = resumeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const lower = resumeText.toLowerCase();
  const skillPresent = (skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\ /g, "\\s+");
    return new RegExp(`(^|[^a-z0-9+#.])${escaped}([^a-z0-9+#.]|$)`, "i").test(resumeText);
  };
  const skills = knownSkills.filter(skillPresent);
  const projectLines = lines
    .filter((line) => /project|built|developed|created|implemented|dashboard|app|api|system/i.test(line))
    .slice(0, 3);

  const roleScores = [
    {
      role: "Backend Developer",
      score:
        ["python", "node", "express", "fastapi", "django", "sql", "postgres", "api", "docker"].filter((k) =>
          lower.includes(k),
        ).length * 10,
    },
    {
      role: "Frontend Developer",
      score: ["react", "next", "javascript", "typescript", "css", "tailwind", "ui"].filter((k) =>
        lower.includes(k),
      ).length * 12,
    },
    {
      role: "Data Analyst",
      score: ["sql", "excel", "tableau", "power bi", "pandas", "dashboard", "analytics"].filter((k) =>
        lower.includes(k),
      ).length * 12,
    },
    {
      role: "Data Engineer",
      score: ["python", "sql", "spark", "airflow", "kafka", "pipeline", "etl"].filter((k) =>
        lower.includes(k),
      ).length * 12,
    },
    {
      role: "DevOps Engineer",
      score: ["docker", "kubernetes", "aws", "cloud", "ci/cd", "jenkins", "terraform"].filter((k) =>
        lower.includes(k),
      ).length * 14,
    },
  ].sort((a, b) => b.score - a.score);

  return {
    name: firstUsefulLine.replace(/\s+/g, " ").slice(0, 60),
    email,
    targetRoles: roleScores.slice(0, 3).map((role) => role.role),
    skills: skills.length ? skills : fallbackAnalysis.extractedSkills.map((skill) => skill.name),
    weakAreas: ["System Design", "Cloud Deployment", "Communication Depth"],
    projects: projectLines.length
      ? projectLines.map((line, index) => ({
          name: line.slice(0, 54),
          tech: skills.slice(index, index + 4).length ? skills.slice(index, index + 4) : skills.slice(0, 4),
          impact: "Resume evidence",
        }))
      : [
          {
            name: "Resume Project",
            tech: skills.slice(0, 4),
            impact: "Parsed from resume",
          },
        ],
    experienceLevel: /senior|lead|manager|5\+|6\+|7\+/i.test(resumeText)
      ? "Senior"
      : /intern|student|fresher|entry/i.test(resumeText)
        ? "Entry level"
        : "Junior/Mid",
    totalExperience: resumeText.match(/(\d+(\.\d+)?)\+?\s*(years|yrs|year)/i)?.[0] || "Estimated from resume",
  };
}

function buildFallbackAnalysisFromText(resumeText) {
  const profile = deriveCandidateProfile(resumeText);
  const lower = resumeText.toLowerCase();
  const bestFitRoles = profile.targetRoles.map((role, index) => ({
    role,
    confidence: Math.max(62, 90 - index * 9),
    reasoning: `Inferred from resume signals: ${profile.skills.slice(0, 5).join(", ") || "project and skill evidence"}.`,
  }));
  const extractedSkills = profile.skills.slice(0, 10).map((skill, index) => ({
    name: skill,
    level: Math.max(58, 86 - index * 4),
    category: /react|next|css|tailwind/i.test(skill)
      ? "Frontend"
      : /sql|postgres|mysql|mongo/i.test(skill)
        ? "Database"
        : /docker|kubernetes|aws|gcp|azure/i.test(skill)
          ? "DevOps"
          : /python|javascript|typescript|java|c\+\+/i.test(skill)
            ? "Language"
            : "Other",
  }));
  const weakMissingAreas = [
    !/system design|scalability|distributed/i.test(lower) && {
      area: "System Design",
      severity: "high",
      suggestion: "Practice explaining scalability, tradeoffs, caching, and database choices.",
    },
    !/aws|gcp|azure|cloud/i.test(lower) && {
      area: "Cloud Deployment",
      severity: "medium",
      suggestion: "Add hands-on deployment experience using AWS, GCP, Azure, or Render.",
    },
    !/test|testing|jest|pytest|unit/i.test(lower) && {
      area: "Testing",
      severity: "medium",
      suggestion: "Prepare examples around unit tests, integration tests, and debugging.",
    },
  ].filter(Boolean);

  return normalizeAnalysis({
    extractedSkills,
    bestFitRoles,
    interviewFocusAreas: [
      `${bestFitRoles[0]?.role || "Target role"} project deep-dive`,
      `Validate strongest skills: ${profile.skills.slice(0, 3).join(", ") || "resume skills"}`,
      "Probe missing areas from resume evidence",
      "Communication structure and impact explanation",
      "Technical tradeoffs and scalability",
    ],
    weakMissingAreas,
  });
}

function normalizeAnalysis(analysis) {
  return {
    extractedSkills:
      Array.isArray(analysis?.extractedSkills) && analysis.extractedSkills.length
        ? analysis.extractedSkills.slice(0, 10)
        : fallbackAnalysis.extractedSkills,
    bestFitRoles:
      Array.isArray(analysis?.bestFitRoles) && analysis.bestFitRoles.length
        ? analysis.bestFitRoles.slice(0, 3)
        : fallbackAnalysis.bestFitRoles,
    interviewFocusAreas:
      Array.isArray(analysis?.interviewFocusAreas) &&
      analysis.interviewFocusAreas.length
        ? analysis.interviewFocusAreas.slice(0, 6)
        : fallbackAnalysis.interviewFocusAreas,
    weakMissingAreas:
      Array.isArray(analysis?.weakMissingAreas) && analysis.weakMissingAreas.length
        ? analysis.weakMissingAreas.slice(0, 6)
        : fallbackAnalysis.weakMissingAreas,
  };
}

async function extractResumeText(file) {
  if (!file) throw new Error("No resume file uploaded.");

  if (file.mimetype === "application/pdf" || file.originalname.endsWith(".pdf")) {
    const parsed = await pdfParse(file.buffer);
    return parsed.text.trim();
  }

  if (file.mimetype.startsWith("text/") || file.originalname.endsWith(".txt")) {
    return file.buffer.toString("utf8").trim();
  }

  throw new Error("Please upload a PDF or TXT resume for this prototype.");
}

async function analyzeWithOpenAI(resumeText) {
  if (!process.env.OPENAI_API_KEY) return null;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You analyze resumes for an agentic mock interview platform. Return JSON only.",
      },
      {
        role: "user",
        content: `Analyze this resume and return this exact JSON shape:
{
  "candidate": {"name":"string","email":"string","targetRoles":["string"],"skills":["string"],"weakAreas":["string"],"projects":[{"name":"string","tech":["string"],"impact":"string"}],"experienceLevel":"string","totalExperience":"string"},
  "extractedSkills": [{"name":"string","level":0-100,"category":"Language|Frontend|Backend|Database|DevOps|Data|Cloud|Other"}],
  "bestFitRoles": [{"role":"string","confidence":0-100,"reasoning":"string"}],
  "interviewFocusAreas": ["string"],
  "weakMissingAreas": [{"area":"string","severity":"high|medium|low","suggestion":"string"}]
}

Resume:
${resumeText.slice(0, 12000)}`,
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

function clampScore(value) {
  return Math.max(10, Math.min(100, Math.round(value)));
}

function fallbackInterviewTurn(payload) {
  const analysis = normalizeAnalysis(payload.resumeAnalysis || fallbackAnalysis);
  const role = payload.targetRole || analysis.bestFitRoles[0]?.role || "Backend Developer";
  const difficulty = payload.difficulty || "Medium";
  const answer = String(payload.answer || "");
  const lower = answer.toLowerCase();
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const skills = analysis.extractedSkills.map((s) => s.name).slice(0, 6);
  const weakArea = analysis.weakMissingAreas[0]?.area || "System Design";
  const focus = analysis.interviewFocusAreas[payload.answered % analysis.interviewFocusAreas.length] || "project depth";
  const keywords = [
    "tradeoff",
    "scalability",
    "database",
    "api",
    "cache",
    "docker",
    "index",
    "latency",
    "monitoring",
    "testing",
  ];
  const hits = keywords.filter((k) => lower.includes(k)).length;

  if (!answer.trim()) {
    return {
      source: "fallback-agent",
      nextQuestion: `Your resume points strongly toward ${role}. Walk me through one project that proves you are ready for this role, and explain the architecture, tradeoffs, and impact.`,
      category: "Resume Deep-dive",
      difficulty: "Medium",
      reasoning: `I selected ${role} because the resume shows ${skills.join(", ")}. I am starting with a project deep-dive so the interview is anchored to evidence from the candidate profile.`,
      scores: null,
      coachSignal: "Calibrating interview from resume evidence",
    };
  }

  const technical = clampScore(45 + words * 0.45 + hits * 8);
  const communication = clampScore(58 + Math.min(words, 120) * 0.18 - (words < 25 ? 10 : 0));
  const confidence = clampScore(55 + Math.min(words, 90) * 0.16 + hits * 3 - (words < 20 ? 12 : 0));
  const engagement = clampScore(65 + Math.min(words, 80) * 0.12);
  const weak = technical < 58 || words < 35;
  const strong = !weak && technical >= 78;
  const nextDifficulty = strong ? "Hard" : weak ? "Easy" : difficulty;
  const nextQuestion = strong
    ? `Good depth. Now take it further: if your ${role} system had to support 10x more users, what bottlenecks would appear first and how would you redesign it?`
    : weak
      ? `Let's simplify. For ${focus}, explain the core idea step by step, then give one example from your resume.`
      : `Solid answer. Let's probe ${weakArea}: how would you improve that area in one of your projects?`;

  return {
    source: "fallback-agent",
    nextQuestion,
    category: weak ? "Foundation Recovery" : strong ? "Advanced Probe" : "Targeted Follow-up",
    difficulty: nextDifficulty,
    reasoning: weak
      ? `The answer was brief or missed key signals, so I am lowering difficulty and asking a scaffolded follow-up around ${focus}.`
      : strong
        ? "The answer contained strong technical signals, so I am increasing difficulty to test scalability and tradeoff thinking."
        : `The answer was acceptable, but the resume has a weak signal around ${weakArea}. I am probing that gap next.`,
    scores: { technical, communication, confidence, engagement },
    coachSignal: weak
      ? "Confidence recovery: easier follow-up"
      : strong
        ? "Challenge mode: difficulty increased"
        : "Gap probing: resume weak area selected",
  };
}

async function interviewTurnWithOpenAI(payload) {
  if (!process.env.OPENAI_API_KEY) return null;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an adaptive mock interview orchestrator. Evaluate the answer if present, adapt difficulty, and return JSON only. Make the next question personalized to resume evidence.",
      },
      {
        role: "user",
        content: `Return JSON with this shape:
{
  "nextQuestion":"string",
  "category":"string",
  "difficulty":"Easy|Medium|Hard",
  "reasoning":"string explaining why the agent adapted this way",
  "scores":{"technical":0-100,"communication":0-100,"confidence":0-100,"engagement":0-100} OR null,
  "coachSignal":"short string"
}

Context:
${JSON.stringify(payload).slice(0, 14000)}`,
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/signup", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim();
  const password = String(req.body?.password || "");

  if (!name || !email || password.length < 8) {
    return res.status(400).json({
      ok: false,
      error: "Enter a name, valid email, and password with at least 8 characters.",
    });
  }

  const user = upsertUser({ name, email, password, provider: "email" });
  const token = createSession(user);
  res.json({ ok: true, token, user: publicUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || password.length < 8) {
    return res.status(400).json({
      ok: false,
      error: "Enter an email and a password with at least 8 characters.",
    });
  }
  let user = usersByEmail.get(email);

  if (!user) {
    user = upsertUser({
      name: email.split("@")[0] || "User",
      email,
      password,
      provider: "email",
    });
  }

  if (!user || user.password !== password) {
    return res.status(401).json({
      ok: false,
      error: "Wrong password for this account.",
    });
  }

  const token = createSession(user);
  res.json({ ok: true, token, user: publicUser(user) });
});

app.post("/api/auth/oauth", (req, res) => {
  const provider = String(req.body?.provider || "").toLowerCase();
  if (!["google", "github"].includes(provider)) {
    return res.status(400).json({ ok: false, error: "Unsupported provider." });
  }

  const display = provider === "google" ? "Google" : "GitHub";
  const user = upsertUser({
    name: `${display} User`,
    email: `${provider}.user@roleready.local`,
    provider,
  });
  const token = createSession(user);
  res.json({ ok: true, token, user: publicUser(user) });
});

app.get("/api/auth/me", (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const userId = sessions.get(token);
  const user = userId ? findUserById(userId) : null;

  if (!user) return res.status(401).json({ ok: false, error: "Not signed in." });
  res.json({ ok: true, user: publicUser(user) });
});

app.post("/api/auth/logout", (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

app.post("/api/analyze-resume", upload.single("resume"), async (req, res) => {
  try {
    const resumeText = await extractResumeText(req.file);
    const fallbackCandidate = deriveCandidateProfile(resumeText);
    const textFallbackAnalysis = buildFallbackAnalysisFromText(resumeText);
    let aiAnalysis = null;
    let source = "fallback";
    let aiError = null;

    try {
      aiAnalysis = await analyzeWithOpenAI(resumeText);
      if (aiAnalysis) source = "openai";
    } catch (error) {
      aiError = error?.message || "OpenAI analysis failed.";
      source = "fallback-openai-error";
      console.warn("OpenAI analysis failed, using fallback analysis:", aiError);
    }

    const analysis = normalizeAnalysis(aiAnalysis || textFallbackAnalysis);
    const candidate = aiAnalysis?.candidate || fallbackCandidate;

    res.json({
      ok: true,
      source,
      fileName: req.file.originalname,
      textPreview: resumeText.slice(0, 500),
      candidate,
      analysis,
      warning: aiError,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message || "Could not analyze resume.",
    });
  }
});

app.post("/api/interview-turn", async (req, res) => {
  let source = "fallback-agent";
  let warning = null;

  try {
    let turn = null;
    try {
      turn = await interviewTurnWithOpenAI(req.body);
      if (turn) source = "openai-agent";
    } catch (error) {
      warning = error?.message || "OpenAI interview agent failed.";
      console.warn("OpenAI interview agent failed, using fallback:", warning);
    }

    const fallback = fallbackInterviewTurn(req.body || {});
    const merged = { ...fallback, ...(turn || {}), source, warning };
    res.json({ ok: true, turn: merged });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message || "Could not generate interview turn.",
    });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`RoleReady API running at http://localhost:${port}`);
});
