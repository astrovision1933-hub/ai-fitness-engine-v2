import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Panel, TerminalBadge, AsciiBar, StatChip } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GOAL_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const GOALS = Object.entries(GOAL_LABELS).map(([value, label]) => ({ value, label }));

export default function Goals() {
  const navigate = useNavigate();

  const goal = useQuery(api.profile.getActiveGoal);
  const reviews = useQuery(api.progress.getWeeklyReviews, { limit: 1 });
  const milestones = useQuery(api.progress.getMilestones);
  const sessions = useQuery(api.workouts.getRecentSessions, { limit: 10 });
  const checkins = useQuery(api.activity.getCheckinHistory, { limit: 7 });
  const profile = useQuery(api.profile.getProfile);

  const updateGoal = useMutation(api.profile.updateGoal);

  const [editing, setEditing] = useState(false);
  const [goalValue, setGoalValue] = useState("");
  const [description, setDescription] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [targetDate, setTargetDate] = useState("");

  useEffect(() => {
    if (profile === null) navigate("/onboarding", { replace: true });
  }, [profile, navigate]);

  useEffect(() => {
    if (goal) {
      setGoalValue(goal.goal);
      setDescription(goal.description ?? "");
      setTargetDate(goal.targetDate ?? "");
      const match = goal.description?.match(/(\d+(?:\.\d+)?)\s*kg/i);
      if (match) setTargetWeight(match[1]);
    }
  }, [goal]);

  async function handleSave() {
    if (!goalValue || !description.trim()) {
      toast.error("Goal and description are required");
      return;
    }
    try {
      await updateGoal({
        goal: goalValue as "fat_loss",
        description: description.trim() + (targetWeight ? ` (target weight ${targetWeight}kg)` : ""),
        targetDate: targetDate || undefined,
      });
      toast.success("Goal saved", { description: "The coach aligns plans and reviews to this." });
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  // Simple milestone decomposition for the current goal.
  const currentWeight = profile?.weightKg ?? null;
  const target = targetWeight ? Number(targetWeight) : null;
  const milestoneSteps =
    currentWeight && target
      ? [0.25, 0.5, 0.75, 1].map((frac) => {
          const w = Number((currentWeight + (target - currentWeight) * frac).toFixed(1));
          const reached = false;
          return { frac, w, reached };
        })
      : null;

  const workoutStreak =
    sessions?.filter((s) => s.status === "completed").length ?? 0;
  const checkinDays = checkins?.length ?? 0;
  const latestReview = reviews?.[0];

  return (
    <AppShell>
      <div className="space-y-4">
        <Panel
          title="GOAL ENGINE"
          subtitle="goal · target · deadline · milestones"
          right={
            <Button size="sm" variant="outline" className="rounded-none text-[10px] uppercase tracking-[0.12em]" onClick={() => setEditing((v) => !v)}>
              {editing ? "CANCEL" : "EDIT GOAL"}
            </Button>
          }
        >
          {goal ? (
            <div className="space-y-3">
              <div className="text-lg font-semibold text-status-ok">{GOAL_LABELS[goal.goal] ?? goal.goal}</div>
              <p className="text-sm leading-6">{goal.description}</p>
              <div className="text-xs text-muted-foreground">DEADLINE: {goal.targetDate ?? "not set"}</div>

              {milestoneSteps ? (
                <div className="border-t border-border pt-3">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">MILESTONES</p>
                  <div className="space-y-1.5">
                    {milestoneSteps.map((m) => (
                      <div key={m.frac} className="flex items-center gap-2 text-xs">
                        <span className={cn("w-16", m.reached ? "text-status-ok" : "text-muted-foreground")}>
                          {m.frac === 1 ? "GOAL" : `${m.frac * 100}%`}
                        </span>
                        <span className="font-semibold">{m.w}kg</span>
                        <AsciiBar value={m.reached ? 1 : 0} width={10} />
                      </div>
                   ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Add a target weight (e.g. "78kg") in the description to generate milestones.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active goal — set one below.</p>
          )}

          {editing && (
            <div className="mt-4 space-y-3 border-t border-border pt-3">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {GOALS.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => setGoalValue(g.value)}
                    className={cn(
                      "border px-2 py-2 text-[11px]",
                      goalValue === g.value ? "border-terminal-green bg-[#eef3ea] text-status-ok" : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the goal — include a target weight like 78kg" className="rounded-none" />
              <div className="flex flex-wrap gap-2">
                <Input value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} placeholder="target kg" className="h-8 w-32 rounded-none" />
                <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="h-8 rounded-none" />
              </div>
              <Button className="rounded-none text-[11px] uppercase tracking-[0.14em]" onClick={handleSave} disabled={!goalValue || !description.trim()}>
                SAVE GOAL ✓
              </Button>
            </div>
          )}
        </Panel>

        {/* streaks */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="WORKOUT CONSISTENCY">
            <StatChip label="COMPLETED (LAST 10)" value={workoutStreak} tone="ok" />
          </Panel>
          <Panel title="CHECK-IN CONSISTENCY">
            <StatChip label="DAYS (LAST 7 SHOWN)" value={checkinDays} tone="info" />
          </Panel>
          <Panel title="MILESTONES">
            {milestones && milestones.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {milestones.slice(0, 8).map((m) => (
                  <TerminalBadge key={m._id} tone="ok">★ {m.title}</TerminalBadge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Streaks unlock at 1, 3, 7, 14, 30 days.</p>
            )}
          </Panel>
        </div>

        {/* adaptive coaching */}
        <Panel title="ADAPTIVE COACHING" subtitle="plan + adherence + performance + feedback → suggested adjustments">
          {latestReview ? (
            <div className="space-y-3">
              <p className="text-sm leading-6">{latestReview.summary}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-warn">WHAT THE ENGINE NOTICED</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {latestReview.obstacles.map((o) => (
                      <li key={o}>· {o}</li>
                    ))}
                    {latestReview.obstacles.length === 0 && <li>· no obstacles flagged</li>}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-ok">SUGGESTED ADJUSTMENTS</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {latestReview.nextWeekPriorities.map((p) => (
                      <li key={p}>· {p}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="text-[10px] leading-4 text-muted-foreground">
                If workouts aren't getting done, the engine investigates schedule, recovery, difficulty and motivation before ever touching volume — no drastic automatic changes.
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Generate a weekly review on the Progress page — the adaptive coach reads adherence, performance and check-ins to suggest gradual adjustments.
            </p>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
