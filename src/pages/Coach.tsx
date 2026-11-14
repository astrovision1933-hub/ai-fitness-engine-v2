import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Panel, TerminalBadge, StatusDot } from "@/components/terminal";
import { CoachAvatar } from "@/components/coach-avatar";
import { coachAccent } from "@/lib/coach-media";
import { coachFullName } from "@/lib/coach-voice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INTENT_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { CoachMarkdown } from "@/components/markdown";
import { useI18n } from "@/lib/i18n";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useVoiceCoach } from "@/hooks/use-voice-coach";

// Prompts stay in English so intent classification remains reliable; the reply
// language comes from the user's stored preference (server-side instruction).
const QUICK_ACTIONS: Array<{ labelKey: string; prompt: string }> = [
  { labelKey: "coach.quick.today", prompt: "Show me today's workout and how to approach it." },
  { labelKey: "coach.quick.create", prompt: "Create a workout for me based on my profile and equipment." },
  { labelKey: "coach.quick.diet", prompt: "Analyze my diet based on my profile data." },
  { labelKey: "coach.quick.progress", prompt: "Review my progress based on my logged workouts." },
  { labelKey: "coach.quick.goal", prompt: "Assess my current goal and whether my plan matches it." },
  { labelKey: "coach.quick.ask", prompt: "I have a training question." },
];

export default function Coach() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const personasData = useQuery(api.coachPersonas.listPersonasForMe);
  const personas = personasData?.personas;
  const profile = useQuery(api.profile.getProfile);
  const journey = useQuery(api.coachJourney.getJourney);
  const latest = useQuery(api.coachChat.getLatestConversation);
  const conversations = useQuery(api.coachChat.listConversations);
  const ent = useQuery(api.subscriptions.getMyEntitlement, {});
  const settings = useQuery(api.settings.getMySettings, {});

  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const messages = useQuery(
    api.coachChat.getMessages,
    conversationId ? { conversationId } : "skip",
  );

  const ensureConversation = useMutation(api.coachChat.ensureConversation);
  const sendMessage = useMutation(api.coachChat.sendMessage);
  const assignCoach = useMutation(api.coachJourney.assignCoach);
  const seedPersonas = useMutation(api.coachPersonas.seedPersonasPublic);

  const { t, locale } = useI18n();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingReply, setPendingReply] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Voice (Part 4) — Web Speech provider, gated on entitlement + user settings.
  // Never claims to be human: composer labels it SYNTHETIC VOICE.
  const voiceInputEnabled =
    ent?.voiceAccess === true && settings?.voice?.inputEnabled === true;
  const voiceOutEnabled =
    ent?.voiceAccess === true && settings?.voice?.outputEnabled === true;
  const voice = useVoiceCoach({ enabled: voiceInputEnabled || voiceOutEnabled });
  const { startListening, stopListening, speak, transcript, listening, speaking, error: voiceError, sttSupported } = voice;
  const wasPendingRef = useRef(false);

  // Mic transcript flows into the composer (deferred so the effect never
  // triggers a synchronous cascading render).
  useEffect(() => {
    if (!transcript) return;
    const frame = requestAnimationFrame(() => setInput(transcript));
    return () => cancelAnimationFrame(frame);
  }, [transcript]);

  // Speak each new assistant reply once, when voice output is allowed.
  useEffect(() => {
    const was = wasPendingRef.current;
    wasPendingRef.current = pendingReply;
    if (was && !pendingReply && voiceOutEnabled && messages?.length) {
      const last = messages[messages.length - 1];
      if (last.role !== "user") speak(last.content);
    }
  }, [pendingReply, messages, voiceOutEnabled, speak]);

  // Boot the roster on first load.
  useEffect(() => {
    seedPersonas({}).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve the active conversation: newest, else create one with the assigned persona.
  useEffect(() => {
    if (conversationId || personas === undefined) return;
    if (latest) {
      const id = latest._id;
      queueMicrotask(() => setConversationId(id));
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
      const pending = last?.role === "user";
      queueMicrotask(() => setPendingReply(pending));
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
      toast.error(err instanceof Error ? err.message : t("coach.failed"));
      setPendingReply(false);
    } finally {
      setSending(false);
    }
  }

  async function handleSwitchPersona(personaId: Id<"coachPersonas">) {
    const lockedPersona = personas?.find((p) => p._id === personaId && p.locked);
    if (lockedPersona) {
      toast.message(`${lockedPersona.name} is locked on your plan`, {
        description: `Your ${personasData?.planName ?? "current"} plan unlocks ${personasData?.botLimit ?? 2} bots. Upgrade to add more coaches.`,
      });
      navigate("/subscription");
      return;
    }
    try {
      await ensureConversation({ personaId });
      const res = await assignCoach({ personaId });
      // Reload the newest conversation for that persona.
      setConversationId(null);
      toast.success(
        res.isChange
          ? `${res.coachTitle} ${res.name} is now your AI Fitness Coach`
          : `${res.coachTitle} ${res.name} assigned`,
        { description: "Your workout, nutrition and progress history is untouched." },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch coach");
    }
  }

  // Assigned coach resolution: profile.coachPersonaId is kept in sync with the
  // journey's selectedCoachId, so the assigned coach is always auto-selected.
  const activePersona =
    personas?.find((p) => p._id === profile?.coachPersonaId) ??
    personas?.find((p) => p._id === journey?.coach?._id);

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
          <Panel title={t("coach.roster").toUpperCase()}>
            {personasData && (
              <div className="mb-2 flex items-center justify-between gap-2 border border-border bg-secondary/50 px-2 py-1.5">
                <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  {personasData.planName.toUpperCase()} · {personasData.personas.filter((p) => !p.locked).length}/
                  {personasData.personas.length} {t("coach.bots").toUpperCase()}
                </span>
                {personasData.upgradeTo && (
                  <button
                    onClick={() => navigate("/subscription")}
                    className="rounded-full bg-gradient-to-r from-[#a3e635] to-[#65d413] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#0a1205] hover:brightness-110"
                  >
                    {t("coach.upgrade")}
                  </button>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              {loading && <p className="text-xs text-muted-foreground">{t("common.loading")}</p>}
              {personas?.map((p) => (
                <button
                  key={p._id}
                  onClick={() => handleSwitchPersona(p._id)}
                  className={cn(
                    "w-full border px-2.5 py-2 text-left transition-colors",
                    p.locked
                      ? "border-border/60 bg-secondary/30 opacity-70"
                      : activePersona?._id === p._id
                        ? "border-terminal-green bg-[#eef3ea]"
                        : "border-border bg-card hover:border-muted-foreground/40",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <CoachAvatar name={p.name} accent={coachAccent(p.name)} className="size-9" />
                      {p.locked && (
                        <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full border border-border bg-background text-[8px]">
                          🔒
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold tracking-wide">{coachFullName(p.name)}</div>
                      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {p.locked ? t("coach.locked") : p.role}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title={t("coach.history").toUpperCase()}>
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
                <p className="text-xs text-muted-foreground">{t("coach.noSessions")}</p>
              )}
            </div>
          </Panel>
        </div>

        {/* chat column */}
        <Panel
          title={t("coach.title").toUpperCase()}
          subtitle={
            activePersona
              ? `${coachFullName(activePersona.name)} · ${t("coach.aiPersonas")}`
              : t("coach.aiPersonas")
          }
          right={
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <StatusDot tone={pendingReply ? "warn" : "ok"} pulse={pendingReply} />
              {pendingReply ? t("coach.typing") : t("coach.ready")}
            </span>
          }
          className="flex min-h-[70vh] flex-col"
        >
          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-1"
            style={{ maxHeight: "62vh" }}
          >
            {messages?.length === 0 && (
              <div className="flex items-start gap-2.5">
                {activePersona && (
                  <CoachAvatar name={activePersona.name} accent={coachAccent(activePersona.name)} className="mt-0.5 size-8 shrink-0" />
                )}
                <div className="min-w-0 rounded-2xl rounded-tl-sm border border-border bg-secondary/60 p-4 text-sm leading-6">
                  <p className="font-semibold">
                    {activePersona ? `${coachFullName(activePersona.name)} ${t("coach.welcome")}` : `${t("nav.coach")}.`}
                  </p>
                  {profile?.activeGoalId ? (
                    <p className="mt-1 text-muted-foreground">{t("coach.welcomeBody")}</p>
                  ) : (
                    <p className="mt-1 text-muted-foreground">{t("coach.setGoalFirst")}</p>
                  )}
                </div>
              </div>
            )}

            {messages?.map((m) => {
              const isUser = m.role === "user";
              return (
                <div key={m._id} className={cn("flex items-start gap-2", isUser ? "justify-end" : "justify-start")}>
                  {!isUser && activePersona && (
                    <CoachAvatar
                      name={activePersona.name}
                      accent={coachAccent(activePersona.name)}
                      className="mt-0.5 size-8 shrink-0"
                    />
                  )}
                  <div className={cn("flex min-w-0 max-w-[85%] flex-col", isUser ? "items-end" : "items-start")}>
                    {!isUser && (
                      <span className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {activePersona ? coachFullName(activePersona.name) : t("nav.coach")}
                      </span>
                    )}
                    <div
                      className={cn(
                        "min-w-0 max-w-full rounded-2xl border px-3.5 py-2.5 text-sm shadow-sm",
                        isUser
                          ? "rounded-tr-sm border-border bg-secondary"
                          : m.safetyFlag
                            ? "rounded-tl-sm border-terminal-amber/50 bg-[#fdf3e7]"
                            : "rounded-tl-sm border-terminal-green/40 bg-[#eef3ea]",
                      )}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap break-words text-[13px] leading-6">{m.content}</p>
                      ) : (
                        <CoachMarkdown text={m.content} />
                      )}
                      <div className={cn("mt-2 flex flex-wrap items-center gap-1.5", isUser && "justify-end")}>
                        <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                          {isUser ? t("common.you") : activePersona?.name ?? t("nav.coach")} ·{" "}
                          {new Date(m.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {m.intent && (
                          <TerminalBadge tone={m.safetyFlag ? "warn" : "ink"}>
                            {INTENT_LABELS[m.intent] ?? m.intent}
                          </TerminalBadge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {pendingReply && (
              <div className="flex items-start gap-2 justify-start">
                {activePersona && (
                  <CoachAvatar name={activePersona.name} accent={coachAccent(activePersona.name)} className="mt-0.5 size-8 shrink-0" />
                )}
                <div className="rounded-2xl rounded-tl-sm border border-terminal-green/40 bg-[#eef3ea] px-3.5 py-2.5">
                  <span className="flex items-center gap-1" aria-label={t("coach.processing")}>
                    <span className="size-1.5 animate-bounce rounded-full bg-status-ok [animation-delay:-0.3s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-status-ok [animation-delay:-0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-status-ok" />
                  </span>
                  <span className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {t("coach.processing")}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* quick actions */}
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.labelKey}
                onClick={() => handleSend(action.prompt)}
                disabled={sending || !conversationId}
                className="border border-border bg-secondary/50 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-terminal-green/50 hover:bg-[#eef3ea] hover:text-status-ok disabled:opacity-50"
              >
                {t(action.labelKey)}
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
            {voiceInputEnabled && sttSupported && (
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "rounded-none text-[11px] uppercase tracking-[0.14em]",
                  listening && "border-terminal-amber/60 bg-[#fdf3e7] text-status-warn",
                )}
                disabled={!conversationId || sending}
                onClick={() => (listening ? stopListening() : startListening())}
              >
                {listening ? "● REC" : "🎙 MIC"}
              </Button>
            )}
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={conversationId ? t("coach.placeholder") : t("coach.initializing")}
              disabled={!conversationId || sending}
              className="rounded-none"
            />
            <Button
              type="submit"
              className="rounded-none text-[11px] uppercase tracking-[0.14em]"
              disabled={!conversationId || sending || !input.trim()}
            >
              {t("coach.send")}
            </Button>
          </form>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {(voiceInputEnabled || voiceOutEnabled) && (
              <TerminalBadge tone="info">SYNTHETIC VOICE — AI COACH</TerminalBadge>
            )}
            {listening && <span className="text-status-warn">LISTENING…</span>}
            {speaking && <span className="text-status-ok">SPEAKING…</span>}
            {voiceError && <span className="text-status-warn">{voiceError}</span>}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
