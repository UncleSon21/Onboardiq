"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "../../lib/api";
import { setAuth } from "../../lib/auth";
import { ArrowRight, Sparkles, Building2, Users, Zap } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    company_name: "",
    admin_name: "",
    admin_email: "",
    admin_password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.register({
        company_name: form.company_name,
        name: form.admin_name,
        email: form.admin_email,
        password: form.admin_password,
      });
      const { access_token, role, workspace_id, name, email } = res.data;
      setAuth(access_token, { id: workspace_id, email, name, role, workspace_id });
      router.push("/dashboard");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: unknown } } };
      const detail = axiosErr.response?.data?.detail;
      setError(
        Array.isArray(detail)
          ? detail.map((d: { msg: string }) => d.msg).join(", ")
          : (detail as string) || "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const fields = [
    { name: "company_name", label: "Company name",  type: "text",     placeholder: "VaniaFlorist", icon: Building2 },
    { name: "admin_name",   label: "Your name",     type: "text",     placeholder: "Sion Le",       icon: Users },
    { name: "admin_email",  label: "Work email",    type: "email",    placeholder: "sion@company.com", icon: null },
    { name: "admin_password", label: "Password",   type: "password", placeholder: "Min. 8 characters", icon: null },
  ];

  const perks = [
    { icon: Zap,       text: "AI answers in seconds",           sub: "Trained on your docs" },
    { icon: Users,     text: "Role-based task checklists",      sub: "30 / 60 / 90 day plans" },
    { icon: Building2, text: "Documentation gap detection",     sub: "Know what's missing" },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-paper)" }}>

      {/* ── Left panel ──────────────────────────────────────────── */}
      <div className="hidden lg:flex w-[48%] relative overflow-hidden flex-col justify-between p-12"
        style={{ background: "var(--color-navy)" }}>

        {/* Mesh gradient */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 70% 60% at 80% 20%, rgba(232,160,32,0.15) 0%, transparent 60%), radial-gradient(ellipse 80% 50% at 10% 90%, rgba(80,100,200,0.1) 0%, transparent 60%)",
        }} />

        {/* Grid */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(232,160,32,0.2)", border: "1px solid rgba(232,160,32,0.3)" }}>
            <Sparkles size={15} style={{ color: "var(--color-amber)" }} />
          </div>
          <span className="font-display text-xl" style={{ color: "white" }}>OnboardIQ</span>
        </div>

        {/* Middle copy */}
        <div className="relative z-10 space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5"
              style={{ background: "rgba(232,160,32,0.15)", border: "1px solid rgba(232,160,32,0.25)", color: "var(--color-amber)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              Free to start — no credit card
            </div>
            <h2 className="font-display text-4xl leading-tight mb-4" style={{ color: "white" }}>
              Set up in<br />under 5 minutes.
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              Upload your docs, invite your first hire, and your AI onboarding copilot is live.
            </p>
          </div>

          {/* Perks */}
          <div className="space-y-3">
            {perks.map(({ icon: Icon, text, sub }) => (
              <div key={text} className="flex items-center gap-4 p-4 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(232,160,32,0.15)", border: "1px solid rgba(232,160,32,0.2)" }}>
                  <Icon size={16} style={{ color: "var(--color-amber)" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "white" }}>{text}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom steps */}
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
            How it works
          </p>
          <div className="flex gap-6">
            {["Create workspace", "Upload docs", "Invite hires"].map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: "var(--color-amber)", color: "white" }}>
                  {i + 1}
                </div>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{step}</p>
                {i < 2 && <ArrowRight size={12} style={{ color: "rgba(255,255,255,0.2)" }} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "var(--color-amber-light)", border: "1px solid #f5d98a" }}>
              <Sparkles size={13} style={{ color: "var(--color-amber)" }} />
            </div>
            <span className="font-display text-xl" style={{ color: "var(--color-ink)" }}>OnboardIQ</span>
          </div>

          <div className="animate-fade-up">
            <h1 className="font-display text-4xl mb-1" style={{ color: "var(--color-ink)" }}>
              Create workspace
            </h1>
            <p className="text-sm mb-8" style={{ color: "var(--color-muted)" }}>
              Your AI onboarding copilot, ready in minutes.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {fields.map(({ name, label, type, placeholder }) => (
                <div key={name}>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: "var(--color-muted)" }}>
                    {label}
                  </label>
                  <input
                    name={name}
                    type={type}
                    value={form[name as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
                    required
                    placeholder={placeholder}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{
                      background: "white",
                      border: "1.5px solid var(--color-border)",
                      color: "var(--color-ink)",
                      transition: "all 0.15s ease",
                    }}
                    onFocus={e => { e.target.style.borderColor = "var(--color-amber)"; e.target.style.boxShadow = "0 0 0 3px rgba(232,160,32,0.1)"; }}
                    onBlur={e => { e.target.style.borderColor = "var(--color-border)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
              ))}

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
                  style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
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
                {loading ? "Creating workspace…" : (
                  <><Sparkles size={14} />Create workspace</>
                )}
              </button>
            </form>

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-4 mt-6">
              {["Free plan", "No credit card", "Instant setup"].map((badge) => (
                <span key={badge} className="flex items-center gap-1 text-xs"
                  style={{ color: "var(--color-muted)" }}>
                  <span style={{ color: "#16a34a" }}>✓</span> {badge}
                </span>
              ))}
            </div>

            <p className="text-sm text-center mt-5" style={{ color: "var(--color-muted)" }}>
              Already have a workspace?{" "}
              <Link href="/login" className="font-semibold hover:underline"
                style={{ color: "var(--color-amber)" }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}