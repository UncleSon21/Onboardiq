"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import {
  CheckCircle2,
  Circle,
  Send,
  Bot,
  User as UserIcon,
  LogOut,
  Sparkles,
} from "lucide-react";
import { getUser, clearAuth, type User } from "../../lib/auth";
import { tasksApi, chatApi } from "../../lib/api";

interface Task {
  id: string;
  title: string;
  description: string;
  category: "30day" | "60day" | "90day";
  due_day: number;
  completed_at: string | null;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  source_chunks?: string[];
}

const PHASES = [
  { id: "30day", label: "30 days", color: "#16a34a", bg: "#f0fdf4" },
  { id: "60day", label: "60 days", color: "#d97706", bg: "#fffbeb" },
  { id: "90day", label: "90 days", color: "#7c3aed", bg: "#faf5ff" },
] as const;

export default function PortalPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [activePhase, setActivePhase] = useState<Task["category"]>("30day");
  const [view, setView] = useState<"tasks" | "chat">("tasks");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [pulsingTask, setPulsingTask] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace("/login"); return; }
    if (u.role !== "hire") { router.replace("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const { data: historyData } = useQuery({
    queryKey: ["chat-history"],
    queryFn: () => chatApi.history().then((r) => r.data),
    enabled: !!user,
  });

  useEffect(() => {
    if (historyData && messages.length === 0) {
      setMessages(
        historyData.map((h: { question: string; answer: string }) => [
          { role: "user" as const, content: h.question },
          { role: "assistant" as const, content: h.answer },
        ]).flat()
      );
    }
  }, [historyData, messages.length]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: () => tasksApi.list().then((r) => {
      const { day30 = [], day60 = [], day90 = [] } = r.data;
      return [...day30, ...day60, ...day90];
    }),
    enabled: !!user,
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => tasksApi.complete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  function handleComplete(id: string) {
    if (pulsingTask) return;
    setPulsingTask(id);
    setTimeout(() => {
      completeMutation.mutate(id);
      setPulsingTask(null);
    }, 300);
  }

  async function sendMessage() {
    if (!input.trim() || asking) return;
    const question = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: question }]);
    setAsking(true);
    try {
      const res = await chatApi.ask(question);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.data.answer, source_chunks: res.data.source_chunks },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Sorry, I couldn't find an answer. Try rephrasing your question." },
      ]);
    } finally {
      setAsking(false);
    }
  }

  const tasksByPhase = tasks.filter((t) => t.category === activePhase);
  const phaseTasks = tasks.filter((t) => t.category === activePhase);
  const phaseCompleted = phaseTasks.filter((t) => t.completed_at).length;
  const phaseTotal = phaseTasks.length;
  const overallCompleted = tasks.filter((t) => t.completed_at).length;
  const overallTotal = tasks.length;
  const overallPct = overallTotal ? Math.round((overallCompleted / overallTotal) * 100) : 0;

  function logout() {
    clearAuth();
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-paper)" }}>
      <header
        className="sticky top-0 z-50 border-b px-6 py-3.5 flex items-center justify-between"
        style={{ background: "white", borderColor: "var(--color-border)", boxShadow: "0 1px 0 var(--color-border)" }}
      >
        <div className="flex items-center gap-6">
          <span className="font-display text-xl tracking-tight" style={{ color: "var(--color-amber)" }}>
            CobbyIQ
          </span>
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--color-paper)" }}>
            {(["tasks", "chat"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-4 py-1.5 rounded-md text-sm font-medium capitalize"
                style={{
                  background: view === v ? "white" : "transparent",
                  color: view === v ? "var(--color-ink)" : "var(--color-muted)",
                  boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                {v === "chat" ? (
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={12} />
                    Ask AI
                  </span>
                ) : "My tasks"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-full"
            style={{ background: "var(--color-amber-light)", border: "1px solid #f5d98a" }}
          >
            <div className="relative w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "#fde68a" }}>
              <div
                className="absolute left-0 top-0 h-full rounded-full"
                style={{
                  width: `${overallPct}%`,
                  background: "var(--color-amber)",
                  transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            </div>
            <span className="text-xs font-semibold" style={{ color: "var(--color-amber)" }}>
              {overallPct}% done
            </span>
          </div>

          <div className="text-right">
            <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>{user?.name}</p>
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>New hire</p>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg"
            onMouseEnter={e => (e.currentTarget.style.background = "var(--color-paper)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            style={{ transition: "background 0.15s ease" }}
          >
            <LogOut size={15} style={{ color: "var(--color-muted)" }} />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">

        {view === "tasks" && (
          <div className="space-y-6 animate-fade-up">
            <div>
              <h1 className="font-display text-4xl mb-1" style={{ color: "var(--color-ink)" }}>
                Welcome, {user?.name?.split(" ")[0] ?? ""}
              </h1>
              <p style={{ color: "var(--color-muted)", fontSize: "14px" }}>
                Complete these tasks to get up to speed in your first 90 days.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {PHASES.map(({ id, label, color, bg }) => {
                const pts = tasks.filter((t) => t.category === id);
                const pct = pts.length ? Math.round((pts.filter((t) => t.completed_at).length / pts.length) * 100) : 0;
                const isActive = activePhase === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActivePhase(id)}
                    className="p-4 rounded-2xl border text-left"
                    style={{
                      background: isActive ? bg : "white",
                      borderColor: isActive ? color : "var(--color-border)",
                      boxShadow: isActive ? `0 0 0 2px ${color}22, 0 4px 12px ${color}18` : "none",
                      transform: isActive ? "translateY(-1px)" : "none",
                      transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.transform = "none"; }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: isActive ? color : "var(--color-muted)" }}>
                      First {label}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: isActive ? `${color}22` : "var(--color-border)" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }} />
                      </div>
                      <span className="text-xs font-semibold w-8 text-right" style={{ color: isActive ? color : "var(--color-muted)" }}>{pct}%</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              {phaseCompleted} of {phaseTotal} tasks completed
            </p>

            <div className="space-y-2">
              {tasksByPhase.length === 0 ? (
                <p className="text-sm text-center py-10" style={{ color: "var(--color-muted)" }}>
                  No tasks for this phase yet.
                </p>
              ) : (
                tasksByPhase.map((task, i) => (
                  <div
                    key={task.id}
                    className="task-item bg-white rounded-2xl border flex items-start gap-4 p-4"
                    style={{
                      borderColor: "var(--color-border)",
                      opacity: task.completed_at ? 0.6 : 1,
                      animationDelay: `${i * 0.04}s`,
                      animation: "fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
                    }}
                  >
                    <button
                      onClick={() => !task.completed_at && handleComplete(task.id)}
                      disabled={!!task.completed_at}
                      className={`mt-0.5 shrink-0 ${pulsingTask === task.id ? "complete-pulse" : ""}`}
                      onMouseEnter={e => { if (!task.completed_at) e.currentTarget.style.transform = "scale(1.15)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                      style={{ transition: "transform 0.15s ease" }}
                    >
                      {task.completed_at ? (
                        <CheckCircle2 size={22} style={{ color: "var(--color-amber)" }} />
                      ) : (
                        <Circle size={22} style={{ color: "#d1c9bf" }} />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm" style={{ color: "var(--color-ink)", textDecoration: task.completed_at ? "line-through" : "none" }}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{task.description}</p>
                      )}
                    </div>
                    <span className="text-xs font-medium shrink-0 px-2 py-1 rounded-lg" style={{ background: "var(--color-paper)", color: "var(--color-muted)" }}>
                      Day {task.due_day}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {view === "chat" && (
          <div className="flex flex-col h-[calc(100vh-140px)] animate-fade-up">
            <div className="mb-5">
              <h1 className="font-display text-4xl mb-1" style={{ color: "var(--color-ink)" }}>Ask anything</h1>
              <p style={{ color: "var(--color-muted)", fontSize: "14px" }}>
                Trained on your company&apos;s documents — ask about policies, tools, or your role.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
              {messages.length === 0 && (
                <div className="text-center pt-16 animate-fade-up">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: "var(--color-amber-light)", border: "1px solid #f5d98a" }}>
                    <Bot size={24} style={{ color: "var(--color-amber)" }} />
                  </div>
                  <p className="font-semibold mb-1" style={{ color: "var(--color-ink)" }}>
                    Hi {user?.name?.split(" ")[0]}! I&apos;m your onboarding AI.
                  </p>
                  <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                    Try asking about leave policy, tools, or your first week.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center mt-5">
                    {["What's our leave policy?", "How do I request access to tools?", "When do I get paid?"].map((q) => (
                      <button
                        key={q}
                        onClick={() => setInput(q)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{ background: "white", border: "1px solid var(--color-border)", color: "var(--color-ink)", transition: "all 0.15s ease" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--color-amber)"; e.currentTarget.style.color = "var(--color-amber)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.color = "var(--color-ink)"; }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  style={{ animation: "fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both" }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1"
                    style={{ background: msg.role === "user" ? "var(--color-navy)" : "var(--color-amber-light)", border: msg.role === "assistant" ? "1px solid #f5d98a" : "none" }}>
                    {msg.role === "user" ? <UserIcon size={13} color="white" /> : <Bot size={13} style={{ color: "var(--color-amber)" }} />}
                  </div>
                  <div className="max-w-[78%] px-4 py-3 text-sm leading-relaxed"
                    style={{
                      background: msg.role === "user" ? "var(--color-navy)" : "white",
                      color: msg.role === "user" ? "white" : "var(--color-ink)",
                      border: msg.role === "assistant" ? "1px solid var(--color-border)" : "none",
                      borderRadius: msg.role === "user" ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                      boxShadow: msg.role === "assistant" ? "0 1px 4px rgba(0,0,0,0.05)" : "none",
                    }}>
                    {msg.role === "assistant" ? (
                      <ReactMarkdown
                        components={{
                          p: ({children}) => <p style={{ margin: "0 0 8px 0" }}>{children}</p>,
                          ul: ({children}) => <ul style={{ margin: "8px 0", paddingLeft: "16px" }}>{children}</ul>,
                          ol: ({children}) => <ol style={{ margin: "8px 0", paddingLeft: "16px" }}>{children}</ol>,
                          li: ({children}) => <li style={{ margin: "2px 0" }}>{children}</li>,
                          strong: ({children}) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                          h1: ({children}) => <h3 style={{ fontWeight: 600, margin: "8px 0 4px", fontSize: "15px" }}>{children}</h3>,
                          h2: ({children}) => <h3 style={{ fontWeight: 600, margin: "8px 0 4px", fontSize: "15px" }}>{children}</h3>,
                          h3: ({children}) => <h3 style={{ fontWeight: 600, margin: "8px 0 4px", fontSize: "14px" }}>{children}</h3>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : msg.content}
                  </div>
                </div>
              ))}

              {asking && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1"
                    style={{ background: "var(--color-amber-light)", border: "1px solid #f5d98a" }}>
                    <Bot size={13} style={{ color: "var(--color-amber)" }} />
                  </div>
                  <div className="px-4 py-3" style={{ background: "white", border: "1px solid var(--color-border)", borderRadius: "4px 18px 18px 18px" }}>
                    <span className="inline-flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--color-amber)", animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--color-amber)", animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--color-amber)", animationDelay: "300ms" }} />
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-3 p-3 rounded-2xl border mt-2"
              style={{ background: "white", borderColor: "var(--color-border)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Ask about policies, tools, your role…"
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: "var(--color-ink)" }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || asking}
                className="btn-amber w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: input.trim() && !asking ? "var(--color-amber)" : "var(--color-border)", transition: "all 0.15s ease" }}
              >
                <Send size={14} color="white" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}