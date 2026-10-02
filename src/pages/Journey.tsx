import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/AppShell";
import { Panel, TerminalBadge } from "@/components/terminal";
import { CoachAvatar } from "@/components/coach-avatar";
import { Button } from "@/components/ui/button";
import { coachAccent } from "@/lib/coach-media";
import { coachFullName } from "@/lib/coach-voice";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Check, CircleDashed, Flame, Play, Target } from "lucide-react";
import { Link } from "react-router";

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Journey() {
  const journey = useQuery(api.coachJourney.getJourney);
  const refreshToday = useMutation(api.coachJourney.refreshToday);
  const startJourney = useMutation(api.coachJourney.startJourney);
  const completeToday = useMutation(api.coachJourney.completeTodayMission);
  const [completing, setCompleting] = useState(false);

  // Sync today's mission from real plan data, and make sure the journey is running.
  useEffect(() => {
    if (journey === undefined || journey === null || !journey.hasCoach) return;
    refreshToday({}).catch(() => undefined);
    if (!journey.journeyStarted) {
      startJourney({}).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey?.hasCoach, journey?.journeyStarted]);

  async function handleComplete() {
    setCompleting(true);
    try {
      const res = await completeToday({});
      toast.success(`Day ${res.completedDay} complete`, {
        description: `Day ${res.nextDay} is ready for you.`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not complete mission");
    } finally {
      setCompleting(false);
    }
  }

  if (journey === undefined || journey === null) {
    return (
      <AppShell>
        <div className="space-y-3">
          <div className="skeleton h-40 rounded-2xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!journey.hasCoach) {
    return (
      <AppShell>
        <Panel title="YOUR AI COACH" subtitle="no coach assigned yet">
          <p className="text-sm text-muted-foreground">
            Choose your AI Coach to start your personalized motivational journey.
          </p>
          <Button asChild className="mt-3 rounded-lg text-[11px] font-bold uppercase tracking-[0.14em]">
            <Link to="/dashboard">CHOOSE MY COACH →</Link>
          </Button>
        </Panel>
      </AppShell>
    );
  }

  const coach = journey.coach!;
  const accent = coachAccent(coach.name);
  const full = coachFullName(coach.name);
  const day = journey.motivationDay;
  const completedDays = journey.completedDays ?? [];
  const greeting = greetingFor(new Date().getHours());
  const mission = day?.mission ?? [];
  const doneToday = completedDays.includes(journey.currentDay);

  return (
    <AppShell>
      <div className="space-y-5">
        {/* ================= DAILY COACH CHECK-IN ================= */}
        <section
          style={{ borderColor: `${accent}44`, "--coach-glow": `${accent}33` } as React.CSSProperties}
          className="anim-rise-in relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[#0d130c] via-[#0a0e0a] to-[#070a07] p-5 shadow-[0_0_26px_var(--coach-glow)] sm:p-6"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            aria-hidden
            style={{ background: `radial-gradient(560px 260px at 88% 8%, ${accent}1c, transparent 62%)` }}
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <CoachAvatar name={coach.name} accent={accent} className="size-16" />
              <div>
                <p className="text-sm text-muted-foreground">
                  {greeting}, <span className="font-semibold text-foreground">{journey.userName}</span> 👋
                </p>
                <p className="font-display mt-1 text-lg font-bold uppercase tracking-[0.04em]">
                  {journey.coachTitle} {coach.name} here.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Today is <span className="text-status-ok">Day {journey.currentDay}</span> of your fitness
                  journey · {coach.role}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TerminalBadge tone="ok">AI COACH — NOT A HUMAN</TerminalBadge>
              <Button
                asChild
                className="h-11 rounded-xl bg-gradient-to-r from-[#a3e635] to-[#65d413] px-5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0a1205] shadow-[0_0_20px_var(--neon-glow)] hover:brightness-110"
              >
                <Link to="/workout">
                  <Play className="mr-2 size-4 fill-current" aria-hidden />
                  Start Today&apos;s Session
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative mt-5 grid gap-3 sm:grid-cols-2">
            <div className="glass-soft rounded-xl px-4 py-3">
              <p className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                <Target className="size-3.5 text-primary" aria-hidden /> Today&apos;s Focus
              </p>
              <p className="font-display mt-1 text-base font-bold text-[#dcff8a]">{journey.todayFocus}</p>
            </div>
            <div className="glass-soft rounded-xl px-4 py-3">
              <p className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                <Flame className="size-3.5 text-primary" aria-hidden /> Journey Progress
              </p>
              <p className="font-display mt-1 text-base font-bold">
                {completedDays.length} <span className="text-xs font-medium text-muted-foreground">days completed</span>
              </p>
            </div>
          </div>

          <p className="relative mt-4 text-sm italic leading-6 text-muted-foreground">
            “Are you ready? {day?.coachIntro}”
          </p>
        </section>

        {/* ================= TODAY'S MISSION ================= */}
        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel
            title={`DAY ${day?.day ?? journey.currentDay} — ${day?.phase ?? "JOURNEY"}`}
            subtitle="motivational course · personalized from your real plan"
          >
            <h2 className="font-display text-xl font-bold leading-snug">{day?.title}</h2>
            <p className="mt-3 text-sm leading-6 text-foreground/90">{day?.lesson}</p>

            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Today&apos;s Mission
            </p>
            <ul className="mt-2 space-y-2">
              {mission.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <CircleDashed className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span className="leading-5">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 border-t border-border/60 pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Motivation
              </p>
              <p className="mt-1.5 text-sm italic leading-6" style={{ color: accent }}>
                “{day?.motivation}”
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                onClick={handleComplete}
                disabled={completing || doneToday}
                className={cn(
                  "h-11 rounded-xl bg-gradient-to-r from-[#a3e635] to-[#65d413] px-5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0a1205] shadow-[0_0_20px_var(--neon-glow)] hover:brightness-110",
                  doneToday && "opacity-70",
                )}
              >
                <Check className="mr-2 size-4" aria-hidden />
                {doneToday ? "Day Complete" : "Complete Today's Mission"}
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-xl border-primary/30 bg-transparent text-[11px] font-semibold uppercase tracking-[0.14em] text-[#dcff8a] hover:bg-primary/10"
              >
                <Link to="/coach">Ask {full} →</Link>
              </Button>
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel title="YOUR AI COACH">
              <div className="flex items-center gap-3">
                <CoachAvatar name={coach.name} accent={accent} className="size-14" />
                <div>
                  <p className="font-display text-sm font-bold uppercase tracking-[0.06em]">{full}</p>
                  <p className="text-[11px] text-muted-foreground">{coach.role}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-status-ok">
                    <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden /> YOUR PERSONAL AI FITNESS COACH
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{coach.philosophy}</p>
              <Button asChild variant="outline" size="sm" className="mt-3 w-full rounded-lg text-[10px] uppercase tracking-[0.14em]">
                <Link to="/coach">Change Coach →</Link>
              </Button>
            </Panel>

            <Panel title="JOURNEY TIMELINE" subtitle="days you have completed">
              <div className="flex flex-wrap gap-1.5">
                {completedDays.length === 0 && (
                  <p className="text-xs text-muted-foreground">Complete today&apos;s mission to begin your timeline.</p>
                )}
                {completedDays.map((d) => (
                  <span
                    key={d}
                    style={{ borderColor: `${accent}66`, color: accent, background: `${accent}14` }}
                    className="flex size-8 items-center justify-center rounded-lg border font-display text-xs font-bold"
                  >
                    {d}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                The course continues past Day 7 — same principles, higher standard.
              </p>
            </Panel>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
