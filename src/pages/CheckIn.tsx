import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Panel, TerminalBadge, SectionHeader } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function CheckIn() {
  const navigate = useNavigate();

  const todayCheckin = useQuery(api.activity.getTodayCheckin);
  const history = useQuery(api.activity.getCheckinHistory, { limit: 14 });
  const milestones = useQuery(api.progress.getMilestones);

  const submit = useMutation(api.activity.submitCheckin);
  const logActivity = useMutation(api.activity.logActivity);

  const [didWorkout, setDidWorkout] = useState<boolean | null>(null);
  const [energy, setEnergy] = useState(3);
  const [sleep, setSleep] = useState("");
  const [protein, setProtein] = useState<boolean | null>(null);
  const [water, setWater] = useState<boolean | null>(null);
  const [steps, setSteps] = useState("");
  const [stress, setStress] = useState("moderate");
  const [pain, setPain] = useState("none");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (todayCheckin) {
      setDidWorkout(todayCheckin.didWorkout);
      setEnergy(todayCheckin.energyLevel);
      setSleep(todayCheckin.sleepHours?.toString() ?? "");
      setProtein(todayCheckin.proteinOnTrack ?? null);
      setWater(todayCheckin.waterOnTrack ?? null);
      setSteps(todayCheckin.steps?.toString() ?? "");
      setStress(todayCheckin.stressLevel);
      setPain(todayCheckin.painOrSymptoms || "none");
      setNotes(todayCheckin.notes ?? "");
    }
  }, [todayCheckin]);

  async function handleSubmit() {
    if (didWorkout === null || protein === null || water === null) {
      toast.error("Answer the workout, protein and water questions");
      return;
    }
    setSaving(true);
    try {
      await submit({
        didWorkout,
        energyLevel: energy,
        sleepHours: sleep ? Number(sleep) : undefined,
        proteinOnTrack: protein,
        waterOnTrack: water,
        steps: steps ? Number(steps) : undefined,
        stressLevel: stress as "low",
        painOrSymptoms: pain,
        notes: notes.trim() || undefined,
      });
      if (steps) await logActivity({ kind: "steps", value: Number(steps) });
      if (sleep) await logActivity({ kind: "sleep_hours", value: Number(sleep) });
      toast.success("Check-in saved", { description: "Your coach reads this before every reply." });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save check-in");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <Panel
          title="DAILY CHECK-IN"
          subtitle={todayCheckin ? `already checked in today — editing updates it` : "60 seconds that steer the engine"}
        >
          <div className="space-y-5">
            <section>
              <SectionHeader index="01" title="DID YOU WORKOUT?" />
              <div className="mt-1.5 grid max-w-xs grid-cols-2 gap-1.5">
                {[{ v: true, label: "YES" }, { v: false, label: "NO" }].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setDidWorkout(opt.v)}
                    className={cn(
                      "border py-2 text-[11px] uppercase tracking-[0.12em]",
                      didWorkout === opt.v
                        ? opt.v
                          ? "border-terminal-green bg-[#eef3ea] text-status-ok"
                          : "border-terminal-amber bg-[#fdf3e7] text-status-warn"
                        : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <SectionHeader index="02" title="ENERGY LEVEL?" hint={`${energy}/5`} />
              <input
                type="range"
                min={1}
                max={5}
                value={energy}
                onChange={(e) => setEnergy(Number(e.target.value))}
                className="w-full max-w-xs accent-[#1f7a33]"
              />
            </section>

            <section className="grid gap-4 sm:grid-cols-3">
              <div>
                <SectionHeader index="03" title="SLEEP (H)" />
                <Input type="number" step="0.5" value={sleep} onChange={(e) => setSleep(e.target.value)} placeholder="7.5" className="mt-1 h-8 rounded-none" />
              </div>
              <div>
                <SectionHeader index="04" title="STEPS" />
                <Input type="number" value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="8000" className="mt-1 h-8 rounded-none" />
              </div>
              <div>
                <SectionHeader index="05" title="STRESS?" />
                <div className="mt-1 grid grid-cols-3 gap-1">
                  {["low", "moderate", "high"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStress(s)}
                      className={cn(
                        "border py-2 text-[10px] uppercase tracking-[0.1em]",
                        stress === s ? "border-terminal-green bg-[#eef3ea] text-status-ok" : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div>
                <SectionHeader index="06" title="PROTEIN ON TRACK?" />
                <div className="mt-1 grid max-w-xs grid-cols-2 gap-1.5">
                  {[{ v: true, label: "YES" }, { v: false, label: "NOT YET" }].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setProtein(opt.v)}
                      className={cn(
                        "border py-2 text-[11px] uppercase tracking-[0.12em]",
                        protein === opt.v ? "border-terminal-green bg-[#eef3ea] text-status-ok" : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <SectionHeader index="07" title="WATER ON TRACK?" />
                <div className="mt-1 grid max-w-xs grid-cols-2 gap-1.5">
                  {[{ v: true, label: "YES" }, { v: false, label: "NOT YET" }].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setWater(opt.v)}
                      className={cn(
                        "border py-2 text-[11px] uppercase tracking-[0.12em]",
                        water === opt.v ? "border-terminal-green bg-[#eef3ea] text-status-ok" : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section>
              <SectionHeader index="08" title="ANY PAIN OR UNUSUAL SYMPTOMS?" hint="never diagnosed — flagged for safe coaching" />
              <Input
                value={pain === "none" ? "" : pain}
                onChange={(e) => setPain(e.target.value === "" ? "none" : e.target.value)}
                placeholder="type 'none' or describe (e.g. left shoulder pinch on presses)"
                className="mt-1 rounded-none"
              />
              {pain !== "none" && pain.trim().length > 0 && (
                <p className="mt-1.5 text-[10px] leading-4 text-status-warn">
                  Noted. The coach will keep loading conservative around this and may recommend a qualified professional — it will not attempt a diagnosis.
                </p>
              )}
            </section>

            <section>
              <SectionHeader index="09" title="NOTES (OPTIONAL)" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="anything else the coach should know today"
                className="mt-1 w-full border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
              />
            </section>

            <Button
              className="rounded-none text-[11px] uppercase tracking-[0.14em]"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "SAVING…" : todayCheckin ? "UPDATE CHECK-IN ✓" : "SUBMIT CHECK-IN ✓"}
            </Button>
          </div>
        </Panel>

        {/* history */}
        <Panel title="CHECK-IN HISTORY">
          {history && history.length > 0 ? (
            <div className="space-y-1 text-xs">
              {history.map((c) => (
                <div key={c._id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-1.5 last:border-0">
                  <span className="font-medium">{c.date}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <TerminalBadge tone={c.didWorkout ? "ok" : "ink"}>{c.didWorkout ? "TRAINED" : "REST"}</TerminalBadge>
                    <TerminalBadge tone="ink">E {c.energyLevel}/5</TerminalBadge>
                    {c.sleepHours != null && <TerminalBadge tone="info">{c.sleepHours}H SLEEP</TerminalBadge>}
                    <TerminalBadge tone={c.stressLevel === "high" ? "warn" : "ink"}>{c.stressLevel}</TerminalBadge>
                    {c.painOrSymptoms && c.painOrSymptoms !== "none" && (
                      <TerminalBadge tone="warn">⚠ {c.painOrSymptoms.slice(0, 28)}</TerminalBadge>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No check-ins yet.</p>
          )}
        </Panel>

        <Panel title="STREAKS">
          {milestones && milestones.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {milestones.slice(0, 10).map((m) => (
                <TerminalBadge key={m._id} tone="ok">★ {m.title}</TerminalBadge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Check in daily — streak milestones unlock at 1, 3, 7, 14 and 30 days.</p>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
