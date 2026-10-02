import { Check, MessageSquare, Play } from "lucide-react";
import { CoachAvatar } from "@/components/coach-avatar";
import { Button } from "@/components/ui/button";
import { TerminalBadge } from "@/components/terminal";
import { coachAccent } from "@/lib/coach-media";
import { coachFullName } from "@/lib/coach-voice";

/**
 * <CoachWelcomeScreen /> — the personalized first-time sequence shown right
 * after profile setup saves: the one-time COACH ASSIGNED flash, the dynamic
 * "MR./MS. X is now your AI Fitness Coach" welcome, and the "YOUR PROFILE HAS
 * BEEN SAVED" confirmation with the [ASK X] and [START MY JOURNEY] CTAs.
 * Every name comes from the assigned coach + real profile — none is hard-coded.
 */
export function CoachWelcomeScreen({
  userName,
  coachName,
  coachTitle,
  onAskCoach,
  onStartJourney,
  starting,
}: {
  userName: string;
  coachName: string;
  coachTitle: string;
  onAskCoach: () => void;
  onStartJourney: () => void;
  starting?: boolean;
}) {
  const accent = coachAccent(coachName);
  const full = coachFullName(coachName);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        aria-hidden
        style={{
          background:
            "radial-gradient(680px 340px at 50% 0%, rgba(163,230,53,0.14), transparent 62%), radial-gradient(520px 300px at 12% 92%, rgba(103,232,249,0.06), transparent 62%)",
        }}
      />
      <div className="relative mx-auto max-w-2xl">
        {/* one-time coach-assigned flash */}
        <div
          style={{ borderColor: `${accent}55`, "--coach-glow": `${accent}40` } as React.CSSProperties}
          className="anim-flash-in flex items-center gap-3 rounded-2xl border bg-gradient-to-br from-[#0d130c] via-[#0a0e0a] to-[#070a07] px-4 py-3 shadow-[0_0_28px_var(--coach-glow)]"
        >
          <span
            style={{ borderColor: `${accent}66`, color: accent, background: `${accent}1a` }}
            className="flex size-8 shrink-0 items-center justify-center rounded-full border"
          >
            <Check className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-display text-[11px] font-bold uppercase tracking-[0.24em]" style={{ color: accent }}>
              ✓ Coach Assigned
            </p>
            <p className="text-xs text-muted-foreground">
              Welcome <span className="font-semibold text-foreground">{userName}</span>! {coachTitle} {coachName} is now
              your AI Fitness Coach.
            </p>
          </div>
        </div>

        {/* personalized welcome */}
        <div className="anim-rise-in glass mt-5 rounded-2xl border border-primary/20 p-6 sm:p-8">
          <p className="font-display text-2xl font-bold leading-tight sm:text-3xl">
            WELCOME, <span className="neon-text">{userName.toUpperCase()}</span> 👋
          </p>

          <div className="mt-6 flex flex-col items-center gap-4 text-center">
            <CoachAvatar name={coachName} accent={accent} className="size-20 sm:size-24" />
            <div>
              <p className="font-display text-xl font-bold uppercase tracking-[0.05em] sm:text-2xl">
                {coachTitle} {coachName}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.2em]" style={{ color: accent }}>
                Is Now Your AI Fitness Coach
              </p>
            </div>
            <p className="max-w-md text-sm italic leading-6 text-muted-foreground">
              “Your fitness journey starts today.”
            </p>
            <p className="max-w-lg text-sm leading-6 text-foreground/90">
              {coachTitle} {coachName} will guide your training, motivation, progress and fitness journey.
            </p>
          </div>

          {/* profile saved confirmation */}
          <div className="mt-7 rounded-xl border border-primary/25 bg-primary/5 p-4">
            <p className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.12em] text-[#dcff8a]">
              <Check className="size-4" aria-hidden /> Your Profile Has Been Saved
            </p>
            <p className="mt-1.5 text-sm text-foreground/90">
              {coachTitle} {coachName} will provide you with your training.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              You can ask {coachTitle} {coachName} anything about your workout, nutrition, progress and fitness goals in
              the AI Coach section.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={onStartJourney}
              disabled={starting}
              className="h-12 flex-1 rounded-xl bg-gradient-to-r from-[#a3e635] to-[#65d413] text-[12px] font-bold uppercase tracking-[0.14em] text-[#0a1205] shadow-[0_0_24px_var(--neon-glow)] hover:brightness-110"
            >
              <Play className="mr-2 size-4 fill-current" aria-hidden />
              {starting ? "Starting…" : "Start My Journey"}
            </Button>
            <Button
              onClick={onAskCoach}
              variant="outline"
              className="h-12 flex-1 rounded-xl border-primary/30 bg-transparent text-[12px] font-bold uppercase tracking-[0.14em] text-[#dcff8a] hover:bg-primary/10"
            >
              <MessageSquare className="mr-2 size-4" aria-hidden />
              Ask {full}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <TerminalBadge tone="info">AI PERSONA — NOT A REAL HUMAN</TerminalBadge>
            <TerminalBadge tone="ink">DATA STORED AS STRUCTURED PROFILE</TerminalBadge>
          </div>
        </div>
      </div>
    </div>
  );
}
