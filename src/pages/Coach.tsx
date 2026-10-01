import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Panel, TerminalBadge, StatusDot } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INTENT_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

const QUICK_ACTIONS = [
  "Today's Workout",
  "Create Workout",
  "Analyze My Diet",
  "My Progress",
  "My Goal",
  "Ask Coach",
];

const QUICK_PROMPTS: Record<string, string> = {
  "Today's Workout": "Show me today's workout and how to approach it.",
  "Create Workout": "Create a workout for me based on my profile and equipment.",
  "Analyze My Diet": "Analyze my diet based on my profile data.",
  "My Progress": "Review my progress based on my logged workouts.",
  "My Goal": "Assess my current goal and whether my plan matches it.",
  "Ask Coach": "I have a training question.",
};

export default function Coach() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const personas = useQuery(api.coachPersonas.listPersonas);
  const profile = useQuery(api.profile.getProfile);
  const latest = useQuery(api.coachChat.getLatestConversation);
  const conversations = useQuery(api.coachChat.listConversations);

  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const messages = useQuery(
    api.coachChat.getMessages,
    conversationId ? { conversationId } : "skip",
  );

  const ensureConversation = useMutation(api.coachChat.ensureConversation);
  const sendMessage = useMutation(api.coachChat.sendMessage);
  const assignCoach = useMutation(api.profile.assignCoach);
  const seedPersonas = useMutation(api.coachPersonas.seedPersonasPublic);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingReply, setPendingReply] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Boot the roster on first load.
  useEffect(() => {
    seedPersonas({}).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve the active conversation: newest, else create one with the assigned persona.
  useEffect(() => {
    if (conversationId || personas === undefined) return;
    if (latest) {
      setConversationId(latest._id);
      return;
    }
    if (personas.length > 0 && profile) {
      const target = profile.coachPersonaId ?? personas[0]._id;
      ensureConversation({ personaId: target })
        .then(setConversationId)
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, personas, latest, profile]);

  // Auto-scroll on new messages / reply arrival.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages?.length, pendingReply]);

  // If a quick action query param arrived, send it as the first message.
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && conversationId && !sending) {
      setSearchParams({}, { replace: true });
      handleSend(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, searchParams]);

  // Show the typing indicator while the assistant reply is pending.
  useEffect(() => {
    if (messages && conversationId) {
      const last = messages[messages.length - 1];
      setPendingReply(last?.role === "user");
    }
  }, [messages, conversationId]);

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || !conversationId || sending) return;
    setInput("");
    setSending(true);
    setPendingReply(true);
    try {
      await sendMessage({ conversationId, content });
      setInput("");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to send");
      setPendingReply(false);
    } finally {
      setSending(false);
    }
  }

  async function handleSwitchPersona(personaId: Id<"coachPersonas">) {
    try {
      await ensureConversation({ personaId });
      await assignCoach({ personaId });
      // Reload the newest conversation for that persona.
      setConversationId(null);
      toast.success("Coach switched");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch coach");
    }
  }

  const activePersona = personas?.find(
    (p) => p._id === profile?.coachPersonaId,
  );

  const loading = personas === undefined || profile === undefined;

  useEffect(() => {
    if (!loading && profile && !profile.onboardingComplete) {
      navigate("/onboarding", { replace: true });
    }
  }, [loading, profile, navigate]);

  return (
    <AppShell>
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* left rail: roster + history */}
        <div className="space-y-4">
          <Panel title="COACH ROSTER">
            <div className="space-y-1.5">
              {loading && <p className="text-xs text-muted-foreground">loading…</p>}
              {personas?.map((p) => (
                <button
                  key={p._id}
                  onClick={() => handleSwitchPersona(p._id)}
                  className={cn(
                    "w-full border px-2.5 py-2 text-left transition-colors",
                    activePersona?._id === p._id
                      ? "border-terminal-green bg-[#eef3ea]"
                      : "border-border bg-card hover:border-muted-foreground/40",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-status-ok">{p.avatarGlyph}</span>
                    <span className="text-xs font-bold tracking-wide">{p.name}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{p.role}</div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="SESSION HISTORY">
            <div className="space-y-1">
              {(conversations ?? []).slice(0, 8).map((c) => (
                <button
                  key={c._id}
                  onClick={() => setConversationId(c._id)}
                  className={cn(
                    "w-full border px-2 py-1.5 text-left text-[11px]",
                    conversationId === c._id
                      ? "border-terminal-green/50 bg-[#eef3ea]"
                      : "border-transparent hover:border-border",
                  )}
                >
                  <div className="flex justify-between gap-2">
                    <span className="truncate">{c.title}</span>
                    <span className="shrink-0 text-[9px] text-muted-foreground">
                      {new Date(c.lastMessageAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
              {conversations?.length === 0 && (
                <p className="text-xs text-muted-foreground">No sessions yet.</p>
              )}
            </div>
          </Panel>
        </div>

        {/* chat column */}
        <Panel
          title="AI COACH CHAT"
          subtitle={activePersona ? `${activePersona.name} — ${activePersona.role}` : "AI PERSONAS — NOT REAL HUMANS"}
          right={
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <StatusDot tone={pendingReply ? "warn" : "ok"} pulse={pendingReply} />
              {pendingReply ? "COACH TYPING" : "READY"}
            </span>
          }
          className="flex min-h-[70vh] flex-col"
        >
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: "60vh" }}>
            {messages?.length === 0 && (
              <div className="border border-border bg-secondary/50 p-4 text-sm leading-6">
                <p className="font-semibold">
                  {activePersona ? `${activePersona.name} here.` : "Coach here."}
                </p>
                {profile?.activeGoalId ? (
                  <p className="mt-1 text-muted-foreground">
                    Tell me how many days you can train this week and I'll structure your workout
                    around your goal — or use a quick action below.
                  </p>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    Set your goal first and I'll structure your training around it.
                  </p>
                )}
              </div>
            )}

            {messages?.map((m) => (
              <div key={m._id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] border px-3 py-2 text-sm leading-6",
                    m.role === "user"
                      ? "border-border bg-secondary"
                      : m.safetyFlag
                        ? "border-terminal-amber/50 bg-[#fdf3e7]"
                        : "border-terminal-green/40 bg-[#eef3ea]",
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                      {m.role === "user" ? "YOU" : activePersona?.name ?? "COACH"} ·{" "}
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {m.intent && (
                      <TerminalBadge tone={m.safetyFlag ? "warn" : "ink"}>
                        {INTENT_LABELS[m.intent] ?? m.intent}
                      </TerminalBadge>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {pendingReply && (
              <div className="flex justify-start">
                <div className="border border-terminal-green/40 bg-[#eef3ea] px-3 py-2 text-sm">
                  <span className="font-mono text-status-ok">▊▊▊ coach processing…</span>
                </div>
              </div>
            )}
          </div>

          {/* quick actions */}
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action}
                onClick={() => handleSend(QUICK_PROMPTS[action])}
                disabled={sending || !conversationId}
                className="border border-border bg-secondary/50 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-terminal-green/50 hover:bg-[#eef3ea] hover:text-status-ok disabled:opacity-50"
              >
                {action}
              </button>
            ))}
          </div>

          {/* composer */}
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={conversationId ? "Type your message…" : "Initializing session…"}
              disabled={!conversationId || sending}
              className="rounded-none"
            />
            <Button
              type="submit"
              className="rounded-none text-[11px] uppercase tracking-[0.14em]"
              disabled={!conversationId || sending || !input.trim()}
            >
              SEND →
            </Button>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
}
