import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Panel, StatChip, TerminalBadge, AsciiBar } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MEAL_SLOTS = ["breakfast", "lunch", "pre_workout", "post_workout", "dinner", "snacks"] as const;


export default function Nutrition() {
  const navigate = useNavigate();

  const todayData = useQuery(api.nutrition.getToday);
  const activity = useQuery(api.activity.getTodayActivity);

  const seedFoods = useMutation(api.nutrition.seedFoods);
  const generateMealPlan = useMutation(api.nutrition.generateMealPlan);
  const logFood = useMutation(api.nutrition.logFood);
  const logWater = useMutation(api.nutrition.logWater);
  const logActivity = useMutation(api.activity.logActivity);

  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string>("lunch");
  const [waterAmount, setWaterAmount] = useState("500");
  const [steps, setSteps] = useState("");

  useEffect(() => {
    seedFoods({}).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (todayData === null) navigate("/onboarding", { replace: true });
  }, [todayData, navigate]);

  async function handleGeneratePlan() {
    setGenerating(true);
    try {
      const r = await generateMealPlan({});
      toast.success(`Meal plan created — ${r.mealCount} meals`, {
        description: "All values are estimates; swap anything.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate meal plan");
    } finally {
      setGenerating(false);
    }
  }

  // Reactive food search — results appear as you type (2+ chars).
  const foodSearch = useQuery(
    api.nutrition.searchFoods,
    search.trim().length > 1 ? { query: search.trim() } : "skip",
  );

  function slotLabel(slot: string) {
    return slot.replace(/_/g, " ").toUpperCase();
  }

  const t = todayData?.targets;
  const consumed = todayData?.consumed ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const remainingKcal = t ? Math.max(0, t.calories - consumed.calories) : 0;
  const remainingProtein = t ? Math.max(0, t.proteinG - consumed.proteinG) : 0;

  // AI diet coach line — deterministic, no shaming.
  const dietCoachLine = !t
    ? null
    : remainingProtein > 25
      ? `You're currently below your protein target today. You still have approximately ${remainingProtein}g remaining — a protein-forward meal or shake would close the gap.`
      : consumed.calories > t.calories + 150
        ? `You're about ${consumed.calories - t.calories} kcal over your estimated target today. One adjustment at the next meal keeps the week on track.`
        : "You're on track with today's targets. Keep water intake steady through the day.";

  return (
    <AppShell>
      <div className="space-y-4">
        {/* targets */}
        <Panel
          title="NUTRITION ENGINE"
          subtitle="ESTIMATED targets from your profile — not medical prescriptions"
          right={
            <Button
              size="sm"
              variant="outline"
              className="rounded-none text-[10px] uppercase tracking-[0.12em]"
              onClick={handleGeneratePlan}
              disabled={generating}
            >
              {generating ? "PLANNING…" : "GENERATE MEAL PLAN"}
            </Button>
          }
        >
          {t ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatChip label="CALORIES / DAY" value={t.calories} />
              <StatChip label="PROTEIN G" value={t.proteinG} tone="ok" />
              <StatChip label="CARBS G" value={t.carbsG} tone="info" />
              <StatChip label="FAT G" value={t.fatG} tone="warn" />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Complete onboarding to compute targets.</p>
          )}
          {t && (
            <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
              BMR {t.bmr} · TDEE {t.tdee} (ESTIMATED) — {t.disclaimer}
            </p>
          )}
        </Panel>

        {/* daily dashboard */}
        {t && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="TODAY — TARGET VS CONSUMED" className="lg:col-span-2">
              <div className="space-y-3">
                {[
                  { label: "CALORIES", target: t.calories, got: consumed.calories, tone: "ink" as const },
                  { label: "PROTEIN", target: t.proteinG, got: consumed.proteinG, tone: "ok" as const },
                  { label: "CARBS", target: t.carbsG, got: consumed.carbsG, tone: "info" as const },
                  { label: "FAT", target: t.fatG, got: consumed.fatG, tone: "warn" as const },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="uppercase tracking-[0.14em] text-muted-foreground">{row.label}</span>
                      <span>
                        <span className="font-semibold">{Math.round(row.got)}</span>
                        <span className="text-muted-foreground"> / {row.target}</span>
                      </span>
                    </div>
                    <div className="mt-1">
                      <AsciiBar value={row.target ? row.got / row.target : 0} width={24} />
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <StatChip label="REMAINING KCAL" value={remainingKcal} />
                  <StatChip label="REMAINING PROTEIN G" value={remainingProtein} tone="ok" />
                </div>
              </div>
            </Panel>

            {/* water */}
            <Panel title="WATER TRACKING">
              <div className="space-y-3">
                <StatChip
                  label={`${todayData?.water ?? 0} / ${t.waterMl} ML`}
                  value={`${Math.round(((todayData?.water ?? 0) / t.waterMl) * 100)}%`}
                  tone="info"
                />
                <AsciiBar value={(todayData?.water ?? 0) / t.waterMl} width={20} />
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={waterAmount}
                    onChange={(e) => setWaterAmount(e.target.value)}
                    className="h-8 rounded-none"
                  />
                  <Button
                    size="sm"
                    className="h-8 rounded-none text-[10px] uppercase tracking-[0.12em]"
                    onClick={async () => {
                      const ml = Number(waterAmount);
                      if (!ml || ml <= 0) return;
                      await logWater({ amountMl: ml });
                      toast.success(`+${ml}ml logged`);
                    }}
                  >
                    LOG
                  </Button>
                </div>
                <div className="flex gap-1.5">
                  {[250, 500, 750].map((ml) => (
                    <button
                      key={ml}
                      onClick={() => logWater({ amountMl: ml })}
                      className="flex-1 border border-border bg-secondary/50 py-1.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground hover:border-terminal-cyan/50 hover:text-status-info"
                    >
                      +{ml}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">Reminder: keep a bottle at your desk — sip, don't chug.</p>
              </div>
            </Panel>
          </div>
        )}

        {/* diet coach */}
        {dietCoachLine && (
          <Panel title="AI DIET COACH" subtitle="daily intake analysis — no judgment, just adjustments">
            <p className="text-sm leading-6">{dietCoachLine}</p>
          </Panel>
        )}

        {/* meal plan */}
        {todayData?.plan && (
          <Panel title="TODAY'S MEAL PLAN" subtitle={todayData.plan.notes ?? undefined}>
            <div className="grid gap-3 md:grid-cols-2">
              {todayData.plan.meals.map((meal) => (
                <div key={meal.slot} className="border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em]">{meal.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      ~{meal.estimatedCalories} kcal · {meal.estimatedProteinG}g protein
                    </span>
                  </div>
                  <ul className="space-y-1 p-3 text-xs">
                    {meal.items.map((item) => (
                      <li key={item.foodName} className="flex justify-between gap-2">
                        <span>
                          {item.foodName} <span className="text-muted-foreground">({item.quantity})</span>
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {item.calories} kcal · {item.proteinG}g P
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* food logging */}
        <Panel title="LOG FOOD" subtitle="search the food database — values are approximate">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {MEAL_SLOTS.map((slot) => (
                <button
                  key={slot}
                  onClick={() => setSelectedSlot(slot)}
                  className={cn(
                    "border px-2 py-1 text-[10px] uppercase tracking-[0.12em]",
                    selectedSlot === slot
                      ? "border-terminal-green bg-[#eef3ea] text-status-ok"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {slotLabel(slot)}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="paneer, dal, roti, whey…"
                className="rounded-none"
              />
            </form>
            <div className="space-y-1.5">
              {(foodSearch ?? []).slice(0, 6).map((f) => (
                <div key={f._id} className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card px-3 py-2 text-xs">
                  <div>
                    <span className="font-semibold">{f.name}</span>
                    <span className="text-muted-foreground"> · {f.servingSize}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{f.calories} kcal · {f.proteinG}g P · {f.carbsG}g C · {f.fatG}g F</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-none text-[10px] uppercase tracking-[0.1em]"
                      onClick={async () => {
                        await logFood({
                          mealSlot: selectedSlot,
                          foodName: f.name,
                          quantity: f.servingSize,
                          calories: f.calories,
                          proteinG: f.proteinG,
                          carbsG: f.carbsG,
                          fatG: f.fatG,
                        });
                        toast.success(`${f.name} logged to ${slotLabel(selectedSlot)}`);
                      }}
                    >
                      LOG
                    </Button>
                  </div>
                </div>
              ))}
              {search.trim().length > 1 && (foodSearch ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">No match — log a custom item below.</p>
              )}
            </div>

            {/* custom log */}
            <details className="border border-border bg-secondary/40 p-3">
              <summary className="cursor-pointer text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                CUSTOM ITEM
              </summary>
              <form
                className="mt-3 grid gap-2 sm:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  await logFood({
                    mealSlot: selectedSlot,
                    foodName: String(fd.get("name") ?? ""),
                    quantity: String(fd.get("qty") ?? "1 serving"),
                    calories: Number(fd.get("kcal") ?? 0),
                    proteinG: Number(fd.get("p") ?? 0),
                    carbsG: Number(fd.get("c") ?? 0),
                    fatG: Number(fd.get("f") ?? 0),
                  });
                  toast.success("Logged");
                  (e.target as HTMLFormElement).reset();
                }}
              >
                <Input name="name" placeholder="food name" required className="rounded-none" />
                <Input name="qty" placeholder="quantity" className="rounded-none" />
                <Input name="kcal" type="number" placeholder="calories" required className="rounded-none" />
                <Input name="p" type="number" placeholder="protein g" className="rounded-none" />
                <Input name="c" type="number" placeholder="carbs g" className="rounded-none" />
                <Input name="f" type="number" placeholder="fat g" className="rounded-none" />
                <Button type="submit" className="rounded-none text-[11px] uppercase tracking-[0.12em] sm:col-span-2">
                  LOG ITEM ✓
                </Button>
              </form>
            </details>
          </div>
        </Panel>

        {/* today's log */}
        {todayData && todayData.logs.length > 0 && (
          <Panel title="TODAY'S FOOD LOG">
            <div className="space-y-1 text-xs">
              {todayData.logs.map((l) => (
                <div key={l._id} className="flex justify-between border-b border-border/60 py-1.5 last:border-0">
                  <span>
                    <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      {slotLabel(l.mealSlot)}
                    </span>{" "}
                    {l.foodName} ({l.quantity})
                  </span>
                  <span className="text-muted-foreground">
                    {l.calories} kcal · {l.proteinG}g P
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* activity manual logging */}
        <Panel title="ACTIVITY — MANUAL LOG" subtitle="no device integrations are faked; values you enter are what the engine uses">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">STEPS TODAY</label>
              <div className="mt-1 flex gap-2">
                <Input
                  type="number"
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  placeholder="8000"
                  className="h-8 w-32 rounded-none"
                />
                <Button
                  size="sm"
                  className="h-8 rounded-none text-[10px] uppercase tracking-[0.12em]"
                  onClick={async () => {
                    const v = Number(steps);
                    if (!v || v < 0) return;
                    await logActivity({ kind: "steps", value: v });
                    toast.success("Steps saved");
                  }}
                >
                  SAVE
                </Button>
              </div>
            </div>
            <div className="flex gap-2 text-xs text-muted-foreground">
              {activity?.steps != null && <TerminalBadge tone="ink">STEPS: {activity.steps}</TerminalBadge>}
              {activity?.sleep_hours != null && <TerminalBadge tone="info">SLEEP: {activity.sleep_hours}H</TerminalBadge>}
              {activity?.active_minutes != null && <TerminalBadge tone="warn">ACTIVE: {activity.active_minutes}M</TerminalBadge>}
            </div>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
