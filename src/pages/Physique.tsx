import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/AppShell";
import { Panel, StatChip, TerminalBadge } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CoachAvatar } from "@/components/coach-avatar";
import { PhysiqueScan } from "@/components/physique-scan";
import { PhotoCompare } from "@/components/photo-compare";
import { fileToDownscaledDataUrl } from "@/lib/photo";
import { PHOTO_GUIDELINES, PHYSIQUE_CATEGORY_LABELS } from "@/lib/physique";
import { coachAccent } from "@/lib/coach-media";
import { coachFullName } from "@/lib/coach-voice";
import { toast } from "sonner";
import { Camera, Image as ImageIcon, ShieldCheck, Trash2, Upload } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

const MEASURE_FIELDS = [
  { key: "weightKg", label: "WEIGHT (KG)", step: "0.1" },
  { key: "neckCm", label: "NECK (CM)", step: "0.5" },
  { key: "chestCm", label: "CHEST (CM)", step: "0.5" },
  { key: "waistCm", label: "WAIST (CM)", step: "0.5" },
  { key: "abdomenCm", label: "ABDOMEN (CM)", step: "0.5" },
  { key: "hipsCm", label: "HIPS (CM)", step: "0.5" },
  { key: "armCm", label: "BICEPS (CM)", step: "0.5" },
  { key: "legCm", label: "THIGH (CM)", step: "0.5" },
  { key: "calfCm", label: "CALF (CM)", step: "0.5" },
] as const;

const GUIDELINES = PHOTO_GUIDELINES;

function DataList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <ul className="mt-1 space-y-1 text-xs leading-5">
        {items.map((x) => (
          <li key={x} className="flex gap-2">
            <span className="text-primary">›</span>
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Physique() {
  const state = useQuery(api.physique.getPhysiqueState);
  const saveCheckIn = useMutation(api.physique.savePhysiqueCheckIn);
  const saveDescription = useMutation(api.physique.savePhysiqueDescription);
  const addMeasurement = useMutation(api.physique.addPhysiqueMeasurement);
  const replacePhoto = useMutation(api.physique.replacePhysiquePhoto);
  const deletePhoto = useMutation(api.physique.deletePhysiquePhoto);
  const deleteHistory = useMutation(api.physique.deletePhysiqueHistory);
  const skipWeek = useMutation(api.physique.skipWeeklyCheckIn);

  const [showCheckin, setShowCheckin] = useState(false);
  const [description, setDescription] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  const [values, setValues] = useState<Record<string, string>>({});
  const [savingMeasure, setSavingMeasure] = useState(false);

  const [compareFrom, setCompareFrom] = useState<Id<"physiqueCheckins"> | "">("");
  const [compareTo, setCompareTo] = useState<Id<"physiqueCheckins"> | "">("");

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const latest = state?.history?.[0] ?? null;

  // Default comparison pair is derived at render time (baseline → latest) so we
  // never need a setState-in-effect just to seed the two selects.
  const historyRows = state?.history ?? [];
  const defaultFrom: Id<"physiqueCheckins"> | "" =
    historyRows.length >= 2 ? historyRows[historyRows.length - 1]._id : "";
  const defaultTo: Id<"physiqueCheckins"> | "" =
    historyRows.length >= 2 ? historyRows[0]._id : "";
  const effectiveFrom = compareFrom || defaultFrom;
  const effectiveTo = compareTo || defaultTo;

  const comparison = useQuery(
    api.physique.getComparison,
    effectiveFrom && effectiveTo ? { fromId: effectiveFrom, toId: effectiveTo } : "skip",
  );

  const categoryLabel = useMemo(() => {
    const c = latest?.physiqueCategory ?? state?.category;
    return c ? PHYSIQUE_CATEGORY_LABELS[c] ?? c : null;
  }, [latest?.physiqueCategory, state?.category]);

  if (state === undefined) {
    return (
      <AppShell>
        <div className="space-y-3">
          <div className="skeleton h-48 rounded-2xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </AppShell>
    );
  }
  if (state === null) {
    return (
      <AppShell>
        <Panel title="PHYSIQUE TRACKER">
          <p className="text-sm text-muted-foreground">Sign in and complete onboarding to use the physique tracker.</p>
        </Panel>
      </AppShell>
    );
  }

  async function handleFile(file: File | undefined, replaceLatest: boolean) {
    if (!file) return;
    try {
      const dataUrl = await fileToDownscaledDataUrl(file, 720);
      if (replaceLatest && latest) {
        await replacePhoto({ checkinId: latest._id, dataUrl });
        toast.success("Photo replaced");
        return;
      }
      setPendingPhoto(dataUrl);
      setShowCheckin(true);
      setScanning(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that image");
    }
  }

  async function handleScanComplete() {
    try {
      await saveCheckIn({ dataUrl: pendingPhoto ?? undefined, userDescription: description.trim() || undefined });
      toast.success("Physique check-in saved", { description: "Your progress was added to your physique journey." });
      setScanning(false);
      setPendingPhoto(null);
      setDescription("");
      setShowCheckin(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save check-in");
      setScanning(false);
    }
  }

  async function handleSaveDescription() {
    if (!description.trim()) {
      toast.error("Write a short physique description first");
      return;
    }
    setSaving(true);
    try {
      await saveDescription({ description: description.trim() });
      toast.success("Physique description saved");
      setDescription("");
      setShowCheckin(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save description");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMeasurements() {
    const payload: Record<string, number> = {};
    for (const f of MEASURE_FIELDS) {
      const v = values[f.key];
      if (v) payload[f.key] = Number(v);
    }
    if (!Object.keys(payload).length) {
      toast.error("Enter at least one measurement");
      return;
    }
    setSavingMeasure(true);
    try {
      await addMeasurement(payload);
      toast.success("Measurements saved", { description: "Labeled as user-provided measurements." });
      setValues({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save measurements");
    } finally {
      setSavingMeasure(false);
    }
  }

  const coach = state.coach;
  const accent = coachAccent(coach?.name ?? "");
  const full = coach ? coachFullName(coach.name) : "Coach";

  return (
    <AppShell>
      {scanning && (
        <PhysiqueScan imageSrc={pendingPhoto} onComplete={handleScanComplete} onCancel={() => setScanning(false)} />
      )}

      <div className="space-y-5">
        {/* header */}
        <section
          style={{ borderColor: `${accent}3d`, "--coach-glow": `${accent}2e` } as React.CSSProperties}
          className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[#0d130c] via-[#0a0e0a] to-[#070a07] p-5 shadow-[0_0_22px_var(--coach-glow)] sm:p-6"
        >
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              {coach && <CoachAvatar name={coach.name} accent={accent} className="size-16" />}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Physique Tracker · {state.userName}
                </p>
                <p className="font-display mt-1 text-xl font-bold uppercase tracking-[0.04em]">
                  {full}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {coach?.role ?? "AI Fitness Coach"} · AI persona, not a human
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:min-w-[420px]">
              <StatChip label="PHYSIQUE" value={categoryLabel ?? "Not enough info"} tone={categoryLabel ? "ok" : "ink"} />
              <StatChip label="FITNESS STAGE" value={state.fitnessStage ?? "—"} tone="info" />
              <StatChip label="CHECK-INS" value={state.counts.checkins} tone="ink" />
            </div>
          </div>

          <div className="relative mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => setShowCheckin(true)}
              className="h-11 rounded-xl bg-gradient-to-r from-[#a3e635] to-[#65d413] text-[11px] font-bold uppercase tracking-[0.14em] text-[#0a1205] shadow-[0_0_20px_var(--neon-glow)] hover:brightness-110"
            >
              <Upload className="mr-2 size-4" aria-hidden />
              {state.counts.checkins === 0 ? "Set Baseline Physique" : "New Physique Check-in"}
            </Button>
            {state.dueNow && (
              <TerminalBadge tone="warn">Weekly check-in due</TerminalBadge>
            )}
            {!state.dueNow && state.lastCheckIn && (
              <TerminalBadge tone="ok">Last check-in {state.lastCheckIn}{state.daysUntilDue != null ? ` · next in ${Math.max(0, state.daysUntilDue)}d` : ""}</TerminalBadge>
            )}
          </div>
        </section>

        {/* check-in / upload flow */}
        {showCheckin && (
          <Panel title="PHOTO PHYSIQUE CHECK-IN" subtitle="optional — you can skip any time">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-3">
                <p className="text-xs leading-5 text-muted-foreground">
                  Upload one clear full-body photo from head to feet, or describe your physique in words. Nothing is required.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => cameraRef.current?.click()} variant="outline" className="rounded-xl text-[10px] uppercase tracking-[0.14em]">
                    <Camera className="mr-2 size-4" aria-hidden /> Take Photo
                  </Button>
                  <Button onClick={() => fileRef.current?.click()} variant="outline" className="rounded-xl text-[10px] uppercase tracking-[0.14em]">
                    <ImageIcon className="mr-2 size-4" aria-hidden /> Upload from Gallery
                  </Button>
                  <Button
                    onClick={() => {
                      setShowCheckin(false);
                      skipWeek({}).catch(() => undefined);
                      toast.message("Skipped this week", { description: "Reminder moved out 7 days. Nothing was recorded." });
                    }}
                    variant="ghost"
                    className="rounded-xl text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    Skip / Remind Me Later
                  </Button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const input = e.currentTarget;
                    void handleFile(input.files?.[0], false).finally(() => {
                      // Clear the input so the same photo can be retaken and the
                      // browser does not keep the full-resolution file in memory.
                      input.value = "";
                    });
                  }}
                />
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const input = e.currentTarget;
                    void handleFile(input.files?.[0], false).finally(() => {
                      input.value = "";
                    });
                  }}
                />

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Describe my physique
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder={"e.g. I'm 5'8\", 90 kg. More fat around my abdomen and lower belly. Arms and shoulders are comparatively muscular."}
                    className="mt-1 w-full border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                  />
                  <Button onClick={handleSaveDescription} disabled={saving} className="mt-2 rounded-xl text-[10px] font-bold uppercase tracking-[0.14em]">
                    {saving ? "Saving…" : "Save Description"}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-secondary/40 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  For a more useful comparison
                </p>
                <ul className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
                  {GUIDELINES.map((g) => (
                    <li key={g} className="flex gap-2">
                      <span className="text-primary">✓</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
                  Recommendations, not requirements. Photos are private to your account and never shown publicly.
                </p>
                {pendingPhoto && (
                  <img src={pendingPhoto} alt="Pending physique" className="mt-3 max-h-64 w-full rounded-lg border border-border object-contain" />
                )}
              </div>
            </div>
          </Panel>
        )}

        {/* latest assessment */}
        {latest && (
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Panel title="YOUR CURRENT PHYSIQUE PROFILE" subtitle="honest labels — user data, measurements, estimates and observations kept separate">
              <div className="flex flex-wrap items-center gap-2">
                <TerminalBadge tone={categoryLabel ? "ok" : "warn"}>
                  {categoryLabel ?? PHYSIQUE_CATEGORY_LABELS.unknown}
                </TerminalBadge>
                <TerminalBadge tone="info">STAGE: {latest.fitnessStageName}</TerminalBadge>
                <TerminalBadge tone="ink">{latest.isBaseline ? "BASELINE" : `WEEK ${latest.weekIndex}`}</TerminalBadge>
              </div>

              {latest.priorityAreas.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Priority areas</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {latest.priorityAreas.map((a) => (
                      <span key={a} className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] text-[#dcff8a]">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <DataList title="Areas to develop" items={latest.areasToDevelop} />
                <DataList title="Areas to maintain" items={latest.areasToMaintain.map((a) => a)} />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <DataList title="Training focus" items={latest.trainingFocus} />
                <DataList title="Nutrition focus" items={latest.nutritionFocus} />
                <DataList title="Recovery focus" items={latest.recoveryFocus} />
              </div>
            </Panel>

            <div className="space-y-4">
              <Panel title="DATA TRUTH" subtitle="what each claim is based on">
                <div className="space-y-3">
                  <DataList title="User-provided data" items={latest.userProvided} />
                  <DataList title="Measured data" items={latest.measured} />
                  <DataList title="Estimates" items={latest.estimates} />
                  <DataList title="AI observations" items={latest.observations} />
                  <DataList title="Recommendations" items={latest.recommendations} />
                </div>
                <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
                  No exact body-fat or muscle-mass figure is derived from a photo. Photo comparisons are approximate.
                </p>
              </Panel>
            </div>
          </div>
        )}

        {/* measurements */}
        <Panel title="BODY MEASUREMENTS" subtitle="optional · all values are user-provided measurements">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {MEASURE_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{f.label}</label>
                <Input
                  type="number"
                  step={f.step}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                  className="mt-1 rounded-none"
                />
              </div>
            ))}
          </div>
          <Button
            onClick={handleSaveMeasurements}
            disabled={savingMeasure}
            className="mt-3 rounded-xl text-[10px] font-bold uppercase tracking-[0.14em]"
          >
            {savingMeasure ? "Saving…" : "Save Measurements"}
          </Button>
        </Panel>

        {/* timeline */}
        <Panel title="PHYSIQUE JOURNEY" subtitle="week 0 baseline → every check-in">
          {state.history.length === 0 ? (
            <p className="text-xs text-muted-foreground">No check-ins yet. Set your baseline to start the timeline.</p>
          ) : (
            <ol className="relative space-y-3 border-l border-border/70 pl-5">
              {state.history.map((h) => (
                <li key={h._id} className="relative">
                  <span className="absolute -left-[26px] top-1.5 size-3 rounded-full border border-primary bg-background shadow-[0_0_8px_var(--neon-glow)]" aria-hidden />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-bold">
                      {h.isBaseline ? "WEEK 0" : `WEEK ${h.weekIndex}`}
                    </span>
                    <TerminalBadge tone="ink">{h.date}</TerminalBadge>
                    {h.physiqueCategory && (
                      <TerminalBadge tone="info">{PHYSIQUE_CATEGORY_LABELS[h.physiqueCategory] ?? h.physiqueCategory}</TerminalBadge>
                    )}
                    {!h.hasPhoto && <TerminalBadge tone="warn">no photo</TerminalBadge>}
                  </div>
                  {h.photoDataUrl && (
                    <img src={h.photoDataUrl} alt={`Physique ${h.date}`} className="mt-2 max-h-40 rounded-lg border border-border object-contain" />
                  )}
                  {h.fitnessStageName && (
                    <p className="mt-1 text-[11px] text-muted-foreground">Stage: {h.fitnessStageName}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Panel>

        {/* compare any two */}
        {state.history.length >= 2 && (
          <Panel title="COMPARE PROGRESS" subtitle="select any two check-ins">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Previous date</label>
                <select
                  value={effectiveFrom}
                  onChange={(e) => setCompareFrom(e.target.value as Id<"physiqueCheckins">)}
                  className="mt-1 w-full border border-input bg-card px-3 py-2 text-sm"
                >
                  {state.history.map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.isBaseline ? "Week 0" : `Week ${h.weekIndex}`} — {h.date}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Current date</label>
                <select
                  value={effectiveTo}
                  onChange={(e) => setCompareTo(e.target.value as Id<"physiqueCheckins">)}
                  className="mt-1 w-full border border-input bg-card px-3 py-2 text-sm"
                >
                  {state.history.map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.isBaseline ? "Week 0" : `Week ${h.weekIndex}`} — {h.date}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[300px_1fr]">
              <PhotoCompare
                beforeSrc={comparison?.from.photoDataUrl}
                afterSrc={comparison?.to.photoDataUrl}
                beforeLabel={comparison ? comparison.from.date : "Previous"}
                afterLabel={comparison ? comparison.to.date : "Current"}
              />
              <div className="space-y-3">
                {comparison ? (
                  <>
                    <DataList title="Visible observations" items={comparison.review.observations} />
                    <DataList title="Measured progress" items={comparison.review.measurements.length ? comparison.review.measurements : ["Not enough measured data to quantify this change."]} />
                    <DataList title="What's going well" items={comparison.review.whatsWorking} />
                    <DataList title="What to improve" items={comparison.review.whatsToImprove} />
                    <DataList title="Next 7 days" items={comparison.review.nextFocus} />
                    <p className="text-[10px] leading-4 text-muted-foreground">{comparison.review.uncertaintyNote}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Select two check-ins to see the review.</p>
                )}
              </div>
            </div>
          </Panel>
        )}

        {/* privacy */}
        <Panel title="PHYSIQUE PRIVACY" subtitle="your physique photo is optional">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => replaceRef.current?.click()} variant="outline" className="rounded-xl text-[10px] uppercase tracking-[0.14em]">
              <Upload className="mr-2 size-4" aria-hidden /> {latest ? "Replace Latest Photo" : "Add Photo Later"}
            </Button>
            <input
              ref={replaceRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const input = e.currentTarget;
                void handleFile(input.files?.[0], true).finally(() => {
                  input.value = "";
                });
              }}
            />
            {latest && (
              <Button
                onClick={() =>
                  deletePhoto({ checkinId: latest._id }).then(() => toast.success("Photo deleted — assessment kept"))
                }
                variant="outline"
                className="rounded-xl text-[10px] uppercase tracking-[0.14em]"
                disabled={!latest.hasPhoto}
              >
                <Trash2 className="mr-2 size-4" aria-hidden /> Delete Latest Photo
              </Button>
            )}
            <Button
              onClick={() => {
                if (window.confirm("Delete your entire physique history (photos + assessments)? This cannot be undone.")) {
                  deleteHistory({}).then(() => toast.success("Physique history deleted"));
                }
              }}
              variant="outline"
              className="rounded-xl border-red-500/40 text-[10px] uppercase tracking-[0.14em] text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="mr-2 size-4" aria-hidden /> Delete Progress History
            </Button>
          </div>
          <p className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" aria-hidden />
            Private by default · never displayed publicly · optional
          </p>
        </Panel>
      </div>
    </AppShell>
  );
}
