import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeader, TerminalBadge } from "@/components/terminal";
import { CoachWelcomeScreen } from "@/components/coach-welcome-screen";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

// Premium multi-step onboarding: BASIC → GOAL → EXPERIENCE → TRAINING →
// DIET → LIFESTYLE → TARGET. One completeOnboarding save at the end.

const GOALS = [
  { value: "fat_loss", label: "Fat loss", hint: "Reduce body fat, keep muscle" },
  { value: "muscle_gain", label: "Muscle gain", hint: "Build overall size" },
  { value: "lean_muscle", label: "Lean muscle", hint: "Size with minimal fat gain" },
  { value: "strength", label: "Strength", hint: "Get stronger on the big lifts" },
  { value: "body_recomposition", label: "Body recomposition", hint: "Lose fat + gain muscle at once" },
  { value: "general_fitness", label: "General fitness", hint: "Health, energy, consistency" },
  { value: "athletic_performance", label: "Athletic performance", hint: "Speed, power, conditioning" },
  { value: "bodybuilding", label: "Bodybuilding", hint: "Physique-focused hypertrophy" },
  { value: "competition_preparation", label: "Competition preparation", hint: "Stage or meet prep" },
] as const;

const EXPERIENCE = ["beginner", "intermediate", "advanced", "competitive"] as const;

const EQUIPMENT = [
  "barbell", "dumbbells", "kettlebells", "machines", "cables",
  "pull-up bar", "bands", "bench", "squat rack", "bodyweight only",
] as const;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const DIET_TYPES = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "eggetarian", label: "Eggetarian" },
  { value: "non_vegetarian", label: "Non-vegetarian" },
  { value: "indian", label: "Indian diet" },
] as const;

const STEPS = ["BASIC", "GOAL", "EXPERIENCE", "TRAINING", "DIET", "LIFESTYLE", "TARGET"] as const;

type OnboardingState = {
  name: string;
  age: string;
  sex: string;
  heightCm: string;
  weightKg: string;
  goal: string;
  experience: string;
  daysPerWeek: string;
  sessionMinutes: string;
  location: string;
  equipment: string[];
  currentRoutine: string;
  preferredDays: string[];
  dietType: string;
  restrictions: string;
  allergies: string;
  preferences: string;
  budgetLevel: string;
  mealsPerDay: string;
  dailyActivity: string;
  dailySteps: string;
  sleepHours: string;
  workType: string;
  stressLevel: string;
  waterIntakeLiters: string;
  goalDescription: string;
  targetDate: string;
};

const INITIAL: OnboardingState = {
  name: "",
  age: "",
  sex: "male",
  heightCm: "",
  weightKg: "",
  goal: "",
  experience: "",
  daysPerWeek: "3",
  sessionMinutes: "60",
  location: "gym",
  equipment: [],
  currentRoutine: "",
  preferredDays: [],
  dietType: "",
  restrictions: "",
  allergies: "",
  preferences: "",
  budgetLevel: "medium",
  mealsPerDay: "3",
  dailyActivity: "moderate",
  dailySteps: "",
  sleepHours: "",
  workType: "desk",
  stressLevel: "moderate",
  waterIntakeLiters: "",
  goalDescription: "",
  targetDate: "",
};

function ChoiceGrid<T extends string>({
  options,
  value,
  onChange,
  columns = 3,
}: {
  options: ReadonlyArray<{ value: T; label: string; hint?: string }>;
  value: T | "";
  onChange: (v: T) => void;
  columns?: number;
}) {
  return (
    <div className={cn("grid gap-2", columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "border px-3 py-2.5 text-left transition-colors",
            value === opt.value
              ? "border-terminal-green bg-[#eef3ea]"
              : "border-border bg-card hover:border-muted-foreground/40",
          )}
        >
          <div className="text-xs font-semibold tracking-wide">{opt.label}</div>
          {opt.hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{opt.hint}</div>}
        </button>
      ))}
    </div>
  );
}

function ToggleChips({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onToggle(opt)}
          className={cn(
            "border px-2.5 py-1.5 text-[11px] uppercase tracking-[0.1em] transition-colors",
            selected.includes(opt)
              ? "border-terminal-green bg-[#eef3ea] text-status-ok"
              : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40",
          )}
        >
          {selected.includes(opt) ? "✓ " : "· "}
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<OnboardingState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  // Set after a successful save → drives the coach welcome / saved confirmation screen.
  const [assigned, setAssigned] = useState<{ name: string; coachTitle: string } | null>(null);
  const [starting, setStarting] = useState(false);

  const seedPersonas = useMutation(api.coachPersonas.seedPersonasPublic);
  const assignCoach = useMutation(api.coachJourney.assignCoach);
  const completeOnboarding = useMutation(api.profile.completeOnboarding);
  const generatePlan = useMutation(api.workouts.generatePlan);
  const startJourney = useMutation(api.coachJourney.startJourney);
  const markCoachWelcomeShown = useMutation(api.coachJourney.markCoachWelcomeShown);

  const personas = useQuery(api.coachPersonas.listPersonas);
  const [personaId, setPersonaId] = useState<string>("");

  // Ensure the persona roster exists when the user reaches coach selection.
  useEffect(() => {
    seedPersonas({}).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const toggleInList = (key: "equipment" | "preferredDays", value: string) =>
    setState((s) => ({
      ...s,
      [key]: s[key].includes(value) ? s[key].filter((v) => v !== value) : [...s[key], value],
    }));

  const canAdvance = (): boolean => {
    switch (step) {
      case 0:
        return state.name.trim().length > 0 && !!state.age && !!state.heightCm && !!state.weightKg;
      case 1:
        return !!state.goal;
      case 2:
        return !!state.experience;
      case 3:
        return !!state.daysPerWeek && state.preferredDays.length > 0;
      case 4:
        return !!state.dietType && !!state.mealsPerDay;
      case 5:
        return !!state.dailyActivity && !!state.workType;
      case 6:
        return state.goalDescription.trim().length > 0 && !!personaId;
      default:
        return false;
    }
  };

  const finish = async () => {
    setSubmitting(true);
    try {
      await completeOnboarding({
        name: state.name.trim(),
        age: Number(state.age),
        sex: state.sex,
        heightCm: Number(state.heightCm),
        weightKg: Number(state.weightKg),
        experience: state.experience as "beginner",
        goal: state.goal as "fat_loss",
        goalDescription: state.goalDescription.trim(),
        targetDate: state.targetDate || undefined,
        training: {
          daysPerWeek: Number(state.daysPerWeek),
          sessionMinutes: Number(state.sessionMinutes),
          location: state.location,
          equipment: state.equipment,
          currentRoutine: state.currentRoutine.trim() || undefined,
          preferredDays: state.preferredDays,
        },
        diet: {
          dietType: state.dietType,
          restrictions: state.restrictions.split(",").map((s) => s.trim()).filter(Boolean),
          allergies: state.allergies.split(",").map((s) => s.trim()).filter(Boolean),
          preferences: state.preferences.trim() || undefined,
          budgetLevel: state.budgetLevel,
          mealsPerDay: Number(state.mealsPerDay),
        },
        lifestyle: {
          dailyActivity: state.dailyActivity,
          dailySteps: state.dailySteps ? Number(state.dailySteps) : undefined,
          sleepHours: state.sleepHours ? Number(state.sleepHours) : undefined,
          workType: state.workType,
          stressLevel: state.stressLevel,
          waterIntakeLiters: state.waterIntakeLiters ? Number(state.waterIntakeLiters) : undefined,
        },
      });
      let coachName: string | undefined;
      let coachTitle = "Coach";
      if (personaId) {
        const res = await assignCoach({ personaId: personaId as Id<"coachPersonas"> });
        coachName = res.name;
        coachTitle = res.coachTitle;
      }
      // Generate the first training plan from the profile.
      await generatePlan({});
      toast.success("Profile saved — assessment generated", {
        description: "Week 1 of your training plan is scheduled.",
      });
      if (coachName) {
        setAssigned({ name: coachName, coachTitle });
        setSubmitting(false);
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
      setSubmitting(false);
    }
  };

  const stepValid = canAdvance();

  async function handleAskCoach() {
    await markCoachWelcomeShown({}).catch(() => undefined);
    navigate("/coach");
  }

  async function handleStartJourney() {
    setStarting(true);
    try {
      await markCoachWelcomeShown({}).catch(() => undefined);
      await startJourney({});
      navigate("/journey");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start your journey");
      setStarting(false);
    }
  }

  if (assigned) {
    return (
      <CoachWelcomeScreen
        userName={state.name.trim() || "athlete"}
        coachName={assigned.name}
        coachTitle={assigned.coachTitle}
        onAskCoach={handleAskCoach}
        onStartJourney={handleStartJourney}
        starting={starting}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-[0.22em]">
            AFE://ONBOARDING
          </span>
          <TerminalBadge tone="ok">STEP {step + 1}/7</TerminalBadge>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* progress rail */}
        <div className="mb-8 flex items-center gap-1">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div
                className={cn(
                  "h-1 w-full",
                  i < step ? "bg-[#23a03c]" : i === step ? "bg-terminal-green/50" : "bg-border",
                )}
              />
              <div
                className={cn(
                  "mt-1 hidden text-[9px] uppercase tracking-[0.12em] sm:block",
                  i === step ? "text-status-ok" : "text-muted-foreground",
                )}
              >
                {label}
              </div>
            </div>
          ))}
        </div>

        <div className="border border-border bg-card">
          <div className="border-b border-border bg-secondary/60 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {`> LOADING MODULE: ${STEPS[step]}`}
          </div>

          <div className="space-y-6 p-5">
            {step === 0 && (
              <section>
                <SectionHeader index="01" title="BASIC PROFILE" hint="who is the engine coaching?" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">NAME</label>
                    <Input
                      value={state.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="Your name"
                      className="mt-1 rounded-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">AGE</label>
                    <Input
                      type="number"
                      min={13}
                      max={90}
                      value={state.age}
                      onChange={(e) => set("age", e.target.value)}
                      placeholder="28"
                      className="mt-1 rounded-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">SEX</label>
                    <div className="mt-1 grid grid-cols-3 gap-1">
                      {["male", "female", "other"].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => set("sex", s)}
                          className={cn(
                            "border py-2 text-[11px] uppercase tracking-[0.1em]",
                            state.sex === s
                              ? "border-terminal-green bg-[#eef3ea] text-status-ok"
                              : "border-border bg-card text-muted-foreground",
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">HEIGHT (CM)</label>
                    <Input
                      type="number"
                      min={120}
                      max={230}
                      value={state.heightCm}
                      onChange={(e) => set("heightCm", e.target.value)}
                      placeholder="175"
                      className="mt-1 rounded-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">WEIGHT (KG)</label>
                    <Input
                      type="number"
                      min={35}
                      max={250}
                      step="0.1"
                      value={state.weightKg}
                      onChange={(e) => set("weightKg", e.target.value)}
                      placeholder="72.5"
                      className="mt-1 rounded-none"
                    />
                  </div>
                </div>
              </section>
            )}

            {step === 1 && (
              <section>
                <SectionHeader index="02" title="FITNESS GOAL" hint="primary objective" />
                <ChoiceGrid
                  options={GOALS.map((g) => ({ value: g.value, label: g.label, hint: g.hint }))}
                  value={state.goal as (typeof GOALS)[number]["value"] | ""}
                  onChange={(v) => set("goal", v)}
                />
              </section>
            )}

            {step === 2 && (
              <section>
                <SectionHeader index="03" title="EXPERIENCE" hint="training age" />
                <ChoiceGrid
                  options={EXPERIENCE.map((e) => ({
                    value: e,
                    label: e.charAt(0).toUpperCase() + e.slice(1),
                    hint: e === "beginner" ? "< 1 year" : e === "intermediate" ? "1-3 years" : e === "advanced" ? "3+ years" : "competing",
                  }))}
                  value={state.experience as (typeof EXPERIENCE)[number] | ""}
                  onChange={(v) => set("experience", v)}
                />
              </section>
            )}

            {step === 3 && (
              <section className="space-y-5">
                <SectionHeader index="04" title="TRAINING" hint="logistics the plan must fit" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      DAYS PER WEEK: {state.daysPerWeek}
                    </label>
                    <input
                      type="range"
                      min={2}
                      max={6}
                      value={state.daysPerWeek}
                      onChange={(e) => set("daysPerWeek", e.target.value)}
                      className="mt-2 w-full accent-[#1f7a33]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      SESSION DURATION: {state.sessionMinutes} MIN
                    </label>
                    <input
                      type="range"
                      min={20}
                      max={120}
                      step={5}
                      value={state.sessionMinutes}
                      onChange={(e) => set("sessionMinutes", e.target.value)}
                      className="mt-2 w-full accent-[#1f7a33]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">LOCATION</label>
                  <div className="mt-1 grid grid-cols-3 gap-1">
                    {["gym", "home", "mixed"].map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => set("location", loc)}
                        className={cn(
                          "border py-2 text-[11px] uppercase tracking-[0.1em]",
                          state.location === loc
                            ? "border-terminal-green bg-[#eef3ea] text-status-ok"
                            : "border-border bg-card text-muted-foreground",
                        )}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    AVAILABLE EQUIPMENT
                  </label>
                  <div className="mt-1.5">
                    <ToggleChips
                      options={EQUIPMENT}
                      selected={state.equipment}
                      onToggle={(v) => toggleInList("equipment", v)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    PREFERRED TRAINING DAYS
                  </label>
                  <div className="mt-1.5">
                    <ToggleChips
                      options={DAYS}
                      selected={state.preferredDays}
                      onToggle={(v) => toggleInList("preferredDays", v)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    CURRENT ROUTINE (OPTIONAL)
                  </label>
                  <Input
                    value={state.currentRoutine}
                    onChange={(e) => set("currentRoutine", e.target.value)}
                    placeholder="e.g. upper/lower split, mostly machines"
                    className="mt-1 rounded-none"
                  />
                </div>
              </section>
            )}

            {step === 4 && (
              <section className="space-y-5">
                <SectionHeader index="05" title="DIET" hint="pattern the coach must respect" />
                <ChoiceGrid
                  options={DIET_TYPES.map((d) => ({ value: d.value, label: d.label }))}
                  value={state.dietType as (typeof DIET_TYPES)[number]["value"] | ""}
                  onChange={(v) => set("dietType", v)}
                  columns={3}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      FOOD RESTRICTIONS (COMMA-SEPARATED)
                    </label>
                    <Input
                      value={state.restrictions}
                      onChange={(e) => set("restrictions", e.target.value)}
                      placeholder="no pork, no alcohol"
                      className="mt-1 rounded-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      ALLERGIES (COMMA-SEPARATED)
                    </label>
                    <Input
                      value={state.allergies}
                      onChange={(e) => set("allergies", e.target.value)}
                      placeholder="peanuts, shellfish"
                      className="mt-1 rounded-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      FOOD PREFERENCES
                    </label>
                    <Input
                      value={state.preferences}
                      onChange={(e) => set("preferences", e.target.value)}
                      placeholder="spicy, high-protein breakfast"
                      className="mt-1 rounded-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">BUDGET</label>
                    <div className="mt-1 grid grid-cols-3 gap-1">
                      {["low", "medium", "high"].map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => set("budgetLevel", b)}
                          className={cn(
                            "border py-2 text-[11px] uppercase tracking-[0.1em]",
                            state.budgetLevel === b
                              ? "border-terminal-green bg-[#eef3ea] text-status-ok"
                              : "border-border bg-card text-muted-foreground",
                          )}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      MEALS PER DAY: {state.mealsPerDay}
                    </label>
                    <input
                      type="range"
                      min={2}
                      max={6}
                      value={state.mealsPerDay}
                      onChange={(e) => set("mealsPerDay", e.target.value)}
                      className="mt-2 w-full accent-[#1f7a33]"
                    />
                  </div>
                </div>
              </section>
            )}

            {step === 5 && (
              <section className="space-y-5">
                <SectionHeader index="06" title="LIFESTYLE" hint="recovery & activity context" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      DAILY ACTIVITY
                    </label>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      {["sedentary", "light", "moderate", "active"].map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => set("dailyActivity", a)}
                          className={cn(
                            "border py-2 text-[11px] uppercase tracking-[0.1em]",
                            state.dailyActivity === a
                              ? "border-terminal-green bg-[#eef3ea] text-status-ok"
                              : "border-border bg-card text-muted-foreground",
                          )}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      WORK TYPE
                    </label>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      {["desk", "physical", "mixed", "student"].map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => set("workType", w)}
                          className={cn(
                            "border py-2 text-[11px] uppercase tracking-[0.1em]",
                            state.workType === w
                              ? "border-terminal-green bg-[#eef3ea] text-status-ok"
                              : "border-border bg-card text-muted-foreground",
                          )}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">STRESS LEVEL</label>
                    <div className="mt-1 grid grid-cols-3 gap-1">
                      {["low", "moderate", "high"].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => set("stressLevel", s)}
                          className={cn(
                            "border py-2 text-[11px] uppercase tracking-[0.1em]",
                            state.stressLevel === s
                              ? "border-terminal-green bg-[#eef3ea] text-status-ok"
                              : "border-border bg-card text-muted-foreground",
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">STEPS</label>
                      <Input
                        type="number"
                        value={state.dailySteps}
                        onChange={(e) => set("dailySteps", e.target.value)}
                        placeholder="8000"
                        className="mt-1 rounded-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">SLEEP H</label>
                      <Input
                        type="number"
                        step="0.5"
                        value={state.sleepHours}
                        onChange={(e) => set("sleepHours", e.target.value)}
                        placeholder="7"
                        className="mt-1 rounded-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">WATER L</label>
                      <Input
                        type="number"
                        step="0.5"
                        value={state.waterIntakeLiters}
                        onChange={(e) => set("waterIntakeLiters", e.target.value)}
                        placeholder="2.5"
                        className="mt-1 rounded-none"
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {step === 6 && (
              <section className="space-y-5">
                <SectionHeader index="07" title="TARGET" hint="stored as structured data" />
                <div>
                  <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    WHAT EXACTLY DO YOU WANT TO ACHIEVE?
                  </label>
                  <textarea
                    value={state.goalDescription}
                    onChange={(e) => set("goalDescription", e.target.value)}
                    rows={3}
                    placeholder="e.g. gain 4kg of muscle and squat 100kg for 5 reps"
                    className="mt-1 w-full border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">BY WHEN?</label>
                  <Input
                    type="date"
                    value={state.targetDate}
                    onChange={(e) => set("targetDate", e.target.value)}
                    className="mt-1 rounded-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    CHOOSE YOUR COACH
                  </label>
                  {personas === undefined ? (
                    <p className="mt-1 text-xs text-muted-foreground">loading roster…</p>
                  ) : (
                    <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                      {personas.map((p) => (
                        <button
                          key={p._id}
                          type="button"
                          onClick={() => setPersonaId(p._id)}
                          className={cn(
                            "border px-3 py-2 text-left transition-colors",
                            personaId === p._id
                              ? "border-terminal-green bg-[#eef3ea]"
                              : "border-border bg-card hover:border-muted-foreground/40",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-status-ok">{p.avatarGlyph}</span>
                            <span className="text-xs font-bold tracking-wide">{p.name}</span>
                          </div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">{p.role}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    AI personas — not real humans. You can switch anytime from the Coach page.
                  </p>
                </div>
              </section>
            )}
          </div>

          {/* footer controls */}
          <div className="flex items-center justify-between border-t border-border bg-secondary/50 px-5 py-3">
            <Button
              variant="ghost"
              className="rounded-none text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || submitting}
            >
              ← BACK
            </Button>
            {step < 6 ? (
              <Button
                className="rounded-none text-[11px] uppercase tracking-[0.14em]"
                onClick={() => setStep((s) => s + 1)}
                disabled={!stepValid}
              >
                NEXT →
              </Button>
            ) : (
              <Button
                className="rounded-none text-[11px] uppercase tracking-[0.14em]"
                onClick={finish}
                disabled={!stepValid || submitting}
              >
                {submitting ? "SAVING…" : "RUN ASSESSMENT →"}
              </Button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          DATA STORED AS STRUCTURED PROFILE · NOT CHAT SCRAP
        </p>
      </main>
    </div>
  );
}
