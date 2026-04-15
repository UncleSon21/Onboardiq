"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "../../lib/api";
import { setAuth } from "../../lib/auth";
import { ArrowRight, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      const { access_token, role, workspace_id, name, email: userEmail } = res.data;
      setAuth(access_token, { id: workspace_id, email: userEmail, name, role, workspace_id });
      router.push(role === "hr" ? "/dashboard" : "/portal");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: unknown } } };
      const detail = axiosErr.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.map((d: { msg: string }) => d.msg).join(", ") : (detail as string) || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-paper)" }}>
      {/* ── Left panel ─────────────────────────────────────────── */}
      <div className="hidden lg:flex w-[52%] relative overflow-hidden flex-col justify-between p-12"
        style={{ background: "var(--color-navy)" }}>

        {/* Mesh gradient orbs */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 80% 60% at 20% 80%, rgba(232,160,32,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 20%, rgba(100,120,200,0.12) 0%, transparent 60%)",
        }} />

        {/* Grid pattern */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(232,160,32,0.2)", border: "1px solid rgba(232,160,32,0.3)" }}>
              <Sparkles size={15} style={{ color: "var(--color-amber)" }} />
            </div>
            <span className="font-display text-xl" style={{ color: "white" }}>CobbyIQ</span>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-2"
            style={{ background: "rgba(232,160,32,0.15)", border: "1px solid rgba(232,160,32,0.25)", color: "var(--color-amber)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            AI-powered onboarding
          </div>
          <h2 className="font-display text-5xl leading-tight" style={{ color: "white" }}>
            Your team&apos;s<br />first impression<br />starts here.
          </h2>
          <p className="text-sm leading-relaxed max-w-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            Give new hires instant answers, clear tasks, and the confidence to hit the ground running from day one.
          </p>

          {/* Social proof */}
          <div className="flex gap-6 pt-4">
            {[["500+", "Companies"], ["50k+", "Hires onboarded"], ["94%", "Satisfaction"]].map(([num, label]) => (
              <div key={label}>
                <p className="font-display text-xl" style={{ color: "white" }}>{num}</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <div className="relative z-10 p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-sm italic mb-3" style={{ color: "rgba(255,255,255,0.7)" }}>
            &ldquo;CobbyIQ cut our ramp-up time from 3 weeks to 5 days. New hires feel supported from day one.&rdquo;
          </p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: "var(--color-amber)", color: "white" }}>S</div>
            <div>
              <p className="text-xs font-semibold" style={{ color: "white" }}>Sarah Chen</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>HR Lead, TechFlow</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--color-amber-light)", border: "1px solid #f5d98a" }}>
              <Sparkles size={13} style={{ color: "var(--color-amber)" }} />
            </div>
            <span className="font-display text-xl" style={{ color: "var(--color-ink)" }}>CobbyIQ</span>
          </div>

          <div className="animate-fade-up">
            <h1 className="font-display text-4xl mb-1" style={{ color: "var(--color-ink)" }}>Welcome back</h1>
            <p className="text-sm mb-8" style={{ color: "var(--color-muted)" }}>Sign in to your workspace</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { label: "Email", type: "email", value: email, set: setEmail, placeholder: "you@company.com" },
                { label: "Password", type: "password", value: password, set: setPassword, placeholder: "••••••••" },
              ].map(({ label, type, value, set, placeholder }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-muted)" }}>
                    {label}
                  </label>
                  <input
                    type={type}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    required
                    placeholder={placeholder}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: "white", border: "1.5px solid var(--color-border)", color: "var(--color-ink)", fontWeight: 450 }}
                    onFocus={(e) => { e.target.style.borderColor = "var(--color-amber)"; e.target.style.boxShadow = "0 0 0 3px rgba(232,160,32,0.1)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "var(--color-border)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
              ))}

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-amber w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-2"
                style={{ background: "var(--color-amber)", color: "white", opacity: loading ? 0.75 : 1 }}
              >
                {loading ? "Signing in…" : (
                  <>Sign in <ArrowRight size={15} /></>
                )}
              </button>
            </form>

            <p className="text-sm text-center mt-6" style={{ color: "var(--color-muted)" }}>
              No account?{" "}
              <Link href="/register" className="font-semibold hover:underline" style={{ color: "var(--color-amber)" }}>
                Create your workspace
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}