import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Panel, StatChip, TerminalBadge } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MODES = [
  { value: "hypertrophy", label: "HYPERTROPHY", hint: "maximize muscle growth" },
  { value: "strength", label: "STRENGTH", hint: "peak force output" },
  { value: "lean_bulk", label: "LEAN BULK", hint: "size, minimal fat" },
  { value: "cutting", label: "CUTTING", hint: "keep muscle, drop fat" },
  { value: "recomp", label: "RECOMPOSITION", hint: "both at once" },
  { value: "comp_prep", label: "COMPETITION PREP", hint: "stage-ready protocol" },
] as const;

const CATEGORIES = [
  { value: "mens_physique", label: "Men's Physique" },
  { value: "classic_physique", label: "Classic Physique" },
  { value: "bodybuilding", label: "Bodybuilding" },
  { value: "womens_bikini", label: "Women's Bikini" },
  { value: "womens_wellness", label: "Women's Wellness" },
  { value: "womens_figure", label: "Women's Figure" },
] as const;

export default function Bodybuilding() {
  const navigate = useNavigate();

  const activeMode = useQuery(api.bodybuilding.getActiveMode);
  const competition = useQuery(api.bodybuilding.getCompetitionProfile);
  const summary = useQuery(api.progress.getProgressSummary);
  const profile = useQuery(api.profile.getProfile);

  const activateMode = useMutation(api.bodybuilding.activateMode);
  const createCompetition = useMutation(api.bodybuilding.createCompetitionProfile);
  const addCheckin = useMutation(api.bodybuilding.addCompetitionCheckin);

  const [mode, setMode] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [savingMode, setSavingMode] = useState(false);

  const [category, setCategory] = useState("");
  const [compDate, setCompDate] = useState("");
  const [compWeight, setCompWeight] = useState("");
  const [history, setHistory] = useState("");
  const [prevComps, setPrevComps] = useState("");
  const [creatingComp, setCreatingComp] = useState(false);

  const [checkinWeight, setCheckinWeight] = useState("");
  const [checkinNotes, setCheckinNotes] = useState("");

  useEffect(() => {
    if (profile === null) navigate("/onboarding", { replace: true });
  }, [profile, navigate]);

  async function handleActivateMode() {
    if (!mode) return;
    setSavingMode(true);
    try {
      await activateMode({
        mode: mode as "hypertrophy",
        targetWeightKg: targetWeight ? Number(targetWeight) : undefined,
        targetDate: targetDate || undefined,
      });
      toast.success("Mode activated", { description: "Coach and targets now reference this mode." });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSavingMode(false);
    }
  }

  async function handleCreateCompetition() {
    if (!category || !compDate) {
      toast.error("Category and date are required");
      return;
    }
    setCreatingComp(true);
    try {
      await createCompetition({
        category,
        competitionDate: compDate,
        currentWeightKg: compWeight ? Number(compWeight) : undefined,
        trainingHistory: history.trim() || undefined,
        previousCompetitions: prevComps.trim() || undefined,
      });
      toast.success("Prep timeline created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreatingComp(false);
    }
  }

  const bbStats = activeMode
    ? [
        { label: "MODE", value: activeMode.mode.replace(/_/g, " ") },
        { label: "TARGET WEIGHT", value: activeMode.targetWeightKg ? `${activeMode.targetWeightKg}kg` : "—" },
        { label: "STARTED", value: activeMode.startDate },
        { label: "TARGET DATE", value: activeMode.targetDate ?? "—" },
      ]
    : [];

  return (
    <AppShell>
      <div className="space-y-4">
        {/* mode */}
        <Panel
          title="BODYBUILDING MODE"
          subtitle="hypertrophy · strength · cutting · prep — tracked separately from your base goal"
          right={activeMode ? <TerminalBadge tone="ok">{activeMode.mode.replace(/_/g, " ").toUpperCase()}</TerminalBadge> : <TerminalBadge tone="warn">NO MODE</TerminalBadge>}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={cn(
                  "border px-3 py-2.5 text-left",
                  mode === m.value || (!mode && activeMode?.mode === m.value)
                    ? "border-terminal-green bg-[#eef3ea]"
                    : "border-border bg-card hover:border-muted-foreground/40",
                )}
              >
                <div className="text-xs font-bold tracking-wide">{m.label}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{m.hint}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">TARGET WEIGHT (KG)</label>
              <Input type="number" step="0.1" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} className="mt-1 h-8 w-32 rounded-none" placeholder="78" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">TARGET DATE</label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="mt-1 h-8 rounded-none" />
            </div>
            <Button className="h-8 rounded-none text-[10px] uppercase tracking-[0.12em]" onClick={handleActivateMode} disabled={!mode || savingMode}>
              ACTIVATE MODE
            </Button>
          </div>

          {activeMode && (
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-4">
              {bbStats.map((s) => (
                <StatChip key={s.label} label={s.label} value={s.value} />
              ))}
            </div>
          )}
        </Panel>

        {/* tracking snapshot */}
        <Panel title="MODE TRACKING" subtitle="weight, strength, recovery and nutrition adherence feed the mode">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatChip label="CURRENT WEIGHT" value={profile?.weightKg ? `${profile.weightKg}kg` : "—"} />
            <StatChip label="MEASUREMENTS" value={summary?.measurements.length ?? 0} />
            <StatChip label="ADHERENCE" value={`${Math.round((summary?.adherence ?? 0) * 100)}%`} tone="ok" />
            <StatChip
              label="RECOVERY (LAST CHECK-IN)"
              value={
                summary?.measurements.length
                  ? "see check-in"
                  : "—"
              }
              tone="info"
            />
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">
            Recovery and nutrition adherence come from daily check-ins and food logs — the mode adapts suggestions on each weekly review, never with drastic automatic changes.
          </p>
        </Panel>

        {/* competition prep */}
        <Panel
          title="COMPETITION PREPARATION"
          subtitle="structured timeline · safety-guarded"
          right={competition ? <TerminalBadge tone="warn">{competition.daysOut} DAYS OUT</TerminalBadge> : undefined}
        >
          {competition ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatChip label="CATEGORY" value={competition.categoryLabel} />
                <StatChip label="SHOW DATE" value={competition.profile.competitionDate} />
                <StatChip label="PHASE" value={competition.profile.phase.toUpperCase()} tone="warn" />
                <StatChip label="PREP WEEKS" value={competition.profile.prepStartWeeks} />
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">PREP TIMELINE</p>
                <div className="space-y-1.5">
                  {competition.timeline.map((t) => (
                    <div key={t.phase} className="flex flex-col gap-1 border border-border bg-secondary/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-[0.12em]">{t.phase}</span>
                        <span className="ml-2 text-[10px] text-muted-foreground">until {t.until}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{t.focus}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-terminal-amber/40 bg-[#fdf3e7] p-3 text-[11px] leading-5">
                <p className="font-semibold uppercase tracking-[0.12em]">SAFETY RULES — NON-NEGOTIABLE</p>
                <p className="mt-1 text-muted-foreground">
                  No dehydration or water-cut protocols. No drug cycles or diuretics — ever. Peak week is handled with a
                  qualified coach; medical questions go to sports medicine professionals. The engine plans training and
                  estimated nutrition phases only.
                </p>
              </div>

              {/* check-ins */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">WEEKLY PREP CHECK-IN</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">WEIGHT (KG)</label>
                    <Input type="number" step="0.1" value={checkinWeight} onChange={(e) => setCheckinWeight(e.target.value)} className="mt-1 h-8 w-28 rounded-none" />
                  </div>
                  <div className="min-w-48 flex-1">
                    <label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">NOTES</label>
                    <Input value={checkinNotes} onChange={(e) => setCheckinNotes(e.target.value)} className="mt-1 h-8 rounded-none" placeholder="conditioning, posing practice, energy…" />
                  </div>
                  <Button
                    className="h-8 rounded-none text-[10px] uppercase tracking-[0.12em]"
                    onClick={async () => {
                      try {
                        await addCheckin({
                          weightKg: checkinWeight ? Number(checkinWeight) : undefined,
                          notes: checkinNotes.trim() || undefined,
                        });
                        toast.success("Prep check-in logged");
                        setCheckinWeight("");
                        setCheckinNotes("");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed");
                      }
                    }}
                  >
                    LOG CHECK-IN
                  </Button>
                </div>
                {competition.checkins.length > 0 && (
                  <div className="mt-2 space-y-1 text-xs">
                    {competition.checkins.slice(0, 6).map((c) => (
                      <div key={c._id} className="flex justify-between border-b border-border/60 py-1">
                        <span className="font-medium">{c.weekLabel}</span>
                        <span className="text-muted-foreground">
                          {c.weightKg ? `${c.weightKg}kg · ` : ""}
                          {c.notes ?? "no notes"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground">
                Posing reminders: practice your mandatory poses 3×/week from 8 weeks out — 10 minutes post-workout is enough.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={cn(
                      "border px-3 py-2 text-left text-xs",
                      category === c.value ? "border-terminal-green bg-[#eef3ea] text-status-ok" : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">COMPETITION DATE *</label>
                  <Input type="date" value={compDate} onChange={(e) => setCompDate(e.target.value)} className="mt-1 rounded-none" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">CURRENT WEIGHT (KG)</label>
                  <Input type="number" step="0.1" value={compWeight} onChange={(e) => setCompWeight(e.target.value)} className="mt-1 rounded-none" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">TRAINING HISTORY</label>
                  <Input value={history} onChange={(e) => setHistory(e.target.value)} placeholder="e.g. 4 years training, 2 meets" className="mt-1 rounded-none" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">PREVIOUS COMPETITIONS</label>
                  <Input value={prevComps} onChange={(e) => setPrevComps(e.target.value)} placeholder="placements, federations" className="mt-1 rounded-none" />
                </div>
              </div>
              <Button className="rounded-none text-[11px] uppercase tracking-[0.12em]" onClick={handleCreateCompetition} disabled={creatingComp}>
                CREATE PREP TIMELINE →
              </Button>
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
