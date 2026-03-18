import { useEffect } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import HoverLinks from "./HoverLinks";
import { gsap } from "gsap";
import "./styles/Navbar.css";

gsap.registerPlugin(ScrollTrigger);
export let smoother: any = null;

const Navbar = () => {
  useEffect(() => {
    // Avoid loading gsap-trial bonus plugins on unauthorized/production domains.
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isLocalhost) {
      void import("gsap-trial/ScrollSmoother").then(({ ScrollSmoother }) => {
        gsap.registerPlugin(ScrollSmoother, ScrollTrigger);
        smoother = ScrollSmoother.create({
          wrapper: "#smooth-wrapper",
          content: "#smooth-content",
          smooth: 1.7,
          speed: 1.7,
          effects: true,
          autoResize: true,
          ignoreMobileResize: true,
        });

        smoother.scrollTop(0);
        smoother.paused(true);

        let links = document.querySelectorAll(".header ul a");
        links.forEach((elem) => {
          let element = elem as HTMLAnchorElement;
          element.addEventListener("click", (e) => {
            if (window.innerWidth > 1024 && smoother) {
              e.preventDefault();
              let elem = e.currentTarget as HTMLAnchorElement;
              let section = elem.getAttribute("data-href");
              smoother.scrollTo(section, true, "top top");
            }
          });
        });

        window.addEventListener("resize", () => {
          if (ScrollSmoother?.refresh) ScrollSmoother.refresh(true);
        });
      });
    } else {
      // Production fallback: keep normal scrolling (no smooth wrapper).
      smoother = null;
    }
  }, []);
  return (
    <>
      <div className="header">
        <a href="/#" className="navbar-title" data-cursor="disable">
          AG
        </a>
        <a
          href="mailto:ayushgupta2429@gmail.com"
          className="navbar-connect"
          data-cursor="disable"
        >
          ayushgupta2429@gmail.com
        </a>
        <ul>
          <li>
            <a data-href="#about" href="#about">
              <HoverLinks text="ABOUT" />
            </a>
          </li>
          <li>
            <a data-href="#work" href="#work">
              <HoverLinks text="WORK" />
            </a>
          </li>
          <li>
            <a data-href="#contact" href="#contact">
              <HoverLinks text="CONTACT" />
            </a>
          </li>
        </ul>
      </div>

      <div className="landing-circle1"></div>
      <div className="landing-circle2"></div>
      <div className="nav-fade"></div>
    </>
  );
};

export default Navbar;
