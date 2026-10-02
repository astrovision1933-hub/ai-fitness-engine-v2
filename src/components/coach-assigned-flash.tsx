import { Check, X } from "lucide-react";
import { CoachAvatar } from "@/components/coach-avatar";
import { coachAccent } from "@/lib/coach-media";
import { cn } from "@/lib/utils";

/**
 * <CoachAssignedFlash /> — the premium, ONE-TIME "✓ COACH ASSIGNED"
 * notification shown right after a user is first assigned an AI coach.
 * Deliberately subtle: a single soft reveal, no looping motion.
 */
export function CoachAssignedFlash({
  coachName,
  userName,
  coachTitle,
  onDismiss,
  className,
}: {
  coachName: string;
  userName: string;
  coachTitle: string;
  onDismiss: () => void;
  className?: string;
}) {
  const accent = coachAccent(coachName);
  return (
    <div
      style={{ borderColor: `${accent}55`, "--coach-glow": `${accent}40` } as React.CSSProperties}
      className={cn(
        "anim-flash-in relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[#0d130c] via-[#0a0e0a] to-[#070a07] p-4 shadow-[0_0_28px_var(--coach-glow)] sm:p-5",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden
        style={{ background: `radial-gradient(420px 200px at 12% 0%, ${accent}18, transparent 60%)` }}
      />
      <div className="relative flex items-start gap-3.5">
        <span
          style={{ borderColor: `${accent}66`, color: accent, background: `${accent}1a` }}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border"
        >
          <Check className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.24em]" style={{ color: accent }}>
            ✓ Coach Assigned
          </p>
          <p className="mt-1 text-sm text-foreground">
            Welcome <span className="font-semibold">{userName}</span>!
          </p>
          <div className="mt-2.5 flex items-center gap-3">
            <CoachAvatar name={coachName} accent={accent} className="size-11" />
            <div className="min-w-0">
              <p className="font-display text-sm font-bold uppercase tracking-[0.06em]">
                {coachTitle} {coachName}
              </p>
              <p className="text-[11px] text-muted-foreground">is now your AI Fitness Coach</p>
            </div>
          </div>
          <p className="mt-2.5 text-xs italic leading-5 text-muted-foreground">
            “Let&apos;s build your stronger version, one day at a time.”
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss coach assignment notice"
          className="shrink-0 rounded-lg border border-border/70 p-1 text-muted-foreground transition-colors hover:border-primary/40 hover:text-[#dcff8a]"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
