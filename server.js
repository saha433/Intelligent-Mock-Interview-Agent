import "dotenv/config";
import cors from "cors";
import crypto from "crypto";
import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

app.get("/", (_req, res) => {
  res.sendFile("app.html", { root: process.cwd() });
});

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
    if (
      name &&
      ["User", "Google Account", "GitHub Account"].includes(existing.name)
    )
      existing.name = name;
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

const fallbackJobPool = [
  {
    title: "Backend Developer Intern",
    company: "Resume-fit Hiring Team",
    location: "Bangalore, IN",
    type: "Internship",
    salary: "Not listed",
    requiredSkills: ["Python", "REST APIs", "PostgreSQL", "Docker", "SQL"],
    description:
      "Build REST APIs, work with PostgreSQL, Docker, and backend services.",
  },
  {
    title: "Frontend Developer Intern",
    company: "PixelForge",
    location: "Remote",
    type: "Internship",
    salary: "Not listed",
    requiredSkills: ["React", "JavaScript", "TypeScript", "CSS", "REST APIs"],
    description:
      "Build React interfaces, consume REST APIs, improve UI performance and accessibility.",
  },
  {
    title: "Data Analyst",
    company: "InsightLoop",
    location: "Hyderabad, IN",
    type: "Full-time",
    salary: "Not listed",
    requiredSkills: ["SQL", "Python", "Excel", "Power BI", "Tableau"],
    description:
      "Analyze business data, build dashboards, write SQL queries, and communicate insights.",
  },
  {
    title: "Data Engineer Trainee",
    company: "Resume-fit Data Team",
    location: "Bangalore, IN",
    type: "Full-time",
    salary: "Not listed",
    requiredSkills: ["Python", "SQL", "ETL", "Airflow", "Spark"],
    description:
      "Build data pipelines with Python, SQL, ETL workflows, Airflow, and cloud data systems.",
  },
  {
    title: "Business Analyst Intern",
    company: "MarketPulse",
    location: "Mumbai, IN",
    type: "Internship",
    salary: "Not listed",
    requiredSkills: ["Excel", "SQL", "Power BI", "Analytics", "Communication"],
    description:
      "Work on business analysis, dashboards, reporting, Excel models, and stakeholder insights.",
  },
  {
    title: "DevOps Engineer Intern",
    company: "Resume-fit Cloud Team",
    location: "Pune, IN",
    type: "Internship",
    salary: "Not listed",
    requiredSkills: ["Docker", "Kubernetes", "AWS", "CI/CD", "Linux"],
    description:
      "Support cloud deployments, Docker containers, CI/CD pipelines, and monitoring.",
  },
];

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
    lines.find((line) => /^[A-Z][A-Za-z .'-]{2,50}$/.test(line)) ||
    lines[0] ||
    "Candidate";
  const email =
    resumeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const lower = resumeText.toLowerCase();
  const skillPresent = (skill) => {
    const escaped = skill
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\\ /g, "\\s+");
    return new RegExp(`(^|[^a-z0-9+#.])${escaped}([^a-z0-9+#.]|$)`, "i").test(
      resumeText,
    );
  };
  const skills = knownSkills.filter(skillPresent);
  const projectLines = lines
    .filter((line) =>
      /project|built|developed|created|implemented|dashboard|app|api|system/i.test(
        line,
      ),
    )
    .slice(0, 3);

  const roleScores = [
    {
      role: "Backend Developer",
      score:
        [
          "python",
          "node",
          "express",
          "fastapi",
          "django",
          "sql",
          "postgres",
          "api",
          "docker",
        ].filter((k) => lower.includes(k)).length * 10,
    },
    {
      role: "Frontend Developer",
      score:
        [
          "react",
          "next",
          "javascript",
          "typescript",
          "css",
          "tailwind",
          "ui",
        ].filter((k) => lower.includes(k)).length * 12,
    },
    {
      role: "Data Analyst",
      score:
        [
          "sql",
          "excel",
          "tableau",
          "power bi",
          "pandas",
          "dashboard",
          "analytics",
        ].filter((k) => lower.includes(k)).length * 12,
    },
    {
      role: "Data Engineer",
      score:
        [
          "python",
          "sql",
          "spark",
          "airflow",
          "kafka",
          "pipeline",
          "etl",
        ].filter((k) => lower.includes(k)).length * 12,
    },
    {
      role: "DevOps Engineer",
      score:
        [
          "docker",
          "kubernetes",
          "aws",
          "cloud",
          "ci/cd",
          "jenkins",
          "terraform",
        ].filter((k) => lower.includes(k)).length * 14,
    },
  ].sort((a, b) => b.score - a.score);

  return {
    name: firstUsefulLine.replace(/\s+/g, " ").slice(0, 60),
    email,
    targetRoles: roleScores.slice(0, 3).map((role) => role.role),
    skills: skills.length
      ? skills
      : fallbackAnalysis.extractedSkills.map((skill) => skill.name),
    weakAreas: ["System Design", "Cloud Deployment", "Communication Depth"],
    projects: projectLines.length
      ? projectLines.map((line, index) => ({
          name: line.slice(0, 54),
          tech: skills.slice(index, index + 4).length
            ? skills.slice(index, index + 4)
            : skills.slice(0, 4),
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
    totalExperience:
      resumeText.match(/(\d+(\.\d+)?)\+?\s*(years|yrs|year)/i)?.[0] ||
      "Estimated from resume",
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
      suggestion:
        "Practice explaining scalability, tradeoffs, caching, and database choices.",
    },
    !/aws|gcp|azure|cloud/i.test(lower) && {
      area: "Cloud Deployment",
      severity: "medium",
      suggestion:
        "Add hands-on deployment experience using AWS, GCP, Azure, or Render.",
    },
    !/test|testing|jest|pytest|unit/i.test(lower) && {
      area: "Testing",
      severity: "medium",
      suggestion:
        "Prepare examples around unit tests, integration tests, and debugging.",
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
      Array.isArray(analysis?.extractedSkills) &&
      analysis.extractedSkills.length
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
      Array.isArray(analysis?.weakMissingAreas) &&
      analysis.weakMissingAreas.length
        ? analysis.weakMissingAreas.slice(0, 6)
        : fallbackAnalysis.weakMissingAreas,
  };
}

function parseJsonText(text) {
  const raw = String(text || "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Model did not return JSON.");
    return JSON.parse(match[0]);
  }
}

async function geminiJson(prompt) {
  if (!process.env.GEMINI_API_KEY) return null;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
    generationConfig: { responseMimeType: "application/json" },
  });
  const result = await model.generateContent(prompt);
  return parseJsonText(result.response.text());
}

async function extractResumeText(file) {
  if (!file) throw new Error("No resume file uploaded.");

  if (
    file.mimetype === "application/pdf" ||
    file.originalname.endsWith(".pdf")
  ) {
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

async function analyzeWithGemini(resumeText) {
  return geminiJson(`You analyze resumes for an agentic mock interview platform.
Return JSON only with this exact shape:
{
  "candidate": {"name":"string","email":"string","targetRoles":["string"],"skills":["string"],"weakAreas":["string"],"projects":[{"name":"string","tech":["string"],"impact":"string"}],"experienceLevel":"string","totalExperience":"string"},
  "extractedSkills": [{"name":"string","level":0-100,"category":"Language|Frontend|Backend|Database|DevOps|Data|Cloud|Other"}],
  "bestFitRoles": [{"role":"string","confidence":0-100,"reasoning":"string"}],
  "interviewFocusAreas": ["string"],
  "weakMissingAreas": [{"area":"string","severity":"high|medium|low","suggestion":"string"}]
}

Resume:
${resumeText.slice(0, 12000)}`);
}

function clampScore(value) {
  return Math.max(10, Math.min(100, Math.round(value)));
}

function fallbackInterviewTurn(payload) {
  const analysis = normalizeAnalysis(
    payload.resumeAnalysis || fallbackAnalysis,
  );
  const role =
    payload.targetRole || analysis.bestFitRoles[0]?.role || "Backend Developer";
  const difficulty = payload.difficulty || "Medium";
  const answer = String(payload.answer || "");
  const lower = answer.toLowerCase();
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const skills = analysis.extractedSkills.map((s) => s.name).slice(0, 6);
  const weakArea = analysis.weakMissingAreas[0]?.area || "System Design";
  const focus =
    analysis.interviewFocusAreas[
      payload.answered % analysis.interviewFocusAreas.length
    ] || "project depth";
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
  const communication = clampScore(
    58 + Math.min(words, 120) * 0.18 - (words < 25 ? 10 : 0),
  );
  const confidence = clampScore(
    55 + Math.min(words, 90) * 0.16 + hits * 3 - (words < 20 ? 12 : 0),
  );
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
    category: weak
      ? "Foundation Recovery"
      : strong
        ? "Advanced Probe"
        : "Targeted Follow-up",
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

async function interviewTurnWithGemini(payload) {
  return geminiJson(`You are an adaptive mock interview orchestrator.
Evaluate the answer if present, adapt difficulty, and make the next question personalized to resume evidence.
Return JSON only with this shape:
{
  "nextQuestion":"string",
  "category":"string",
  "difficulty":"Easy|Medium|Hard",
  "reasoning":"string explaining why the agent adapted this way",
  "scores":{"technical":0-100,"communication":0-100,"confidence":0-100,"engagement":0-100} OR null,
  "coachSignal":"short string"
}

Context:
${JSON.stringify(payload).slice(0, 14000)}`);
}

function fallbackReport(payload) {
  const analysis = normalizeAnalysis(
    payload.resumeAnalysis || fallbackAnalysis,
  );
  const candidate = payload.candidate || { name: "Candidate" };
  const scores = payload.scores || {};
  const av = payload.audioVideoSignals || {};
  const transcript = Array.isArray(payload.transcript)
    ? payload.transcript
    : [];
  const answers = transcript
    .filter((item) => item.role === "candidate")
    .map((item) => item.text || "");
  const combined = answers.join(" ").toLowerCase();
  const avg =
    ((Number(scores.technical) || 60) +
      (Number(scores.communication) || 60) +
      (Number(scores.confidence) || 60) +
      (Number(scores.engagement) || 60)) /
    4;
  const topRole =
    payload.targetRole || analysis.bestFitRoles[0]?.role || "Target Role";
  const topSkill = analysis.extractedSkills[0]?.name || "core technical skills";
  const topGap = analysis.weakMissingAreas[0]?.area || "technical depth";
  const strongSignals = [
    combined.includes("tradeoff") &&
      "Discussed tradeoffs instead of only naming tools",
    combined.includes("database") &&
      "Connected answers to database or data-model choices",
    combined.includes("scal") && "Showed awareness of scaling concerns",
    combined.includes("docker") &&
      "Mentioned deployment/containerization signals",
    Number(av.eyeContact) >= 70 &&
      "Maintained strong visual engagement during the video interview",
    Number(av.clarity) >= 70 &&
      "Speech clarity signal stayed strong during live analysis",
    answers.length >= 3 && "Stayed engaged across multiple adaptive turns",
  ].filter(Boolean);
  const weakSignals = [
    !combined.includes("tradeoff") && "Needs more explicit tradeoff reasoning",
    !combined.includes("impact") &&
      "Should quantify project outcomes and business impact",
    !combined.includes("test") &&
      "Testing/debugging process was not clearly explained",
    Number(av.pauseCount) > 6 &&
      "Long pauses increased during the live audio analysis",
    Number(av.eyeContact) > 0 &&
      Number(av.eyeContact) < 50 &&
      "Eye contact/posture signals need more consistency on camera",
    Number(av.stress) > 65 &&
      "Live confidence signals showed elevated stress under follow-up questions",
    (scores.confidence || 60) < 65 &&
      "Confidence score dipped during harder follow-ups",
    (scores.technical || 60) < 70 &&
      `Needs stronger depth for ${topRole} interviews`,
  ].filter(Boolean);

  return {
    source: "fallback-report-agent",
    overallScore: clampScore(avg),
    roleReadiness: clampScore(
      (scores.technical || avg) * 0.65 + (scores.communication || avg) * 0.35,
    ),
    technicalScore: clampScore(scores.technical || avg),
    communicationScore: clampScore(scores.communication || avg),
    confidenceScore: clampScore(scores.confidence || avg),
    engagementScore: clampScore(scores.engagement || avg),
    strengths: (strongSignals.length
      ? strongSignals
      : [
          `Resume has relevant evidence for ${topRole}`,
          `Strongest parsed skill signal: ${topSkill}`,
          "Completed the adaptive interview flow",
        ]
    ).slice(0, 4),
    weaknesses: (weakSignals.length
      ? weakSignals
      : [
          `Deepen examples around ${topGap}`,
          "Use more structured answer framing",
          "Add metrics, constraints, and outcomes to project explanations",
        ]
    ).slice(0, 4),
    questionFeedback: answers.slice(0, 5).map((answer, index) => {
      const words = answer.trim().split(/\s+/).filter(Boolean).length;
      const hasDepth =
        /tradeoff|scale|database|cache|test|latency|deploy|architecture/i.test(
          answer,
        );
      return {
        question: `Adaptive turn ${index + 1}`,
        score: clampScore(
          48 + Math.min(words, 120) * 0.25 + (hasDepth ? 18 : 0),
        ),
        feedback: hasDepth
          ? "Good technical signal. The answer included concrete engineering concepts and can be strengthened with clearer constraints and metrics."
          : "The answer was understandable but needs more concrete technical evidence, tradeoffs, and examples from the resume.",
        improvement: `For ${topRole}, answer with: context, design choice, tradeoff, result, and what you would improve next.`,
      };
    }),
    prepPlan: [
      {
        day: 1,
        focus: `${topRole} Fundamentals`,
        tasks: [
          `Review key concepts around ${topSkill}`,
          "Write one STAR story for your strongest project",
        ],
      },
      {
        day: 2,
        focus: topGap,
        tasks: [
          `Study interview examples for ${topGap}`,
          "Prepare a 2-minute explanation with tradeoffs",
        ],
      },
      {
        day: 3,
        focus: "Project Deep-dive",
        tasks: [
          "Map architecture, data flow, and failure cases for your best project",
          "Add metrics and impact numbers",
        ],
      },
      {
        day: 4,
        focus: "Technical Communication",
        tasks: [
          "Practice concise answers using Context → Choice → Tradeoff → Result",
          "Record and review one mock response",
        ],
      },
      {
        day: 5,
        focus: "Role-Specific Practice",
        tasks: [
          `Do 5 questions for ${topRole}`,
          "Explain one system out loud without notes",
        ],
      },
      {
        day: 6,
        focus: "Mock Interview",
        tasks: [
          "Retry this adaptive interview",
          "Focus on the weakest score area",
        ],
      },
      {
        day: 7,
        focus: "Final Polish",
        tasks: [
          "Update resume bullets with stronger impact",
          "Prepare questions to ask the interviewer",
        ],
      },
    ],
    coachingSummary: `${candidate.name || "The candidate"} is currently tracking at ${clampScore(avg)}% readiness for ${topRole}. The interview agent prioritized ${topGap} because it appeared as a resume/interview gap. Live audio/video signals reported ${clampScore(av.confidence || scores.confidence || avg)}% confidence, ${clampScore(av.eyeContact || 0)}% eye-contact consistency, and ${Number(av.pauseCount) || 0} detected pause shifts. The next improvement step is to make answers more evidence-based: explain constraints, tradeoffs, and measurable outcomes.`,
  };
}

async function reportWithOpenAI(payload) {
  if (!process.env.OPENAI_API_KEY) return null;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a coaching report agent for an adaptive mock interview platform. Generate actionable, specific feedback from resume analysis, transcript, and scores. Return JSON only.",
      },
      {
        role: "user",
        content: `Return JSON with this exact shape:
{
  "overallScore":0-100,
  "roleReadiness":0-100,
  "technicalScore":0-100,
  "communicationScore":0-100,
  "confidenceScore":0-100,
  "engagementScore":0-100,
  "strengths":["string"],
  "weaknesses":["string"],
  "questionFeedback":[{"question":"string","score":0-100,"feedback":"string","improvement":"string"}],
  "prepPlan":[{"day":1,"focus":"string","tasks":["string"]}],
  "coachingSummary":"string"
}

Context:
${JSON.stringify(payload).slice(0, 16000)}`,
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

async function reportWithGemini(payload) {
  return geminiJson(`You are a coaching report agent for an adaptive mock interview platform.
Generate actionable, specific feedback from resume analysis, transcript, and scores.
Return JSON only with this exact shape:
{
  "overallScore":0-100,
  "roleReadiness":0-100,
  "technicalScore":0-100,
  "communicationScore":0-100,
  "confidenceScore":0-100,
  "engagementScore":0-100,
  "strengths":["string"],
  "weaknesses":["string"],
  "questionFeedback":[{"question":"string","score":0-100,"feedback":"string","improvement":"string"}],
  "prepPlan":[{"day":1,"focus":"string","tasks":["string"]}],
  "coachingSummary":"string"
}

Context:
${JSON.stringify(payload).slice(0, 16000)}`);
}

function normalizeReport(report, fallback) {
  const merged = { ...fallback, ...(report || {}) };
  return {
    ...merged,
    overallScore: clampScore(merged.overallScore || fallback.overallScore),
    roleReadiness: clampScore(merged.roleReadiness || fallback.roleReadiness),
    technicalScore: clampScore(
      merged.technicalScore || fallback.technicalScore,
    ),
    communicationScore: clampScore(
      merged.communicationScore || fallback.communicationScore,
    ),
    confidenceScore: clampScore(
      merged.confidenceScore || fallback.confidenceScore,
    ),
    engagementScore: clampScore(
      merged.engagementScore || fallback.engagementScore,
    ),
    strengths:
      Array.isArray(merged.strengths) && merged.strengths.length
        ? merged.strengths
        : fallback.strengths,
    weaknesses:
      Array.isArray(merged.weaknesses) && merged.weaknesses.length
        ? merged.weaknesses
        : fallback.weaknesses,
    questionFeedback:
      Array.isArray(merged.questionFeedback) && merged.questionFeedback.length
        ? merged.questionFeedback
        : fallback.questionFeedback,
    prepPlan:
      Array.isArray(merged.prepPlan) && merged.prepPlan.length >= 7
        ? merged.prepPlan
        : fallback.prepPlan,
    coachingSummary: merged.coachingSummary || fallback.coachingSummary,
  };
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function daysSince(dateValue) {
  const time = dateValue ? new Date(dateValue).getTime() : Date.now();
  if (Number.isNaN(time)) return 0;
  return Math.max(0, Math.round((Date.now() - time) / 86400000));
}

function jobInitials(title) {
  return (
    String(title || "Job")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "JB"
  );
}

function scoreJob(job, analysis) {
  const role = analysis.bestFitRoles[0]?.role || "Job";
  const skills = analysis.extractedSkills
    .map((skill) => skill.name)
    .filter(Boolean)
    .slice(0, 10);
  const weakSkills = analysis.weakMissingAreas
    .map((gap) => gap.area)
    .filter(Boolean)
    .slice(0, 4);
  const titleText = String(job.title || "").toLowerCase();
  const text =
    `${job.title} ${job.company || ""} ${job.description || ""} ${(job.requiredSkills || []).join(" ")}`.toLowerCase();
  const roleWords = role
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);
  const matchingSkills = skills.filter((skill) =>
    text.includes(skill.toLowerCase()),
  );
  const missingSkills = [
    ...new Set([...(job.requiredSkills || []), ...weakSkills]),
  ]
    .filter(
      (skill) =>
        !matchingSkills.some(
          (matched) => matched.toLowerCase() === String(skill).toLowerCase(),
        ),
    )
    .slice(0, 4);
  const titleRoleHits = roleWords.filter((word) =>
    titleText.includes(word),
  ).length;
  const bodyRoleHits = roleWords.filter((word) => text.includes(word)).length;
  const exactTitleRole = titleText.includes(role.toLowerCase());
  const skillScore = skills.length
    ? (matchingSkills.length / skills.length) * 40
    : 8;
  const roleScore = exactTitleRole
    ? 45
    : roleWords.length
      ? (titleRoleHits / roleWords.length) * 35 +
        (bodyRoleHits / roleWords.length) * 10
      : 8;
  const freshnessScore = Math.max(0, 5 - Math.min(daysSince(job.created), 5));
  const matchScore = Math.min(
    98,
    Math.round(10 + skillScore + roleScore + freshnessScore),
  );

  return {
    matchScore,
    matchingSkills,
    missingSkills,
    priority: matchScore >= 82 ? "High" : matchScore >= 68 ? "Medium" : "Low",
    whyFits:
      matchingSkills.length > 0
        ? `Your resume shows ${matchingSkills.slice(0, 4).join(", ")}, which aligns with this ${job.title} posting.`
        : `This role aligns with your inferred target path (${role}), but you should review the listed gaps before applying.`,
  };
}

function formatJob(rawJob, analysis, index, source) {
  const title = rawJob.title || "Recommended Role";
  const scored = scoreJob(rawJob, analysis);
  return {
    id: rawJob.id || `${source}-${index}`,
    title,
    company: rawJob.company || "Company not listed",
    location: rawJob.location || "Location not listed",
    type: rawJob.type || "Full-time",
    salary: rawJob.salary || "Not listed",
    matchScore: scored.matchScore,
    matchingSkills: scored.matchingSkills,
    missingSkills: scored.missingSkills,
    whyFits: scored.whyFits,
    priority: scored.priority,
    postedDays: daysSince(rawJob.created),
    logo: jobInitials(title),
    logoColor: ["#7C3AED", "#2563EB", "#059669", "#D97706", "#DC2626"][
      index % 5
    ],
    url: rawJob.url || "",
    source,
  };
}

async function fetchAdzunaJobs(analysis) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return null;

  const country = (process.env.ADZUNA_COUNTRY || "in").toLowerCase();
  const location = process.env.ADZUNA_LOCATION || "India";
  const role = analysis.bestFitRoles[0]?.role || "Software Developer";
  const skills = analysis.extractedSkills
    .map((skill) => skill.name)
    .filter(Boolean)
    .slice(0, 4);
  const query = `${role} ${skills.join(" ")}`.trim();
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what: query,
    where: location,
    results_per_page: "12",
    sort_by: "date",
    content_type: "application/json",
  });
  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;
  const response = await fetch(url);
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Adzuna returned ${response.status} ${response.statusText}. Check ADZUNA_APP_ID / ADZUNA_APP_KEY and country code.`,
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.display ||
        data?.error ||
        `Adzuna request failed with ${response.status}`,
    );
  }

  const jobs = (data.results || []).map((job, index) =>
    formatJob(
      {
        id: job.id,
        title: job.title,
        company: job.company?.display_name,
        location: job.location?.display_name,
        type: /intern/i.test(`${job.title} ${job.description}`)
          ? "Internship"
          : "Full-time",
        salary:
          job.salary_min || job.salary_max
            ? `${job.salary_min ? Math.round(job.salary_min) : ""}${job.salary_min && job.salary_max ? " - " : ""}${job.salary_max ? Math.round(job.salary_max) : ""}`
            : "Not listed",
        description: stripHtml(job.description),
        created: job.created,
        url: job.redirect_url,
      },
      analysis,
      index,
      "adzuna",
    ),
  );

  return jobs.sort((a, b) => b.matchScore - a.matchScore).slice(0, 8);
}

async function fetchRemotiveJobs(analysis) {
  const role = analysis.bestFitRoles[0]?.role || "Software Developer";
  const skills = analysis.extractedSkills
    .map((skill) => skill.name)
    .filter(Boolean)
    .slice(0, 3);
  const query = encodeURIComponent(`${role} ${skills.join(" ")}`.trim());
  const response = await fetch(
    `https://remotive.com/api/remote-jobs?search=${query}`,
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(`Remotive request failed with ${response.status}`);

  const jobs = (data.jobs || []).slice(0, 16).map((job, index) =>
    formatJob(
      {
        id: job.id,
        title: job.title,
        company: job.company_name,
        location: job.candidate_required_location || "Remote",
        type: /intern/i.test(`${job.title} ${job.description}`)
          ? "Internship"
          : "Remote",
        salary: job.salary || "Not listed",
        description: stripHtml(job.description),
        created: job.publication_date,
        url: job.url,
      },
      analysis,
      index,
      "remotive",
    ),
  );

  return jobs.sort((a, b) => b.matchScore - a.matchScore).slice(0, 8);
}

function fallbackJobs(analysis) {
  return fallbackJobPool
    .map((job, index) => formatJob(job, analysis, index, "fallback-job-pool"))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 6);
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
      error:
        "Enter a name, valid email, and password with at least 8 characters.",
    });
  }

  const user = upsertUser({ name, email, password, provider: "email" });
  const token = createSession(user);
  res.json({ ok: true, token, user: publicUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
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
    name: `${display} Account`,
    email: `${provider}@connected.account`,
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

  if (!user)
    return res.status(401).json({ ok: false, error: "Not signed in." });
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
      console.warn("OpenAI analysis failed, trying Gemini:", aiError);
    }

    if (!aiAnalysis) {
      try {
        aiAnalysis = await analyzeWithGemini(resumeText);
        if (aiAnalysis) {
          source = "gemini";
          aiError = null;
        }
      } catch (error) {
        const geminiError = error?.message || "Gemini analysis failed.";
        aiError = [aiError, geminiError].filter(Boolean).join(" | ");
        source = aiError ? "fallback-ai-error" : "fallback";
        console.warn(
          "Gemini analysis failed, using fallback analysis:",
          geminiError,
        );
      }
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
      console.warn("OpenAI interview agent failed, trying Gemini:", warning);
    }

    if (!turn) {
      try {
        turn = await interviewTurnWithGemini(req.body);
        if (turn) {
          source = "gemini-agent";
          warning = null;
        }
      } catch (error) {
        const geminiWarning =
          error?.message || "Gemini interview agent failed.";
        warning = [warning, geminiWarning].filter(Boolean).join(" | ");
        console.warn(
          "Gemini interview agent failed, using fallback:",
          geminiWarning,
        );
      }
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

app.post("/api/generate-report", async (req, res) => {
  let source = "fallback-report-agent";
  let warning = null;

  try {
    let report = null;
    try {
      report = await reportWithGemini(req.body);
      if (report) source = "gemini-report-agent";
    } catch (error) {
      warning = error?.message || "Gemini report agent failed.";
      console.warn("Gemini report agent failed, trying OpenAI:", warning);
    }

    if (!report) {
      try {
        report = await reportWithOpenAI(req.body);
        if (report) {
          source = "openai-report-agent";
          warning = null;
        }
      } catch (error) {
        const openaiWarning = error?.message || "OpenAI report agent failed.";
        warning = [warning, openaiWarning].filter(Boolean).join(" | ");
        console.warn(
          "OpenAI report agent failed, using fallback:",
          openaiWarning,
        );
      }
    }

    const fallback = fallbackReport(req.body || {});
    const normalizedReport = normalizeReport(report, fallback);
    res.json({
      ok: true,
      source,
      warning,
      report: { ...normalizedReport, source, warning },
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message || "Could not generate report.",
    });
  }
});

app.post("/api/recommend-jobs", async (req, res) => {
  const analysis = normalizeAnalysis(
    req.body?.resumeAnalysis || fallbackAnalysis,
  );
  let source = "fallback-job-pool";
  let warning = null;
  let jobs = null;

  try {
    jobs = await fetchAdzunaJobs(analysis);
    if (jobs?.length) source = "adzuna";
  } catch (error) {
    warning = error?.message || "Live job search failed.";
    console.warn("Adzuna job search failed, trying Remotive:", warning);
  }

  if (!jobs?.length) {
    try {
      jobs = await fetchRemotiveJobs(analysis);
      if (jobs?.length) source = "remotive";
    } catch (error) {
      const remotiveWarning = error?.message || "Remotive job search failed.";
      warning = [warning, remotiveWarning].filter(Boolean).join(" | ");
      console.warn(
        "Remotive job search failed, using fallback pool:",
        remotiveWarning,
      );
    }
  }

  if (!jobs?.length) {
    jobs = fallbackJobs(analysis);
  }

  res.json({
    ok: true,
    source,
    warning,
    jobs,
  });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`RoleReady API running at http://localhost:${port}`);
});
