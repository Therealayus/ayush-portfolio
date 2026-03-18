import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
declare const process: any;

// https://vitejs.dev/config/
function geminiIntroMiddleware(): Plugin {
  return {
    name: "gemini-intro-middleware",
    configureServer(server) {
      const route = "/api/gemini-intro";
      const chatRoute = "/api/gemini-chat";
      let cachedPayload: { script: string; visemes: Array<{ t: number; v: string }> } | null = null;

      const buildIntroPrompt = () => {
        // Note: keep prompt bounded to your resume facts only.
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
      };

      const respondJson = (res: any, statusCode: number, data: any) => {
        res.statusCode = statusCode;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(data));
      };

      const readJsonBody = async (req: any) => {
        const chunks: string[] = [];
        return await new Promise<any>((resolve, reject) => {
          req.on("data", (chunk: any) => {
            // Avoid referencing the Node `Buffer` type (tsc might not include @types/node).
            const textChunk =
              typeof chunk === "string"
                ? chunk
                : typeof chunk?.toString === "function"
                  ? chunk.toString("utf8")
                  : String(chunk);
            chunks.push(textChunk);
          });
          req.on("end", () => {
            try {
              const raw = chunks.join("");
              if (!raw.trim()) return resolve({});
              resolve(JSON.parse(raw));
            } catch (e) {
              reject(e);
            }
          });
          req.on("error", (err: any) => reject(err));
        });
      };

      const generateVisemes = (scriptText: string) => {
        const s = scriptText.toUpperCase();
        const N = 14;
        const events: Array<{ t: number; v: string }> = [];

        const vowelKeys = ["A", "E", "I", "O", "U"] as const;
        const countInSlice = (slice: string, key: string) =>
          (slice.match(new RegExp(key, "g")) || []).length;

        for (let i = 0; i < N; i++) {
          const t = i / (N - 1);
          const start = Math.floor((i / N) * s.length);
          const end = Math.floor(((i + 1) / N) * s.length);
          const slice = s.slice(start, Math.max(start + 1, end));

          let bestVowel: string | null = null;
          let bestCount = 0;
          for (const vk of vowelKeys) {
            const c = countInSlice(slice, vk);
            if (c > bestCount) {
              bestCount = c;
              bestVowel = vk;
            }
          }

          let v = "rest";
          if (bestVowel && bestCount > 0) {
            v = bestVowel;
          } else if (slice.includes("TH")) {
            v = "TH";
          } else if (/[MBP]/.test(slice)) {
            v = "MBP";
          } else if (/[FV]/.test(slice)) {
            v = "FV";
          } else if (slice.includes("S")) {
            v = "S";
          } else if (slice.includes("Z")) {
            v = "Z";
          } else if (slice.includes("L")) {
            v = "L";
          } else if (slice.includes("R")) {
            v = "R";
          }

          events.push({ t, v });
        }

        if (events.length) events[events.length - 1] = { t: 1, v: "rest" };
        return events;
      };

      server.middlewares.use(route, async (req, res) => {
        try {
          const reqUrl = String((req as any)?.url || "");
          const debug = reqUrl.includes("debug=1");

          if (cachedPayload) {
            respondJson(res, 200, debug ? { ...cachedPayload, cached: true } : cachedPayload);
            return;
          }

          const apiKey = process.env.GEMINI_API_KEY;
          const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
          if (!apiKey) {
            respondJson(res, 500, { error: "Missing GEMINI_API_KEY" });
            return;
          }

          const prompt = buildIntroPrompt();

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

          const fetchFn = (globalThis as any).fetch as Function;
          const r = await fetchFn(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestPayload),
          });

          const data = await r.json();
          const parts = data?.candidates?.[0]?.content?.parts;
          const text = Array.isArray(parts)
            ? parts
                .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
                .join("")
            : "";

          const raw = String(text || "").trim();

          // The model may wrap text in code fences; strip them if present.
          const cleaned = raw
            .replace(/^```(json|text)?\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```$/i, "")
            .trim();

          const fallbackScript =
            "Hi, I'm Ayush Gupta, a full-stack developer building scalable, high-performance applications with React, Next.js, TypeScript, Node.js, and Express. I design pixel-perfect UIs and secure REST APIs, optimizing state with Redux, Context API, and React Query.";

          const script = cleaned && cleaned.length > 0 ? cleaned : fallbackScript;

          // Ensure the spoken intro reflects your updated current/previous roles.
          // (Some Gemini generations may omit those facts even when instructed.)
          const finalScript = (() => {
            const hasAyush = /ayush\s+gupta/i.test(script);
            const hasClavis = /clavis/i.test(script);
            const hasNeo = /neo\s+infra/i.test(script) || /neo\s+infra\s+fintech/i.test(script);
            if (hasAyush && hasClavis && hasNeo) return script;

            const sentence1 =
              "Hi, I'm Ayush Gupta, a Full-Stack Developer at Clavis Technologies since January 2026.";
            const sentence2 =
              "Previously, I worked at Neo Infra Fintech Inclusion Pvt. Ltd. from 10/2024 to 12/2025, building React/Next.js/TypeScript apps with secure REST APIs and strong state management.";
            return `${sentence1} ${sentence2}`;
          })();

          const visemes = generateVisemes(finalScript);

          const payload = { script: finalScript, visemes };

          cachedPayload = payload;
          respondJson(
            res,
            200,
            debug
              ? {
                  ...payload,
                  debug: {
                    geminiResponseStatus: r.status,
                    geminiOk: r.ok,
                    raw: raw,
                    cleaned: cleaned.slice(0, 2000),
                    geminiData: JSON.stringify(data).slice(0, 2500),
                  },
                }
              : payload
          );
        } catch (err: any) {
          respondJson(res, 500, {
            error: err?.message || "Gemini intro generation failed",
          });
        }
      });

      server.middlewares.use(chatRoute, async (req, res) => {
        try {
          const body = await readJsonBody(req);
          const message =
            typeof body?.message === "string" ? body.message.trim() : "";

          if (!message) {
            respondJson(res, 400, { error: "Missing 'message' field" });
            return;
          }

          const apiKey = process.env.GEMINI_API_KEY;
          const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
          if (!apiKey) {
            respondJson(res, 500, { error: "Missing GEMINI_API_KEY" });
            return;
          }

          const prompt = `You are answering questions about Ayush Gupta's portfolio only.

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

          const endpoint = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(
            model
          )}:generateContent?key=${encodeURIComponent(apiKey)}`;

          const requestPayload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 350,
            },
          };

          const fetchFn = (globalThis as any).fetch as Function;
          const r = await fetchFn(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestPayload),
          });

          const data = await r.json();
          const parts = data?.candidates?.[0]?.content?.parts;
          const text = Array.isArray(parts)
            ? parts
                .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
                .join("")
            : "";

          const raw = String(text || "").trim();
          const cleaned = raw
            .replace(/^```(json|text)?\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```$/i, "")
            .trim();

          const script =
            cleaned ||
            "I can answer about my portfolio projects, skills, and experience. Ask me about NifiPayments or my development work.";

          const sentences = script
            .split(/(?<=[.!?])\s+/)
            .map((s: string) => s.trim())
            .filter(Boolean);

          const q = message.toLowerCase();
          const secondSentence = (() => {
            if (
              q.includes("payment gateway") ||
              (q.includes("gateway") && q.includes("nifi"))
            ) {
              return "I implemented the payment gateway interface with secure checkout flows, integrated encrypted payment payloads, handled status callbacks, and improved the UX for payment success, errors, and retries.";
            }
            if (q.includes("dashboard") || q.includes("merchant")) {
              return "I developed the dashboard experience for transactions and settlements, including secure login/onboarding and compliance/KYC flows, along with REST API integration for history, reports, and analytics with optimized caching.";
            }
            if (q.includes("developer documents") || q.includes("api playground")) {
              return "I built the developer documentation portal with interactive API playgrounds, nested navigation, code examples, and live request/response previews by integrating secured APIs.";
            }
            if (q.includes("petzaade") || q.includes("grooming") || q.includes("pet")) {
              return "I implemented backend modules for bookings, user management, and service scheduling, and integrated payment and notification flows using Firebase FCM for real-time updates.";
            }
            if (q.includes("match flick") || q.includes("dating") || q.includes("sockets")) {
              return "I built real-time chat and swipe/matching backend services with Node.js sockets and used Firebase FCM for in-app notifications like new messages and match alerts.";
            }

            // Generic but still in-scope.
            return "I can also explain my frontend and backend approach using React.js/Next.js/TypeScript and Node.js/Express with secure REST APIs and state management.";
          })();

          let finalScript = script;
          if (sentences.length >= 2) {
            finalScript = sentences.slice(0, 2).join(" ");
          } else {
            const first =
              sentences[0] ||
              "I can answer about my portfolio projects and experience.";
            finalScript = `${first}${first.endsWith(".") ? "" : "."} ${secondSentence}`;
          }

          // Persona enforcement: ensure replies sound like "Ayush" (first-person).
          if (!/^\s*I\b/i.test(finalScript)) {
            finalScript = `I am Ayush Gupta. ${finalScript}`;
          }

          const visemes = generateVisemes(finalScript);
          respondJson(res, 200, { script: finalScript, visemes });
        } catch (err: any) {
          respondJson(res, 500, {
            error: err?.message || "Gemini chat failed",
          });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load non-VITE env vars from `.env` (so GEMINI_API_KEY is available server-side).
  const env = loadEnv(mode, process.cwd(), "");
  if (env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (env.GEMINI_MODEL) process.env.GEMINI_MODEL = env.GEMINI_MODEL;

  return {
    plugins: [react(), geminiIntroMiddleware()],
  };
});
