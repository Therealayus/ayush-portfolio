import { useState, useCallback } from "react";
import "./styles/Work.css";
import WorkImage from "./WorkImage";
import { MdArrowBack, MdArrowForward } from "react-icons/md";

const projects = [
  {
    title: "NifiPayments Developer Documents",
    category: "Developer Documentation Portal",
    tools:
      "React.js, Tailwind CSS, API Integration, API Playground, Encrypted request/response flows",
    image: "/images/nifipayments-logo.svg",
  },
  {
    title: "NifiPayments Dashboard",
    category: "Merchant Dashboard",
    tools:
      "React.js, Tailwind CSS, REST APIs, Authentication, KYC/Compliance flows, State management & caching",
    image: "/images/nifipayments-logo.svg",
  },
  {
    title: "NifiPayments Payment Gateway",
    category: "Payment Gateway",
    tools:
      "React.js, REST APIs, Encrypted checkout payloads, Status callbacks, Redirect-based payment flows",
    image: "/images/nifipayments-logo.svg",
  },
  {
    title: "Metaware Solutions Dashboard",
    category: "Internal Analytics & Reporting",
    tools: "Next.js, Bootstrap, Material UI, Optimized rendering & API integration",
    image: "/images/sapphire.png",
  },
  {
    title: "PetZaade Style - Pet Grooming App",
    category: "Pet Grooming Platform",
    tools:
      "Node.js, Firebase FCM, REST APIs, Booking & scheduling modules, Notification flows",
    image: "/images/Solidx.png",
  },
  {
    title: "Match Flick – Dating App",
    category: "Real-time Dating Backend",
    tools:
      "Node.js, Sockets (real-time chat), Firebase FCM, Swipe/matching logic, Message delivery status",
    image: "/images/radix.png",
  },
];

const Work = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const goToSlide = useCallback(
    (index: number) => {
      if (isAnimating) return;
      setIsAnimating(true);
      setCurrentIndex(index);
      setTimeout(() => setIsAnimating(false), 500);
    },
    [isAnimating]
  );

  const goToPrev = useCallback(() => {
    const newIndex =
      currentIndex === 0 ? projects.length - 1 : currentIndex - 1;
    goToSlide(newIndex);
  }, [currentIndex, goToSlide]);

  const goToNext = useCallback(() => {
    const newIndex =
      currentIndex === projects.length - 1 ? 0 : currentIndex + 1;
    goToSlide(newIndex);
  }, [currentIndex, goToSlide]);

  return (
    <div className="work-section" id="work">
      <div className="work-container section-container">
        <h2>
          My <span>Work</span>
        </h2>

        <div className="carousel-wrapper">
          {/* Navigation Arrows */}
          <button
            className="carousel-arrow carousel-arrow-left"
            onClick={goToPrev}
            aria-label="Previous project"
            data-cursor="disable"
          >
            <MdArrowBack />
          </button>
          <button
            className="carousel-arrow carousel-arrow-right"
            onClick={goToNext}
            aria-label="Next project"
            data-cursor="disable"
          >
            <MdArrowForward />
          </button>

          {/* Slides */}
          <div className="carousel-track-container">
            <div
              className="carousel-track"
              style={{
                transform: `translateX(-${currentIndex * 100}%)`,
              }}
            >
              {projects.map((project, index) => (
                <div className="carousel-slide" key={index}>
                  <div className="carousel-content">
                    <div className="carousel-info">
                      <div className="carousel-number">
                        <h3>0{index + 1}</h3>
                      </div>
                      <div className="carousel-details">
                        <h4>{project.title}</h4>
                        <p className="carousel-category">
                          {project.category}
                        </p>
                        <div className="carousel-tools">
                          <span className="tools-label">Tools & Features</span>
                          <p>{project.tools}</p>
                        </div>
                      </div>
                    </div>
                    <div className="carousel-image-wrapper">
                      <WorkImage image={project.image} alt={project.title} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dot Indicators */}
          <div className="carousel-dots">
            {projects.map((_, index) => (
              <button
                key={index}
                className={`carousel-dot ${index === currentIndex ? "carousel-dot-active" : ""
                  }`}
                onClick={() => goToSlide(index)}
                aria-label={`Go to project ${index + 1}`}
                data-cursor="disable"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Work;
