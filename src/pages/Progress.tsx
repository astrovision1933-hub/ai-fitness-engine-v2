import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Panel, StatChip, TerminalBadge, AsciiBar } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const FIELDS = [
  { key: "weightKg", label: "WEIGHT (KG)", step: "0.1" },
  { key: "waistCm", label: "WAIST (CM)", step: "0.5" },
  { key: "chestCm", label: "CHEST (CM)", step: "0.5" },
  { key: "armCm", label: "ARM (CM)", step: "0.5" },
  { key: "legCm", label: "LEGS (CM)", step: "0.5" },
  { key: "shoulderCm", label: "SHOULDERS (CM)", step: "0.5" },
  { key: "bodyFatPct", label: "BODY-FAT % (OPTIONAL)", step: "0.5" },
] as const;

export default function Progress() {
  const navigate = useNavigate();

  const summary = useQuery(api.progress.getProgressSummary, {});
  const photos = useQuery(api.progress.getProgressPhotos, {});
  const reviews = useQuery(api.progress.getWeeklyReviews, {});
  const milestones = useQuery(api.progress.getMilestones, {});

  const addMeasurement = useMutation(api.progress.addBodyMeasurement);
  const addPhoto = useMutation(api.progress.addProgressPhoto);
  const deletePhoto = useMutation(api.progress.deleteProgressPhoto);
  const generateReview = useMutation(api.progress.generateWeeklyReview);

  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pose, setPose] = useState<"front" | "side" | "back">("front");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (summary === null) navigate("/onboarding", { replace: true });
  }, [summary, navigate]);

  async function handleSaveMeasurement() {
    const payload: Record<string, number> = {};
    for (const f of FIELDS) {
      const v = values[f.key];
      if (v) payload[f.key] = Number(v);
    }
    if (Object.keys(payload).length === 0) {
      toast.error("Enter at least one value");
      return;
    }
    setSaving(true);
    try {
      await addMeasurement(payload);
      toast.success("Measurement saved", { description: "Trends update as you add more entries." });
      setValues({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(file: File) {
    // Downscale client-side to keep storage small; private to the user.
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img = new Image();
    img.src = dataUrl;
    await new Promise((r) => (img.onload = r));
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 480 / img.width);
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const small = canvas.toDataURL("image/jpeg", 0.75);
    try {
      await addPhoto({ pose, dataUrl: small });
      toast.success("Photo saved — private to your account");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save photo");
    }
  }

  if (!summary) {
    return (
      <AppShell>
        <p className="text-xs text-muted-foreground">&gt; loading progress module…</p>
      </AppShell>
    );
  }

  const chartData = summary.measurements
    .filter((m) => m.weightKg != null)
    .map((m) => ({ date: m.date.slice(5), weight: m.weightKg, waist: m.waistCm ?? undefined }));

  const latest = summary.measurements[summary.measurements.length - 1];
  const first = summary.measurements[0];
  const weightDelta =
    latest?.weightKg != null && first?.weightKg != null
      ? Number((latest.weightKg - first.weightKg).toFixed(1))
      : null;

  const latestReview = reviews?.[0];

  return (
    <AppShell>
      <div className="space-y-4">
        <Panel title="PROGRESS ENGINE" subtitle="trends over time — one data point never tells the story">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatChip label="WEIGHT DELTA" value={weightDelta === null ? "—" : `${weightDelta > 0 ? "+" : ""}${weightDelta}kg`} tone={weightDelta === null ? "ink" : weightDelta <= 0 ? "ok" : "warn"} />
            <StatChip label="ENTRIES" value={summary.measurements.length} />
            <StatChip label="WORKOUT ADHERENCE" value={`${Math.round(summary.adherence * 100)}%`} tone="ok" />
            <StatChip label="PHOTOS" value={photos?.length ?? 0} tone="info" />
          </div>
        </Panel>

        {/* charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="WEIGHT TREND">
            {chartData.length >= 2 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="#e3e1d8" strokeDasharray="2 4" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "inherit" }} stroke="#6b6b64" />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fontFamily: "inherit" }} stroke="#6b6b64" />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: "1px solid #e3e1d8" }} />
                    <Line type="monotone" dataKey="weight" stroke="#1f7a33" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Log weight at least twice to draw a trend line.</p>
            )}
          </Panel>

          <Panel title="WAIST TREND">
            {chartData.some((d) => d.waist) ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.filter((d) => d.waist)} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="#e3e1d8" strokeDasharray="2 4" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "inherit" }} stroke="#6b6b64" />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fontFamily: "inherit" }} stroke="#6b6b64" />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: "1px solid #e3e1d8" }} />
                    <Line type="monotone" dataKey="waist" stroke="#b45309" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Add waist measurements to track this trend.</p>
            )}
          </Panel>
        </div>

        {/* measurement entry */}
        <Panel title="LOG MEASUREMENT" subtitle="tape-measure accuracy beats precision — same conditions each time">
          <div className="grid gap-2 sm:grid-cols-4">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{f.label}</label>
                <Input
                  type="number"
                  step={f.step}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="mt-1 h-8 rounded-none"
                />
              </div>
            ))}
          </div>
          <Button
            className="mt-3 rounded-none text-[11px] uppercase tracking-[0.12em]"
            onClick={handleSaveMeasurement}
            disabled={saving}
          >
            SAVE MEASUREMENT ✓
          </Button>
        </Panel>

        {/* weekly review */}
        <Panel
          title="WEEKLY AI REVIEW"
          subtitle={latestReview ? `week of ${latestReview.weekStart}` : "not generated yet"}
          right={
            <Button
              size="sm"
              variant="outline"
              className="rounded-none text-[10px] uppercase tracking-[0.12em]"
              onClick={async () => {
                try {
                  await generateReview({});
                  toast.success("Weekly review ready");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              GENERATE REVIEW
            </Button>
          }
        >
          {latestReview ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <ReviewRow label="WORKOUT ADHERENCE" value={latestReview.workoutAdherence} />
                <ReviewRow label="NUTRITION ADHERENCE" value={latestReview.nutritionAdherence} />
                <ReviewRow label="PROTEIN CONSISTENCY" value={latestReview.proteinConsistency} />
                <div className="flex justify-between border-b border-border/60 py-1 text-xs">
                  <span className="uppercase tracking-[0.12em] text-muted-foreground">WEIGHT TREND</span>
                  <span>{latestReview.weightTrend}</span>
                </div>
                <div className="flex justify-between border-b border-border/60 py-1 text-xs">
                  <span className="uppercase tracking-[0.12em] text-muted-foreground">ACTIVITY TREND</span>
                  <span>{latestReview.activityTrend}</span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm leading-6">{latestReview.summary}</p>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-warn">OBSTACLES</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {latestReview.obstacles.map((o) => (
                      <li key={o}>· {o}</li>
                    ))}
                    {latestReview.obstacles.length === 0 && <li>· none flagged</li>}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-ok">NEXT WEEK PRIORITIES</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {latestReview.nextWeekPriorities.map((p) => (
                      <li key={p}>· {p}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Generate your first weekly review — it analyzes the last 7 days of logged data.</p>
          )}
        </Panel>

        {/* photos */}
        <Panel title="PROGRESS PHOTOS" subtitle="optional · private by default · delete anytime">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {(["front", "side", "back"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPose(p)}
                  className={
                    pose === p
                      ? "border border-terminal-green bg-[#eef3ea] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-status-ok"
                      : "border border-border bg-card px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
                  }
                >
                  {p}
                </button>
              ))}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handlePhoto(f);
                  e.target.value = "";
                }}
              />
              <Button size="sm" variant="outline" className="rounded-none text-[10px] uppercase tracking-[0.12em]" onClick={() => fileRef.current?.click()}>
                UPLOAD PHOTO
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Same pose, lighting and time of day makes comparisons meaningful. Photos never leave your account.
            </p>
            {photos && photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {photos.map((p) => (
                  <div key={p._id} className="group relative border border-border">
                    {p.dataUrl ? (
                      <img src={p.dataUrl} alt={`${p.pose} ${p.date}`} className="aspect-[3/4] w-full object-cover" />
                    ) : (
                      <div className="flex aspect-[3/4] items-center justify-center text-[10px] text-muted-foreground">no preview</div>
                    )}
                    <div className="flex items-center justify-between px-1 py-0.5 text-[9px] text-muted-foreground">
                      <span>{p.pose} · {p.date.slice(5)}</span>
                      <button
                        className="text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={async () => {
                          await deletePhoto({ photoId: p._id });
                          toast.success("Photo deleted");
                        }}
                      >
                        DEL
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No photos yet.</p>
            )}
          </div>
        </Panel>

        {/* milestones */}
        <Panel title="STREAKS & MILESTONES">
          {milestones && milestones.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {milestones.map((m) => (
                <TerminalBadge key={m._id} tone="ok">
                  ★ {m.title}
                </TerminalBadge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Milestones unlock at streak thresholds (1, 3, 7, 14, 30… days). Check in daily to build them.
            </p>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

function ReviewRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        <span className="font-semibold">{Math.round(value * 100)}%</span>
      </div>
      <AsciiBar value={value} width={18} />
    </div>
  );
}
