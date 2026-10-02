import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { Check, Camera, CalendarClock } from "lucide-react";
import { CoachAvatar } from "@/components/coach-avatar";
import { coachAccent } from "@/lib/coach-media";
import { coachFullName } from "@/lib/coach-voice";

/**
 * <WeeklyCheckinCard /> — the coach's weekly physique check-in prompt.
 * Always optional and never blocking; skips/reminders live on the Physique page.
 */
export function WeeklyCheckinCard() {
  const state = useQuery(api.physique.getPhysiqueState);
  if (!state || !state.hasCoach || !state.coach) return null;

  const coach = state.coach;
  const accent = coachAccent(coach.name);
  const full = coachFullName(coach.name);
  const neverCheckedIn = state.counts.checkins === 0;
  const due = state.dueNow;
  const done = !neverCheckedIn && !due;

  return (
    <section
      style={{ borderColor: `${accent}3d`, "--coach-glow": `${accent}2e` } as React.CSSProperties}
      className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[#0d130c] via-[#0a0e0a] to-[#070a07] p-5 shadow-[0_0_22px_var(--coach-glow)] sm:p-6"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden
        style={{ background: `radial-gradient(520px 240px at 88% 6%, ${accent}1a, transparent 62%)` }}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <CoachAvatar name={coach.name} accent={accent} className="size-14" />
          <div>
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>
              {neverCheckedIn ? <Camera className="size-3.5" aria-hidden /> : done ? <Check className="size-3.5" aria-hidden /> : <CalendarClock className="size-3.5" aria-hidden />}
              {neverCheckedIn ? "Baseline Physique" : done ? "✓ Weekly Check-in Complete" : "Weekly Physique Check-in"}
            </p>
            <p className="font-display mt-1 text-base font-bold">
              {neverCheckedIn
                ? `${full} needs a baseline to track your transformation`
                : done
                  ? "Your latest progress has been added to your physique journey"
                  : `${full} is ready for this week's check-in`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {neverCheckedIn
                ? "Optional — upload one full-body photo or describe your physique."
                : done
                  ? `Next check-in in ${Math.max(0, state.daysUntilDue ?? 0)} day${(state.daysUntilDue ?? 0) === 1 ? "" : "s"} · physique photos stay private to you.`
                  : "Optional — skip anytime; the app keeps working."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/physique"
            className="inline-flex h-11 items-center rounded-xl bg-gradient-to-r from-[#a3e635] to-[#65d413] px-5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0a1205] shadow-[0_0_20px_var(--neon-glow)] transition-all hover:brightness-110"
          >
            {neverCheckedIn ? "Set Up Physique" : due ? "Start Check-in" : "View Journey"}
          </Link>
          {state.categoryLabel && (
            <span className="glass-soft inline-flex h-11 items-center rounded-xl px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/90">
              {state.categoryLabel}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
