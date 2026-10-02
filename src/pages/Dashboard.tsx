import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Panel, StatChip, TerminalBadge, AsciiBar, StatusDot, SectionHeader } from "@/components/terminal";
import { AIFitnessRobot } from "@/components/ai-fitness-robot";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { GOAL_LABELS } from "@/lib/labels";
import { toast } from "sonner";
import {
  Apple,
  ArrowRight,
  Brain,
  ClipboardList,
  Dumbbell,
  Gauge,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";

const QUICK_ACTIONS = [
  { label: "TODAY'S WORKOUT", to: "/workout" },
  { label: "CREATE WORKOUT", to: "/workout?generate=1" },
  { label: "LOG FOOD", to: "/nutrition" },
  { label: "MEAL PLAN", to: "/nutrition" },
  { label: "DAILY CHECK-IN", to: "/checkin" },
  { label: "MY PROGRESS", to: "/progress" },
  { label: "MY GOAL", to: "/goals" },
  { label: "ASK COACH", to: "/coach" },
  { label: "SUPPLEMENTS", to: "/supplements" },
  { label: "PRODUCTS", to: "/products" },
  { label: "REPORTS", to: "/reports" },
] as const;

const HERO_FEATURES = [
  { icon: Zap, label: "Personalized AI Coaching" },
  { icon: Dumbbell, label: "Smart Workout Plans" },
  { icon: Apple, label: "Nutrition Guidance" },
  { icon: TrendingUp, label: "Progress Tracking" },
] as const;

const CORE_LOOP = [
  { icon: Brain, title: "Understand", desc: "Know your goal, body & lifestyle", tone: "from-[#a3e635]/20" },
  { icon: Gauge, title: "Assess", desc: "Analyze your current status", tone: "from-[#67e8f9]/20" },
  { icon: ClipboardList, title: "Plan", desc: "Create personalized workout & diet", tone: "from-[#34d399]/20" },
  { icon: MessageSquare, title: "Coach", desc: "Get real-time guidance", tone: "from-[#f0b429]/20" },
  { icon: TrendingUp, title: "Track", desc: "Monitor progress every day", tone: "from-[#a78bfa]/20" },
  { icon: RefreshCw, title: "Adapt", desc: "Adjust and improve based on results", tone: "from-[#f87171]/20" },
] as const;

const COACH_SPECIALTIES: Record<string, string> = {
  arjun: "Strength & Muscle",
  veer: "Fat Loss",
  aarav: "Nutrition Coach",
  kabir: "Bodybuilding",
  rhea: "Women's Fitness",
  rudra: "Competition Prep",
  max: "Beginner Fitness",
  athena: "Supplement Intelligence",
  "coach prime": "Advanced Coaching",
};

const COACH_GRADIENTS = [
  "linear-gradient(160deg,#f0b42933,#0c110c)",
  "linear-gradient(160deg,#67e8f933,#0c110c)",
  "linear-gradient(160deg,#a3e63533,#0c110c)",
  "linear-gradient(160deg,#f8717133,#0c110c)",
  "linear-gradient(160deg,#f472b633,#0c110c)",
  "linear-gradient(160deg,#a78bfa33,#0c110c)",
  "linear-gradient(160deg,#34d39933,#0c110c)",
  "linear-gradient(160deg,#c084fc33,#0c110c)",
  "linear-gradient(160deg,#fbbf2433,#0c110c)",
];

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function HudPanel({
  label,
  value,
  sub,
  bar,
  to,
}: {
  label: string;
  value: string;
  sub?: string;
  bar?: number;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="glass-soft lift group block rounded-xl px-3 py-2.5 hover:border-primary/30 hover:shadow-[0_0_18px_rgba(163,230,53,0.12)]"
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground group-hover:text-[#dcff8a]">
          {label}
        </span>
        <ArrowRight className="size-3 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
      </div>
      <p className="font-display mt-1 text-lg font-bold leading-none text-[#dcff8a]">{value}</p>
      {typeof bar === "number" ? (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#65d413] to-[#d0ff67] shadow-[0_0_8px_var(--neon-glow)] transition-all duration-500"
            style={{ width: `${Math.round(Math.max(0, Math.min(1, bar)) * 100)}%` }}
          />
        </div>
      ) : sub ? (
        <p className="mt-1 text-[10px] text-muted-foreground">{sub}</p>
      ) : null}
    </Link>
  );
}

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const profile = useQuery(api.profile.getProfile);
  const goal = useQuery(api.profile.getActiveGoal);
  const plan = useQuery(api.workouts.getActivePlan);
  const sessions = useQuery(api.workouts.getRecentSessions, { limit: 6 });
  const notifications = useQuery(api.profile.getNotifications);
  const memory = useQuery(api.profile.getMemory);
  const latestConversation = useQuery(api.coachChat.getLatestConversation);
  const personas = useQuery(api.coachPersonas.listPersonas);

  const seedPersonas = useMutation(api.coachPersonas.seedPersonasPublic);
  const ensureConversation = useMutation(api.coachChat.ensureConversation);
  const assignCoach = useMutation(api.profile.assignCoach);

  useEffect(() => {
    seedPersonas({}).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loading =
    authLoading ||
    profile === undefined ||
    goal === undefined ||
    plan === undefined ||
    sessions === undefined;

  // Signed-in users must complete onboarding before the console unlocks.
  useEffect(() => {
    if (!loading && profile && !profile.onboardingComplete) {
      navigate("/onboarding", { replace: true });
    }
    if (!loading && profile === null) {
      navigate("/onboarding", { replace: true });
    }
  }, [loading, profile, navigate]);

  async function selectCoach(personaId: Id<"coachPersonas">) {
    try {
      await ensureConversation({ personaId });
      await assignCoach({ personaId });
      toast.success("Coach selected — opening chat");
      navigate("/coach");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to select coach");
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-3">
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-24 rounded-xl" />
          <div className="skeleton h-40 rounded-xl" />
        </div>
      </AppShell>
    );
  }

  const firstName = profile?.name ?? user?.name ?? "athlete";
  const now = new Date();
  const greeting = greetingFor(now.getHours());

  const nextSession = sessions?.find((s) => s.status === "scheduled" || s.status === "in_progress");
  const completedCount = sessions?.filter((s) => s.status === "completed").length ?? 0;
  const adherence = sessions && sessions.length > 0 ? completedCount / Math.max(sessions.length, 4) : 0;

  const daysLeft = goal?.targetDate
    ? Math.max(
        0,
        Math.ceil((new Date(goal.targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      )
    : null;

  // Contextual coach line — real data, never a generic hello.
  const coachLine = goal
    ? `You're currently working toward ${GOAL_LABELS[goal.goal] ?? goal.goal}. ${
        nextSession
          ? `Today's priority: ${nextSession.name} — complete it and stay consistent with your nutrition target.`
          : "No session scheduled — generate a plan in the WORKOUT module or ask me to build one."
      }`
    : "Set your goal and I'll structure your training around it.";

  return (
    <AppShell>
      <div className="space-y-5">
        {/* ================= HERO — COMMAND CENTER ================= */}
        <section className="neon-glow relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-[#0d130c] via-[#0a0e0a] to-[#070a07]">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            aria-hidden
            style={{
              background:
                "radial-gradient(640px 320px at 85% 20%, rgba(163,230,53,0.10), transparent 60%), radial-gradient(420px 260px at 10% 90%, rgba(103,232,249,0.06), transparent 60%)",
            }}
          />
          <div className="relative grid gap-0 xl:grid-cols-[1fr_minmax(300px,0.9fr)_180px]">
            {/* --- left: copy --- */}
            <div className="p-6 sm:p-9 xl:col-span-1">
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#dcff8a]">
                <StatusDot pulse /> System Online — 24/7 Coaching Engine
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                {greeting}, <span className="font-semibold text-foreground">{firstName}</span>.
                {goal && (
                  <>
                    {" "}Goal: <span className="text-status-ok">{(GOAL_LABELS[goal.goal] ?? goal.goal).toLowerCase()}</span>
                    {daysLeft !== null ? ` · ${daysLeft} days to target` : ""}
                  </>
                )}
              </p>
              <h1 className="font-display mt-2 text-4xl font-bold leading-[1.02] sm:text-5xl">
                YOUR COACH
                <br />
                <span className="neon-text">DOESN&apos;T SLEEP.</span>
                <br />
                NEITHER DOES THE ENGINE.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                AI Fitness Engine builds a persistent model of you — body, schedule, diet, equipment and
                goals — and helps you train, track and transform every single day.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  className="group h-11 rounded-xl bg-primary px-6 text-sm font-bold uppercase tracking-[0.12em] text-primary-foreground shadow-[0_0_24px_var(--neon-glow)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
                >
                  <Link to="/workout?generate=1">
                    Get Started
                    <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </Button>
                <Link
                  to="/coach"
                  className="glass-soft lift inline-flex h-11 items-center rounded-xl px-6 text-sm font-semibold uppercase tracking-[0.12em] text-foreground hover:border-primary/30 hover:text-[#dcff8a]"
                >
                  Explore Coaches
                </Link>
              </div>

              {/* feature indicators */}
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3">
                {HERO_FEATURES.map((f) => (
                  <span key={f.label} className="flex items-center gap-2 text-[11px] font-medium text-foreground/80">
                    <span className="flex size-7 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary shadow-[0_0_10px_rgba(163,230,53,0.15)]">
                      <f.icon className="size-3.5" aria-hidden />
                    </span>
                    {f.label}
                  </span>
                ))}
              </div>
            </div>

            {/* --- right: the AI robot --- */}
            <div className="relative mx-auto h-[300px] w-full max-w-[420px] sm:h-[400px] xl:h-full xl:max-w-none">
              {/* speech bubble */}
              <div className="glass absolute left-2 top-6 z-10 max-w-[220px] rounded-2xl border border-primary/35 p-3.5 shadow-[0_0_24px_rgba(163,230,53,0.18)] sm:left-6">
                <p className="font-display text-sm font-semibold leading-snug">
                  Hey!
                  <br />
                  I&apos;m your AI Fitness Coach.
                </p>
                <span className="mt-2 flex h-3 items-end gap-[3px]" aria-hidden>
                  {[10, 16, 8, 14, 11].map((h, i) => (
                    <span key={i} className="wave-bar" style={{ height: h, animationDelay: `${i * 0.12}s` }} />
                  ))}
                </span>
              </div>
              <AIFitnessRobot state="idle" className="h-full w-full" />
            </div>

            {/* --- far right: live HUD (real data) --- */}
            <div className="hidden flex-col justify-center gap-2.5 p-4 xl:flex">
              <HudPanel label="Workout" value={`${Math.round(adherence * 100)}%`} bar={adherence} to="/workout" />
              <HudPanel label="Progress" value={`${completedCount}`} sub="sessions done" to="/progress" />
              <HudPanel label="Goals" value={daysLeft !== null ? `${daysLeft}d` : "—"} sub={goal ? "to target" : "set a goal"} to="/goals" />
              <HudPanel label="Nutrition" value="LOG" sub="daily intake" to="/nutrition" />
              <HudPanel label="Supplements" value="SCAN" sub="verify labels" to="/supplements" />
            </div>
          </div>

          {/* HUD row for smaller screens (same real data) */}
          <div className="grid grid-cols-3 gap-2 border-t border-border/60 p-3 xl:hidden">
            <HudPanel label="Workout" value={`${Math.round(adherence * 100)}%`} bar={adherence} to="/workout" />
            <HudPanel label="Progress" value={`${completedCount}`} sub="sessions done" to="/progress" />
            <HudPanel label="Goals" value={daysLeft !== null ? `${daysLeft}d` : "—"} sub={goal ? "to target" : "set a goal"} to="/goals" />
          </div>
        </section>

        {/* ================= CHOOSE YOUR AI COACH ================= */}
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display flex items-center gap-2.5 text-lg font-bold">
                <span className="h-5 w-1 rounded-full bg-primary shadow-[0_0_10px_var(--neon-glow)]" aria-hidden />
                Choose Your AI Coach
              </h2>
              <p className="mt-0.5 pl-3.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                9 Expert Coaches Online
              </p>
            </div>
            <Link
              to="/coach"
              className="glass-soft lift rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/90 hover:border-primary/30 hover:text-[#dcff8a]"
            >
              View All →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {personas === undefined
              ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-44 rounded-xl" />)
              : personas.map((p, i) => {
                  const key = p.name.toLowerCase();
                  const specialty = COACH_SPECIALTIES[key] ?? "AI Fitness Coach";
                  return (
                    <div
                      key={p._id}
                      className="lift group relative overflow-hidden rounded-xl border border-border bg-card/70 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_0_26px_rgba(163,230,53,0.16)]"
                      style={{ background: COACH_GRADIENTS[i % COACH_GRADIENTS.length] }}
                    >
                      <div className="flex flex-col items-center px-3 pb-3 pt-5 text-center">
                        <span className="relative mb-3 flex size-14 items-center justify-center rounded-full border border-primary/30 bg-[#0c110c] font-display text-lg font-bold text-[#dcff8a] shadow-[0_0_18px_rgba(163,230,53,0.14)] transition-shadow duration-300 group-hover:shadow-[0_0_26px_var(--neon-glow)]">
                          {p.name.charAt(0).toUpperCase()}
                          <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-background">
                            <span className="size-2 animate-pulse rounded-full bg-primary shadow-[0_0_6px_var(--neon-glow)]" aria-hidden />
                          </span>
                        </span>
                        <p className="font-display text-sm font-bold uppercase tracking-[0.1em]">{p.name}</p>
                        <p className="mt-0.5 line-clamp-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          {specialty}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-status-ok">
                          <StatusDot pulse /> Online
                        </p>
                        <button
                          onClick={() => selectCoach(p._id)}
                          className="mt-3 w-full rounded-lg border border-primary/30 bg-primary/10 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#dcff8a] transition-all duration-200 hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_16px_var(--neon-glow)]"
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  );
                })}
          </div>
        </section>

        {/* ================= THE CORE LOOP ================= */}
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display flex items-center gap-2.5 text-lg font-bold">
                <span className="h-5 w-1 rounded-full bg-primary shadow-[0_0_10px_var(--neon-glow)]" aria-hidden />
                The Core Loop
              </h2>
              <p className="mt-0.5 pl-3.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                From Understanding to Transformation
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {CORE_LOOP.map((step, i) => (
              <div
                key={step.title}
                className="glass-soft lift group relative overflow-hidden rounded-xl p-4 hover:border-primary/30"
              >
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-40 transition-opacity duration-300 group-hover:opacity-70",
                    step.tone,
                  )}
                  aria-hidden
                />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-2xl font-bold text-foreground/25">{i + 1}</span>
                    <span className="flex size-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary shadow-[0_0_12px_rgba(163,230,53,0.14)]">
                      <step.icon className="size-[18px]" aria-hidden />
                    </span>
                  </div>
                  <p className="font-display mt-3 text-sm font-bold uppercase tracking-[0.1em]">{step.title}</p>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{step.desc}</p>
                  {i < CORE_LOOP.length - 1 && (
                    <span className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-primary/50 xl:block" aria-hidden>
                      →
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ================= OPERATIONS ================= */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* today's workout */}
          <Panel title="TODAY'S WORKOUT" className="lg:col-span-2">
            {nextSession ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-display text-sm font-semibold">{nextSession.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {nextSession.status === "in_progress" ? "IN PROGRESS" : "SCHEDULED"} ·{" "}
                    {profile?.training ? `${profile.training.sessionMinutes} min target` : "time n/a"}
                  </div>
                  <div className="mt-2">
                    <AsciiBar value={nextSession.status === "in_progress" ? 0.4 : 0} />
                  </div>
                </div>
                <Button
                  asChild
                  className="rounded-xl bg-primary text-[11px] font-bold uppercase tracking-[0.14em] text-primary-foreground shadow-[0_0_18px_var(--neon-glow)] hover:brightness-110"
                >
                  <Link to="/workout">
                    {nextSession.status === "in_progress" ? "RESUME →" : "START →"}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {plan
                    ? "All scheduled sessions done. Rest or ask the coach for extra work."
                    : "No active plan. Generate one from your profile in one click."}
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-xl border-primary/30 bg-transparent text-[11px] font-semibold uppercase tracking-[0.14em] text-[#dcff8a] hover:bg-primary/10"
                >
                  <Link to="/workout?generate=1">OPEN WORKOUT ENGINE →</Link>
                </Button>
              </div>
            )}
          </Panel>

          {/* goal progress */}
          <Panel title="GOAL PROGRESS">
            <div className="space-y-3">
              <StatChip label="ADHERENCE (LAST SESSIONS)" value={`${Math.round(adherence * 100)}%`} tone="ok" />
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>TARGET</span>
                  <span className="text-foreground">{goal?.targetDate ?? "NOT SET"}</span>
                </div>
                <div className="flex justify-between">
                  <span>ACTIVE PLAN</span>
                  <span className="text-foreground">{plan ? plan.daysPerWeek + "D/WK" : "NONE"}</span>
                </div>
                <div className="flex justify-between">
                  <span>WORKOUTS DONE</span>
                  <span className="text-foreground">{completedCount}</span>
                </div>
              </div>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full rounded-xl border-border text-[10px] uppercase tracking-[0.14em] hover:border-primary/30 hover:text-[#dcff8a]"
              >
                <Link to="/profile">VIEW FULL PROFILE →</Link>
              </Button>
            </div>
          </Panel>
        </div>

        {/* coach message */}
        <Panel title="COACH MESSAGE" subtitle="contextual — built from your live profile data">
          <p className="text-sm leading-6">{coachLine}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              asChild
              size="sm"
              className="rounded-lg bg-primary text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground hover:brightness-110"
            >
              <Link to="/coach">OPEN COACH CHAT →</Link>
            </Button>
            {latestConversation && (
              <span className="self-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                LAST SESSION: {new Date(latestConversation.lastMessageAt).toLocaleString()}
              </span>
            )}
          </div>
        </Panel>

        {/* quick actions */}
        <Panel title="QUICK ACTIONS">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className="glass-soft lift rounded-lg px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/90 transition-all hover:border-primary/40 hover:text-[#dcff8a] hover:shadow-[0_0_14px_rgba(163,230,53,0.12)]"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* recent activity */}
          <Panel title="RECENT ACTIVITY">
            {sessions && sessions.length > 0 ? (
              <div className="space-y-1.5">
                {sessions.slice(0, 5).map((s) => (
                  <div key={s._id} className="flex items-center justify-between border-b border-border/60 py-1.5 text-xs last:border-0">
                    <span>{s.name}</span>
                    <span className="flex items-center gap-2">
                      <TerminalBadge tone={s.status === "completed" ? "ok" : s.status === "in_progress" ? "warn" : "ink"}>
                        {s.status}
                      </TerminalBadge>
                      {s.completedAt && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(s.completedAt).toLocaleDateString()}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No sessions logged yet.</p>
            )}
          </Panel>

          {/* notifications + memory */}
          <Panel title="EVENT MEMORY / NOTIFICATIONS">
            <div className="space-y-1.5">
              {(notifications ?? []).slice(0, 3).map((n) => (
                <div key={n._id} className="border-b border-border/60 py-1.5 text-xs last:border-0">
                  <span className="font-semibold">{n.title}</span>
                  <span className="text-muted-foreground"> — {n.body}</span>
                </div>
              ))}
              {(memory ?? []).slice(0, 4).map((m) => (
                <div key={m._id} className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 text-xs last:border-0">
                  <span className="text-muted-foreground">{m.content}</span>
                  <TerminalBadge tone={m.scope === "event" ? "info" : "ink"}>{m.scope}</TerminalBadge>
                </div>
              ))}
              {!notifications?.length && !memory?.length && (
                <p className="text-xs text-muted-foreground">No events yet — they appear as you train.</p>
              )}
            </div>
          </Panel>
        </div>

        <SectionHeader index="→" title="MODULE MAP" hint="all 12 modules live" />
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          CORE · COACH · WORKOUT · NUTRITION · PROGRESS · CHECK-IN · GOALS · BODYBUILDING · SUPPLEMENTS · PRODUCTS · REPORTS · SETTINGS &amp; PLAN
        </p>
      </div>
    </AppShell>
  );
}
