import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Panel, StatChip, TerminalBadge, AsciiBar, StatusDot, SectionHeader } from "@/components/terminal";
import { AIFitnessRobot } from "@/components/ai-fitness-robot";
import { CoachAvatar } from "@/components/coach-avatar";
import { CoachJourneyCard } from "@/components/coach-journey-card";
import { coachAccent, coachCardGradient } from "@/lib/coach-media";
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
  ClipboardList,
  Crown,
  Dumbbell,
  FileText,
  Flame,
  Heart,
  Medal,
  MessageSquare,
  Pill,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  User,
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
  { icon: User, title: "Understand", desc: "Know your goal, body & lifestyle", color: "#6495ed" },
  { icon: ClipboardList, title: "Assess", desc: "Analyze your current status", color: "#66d9ef" },
  { icon: FileText, title: "Plan", desc: "Create personalized workout & diet", color: "#a3e635" },
  { icon: MessageSquare, title: "Coach", desc: "Get real-time guidance", color: "#f0b429" },
  { icon: TrendingUp, title: "Track", desc: "Monitor progress every day", color: "#c084fc" },
  { icon: Target, title: "Adapt", desc: "Adjust and improve based on results", color: "#f87171" },
] as const;

const COACH_META: Record<string, { specialty: string; icon: IconType }> = {
  arjun: { specialty: "Strength & Muscle", icon: Dumbbell },
  veer: { specialty: "Fat Loss", icon: Flame },
  aarav: { specialty: "Nutrition Coach", icon: Apple },
  kabir: { specialty: "Bodybuilding", icon: Trophy },
  rhea: { specialty: "Women's Fitness", icon: Heart },
  rudra: { specialty: "Competition Prep", icon: Medal },
  max: { specialty: "Beginner Fitness", icon: Sparkles },
  athena: { specialty: "Supplement Intel", icon: Pill },
  "coach prime": { specialty: "Advanced Coaching", icon: Crown },
};

type IconType = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

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
  icon: Icon,
  chart = "none",
}: {
  label: string;
  value: string;
  sub?: string;
  bar?: number;
  to: string;
  icon: IconType;
  chart?: "bar" | "ring" | "none";
}) {
  const pct = typeof bar === "number" ? Math.max(0, Math.min(1, bar)) : 0;
  return (
    <Link
      to={to}
      className="glass-soft lift group block rounded-xl px-3 py-2.5 hover:border-primary/30 hover:shadow-[0_0_18px_rgba(163,230,53,0.14)]"
    >
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary shadow-[0_0_10px_rgba(163,230,53,0.16)]">
          <Icon className="size-3.5" />
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground group-hover:text-[#dcff8a]">
          {label}
        </span>
        <ArrowRight className="ml-auto size-3 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="font-display text-lg font-bold leading-none text-[#dcff8a]">{value}</p>
        {chart === "bar" && (
          <svg viewBox="0 0 56 20" className="h-5 w-14 shrink-0" aria-hidden>
            {[0.35, 0.55, 0.45, 0.7, 0.55, 0.85, 1].map((h, i) => {
              const height = 5 + h * (4 + pct * 11);
              return (
                <rect
                  key={i}
                  x={i * 7.6 + 1}
                  y={20 - height}
                  width="5.4"
                  height={height}
                  rx="1.5"
                  fill="var(--terminal-green)"
                  opacity={0.3 + i * 0.1}
                />
              );
            })}
          </svg>
        )}
        {chart === "ring" && (
          <svg viewBox="0 0 36 36" className="size-6 shrink-0" aria-hidden>
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--terminal-green)" strokeOpacity="0.18" strokeWidth="4" />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="var(--terminal-green)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${pct * 88} 88`}
              transform="rotate(-90 18 18)"
            />
          </svg>
        )}
      </div>
      {sub && <p className="mt-1.5 truncate text-[10px] text-muted-foreground">{sub}</p>}
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
  const assignCoach = useMutation(api.coachJourney.assignCoach);

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
      const res = await assignCoach({ personaId });
      toast.success(`${res.coachTitle} ${res.name} is now your AI Fitness Coach`, {
        description: "Opening your coaching session…",
      });
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
            className="pointer-events-none absolute inset-0 opacity-80"
            aria-hidden
            style={{
              background:
                "radial-gradient(640px 320px at 86% 18%, rgba(163,230,53,0.13), transparent 62%), radial-gradient(520px 300px at 12% 92%, rgba(103,232,249,0.06), transparent 62%)",
            }}
          />
          <div className="relative grid gap-0 xl:grid-cols-[1fr_minmax(300px,0.9fr)_184px]">
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
                  className="group h-11 rounded-xl bg-gradient-to-r from-[#a3e635] to-[#65d413] px-6 text-sm font-bold uppercase tracking-[0.12em] text-[#0a1205] shadow-[0_0_24px_var(--neon-glow)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
                >
                  <Link to="/workout?generate=1">
                    <Play className="mr-2 size-4 fill-current" aria-hidden />
                    Get Started
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
                    <span className="flex size-8 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary shadow-[0_0_10px_rgba(163,230,53,0.15)]">
                      <f.icon className="size-3.5" aria-hidden />
                    </span>
                    <span className="max-w-[130px] leading-4">{f.label}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* --- right: the AI robot --- */}
            <div className="relative mx-auto h-[300px] w-full max-w-[420px] sm:h-[400px] xl:h-full xl:max-w-none">
              {/* HUD rings behind the robot */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
                <div className="size-[280px] rounded-full border border-primary/15 sm:size-[360px]" />
                <div className="absolute size-[210px] rounded-full border border-dashed border-primary/20 animate-[spin-slow_26s_linear_infinite] sm:size-[280px]" />
                <div className="absolute size-[330px] rounded-full border-t border-primary/25 sm:size-[430px]" />
              </div>

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
              <AIFitnessRobot state="idle" photoSrc="/robot-hero.png" className="relative h-full w-full" />
            </div>

            {/* --- far right: live HUD (real data) --- */}
            <div className="hidden flex-col justify-center gap-2.5 p-4 xl:flex">
              <HudPanel
                icon={Dumbbell}
                label="Workout"
                value={`${Math.round(adherence * 100)}%`}
                bar={adherence}
                chart="bar"
                sub={nextSession ? nextSession.name : plan ? "rest day — plan active" : "no active plan"}
                to="/workout"
              />
              <HudPanel icon={Apple} label="Nutrition" value="LOG" sub="daily intake" chart="none" to="/nutrition" />
              <HudPanel
                icon={TrendingUp}
                label="Progress"
                value={`${completedCount}`}
                bar={Math.min(completedCount / 6, 1)}
                chart="bar"
                sub="sessions done"
                to="/progress"
              />
              <HudPanel icon={Pill} label="Supplements" value="SCAN" sub="verify labels" chart="none" to="/supplements" />
              <HudPanel
                icon={Target}
                label="Goals"
                value={daysLeft !== null ? `${daysLeft}d` : "—"}
                bar={adherence}
                chart="ring"
                sub={goal ? "to target" : "set a goal"}
                to="/goals"
              />
            </div>
          </div>

          {/* HUD row for smaller screens (same real data) */}
          <div className="grid grid-cols-2 gap-2 border-t border-border/60 p-3 sm:grid-cols-4 xl:hidden">
            <HudPanel
              icon={Dumbbell}
              label="Workout"
              value={`${Math.round(adherence * 100)}%`}
              bar={adherence}
              chart="bar"
              to="/workout"
            />
            <HudPanel icon={TrendingUp} label="Progress" value={`${completedCount}`} sub="sessions done" to="/progress" />
            <HudPanel
              icon={Target}
              label="Goals"
              value={daysLeft !== null ? `${daysLeft}d` : "—"}
              bar={adherence}
              chart="ring"
              sub={goal ? "to target" : "set a goal"}
              to="/goals"
            />
            <HudPanel icon={Pill} label="Supplements" value="SCAN" sub="verify labels" to="/supplements" />
          </div>
        </section>

        {/* ================= YOUR AI COACH / JOURNEY ================= */}
        <CoachJourneyCard />

        {/* ================= CHOOSE YOUR AI COACH ================= */}
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display flex items-center gap-2.5 text-lg font-bold">
                <span className="h-5 w-1 rounded-full bg-primary shadow-[0_0_10px_var(--neon-glow)]" aria-hidden />
                Choose Your AI Coach
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">9 Expert Coaches Online</p>
              <Link
                to="/coach"
                className="glass-soft lift rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/90 hover:border-primary/30 hover:text-[#dcff8a]"
              >
                View All →
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
            {personas === undefined
              ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-44 rounded-xl" />)
              : personas.map((p) => {
                  const meta = COACH_META[p.name.toLowerCase()] ?? {
                    specialty: "AI Fitness Coach",
                    icon: Sparkles,
                  };
                  const SpecialtyIcon = meta.icon;
                  const accent = coachAccent(p.name);
                  return (
                    <div
                      key={p._id}
                      style={
                        {
                          background: coachCardGradient(accent),
                          borderColor: `${accent}55`,
                          "--coach-glow": `${accent}44`,
                        } as React.CSSProperties
                      }
                      className="lift group relative overflow-hidden rounded-xl border bg-card/70 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_26px_var(--coach-glow)]"
                    >
                      <div className="flex flex-col items-center px-3 pb-3 pt-5 text-center">
                        <CoachAvatar
                          name={p.name}
                          accent={accent}
                          className="mb-3 transition-all duration-300 group-hover:shadow-[0_0_22px_var(--coach-glow)]"
                        />
                        <p className="font-display text-sm font-bold uppercase tracking-[0.08em]">{p.name}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                          <SpecialtyIcon className="size-3" style={{ color: accent }} aria-hidden />
                          <span className="line-clamp-1">{meta.specialty}</span>
                        </p>
                        <p className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium text-status-ok">
                          <StatusDot pulse /> Online
                        </p>
                        <button
                          onClick={() => selectCoach(p._id)}
                          className="mt-3 w-full rounded-lg border border-primary/30 bg-primary/10 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#dcff8a] transition-all duration-200 hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_16px_var(--neon-glow)] focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
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
            </div>
            <div className="flex items-center gap-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                From Understanding to Transformation
              </p>
              <Link
                to="/coach"
                className="glass-soft lift rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/90 hover:border-primary/30 hover:text-[#dcff8a]"
              >
                Learn More →
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {CORE_LOOP.map((step, i) => (
              <div
                key={step.title}
                style={
                  {
                    borderColor: `${step.color}55`,
                    background: `linear-gradient(170deg, ${step.color}1f, #0b0f0b 70%)`,
                    "--step-glow": `${step.color}44`,
                  } as React.CSSProperties
                }
                className="lift group relative overflow-hidden rounded-xl border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_22px_var(--step-glow)]"
              >
                <div className="flex items-center justify-between">
                  <span
                    style={{ borderColor: `${step.color}88`, color: step.color }}
                    className="flex size-8 items-center justify-center rounded-full border font-display text-sm font-bold"
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{ color: step.color, borderColor: `${step.color}44` }}
                    className="flex size-9 items-center justify-center rounded-lg border bg-[#0b0f0b]/80"
                  >
                    <step.icon className="size-[18px]" aria-hidden />
                  </span>
                </div>
                <p className="font-display mt-3 text-sm font-bold uppercase tracking-[0.1em]">{step.title}</p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{step.desc}</p>
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
                  className="rounded-xl bg-gradient-to-r from-[#a3e635] to-[#65d413] text-[11px] font-bold uppercase tracking-[0.14em] text-[#0a1205] shadow-[0_0_18px_var(--neon-glow)] hover:brightness-110"
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
              className="rounded-lg bg-gradient-to-r from-[#a3e635] to-[#65d413] text-[10px] font-bold uppercase tracking-[0.14em] text-[#0a1205] hover:brightness-110"
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
                className={cn(
                  "glass-soft lift rounded-lg px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/90 transition-all",
                  "hover:border-primary/40 hover:text-[#dcff8a] hover:shadow-[0_0_14px_rgba(163,230,53,0.12)]",
                )}
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
