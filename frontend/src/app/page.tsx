"use client";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import JsonLd from "@/components/JsonLd";

// ─── Stellar Config ────────────────────────────────────────────────────────
const COLORS = {
  void: "#04080F",
  deep: "#08112A",
  nebula: "#0D1B3E",
  gold: "#C9A84C",
  goldLight: "#E5C678",
  goldMuted: "rgba(201,168,76,0.15)",
  starWhite: "#F0EDE4",
  dim: "#A8A49C",
  faint: "#5C5A54",
  accent: "#3B7BF7",
};

// ─── Star Field Canvas ─────────────────────────────────────────────────────
function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight * 3);

    // Generate stars
    const stars = [];
    for (let i = 0; i < 300; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.5 + 0.3,
        speed: Math.random() * 0.3 + 0.05,
        phase: Math.random() * Math.PI * 2,
        brightness: Math.random() * 0.5 + 0.5,
      });
    }
    starsRef.current = stars;

    // Shooting stars
    const shootingStars = [];
    const spawnShootingStar = () => {
      shootingStars.push({
        x: Math.random() * w * 0.7,
        y: Math.random() * h * 0.3,
        len: Math.random() * 80 + 40,
        speed: Math.random() * 8 + 6,
        angle: (Math.PI / 6) + Math.random() * 0.3,
        life: 1,
        decay: Math.random() * 0.015 + 0.008,
      });
    };

    let shootInterval = setInterval(() => {
      if (Math.random() > 0.4) spawnShootingStar();
    }, 3000);

    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      const t = Date.now() * 0.001;

      // Draw stars
      stars.forEach((s) => {
        const twinkle = Math.sin(t * s.speed * 3 + s.phase) * 0.3 + 0.7;
        const alpha = s.brightness * twinkle;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240,237,228,${alpha})`;
        ctx.fill();
        if (s.r > 1.2) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(201,168,76,${alpha * 0.08})`;
          ctx.fill();
        }
      });

      // Draw shooting stars
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;
        ss.life -= ss.decay;
        if (ss.life <= 0) { shootingStars.splice(i, 1); continue; }
        const grad = ctx.createLinearGradient(
          ss.x, ss.y,
          ss.x - Math.cos(ss.angle) * ss.len,
          ss.y - Math.sin(ss.angle) * ss.len
        );
        grad.addColorStop(0, `rgba(201,168,76,${ss.life})`);
        grad.addColorStop(1, `rgba(201,168,76,0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(
          ss.x - Math.cos(ss.angle) * ss.len,
          ss.y - Math.sin(ss.angle) * ss.len
        );
        ctx.stroke();
      }

      frameRef.current = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight * 3;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      clearInterval(shootInterval);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0, left: 0,
        width: "100%",
        height: "300vh",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

// ─── Intersection Observer Hook ────────────────────────────────────────────
function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

// ─── Animated Counter ──────────────────────────────────────────────────────
function Counter({ end, suffix = "", duration = 2000 }) {
  const [val, setVal] = useState(0);
  const [ref, visible] = useReveal();
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setVal(end); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [visible, end, duration]);
  return <span ref={ref}>{val}{suffix}</span>;
}

// ─── Floating Orb ──────────────────────────────────────────────────────────
function Orb({ size, top, left, delay = 0, color = COLORS.gold }) {
  return (
    <div style={{
      position: "absolute", top, left, width: size, height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
      animation: `orbFloat 8s ease-in-out ${delay}s infinite alternate`,
      pointerEvents: "none",
    }} />
  );
}

// ─── Hex Logo ──────────────────────────────────────────────────────────────
function HexLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <polygon points="14,2 25,8 25,20 14,26 3,20 3,8" fill={COLORS.gold} opacity="0.9" />
      <polygon points="14,6 22,10.5 22,19.5 14,24 6,19.5 6,10.5" fill={COLORS.deep} />
      <polygon points="14,10 18,12.5 18,17.5 14,20 10,17.5 10,12.5" fill={COLORS.gold} opacity="0.6" />
    </svg>
  );
}

// ─── Product Showcase (Animated Mock UI) ───────────────────────────────────
function ProductShowcase() {
  const [ref, visible] = useReveal(0.1);
  const [activeTab, setActiveTab] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [answerText, setAnswerText] = useState("");

  const query = "What's our remote work policy?";
  const answer = "Based on your company handbook (updated Jan 2026), employees may work remotely up to 3 days per week. Manager approval is required for full-remote arrangements exceeding 2 consecutive weeks. All remote workers must be available during core hours (10am–3pm local time).";

  useEffect(() => {
    if (!visible) return;
    let i = 0;
    setTypedText("");
    setShowAnswer(false);
    setAnswerText("");
    const typeQuery = setInterval(() => {
      i++;
      setTypedText(query.slice(0, i));
      if (i >= query.length) {
        clearInterval(typeQuery);
        setTimeout(() => {
          setShowAnswer(true);
          let j = 0;
          const typeAnswer = setInterval(() => {
            j++;
            setAnswerText(answer.slice(0, j));
            if (j >= answer.length) clearInterval(typeAnswer);
          }, 12);
        }, 600);
      }
    }, 50);
    return () => clearInterval(typeQuery);
  }, [visible]);

  return (
    <div ref={ref} style={{
      perspective: "1200px",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(60px)",
      transition: "all 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
    }}>
      <div style={{
        background: `linear-gradient(145deg, ${COLORS.deep}, ${COLORS.nebula})`,
        border: `1px solid rgba(201,168,76,0.15)`,
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: `0 40px 100px rgba(0,0,0,0.5), 0 0 80px rgba(201,168,76,0.06), inset 0 1px 0 rgba(255,255,255,0.05)`,
        transform: visible ? "rotateX(2deg)" : "rotateX(8deg)",
        transition: "transform 1.5s cubic-bezier(0.16, 1, 0.3, 1)",
        maxWidth: "900px",
        margin: "0 auto",
      }}>
        {/* Title bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "14px 20px",
          background: "rgba(0,0,0,0.3)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ display: "flex", gap: "6px" }}>
            {["#ff5f57","#febc2e","#28c840"].map(c => (
              <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.8 }} />
            ))}
          </div>
          <div style={{
            flex: 1, textAlign: "center", fontSize: "12px", color: COLORS.faint,
            fontFamily: "'SF Mono', 'Fira Code', monospace",
          }}>
            cobbyiq.com/workspace/knowledge
          </div>
        </div>

        {/* App layout */}
        <div style={{ display: "flex", minHeight: "380px" }}>
          {/* Sidebar */}
          <div style={{
            width: "200px", padding: "16px",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(0,0,0,0.15)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px" }}>
              <HexLogo size={20} />
              <span style={{ fontWeight: 700, fontSize: "14px", color: COLORS.starWhite }}>
                Cobby<span style={{ color: COLORS.gold }}>IQ</span>
              </span>
            </div>
            {["Ask CobbyIQ", "Documents", "Analytics", "Team", "Settings"].map((item, i) => (
              <div
                key={item}
                onClick={() => setActiveTab(i)}
                style={{
                  padding: "8px 12px", borderRadius: "8px", fontSize: "13px",
                  cursor: "pointer", marginBottom: "4px",
                  color: i === activeTab ? COLORS.gold : COLORS.dim,
                  background: i === activeTab ? COLORS.goldMuted : "transparent",
                  transition: "all 0.2s",
                  fontWeight: i === activeTab ? 600 : 400,
                  display: "flex", alignItems: "center", gap: "8px",
                }}
              >
                <span style={{ fontSize: "14px" }}>
                  {["✦", "◆", "◎", "◇", "○"][i]}
                </span>
                {item}
              </div>
            ))}
          </div>

          {/* Main content */}
          <div style={{ flex: 1, padding: "24px", display: "flex", flexDirection: "column" }}>
            <h3 style={{
              fontSize: "18px", fontWeight: 600, color: COLORS.starWhite,
              margin: "0 0 20px", fontFamily: "'Instrument Serif', Georgia, serif",
            }}>
              ✦ Ask CobbyIQ
            </h3>

            {/* Chat area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* User query */}
              <div style={{
                alignSelf: "flex-end", maxWidth: "70%",
                background: COLORS.goldMuted,
                border: `1px solid rgba(201,168,76,0.2)`,
                borderRadius: "14px 14px 4px 14px",
                padding: "12px 16px",
                fontSize: "13px", color: COLORS.starWhite,
                lineHeight: 1.5,
              }}>
                {typedText}
                <span style={{
                  display: "inline-block", width: "2px", height: "14px",
                  background: COLORS.gold, marginLeft: "2px",
                  animation: "blink 0.8s infinite",
                  verticalAlign: "text-bottom",
                  opacity: typedText.length < query.length ? 1 : 0,
                }} />
              </div>

              {/* AI answer */}
              {showAnswer && (
                <div style={{
                  alignSelf: "flex-start", maxWidth: "80%",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "14px 14px 14px 4px",
                  padding: "14px 18px",
                  fontSize: "13px", color: COLORS.dim,
                  lineHeight: 1.7,
                  animation: "slideUp 0.4s ease-out",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                    <HexLogo size={16} />
                    <span style={{ fontSize: "11px", color: COLORS.gold, fontWeight: 600 }}>CobbyIQ</span>
                    <span style={{
                      fontSize: "10px", color: COLORS.faint,
                      background: "rgba(201,168,76,0.1)",
                      padding: "2px 8px", borderRadius: "100px",
                    }}>
                      sourced from 3 documents
                    </span>
                  </div>
                  {answerText}
                </div>
              )}
            </div>

            {/* Input bar */}
            <div style={{
              marginTop: "16px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px",
              padding: "12px 16px",
              display: "flex", alignItems: "center", gap: "12px",
              fontSize: "13px", color: COLORS.faint,
            }}>
              <span>Ask anything about your company...</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "8px",
                  background: COLORS.gold, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "14px", color: COLORS.deep,
                }}>↑</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Feature Card ──────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, delay, index }) {
  const [ref, visible] = useReveal(0.1);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? `linear-gradient(145deg, rgba(201,168,76,0.08), rgba(201,168,76,0.02))`
          : "rgba(255,255,255,0.025)",
        border: `1px solid ${hovered ? "rgba(201,168,76,0.25)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: "16px",
        padding: "32px 28px",
        position: "relative",
        overflow: "hidden",
        cursor: "default",
        opacity: visible ? 1 : 0,
        transform: visible
          ? `translateY(0) scale(1)`
          : `translateY(40px) scale(0.95)`,
        transition: `all 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, border-color 0.3s, background 0.3s`,
      }}
    >
      {/* Glow on hover */}
      <div style={{
        position: "absolute", top: "-50%", right: "-50%",
        width: "200px", height: "200px",
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(201,168,76,${hovered ? 0.1 : 0}) 0%, transparent 70%)`,
        transition: "all 0.5s",
        pointerEvents: "none",
      }} />

      <div style={{
        width: "48px", height: "48px", borderRadius: "12px",
        background: hovered ? COLORS.goldMuted : "rgba(255,255,255,0.04)",
        border: `1px solid ${hovered ? "rgba(201,168,76,0.3)" : "rgba(255,255,255,0.08)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "22px", marginBottom: "20px",
        transition: "all 0.4s",
        transform: hovered ? "scale(1.1) rotate(-5deg)" : "scale(1) rotate(0)",
      }}>
        {icon}
      </div>

      <h3 style={{
        fontSize: "17px", fontWeight: 700, color: COLORS.starWhite,
        margin: "0 0 10px", letterSpacing: "-0.01em",
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: "14px", color: COLORS.dim, lineHeight: 1.7, margin: 0,
      }}>
        {desc}
      </p>

      {/* Bottom accent line */}
      <div style={{
        position: "absolute", bottom: 0, left: "28px", right: "28px",
        height: "2px",
        background: `linear-gradient(90deg, transparent, ${COLORS.gold}, transparent)`,
        opacity: hovered ? 0.5 : 0,
        transition: "opacity 0.4s",
      }} />
    </div>
  );
}

// ─── Step Card (How it works) ──────────────────────────────────────────────
function StepCard({ step, title, desc, delay }) {
  const [ref, visible] = useReveal(0.15);

  return (
    <div ref={ref} style={{
      textAlign: "center",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0) scale(1)" : "translateY(50px) scale(0.9)",
      transition: `all 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
    }}>
      <div style={{
        width: "72px", height: "72px", borderRadius: "50%",
        background: `linear-gradient(135deg, ${COLORS.gold}22, ${COLORS.gold}08)`,
        border: `2px solid ${COLORS.gold}33`,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 20px",
        fontFamily: "'Instrument Serif', Georgia, serif",
        fontSize: "28px", color: COLORS.gold, fontWeight: 400,
      }}>
        {step}
      </div>
      <h3 style={{
        fontSize: "18px", fontWeight: 700, color: COLORS.starWhite,
        margin: "0 0 8px",
      }}>{title}</h3>
      <p style={{
        fontSize: "14px", color: COLORS.dim, lineHeight: 1.7,
        maxWidth: "280px", margin: "0 auto",
      }}>{desc}</p>
    </div>
  );
}

// ─── Constellation Connector Lines ─────────────────────────────────────────
function ConstellationLine() {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "0 20px",
    }}>
      <svg width="80" height="4" viewBox="0 0 80 4" style={{
        opacity: visible ? 0.3 : 0,
        transition: "opacity 1s ease 0.3s",
      }}>
        <line x1="0" y1="2" x2="80" y2="2" stroke={COLORS.gold} strokeWidth="1" strokeDasharray="4 4">
          <animate attributeName="stroke-dashoffset" from="8" to="0" dur="2s" repeatCount="indefinite" />
        </line>
        <circle cx="0" cy="2" r="2" fill={COLORS.gold} opacity="0.6" />
        <circle cx="80" cy="2" r="2" fill={COLORS.gold} opacity="0.6" />
      </svg>
    </div>
  );
}

// ─── Stat Block ────────────────────────────────────────────────────────────
function StatBlock({ value, label, suffix = "" }) {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} style={{
      textAlign: "center",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(20px)",
      transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
    }}>
      <div style={{
        fontFamily: "'Instrument Serif', Georgia, serif",
        fontSize: "clamp(2.5rem, 5vw, 3.5rem)",
        color: COLORS.gold, fontWeight: 400,
        lineHeight: 1,
      }}>
        <Counter end={value} suffix={suffix} />
      </div>
      <div style={{
        fontSize: "13px", color: COLORS.dim, marginTop: "8px",
        lineHeight: 1.5,
      }}>{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── MAIN APP ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
export default function CobbyIQStellar() {
  const [scrollY, setScrollY] = useState(0);
  const [navSolid, setNavSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrollY(window.scrollY);
      setNavSolid(window.scrollY > 60);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const features = [
    { icon: "✦", title: "Answers from your docs, not the internet", desc: "Every response is grounded in your actual documents. No hallucinations, no guessing — just accurate knowledge from your own files, with page references." },
    { icon: "◈", title: "Find anything in seconds", desc: "Stop digging through Google Drive folders. Ask a question in plain English, get the answer instantly — no matter which document it's buried in." },
    { icon: "◎", title: "See what's missing from your docs", desc: "CobbyIQ tracks what your team asks but can't find — showing you exactly where to improve your knowledge base." },
    { icon: "◆", title: "Know when docs need updating", desc: "Policies from 2022 still circulating? Get alerted when documents go stale so your knowledge stays current and trustworthy." },
    { icon: "◇", title: "HR controls what's shared", desc: "Admins decide what's visible. Employees see what they need. Clean, secure, zero confusion about who has access to what." },
    { icon: "○", title: "Upload and go — no IT project", desc: "Drag in your PDFs, Word docs, and handbooks. CobbyIQ handles the rest. You're live in 10 minutes, not 10 weeks." },
  ];

  return (
    <div style={{
      fontFamily: "'Sora', 'Segoe UI', system-ui, sans-serif",
      background: `linear-gradient(180deg, ${COLORS.void} 0%, ${COLORS.deep} 30%, ${COLORS.nebula} 60%, ${COLORS.deep} 100%)`,
      color: COLORS.starWhite,
      minHeight: "100vh",
      overflow: "hidden",
      position: "relative",
    }}>
      <StarField />

      {/* ── Nebula Gradients ── */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <Orb size="600px" top="-10%" left="-10%" delay={0} />
        <Orb size="500px" top="40%" left="75%" delay={2} color={COLORS.accent} />
        <Orb size="700px" top="70%" left="20%" delay={4} />
      </div>

      {/* ── NAV ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "0 32px", height: "64px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: navSolid ? `${COLORS.void}ee` : "transparent",
        backdropFilter: navSolid ? "blur(20px) saturate(1.5)" : "none",
        borderBottom: navSolid ? "1px solid rgba(201,168,76,0.08)" : "1px solid transparent",
        transition: "all 0.4s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <HexLogo size={28} />
          <span style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: "20px", fontWeight: 400,
          }}>
            Cobby<span style={{ color: COLORS.gold }}>IQ</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          {[
            { label: "Features", href: "#features" },
            { label: "How it works", href: "#how-it-works" },
            { label: "Pricing", href: "#pricing" },
          ].map(link => (
            <a key={link.label} href={link.href} style={{
              color: COLORS.dim, textDecoration: "none", fontSize: "14px",
              transition: "color 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.color = COLORS.starWhite}
              onMouseLeave={e => e.currentTarget.style.color = COLORS.dim}
            >{link.label}</a>
          ))}
          <Link href="/register">
            <button style={{
              background: COLORS.gold, color: COLORS.deep,
              border: "none", borderRadius: "8px",
              padding: "8px 20px", fontSize: "14px", fontWeight: 700,
              cursor: "pointer", transition: "all 0.2s",
              boxShadow: "0 0 20px rgba(201,168,76,0.2)",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = COLORS.goldLight; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = COLORS.gold; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              Try it free
            </button>
          </Link>
        </div>
      </nav>

      <div style={{ position: "relative", zIndex: 1 }}>

        {/* ═══ HERO ═══ */}
        <section style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "120px 24px 80px", textAlign: "center",
          position: "relative",
        }}>
          {/* Animated badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "rgba(201,168,76,0.08)",
            border: "1px solid rgba(201,168,76,0.2)",
            borderRadius: "100px", padding: "6px 18px", marginBottom: "32px",
            fontSize: "12px", color: COLORS.gold,
            letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600,
            animation: "fadeInDown 0.8s ease-out",
          }}>
            <span style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: COLORS.gold,
              boxShadow: `0 0 8px ${COLORS.gold}`,
              animation: "pulse 2s infinite",
            }} />
            Built for teams of 20–150
          </div>

          <h1 style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: "clamp(2.8rem, 6.5vw, 5rem)",
            fontWeight: 400, lineHeight: 1.1,
            margin: "0 0 24px",
            maxWidth: "900px",
            animation: "fadeInUp 1s ease-out 0.2s both",
          }}>
            Your team keeps asking the
            <br />
            <span style={{
              background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldLight}, ${COLORS.gold})`,
              backgroundSize: "200% 200%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "shimmer 3s ease-in-out infinite",
            }}>
              same questions.
            </span>
            <br />
            Let your docs answer them.
          </h1>

          <p style={{
            fontSize: "clamp(1rem, 2vw, 1.15rem)",
            color: COLORS.dim, lineHeight: 1.8,
            maxWidth: "580px", margin: "0 auto 40px",
            animation: "fadeInUp 1s ease-out 0.4s both",
          }}>
            New hires ask where the PTO policy is. Engineers ask how to submit expenses.
            Managers answer the same things every week — even though it&apos;s all written down somewhere.
            CobbyIQ turns your existing docs into an AI teammate that answers instantly, accurately, with sources.
          </p>

          <div style={{
            display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap",
            animation: "fadeInUp 1s ease-out 0.6s both",
          }}>
            <Link href="/register">
              <button style={{
                background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldLight})`,
                color: COLORS.deep, border: "none",
                borderRadius: "12px", padding: "14px 32px",
                fontSize: "15px", fontWeight: 700, cursor: "pointer",
                transition: "all 0.3s",
                boxShadow: `0 4px 30px rgba(201,168,76,0.3), 0 0 60px rgba(201,168,76,0.1)`,
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"; e.currentTarget.style.boxShadow = `0 8px 40px rgba(201,168,76,0.4)`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = `0 4px 30px rgba(201,168,76,0.3)`; }}
              >
                Try it free
              </button>
            </Link>
            <button style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: COLORS.starWhite,
              borderRadius: "12px", padding: "14px 32px",
              fontSize: "15px", fontWeight: 500, cursor: "pointer",
              transition: "all 0.3s",
              backdropFilter: "blur(10px)",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.3)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              Watch demo
            </button>
          </div>

          <p style={{
            fontSize: "12px", color: COLORS.faint, marginTop: "20px",
            animation: "fadeInUp 1s ease-out 0.8s both",
          }}>
            No credit card · Works in 10 minutes · Free for early teams
          </p>

          {/* Scroll indicator */}
          <div style={{
            position: "absolute", bottom: "32px", left: "50%",
            transform: "translateX(-50%)",
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: "8px", color: COLORS.faint,
            animation: "bounce 2.5s infinite",
          }}>
            <span style={{ fontSize: "11px", letterSpacing: "0.15em" }}>EXPLORE</span>
            <svg width="16" height="24" viewBox="0 0 16 24" fill="none">
              <rect x="5" y="0" width="6" height="16" rx="3" stroke={COLORS.faint} strokeWidth="1.5" fill="none" />
              <circle cx="8" cy="6" r="1.5" fill={COLORS.gold}>
                <animate attributeName="cy" values="5;10;5" dur="1.5s" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>
        </section>

        {/* ═══ PRODUCT SHOWCASE ═══ */}
        <section style={{ padding: "40px 24px 120px", position: "relative" }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "48px" }}>
              <div style={{
                fontSize: "12px", letterSpacing: "0.15em", textTransform: "uppercase",
                color: COLORS.gold, fontWeight: 600, marginBottom: "12px",
              }}>
                Watch it answer in real time
              </div>
              <h2 style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
                fontWeight: 400, margin: 0, color: COLORS.starWhite,
              }}>
                Answers in seconds, not days
              </h2>
            </div>
            <ProductShowcase />
          </div>
        </section>

        {/* ═══ STATS BAR ═══ */}
        <section style={{
          padding: "60px 24px",
          borderTop: "1px solid rgba(201,168,76,0.08)",
          borderBottom: "1px solid rgba(201,168,76,0.08)",
          background: "rgba(0,0,0,0.2)",
        }}>
          <div style={{
            maxWidth: "800px", margin: "0 auto",
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "40px",
          }}>
            <StatBlock value={4} suffix="+ hrs/week" label="spent answering questions already in your docs" />
            <StatBlock value={50} suffix=" questions" label="the average new hire asks in their first month" />
            <StatBlock value={10} suffix=" minutes" label="to set up CobbyIQ and stop repeating yourself" />
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <section id="how-it-works" style={{ padding: "120px 24px", position: "relative" }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "64px" }}>
              <div style={{
                fontSize: "12px", letterSpacing: "0.15em", textTransform: "uppercase",
                color: COLORS.gold, fontWeight: 600, marginBottom: "12px",
              }}>
                How it works
              </div>
              <h2 style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
                fontWeight: 400, margin: 0,
              }}>
                Three steps. Ten minutes. Done.
              </h2>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr auto 1fr",
              alignItems: "flex-start",
              gap: "0",
            }}>
              <StepCard step="1" title="Upload your docs" desc="Drag in your handbook, policies, SOPs — PDF, Word, whatever you've got." delay={0} />
              <ConstellationLine />
              <StepCard step="2" title="AI reads everything" desc="CobbyIQ indexes every page and builds a searchable knowledge brain for your company." delay={0.15} />
              <ConstellationLine />
              <StepCard step="3" title="Team asks, AI answers" desc="Any employee can ask questions in plain English and get accurate answers with page references." delay={0.3} />
            </div>
          </div>
        </section>

        {/* ═══ FEATURES ═══ */}
        <section id="features" style={{
          padding: "100px 24px 120px",
          position: "relative",
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            height: "1px",
            background: `linear-gradient(90deg, transparent, ${COLORS.gold}33, transparent)`,
          }} />

          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "64px" }}>
              <div style={{
                fontSize: "12px", letterSpacing: "0.15em", textTransform: "uppercase",
                color: COLORS.gold, fontWeight: 600, marginBottom: "12px",
              }}>
                Features
              </div>
              <h2 style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
                fontWeight: 400, margin: "0 0 16px",
              }}>
                The Knowledge Manager you can&apos;t afford to hire
              </h2>
              <p style={{
                fontSize: "15px", color: COLORS.dim, maxWidth: "520px",
                margin: "0 auto", lineHeight: 1.7,
              }}>
                CobbyIQ does what a Knowledge Manager would — organizes your docs,
                answers your team&apos;s questions, and tells you where the gaps are.
                Without the $80k salary.
              </p>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "20px",
            }}>
              {features.map((f, i) => (
                <FeatureCard key={f.title} {...f} index={i} delay={i * 0.08} />
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section id="pricing" style={{
          padding: "120px 24px",
          textAlign: "center",
          position: "relative",
        }}>
          {/* Radial glow */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "600px", height: "600px", borderRadius: "50%",
            background: `radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 70%)`,
            pointerEvents: "none",
            animation: "orbFloat 6s ease-in-out infinite alternate",
          }} />

          <div style={{ position: "relative", maxWidth: "650px", margin: "0 auto" }}>
            <HexLogo size={48} />
            <h2 style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              fontWeight: 400, margin: "24px 0 16px", lineHeight: 1.1,
            }}>
              Stop answering the
              <br />
              <span style={{ color: COLORS.gold }}>same questions.</span>
            </h2>
            <p style={{
              color: COLORS.dim, fontSize: "16px", lineHeight: 1.7,
              marginBottom: "36px",
            }}>
              Free for early teams. Set up in 10 minutes.
              <br />
              Your docs become your smartest teammate.
            </p>
            <Link href="/register">
              <button style={{
                background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldLight})`,
                color: COLORS.deep, border: "none",
                borderRadius: "12px", padding: "16px 40px",
                fontSize: "16px", fontWeight: 700, cursor: "pointer",
                transition: "all 0.3s",
                boxShadow: `0 4px 40px rgba(201,168,76,0.35), 0 0 80px rgba(201,168,76,0.1)`,
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px) scale(1.03)"; e.currentTarget.style.boxShadow = `0 8px 50px rgba(201,168,76,0.5)`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = `0 4px 40px rgba(201,168,76,0.35)`; }}
              >
                Try it free
              </button>
            </Link>
            <p style={{ fontSize: "12px", color: COLORS.faint, marginTop: "16px" }}>
              No credit card · No IT setup · Free for early adopters
            </p>
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "32px 24px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
          color: COLORS.faint, fontSize: "13px",
        }}>
          <HexLogo size={18} />
          <span>© 2026 CobbyIQ · The Knowledge Manager for growing teams</span>
        </footer>
      </div>

      {/* ── Global Animations ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Sora:wght@300;400;500;600;700&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px ${COLORS.gold}; }
          50% { opacity: 0.5; box-shadow: 0 0 16px ${COLORS.gold}; }
        }

        @keyframes orbFloat {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(30px, -40px) scale(1.1); }
        }

        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(8px); }
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        html { scroll-behavior: smooth; }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${COLORS.void}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.gold}44; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${COLORS.gold}88; }
      `}</style>
    </div>
  );
}