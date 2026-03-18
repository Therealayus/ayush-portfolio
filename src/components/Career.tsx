import "./styles/Career.css";

const Career = () => {
  const careerItems = [
    {
      role: "B.Sc",
      org: "Kurukshetra University",
      period: "2016 - 2019",
      description:
        "Built a strong foundation in computer programming, data structures & algorithms, operating systems, computer networks, databases, and software engineering. Worked on academic full-stack projects to strengthen analytical and coding skills.",
    },
    {
      role: "Frontend Developer",
      org: "BR Softech Pvt. Ltd.",
      period: "04/2021 - 02/2023",
      description:
        "Contributed to large-scale, data-driven web applications focused on modern UI engineering. Designed and developed frontend features for the NIT Kurukshetra University website with responsive, interactive components. Built reusable UI architectures and integrated modules via Apollo GraphQL for optimized data fetching and caching.",
    },
    {
      role: "Frontend Developer",
      org: "Metaware Solutions",
      period: "10/2023 - 07/2024",
      description:
        "Built and enhanced data-driven web applications in a professional training environment. Developed responsive, scalable UIs using React.js, Next.js, Material UI, and Bootstrap. Integrated frontend modules with backend services via Apollo GraphQL and collaborated with backend teams using FastAPI.",
    },
    {
      role: "Full Stack Developer",
      org: "Neo Infra Fintech Inclusion Pvt. Ltd.",
      period: "10/2024 - 12/2025",
      description:
        "Developing scalable fintech applications using React.js, TypeScript, Node.js, and Express while ensuring high performance and maintainability across the stack. Built and integrated secure RESTful APIs including authentication, validation, and microservices communication. Managing complex state with Redux, Context API, and React Query; optimizing data fetching and overall responsiveness. Designing database schemas and optimizing SQL queries for reliable data management.",
    },
    {
      role: "Full Stack Developer",
      org: "Clavis Technologies",
      period: "01/2026 - Present",
      description:
        "Working as a Full-Stack Developer at Clavis Technologies (clavistechnologies.com).",
    },
  ];

  return (
    <div className="career-section section-container">
      <div className="career-container">
        <h2>
          My career <span>&</span>
          <br /> experience
        </h2>
        <div className="career-info">
          <div className="career-timeline">
            <div className="career-dot"></div>
          </div>
          {careerItems.map((item, idx) => (
            <div className="career-info-box" key={idx}>
              <div className="career-info-in">
                <div className="career-role">
                  <h4>{item.role}</h4>
                  <h5>{item.org}</h5>
                </div>
                <h3>{item.period}</h3>
              </div>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Career;
