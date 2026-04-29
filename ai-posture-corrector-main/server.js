require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── Issue Detection ──────────────────────────────────────────────────────────
function detectIssueType(text) {
  const t = text.toLowerCase();
  if (t.includes("neck") || t.includes("cervical") || t.includes("chin"))
    return { type: "neck_issue", label: "Neck & Cervical Alignment" };
  if (t.includes("back") || t.includes("spine") || t.includes("lumbar") || t.includes("hunch"))
    return { type: "spine_issue", label: "Spine & Back Alignment" };
  if (t.includes("shoulder") || t.includes("trap") || t.includes("upper body"))
    return { type: "shoulder_issue", label: "Shoulder Imbalance" };
  if (t.includes("sit") || t.includes("hour") || t.includes("long") || t.includes("fatigue") || t.includes("tired"))
    return { type: "fatigue_issue", label: "Prolonged Sitting Fatigue" };
  if (t.includes("pain") || t.includes("ache") || t.includes("sore") || t.includes("hurt"))
    return { type: "pain_issue", label: "Musculoskeletal Pain" };
  if (t.includes("eye") || t.includes("screen") || t.includes("monitor") || t.includes("glare"))
    return { type: "eye_strain", label: "Eye Strain & Screen Fatigue" };
  if (t.includes("wrist") || t.includes("hand") || t.includes("carpal"))
    return { type: "wrist_issue", label: "Wrist & Hand Ergonomics" };
  if (t.includes("desk") || t.includes("setup") || t.includes("chair") || t.includes("ergonomic"))
    return { type: "setup_issue", label: "Workstation Setup" };
  if (t.includes("exercise") || t.includes("stretch") || t.includes("routine") || t.includes("workout"))
    return { type: "exercise_query", label: "Posture Exercises & Stretches" };
  return { type: "general_posture", label: "General Posture Advice" };
}
function cleanAIResponse(text) {
  return text
    // remove markdown bold/italic
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")

    // remove extra line breaks
    .replace(/\n{2,}/g, "\n")

    // fix spacing after numbers (1. text)
    .replace(/(\d+)\.\s*/g, "\n$1. ")

    // remove leading/trailing spaces
    .trim();
}
function extractDuration(text) {
  const match = text.match(/(\d+)\s*(hour|hr|minute|min|second|sec)/i);
  if (match) return `${match[1]} ${match[2]}(s)`;
  return null;
}

function buildPrompt(userText, issueInfo, duration, context) {
  const durationLine = duration ? `Duration of issue: ${duration}` : "";
  const contextLine = context ? `Additional context: ${context}` : "";

  return `You are PostureAI, an expert ergonomics and posture correction assistant. You give concise, practical, medically-informed advice.

User Problem: ${userText}
Posture Issue Category: ${issueInfo.label}
${durationLine}
${contextLine}

Instructions:
- Give exactly 3-5 actionable steps, numbered
- Each step must be specific and immediately doable
- Include one quick fix (under 30 seconds) and one long-term habit
- Mention if they should see a professional if symptoms are severe
- Keep tone supportive but direct
- No filler phrases like "Great question!" or "I hope this helps"
- End with one specific exercise with rep count`;
}

// ─── /api/chat ────────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { message, context } = req.body;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: "Message is required." });
  }

  const issueInfo = detectIssueType(message);
  const duration = extractDuration(message);
  const prompt = buildPrompt(message, issueInfo, duration, context);

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API key not configured on server." });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://postureai.app",
        "X-Title": "PostureAI Health Assistant",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3-8b-instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        top_p: 0.9,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter error:", errText);
      return res.status(502).json({ error: "AI service error. Please try again." });
    }

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content || "No response from AI.";
    const cleaned = cleanAIResponse(aiText);
    res.json({
      reply: aiText,
      issueType: issueInfo.type,
      issueLabel: issueInfo.label,
      model: data.model || "llama-3-8b",
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal server error. Please try again." });
  }
});

// ─── /api/weekly-report ───────────────────────────────────────────────────────
app.post("/api/weekly-report", async (req, res) => {
  const { weekData, userProfile } = req.body;

  if (!weekData) {
    return res.status(400).json({ error: "Week data is required." });
  }

  const prompt = `You are PostureAI, generating a weekly posture health report. Be analytical and specific.

Weekly Posture Data:
${JSON.stringify(weekData, null, 2)}

User Profile:
${JSON.stringify(userProfile || {}, null, 2)}

Generate a structured weekly report with:
1. Overall Performance Summary (2-3 sentences with specific numbers)
2. Best Day & Worst Day analysis
3. Top 3 Issues detected this week
4. Improvement trend (improving/declining/stable with %)
5. Specific recommendations for next week (3 actionable items)
6. One posture exercise to focus on this week

Be data-driven. Use the numbers. Keep total length under 400 words.`;

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API key not configured." });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://postureai.app",
        "X-Title": "PostureAI Health Assistant",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3-8b-instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        top_p: 0.9,
        max_tokens: 700,
      }),
    });

    if (!response.ok) {
      return res.status(502).json({ error: "AI service error." });
    }

    const data = await response.json();
    const report = data.choices?.[0]?.message?.content || "Could not generate report.";

    res.json({ report, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── /api/setup-advice ────────────────────────────────────────────────────────
app.post("/api/setup-advice", async (req, res) => {
  const { height, workHours, deviceType, existingPain } = req.body;

  const prompt = `You are an ergonomics expert. Give precise workstation setup advice.

User Data:
- Height: ${height} cm
- Daily work hours: ${workHours} hours
- Primary device: ${deviceType}
- Existing pain areas: ${existingPain || "None mentioned"}

Provide:
1. Exact desk height recommendation (in cm) with formula explanation
2. Monitor/screen distance and height (specific measurements)
3. Chair height and lumbar support tips
4. Keyboard and mouse placement
5. Lighting recommendation
6. Break schedule (e.g., every X minutes, do Y)

Be specific with numbers. This person is ${height}cm tall.`;

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API key not configured." });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://postureai.app",
        "X-Title": "PostureAI Health Assistant",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3-8b-instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        top_p: 0.9,
        max_tokens: 600,
      }),
    });

    const data = await response.json();
    const advice = data.choices?.[0]?.message?.content || "Could not generate advice.";
    res.json({ advice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Catch-all ────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 PostureAI server running on http://localhost:${PORT}`);
});