"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UploadCloud, Users, FileText, LayoutDashboard,
  LogOut, Trash2, Plus, AlertCircle, CheckCircle2,
  Clock, Sparkles, TrendingUp, MessageSquare,
  ChevronRight, Activity, CalendarDays, Zap,
  BookOpen, Settings,
} from "lucide-react";
import { getUser, clearAuth, type User } from "../../lib/auth";
import { analyticsApi, documentsApi, hiresApi } from "../../lib/api";
import api from "../../lib/api";

// ── Types ──────────────────────────────────────────────────────────────────
interface Document {
  id: string; filename: string; status: "processing" | "ready" | "failed";
  chunk_count: number; uploaded_at: string; file_size_kb: number;
}
interface Hire {
  id: string; name: string; email: string; department: string;
  start_date: string; completion_score: number;
}
interface Overview {
  total_hires: number; avg_completion: number; answer_rate: number;
  total_questions: number; total_documents: number;
}
interface Gap { question: string; count: number; }
interface RecentQuestion {
  id: string; hire_name: string; question: string;
  was_answered: boolean; asked_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function initials(name: string) {
  return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
}

function StatusBadge({ status }: { status: Document["status"] }) {
  const map = {
    ready:      { icon: CheckCircle2, color: "#16a34a", bg: "#f0fdf4", label: "Ready" },
    processing: { icon: Clock,        color: "#d97706", bg: "#fffbeb", label: "Processing" },
    failed:     { icon: AlertCircle,  color: "#dc2626", bg: "#fef2f2", label: "Failed" },
  };
  const { icon: Icon, color, bg, label } = map[status];
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: bg, color }}>
      <Icon size={9} />{label}
    </span>
  );
}

// ── Sidebar nav item ───────────────────────────────────────────────────────
function NavItem({ icon: Icon, label, active, onClick, badge }: {
  icon: React.ElementType; label: string; active: boolean;
  onClick: () => void; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left"
      style={{
        background: active ? "rgba(232,160,32,0.12)" : "transparent",
        color: active ? "var(--color-amber)" : "rgba(255,255,255,0.55)",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.85)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
    >
      <Icon size={16} />
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(232,160,32,0.2)", color: "var(--color-amber)" }}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color = "var(--color-amber)" }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border group"
      style={{ borderColor: "var(--color-border)", transition: "all 0.2s ease", cursor: "default" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.07)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)", letterSpacing: "0.08em" }}>{label}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: color + "15" }}>
          <Icon size={15} style={{ color }} />
        </div>
      </div>
      <p className="font-display text-3xl font-bold mb-1" style={{ color: "var(--color-ink)" }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: "var(--color-muted)" }}>{sub}</p>}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "hires">("overview");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", department: "", start_date: "" });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace("/login"); return; }
    if (u.role !== "hr") { router.replace("/portal"); return; }
    setUser(u);
  }, [router]);

  const { data: overview } = useQuery<Overview>({
    queryKey: ["overview"],
    queryFn: () => analyticsApi.overview().then(r => r.data),
    enabled: !!user,
  });
  const { data: gaps = [] } = useQuery<Gap[]>({
    queryKey: ["gaps"],
    queryFn: () => analyticsApi.gaps().then(r => Array.isArray(r.data) ? r.data : []),
    enabled: !!user,
  });
  const { data: recentQs = [] } = useQuery<RecentQuestion[]>({
    queryKey: ["recent-questions"],
    queryFn: () => api.get("/analytics/questions").then(r => r.data),
    enabled: !!user,
  });
  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ["documents"],
    queryFn: () => documentsApi.list().then(r => r.data.documents ?? []),
    enabled: !!user,
  });
  const { data: hires = [] } = useQuery<Hire[]>({
    queryKey: ["hires"],
    queryFn: () => hiresApi.list().then(r => Array.isArray(r.data) ? r.data : r.data.hires ?? []),
    enabled: !!user,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsApi.upload(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
  const inviteMutation = useMutation({
    mutationFn: () => hiresApi.invite(inviteForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hires"] });
      setShowInviteForm(false);
      setInviteForm({ name: "", email: "", department: "", start_date: "" });
    },
  });

  function handleFile(file: File) { uploadMutation.mutate(file); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }
  function logout() { clearAuth(); router.push("/login"); }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const healthScore = (overview?.avg_completion != null && overview?.answer_rate != null)
    ? Math.round(
        (overview.avg_completion * 0.4) +
        (overview.answer_rate * 0.4) +
        (Math.min((overview.total_documents ?? 0) * 10, 100) * 0.2)
      )
    : null;

  // Upcoming hires (start_date within 30 days)
  const upcomingHires = hires.filter(h => {
    const start = new Date(h.start_date);
    const diff = start.getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  }).sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  return (
    <div className="flex min-h-screen" style={{ background: "var(--color-paper)" }}>

      {/* ── LEFT SIDEBAR ──────────────────────────────────────── */}
      <aside className="w-60 shrink-0 flex flex-col sticky top-0 h-screen"
        style={{ background: "var(--color-navy)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(232,160,32,0.2)", border: "1px solid rgba(232,160,32,0.3)" }}>
              <Sparkles size={15} style={{ color: "var(--color-amber)" }} />
            </div>
            <div>
              <p className="font-display text-base leading-tight" style={{ color: "white" }}>OnboardIQ</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>HR Dashboard</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
            Workspace
          </p>
          <NavItem icon={LayoutDashboard} label="Overview"  active={activeTab === "overview"}  onClick={() => setActiveTab("overview")} />
          <NavItem icon={FileText}       label="Documents"  active={activeTab === "documents"} onClick={() => setActiveTab("documents")} badge={documents.length} />
          <NavItem icon={Users}          label="Hires"      active={activeTab === "hires"}     onClick={() => setActiveTab("hires")} badge={hires.length} />

          <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
              Quick actions
            </p>
            <button
              onClick={() => { setActiveTab("documents"); fileInputRef.current?.click(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium"
              style={{ color: "rgba(255,255,255,0.55)", transition: "all 0.15s ease" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.85)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
            >
              <UploadCloud size={16} />Upload doc
            </button>
            <button
              onClick={() => { setActiveTab("hires"); setShowInviteForm(true); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium"
              style={{ color: "rgba(255,255,255,0.55)", transition: "all 0.15s ease" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.85)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
            >
              <Plus size={16} />Invite hire
            </button>
          </div>
        </nav>

        {/* Health score + user */}
        <div className="px-4 pb-5 space-y-3">
          {/* Onboarding health */}
          <div className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Health score</p>
              <Activity size={12} style={{ color: healthScore && healthScore >= 70 ? "#4ade80" : "var(--color-amber)" }} />
            </div>
            <div className="flex items-end gap-2 mb-2">
              <p className="font-display text-3xl font-bold" style={{ color: "white" }}>
                {healthScore != null && !isNaN(healthScore) ? healthScore : "—"}
              </p>
              <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>/100</p>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
              <div className="h-full rounded-full" style={{
                width: `${healthScore ?? 0}%`,
                background: healthScore && healthScore >= 70 ? "#4ade80" : "var(--color-amber)",
                transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1)",
              }} />
            </div>
            <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
              {healthScore == null ? "No data yet" : healthScore >= 80 ? "Excellent 🎉" : healthScore >= 60 ? "On track" : "Needs attention"}
            </p>
          </div>

          {/* User */}
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "var(--color-amber)", color: "white" }}>
              {user?.name ? initials(user.name) : "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "white" }}>{user?.name}</p>
              <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.35)" }}>HR Admin</p>
            </div>
            <button onClick={logout} className="p-1.5 rounded-lg shrink-0"
              style={{ transition: "background 0.15s ease" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <LogOut size={13} style={{ color: "rgba(255,255,255,0.4)" }} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN + RIGHT ──────────────────────────────────────── */}
      <div className="flex flex-1 min-w-0">

        {/* ── MAIN CONTENT ──────────────────────────────────── */}
        <main className="flex-1 min-w-0 px-8 py-8 overflow-y-auto">

          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-7 animate-fade-up">
              <div>
                <h1 className="font-display text-4xl font-bold mb-1" style={{ color: "var(--color-ink)" }}>
                  {greeting}{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
                </h1>
                <p style={{ color: "var(--color-muted)", fontSize: "14px" }}>
                  Here&apos;s how your team&apos;s onboarding is going today.
                </p>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Active hires"     value={overview?.total_hires ?? "—"}   icon={Users}         color="#7c3aed" />
                <StatCard label="Avg completion"   value={overview?.avg_completion != null ? `${Math.round(overview.avg_completion)}%` : "—"} sub="across all phases" icon={TrendingUp} color="#16a34a" />
                <StatCard label="AI answer rate"   value={overview?.answer_rate != null ? `${Math.round(overview.answer_rate)}%` : "—"} sub="resolved by AI" icon={Sparkles} />
                <StatCard label="Questions asked"  value={overview?.total_questions ?? "—"} icon={MessageSquare} color="#0ea5e9" />
              </div>

              {/* Recent questions */}
              <div className="bg-white rounded-2xl border" style={{ borderColor: "var(--color-border)" }}>
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
                  <div>
                    <h2 className="font-display text-xl font-bold" style={{ color: "var(--color-ink)" }}>Recent questions</h2>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>What your hires are asking right now</p>
                  </div>
                  {recentQs.length > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: "var(--color-paper)", color: "var(--color-muted)", border: "1px solid var(--color-border)" }}>
                      {recentQs.length} total
                    </span>
                  )}
                </div>
                {recentQs.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare size={28} className="mx-auto mb-3" style={{ color: "var(--color-border)" }} />
                    <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>No questions yet</p>
                    <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>Questions will appear here once hires start asking.</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                    {recentQs.map((q) => (
                      <div key={q.id} className="flex items-start gap-4 px-6 py-4"
                        style={{ transition: "background 0.15s ease" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--color-paper)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                          style={{ background: "var(--color-navy)", color: "white" }}>
                          {initials(q.hire_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "var(--color-ink)" }}>{q.question}</p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{q.hire_name} · {timeAgo(q.asked_at)}</p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full font-semibold shrink-0"
                          style={{
                            background: q.was_answered ? "#f0fdf4" : "#fef2f2",
                            color: q.was_answered ? "#16a34a" : "#dc2626",
                          }}>
                          {q.was_answered ? "Answered" : "No match"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Gaps */}
              {gaps.length > 0 && (
                <div className="bg-white rounded-2xl border" style={{ borderColor: "var(--color-border)" }}>
                  <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
                    <div>
                      <h2 className="font-display text-xl font-bold" style={{ color: "var(--color-ink)" }}>Documentation gaps</h2>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>Upload docs to close these</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "#fef2f2", color: "#dc2626" }}>
                      {gaps.length} gaps
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                    {gaps.map((g, i) => (
                      <div key={i} className="flex items-center justify-between px-6 py-3.5"
                        style={{ transition: "background 0.15s ease" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--color-paper)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                        <p className="text-sm" style={{ color: "var(--color-ink)" }}>{g.question}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold ml-4 shrink-0" style={{ background: "#fef2f2", color: "#dc2626" }}>
                          {g.count}× asked
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DOCUMENTS */}
          {activeTab === "documents" && (
            <div className="space-y-6 animate-fade-up">
              <div>
                <h1 className="font-display text-4xl font-bold mb-1" style={{ color: "var(--color-ink)" }}>Knowledge base</h1>
                <p style={{ color: "var(--color-muted)", fontSize: "14px" }}>Upload files — your AI learns from them instantly.</p>
              </div>

              {/* Drop zone */}
              <div className="rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer"
                style={{ borderColor: dragOver ? "var(--color-amber)" : "var(--color-border)", background: dragOver ? "var(--color-amber-light)" : "white", transition: "all 0.2s ease" }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: dragOver ? "var(--color-amber)" : "var(--color-paper)", transition: "all 0.2s ease" }}>
                  <UploadCloud size={24} style={{ color: dragOver ? "white" : "var(--color-muted)" }} />
                </div>
                <p className="font-semibold mb-1" style={{ color: "var(--color-ink)" }}>
                  {dragOver ? "Drop to upload" : "Click to upload or drag and drop"}
                </p>
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>PDF, DOCX, TXT — up to 20MB</p>
                {uploadMutation.isPending && (
                  <p className="text-xs mt-3 font-medium" style={{ color: "var(--color-amber)" }}>Uploading & indexing…</p>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

              {documents.length > 0 && (
                <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
                  <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "var(--color-border)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                      {documents.length} document{documents.length !== 1 ? "s" : ""}
                    </p>
                    <BookOpen size={14} style={{ color: "var(--color-muted)" }} />
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                        {["File", "Status", "Chunks", "Size", ""].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map(doc => (
                        <tr key={doc.id} style={{ borderBottom: "1px solid var(--color-border)", transition: "background 0.15s ease" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--color-paper)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: "var(--color-paper)", border: "1px solid var(--color-border)" }}>
                                <FileText size={14} style={{ color: "var(--color-muted)" }} />
                              </div>
                              <span className="font-medium truncate max-w-xs" style={{ color: "var(--color-ink)" }}>{doc.filename}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5"><StatusBadge status={doc.status} /></td>
                          <td className="px-5 py-3.5 text-sm" style={{ color: "var(--color-muted)" }}>{doc.chunk_count ?? "—"}</td>
                          <td className="px-5 py-3.5 text-sm" style={{ color: "var(--color-muted)" }}>{doc.file_size_kb}KB</td>
                          <td className="px-5 py-3.5">
                            <button onClick={() => deleteMutation.mutate(doc.id)} className="p-1.5 rounded-lg"
                              style={{ transition: "background 0.15s ease" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "#fef2f2")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                              <Trash2 size={14} style={{ color: "#dc2626" }} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* HIRES */}
          {activeTab === "hires" && (
            <div className="space-y-6 animate-fade-up">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-display text-4xl font-bold mb-1" style={{ color: "var(--color-ink)" }}>Hires</h1>
                  <p style={{ color: "var(--color-muted)", fontSize: "14px" }}>Invite and track your new hires.</p>
                </div>
                <button onClick={() => setShowInviteForm(v => !v)}
                  className="btn-amber flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--color-amber)", color: "white" }}>
                  <Plus size={15} />Invite hire
                </button>
              </div>

              {showInviteForm && (
                <div className="bg-white rounded-2xl border p-6 animate-fade-up" style={{ borderColor: "var(--color-border)" }}>
                  <h3 className="font-display text-xl font-bold mb-5" style={{ color: "var(--color-ink)" }}>New hire invite</h3>
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    {[
                      { name: "name", label: "Full name", type: "text", placeholder: "Alex Chen" },
                      { name: "email", label: "Work email", type: "email", placeholder: "alex@company.com" },
                      { name: "department", label: "Department", type: "text", placeholder: "Engineering" },
                      { name: "start_date", label: "Start date", type: "date", placeholder: "" },
                    ].map(({ name, label, type, placeholder }) => (
                      <div key={name}>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-muted)" }}>{label}</label>
                        <input type={type}
                          value={inviteForm[name as keyof typeof inviteForm]}
                          onChange={e => setInviteForm(f => ({ ...f, [name]: e.target.value }))}
                          placeholder={placeholder}
                          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                          style={{ border: "1.5px solid var(--color-border)", color: "var(--color-ink)", background: "var(--color-paper)" }}
                          onFocus={e => { e.target.style.borderColor = "var(--color-amber)"; e.target.style.background = "white"; e.target.style.boxShadow = "0 0 0 3px rgba(232,160,32,0.1)"; }}
                          onBlur={e => { e.target.style.borderColor = "var(--color-border)"; e.target.style.background = "var(--color-paper)"; e.target.style.boxShadow = "none"; }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending}
                      className="btn-amber px-5 py-2.5 rounded-xl text-sm font-semibold"
                      style={{ background: "var(--color-amber)", color: "white" }}>
                      {inviteMutation.isPending ? "Sending…" : "Send invite"}
                    </button>
                    <button onClick={() => setShowInviteForm(false)}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium"
                      style={{ background: "var(--color-paper)", color: "var(--color-muted)", border: "1px solid var(--color-border)" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {hires.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border" style={{ borderColor: "var(--color-border)" }}>
                  <Users size={32} className="mx-auto mb-3" style={{ color: "var(--color-border)" }} />
                  <p className="font-medium" style={{ color: "var(--color-ink)" }}>No hires yet</p>
                  <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>Invite your first team member above.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                        {["Name", "Department", "Start date", "Progress"].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {hires.map(hire => (
                        <tr key={hire.id} style={{ borderBottom: "1px solid var(--color-border)", transition: "background 0.15s ease" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--color-paper)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                style={{ background: "var(--color-navy)", color: "white" }}>
                                {initials(hire.name)}
                              </div>
                              <div>
                                <p className="font-semibold" style={{ color: "var(--color-ink)" }}>{hire.name}</p>
                                <p className="text-xs" style={{ color: "var(--color-muted)" }}>{hire.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-medium"
                              style={{ background: "var(--color-paper)", color: "var(--color-ink)", border: "1px solid var(--color-border)" }}>
                              {hire.department}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs" style={{ color: "var(--color-muted)" }}>
                            {new Date(hire.start_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
                                <div className="h-full rounded-full" style={{
                                  width: `${hire.completion_score}%`,
                                  background: hire.completion_score >= 70 ? "#16a34a" : hire.completion_score >= 40 ? "var(--color-amber)" : "#e11d48",
                                  transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                                }} />
                              </div>
                              <span className="text-xs font-semibold w-9 text-right" style={{ color: "var(--color-ink)" }}>
                                {Math.round(hire.completion_score)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── RIGHT RAIL ────────────────────────────────────── */}
        <aside className="w-72 shrink-0 border-l px-5 py-8 space-y-6 overflow-y-auto"
          style={{ borderColor: "var(--color-border)", background: "white" }}>

          {/* AI Health */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted)" }}>AI Health</p>
            <div className="p-4 rounded-2xl border space-y-4" style={{ borderColor: "var(--color-border)", background: "var(--color-paper)" }}>
              {[
                { label: "Answer rate", value: overview?.answer_rate, color: "#16a34a" },
                { label: "Doc coverage", value: overview ? Math.min((overview.total_documents / 5) * 100, 100) : null, color: "var(--color-amber)" },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div className="flex justify-between mb-1.5">
                    <p className="text-xs font-medium" style={{ color: "var(--color-ink)" }}>{label}</p>
                    <p className="text-xs font-bold" style={{ color }}>
                      {value != null && !isNaN(value) ? `${Math.round(value)}%` : "—"}
                    </p>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
                    <div className="h-full rounded-full" style={{ width: `${value ?? 0}%`, background: color, transition: "width 1s ease" }} />
                  </div>
                </div>
              ))}
              <div className="pt-2 flex items-center gap-2">
                <Zap size={12} style={{ color: "var(--color-amber)" }} />
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                  {documents.length === 0 ? "Upload docs to improve AI" : `${documents.filter(d => d.status === "ready").length} docs indexed`}
                </p>
              </div>
            </div>
          </div>

          {/* Upcoming hires */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted)" }}>Starting soon</p>
            {upcomingHires.length === 0 ? (
              <div className="p-4 rounded-2xl border text-center" style={{ borderColor: "var(--color-border)", background: "var(--color-paper)" }}>
                <CalendarDays size={20} className="mx-auto mb-2" style={{ color: "var(--color-border)" }} />
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>No hires starting in the next 30 days</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingHires.map(hire => {
                  const start = new Date(hire.start_date);
                  const daysUntil = Math.ceil((start.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={hire.id} className="flex items-center gap-3 p-3 rounded-xl border"
                      style={{ borderColor: "var(--color-border)", background: "var(--color-paper)", transition: "all 0.15s ease" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-amber)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: "var(--color-navy)", color: "white" }}>
                        {initials(hire.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "var(--color-ink)" }}>{hire.name}</p>
                        <p className="text-xs" style={{ color: "var(--color-muted)" }}>{hire.department}</p>
                      </div>
                      <span className="text-xs font-bold shrink-0 px-2 py-1 rounded-lg"
                        style={{ background: daysUntil <= 3 ? "#fef2f2" : "var(--color-amber-light)", color: daysUntil <= 3 ? "#dc2626" : "var(--color-amber)" }}>
                        {daysUntil}d
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted)" }}>Activity</p>
            {recentQs.length === 0 && documents.length === 0 ? (
              <div className="p-4 rounded-2xl border text-center" style={{ borderColor: "var(--color-border)", background: "var(--color-paper)" }}>
                <Activity size={20} className="mx-auto mb-2" style={{ color: "var(--color-border)" }} />
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>Activity will appear here</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentQs.slice(0, 5).map(q => (
                  <div key={q.id} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                    style={{ transition: "background 0.15s ease" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--color-paper)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                      style={{ background: q.was_answered ? "#16a34a" : "#dc2626" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate" style={{ color: "var(--color-ink)" }}>
                        <span className="font-semibold">{q.hire_name.split(" ")[0]}</span> asked a question
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-muted)" }}>{timeAgo(q.asked_at)}</p>
                    </div>
                  </div>
                ))}
                {documents.slice(0, 3).map(doc => (
                  <div key={doc.id} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                    style={{ transition: "background 0.15s ease" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--color-paper)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: "var(--color-amber)" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate" style={{ color: "var(--color-ink)" }}>
                        <span className="font-semibold">Doc uploaded</span>
                      </p>
                      <p className="text-xs truncate" style={{ color: "var(--color-muted)" }}>{doc.filename}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}