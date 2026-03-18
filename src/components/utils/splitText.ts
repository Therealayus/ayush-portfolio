import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface ParaElement extends HTMLElement {
  anim?: gsap.core.Animation;
  split?: any;
}

gsap.registerPlugin(ScrollTrigger);

let hasRefreshListener = false;

export default function setSplitText() {
  ScrollTrigger.config({ ignoreMobileResize: true });
  if (window.innerWidth < 900) return;

  const paras: NodeListOf<ParaElement> = document.querySelectorAll(".para");
  const titles: NodeListOf<ParaElement> = document.querySelectorAll(".title");

  const TriggerStart = window.innerWidth <= 1024 ? "top 60%" : "20% 60%";
  const ToggleAction = "play pause resume reverse";

  // Avoid loading gsap-trial bonus plugins on unauthorized/production domains.
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (!isLocalhost) {
    // Safe fallback: animate the full elements (no SplitText, no ScrollSmoother).
    paras.forEach((para: ParaElement) => {
      if (para.dataset.splitFallbackApplied === "1") return;
      para.dataset.splitFallbackApplied = "1";
      para.classList.add("visible");
      gsap.fromTo(
        para,
        { autoAlpha: 0, y: 80 },
        {
          autoAlpha: 1,
          y: 0,
          scrollTrigger: {
            trigger: para.parentElement?.parentElement ?? para,
            toggleActions: ToggleAction,
            start: TriggerStart,
          },
          duration: 1,
          ease: "power3.out",
        }
      );
    });

    titles.forEach((title: ParaElement) => {
      if (title.dataset.splitFallbackApplied === "1") return;
      title.dataset.splitFallbackApplied = "1";
      title.classList.add("visible");
      gsap.fromTo(
        title,
        { autoAlpha: 0, y: 80, rotate: 10 },
        {
          autoAlpha: 1,
          y: 0,
          rotate: 0,
          scrollTrigger: {
            trigger: title.parentElement?.parentElement ?? title,
            toggleActions: ToggleAction,
            start: TriggerStart,
          },
          duration: 0.8,
          ease: "power2.inOut",
        }
      );
    });

    return;
  }

  // Localhost: keep the original SplitText-based animations.
  void import("gsap-trial/SplitText").then(({ SplitText }: any) => {
    paras.forEach((para: ParaElement) => {
      para.classList.add("visible");
      if (para.anim) {
        para.anim.progress(1).kill();
        para.split?.revert();
      }

      const split = new SplitText(para, {
        type: "lines,words",
        linesClass: "split-line",
      });
      para.split = split;

      para.anim = gsap.fromTo(split.words, { autoAlpha: 0, y: 80 }, {
        autoAlpha: 1,
        scrollTrigger: {
          trigger: para.parentElement?.parentElement,
          toggleActions: ToggleAction,
          start: TriggerStart,
        },
        duration: 1,
        ease: "power3.out",
        y: 0,
        stagger: 0.02,
      });
    });

    titles.forEach((title: ParaElement) => {
      if (title.anim) {
        title.anim.progress(1).kill();
        title.split?.revert();
      }

      const split = new SplitText(title, {
        type: "chars,lines",
        linesClass: "split-line",
      });
      title.split = split;
      title.anim = gsap.fromTo(split.chars, { autoAlpha: 0, y: 80, rotate: 10 }, {
        autoAlpha: 1,
        scrollTrigger: {
          trigger: title.parentElement?.parentElement,
          toggleActions: ToggleAction,
          start: TriggerStart,
        },
        duration: 0.8,
        ease: "power2.inOut",
        y: 0,
        rotate: 0,
        stagger: 0.03,
      });
    });

    if (!hasRefreshListener) {
      hasRefreshListener = true;
      ScrollTrigger.addEventListener("refresh", () => setSplitText());
    }
  });
}
