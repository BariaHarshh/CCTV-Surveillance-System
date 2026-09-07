"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Brain,
  Check,
  Loader2,
  MessageSquarePlus,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import { AdminShell } from "@/components/admin/AdminShell";
import { StaffShell } from "@/components/staff/StaffShell";
import { cn } from "@/lib/utils";

interface Conversation {
  conversationId: string;
  title: string;
  status: string;
  updatedAt: string;
}

interface PendingAction {
  actionId: string;
  tool: string;
  summary: string;
  risk?: string;
}

interface ChatMessage {
  messageId: string;
  role: string;
  content: string;
  blocks?: unknown[];
  sources?: Array<{ type: string; id: string; title: string; href?: string; section?: string }>;
  confidence?: string | null;
  toolsUsed?: string[];
  model?: string | null;
  provider?: string | null;
  pendingAction?: PendingAction | null;
  feedback?: "helpful" | "not_helpful" | null;
  createdAt?: string;
}

interface StatusPayload {
  status: {
    available: boolean;
    provider: string;
    model: string;
    mode: string;
    effectiveMode?: string;
    message: string;
  };
  privacy: { aiEnabled: boolean; copilotEnabled: boolean; allowExternalProviders: boolean };
  organization: { id: string; name: string };
  user: { role: string; name: string };
}

function renderBlocks(blocks: unknown[] | undefined) {
  if (!blocks?.length) return null;
  return (
    <div className="mt-3 space-y-2">
      {blocks.map((b, i) => {
        const block = b as {
          type?: string;
          title?: string;
          content?: string;
          items?: Array<{ label: string; value: string | number; href?: string; severity?: string }>;
          links?: Array<{ label: string; href: string }>;
          columns?: string[];
          rows?: Array<Record<string, string | number | null>>;
        };
        if (block.type === "stats" && block.items) {
          return (
            <div key={i} className="grid grid-cols-2 gap-2">
              {block.items.map((it) => (
                <div key={it.label} className="rounded-lg border border-border bg-black/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted">{it.label}</p>
                  <p className="text-sm font-semibold">{String(it.value)}</p>
                </div>
              ))}
            </div>
          );
        }
        if (block.type === "recommendations" && block.items) {
          return (
            <ul key={i} className="space-y-1.5">
              {block.title && <p className="text-[10px] uppercase text-muted">{block.title}</p>}
              {block.items.map((it, j) => (
                <li key={j} className="rounded-lg border border-border px-3 py-2 text-xs">
                  <span className="font-medium text-accent">{it.label}</span>
                  <span className="text-muted"> — {String(it.value)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "links" && block.links) {
          return (
            <div key={i} className="flex flex-wrap gap-2">
              {block.links.map((l) => (
                <Link key={l.href} href={l.href} className="rounded-full border border-border px-3 py-1 text-[11px] text-accent hover:bg-glass">
                  {l.label}
                </Link>
              ))}
            </div>
          );
        }
        if (block.type === "table" && block.rows?.length) {
          const cols = block.columns ?? Object.keys(block.rows[0]);
          return (
            <div key={i} className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-glass text-muted">
                  <tr>{cols.map((c) => <th key={c} className="px-2 py-1.5 font-medium">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {block.rows.slice(0, 10).map((row, ri) => (
                    <tr key={ri} className="border-t border-white/[0.04]">
                      {cols.map((c) => <td key={c} className="px-2 py-1.5">{row[c] == null ? "—" : String(row[c])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === "card" && block.items) {
          return (
            <div key={i} className="rounded-lg border border-accent/20 bg-accent/5 p-3">
              {block.title && <p className="mb-2 text-xs font-semibold text-accent">{block.title}</p>}
              <dl className="space-y-1 text-xs">
                {block.items.map((it) => (
                  <div key={it.label} className="flex justify-between gap-2">
                    <dt className="text-muted">{it.label}</dt>
                    <dd className="font-medium">{String(it.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        }
        if (block.content) {
          return <p key={i} className="whitespace-pre-wrap text-xs text-muted">{block.content}</p>;
        }
        return null;
      })}
    </div>
  );
}

export function CopilotClient({ user }: { user: SafeUser }) {
  const Shell = user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? AdminShell : StaffShell;
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"history" | "chat" | "context">("chat");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/intelligence/status", { credentials: "include" });
    const data = await res.json();
    if (res.ok) setStatus(data);
  }, []);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/intelligence/copilot", { credentials: "include" });
    const data = await res.json();
    if (res.ok) setConversations(data.conversations ?? []);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/intelligence/copilot/${conversationId}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) setMessages(data.messages ?? []);
      else setError(data.error ?? "Failed to load messages");
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadConversations();
  }, [loadStatus, loadConversations]);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else setMessages([]);
  }, [activeId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { messageId: `local_${Date.now()}`, role: "user", content: text },
    ]);
    try {
      const res = await fetch("/api/intelligence/copilot", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId ?? undefined, message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      const result = data.result;
      setActiveId(result.conversationId);
      await loadConversations();
      await loadMessages(result.conversationId);
    } catch {
      setError("Network error");
    } finally {
      setSending(false);
    }
  }

  async function confirmAction(actionId: string, confirm: boolean) {
    const res = await fetch("/api/intelligence/copilot/confirm", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId, confirm }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Confirm failed");
      return;
    }
    if (activeId) await loadMessages(activeId);
    if (confirm && data.result?.next) {
      setMessages((prev) => [
        ...prev,
        {
          messageId: `sys_${Date.now()}`,
          role: "system",
          content: data.result.note ?? "Action confirmed.",
        },
      ]);
    }
  }

  async function sendFeedback(messageId: string, feedback: "helpful" | "not_helpful") {
    await fetch("/api/intelligence/copilot/feedback", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, feedback }),
    });
    setMessages((prev) => prev.map((m) => (m.messageId === messageId ? { ...m, feedback } : m)));
  }

  async function archiveConversation(conversationId: string) {
    await fetch(`/api/intelligence/copilot/${conversationId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    if (activeId === conversationId) setActiveId(null);
    await loadConversations();
  }

  async function deleteConversation(conversationId: string) {
    await fetch(`/api/intelligence/copilot/${conversationId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (activeId === conversationId) setActiveId(null);
    await loadConversations();
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" || m.role === "action_confirm");
  const sources = lastAssistant?.sources ?? [];
  const pending = lastAssistant?.pendingAction ?? null;

  const effectiveMode = status?.status.effectiveMode ?? status?.status.mode ?? "tools";
  const providerNone = !status?.status.available || status.status.provider === "NONE";

  return (
    <Shell user={user}>
      <div className="flex h-[calc(100vh-8rem)] min-h-[520px] flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Brain className="h-6 w-6 text-accent" /> AI Copilot
            </h1>
            <p className="mt-1 text-sm text-muted">Permission-aware campus intelligence — tools first, no invented facts.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className={cn("rounded-full border px-2.5 py-1", providerNone ? "border-amber-500/30 text-amber-300" : "border-emerald-500/30 text-emerald-300")}>
              {providerNone ? "Tools-only (no LLM)" : `LLM · ${status?.status.provider}`}
            </span>
            <span className="rounded-full border border-border px-2.5 py-1 text-muted">
              Model: {status?.status.model ?? "—"}
            </span>
            <span className="rounded-full border border-border px-2.5 py-1 text-muted">
              Org: {status?.organization.name ?? "—"}
            </span>
            <span className="rounded-full border border-border px-2.5 py-1 text-muted">
              Role: {status?.user.role ?? user.role}
            </span>
            <span className="rounded-full border border-border px-2.5 py-1 text-muted">Mode: {effectiveMode}</span>
          </div>
        </div>

        {providerNone && (
          <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-100">
            {status?.status.message ?? "No external AI provider configured — using verified data tools only."}
          </div>
        )}

        <div className="mt-3 flex gap-2 lg:hidden">
          {(["history", "chat", "context"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setMobilePane(p)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs capitalize",
                mobilePane === p ? "bg-accent/15 text-accent" : "text-muted border border-border"
              )}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="mt-3 grid min-h-0 flex-1 gap-3 lg:grid-cols-12">
          {/* History */}
          <aside
            className={cn(
              "flex min-h-0 flex-col rounded-2xl border border-border bg-surface/50 lg:col-span-3",
              mobilePane !== "history" && "hidden lg:flex"
            )}
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">History</p>
              <button
                type="button"
                onClick={() => {
                  setActiveId(null);
                  setMessages([]);
                  setMobilePane("chat");
                }}
                className="rounded-lg p-1.5 text-muted hover:bg-glass hover:text-foreground"
                title="New chat"
              >
                <MessageSquarePlus className="h-4 w-4" />
              </button>
            </div>
            <ul className="flex-1 space-y-1 overflow-y-auto p-2">
              {conversations.length === 0 && <li className="px-2 py-4 text-xs text-muted">No conversations yet.</li>}
              {conversations.map((c) => (
                <li key={c.conversationId}>
                  <div
                    className={cn(
                      "group flex items-start gap-1 rounded-xl px-2 py-2",
                      activeId === c.conversationId ? "bg-accent/10" : "hover:bg-glass"
                    )}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setActiveId(c.conversationId);
                        setMobilePane("chat");
                      }}
                    >
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="text-[10px] text-muted">{new Date(c.updatedAt).toLocaleString()}</p>
                    </button>
                    <button type="button" className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-foreground" onClick={() => archiveConversation(c.conversationId)} title="Archive">
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-red-300" onClick={() => deleteConversation(c.conversationId)} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </aside>

          {/* Chat */}
          <section
            className={cn(
              "flex min-h-0 flex-col rounded-2xl border border-border bg-surface/40 lg:col-span-6",
              mobilePane !== "chat" && "hidden lg:flex"
            )}
          >
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {loadingMsgs && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted" />}
              {!loadingMsgs && messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted">
                  <Brain className="mb-3 h-10 w-10 text-accent/40" />
                  <p>Ask about open incidents, offline cameras, risk, or policies.</p>
                  <p className="mt-1 text-xs">Answers come from live org data and published knowledge — never invented.</p>
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.messageId}
                  className={cn(
                    "max-w-[92%] rounded-2xl px-4 py-3 text-sm",
                    m.role === "user" && "ml-auto bg-accent/15 text-white",
                    m.role === "assistant" && "mr-auto border border-border bg-black/25",
                    m.role === "action_confirm" && "mr-auto border border-amber-500/30 bg-amber-500/10",
                    m.role === "warning" && "mr-auto border border-red-500/30 bg-red-500/10 text-red-100",
                    m.role === "system" && "mx-auto border border-border bg-glass text-xs text-muted"
                  )}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  {renderBlocks(m.blocks)}
                  {(m.role === "assistant" || m.role === "action_confirm") && !m.messageId.startsWith("local_") && (
                    <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
                      {m.confidence && <span className="text-[10px] text-muted">Confidence: {m.confidence}</span>}
                      <button type="button" onClick={() => sendFeedback(m.messageId, "helpful")} className={cn("p-1 text-muted hover:text-emerald-400", m.feedback === "helpful" && "text-emerald-400")}>
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => sendFeedback(m.messageId, "not_helpful")} className={cn("p-1 text-muted hover:text-red-300", m.feedback === "not_helpful" && "text-red-300")}>
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {sending && (
                <div className="mr-auto flex items-center gap-2 rounded-2xl border border-border bg-black/25 px-4 py-3 text-xs text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {error && <p className="px-4 pb-2 text-xs text-red-400">{error}</p>}

            <form
              className="flex gap-2 border-t border-border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the campus copilot…"
                className="flex-1 rounded-xl border border-border bg-black/30 px-4 py-2.5 text-sm outline-none focus:border-accent/40"
                disabled={sending || status?.privacy.copilotEnabled === false}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="rounded-xl bg-accent/90 px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </section>

          {/* Sources / actions */}
          <aside
            className={cn(
              "flex min-h-0 flex-col gap-3 overflow-y-auto lg:col-span-3",
              mobilePane !== "context" && "hidden lg:flex"
            )}
          >
            <div className="rounded-2xl border border-border bg-surface/50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Pending action</p>
              {pending ? (
                <div className="mt-3 space-y-3">
                  <p className="text-sm">{pending.summary}</p>
                  <p className="text-[10px] text-muted">Tool: {pending.tool} · Risk: {pending.risk ?? "HIGH"}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => confirmAction(pending.actionId, true)}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-300"
                    >
                      <Check className="h-3.5 w-3.5" /> Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmAction(pending.actionId, false)}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-muted"
                    >
                      <X className="h-3.5 w-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted">No action awaiting confirmation.</p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface/50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Sources</p>
              <ul className="mt-3 space-y-2">
                {sources.length === 0 && <li className="text-xs text-muted">Sources appear after an assistant reply.</li>}
                {sources.map((s, i) => (
                  <li key={`${s.id}-${i}`} className="rounded-lg border border-border px-3 py-2 text-xs">
                    {s.href ? (
                      <Link href={s.href} className="font-medium text-accent hover:underline">{s.title}</Link>
                    ) : (
                      <span className="font-medium">{s.title}</span>
                    )}
                    <p className="text-[10px] text-muted">{s.type}{s.section ? ` · ${s.section}` : ""}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-surface/50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Shortcuts</p>
              <div className="mt-3 flex flex-col gap-1.5 text-xs">
                <Link href="/ai/daily-briefing" className="text-accent hover:underline">Daily Briefing</Link>
                <Link href="/ai/predictive-risk" className="text-accent hover:underline">Predictive Risk</Link>
                <Link href="/ai/recommendations" className="text-accent hover:underline">Recommendations</Link>
                <Link href="/admin/ai/knowledge" className="text-accent hover:underline">Knowledge Base</Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </Shell>
  );
}
