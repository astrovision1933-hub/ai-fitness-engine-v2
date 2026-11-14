import { useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Panel, TerminalBadge, SectionHeader, StatusDot } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SITE_FONTS, SITE_THEMES, useSiteCustomization } from "@/lib/site-theme";
import { fileToDownscaledDataUrl } from "@/lib/photo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ImagePlus, Loader2, Ticket, Trash2 } from "lucide-react";

const TEXT_FIELDS: Array<{ key: string; label: string; multiline?: boolean }> = [
  { key: "hero.badge", label: "HOME BADGE LINE" },
  { key: "hero.line1", label: "HEADLINE — LINE 1" },
  { key: "hero.line2", label: "HEADLINE — LINE 2 (HIGHLIGHTED)" },
  { key: "hero.line3", label: "HEADLINE — LINE 3" },
  { key: "hero.body", label: "HERO DESCRIPTION", multiline: true },
  { key: "hero.getStarted", label: "PRIMARY BUTTON (NEW VISITOR)" },
  { key: "hero.openCenter", label: "PRIMARY BUTTON (SIGNED IN)" },
];

const PLANS = [
  { value: "premium", label: "Premium" },
  { value: "pro_coach", label: "Pro Coach" },
  { value: "competition", label: "Competition" },
];

export function AdminSitePanel() {
  const customization = useSiteCustomization();

  /* ---------------- appearance ---------------- */
  const setTheme = useMutation(api.site.setTheme);
  const setFont = useMutation(api.site.setFont);
  const setTextOverrides = useMutation(api.site.setTextOverrides);

  const [textDraft, setTextDraft] = useState<Record<string, string>>({});
  const [savingText, setSavingText] = useState(false);

  async function applyTheme(id: string) {
    try {
      await setTheme({ theme: id });
      toast.success("Theme applied across the whole app");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not apply theme");
    }
  }

  async function applyFont(id: string) {
    try {
      await setFont({ font: id });
      toast.success("Font applied across the whole app");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not apply font");
    }
  }

  async function saveText() {
    setSavingText(true);
    try {
      const merged = { ...customization.textOverrides, ...textDraft };
      await setTextOverrides({ overrides: merged });
      setTextDraft({});
      toast.success("Home page text updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save text");
    } finally {
      setSavingText(false);
    }
  }

  async function resetText() {
    try {
      await setTextOverrides({ overrides: {} });
      setTextDraft({});
      toast.success("Home page text reset to defaults");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset text");
    }
  }

  /* ---------------- banners ---------------- */
  const banners = useQuery(api.site.listBannersAdmin);
  const addBanner = useMutation(api.site.addBanner);
  const toggleBanner = useMutation(api.site.toggleBanner);
  const deleteBanner = useMutation(api.site.deleteBanner);

  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [bannerLink, setBannerLink] = useState("");
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerBusy, setBannerBusy] = useState(false);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  async function handleBannerFile(file: File | undefined) {
    if (!file) return;
    setBannerBusy(true);
    try {
      // Any source dimensions are fine — this scales to a sane width and the
      // home page keeps the aspect ratio (object-contain).
      const dataUrl = await fileToDownscaledDataUrl(file, 1600, 0.82);
      setBannerImage(dataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that image");
    } finally {
      setBannerBusy(false);
    }
  }

  async function saveBanner() {
    if (!bannerImage) {
      toast.error("Choose a banner image first");
      return;
    }
    setBannerBusy(true);
    try {
      await addBanner({
        imageDataUrl: bannerImage,
        linkUrl: bannerLink.trim() || undefined,
        title: bannerTitle.trim() || undefined,
      });
      setBannerImage(null);
      setBannerLink("");
      setBannerTitle("");
      toast.success("Banner saved — it is live on the home page now");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save banner");
    } finally {
      setBannerBusy(false);
    }
  }

  /* ---------------- coupons ---------------- */
  const coupons = useQuery(api.site.listCoupons);
  const createCoupon = useMutation(api.site.createCoupon);
  const toggleCoupon = useMutation(api.site.toggleCoupon);
  const deleteCoupon = useMutation(api.site.deleteCoupon);

  const [couponCode, setCouponCode] = useState("");
  const [couponPlan, setCouponPlan] = useState("premium");
  const [couponDays, setCouponDays] = useState("0");
  const [couponUses, setCouponUses] = useState("0");
  const [couponNote, setCouponNote] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);

  async function createCouponSubmit() {
    if (!couponCode.trim()) {
      toast.error("Enter a coupon code");
      return;
    }
    setCouponBusy(true);
    try {
      const res = await createCoupon({
        code: couponCode,
        planSlug: couponPlan,
        durationDays: Number(couponDays) || 0,
        maxUses: Number(couponUses) || 0,
        note: couponNote.trim() || undefined,
      });
      setCouponCode("");
      setCouponNote("");
      toast.success(`Coupon ${res.code} created`, {
        description: "Users can redeem it on the Plan page for free access.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create coupon");
    } finally {
      setCouponBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          <StatusDot pulse /> SITE CONTROL · THEME / FONT / TEXT / BANNERS / COUPONS
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Website Studio</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Theme, typography and home-page copy change instantly for every visitor. Banners go live
          the moment you save them, and coupons give customers a free paid plan.
        </p>
      </Panel>

      {/* ---------------- THEMES ---------------- */}
      <SectionHeader index="01" title="THEME PRESETS" hint="10 themes · applies everywhere" />
      <Panel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {SITE_THEMES.map((theme) => {
            const active = customization.theme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => applyTheme(theme.id)}
                className={cn(
                  "border p-2.5 text-left transition-colors",
                  active ? "border-terminal-green bg-secondary" : "border-border bg-card hover:border-muted-foreground/40",
                )}
              >
                <span className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold">{theme.name}</span>
                  {active && <TerminalBadge tone="ok">LIVE</TerminalBadge>}
                </span>
                <span className="mt-2 flex gap-1">
                  {[theme.vars["--background"], theme.vars["--card"], theme.vars["--primary"], theme.vars["--foreground"]].map(
                    (color, i) => (
                      <span
                        key={i}
                        className="h-4 flex-1 border border-border/60"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                    ),
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* ---------------- FONTS ---------------- */}
      <SectionHeader index="02" title="FONT PRESET" hint="body + display typography" />
      <Panel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SITE_FONTS.map((font) => {
            const active = customization.font === font.id;
            return (
              <button
                key={font.id}
                type="button"
                onClick={() => applyFont(font.id)}
                className={cn(
                  "border px-3 py-2 text-left text-xs transition-colors",
                  active ? "border-terminal-green bg-secondary text-status-ok" : "border-border bg-card hover:border-muted-foreground/40",
                )}
                style={{ fontFamily: font.body }}
              >
                <span className="font-semibold">{font.name}</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">Aa Bb Cc 123</span>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* ---------------- TEXT ---------------- */}
      <SectionHeader index="03" title="HOME PAGE TEXT" hint="leave empty to keep the default copy" />
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2">
          {TEXT_FIELDS.map((field) => (
            <div key={field.key} className={field.multiline ? "sm:col-span-2" : undefined}>
              <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {field.label}
              </label>
              {field.multiline ? (
                <textarea
                  rows={3}
                  value={textDraft[field.key] ?? customization.textOverrides[field.key] ?? ""}
                  onChange={(e) => setTextDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                  placeholder="Default copy stays if you leave this empty"
                  className="mt-1 w-full border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                />
              ) : (
                <Input
                  value={textDraft[field.key] ?? customization.textOverrides[field.key] ?? ""}
                  onChange={(e) => setTextDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                  placeholder="Default copy stays if you leave this empty"
                  className="mt-1 rounded-none"
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="rounded-none text-[10px] uppercase tracking-[0.14em]" onClick={saveText} disabled={savingText}>
            {savingText ? "SAVING…" : "SAVE TEXT"}
          </Button>
          <Button variant="outline" className="rounded-none text-[10px] uppercase tracking-[0.14em]" onClick={resetText}>
            RESET TO DEFAULT
          </Button>
        </div>
      </Panel>

      {/* ---------------- BANNERS ---------------- */}
      <SectionHeader index="04" title="HOME PAGE BANNERS" hint="any size · auto-fits the home page" />
      <Panel>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-2.5">
            <input
              ref={bannerFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const input = e.currentTarget;
                void handleBannerFile(input.files?.[0]).finally(() => {
                  input.value = "";
                });
              }}
            />
            <Button
              variant="outline"
              className="rounded-none text-[10px] uppercase tracking-[0.14em]"
              onClick={() => bannerFileRef.current?.click()}
              disabled={bannerBusy}
            >
              {bannerBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ImagePlus className="mr-2 size-4" />}
              CHOOSE BANNER IMAGE
            </Button>
            <Input
              value={bannerTitle}
              onChange={(e) => setBannerTitle(e.target.value)}
              placeholder="Banner title (optional, for accessibility)"
              className="rounded-none"
            />
            <Input
              value={bannerLink}
              onChange={(e) => setBannerLink(e.target.value)}
              placeholder="Click link (optional) — https://… or /subscription"
              className="rounded-none"
            />
            {bannerImage && (
              <img
                src={bannerImage}
                alt="Banner preview"
                className="max-h-48 w-full rounded-lg border border-border object-contain"
              />
            )}
            <Button
              className="rounded-none text-[10px] uppercase tracking-[0.14em]"
              onClick={saveBanner}
              disabled={bannerBusy || !bannerImage}
            >
              SAVE BANNER → GO LIVE
            </Button>
            <p className="text-[10px] leading-4 text-muted-foreground">
              Any dimensions work: the home page scales the banner to full width and keeps its
              aspect ratio, so nothing is cropped or stretched.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              LIVE BANNERS ({banners?.length ?? 0})
            </p>
            {(banners ?? []).map((b) => (
              <div key={b._id} className="flex items-center gap-2 border border-border bg-card p-2">
                <img src={b.imageDataUrl} alt={b.title ?? "Banner"} className="h-12 w-20 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{b.title ?? "Untitled banner"}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {b.linkUrl ?? "no link"} · used {new Date(b.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <TerminalBadge tone={b.isActive ? "ok" : "ink"}>{b.isActive ? "LIVE" : "HIDDEN"}</TerminalBadge>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-none text-[9px] uppercase"
                  onClick={() => toggleBanner({ bannerId: b._id }).catch(() => toast.error("Could not update banner"))}
                >
                  {b.isActive ? "HIDE" : "SHOW"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-none border-red-500/40 text-[9px] uppercase text-red-300"
                  onClick={() => {
                    if (!window.confirm("Delete this banner?")) return;
                    void deleteBanner({ bannerId: b._id })
                      .then(() => toast.success("Banner deleted"))
                      .catch(() => toast.error("Could not delete banner"));
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            {banners?.length === 0 && (
              <p className="text-xs text-muted-foreground">No banners yet — upload one above.</p>
            )}
          </div>
        </div>
      </Panel>

      {/* ---------------- COUPONS ---------------- */}
      <SectionHeader index="05" title="FREE-SUBSCRIPTION COUPONS" hint="customers redeem on the Plan page" />
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">COUPON CODE</label>
            <Input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="LAUNCH2026"
              className="mt-1 rounded-none font-mono uppercase"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">PLAN GRANTED</label>
            <select
              value={couponPlan}
              onChange={(e) => setCouponPlan(e.target.value)}
              className="mt-1 h-9 w-full border border-input bg-card px-2 text-sm"
            >
              {PLANS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">VALID DAYS (0 = FOREVER)</label>
            <Input
              type="number"
              min={0}
              value={couponDays}
              onChange={(e) => setCouponDays(e.target.value)}
              className="mt-1 rounded-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">MAX USES (0 = UNLIMITED)</label>
            <Input
              type="number"
              min={0}
              value={couponUses}
              onChange={(e) => setCouponUses(e.target.value)}
              className="mt-1 rounded-none"
            />
          </div>
        </div>
        <Input
          value={couponNote}
          onChange={(e) => setCouponNote(e.target.value)}
          placeholder="Internal note (optional)"
          className="mt-2 rounded-none"
        />
        <Button
          className="mt-3 rounded-none text-[10px] uppercase tracking-[0.14em]"
          onClick={createCouponSubmit}
          disabled={couponBusy}
        >
          <Ticket className="mr-2 size-4" />
          {couponBusy ? "CREATING…" : "CREATE COUPON"}
        </Button>

        <div className="mt-4 space-y-2 border-t border-border pt-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            EXISTING COUPONS ({coupons?.length ?? 0})
          </p>
          {(coupons ?? []).map((c) => (
            <div key={c._id} className="flex flex-wrap items-center gap-2 border border-border bg-card px-2.5 py-2">
              <span className="font-mono text-xs font-bold">{c.code}</span>
              <TerminalBadge tone="info">{c.planSlug}</TerminalBadge>
              <span className="text-[10px] text-muted-foreground">
                {c.durationDays > 0 ? `${c.durationDays} days` : "no expiry"} · used {c.usedCount}
                {c.maxUses > 0 ? `/${c.maxUses}` : "/∞"}
              </span>
              {c.note && <span className="text-[10px] text-muted-foreground">· {c.note}</span>}
              <span className="ml-auto flex items-center gap-1.5">
                <TerminalBadge tone={c.isActive ? "ok" : "ink"}>{c.isActive ? "ACTIVE" : "PAUSED"}</TerminalBadge>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-none text-[9px] uppercase"
                  onClick={() => toggleCoupon({ couponId: c._id }).catch(() => toast.error("Could not update coupon"))}
                >
                  {c.isActive ? "PAUSE" : "ACTIVATE"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-none border-red-500/40 text-[9px] uppercase text-red-300"
                  onClick={() => {
                    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
                    void deleteCoupon({ couponId: c._id })
                      .then(() => toast.success("Coupon deleted"))
                      .catch(() => toast.error("Could not delete coupon"));
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </span>
            </div>
          ))}
          {coupons?.length === 0 && (
            <p className="text-xs text-muted-foreground">No coupons yet. Create one above.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}
