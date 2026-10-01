import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/terminal";

const CORE_LOOP = ["UNDERSTAND", "ASSESS", "PLAN", "COACH", "TRACK", "ADAPT"];

const COACHES = [
  { name: "ARJUN", role: "STRENGTH & MUSCLE" },
  { name: "VEER", role: "FAT LOSS" },
  { name: "AARAV", role: "NUTRITION" },
  { name: "KABIR", role: "BODYBUILDING" },
  { name: "RHEA", role: "WOMEN'S FITNESS" },
  { name: "RUDRA", role: "COMPETITION PREP" },
  { name: "MAX", role: "BEGINNER FITNESS" },
  { name: "ATHENA", role: "SUPPLEMENT INTELLIGENCE" },
  { name: "COACH PRIME", role: "ADVANCED COACHING" },
];

const FEATURES = [
  {
    id: "01",
    title: "PERSISTENT FITNESS PROFILE",
    body: "Your body, schedule, equipment, diet pattern and lifestyle — structured data, not chat scrap.",
  },
  {
    id: "02",
    title: "INTENT + CONTEXT ENGINES",
    body: "Every message is classified and answered with your real profile, goal, plan and history loaded.",
  },
  {
    id: "03",
    title: "STRUCTURED ASSESSMENT",
    body: "Onboarding ends with a full analysis: starting point, obstacles, strategy, tracking metrics.",
  },
  {
    id: "04",
    title: "WORKOUT ENGINE",
    body: "Plans generated from your goal, days, equipment and time. Log sets, weights, reps per session.",
  },
  {
    id: "05",
    title: "SAFETY FOUNDATION",
    body: "Dangerous protocols are refused before the AI even runs. No diagnosis. No PED protocols.",
  },
  {
    id: "06",
    title: "STRUCTURED MEMORY",
    body: "Short-term conversation, long-term profile, event log of workouts and goal changes.",
  },
];

const SYSTEM_LINES = [
  "> intent engine ......... ONLINE",
  "> context engine ........ ONLINE",
  "> assessment service .... READY",
  "> workout engine ........ READY",
  "> safety layer .......... ARMED",
  "> memory architecture ... 4 SCOPES",
];

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const primaryHref = isAuthenticated ? "/dashboard" : "/auth";
  const primaryLabel = isAuthenticated ? "OPEN CONSOLE →" : "INITIALIZE ACCOUNT →";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-background"
    >
      {/* top bar */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="border border-terminal-green/50 bg-[#eef3ea] px-1.5 py-0.5 text-[11px] font-bold tracking-[0.2em] text-status-ok">
              AFE
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.22em]">AI Fitness Engine</span>
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && isAuthenticated ? (
              <Button asChild size="sm" className="text-[11px] uppercase tracking-[0.14em]">
                <Link to="/dashboard">Open console</Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="text-[11px] uppercase tracking-[0.14em]">
                <Link to="/auth">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="scanline-grid border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-4 text-[11px] uppercase tracking-[0.3em] text-muted-foreground"
          >
            <StatusDot pulse /> SYSTEM ONLINE — 24/7 COACHING ENGINE
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl"
          >
            YOUR COACH DOESN'T SLEEP.
            <span className="block text-status-ok terminal-cursor">NEITHER DOES THE ENGINE.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26 }}
            className="mt-6 max-w-xl text-sm leading-6 text-muted-foreground"
          >
            AI Fitness Engine is not a chatbot with a gym sticker. It builds a persistent model of
            you — body, schedule, equipment, diet — then coaches, plans and tracks against it.
            Every reply runs through intent, context and safety layers first.
          </motion.p>

          {/* boot readout */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34 }}
            className="mt-8 border border-border bg-card p-4 font-mono text-[11px] leading-5 text-muted-foreground sm:text-xs"
          >
            {SYSTEM_LINES.map((line) => (
              <div key={line} className="flex justify-between gap-6">
                <span>{line.split(" ....")[0] + " ...."}</span>
                <span className="text-status-ok">{line.split(".... ")[1]}</span>
              </div>
            ))}
          </motion.div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="text-xs uppercase tracking-[0.18em]">
              <Link to={primaryHref}>{primaryLabel}</Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-xs uppercase tracking-[0.18em]"
              onClick={() => navigate("/coach")}
            >
              PREVIEW COACH →
            </Button>
            <span className="text-[11px] text-muted-foreground">email code sign-in · guest mode</span>
          </div>
        </div>
      </section>

      {/* core loop */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="mb-6 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">THE CORE LOOP</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
            {CORE_LOOP.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <span className="border border-terminal-green/40 bg-[#eef3ea] px-2.5 py-1.5 text-xs font-bold tracking-[0.18em] text-status-ok">
                  {step}
                </span>
                {i < CORE_LOOP.length - 1 && <span className="text-status-ok">↓</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* coach roster */}
      <section className="border-b border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="mb-6 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            COACH ROSTER — 9 PERSONAS ONLINE
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {COACHES.map((coach) => (
              <div key={coach.name} className="border border-border bg-card px-3 py-3">
                <div className="text-[11px] font-bold tracking-[0.14em]">{coach.name}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {coach.role}
                </div>
                <div className="mt-2 text-[10px] text-status-ok">● READY</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* features */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="mb-6 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            ENGINE MODULES — PART 1
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.id} className="border border-border bg-card p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-bold tracking-[0.14em]">{f.title}</span>
                  <span className="text-status-ok">{f.id}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* final CTA */}
      <section className="scanline-grid">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            BOOT THE ENGINE. <span className="text-status-ok">RUN THE LOOP.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Seven-step onboarding. Structured assessment. A plan built on your real constraints.
          </p>
          <Button asChild size="lg" className="mt-6 text-xs uppercase tracking-[0.18em]">
            <Link to={primaryHref}>{primaryLabel}</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <span>AI FITNESS ENGINE — PART 1/4 · CORE PLATFORM + AI COACH</span>
          <span>
            AI PERSONAS — NOT REAL HUMANS · NO MEDICAL ADVICE
          </span>
        </div>
      </footer>
    </motion.div>
  );
}
