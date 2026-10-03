import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Panel, TerminalBadge, AsciiBar, StatusDot } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useVoiceCoach } from "@/hooks/use-voice-coach";
import type { Id, Doc } from "@/convex/_generated/dataModel";

const WARMUP = [
  "5 min light cardio (bike, brisk walk, rowing)",
  "Arm circles, leg swings, hip openers",
  "2 light ramp-up sets of your first exercise",
];

const COOLDOWN = [
  "3-5 min easy walk to bring the heart rate down",
  "Stretch what you trained — 20-30s per muscle",
  "Log how the session felt before you leave",
];

export default function Workout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const plan = useQuery(api.workouts.getActivePlan);
  const sessions = useQuery(api.workouts.getRecentSessions, { limit: 20 });
  const profile = useQuery(api.profile.getProfile);

  const generatePlan = useMutation(api.workouts.generatePlan);
  const startSession = useMutation(api.workouts.startSession);
  const logSet = useMutation(api.workouts.logSet);
  const finishSession = useMutation(api.workouts.finishSession);

  const [selectedSessionId, setSelectedSessionId] = useState<Id<"workoutSessions"> | null>(null);
  const [generating, setGenerating] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [difficulty, setDifficulty] = useState("just_right");
  const [notes, setNotes] = useState("");
  const [localLogs, setLocalLogs] = useState<
    Record<string, { weightKg?: number; reps?: number; completed: boolean }>
  >({});
  const [coachFlash, setCoachFlash] = useState<string | null>(null);
  const [timerKey, setTimerKey] = useState<string>("");
  const timerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  function startRestTimer(exerciseId: string) {
    setTimerKey(exerciseId);
  }

  // Voice is available but never claims to be human.
  const voice = useVoiceCoach({ enabled: true });
  const { speak, sttSupported } = voice;

  async function handleInlineAsk(question: string) {
    if (!question.trim()) return;
    try {
      await navigate(`/coach?q=${encodeURIComponent(question)}`);
    } catch {
      toast.error("Could not open the coach chat.");
    }
  }

  const detail = useQuery(
    api.workouts.getSessionDetail,
    selectedSessionId ? { sessionId: selectedSessionId } : "skip",
  );

  // Auto-select an active (in-progress) session.
  useEffect(() => {
    if (selectedSessionId || !sessions) return;
    const active = sessions.find((s) => s.status === "in_progress");
    if (active) setSelectedSessionId(active._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  // Auto-open the generator when arriving with ?generate=1 and no plan.
  useEffect(() => {
    if (searchParams.get("generate") && !plan && profile && !generating) {
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, plan, profile]);

  // Redirect guests without onboarding.
  useEffect(() => {
    if (profile === null) navigate("/onboarding", { replace: true });
  }, [profile, navigate]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await generatePlan({});
      toast.success(`Plan created: ${result.name}`, {
        description: "Week 1 sessions are scheduled.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setGenerating(false);
    }
  }

  async function handleStart(sessionId: Id<"workoutSessions">) {
    try {
      await startSession({ sessionId });
      setSelectedSessionId(sessionId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start session");
    }
  }

  function mergeLog(key: string, patch: { weightKg?: number; reps?: number; completed?: boolean }) {
    setLocalLogs((prev) => {
      const existing = prev[key] ?? { completed: false };
      return { ...prev, [key]: { ...existing, ...patch } };
    });
  }

  async function handleSaveSet(
    exerciseOrder: number,
    setIndex: number,
    entry: { weightKg?: number; reps?: number; completed: boolean },
  ) {
    if (!selectedSessionId) return;
    try {
      await logSet({
        sessionId: selectedSessionId,
        exerciseOrder,
        setIndex,
        weightKg: entry.weightKg,
        reps: entry.reps,
        completed: entry.completed,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save set");
    }
  }

  async function handleFinish() {
    if (!selectedSessionId) return;
    try {
      await finishSession({
        sessionId: selectedSessionId,
        difficultyFeedback: difficulty,
        notes: notes.trim() || undefined,
      });
      toast.success("Session logged", { description: "Your coach sees this in the next reply." });
      setFinishOpen(false);
      setSelectedSessionId(null);
      setLocalLogs({});
      setNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to finish session");
    }
  }

  const activePlanSessions = sessions?.filter((s) => s.status === "scheduled" || s.status === "in_progress") ?? [];
  const completedSessions = sessions?.filter((s) => s.status === "completed") ?? [];
  const isDetailActive = detail?.session.status === "in_progress";

  // Coach onboarding flash shown once per session open.
  useEffect(() => {
    if (isDetailActive && !timerKey) {
      setCoachFlash("ASK YOUR COACH — type anything about this workout, form, fatigue or your plan.");
      const t = window.setTimeout(() => setCoachFlash(null), 5500);
      flashTimerRef.current = t;
    }
    return () => window.clearTimeout(flashTimerRef.current ?? undefined);
  }, [isDetailActive]);

  // Prefill weight from the stored default (goal-aware engine default) if the user
  // has not yet entered anything for this exercise.
  function defaultWeightFor(exercise: Doc<"workoutExercises">): number | undefined {
    if (exercise.defaultWeightKg != null) return exercise.defaultWeightKg;
    if (exercise.muscleGroup === "legs" || exercise.muscleGroup === "back") return 15;
    if (exercise.muscleGroup === "chest" || exercise.muscleGroup === "shoulders") return 10;
    return undefined;
  }

  // Current session's logged weight/reps for an exercise+set, preferring local
  // edits over what was last saved.
  function logFor(exerciseOrder: number, setIndex: number) {
    const server = detail?.logs.find((l) => l.exerciseOrder === exerciseOrder && l.setIndex === setIndex);
    const local = localLogs[`${exerciseOrder}:${setIndex}`];
    return {
      weightKg: local?.weightKg ?? server?.weightKg,
      reps: local?.reps ?? server?.reps,
      completed: local?.completed ?? server?.completed ?? false,
    };
  }

  // Last logged weight for the same exercise (strict superset: only uses the
  // most recent completed session in the same plan, read from server logs).
  const lastWeightFor = (exerciseOrder: number, setIndex: number): number | undefined => {
    const completedThisPlan = completedSessions.filter((s) => s.planId === detail?.session?.planId);
    const mostRecent = completedThisPlan[completedThisPlan.length - 1];
    if (!mostRecent || !detail?.logs) return undefined;
    return detail.logs.find((l) => l.exerciseOrder === exerciseOrder && l.setIndex === setIndex)?.weightKg;
  };

  return (
    <AppShell>
      <div className="space-y-4">
        {/* plan header */}
        <Panel
          title="WORKOUT ENGINE"
          subtitle={plan ? plan.name : "no active plan"}
          right={
            plan ? (
              <TerminalBadge tone="ok">ACTIVE · {plan.weeks}W</TerminalBadge>
            ) : (
              <TerminalBadge tone="warn">NO PLAN</TerminalBadge>
            )
          }
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs leading-5 text-muted-foreground">
              {plan ? (
                <>
                  {plan.daysPerWeek} days/week · generated {new Date(plan.createdAt).toLocaleDateString()}
                  <br />
                  {plan.notes}
                </>
              ) : (
                <>Generate a plan from your profile: goal, experience, training days, equipment and session time.</>
              )}
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating || !profile?.onboardingComplete}
              className="shrink-0 rounded-none text-[11px] uppercase tracking-[0.14em]"
            >
              {generating ? "GENERATING…" : plan ? "REGENERATE PLAN" : "GENERATE PLAN →"}
            </Button>
          </div>
        </Panel>

        {/* scheduled sessions */}
        {activePlanSessions.length > 0 && (
          <Panel title="SCHEDULED SESSIONS">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {activePlanSessions.map((s: Doc<"workoutSessions">) => (
                <div key={s._id} className="border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{s.name}</span>
                    <TerminalBadge tone={s.status === "in_progress" ? "warn" : "ink"}>{s.status}</TerminalBadge>
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    DAY {s.dayIndex + 1}
                  </div>
                  <Button
                    size="sm"
                    variant={s.status === "in_progress" ? "default" : "outline"}
                    className="mt-2 w-full rounded-none text-[10px] uppercase tracking-[0.12em]"
                    onClick={() => (s.status === "in_progress" ? setSelectedSessionId(s._id) : handleStart(s._id))}
                  >
                    {s.status === "in_progress" ? "RESUME →" : "START →"}
                  </Button>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* active session detail */}
        {selectedSessionId && detail && (
          <Panel
            title={`SESSION: ${detail.session.name.toUpperCase()}`}
            subtitle={isDetailActive ? "IN PROGRESS — LOG EACH SET" : "COMPLETED SESSION VIEW"}
            right={
              isDetailActive ? (
                <Button size="sm" variant="outline" className="rounded-none text-[10px] uppercase tracking-[0.12em]" onClick={() => setFinishOpen(true)}>
                  FINISH →
                </Button>
              ) : (
                <Button size="sm" variant="ghost" className="rounded-none text-[10px] uppercase tracking-[0.12em]" onClick={() => setSelectedSessionId(null)}>
                  CLOSE
                </Button>
              )
            }
          >
            {coachFlash && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-terminal-amber/40 bg-[#fdf3e7]/70 px-3 py-2">
                <div className="mt-0.5 shrink-0">
                  <StatusDot tone="warn" pulse />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-status-warn">Ask Your Coach</p>
                  <p className="mt-0.5 text-[11px] leading-5 text-foreground/90">{coachFlash}</p>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                    Open the chat anytime — ask about form, fatigue, plan, nutrition or supplements.
                  </p>
                </div>
              </div>
            )}
            {/* warm-up */}
            <div className="mb-4 border border-border bg-secondary/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-warn">WARM-UP</p>
              <ul className="mt-1 list-inside list-square text-xs text-muted-foreground">
                {WARMUP.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>

            {/* exercises */}
            <div className="space-y-3">
              {detail.exercises.map((ex) => {
                const doneSets = detail.logs.filter((l) => l.exerciseOrder === ex.order && l.completed).length;
                const isSuperset = typeof ex.supersetWith === "string" && ex.supersetWith.length > 0;
                const lastWeight = lastWeightFor(ex.order, 0);
                const prefillWeight = defaultWeightFor(ex);
                return (
                  <div key={ex._id} className="border border-border bg-card">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                      <div>
                        <span className="text-sm font-semibold">{ex.name}</span>
                        {isSuperset && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-terminal-green/40 bg-[#eef3ea]/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-status-ok">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-status-ok"/>
                            SUPERSET · {ex.supersetWith}
                          </span>
                        )}
                        <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          {ex.muscleGroup} · {ex.sets} × {ex.reps} · rest {ex.restSeconds}s
                        </span>
                      </div>
                      <AsciiBar value={ex.sets ? doneSets / ex.sets : 0} width={12} />
                    </div>
                    {ex.techniqueNotes && (
                      <p className="px-3 pt-2 text-[11px] leading-5 text-muted-foreground">
                        TECHNIQUE: {ex.techniqueNotes}
                      </p>
                    )}
                    {ex.alternatives.length > 0 && (
                      <p className="px-3 pt-1 text-[11px] text-muted-foreground">
                        ALTERNATIVES: {ex.alternatives.join(", ")}
                      </p>
                    )}
                    {lastWeight != null && prefillWeight != null && (
                      <p className="px-3 pt-1 text-[10px] uppercase tracking-[0.14em] text-status-info">
                        LAST TIME: {lastWeight}kg · this session start: {prefillWeight}kg
                      </p>
                    )}

                    {/* set grid */}
                    <div className="space-y-1.5 p-3">
                      {Array.from({ length: ex.sets }).map((_, setIndex) => {
                        const entry = logFor(ex.order, setIndex);
                        const key = `${ex.order}:${setIndex}`;
                        return (
                          <div key={setIndex} className="flex flex-wrap items-center gap-2 text-xs">
                            <span className={cn("w-14 shrink-0 uppercase tracking-[0.1em]", entry.completed ? "text-status-ok" : "text-muted-foreground")}>
                              {timerKey === ex._id && entry.completed ? `REST ${(ex.restSeconds ?? 90)}S` : `SET ${setIndex + 1}`}
                            </span>
                            <Input
                              type="number"
                              step="0.5"
                              min={0}
                              placeholder="kg"
                              disabled={!isDetailActive}
                              value={entry.weightKg ?? prefillWeight ?? ""}
                              onChange={(e) =>
                                mergeLog(key, { weightKg: e.target.value === "" ? undefined : Number(e.target.value) })
                              }
                              className="h-8 w-20 rounded-none"
                            />
                            <Input
                              type="number"
                              min={0}
                              placeholder="reps"
                              disabled={!isDetailActive}
                              value={entry.reps ?? ""}
                              onChange={(e) =>
                                mergeLog(key, { reps: e.target.value === "" ? undefined : Number(e.target.value) })
                              }
                              className="h-8 w-20 rounded-none"
                            />
                            <Button
                              size="sm"
                              variant={entry.completed ? "default" : "outline"}
                              disabled={!isDetailActive}
                              className="h-8 rounded-none text-[10px] uppercase tracking-[0.12em]"
                              onClick={() => {
                                const next = { ...entry, completed: !entry.completed };
                                mergeLog(key, next);
                                void handleSaveSet(ex.order, setIndex, next);
                                if (next.completed && !entry.completed) startRestTimer(ex._id);
                              }}
                            >
                              {entry.completed ? "DONE ✓" : "COMPLETE"}
                            </Button>
                            {isSuperset && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={!isDetailActive}
                                className="h-8 rounded-none text-[9px] uppercase tracking-[0.12em] text-status-info"
                                onClick={() => handleInlineAsk(`Explain how to do ${ex.name} and ${ex.supersetWith} as a superset, including form cues and rest timing.`)}
                              >
                                ASK COACH
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* cool-down */}
            <div className="mt-4 border border-border bg-secondary/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-info">COOL-DOWN</p>
              <ul className="mt-1 list-inside list-square text-xs text-muted-foreground">
                {COOLDOWN.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </Panel>
        )}

        {/* history */}
        <Panel title="SESSION HISTORY">
          {completedSessions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No completed sessions yet.</p>
          ) : (
            <div className="space-y-1">
              {completedSessions.map((s) => (
                <div key={s._id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-1.5 text-xs last:border-0">
                  <span className="font-medium">{s.name}</span>
                  <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {s.durationMinutes ? <>{s.durationMinutes} MIN ·</> : null}
                    {s.completedAt && new Date(s.completedAt).toLocaleDateString()}
                    {s.difficultyFeedback && (
                      <TerminalBadge tone="ink">{s.difficultyFeedback.replace(/_/g, " ")}</TerminalBadge>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* finish dialog */}
        {finishOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4">
            <div className="w-full max-w-md border border-border bg-card">
              <div className="border-b border-border bg-secondary/60 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                FINISH SESSION
              </div>
              <div className="space-y-4 p-4">
                <p className="text-sm">How did the session feel?</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { value: "easy", label: "EASY" },
                    { value: "just_right", label: "JUST RIGHT" },
                    { value: "hard", label: "HARD" },
                    { value: "too_hard", label: "TOO HARD" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDifficulty(opt.value)}
                      className={cn(
                        "border py-2 text-[11px] uppercase tracking-[0.12em]",
                        difficulty === opt.value
                          ? "border-terminal-green bg-[#eef3ea] text-status-ok"
                          : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">NOTES (OPTIONAL)</label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. knee felt fine, ran out of time on last set"
                    className="mt-1 rounded-none"
                  />
                </div>
                <p className="text-[10px] leading-4 text-muted-foreground">
                  Adaptation stays gradual: your coach uses this feedback in the next planning cycle — no unsafe auto-changes.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" className="rounded-none text-[11px] uppercase tracking-[0.14em]" onClick={() => setFinishOpen(false)}>
                    CANCEL
                  </Button>
                  <Button className="rounded-none text-[11px] uppercase tracking-[0.14em]" onClick={handleFinish}>
                    LOG SESSION ✓
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
