import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/AppShell";
import { Panel, TerminalBadge, StatChip, SectionHeader, StatusDot, FieldRow } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router";
import { CATEGORY_LABELS, VERDICT_TONE } from "@/lib/labels";
import { useAuth } from "@/hooks/use-auth";

type EduEntry = {
  slug: string;
  category: string;
  name: string;
  whatIs: string;
  whoMayUse: string;
  evidence: string;
  commonUse: string;
  limitations: string;
  cautionWho: string;
  evidenceLevel: string;
};

type AnalyzeResult = {
  analysisId: string;
  verdict: {
    verdict: string;
    evidenceChecked: string[];
    evidenceMissing: string[];
    redFlags: string[];
    verificationSteps: string[];
    note: string;
  };
  parsed: {
    productName?: string;
    brand?: string;
    category?: string;
    servingSize?: string;
    proteinG?: number;
    calories?: number;
    ingredientNames: string[];
  };
  priceIntel: { pricePerServing?: number; pricePerGram?: number; pricePerProteinGram?: number; note?: string } | null;
  fitnessRelevance: string | null;
  prevalence: string;
};

type AnalysisRow = {
  _id: Id<"supplementAnalysis">;
  productName?: string;
  brand?: string;
  category?: string;
  verdict: string;
  redFlags: string[];
  createdAt: number;
  priceIntel?: { pricePerServing?: number; note?: string };
};

export default function Supplements() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [refreshNonce, setRefreshNonce] = useState(0);

  const profile = useQuery(api.profile.getProfile);
  const ent = useQuery(api.subscriptions.getMyEntitlement, {});
  const library = useQuery(api.supplements.getEducationLibrary, {});
  const analyses = useQuery(api.supplements.getMyAnalyses, { limit: 12, nonce: refreshNonce });
  const verifications = useQuery(api.supplements.getMyVerifications, { nonce: refreshNonce });

  const seedPlans = useMutation(api.subscriptions.seedPlans);
  const ensureSub = useMutation(api.subscriptions.ensureSubscription);
  const analyze = useAction(api.supplements.analyzeLabel);
  const verify = useAction(api.supplements.verifySupplement);

  useEffect(() => {
    seedPlans({}).catch(() => undefined);
    ensureSub({}).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile === null) navigate("/onboarding");
  }, [profile, navigate]);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [labelText, setLabelText] = useState("");
  const [price, setPrice] = useState("");
  const [sizeGrams, setSizeGrams] = useState("");
  const [servings, setServings] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [verifyId, setVerifyId] = useState("");
  const [verifyMethod, setVerifyMethod] = useState<"qr" | "auth_code" | "batch" | "official_website" | "manual">("auth_code");
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  const loading = profile === undefined || ent === undefined || library === undefined;

  const isPremium =
    ent !== undefined &&
    ent !== null &&
    (ent.planSlug !== "free" ||
      (ent.status === "trialing" && ent.trialEndsAt !== null && ent.trialEndsAt > Date.now()));
  // Admins preview premium modules without an entitlement.
  const canAnalyze = isPremium || isAdmin;

  const categories = useMemo(() => {
    if (!library) return [];
    return [...new Set(library.map((e) => e.category))];
  }, [library]);

  const selectedEdu = useMemo(() => {
    if (!library || !selectedSlug) return null;
    return library.find((e) => e.slug === selectedSlug) ?? null;
  }, [library, selectedSlug]);

  const filteredLibrary = useMemo(() => {
    if (!library) return [];
    return categoryFilter === "all" ? library : library.filter((e) => e.category === categoryFilter);
  }, [library, categoryFilter]);

  async function runAnalysis() {
    if (labelText.trim().length < 20) {
      toast.error("Paste more of the label text first.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await analyze({
        rawLabel: labelText,
        pricePaid: price ? Number(price) : undefined,
        sizeGrams: sizeGrams ? Number(sizeGrams) : undefined,
        servings: servings ? Number(servings) : undefined,
      });
      setResult(res as unknown as AnalyzeResult);
      setRefreshNonce((n) => n + 1);
      toast.success("Analysis complete — evidence recorded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runVerify() {
    if (!verifyId.trim()) {
      toast.error("Enter the code / batch / URL from the pack.");
      return;
    }
    setBusy(true);
    try {
      const res = await verify({
        method: verifyMethod,
        identifier: verifyId,
        analysisId: result?.analysisId ? (result.analysisId as Id<"supplementAnalysis">) : undefined,
      });
      setVerifyMsg(res.message);
      setRefreshNonce((n) => n + 1);
      toast.success("Verification attempt recorded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-2 font-mono text-xs text-muted-foreground">
          <p>&gt; loading supplement intelligence…</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                <StatusDot pulse /> MODULE 03 · SUPPLEMENT INTELLIGENCE
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">Supplement Intelligence</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Evidence-based education, label analysis and honest verification guidance. The engine never declares a
                product genuine or fake — only an authoritative brand/regulator check can.
              </p>
            </div>
            <TerminalBadge tone={canAnalyze ? "ok" : "warn"}>
              {canAnalyze ? "MODULE UNLOCKED" : "PREMIUM MODULE"}
            </TerminalBadge>
          </div>
        </Panel>

        {!canAnalyze && (
          <Panel title="PREMIUM MODULE" subtitle="analysis is part of paid plans — education stays free">
            <p className="text-sm text-muted-foreground">
              The education library below is free for everyone. Label analysis and verification tracking are part of the
              paid plans (a 14-day trial is available).
            </p>
            <Button asChild className="mt-3 rounded-none text-[11px] uppercase tracking-[0.14em]">
              <Link to="/subscription">VIEW PLANS &amp; TRIAL →</Link>
            </Button>
          </Panel>
        )}

        {/* Education library */}
        <SectionHeader index="01" title="EDUCATION LIBRARY" hint="what the evidence supports — and what it doesn't" />
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${
              categoryFilter === "all" ? "border-terminal-green/50 bg-[#eef3ea] text-status-ok" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            ALL
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${
                categoryFilter === c ? "border-terminal-green/50 bg-[#eef3ea] text-status-ok" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {CATEGORY_LABELS[c] ?? c}
            </button>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="SUPPLEMENTS" subtitle={`${filteredLibrary.length} entries`}>
            <div className="space-y-1.5">
              {filteredLibrary.map((e) => (
                <button
                  key={e.slug}
                  onClick={() => setSelectedSlug(e.slug)}
                  className={`flex w-full items-center justify-between gap-3 border px-3 py-2 text-left text-sm transition-colors ${
                    selectedSlug === e.slug ? "border-terminal-green/50 bg-[#eef3ea]" : "border-border hover:border-terminal-green/40"
                  }`}
                >
                  <span>
                    <span className="font-semibold">{e.name}</span>
                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                      {CATEGORY_LABELS[e.category] ?? e.category}
                    </span>
                  </span>
                  <TerminalBadge tone={e.evidenceLevel === "strong" ? "ok" : e.evidenceLevel === "moderate" ? "info" : "ink"}>
                    {e.evidenceLevel}
                  </TerminalBadge>
                </button>
              ))}
              {!filteredLibrary.length && <p className="text-xs text-muted-foreground">No entries in this category yet.</p>}
            </div>
          </Panel>
          <Panel title="EVIDENCE PROFILE" subtitle={selectedEdu ? selectedEdu.name : "select a supplement"}>
            {selectedEdu ? (
              <div className="space-y-0">
                <FieldRow label="WHAT IT IS" value={<span className="text-xs">{selectedEdu.whatIs}</span>} />
                <FieldRow label="WHO MAY USE" value={<span className="text-xs">{selectedEdu.whoMayUse}</span>} />
                <FieldRow label="EVIDENCE" value={<span className="text-xs">{selectedEdu.evidence}</span>} />
                <FieldRow label="COMMON USE" value={<span className="text-xs">{selectedEdu.commonUse}</span>} />
                <FieldRow label="LIMITATIONS" value={<span className="text-xs">{selectedEdu.limitations}</span>} />
                <div className="mt-3 border border-terminal-amber/40 bg-[#fdf3e7] p-3 text-xs leading-5 text-status-warn">
                  CAUTION — {selectedEdu.cautionWho}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Pick a supplement from the list to see its evidence profile.</p>
            )}
          </Panel>
        </div>

        {/* Label analyzer */}
        <SectionHeader index="02" title="LABEL ANALYZER" hint="paste label text — deterministic verdict engine" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="INPUT" subtitle="text only — OCR is not available in this build">
            <Textarea
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              placeholder={"Paste the label here, e.g.\n\nWHEY PROTEIN ISOLATE — 2 KG\nServing size: 30 g\nEnergy: 120 kcal  Protein: 25 g  Carbs: 1.5 g  Fat: 0.8 g\nIngredients: Whey protein isolate, cocoa powder, lecithin…\nManufactured by: …  Imported by: …  Batch: …  MRP: ₹…"}
              className="min-h-[180px] rounded-none font-mono text-xs"
            />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">PRICE PAID ₹</label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className="mt-1 rounded-none" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">SIZE G</label>
                <Input value={sizeGrams} onChange={(e) => setSizeGrams(e.target.value)} inputMode="numeric" className="mt-1 rounded-none" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">SERVINGS</label>
                <Input value={servings} onChange={(e) => setServings(e.target.value)} inputMode="numeric" className="mt-1 rounded-none" />
              </div>
            </div>
            <Button onClick={runAnalysis} disabled={busy || !canAnalyze} className="mt-3 w-full rounded-none text-[11px] uppercase tracking-[0.14em]">
              {busy ? "ANALYZING…" : "ANALYZE LABEL →"}
            </Button>
          </Panel>
          <Panel title="ANALYSIS RESULT" subtitle={result ? "deterministic + AI enrichment" : "awaiting input"}>
            {result ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <TerminalBadge tone={VERDICT_TONE[result.verdict.verdict]?.tone ?? "ink"}>
                    {result.verdict.verdict}
                  </TerminalBadge>
                  {result.parsed.brand && <span className="text-sm font-semibold">{result.parsed.brand}</span>}
                  {result.parsed.productName && <span className="text-sm text-muted-foreground">{result.parsed.productName}</span>}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <StatChip label="CATEGORY" value={CATEGORY_LABELS[result.parsed.category ?? ""] ?? result.parsed.category ?? "—"} />
                  <StatChip label="PROTEIN / SERVING" value={result.parsed.proteinG !== undefined ? `${result.parsed.proteinG}g` : "—"} />
                  <StatChip
                    label="₹ / PROTEIN G"
                    value={result.priceIntel?.pricePerProteinGram !== undefined ? `₹${result.priceIntel.pricePerProteinGram.toFixed(2)}` : "—"}
                    tone="info"
                  />
                </div>
                {result.verdict.redFlags.length > 0 && (
                  <div className="border border-terminal-amber/40 bg-[#fdf3e7] p-3 text-xs text-status-warn">
                    <p className="font-semibold">RED FLAGS</p>
                    <ul className="mt-1 list-disc pl-4">
                      {result.verdict.redFlags.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="border border-border p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-status-ok">EVIDENCE CHECKED</p>
                    <ul className="mt-1 list-disc pl-4 text-[11px] text-muted-foreground">
                      {result.verdict.evidenceChecked.map((e) => <li key={e}>{e}</li>)}
                    </ul>
                  </div>
                  <div className="border border-border p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">EVIDENCE MISSING</p>
                    <ul className="mt-1 list-disc pl-4 text-[11px] text-muted-foreground">
                      {result.verdict.evidenceMissing.map((e) => <li key={e}>{e}</li>)}
                    </ul>
                  </div>
                </div>
                {result.fitnessRelevance && (
                  <div className="border border-terminal-cyan/40 bg-[#e8f4f6] p-3 text-xs leading-5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-status-info">FITNESS RELEVANCE (AI · YOUR CONTEXT)</p>
                    <p className="mt-1">{result.fitnessRelevance}</p>
                  </div>
                )}
                <div className="border border-border bg-secondary/50 p-3 text-[11px] leading-5 text-muted-foreground">
                  <p className="font-semibold text-foreground">REALITY CHECK</p>
                  <p className="mt-1">{result.prevalence}</p>
                  <p className="mt-1">{result.verdict.note}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Paste a label and run the analysis. The verdict is computed from what the label does and does not show —
                price is never a red flag.
              </p>
            )}
          </Panel>
        </div>

        {/* Verification */}
        {canAnalyze && (
          <>
            <SectionHeader index="03" title="AUTHENTICITY VERIFICATION" hint="we record attempts — brands confirm" />
            <Panel title="VERIFY A PRODUCT">
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">METHOD</label>
                  <select
                    value={verifyMethod}
                    onChange={(e) => setVerifyMethod(e.target.value as typeof verifyMethod)}
                    className="mt-1 w-full border border-border bg-background px-2 py-2 text-xs"
                  >
                    <option value="auth_code">Auth code</option>
                    <option value="qr">QR code</option>
                    <option value="batch">Batch number</option>
                    <option value="official_website">Official website</option>
                    <option value="manual">Manual (support)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">CODE / BATCH / URL</label>
                  <Input value={verifyId} onChange={(e) => setVerifyId(e.target.value)} className="mt-1 rounded-none" />
                </div>
                <div className="flex items-end">
                  <Button onClick={runVerify} disabled={busy} variant="outline" className="w-full rounded-none text-[10px] uppercase tracking-[0.12em]">
                    RECORD →
                  </Button>
                </div>
              </div>
              {verifyMsg && (
                <p className="mt-3 border border-border bg-secondary/50 p-3 text-xs leading-5">{verifyMsg}</p>
              )}
            </Panel>
          </>
        )}

        {/* History */}
        <SectionHeader index="04" title="MY HISTORY" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="ANALYSES" subtitle={analyses ? `${analyses.length} recorded` : undefined}>
            {analyses && analyses.length > 0 ? (
              <div className="space-y-1.5">
                {analyses.map((a: AnalysisRow) => (
                  <div key={a._id} className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5 text-xs last:border-0">
                    <span>
                      <span className="font-semibold">{a.brand ?? a.productName ?? "Unknown product"}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString()} · {CATEGORY_LABELS[a.category ?? ""] ?? a.category ?? "—"}
                      </span>
                    </span>
                    <TerminalBadge tone={VERDICT_TONE[a.verdict]?.tone ?? "ink"}>
                      {VERDICT_TONE[a.verdict]?.short ?? a.verdict}
                    </TerminalBadge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No analyses yet.</p>
            )}
          </Panel>
          <Panel title="VERIFICATION ATTEMPTS" subtitle={verifications ? `${verifications.length} recorded` : undefined}>
            {verifications && verifications.length > 0 ? (
              <div className="space-y-1.5">
                {verifications.slice(0, 10).map((v) => (
                  <div key={v._id} className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5 text-xs last:border-0">
                    <span className="truncate">
                      {v.method} — <span className="font-mono">{v.identifier.slice(0, 24)}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(v.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No verification attempts yet.</p>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
