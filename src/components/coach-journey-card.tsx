import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { Play, Target, Trophy } from "lucide-react";
import { CoachAvatar } from "@/components/coach-avatar";
import { CoachAssignedFlash } from "@/components/coach-assigned-flash";
import { Button } from "@/components/ui/button";
import { coachAccent } from "@/lib/coach-media";
import { coachFullName } from "@/lib/coach-voice";

/**
 * <CoachJourneyCard /> — the personalized dashboard welcome card. Every value
 * (user name, coach, current day, today's focus) is read from the persisted
 * journey + real plan data. Also shows the one-time COACH ASSIGNED flash.
 */
export function CoachJourneyCard() {
  const journey = useQuery(api.coachJourney.getJourney);
  const markShown = useMutation(api.coachJourney.markCoachWelcomeShown);
  const startJourney = useMutation(api.coachJourney.startJourney);
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  if (journey === undefined || journey === null || !journey.hasCoach) return null;

  const coach = journey.coach!;
  const accent = coachAccent(coach.name);
  const full = coachFullName(coach.name);

  async function dismissFlash() {
    await markShown({}).catch(() => undefined);
  }

  async function startToday() {
    setStarting(true);
    try {
      await markShown({}).catch(() => undefined);
      await startJourney({});
      navigate("/journey");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start today's motivation");
      setStarting(false);
    }
  }

  return (
    <div className="space-y-4">
      {!journey.coachWelcomeShown && (
        <CoachAssignedFlash
          coachName={coach.name}
          userName={journey.userName}
          coachTitle={journey.coachTitle}
          onDismiss={dismissFlash}
        />
      )}

      <section
        style={{ borderColor: `${accent}3d`, "--coach-glow": `${accent}2e` } as React.CSSProperties}
        className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[#0d130c] via-[#0a0e0a] to-[#070a07] p-5 shadow-[0_0_22px_var(--coach-glow)] sm:p-6"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          aria-hidden
          style={{ background: `radial-gradient(520px 240px at 86% 6%, ${accent}1a, transparent 62%)` }}
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <CoachAvatar name={coach.name} accent={accent} className="size-16" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Welcome, <span className="font-semibold text-foreground">{journey.userName}</span>
              </p>
              <p className="font-display mt-1 text-lg font-bold uppercase tracking-[0.05em]">{full}</p>
              <p className="text-[11px] text-muted-foreground">{coach.role}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[380px]">
            <div className="glass-soft rounded-xl px-4 py-3">
              <p className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                <Trophy className="size-3.5 text-primary" aria-hidden /> Current Journey
              </p>
              <p className="font-display mt-1 text-base font-bold text-[#dcff8a]">
                DAY {journey.currentDay}
              </p>
            </div>
            <div className="glass-soft rounded-xl px-4 py-3">
              <p className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                <Target className="size-3.5 text-primary" aria-hidden /> Today&apos;s Focus
              </p>
              <p className="font-display mt-1 truncate text-base font-bold">{journey.todayFocus}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={startToday}
              disabled={starting}
              className="h-11 rounded-xl bg-gradient-to-r from-[#a3e635] to-[#65d413] px-5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0a1205] shadow-[0_0_20px_var(--neon-glow)] hover:brightness-110"
            >
              <Play className="mr-2 size-4 fill-current" aria-hidden />
              {starting ? "Starting…" : "Start Today's Motivation"}
            </Button>
            <Link
              to="/journey"
              className="glass-soft lift inline-flex h-11 items-center rounded-xl px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/90 hover:border-primary/30 hover:text-[#dcff8a]"
            >
              View Journey →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
