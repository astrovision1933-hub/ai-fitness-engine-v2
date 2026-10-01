import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/AppShell";
import { Panel, TerminalBadge, SectionHeader, StatusDot } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router";
import { CATEGORY_LABELS } from "@/lib/labels";

type CatalogProduct = Doc<"productCatalog">;

type SavedRecommendation = {
  _id: Id<"productRecommendations">;
  productId: Id<"productCatalog">;
  reason: string;
  userContext?: string;
  disclosure: string;
  alternatives?: string;
  status: string;
  createdAt: number;
  product: CatalogProduct;
};

export default function Products() {
  const navigate = useNavigate();
  const profile = useQuery(api.profile.getProfile);
  const ent = useQuery(api.subscriptions.getMyEntitlement, {});
  const products = useQuery(api.products.listProducts, {});
  const savedRecs = useQuery(api.products.getSavedRecommendations, {});

  const seedPlans = useMutation(api.subscriptions.seedPlans);
  const ensureSub = useMutation(api.subscriptions.ensureSubscription);
  const checkPrice = useMutation(api.products.checkPrice);
  const compare = useAction(api.products.compareProducts);
  const generateRecs = useAction(api.products.generateRecommendations);
  const setRecStatus = useMutation(api.products.setRecommendationStatus);
  const logInterest = useMutation(api.products.logProductInterest);

  useEffect(() => {
    seedPlans({}).catch(() => undefined);
    ensureSub({}).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile === null) navigate("/onboarding");
  }, [profile, navigate]);

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [detailId, setDetailId] = useState<Id<"productCatalog"> | null>(null);
  const [priceForm, setPriceForm] = useState({ product: "", brand: "", price: "", sizeGrams: "", servings: "", proteinG: "" });
  const [priceResult, setPriceResult] = useState<{ pricePerServing?: number; pricePerGram?: number; pricePerProteinGram?: number; note?: string } | null>(null);
  const [compareA, setCompareA] = useState<Id<"productCatalog"> | null>(null);
  const [compareB, setCompareB] = useState<Id<"productCatalog"> | null>(null);
  const [comparison, setComparison] = useState<{ metrics: Array<{ label: string; a: string; b: string; note?: string }>; summary: string } | null>(null);
  const [compareBusy, setCompareBusy] = useState(false);
  const [recResult, setRecResult] = useState<{ items: Array<{ recommendationId: Id<"productRecommendations">; product: CatalogProduct | null; reason: string; alternatives: string[] }>; note: string } | null>(null);
  const [recBusy, setRecBusy] = useState(false);

  const loading = profile === undefined || ent === undefined || products === undefined;

  const isPremium =
    ent !== undefined &&
    ent !== null &&
    (ent.planSlug !== "free" ||
      (ent.status === "trialing" && ent.trialEndsAt !== null && ent.trialEndsAt > Date.now()));

  const filtered = useMemo(
    () => (products ?? []).filter((p) => categoryFilter === "all" || p.category === categoryFilter),
    [products, categoryFilter],
  );
  const detail = useMemo(() => (products ?? []).find((p) => p._id === detailId) ?? null, [products, detailId]);
  const categories = useMemo(() => [...new Set((products ?? []).map((p) => p.category))], [products]);

  async function runCheckPrice() {
    if (!priceForm.price || !priceForm.product) {
      toast.error("Product name and price paid are required.");
      return;
    }
    try {
      const intel = await checkPrice({
        brand: priceForm.brand || "unlisted",
        product: priceForm.product,
        price: Number(priceForm.price),
        sizeGrams: priceForm.sizeGrams ? Number(priceForm.sizeGrams) : undefined,
        servings: priceForm.servings ? Number(priceForm.servings) : undefined,
        proteinPerServingG: priceForm.proteinG ? Number(priceForm.proteinG) : undefined,
      });
      setPriceResult(intel as typeof priceResult);
      toast.success("Unit economics computed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Price check failed.");
    }
  }

  async function runCompare() {
    if (!compareA || !compareB || compareA === compareB) {
      toast.error("Pick two different products.");
      return;
    }
    setCompareBusy(true);
    try {
      const res = await compare({ productAId: compareA, productBId: compareB });
      setComparison(res);
      toast.success("Comparison ready.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Comparison failed.");
    } finally {
      setCompareBusy(false);
    }
  }

  async function runRecommendations() {
    setRecBusy(true);
    try {
      const res = await generateRecs({ max: 2 });
      setRecResult(res);
      if (res.items.length === 0) toast.message("No recommendation generated", { description: res.note });
      else toast.success("Recommendation generated from approved catalog.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Recommendation failed.");
    } finally {
      setRecBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-2 font-mono text-xs text-muted-foreground">
          <p>&gt; loading product intelligence…</p>
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
                <StatusDot pulse /> MODULE 04 · PRODUCT INTELLIGENCE
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">Product Intelligence</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Admin-approved catalog, unit-economics price check, side-by-side comparison and context-aware
                recommendations. Price is never treated as evidence of authenticity.
              </p>
            </div>
            <TerminalBadge tone={isPremium ? "ok" : "warn"}>
              {isPremium ? "FULL ACCESS" : "BASIC ACCESS"}
            </TerminalBadge>
          </div>
        </Panel>

        {/* Catalog */}
        <SectionHeader index="01" title="APPROVED CATALOG" hint="admin-maintained data · not marketplace listings" />
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
        {filtered.length === 0 ? (
          <Panel>
            <p className="text-sm text-muted-foreground">
              The catalog is empty — an administrator adds products before they appear here. Nothing is scraped or
              auto-listed.
            </p>
          </Panel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <Panel key={p._id} className="flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.brand}</p>
                      <h3 className="text-sm font-semibold leading-5">{p.name}</h3>
                    </div>
                    <TerminalBadge tone={p.stockStatus === "in_stock" ? "ok" : "ink"}>{p.stockStatus.replace("_", " ")}</TerminalBadge>
                  </div>
                  <p className="mt-2 text-lg font-bold">
                    ₹{p.price}
                    {p.mrp && p.mrp > p.price && <span className="ml-2 text-xs font-normal text-muted-foreground line-through">₹{p.mrp}</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {CATEGORY_LABELS[p.category] ?? p.category}
                    {p.servings ? ` · ${p.servings} servings` : ""}
                    {p.nutrition?.proteinG ? ` · ${p.nutrition.proteinG}g protein/serving` : ""}
                  </p>
                  {p.servings ? (
                    <p className="mt-1 text-[11px] text-status-info">₹{(p.price / p.servings).toFixed(2)} / serving</p>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-none text-[10px] uppercase tracking-[0.12em]"
                    onClick={() => setDetailId(p._id)}
                  >
                    DETAILS
                  </Button>
                  <Button
                    size="sm"
                    variant={compareA === p._id ? "default" : "outline"}
                    className="rounded-none text-[10px] uppercase tracking-[0.12em]"
                    onClick={() => setCompareA(compareA === p._id ? null : p._id)}
                  >
                    {compareA === p._id ? "SLOT A ✓" : "CMP A"}
                  </Button>
                  <Button
                    size="sm"
                    variant={compareB === p._id ? "default" : "outline"}
                    className="rounded-none text-[10px] uppercase tracking-[0.12em]"
                    onClick={() => setCompareB(compareB === p._id ? null : p._id)}
                  >
                    {compareB === p._id ? "SLOT B ✓" : "CMP B"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-none text-[10px] uppercase tracking-[0.12em]"
                    onClick={() => logInterest({ productId: p._id }).catch(() => undefined)}
                  >
                    INTERESTED
                  </Button>
                </div>
              </Panel>
            ))}
          </div>
        )}

        {/* Detail drawer */}
        {detail && (
          <Panel
            title={`PRODUCT DETAIL — ${detail.brand} ${detail.name}`}
            right={
              <Button size="sm" variant="ghost" className="rounded-none text-[10px]" onClick={() => setDetailId(null)}>
                CLOSE ✕
              </Button>
            }
          >
            <div className="grid gap-4 text-xs sm:grid-cols-2">
              <div className="space-y-1">
                <p><span className="font-semibold">Price:</span> ₹{detail.price}{detail.mrp ? ` (MRP ₹${detail.mrp})` : ""}</p>
                <p><span className="font-semibold">Serving:</span> {detail.servingSize ?? "—"}{detail.servings ? ` × ${detail.servings}` : ""}</p>
                <p><span className="font-semibold">Nutrition/serving:</span> {detail.nutrition?.proteinG ?? "?"}g protein · {detail.nutrition?.calories ?? "?"} kcal</p>
                <p><span className="font-semibold">Manufacturer:</span> {detail.manufacturer ?? "not listed"}</p>
                <p><span className="font-semibold">Distributor:</span> {detail.distributor ?? "not listed"}</p>
              </div>
              <div className="space-y-1">
                <p><span className="font-semibold">Verification:</span> {detail.verificationMethod ?? "not listed"}</p>
                {detail.verificationUrl && (
                  <p className="break-all"><span className="font-semibold">Verify at:</span> {detail.verificationUrl}</p>
                )}
                {detail.batchInstructions && <p><span className="font-semibold">Batch check:</span> {detail.batchInstructions}</p>}
                <p><span className="font-semibold">Ingredients:</span> {detail.ingredients ?? "not listed"}</p>
                {detail.warnings && <p className="text-status-warn"><span className="font-semibold">Warnings:</span> {detail.warnings}</p>}
              </div>
            </div>
            {detail.benefits && <p className="mt-3 border-l-2 border-terminal-cyan/50 pl-2 text-xs text-muted-foreground">{detail.benefits}</p>}
            {detail.usage && <p className="mt-2 text-xs text-muted-foreground"><span className="font-semibold">Usage:</span> {detail.usage}</p>}
          </Panel>
        )}

        {/* Price intel */}
        <SectionHeader index="02" title="PRICE INTEL" hint="unit economics on anything you bought" />
        <Panel>
          <div className="grid gap-2 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">PRODUCT *</label>
              <Input value={priceForm.product} onChange={(e) => setPriceForm({ ...priceForm, product: e.target.value })} className="mt-1 rounded-none" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">BRAND</label>
              <Input value={priceForm.brand} onChange={(e) => setPriceForm({ ...priceForm, brand: e.target.value })} className="mt-1 rounded-none" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">PAID ₹ *</label>
              <Input value={priceForm.price} onChange={(e) => setPriceForm({ ...priceForm, price: e.target.value })} inputMode="decimal" className="mt-1 rounded-none" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">SIZE G</label>
              <Input value={priceForm.sizeGrams} onChange={(e) => setPriceForm({ ...priceForm, sizeGrams: e.target.value })} inputMode="numeric" className="mt-1 rounded-none" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">SERVINGS</label>
              <Input value={priceForm.servings} onChange={(e) => setPriceForm({ ...priceForm, servings: e.target.value })} inputMode="numeric" className="mt-1 rounded-none" />
            </div>
          </div>
          <Button onClick={runCheckPrice} variant="outline" className="mt-3 rounded-none text-[10px] uppercase tracking-[0.12em]">
            COMPUTE →
          </Button>
          {priceResult && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="border border-border bg-secondary/50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">₹ / SERVING</p>
                <p className="text-lg font-semibold">{priceResult.pricePerServing !== undefined ? `₹${priceResult.pricePerServing.toFixed(2)}` : "—"}</p>
              </div>
              <div className="border border-border bg-secondary/50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">₹ / GRAM</p>
                <p className="text-lg font-semibold">{priceResult.pricePerGram !== undefined ? `₹${priceResult.pricePerGram.toFixed(2)}` : "—"}</p>
              </div>
              <div className="border border-border bg-secondary/50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">₹ / G PROTEIN</p>
                <p className="text-lg font-semibold">{priceResult.pricePerProteinGram !== undefined ? `₹${priceResult.pricePerProteinGram.toFixed(2)}` : "—"}</p>
              </div>
              {priceResult.note && (
                <div className="col-span-2 border border-border bg-secondary/50 px-3 py-2 sm:col-span-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">NOTE</p>
                  <p className="text-xs">{priceResult.note}</p>
                </div>
              )}
            </div>
          )}
        </Panel>

        {/* Comparison */}
        <SectionHeader index="03" title="COMPARE" hint="facts side by side — no 'winner' declared" />
        <Panel>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <TerminalBadge tone="info">SLOT A: {compareA ? (products ?? []).find((p) => p._id === compareA)?.name ?? "selected" : "empty"}</TerminalBadge>
            <TerminalBadge tone="info">SLOT B: {compareB ? (products ?? []).find((p) => p._id === compareB)?.name ?? "selected" : "empty"}</TerminalBadge>
            <Button onClick={runCompare} disabled={compareBusy} size="sm" className="rounded-none text-[10px] uppercase tracking-[0.12em]">
              {compareBusy ? "COMPARING…" : "COMPARE →"}
            </Button>
          </div>
          {comparison && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-1.5 pr-3">Metric</th>
                    <th className="py-1.5 pr-3">A</th>
                    <th className="py-1.5 pr-3">B</th>
                    <th className="py-1.5">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.metrics.map((m) => (
                    <tr key={m.label} className="border-b border-border/60">
                      <td className="py-1.5 pr-3 font-medium">{m.label}</td>
                      <td className="py-1.5 pr-3">{m.a}</td>
                      <td className="py-1.5 pr-3">{m.b}</td>
                      <td className="py-1.5 text-[10px] text-muted-foreground">{m.note ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 border border-terminal-cyan/40 bg-[#e8f4f6] p-3 text-xs leading-5">{comparison.summary}</p>
            </div>
          )}
        </Panel>

        {/* Recommendations */}
        <SectionHeader index="04" title="RECOMMENDATION ENGINE" hint="your goal + budget + admin rules → approved products only" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="GENERATE">
            <p className="text-xs leading-5 text-muted-foreground">
              Combines your active goal, nutrition profile, budget and experience against admin-configured rules and the
              approved catalog. The engine will not recommend without a matching rule, and every output carries a
              disclosure.
            </p>
            <Button onClick={runRecommendations} disabled={recBusy} className="mt-3 rounded-none text-[11px] uppercase tracking-[0.14em]">
              {recBusy ? "GENERATING…" : "GENERATE RECOMMENDATION →"}
            </Button>
            {recResult?.items.length ? (
              <div className="mt-3 space-y-2">
                {recResult.items.map((item) => (
                  <div key={item.recommendationId} className="border border-terminal-green/40 bg-[#eef3ea] p-3">
                    <p className="text-sm font-semibold">{item.product ? `${item.product.brand} ${item.product.name}` : "Product unavailable"}</p>
                    <p className="mt-1 text-xs leading-5">{item.reason}</p>
                    {item.alternatives.length > 0 && (
                      <p className="mt-1 text-[10px] text-muted-foreground">Alternatives: {item.alternatives.join(" · ")}</p>
                    )}
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground">{recResult.note}</p>
              </div>
            ) : recResult ? (
              <p className="mt-3 border border-terminal-amber/40 bg-[#fdf3e7] p-3 text-xs">{recResult.note}</p>
            ) : null}
          </Panel>
          <Panel title="SAVED RECOMMENDATIONS" subtitle={savedRecs ? `${savedRecs.length} recent` : undefined}>
            {savedRecs && savedRecs.length > 0 ? (
              <div className="space-y-2">
                {savedRecs.map((r: SavedRecommendation) => (
                  <div key={r._id} className="border border-border p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{r.product.brand} {r.product.name}</span>
                      <TerminalBadge tone={r.status === "accepted" ? "ok" : r.status === "dismissed" ? "ink" : "info"}>{r.status}</TerminalBadge>
                    </div>
                    <p className="mt-1 leading-5 text-muted-foreground">{r.reason}</p>
                    {r.alternatives && <p className="mt-1 text-[10px] text-muted-foreground">Alternatives: {r.alternatives}</p>}
                    <p className="mt-1 text-[10px] italic text-muted-foreground">{r.disclosure}</p>
                    {r.status === "shown" && (
                      <div className="mt-2 flex gap-1.5">
                        <Button size="sm" variant="outline" className="rounded-none text-[10px]" onClick={() => setRecStatus({ id: r._id, status: "accepted" })}>
                          ACCEPT
                        </Button>
                        <Button size="sm" variant="ghost" className="rounded-none text-[10px]" onClick={() => setRecStatus({ id: r._id, status: "dismissed" })}>
                          DISMISS
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No recommendations generated yet.</p>
            )}
          </Panel>
        </div>

        {!isPremium && (
          <Panel title="GOING PREMIUM" subtitle="optional — what paid plans add">
            <p className="text-xs text-muted-foreground">
              The catalog and price intel stay available to everyone. AI-explained comparisons, personalized
              recommendations and saved history are part of paid plans (14-day trial available).{" "}
              <Link to="/subscription" className="font-semibold text-status-ok underline underline-offset-4">
                VIEW PLANS →
              </Link>
            </p>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
