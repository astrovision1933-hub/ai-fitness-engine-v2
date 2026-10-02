import { useAuth } from "@/hooks/use-auth";
import { AIFitnessRobot } from "@/components/ai-fitness-robot";
import { CoachAvatar } from "@/components/coach-avatar";
import { coachAccent, coachCardGradient } from "@/lib/coach-media";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Apple,
  ArrowRight,
  Bot,
  Brain,
  ClipboardList,
  Dumbbell,
  Gauge,
  MessageSquare,
  Pill,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";

const COACHES = [
  { name: "ARJUN", spec: "Strength & Muscle" },
  { name: "VEER", spec: "Fat Loss" },
  { name: "AARAV", spec: "Nutrition Coach" },
  { name: "KABIR", spec: "Bodybuilding" },
  { name: "RHEA", spec: "Women's Fitness" },
  { name: "RUDRA", spec: "Competition Prep" },
  { name: "MAX", spec: "Beginner Fitness" },
  { name: "ATHENA", spec: "Supplement Intel" },
  { name: "COACH PRIME", spec: "Advanced Coaching" },
];

const FEATURES = [
  {
    icon: Bot,
    title: "AI Coach That Knows You",
    desc: "A persistent memory model of your body, schedule, diet and equipment — every reply is built on your real data.",
  },
  {
    icon: Dumbbell,
    title: "Smart Workout Engine",
    desc: "Personalized plans that adapt as you train, with session tracking and auto-progression.",
  },
  {
    icon: Apple,
    title: "Nutrition Intelligence",
    desc: "Daily targets, meal plans and diet analysis tuned to your goal — not generic templates.",
  },
  {
    icon: Pill,
    title: "Supplement & Product Checks",
    desc: "AI label analysis, authenticity signals and product comparisons before you spend a rupee.",
  },
  {
    icon: TrendingUp,
    title: "Progress Command Deck",
    desc: "Check-ins, analytics and weekly reports that show exactly what is working.",
  },
  {
    icon: ShieldCheck,
    title: "Safety First, Always On",
    desc: "Built-in safety engine blocks extreme dieting and medical red-flag advice — 24/7.",
  },
];

const CORE_LOOP = [
  { icon: Brain, title: "Understand", desc: "Goal, body & lifestyle" },
  { icon: Gauge, title: "Assess", desc: "Analyze current status" },
  { icon: ClipboardList, title: "Plan", desc: "Personalized workout & diet" },
  { icon: MessageSquare, title: "Coach", desc: "Real-time guidance" },
  { icon: TrendingUp, title: "Track", desc: "Monitor every day" },
  { icon: RefreshCw, title: "Adapt", desc: "Improve from results" },
];

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const primaryTo = isAuthenticated ? "/dashboard" : "/auth?returnTo=/dashboard";
  const primaryLabel = isAuthenticated ? "Open Command Center" : "Get Started";

  return (
    <div className="min-h-screen bg-atmo">
      {/* top bar */}
      <header className="glass sticky top-0 z-50 border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 32 32" className="size-9 drop-shadow-[0_0_8px_var(--neon-glow)]" aria-hidden>
              <rect x="1" y="1" width="30" height="30" rx="8" fill="#0c110c" stroke="var(--terminal-green)" strokeOpacity="0.6" />
              <g fill="var(--terminal-green)">
                <rect x="9" y="8.5" width="14" height="3.2" rx="1" />
                <rect x="9" y="13.5" width="4.2" height="11" rx="1" />
                <rect x="14.5" y="15.5" width="8.5" height="3.2" rx="1" />
                <rect x="14.5" y="20.3" width="8.5" height="3.2" rx="1" />
              </g>
            </svg>
            <span className="leading-tight">
              <span className="font-display block text-[15px] font-bold tracking-wide">
                AI <span className="neon-text">FITNESS</span> ENGINE
              </span>
              <span className="block text-[9px] font-medium uppercase tracking-[0.34em] text-muted-foreground">
                Train • Track • Transform
              </span>
            </span>
          </div>
          <nav className="flex items-center gap-2.5">
            {!isLoading && isAuthenticated ? (
              <Button
                asChild
                className="h-9 rounded-xl bg-primary px-4 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground shadow-[0_0_20px_var(--neon-glow)] hover:brightness-110"
              >
                <Link to="/dashboard">Open App</Link>
              </Button>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="glass-soft lift rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground hover:border-primary/30 hover:text-[#dcff8a]"
                >
                  Sign In
                </Link>
                <Button
                  asChild
                  className="h-9 rounded-xl bg-primary px-4 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground shadow-[0_0_20px_var(--neon-glow)] hover:brightness-110"
                >
                  <Link to="/auth?returnTo=/dashboard">Start Free</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* ================= HERO ================= */}
        <section className="neon-glow relative mt-6 overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-[#0d130c] via-[#0a0e0a] to-[#070a07]">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden
            style={{
              background:
                "radial-gradient(680px 340px at 88% 15%, rgba(163,230,53,0.11), transparent 60%), radial-gradient(460px 280px at 8% 95%, rgba(103,232,249,0.06), transparent 60%)",
            }}
          />
          <div className="relative grid items-center gap-4 p-6 sm:p-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#dcff8a]">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
                System Online — 24/7 Coaching Engine
              </p>
              <h1 className="font-display mt-5 text-4xl font-bold leading-[1.03] sm:text-6xl">
                YOUR COACH
                <br />
                <span className="neon-text">DOESN&apos;T SLEEP.</span>
                <br />
                NEITHER DOES THE ENGINE.
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                AI Fitness Engine builds a persistent model of you — body, schedule, diet, equipment and
                goals — and helps you train, track and transform every single day.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  className="group h-12 rounded-xl bg-primary px-7 text-sm font-bold uppercase tracking-[0.12em] text-primary-foreground shadow-[0_0_26px_var(--neon-glow)] transition-all hover:-translate-y-0.5 hover:brightness-110"
                >
                  <Link to={primaryTo}>
                    {primaryLabel}
                    <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </Button>
                <a
                  href="#coaches"
                  className="glass-soft lift inline-flex h-12 items-center rounded-xl px-7 text-sm font-semibold uppercase tracking-[0.12em] text-foreground hover:border-primary/30 hover:text-[#dcff8a]"
                >
                  Explore Coaches
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
                {[
                  { icon: Zap, label: "Personalized AI Coaching" },
                  { icon: Dumbbell, label: "Smart Workout Plans" },
                  { icon: Apple, label: "Nutrition Guidance" },
                  { icon: TrendingUp, label: "Progress Tracking" },
                ].map((f) => (
                  <span key={f.label} className="flex items-center gap-2 text-[11px] font-medium text-foreground/80">
                    <span className="flex size-7 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                      <f.icon className="size-3.5" aria-hidden />
                    </span>
                    {f.label}
                  </span>
                ))}
              </div>
            </div>

            {/* the robot */}
            <div className="relative h-[320px] sm:h-[440px]">
              <div className="glass absolute left-0 top-8 z-10 max-w-[210px] rounded-2xl border border-primary/35 p-3.5 shadow-[0_0_24px_rgba(163,230,53,0.18)] sm:left-2">
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
              <AIFitnessRobot state="idle" photoSrc="/robot-hero.png" className="h-full w-full" />
            </div>
          </div>
        </section>

        {/* ================= COACHES ================= */}
        <section id="coaches" className="mt-12 scroll-mt-20">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display flex items-center gap-2.5 text-xl font-bold">
                <span className="h-5 w-1 rounded-full bg-primary shadow-[0_0_10px_var(--neon-glow)]" aria-hidden />
                Choose Your AI Coach
              </h2>
              <p className="mt-0.5 pl-3.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                9 Expert Coaches Online
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {COACHES.map((c) => {
              const accent = coachAccent(c.name);
              return (
                <div
                  key={c.name}
                  className="lift group relative overflow-hidden rounded-xl border bg-card/70 backdrop-blur-md hover:shadow-[0_0_26px_var(--coach-glow)]"
                  style={
                    {
                      background: coachCardGradient(accent),
                      borderColor: `${accent}55`,
                      "--coach-glow": `${accent}55`,
                    } as React.CSSProperties
                  }
                >
                  <div className="flex flex-col items-center px-3 pb-4 pt-5 text-center">
                    <CoachAvatar
                      name={c.name}
                      accent={accent}
                      className="mb-3 transition-shadow duration-300 group-hover:shadow-[0_0_26px_var(--coach-glow)]"
                    />
                    <p className="font-display text-sm font-bold uppercase tracking-[0.1em]">{c.name}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{c.spec}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-status-ok">
                      <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden /> Online
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================= CORE LOOP ================= */}
        <section className="mt-12">
          <div className="mb-4">
            <h2 className="font-display flex items-center gap-2.5 text-xl font-bold">
              <span className="h-5 w-1 rounded-full bg-primary shadow-[0_0_10px_var(--neon-glow)]" aria-hidden />
              The Core Loop
            </h2>
            <p className="mt-0.5 pl-3.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              From Understanding to Transformation
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {CORE_LOOP.map((step, i) => (
              <div key={step.title} className="glass-soft lift rounded-xl p-4 hover:border-primary/30">
                <div className="flex items-center justify-between">
                  <span className="font-display text-2xl font-bold text-foreground/25">{i + 1}</span>
                  <span className="flex size-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                    <step.icon className="size-[18px]" aria-hidden />
                  </span>
                </div>
                <p className="font-display mt-3 text-sm font-bold uppercase tracking-[0.1em]">{step.title}</p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ================= FEATURES ================= */}
        <section className="mt-12">
          <h2 className="font-display flex items-center gap-2.5 text-xl font-bold">
            <span className="h-5 w-1 rounded-full bg-primary shadow-[0_0_10px_var(--neon-glow)]" aria-hidden />
            One Engine. Every System.
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="glass-soft lift rounded-xl p-5 hover:border-primary/30 hover:shadow-[0_0_20px_rgba(163,230,53,0.1)]">
                <span className="flex size-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_14px_rgba(163,230,53,0.14)]">
                  <f.icon className="size-5" aria-hidden />
                </span>
                <p className="font-display mt-3.5 text-sm font-bold uppercase tracking-[0.08em]">{f.title}</p>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ================= FINAL CTA ================= */}
        <section className="neon-glow relative mt-12 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-[#0d130c] to-[#0a100a] p-8 text-center sm:p-12">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            THE ENGINE IS <span className="neon-text">WAITING.</span>
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Free plan included. Premium unlocks unlimited AI coaching, reports and product intelligence.
          </p>
          <Button
            asChild
            className="mt-6 h-12 rounded-xl bg-primary px-8 text-sm font-bold uppercase tracking-[0.12em] text-primary-foreground shadow-[0_0_26px_var(--neon-glow)] hover:-translate-y-0.5 hover:brightness-110"
          >
            <Link to={primaryTo}>{primaryLabel}</Link>
          </Button>
        </section>
      </main>

      <footer className="mt-12 border-t border-border/60 py-6">
        <p className="text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          AI Fitness Engine — Core v0.1 · Train • Track • Transform
        </p>
      </footer>
    </div>
  );
}
