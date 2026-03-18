import {
  boundedIntroFallback,
  cleanGeminiText,
  generateVisemes,
} from "./_shared";

declare const process: any;

let cachedPayload: { script: string; visemes: Array<{ t: number; v: string }> } | null =
  null;

function boundedIntroPrompt(): string {
  return `Create a short first-person intro for a developer portfolio hero.
Use ONLY these facts (no invention):
- Name: Ayush Gupta
- Role: Full-Stack Developer (React.js, Next.js, TypeScript, Node.js, Express)
- Strengths: pixel-perfect UIs, secure REST APIs, performance tuning, state mgmt with Redux Toolkit, Context API, React Query
- Education: Kurukshetra University, B.Sc (2016-2019)
- Experience: Neo Infra Fintech Inclusion Pvt. Ltd. (10/2024–12/2025); Clavis Technologies (01/2026–Present); Metaware Solutions (10/2023–07/2024); BR Softech Pvt. Ltd. (04/2021–02/2023)
- Projects: NifiPayments developer docs, dashboard, payment gateway

Write 2 short sentences (about 50-80 words total).
Sentence 1 must mention that you are a Full-Stack Developer at Clavis Technologies since January 2026.
Sentence 2 must mention that you worked at Neo Infra Fintech Inclusion Pvt. Ltd. from 10/2024 to 12/2025 and briefly your key strengths (React/Next.js/TypeScript and secure REST APIs).
Return ONLY plain text (no JSON, no markdown, no backticks).`;
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "POST required" });
      return;
    }

    const debug = String(req.url || "").includes("debug=1");

    if (cachedPayload) {
      res.status(200).json(debug ? { ...cachedPayload, cached: true } : cachedPayload);
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";

    if (!apiKey) {
      res.status(500).json({ error: "Missing GEMINI_API_KEY" });
      return;
    }

    const prompt = boundedIntroPrompt();

    const endpoint = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const requestPayload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 900,
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

    const script = cleaned && cleaned.length > 0 ? cleaned : boundedIntroFallback();

    // Safety: enforce name + both companies if model omits them.
    const finalScript = (() => {
      const hasAyush = /ayush\s+gupta/i.test(script);
      const hasClavis = /clavis/i.test(script);
      const hasNeo =
        /neo\s+infra/i.test(script) || /neo\s+infra\s+fintech/i.test(script);
      if (hasAyush && hasClavis && hasNeo) return script;

      const sentence1 =
        "Hi, I'm Ayush Gupta, a Full-Stack Developer at Clavis Technologies since January 2026.";
      const sentence2 =
        "Previously, I worked at Neo Infra Fintech Inclusion Pvt. Ltd. from 10/2024 to 12/2025, building React/Next.js/TypeScript apps with secure REST APIs and strong state management.";
      return `${sentence1} ${sentence2}`;
    })();

    const visemes = generateVisemes(finalScript);
    cachedPayload = { script: finalScript, visemes };

    res.status(200).json(
      debug ? { ...cachedPayload, debug: { raw, cleaned } } : cachedPayload
    );
  } catch (err: any) {
    res
      .status(500)
      .json({ error: err?.message || "Gemini intro generation failed" });
  }
}

