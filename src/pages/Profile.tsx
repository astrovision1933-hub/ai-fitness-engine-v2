import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Panel, FieldRow, TerminalBadge, StatChip } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GOAL_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

const GOALS = Object.entries(GOAL_LABELS).map(([value, label]) => ({ value, label }));

export default function Profile() {
  const navigate = useNavigate();

  const profile = useQuery(api.profile.getProfile);
  const goal = useQuery(api.profile.getActiveGoal);
  const assessment = useQuery(api.profile.getAssessment);
  const memory = useQuery(api.profile.getMemory);
  const personas = useQuery(api.coachPersonas.listPersonas);
  const plan = useQuery(api.workouts.getActivePlan);
  const physique = useQuery(api.physique.getPhysiqueState);

  const updateGoal = useMutation(api.profile.updateGoal);
  const addMeasurement = useMutation(api.profile.addMeasurement);
  const assignCoach = useMutation(api.coachJourney.assignCoach);
  const savePreferences = useMutation(api.profile.savePreferences);

  const [goalOpen, setGoalOpen] = useState(false);
  const [goalValue, setGoalValue] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalDate, setGoalDate] = useState("");

  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [savingMeasurement, setSavingMeasurement] = useState(false);

  const [commStyle, setCommStyle] = useState("balanced");

  useEffect(() => {
    if (profile === null) navigate("/onboarding", { replace: true });
  }, [profile, navigate]);

  useEffect(() => {
    if (goal) {
      setGoalValue(goal.goal);
      setGoalDescription(goal.description ?? "");
      setGoalDate(goal.targetDate ?? "");
    }
  }, [goal]);

  if (!profile) {
    return (
      <AppShell>
        <p className="text-xs text-muted-foreground">&gt; loading profile…</p>
      </AppShell>
    );
  }

  const measurements = profile.measurements ?? [];
  const latest = measurements[measurements.length - 1];
  const first = measurements[0];
  const delta =
    latest && first && latest.weightKg && first.weightKg
      ? Number((latest.weightKg - first.weightKg).toFixed(1))
      : null;

  async function handleGoalSave() {
    try {
      await updateGoal({
        goal: goalValue as "fat_loss",
        description: goalDescription.trim(),
        targetDate: goalDate || undefined,
      });
      toast.success("Goal updated", { description: "Coach + plan will adapt on the next cycle." });
      setGoalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update goal");
    }
  }

  async function handleMeasurement() {
    if (!weight) return;
    setSavingMeasurement(true);
    try {
      await addMeasurement({
        weightKg: Number(weight),
        bodyFatPct: bodyFat ? Number(bodyFat) : undefined,
      });
      toast.success("Measurement logged");
      setWeight("");
      setBodyFat("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log measurement");
    } finally {
      setSavingMeasurement(false);
    }
  }

  async function handleCoach(personaId: Id<"coachPersonas">) {
    try {
      const res = await assignCoach({ personaId });
      toast.success(
        res.isChange
          ? `${res.coachTitle} ${res.name} is now your AI Fitness Coach`
          : `${res.coachTitle} ${res.name} assigned`,
        { description: "Your workout, nutrition and progress history is preserved." },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update coach";
      // Locked-bot attempt: route to plans instead of a dead-end error.
      if (msg.includes("locked")) {
        toast.message("Coach locked on your plan", { description: msg });
        window.location.assign("/subscription");
        return;
      }
      toast.error(msg);
    }
  }

  const bmi =
    profile.weightKg && profile.heightCm
      ? Number((profile.weightKg / (profile.heightCm / 100) ** 2).toFixed(1))
      : null;

  return (
    <AppShell>
      <div className="space-y-4">
        {/* identity */}
        <Panel
          title="FITNESS PROFILE"
          subtitle="persistent structured data — the engine's model of you"
          right={<TerminalBadge tone={profile.onboardingComplete ? "ok" : "warn"}>
            {profile.onboardingComplete ? "COMPLETE" : "INCOMPLETE"}
          </TerminalBadge>}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldRow label="NAME" value={profile.name ?? "—"} />
              <FieldRow label="AGE / SEX" value={`${profile.age ?? "—"} / ${profile.sex ?? "—"}`} />
              <FieldRow label="HEIGHT" value={profile.heightCm ? `${profile.heightCm} cm` : "—"} />
              <FieldRow label="WEIGHT" value={profile.weightKg ? `${profile.weightKg} kg` : "—"} />
              <FieldRow label="BMI (ESTIMATED)" value={bmi ?? "—"} />
            </div>
            <div>
              {profile.training && (
                <>
                  <FieldRow label="TRAINING" value={`${profile.training.daysPerWeek}d/wk · ${profile.training.sessionMinutes}min`} />
                  <FieldRow label="LOCATION" value={profile.training.location} />
                  <FieldRow label="EQUIPMENT" value={profile.training.equipment.join(", ") || "bodyweight"} />
                  <FieldRow label="PREFERRED DAYS" value={profile.training.preferredDays.join(", ") || "flexible"} />
                </>
              )}
              <FieldRow label="ACTIVE PLAN" value={plan ? plan.name : "none"} />
            </div>
          </div>
          {(profile.diet || profile.lifestyle) && (
            <div className="mt-4 grid gap-4 border-t border-border pt-3 md:grid-cols-2">
              {profile.diet && (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">DIET</p>
                  <FieldRow label="TYPE" value={profile.diet.dietType} />
                  <FieldRow label="MEALS/DAY" value={profile.diet.mealsPerDay} />
                  <FieldRow label="ALLERGIES" value={profile.diet.allergies.join(", ") || "none"} />
                  <FieldRow label="RESTRICTIONS" value={profile.diet.restrictions.join(", ") || "none"} />
                  <FieldRow label="BUDGET" value={profile.diet.budgetLevel ?? "—"} />
                </div>
              )}
              {profile.lifestyle && (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">LIFESTYLE</p>
                  <FieldRow label="ACTIVITY" value={profile.lifestyle.dailyActivity} />
                  <FieldRow label="STEPS" value={profile.lifestyle.dailySteps ?? "—"} />
                  <FieldRow label="SLEEP" value={profile.lifestyle.sleepHours ? `${profile.lifestyle.sleepHours}h` : "—"} />
                  <FieldRow label="WORK" value={profile.lifestyle.workType} />
                  <FieldRow label="STRESS" value={profile.lifestyle.stressLevel} />
                  <FieldRow label="WATER" value={profile.lifestyle.waterIntakeLiters ? `${profile.lifestyle.waterIntakeLiters}L` : "—"} />
                </div>
              )}
            </div>
          )}
        </Panel>

        {/* physique tracker */}
        <Panel
          title="PHYSIQUE TRACKER"
          subtitle="optional photos, measurements, fitness stage and transformation timeline"
          right={
            <Button size="sm" variant="outline" className="rounded-none text-[10px] uppercase tracking-[0.12em]" onClick={() => navigate("/physique")}>
              OPEN TRACKER →
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatChip label="PHYSIQUE" value={physique?.categoryLabel ?? "not enough info"} tone={physique?.categoryLabel ? "ok" : "ink"} />
            <StatChip label="FITNESS STAGE" value={physique?.fitnessStage ?? "—"} tone="info" />
            <StatChip label="CHECK-INS" value={physique?.counts.checkins ?? 0} tone="ink" />
            <StatChip label="PHOTOS" value={physique?.counts.photos ?? 0} tone="ink" />
          </div>
          {physique?.priorityAreas && physique.priorityAreas.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {physique.priorityAreas.map((a) => (
                <span key={a} className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] text-[#dcff8a]">
                  {a}
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {physique?.lastCheckIn ? `LAST CHECK-IN ${physique.lastCheckIn}` : "NO CHECK-INS YET · photos are private and optional"}
          </p>
        </Panel>

        {/* goal + progress */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="CURRENT GOAL" className="lg:col-span-2" right={
            <Button size="sm" variant="outline" className="rounded-none text-[10px] uppercase tracking-[0.12em]" onClick={() => setGoalOpen((v) => !v)}>
              {goalOpen ? "CANCEL" : "EDIT GOAL"}
            </Button>
          }>
            {goal ? (
              <div>
                <div className="text-lg font-semibold text-status-ok">{GOAL_LABELS[goal.goal] ?? goal.goal}</div>
                <p className="mt-1 text-sm leading-6">{goal.description}</p>
                <div className="mt-2 text-xs text-muted-foreground">
                  TARGET: {goal.targetDate ?? "not set"} · STATUS: {goal.status}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active goal.</p>
            )}

            {goalOpen && (
              <div className="mt-4 space-y-3 border-t border-border pt-3">
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {GOALS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setGoalValue(g.value)}
                      className={cn(
                        "border px-2 py-2 text-[11px]",
                        goalValue === g.value
                          ? "border-terminal-green bg-[#eef3ea] text-status-ok"
                          : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                <Input
                  value={goalDescription}
                  onChange={(e) => setGoalDescription(e.target.value)}
                  placeholder="What exactly do you want to achieve?"
                  className="rounded-none"
                />
                <Input
                  type="date"
                  value={goalDate}
                  onChange={(e) => setGoalDate(e.target.value)}
                  className="rounded-none"
                />
                <Button className="rounded-none text-[11px] uppercase tracking-[0.14em]" onClick={handleGoalSave} disabled={!goalValue || !goalDescription.trim()}>
                  SAVE GOAL ✓
                </Button>
              </div>
            )}
          </Panel>

          <Panel title="MEASUREMENTS">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <StatChip label="LATEST" value={latest?.weightKg ? `${latest.weightKg}kg` : "—"} />
                <StatChip
                  label="CHANGE"
                  value={delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}kg`}
                  tone={delta === null ? "ink" : delta < 0 ? "ok" : "warn"}
                />
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="weight kg"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="h-8 rounded-none"
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="bf %"
                  value={bodyFat}
                  onChange={(e) => setBodyFat(e.target.value)}
                  className="h-8 w-24 rounded-none"
                />
                <Button
                  size="sm"
                  className="h-8 rounded-none text-[10px] uppercase tracking-[0.12em]"
                  onClick={handleMeasurement}
                  disabled={!weight || savingMeasurement}
                >
                  LOG
                </Button>
              </div>
              {measurements.length > 0 && (
                <div className="max-h-32 space-y-1 overflow-y-auto text-xs">
                  {[...measurements].reverse().slice(0, 8).map((m, i) => (
                    <div key={`${m.date}-${i}`} className="flex justify-between border-b border-border/60 py-1">
                      <span className="text-muted-foreground">{m.date}</span>
                      <span>
                        {m.weightKg}kg{m.bodyFatPct ? ` · ${m.bodyFatPct}%` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* assessment */}
        <Panel
          title="FITNESS ASSESSMENT"
          subtitle={assessment ? `generated ${new Date(assessment.createdAt).toLocaleDateString()}` : "not generated yet"}
        >
          {assessment ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <AssessBlock label="STARTING POINT" body={assessment.startingPoint} />
                <AssessBlock label="GOAL ANALYSIS" body={assessment.goalAnalysis} />
                <AssessBlock label="TRAINING ASSESSMENT" body={assessment.trainingAssessment} />
                <AssessBlock label="LIFESTYLE ASSESSMENT" body={assessment.lifestyleAssessment} />
                <AssessBlock label="NUTRITION OVERVIEW" body={assessment.nutritionOverview} />
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-warn">POTENTIAL OBSTACLES</p>
                  <ul className="mt-1 space-y-1 text-xs leading-5 text-muted-foreground">
                    {assessment.obstacles.map((o: string) => (
                      <li key={o}>· {o}</li>
                    ))}
                    {assessment.obstacles.length === 0 && <li>· none flagged</li>}
                  </ul>
                </div>
                <AssessBlock label="SUGGESTED STRATEGY" body={assessment.strategy} />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-ok">TRACKING METRICS</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {assessment.trackingMetrics.map((t: string) => (
                      <TerminalBadge key={t} tone="ok">{t}</TerminalBadge>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] leading-4 text-muted-foreground">
                  Educational analysis only — not a medical assessment. Missing info will be requested by the coach over time.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Complete onboarding to generate your assessment.</p>
          )}
        </Panel>

        {/* coach + preferences */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="YOUR COACH">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(personas ?? []).map((p) => (
                <button
                  key={p._id}
                  onClick={() => handleCoach(p._id)}
                  className={cn(
                    "border px-2.5 py-2 text-left transition-colors",
                    profile.coachPersonaId === p._id
                      ? "border-terminal-green bg-[#eef3ea]"
                      : "border-border bg-card hover:border-muted-foreground/40",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-status-ok">{p.avatarGlyph}</span>
                    <span className="text-xs font-bold">{p.name}</span>
                  </div>
                  <div className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-muted-foreground">{p.role}</div>
                </button>
              ))}
            </div>
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">COACHING STYLE</p>
              <div className="grid grid-cols-3 gap-1.5">
                {["concise", "balanced", "detailed"].map((s) => (
                  <button
                    key={s}
                    onClick={async () => {
                      setCommStyle(s);
                      await savePreferences({ communicationStyle: s });
                      toast.success("Preference saved");
                    }}
                    className={cn(
                      "border py-1.5 text-[10px] uppercase tracking-[0.12em]",
                      commStyle === s
                        ? "border-terminal-green bg-[#eef3ea] text-status-ok"
                        : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="AI MEMORY — WHAT THE ENGINE REMEMBERS">
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {(memory ?? []).map((m) => (
                <div key={m._id} className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 text-xs last:border-0">
                  <span className="min-w-0">
                    <span className="text-foreground">{m.content}</span>
                    <span className="ml-2 text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                      {m.source.replace(/_/g, " ")}
                    </span>
                  </span>
                  <TerminalBadge tone={m.scope === "event" ? "info" : "ink"}>{m.scope}</TerminalBadge>
                </div>
              ))}
              {memory?.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No memories yet — they accumulate as you chat, train and log.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

function AssessBlock({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs leading-5">{body}</p>
    </div>
  );
}
