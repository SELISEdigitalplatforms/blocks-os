import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { showErrorToast } from "@/hooks/use-toast";
import { ModeToggle } from "@/components/mode-toggle/mode-toggle";
import { useAuthStore } from "@/store/useAuthStore"
import "./login-eurolm.css"

interface StackLink {
  label: string;
  to: string;
}
interface Stack {
  name: string;
  available: boolean;
  links: StackLink[];
}
interface Service {
  badge: string;
  title: string;
  description: string;
  features: string[];
  url: string;
  cta: string;
  stacks?: Stack[];
}

const services: Service[] = [
  {
    badge: "AI & Knowledge",
    title: "Blocks Agent Platform",
    description:
      "Integrate intelligent agents into any frontend with a single script. Advanced use cases with RAG pipelines, MCP, and custom LLM integrations.",
    features: ["RAG Pipelines", "MCP Support", "Custom LLM", "Knowledge Bases"],
    url: getRuntimeEnv("BLOCKS_AGENTS_BASE_URL"),
    cta: "Visit Agent Platform",
  },
  {
    badge: "Deployments",
    title: "Blocks Cloud Build",
    description:
      "Build, deploy, and scale your applications with automated CI/CD pipelines. Connect GitHub repositories and go live in minutes.",
    features: ["Auto CI/CD", "GitHub Integration", "Multi-env", "Build Logs"],
    url: getRuntimeEnv("BLOCKS_RELEASE_BASE_URL"),
    cta: "Visit Cloud Build",
  },
  {
    badge: "Databases",
    title: "Blocks Data Service",
    description:
      "Provision and manage databases with automatic scaling, backups, and real-time monitoring. Full control without the operational overhead.",
    features: ["Auto Backups", "Auto Scaling", "Query Console", "Monitoring"],
    url: getRuntimeEnv("BLOCKS_DATA_BASE_URL"),
    cta: "Visit Data Service",
  },
  {
    badge: "SDK & CLI",
    title: "Blocks Construct",
    description:
      "Open-source SDKs and CLI tools for React, .NET and more. Scaffold and integrate Blocks services into your projects in minutes.",
    features: ["React SDK", ".NET SDK", "CLI Tooling", "Starter Templates"],
    url: "https://construct.seliseblocks.com",
    cta: "Visit Construct",
    stacks: [
      {
        name: "React",
        available: true,
        links: [
          { label: "npm", to: "https://www.npmjs.com/package/@seliseblocks/cli" },
          { label: "GitHub", to: "https://github.com/SELISEdigitalplatforms/l3-react-blocks-construct" },
        ],
      },
      {
        name: ".NET",
        available: true,
        links: [
          { label: "NuGet", to: "https://www.nuget.org/profiles/SELISE" },
          { label: "GitHub", to: "https://github.com/SELISEdigitalplatforms/l0-net-blocks-construct" },
        ],
      },
      { name: "Angular", available: false, links: [] },
      { name: "Ruby", available: false, links: [] },
    ],
  },
];

export default function LoginSimplePage() {
  const [isStarting, setIsStarting] = useState(false);
  const [keywordIdx, setKeywordIdx] = useState(0);
  const [keywordVisible, setKeywordVisible] = useState(true);
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const keywords = useMemo(
    () => ["observable", "intelligent", "scalable", "resilient", "secure"],
    [],
  );

  useEffect(() => {
    if (isAuthenticated) navigate("/console", { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const id = setInterval(() => {
      setKeywordVisible(false);
      setTimeout(() => {
        setKeywordIdx((p) => (p + 1) % keywords.length);
        setKeywordVisible(true);
      }, 280);
    }, 2800);
    return () => clearInterval(id);
  }, [keywords.length]);

  // Atmospheric canvas — animated HSL color blobs
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let t = 0;
    let dpr = window.devicePixelRatio || 1;
    let w = 0;
    let h = 0;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      w = canvas.width = Math.floor(window.innerWidth * dpr);
      h = canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const hslToRgb = (hue: number, s: number, l: number) => {
      s /= 100;
      l /= 100;
      const k = (n: number) => (n + hue / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = (n: number) =>
        l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return [
        Math.round(f(0) * 255),
        Math.round(f(8) * 255),
        Math.round(f(4) * 255),
      ];
    };

    const draw = () => {
      const time = t * 0.008;
      const baseHue = 185 + 15 * Math.sin(time);
      const c1 = hslToRgb(baseHue, 100, 50);
      const c2 = hslToRgb(baseHue + 15, 100, 50);
      const c3 = hslToRgb(baseHue - 15, 100, 50);
      const cx = (w / dpr) * 0.5;
      const cy = (h / dpr) * 0.5;
      ctx.clearRect(0, 0, w / dpr, h / dpr);

      const r1 = (Math.max(w, h) / dpr) * 0.6;
      const g1 = ctx.createRadialGradient(cx * 0.6, cy * 0.7, 0, cx * 0.6, cy * 0.7, r1);
      g1.addColorStop(0, `rgba(${c1[0]}, ${c1[1]}, ${c1[2]}, 0.18)`);
      g1.addColorStop(1, `rgba(${c1[0]}, ${c1[1]}, ${c1[2]}, 0)`);
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w / dpr, h / dpr);

      const r2 = (Math.max(w, h) / dpr) * 0.5;
      const g2 = ctx.createRadialGradient(cx * 1.3, cy * 0.4, 0, cx * 1.3, cy * 0.4, r2);
      g2.addColorStop(0, `rgba(${c2[0]}, ${c2[1]}, ${c2[2]}, 0.12)`);
      g2.addColorStop(1, `rgba(${c2[0]}, ${c2[1]}, ${c2[2]}, 0)`);
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w / dpr, h / dpr);

      const r3 = (Math.max(w, h) / dpr) * 0.45;
      const g3 = ctx.createRadialGradient(cx * 0.3, cy * 1.2, 0, cx * 0.3, cy * 1.2, r3);
      g3.addColorStop(0, `rgba(${c3[0]}, ${c3[1]}, ${c3[2]}, 0.10)`);
      g3.addColorStop(1, `rgba(${c3[0]}, ${c3[1]}, ${c3[2]}, 0)`);
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, w / dpr, h / dpr);

      t++;
      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const startLogin = async () => {
    try {
      if (isStarting) return;
      setIsStarting(true);

      const blocksKey = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY");
      const clientId = getRuntimeEnv("BLOCKS_OIDC_CLIENT_ID");
      const redirectUri = `${window.location.origin}/login/callback`;
      const idpBaseUrl = getRuntimeEnv("BLOCKS_IAM_BASE_URL")
      const initiateUrl = `${idpBaseUrl}/api/idp/initiate?x-blocks-key=${blocksKey}&clientId=${clientId}&redirectUri=${redirectUri}`

      const headers: Record<string, string> = {}
      if (blocksKey) headers["X-Blocks-Key"] = blocksKey

      const response = await fetch(initiateUrl.toString(), { headers })
      const data = await response.json()
      if (data.redirect_uri) {
        window.location.href = data.redirect_uri;
      } else {
        showErrorToast({ errors: "Failed to get authorization URL" });
        setIsStarting(false);
      }
    } catch (errors) {
      console.error("Login initiation error:", errors);
      showErrorToast({ errors: "Unable to start login. Please try again." });
      setIsStarting(false);
    }
  };

  // Duplicated for seamless loop
  const carouselCards = [...services, ...services];

  return (
    <div className="eurolm-page">

      <div className="grid-bg" />
      <div className="scan-line" />
      <div className="radial-glow" />
      <div className="secondary-glow" />
      <div className="vignette" />
      <div className="noise-overlay" />
      <canvas className="atmospheric-canvas" ref={canvasRef} />

      <div className="corner corner-tl" />
      <div className="corner corner-tr" />
      <div className="corner corner-bl" />
      <div className="corner corner-br" />
      <div className="corner-dot corner-dot-tl" />
      <div className="corner-dot corner-dot-tr" />
      <div className="corner-dot corner-dot-bl" />
      <div className="corner-dot corner-dot-br" />

      <div className="particle" style={{ left: "6%", animationDuration: "16s", animationDelay: "0s", width: 2, height: 2 }} />
      <div className="particle" style={{ left: "18%", animationDuration: "20s", animationDelay: "3s", width: 1.5, height: 1.5 }} />
      <div className="particle large" style={{ left: "35%", animationDuration: "14s", animationDelay: "1.5s", width: 3, height: 3 }} />
      <div className="particle" style={{ left: "52%", animationDuration: "18s", animationDelay: "5s", width: 2, height: 2 }} />
      <div className="particle" style={{ left: "68%", animationDuration: "22s", animationDelay: "2s", width: 1, height: 1 }} />
      <div className="particle large" style={{ left: "82%", animationDuration: "15s", animationDelay: "4s", width: 2.5, height: 2.5 }} />
      <div className="particle" style={{ left: "92%", animationDuration: "19s", animationDelay: "6s", width: 1.5, height: 1.5 }} />

      <nav className="site-nav">
        <div className="nav-left">
          <svg className="nav-logo-mark" viewBox="0 0 246 360" xmlns="http://www.w3.org/2000/svg">
            <path d="M245.455 68.162V129.87L168.982 156.65V93.9637L245.455 68.162Z" />
            <path d="M240.389 62.3805L165.49 87.6573L5.30945 24.2563L85.3315 0L240.389 62.3805Z" />
            <path d="M161.797 93.8295V156.43L81.1141 122.607V188.07L0 152.738V29.6846L161.797 93.8295Z" />
            <path d="M76.4728 266.036L0 291.837V230.123L76.4728 203.329V266.036Z" />
            <path d="M160.122 360L5.07166 297.619L79.9639 272.343L240.144 335.743L160.122 360Z" />
            <path d="M245.454 330.315L83.6569 266.175V203.57L164.34 237.395V171.93L245.454 207.262V330.315Z" />
          </svg>
          <div className="nav-divider" />
          <span className="nav-product">Blocks OS</span>
        </div>
        <div className="nav-right">
          <nav className="nav-links">
            <a href="https://docs.seliseblocks.com/" target="_blank" rel="noreferrer" className="nav-link">Docs</a>
            <a href="https://seliseblocks.com" target="_blank" rel="noreferrer" className="nav-link">Blocks</a>
            <a href="https://github.com/SELISEdigitalplatforms" target="_blank" rel="noreferrer" className="nav-link">GitHub</a>
          </nav>
          <ModeToggle />
        </div>
      </nav>

      <main className="main">
        <div className="col-left">
          <p className="eyebrow">Blocks · Core Services</p>
          <h1 className="title-main">
            blocks<br />OS Platform
          </h1>
          <p className="title-sub">Enterprise platform for secure, scalable applications</p>
          <p className="keywords">
            Backends that are{" "}
            <span
              className="keyword-anim"
              style={{ opacity: keywordVisible ? 1 : 0 }}
            >
              {keywords[keywordIdx]}
            </span>
            .
          </p>
          <p className="desc">
            Blocks OS is a modern platform for building and deploying secure,
            scalable applications with built-in observability, AI capabilities,
            and comprehensive identity management. Focus on your application
            logic while Blocks OS handles <span className="highlight">infrastructure, auth, and ops</span>.
          </p>

          <div className="features">
            <span className="feature-pill">Authentication</span>
            <span className="feature-pill">Secrets Management</span>
            <span className="feature-pill">Configuration</span>
            <span className="feature-pill">API Console</span>
            <span className="feature-pill">Usage</span>
            <span className="feature-pill">Logs &amp; Tracing</span>
          </div>

          <div className="cta-row">
            <div className="button-container">
              <div className="button-ring" />
              <div className="button-ring" />
              <button
                className="launch-btn"
                disabled={isStarting}
                onClick={startLogin}
              >
                {isStarting ? "Redirecting…" : "Log in to your account"}
              </button>
            </div>
            <Link
              to="https://docs.seliseblocks.com/"
              target="_blank"
              className="cta-docs"
            >
              View documentation
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        <div className="col-right">
          <div className="sdk-header-row">
            <p className="sdk-header-label">Core Services — Blocks Platform</p>
            <span className="sdk-count-badge">{services.length} services</span>
          </div>

          <div className="carousel-track">
            <div className="carousel-inner">
              {carouselCards.map((s, i) => (
                <div className="sdk-card" key={`${s.title}-${i}`}>
                  <div className="sdk-card-top">
                    <span className="sdk-name">{s.title.replace(/^Blocks\s+/, "")}</span>
                    <span className={`sdk-badge${s.stacks ? "" : " soon"}`}>
                      {s.badge}
                    </span>
                  </div>
                  <p className="sdk-desc">{s.description}</p>

                  {s.stacks ? (
                    <div className="sdk-links">
                      {s.stacks
                        .filter((st) => st.available)
                        .map((st) => (
                          <a
                            key={st.name}
                            href={st.links[0]?.to ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="sdk-link"
                          >
                            {st.name}
                          </a>
                        ))}
                      {s.stacks
                        .filter((st) => !st.available)
                        .map((st) => (
                          <span key={st.name} className="sdk-link dim">
                            {st.name}
                          </span>
                        ))}
                    </div>
                  ) : (
                    <div className="sdk-links">
                      {s.features.map((f) => (
                        <span key={f} className="sdk-link dim">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="sdk-card-footer">
                    <a
                      href={s.url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="sdk-cta"
                    >
                      {s.cta}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sdk-footer">
            <a href="https://seliseblocks.com" target="_blank" rel="noreferrer" className="visit-construct">
              Visit Blocks
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
            <span className="sdk-open-source">Open source</span>
          </div>
        </div>
      </main>

      <div className="status">
        <span className="status-dot" />
        <span>All systems operational</span>
      </div>
    </div>
  );
}
