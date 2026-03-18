type VisemeEvent = { t: number; v: string };

export function generateVisemes(scriptText: string): VisemeEvent[] {
  const s = (scriptText || "").toUpperCase();
  const N = 14; // best-effort: enough changes during short hero intro
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

  // Ensure we end in rest.
  if (events.length) events[events.length - 1] = { t: 1, v: "rest" };
  return events;
}

export function cleanGeminiText(raw: string): string {
  const cleaned = String(raw || "")
    .trim()
    .replace(/^```(json|text)?\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return cleaned;
}

export function boundedIntroFallback(): string {
  return "Hi, I'm Ayush Gupta, a Full-Stack Developer at Clavis Technologies since January 2026. Previously, I worked at Neo Infra Fintech Inclusion Pvt. Ltd. (10/2024 to 12/2025) and built React/Next.js with secure REST APIs and strong state management. Tap/click the character to hear this intro again.";
}

export function boundedChatSecondSentence(message: string): string {
  const q = (message || "").toLowerCase();
  if (q.includes("payment gateway") || (q.includes("gateway") && q.includes("nifi"))) {
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
  return "I can also explain my frontend and backend approach using React.js/Next.js/TypeScript and Node.js/Express with secure REST APIs and state management.";
}

