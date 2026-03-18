import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import setCharacter from "./utils/character";
import setLighting from "./utils/lighting";
import { useLoading } from "../../context/LoadingProvider";
import handleResize from "./utils/resizeUtils";
import {
  handleMouseMove,
  handleTouchEnd,
  handleHeadRotation,
  handleTouchMove,
} from "./utils/mouseUtils";
import setAnimations from "./utils/animationUtils";
import { setProgress } from "../Loading";

const Scene = () => {
  // Ensure debug flags exist even before React effects run.
  if (typeof window !== "undefined") {
    (window as any).__ayushMicActive ??= false;
    (window as any).__ayushLastTranscript ??= "";
    (window as any).__ayushSpeechRecognitionSupported ??=
      Boolean(
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      );
  }

  const canvasDiv = useRef<HTMLDivElement | null>(null);
  const hoverDivRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef(new THREE.Scene());
  const { setLoading } = useLoading();

  const [character, setChar] = useState<THREE.Object3D | null>(null);
  const hasSpokenIntroRef = useRef(false);
  type VisemeEvent = { t: number; v: string };
  type IntroPayload = { script: string; visemes: VisemeEvent[] };
  type MorphMesh = { mesh: THREE.Mesh; dict: Record<string, number> };
  type LipState = {
    active: boolean;
    sessionId: number;
    startPerfMs: number;
    estimatedDurationMs: number;
    visemes: VisemeEvent[];
    morphMeshes: MorphMesh[];
    lastVisemeIndex: number;
  };

  const introPayloadRef = useRef<IntroPayload | null>(null);
  const animationsRef = useRef<{ startIntro: () => void } | null>(null);
  const fetchIntroPromiseRef = useRef<Promise<IntroPayload> | null>(null);
  const speechSessionIdRef = useRef(0);
  const lipStateRef = useRef<LipState | null>(null);

  const recognitionRef = useRef<any>(null);
  const micBlockedRef = useRef(false);
  const shouldListenRef = useRef(true);
  const isSpeakingRef = useRef(false);
  const isHandlingChatRef = useRef(false);
  const lastTranscriptRef = useRef<string>("");
  const hasUserGestureRef = useRef(false);
  const silenceTimerRef = useRef<number | undefined>(undefined);
  const restartTimerRef = useRef<number | undefined>(undefined);
  const recognitionActiveRef = useRef(false);
  const recognitionStartingRef = useRef(false);

  // Voice-activation: start SpeechRecognition only when mic volume is detected.
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<any>(null);
  const analyserRef = useRef<any>(null);
  const analyserDataRef = useRef<Uint8Array | null>(null);
  const volumeRafRef = useRef<number | undefined>(undefined);
  const voiceCooldownUntilRef = useRef<number>(0);

  const fallbackIntro =
    "Hi, I'm Ayush Gupta, a Full-Stack Developer at Clavis Technologies since January 2026. Previously, I worked at Neo Infra Fintech Inclusion Pvt. Ltd. (10/2024 to 12/2025) and built React/Next.js with secure REST APIs and strong state management. Tap/click the character to hear this intro again.";

  const fetchIntroPayload = async (): Promise<IntroPayload> => {
    if (introPayloadRef.current) return introPayloadRef.current;
    if (fetchIntroPromiseRef.current) return fetchIntroPromiseRef.current;

    fetchIntroPromiseRef.current = fetch("/api/gemini-intro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Gemini intro request failed: ${r.status}`);
        const data = (await r.json()) as {
          script?: string;
          visemes?: Array<{ t?: number; v?: string }>;
        };

        const script =
          typeof data?.script === "string" && data.script.trim()
            ? data.script.trim()
            : fallbackIntro;

        const visemes =
          Array.isArray(data?.visemes) && data.visemes.length
            ? data.visemes
                .map((x) => {
                  const t = typeof x?.t === "number" ? x.t : null;
                  const v =
                    typeof x?.v === "string" ? x.v.trim().toUpperCase() : "";
                  if (t === null || t < 0 || t > 1) return null;
                  if (!v) return null;
                  return { t, v };
                })
                .filter(Boolean)
            : [];

        const payload: IntroPayload = { script, visemes: visemes as VisemeEvent[] };
        introPayloadRef.current = payload;
        return payload;
      })
      .catch(() => {
        const payload: IntroPayload = { script: fallbackIntro, visemes: [] };
        introPayloadRef.current = payload;
        return payload;
      });

    return fetchIntroPromiseRef.current;
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // ignore
    }
    recognitionStartingRef.current = false;
    recognitionActiveRef.current = false;
    voiceCooldownUntilRef.current = Date.now() + 250;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = undefined;
    }
  };

  const initRecognition = () => {
    if (recognitionRef.current) return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      micBlockedRef.current = true;
      shouldListenRef.current = false;
      (window as any).__ayushSpeechRecognitionSupported = false;
      console.warn(
        "[Ayush GLB] SpeechRecognition not supported on this browser."
      );
      // No mic support; nothing else we can do.
      // (Character will still work with click-to-replay intro.)
      return;
    }
    (window as any).__ayushSpeechRecognitionSupported = true;
    console.log("[Ayush GLB] SpeechRecognition supported.");

    const rec = new SpeechRecognition();
    // Start/stop based on voice-activation (we don't auto-restart on errors).
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    // Keep it consistent for your voice replies (English portfolio).
    rec.lang = "en-US";

    (rec as any).onstart = () => {
      // Helps debug in DevTools if microphone starts but onresult doesn't fire.
      (window as any).__ayushMicActive = true;
      recognitionActiveRef.current = true;
      recognitionStartingRef.current = false;
      console.log("[Ayush GLB] SpeechRecognition started");
    };

    (rec as any).onspeechstart = () => {
      console.log("[Ayush GLB] onspeechstart");
    };

    (rec as any).onspeechend = () => {
      console.log("[Ayush GLB] onspeechend");
    };

    rec.onresult = (event: any) => {
      try {
        if (isSpeakingRef.current || isHandlingChatRef.current) return;

        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r?.isFinal) {
            finalTranscript += r?.[0]?.transcript ?? "";
          }
        }

        finalTranscript = finalTranscript.trim();

        if (!finalTranscript) return;
        (window as any).__ayushLastTranscript = finalTranscript;

        if (finalTranscript === lastTranscriptRef.current) return;
        lastTranscriptRef.current = finalTranscript;
        console.log("[Ayush GLB] Final transcript:", finalTranscript);
        void handleChat(finalTranscript);
      } catch {
        // ignore
      }
    };

    rec.onerror = (event: any) => {
      const err = event?.error;
      console.warn("[Ayush GLB] SpeechRecognition error:", err);
      recognitionStartingRef.current = false;
      // Most important case is permission blocked.
      if (
        err === "not-allowed" ||
        err === "service-not-allowed" ||
        err === "audio-capture"
      ) {
        micBlockedRef.current = true;
        shouldListenRef.current = false;
      }

      // On "no-speech" we simply wait for the next voice-activation trigger.
    };

    rec.onend = () => {
      (window as any).__ayushMicActive = false;
      recognitionActiveRef.current = false;
      recognitionStartingRef.current = false;
      // Do nothing here; voice-activation will start SpeechRecognition next time.
    };

    recognitionRef.current = rec;
  };

  const startListening = () => {
    if (micBlockedRef.current) return;
    if (recognitionActiveRef.current || recognitionStartingRef.current) return;
    initRecognition();
    if (!recognitionRef.current) return;
    shouldListenRef.current = true;
    (window as any).__ayushMicActive = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = undefined;
    }
    try {
      console.log("[Ayush GLB] Starting SpeechRecognition...");
      recognitionStartingRef.current = true;
      recognitionRef.current.start();
    } catch (e: any) {
      const msg = String(e?.message || e || "");
      console.warn("[Ayush GLB] recognition.start failed:", msg);
      recognitionStartingRef.current = false;
      if (
        msg.toLowerCase().includes("not-allowed") ||
        msg.toLowerCase().includes("service-not-allowed") ||
        msg.toLowerCase().includes("audio-capture")
      ) {
        micBlockedRef.current = true;
        shouldListenRef.current = false;
      }
    }
  };

  const ensureMicAnalyser = async () => {
    if (micStreamRef.current && analyserRef.current) return;
    const gUM = navigator?.mediaDevices?.getUserMedia;
    if (!gUM) {
      micBlockedRef.current = true;
      shouldListenRef.current = false;
      return;
    }

    try {
      const stream = await gUM({ audio: true });
      micStreamRef.current = stream;

      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        micBlockedRef.current = true;
        shouldListenRef.current = false;
        return;
      }

      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;
      analyserDataRef.current = new Uint8Array(analyser.fftSize);

      console.log("[Ayush GLB] Mic analyser ready");
    } catch (e) {
      micBlockedRef.current = true;
      shouldListenRef.current = false;
      console.warn("[Ayush GLB] getUserMedia failed:", e);
    }
  };

  const startVoiceActivation = () => {
    if (volumeRafRef.current) return;

    const loop = () => {
      try {
        if (!shouldListenRef.current || micBlockedRef.current || isSpeakingRef.current || isHandlingChatRef.current) {
          volumeRafRef.current = window.requestAnimationFrame(loop);
          return;
        }
        const analyser = analyserRef.current;
        const dataArr = analyserDataRef.current;
        if (!analyser || !dataArr) {
          volumeRafRef.current = window.requestAnimationFrame(loop);
          return;
        }
        analyser.getByteTimeDomainData(dataArr);
        // RMS from time-domain samples.
        let sumSq = 0;
        for (let i = 0; i < dataArr.length; i++) {
          const v = (dataArr[i] - 128) / 128;
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / dataArr.length);

        // Threshold tuned for typical laptop mic levels.
        const TH = 0.035;
        if (rms > TH && Date.now() >= voiceCooldownUntilRef.current) {
          console.log("[Ayush GLB] Voice detected (rms):", rms.toFixed(3));
          voiceCooldownUntilRef.current = Date.now() + 1200;
          if (!recognitionActiveRef.current && !recognitionStartingRef.current) {
            startListening();
          }
        }
      } catch {
        // ignore
      }

      volumeRafRef.current = window.requestAnimationFrame(loop);
    };

    volumeRafRef.current = window.requestAnimationFrame(loop);
  };

  const fetchChatPayload = async (message: string): Promise<IntroPayload> => {
    try {
      const r = await fetch("/api/gemini-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!r.ok) throw new Error(`Gemini chat request failed: ${r.status}`);
      const data = (await r.json()) as { script?: string; visemes?: VisemeEvent[] };
      const script =
        typeof data?.script === "string" && data.script.trim()
          ? data.script.trim()
          : fallbackIntro;
      const visemes = Array.isArray(data?.visemes) ? data.visemes : [];
      return { script, visemes };
    } catch {
      return {
        script:
          "I can answer about my portfolio projects, skills, and experience. Ask me about NifiPayments or my development work.",
        visemes: [],
      };
    }
  };

  const speakPayload = async (
    payload: IntroPayload,
    startAnimation: boolean
  ) => {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;

    if (startAnimation) {
      animationsRef.current?.startIntro();
    }

    const script = payload.script;

    // Stop recognition to avoid capturing our own voice.
    isSpeakingRef.current = true;
    stopListening();

    window.speechSynthesis.cancel();
    const sessionId = ++speechSessionIdRef.current;

    const morphMeshes = lipStateRef.current?.morphMeshes ?? [];
    const estimatedDurationMs = (() => {
      const words = script.trim().split(/\s+/).filter(Boolean).length;
      return Math.max(1800, Math.round((words / 2.5) * 1000));
    })();

    if (morphMeshes.length) {
      if (!lipStateRef.current) {
        lipStateRef.current = {
          active: true,
          sessionId,
          startPerfMs: performance.now(),
          estimatedDurationMs,
          visemes: payload.visemes,
          morphMeshes,
          lastVisemeIndex: 0,
        };
      } else {
        lipStateRef.current.active = true;
        lipStateRef.current.sessionId = sessionId;
        lipStateRef.current.startPerfMs = performance.now();
        lipStateRef.current.estimatedDurationMs = estimatedDurationMs;
        lipStateRef.current.visemes = payload.visemes;
        lipStateRef.current.lastVisemeIndex = 0;
      }
    }

    const utterance = new SpeechSynthesisUtterance(script);
    utterance.lang = "en-IN";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      if (lipStateRef.current && lipStateRef.current.sessionId === sessionId) {
        lipStateRef.current.active = false;
      }
      isSpeakingRef.current = false;
      isHandlingChatRef.current = false;
    };

    utterance.onerror = () => {
      isSpeakingRef.current = false;
      isHandlingChatRef.current = false;
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleChat = async (message: string) => {
    if (isSpeakingRef.current || isHandlingChatRef.current) return;
    isHandlingChatRef.current = true;
    const payload = await fetchChatPayload(message);
    await speakPayload(payload, false);
  };

  const speakIntro = async (startAnimation: boolean) => {
    const payload = await fetchIntroPayload();
    await speakPayload(payload, startAnimation);
  };

  useEffect(() => {
    // Debug flag to confirm whether Chrome actually started SpeechRecognition.
    (window as any).__ayushMicActive = false;
    (window as any).__ayushLastTranscript = "";
    (window as any).__ayushSpeechRecognitionSupported = undefined;

    const enableMicAfterFirstGesture = () => {
      if (hasUserGestureRef.current) return;
      hasUserGestureRef.current = true;
      shouldListenRef.current = true;
      console.log("[Ayush GLB] User gesture detected, enabling mic...");

      // Get mic permission and start voice-activation.
      void ensureMicAnalyser().then(() => {
        startVoiceActivation();
      });
      window.removeEventListener("pointerdown", enableMicAfterFirstGesture);
    };

    // Microphone capture often needs a user gesture (browser permission policy).
    // We start listening after the first pointer interaction anywhere on the page.
    window.addEventListener("pointerdown", enableMicAfterFirstGesture);

    if (canvasDiv.current) {
      // Start fetching the Gemini intro early, so speech can align with intro animation.
      void fetchIntroPayload();

      let rect = canvasDiv.current.getBoundingClientRect();
      let container = { width: rect.width, height: rect.height };
      const aspect = container.width / container.height;
      const scene = sceneRef.current;

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
      });
      renderer.setSize(container.width, container.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      canvasDiv.current.appendChild(renderer.domElement);

      const camera = new THREE.PerspectiveCamera(14.5, aspect, 0.1, 1000);
      camera.position.z = 10;
      camera.position.set(0, 13.1, 24.7);
      camera.zoom = 1.1;
      camera.updateProjectionMatrix();

      let headBone: THREE.Object3D | null = null;
      let screenLight: any | null = null;
      let mixer: THREE.AnimationMixer;

      const clock = new THREE.Clock();

      const light = setLighting(scene);
      let progress = setProgress((value) => setLoading(value));
      const { loadCharacter } = setCharacter(renderer, scene, camera);

      loadCharacter().then((gltf) => {
        if (gltf) {
          const animations = setAnimations(gltf);
          animationsRef.current = { startIntro: animations.startIntro };
          hoverDivRef.current && animations.hover(gltf, hoverDivRef.current);
          mixer = animations.mixer;
          let character = gltf.scene;
          setChar(character);
          scene.add(character);

          // Detect morph targets for best-effort lip-sync.
          const morphMeshes: MorphMesh[] = [];
          character.traverse((child: any) => {
            if (child?.isMesh && child?.morphTargetDictionary && child?.morphTargetInfluences) {
              morphMeshes.push({
                mesh: child as THREE.Mesh,
                dict: child.morphTargetDictionary as Record<string, number>,
              });
            }
          });

          lipStateRef.current = {
            active: false,
            sessionId: 0,
            startPerfMs: 0,
            estimatedDurationMs: 1,
            visemes: [],
            morphMeshes,
            lastVisemeIndex: 0,
          };

          headBone = character.getObjectByName("spine006") || null;
          screenLight = character.getObjectByName("screenlight") || null;
          progress.loaded().then(() => {
            setTimeout(() => {
              light.turnOnLights();
              animations.startIntro();
              if (!hasSpokenIntroRef.current) {
                hasSpokenIntroRef.current = true;
                void speakIntro(false);
              }
            }, 2500);
          });
          window.addEventListener("resize", () =>
            handleResize(renderer, camera, canvasDiv, character)
          );
        }
      });

      let mouse = { x: 0, y: 0 },
        interpolation = { x: 0.1, y: 0.2 };

      const onMouseMove = (event: MouseEvent) => {
        handleMouseMove(event, (x, y) => (mouse = { x, y }));
      };
      let debounce: number | undefined;
      const onTouchStart = (event: TouchEvent) => {
        const element = event.target as HTMLElement;
        debounce = setTimeout(() => {
          element?.addEventListener("touchmove", (e: TouchEvent) =>
            handleTouchMove(e, (x, y) => (mouse = { x, y }))
          );
        }, 200);
      };

      const onTouchEnd = () => {
        handleTouchEnd((x, y, interpolationX, interpolationY) => {
          mouse = { x, y };
          interpolation = { x: interpolationX, y: interpolationY };
        });
      };

      document.addEventListener("mousemove", (event) => {
        onMouseMove(event);
      });
      const landingDiv = document.getElementById("landingDiv");
      if (landingDiv) {
        landingDiv.addEventListener("touchstart", onTouchStart);
        landingDiv.addEventListener("touchend", onTouchEnd);
      }
      const animate = () => {
        requestAnimationFrame(animate);
        if (headBone) {
          handleHeadRotation(
            headBone,
            mouse.x,
            mouse.y,
            interpolation.x,
            interpolation.y,
            THREE.MathUtils.lerp
          );
          light.setPointLight(screenLight);
        }
        const delta = clock.getDelta();
        if (mixer) {
          mixer.update(delta);
        }

        // Best-effort lip sync: drive morph target influences from Gemini viseme timeline.
        const lipState = lipStateRef.current;
        if (lipState && lipState.morphMeshes.length) {
          const now = performance.now();
          const elapsed = now - lipState.startPerfMs;

          const total = Math.max(1, lipState.estimatedDurationMs);
          const tNorm = elapsed / total;

          let currentToken = "rest";
          if (lipState.active && tNorm >= 0 && tNorm <= 1) {
            // Advance lastVisemeIndex to the latest viseme <= tNorm.
            let idx = lipState.lastVisemeIndex;
            while (idx + 1 < lipState.visemes.length && lipState.visemes[idx + 1].t <= tNorm) {
              idx++;
            }
            lipState.lastVisemeIndex = idx;
            currentToken = lipState.visemes[idx]?.v ?? "rest";
          } else {
            currentToken = "rest";
          }

          const tokenNorm = currentToken.toUpperCase().trim();
          const tokenKey = tokenNorm.replace(/[^A-Z0-9]/g, "");

          for (const mm of lipState.morphMeshes) {
            const influences = mm.mesh.morphTargetInfluences;
            if (!influences) continue;

            // Resolve morph target index by fuzzy token match.
            let targetIndex: number | null = null;
            for (const [key, index] of Object.entries(mm.dict)) {
              const keyNorm = String(key).toUpperCase().replace(/[^A-Z0-9]/g, "");
              if (keyNorm === tokenKey) {
                targetIndex = index;
                break;
              }
              if (tokenKey && keyNorm.includes(tokenKey)) {
                targetIndex = index;
              }
            }

            for (let i = 0; i < influences.length; i++) {
              const target = targetIndex === i ? 1 : 0;
              influences[i] = influences[i] + (target - influences[i]) * 0.35;
            }
          }

          // When speech is done, slowly relax to rest.
          if (!lipState.active) {
            for (const mm of lipState.morphMeshes) {
              const influences = mm.mesh.morphTargetInfluences;
              if (!influences) continue;
              for (let i = 0; i < influences.length; i++) {
                influences[i] = influences[i] * 0.7;
              }
            }
          }
        }

        renderer.render(scene, camera);
      };
      animate();
      return () => {
        clearTimeout(debounce);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        scene.clear();
        renderer.dispose();
        window.removeEventListener("resize", () =>
          handleResize(renderer, camera, canvasDiv, character!)
        );
        if (canvasDiv.current) {
          canvasDiv.current.removeChild(renderer.domElement);
        }
        if (landingDiv) {
          document.removeEventListener("mousemove", onMouseMove);
          landingDiv.removeEventListener("touchstart", onTouchStart);
          landingDiv.removeEventListener("touchend", onTouchEnd);
        }
        window.removeEventListener("pointerdown", enableMicAfterFirstGesture);
        if (volumeRafRef.current) {
          window.cancelAnimationFrame(volumeRafRef.current);
          volumeRafRef.current = undefined;
        }
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach((t) => t.stop());
          micStreamRef.current = null;
        }
        if (audioContextRef.current) {
          try {
            audioContextRef.current.close?.();
          } catch {
            // ignore
          }
          audioContextRef.current = null;
        }
      };
    }
  }, []);

  return (
    <>
      <div className="character-container">
        <div className="character-model" ref={canvasDiv}>
          <div className="character-rim"></div>
          <div
            className="character-hover"
            ref={hoverDivRef}
            role="button"
            tabIndex={0}
            aria-label="Hear intro again"
            onClick={() => {
              // Retry mic if user previously blocked it.
              micBlockedRef.current = false;
              shouldListenRef.current = true;
              hasUserGestureRef.current = true;
              startListening();
              void speakIntro(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                micBlockedRef.current = false;
                shouldListenRef.current = true;
                hasUserGestureRef.current = true;
                startListening();
                void speakIntro(true);
              }
            }}
          ></div>
        </div>
      </div>
    </>
  );
};

export default Scene;
