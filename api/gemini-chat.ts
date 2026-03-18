import {
  boundedChatSecondSentence,
  cleanGeminiText,
  generateVisemes,
} from "./_shared";

declare const process: any;

function boundedChatPrompt(message: string): string {
  return `You are answering questions about Ayush Gupta's portfolio only.

Rules:
- Use ONLY the information below. Do not invent anything.
- Keep it short and voice-friendly.
- The answer MUST be exactly 2 sentences.
- Sentence 1 should directly address what the user asked about.
- Sentence 2 MUST start with "I" and mention what Ayush did (role/actions) for that topic.
- Do not use headings, bullets, or lists.
- If the user asks something out of scope, respond that you can only answer about the portfolio and ask them to ask about your work, skills, projects, or experience.

Ayush facts:
- Name: Ayush Gupta
- Profile: Full-Stack Developer specializing in React.js, Next.js, TypeScript, Node.js, Express; pixel-perfect UIs; secure REST APIs; state mgmt with Redux Toolkit, Context API, React Query.
- Education: Kurukshetra University, B.Sc (2016–2019)
- Experience: Neo Infra Fintech Inclusion Pvt. Ltd. (10/2024–12/2025), Clavis Technologies (01/2026–Present), Metaware Solutions (10/2023–07/2024), BR Softech Pvt. Ltd. (04/2021–02/2023)
- Projects: NifiPayments Developer Documents, NifiPayments Dashboard, NifiPayments Payment Gateway; Metaware Solutions Dashboard; PetZaade Style - Pet Grooming App; Match Flick – Dating App
- Skills highlights: REST APIs, Axios/Fetch, OAuth/JWT Auth, WebSockets, Firebase FCM, Node.js, MongoDB/Express, Drizzle ORM, Socket.IO, PostgreSQL (basics)

User question:
${message}

Return ONLY plain text (exactly the 2 sentences, no extra text).`;
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "POST required" });
      return;
    }

    const body =
      typeof req.body === "object" ? req.body : await Promise.resolve(req.body).catch(() => ({}));
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      res.status(400).json({ error: "Missing 'message' field" });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";

    if (!apiKey) {
      res.status(500).json({ error: "Missing GEMINI_API_KEY" });
      return;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const prompt = boundedChatPrompt(message);

    const requestPayload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 350,
      },
    };

    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    });

    const data = await r.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts)
      ? parts.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("")
      : "";

    const raw = String(text || "").trim();
    const cleaned = cleanGeminiText(raw);

    const fallbackScript =
      "I can answer about my portfolio projects, skills, and experience. Ask me about NifiPayments or my development work.";

    const script = cleaned || fallbackScript;

    const sentences = script
      .split(/(?<=[.!?])\s+/)
      .map((s: string) => s.trim())
      .filter(Boolean);

    const secondSentence = boundedChatSecondSentence(message);

    let finalScript = script;
    if (sentences.length >= 2) {
      finalScript = sentences.slice(0, 2).join(" ");
    } else {
      const first = sentences[0] || "I can answer about my portfolio projects and experience.";
      finalScript = `${first}${first.endsWith(".") ? "" : "."} ${secondSentence}`;
    }

    if (!/^\s*I\b/i.test(finalScript)) {
      finalScript = `I am Ayush Gupta. ${finalScript}`;
    }

    const visemes = generateVisemes(finalScript);
    res.status(200).json({ script: finalScript, visemes });
  } catch (err: any) {
    res
      .status(500)
      .json({ error: err?.message || "Gemini chat failed" });
  }
}

