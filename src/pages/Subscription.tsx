import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/AppShell";
import { Panel, TerminalBadge, SectionHeader, StatusDot, AsciiBar } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router";

type Plan = {
  _id: string;
  slug: string;
  name: string;
  priceInr: number;
  aiMessageLimit: number;
  reportsPerMonth: number;
  coachingAccess: boolean;
  nutritionAccess: boolean;
  competitionAccess: boolean;
  supplementAccess: boolean;
  voiceAccess: boolean;
  advancedAnalytics: boolean;
  features: string[];
  isActive: boolean;
};

type Entitlement = {
  planSlug: string;
  planName: string;
  status: string;
  aiMessageLimit: number;
  reportsPerMonth: number;
  competitionAccess: boolean;
  voiceAccess: boolean;
  advancedAnalytics: boolean;
  trialEndsAt: number | null;
} | null;

type Purchase = {
  _id: string;
  productId: string;
  verificationStatus: string;
  createdAt: number;
};

const FEATURE_ROWS: Array<{ key: keyof Plan; label: string }> = [
  { key: "aiMessageLimit", label: "AI messages / day" },
  { key: "reportsPerMonth", label: "Reports / month" },
  { key: "coachingAccess", label: "AI coaching" },
  { key: "nutritionAccess", label: "Nutrition engine" },
  { key: "supplementAccess", label: "Supplement analysis" },
  { key: "competitionAccess", label: "Competition mode" },
  { key: "voiceAccess", label: "Voice coach" },
  { key: "advancedAnalytics", label: "Advanced analytics" },
];

function featureCell(p: Plan, key: keyof Plan): string {
  const v = p[key];
  if (typeof v === "boolean") return v ? "YES" : "—";
  if (typeof v === "number") return v === -1 ? "UNLTD" : String(v);
  return "—";
}

export default function Subscription() {
  const navigate = useNavigate();
  const profile = useQuery(api.profile.getProfile);
  const plans = useQuery(api.subscriptions.getPlans, {});
  const sub = useQuery(api.subscriptions.getMySubscription, {});
  const ent = useQuery(api.subscriptions.getMyEntitlement, {});
  const usage = useQuery(api.subscriptions.getMyUsage, {});
  const purchases = useQuery(api.subscriptions.getMyPurchases, {});

  const seedPlans = useMutation(api.subscriptions.seedPlans);
  const ensureSub = useMutation(api.subscriptions.ensureSubscription);
  const startTrial = useMutation(api.subscriptions.startTrial);
  const cancel = useMutation(api.subscriptions.cancelSubscription);
  const recordPurchase = useAction(api.subscriptions.validatePlayPurchase);

  useEffect(() => {
    seedPlans({}).catch(() => undefined);
    ensureSub({}).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile === null) navigate("/onboarding");
  }, [profile, navigate]);

  const [token, setToken] = useState("");
  const [productId, setProductId] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleStartTrial() {
    setBusy(true);
    try {
      await startTrial({});
      toast.success("Trial started — full premium access for the trial period.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start trial.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    try {
      await cancel({});
      toast.success("Auto-renew turned off. Access continues until the period ends.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRecordPurchase() {
    if (!token.trim() || !productId.trim()) {
      toast.error("purchaseToken and productId are required (from the Play purchase flow).");
      return;
    }
    setBusy(true);
    try {
      const res = await recordPurchase({ purchaseToken: token, productId });
      if (res.status === "unverified") {
        toast.message("Purchase recorded — NOT verified.", { description: res.message });
      } else {
        toast.success(res.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Recording failed.");
    } finally {
      setBusy(false);
    }
  }

  if (profile === undefined || plans === undefined || sub === undefined || ent === undefined) {
    return (
      <AppShell>
        <div className="space-y-2 font-mono text-xs text-muted-foreground">
          <p>&gt; loading subscription engine…</p>
        </div>
      </AppShell>
    );
  }

  const activePlans = (plans ?? []).filter((p) => p.isActive);
  const isTrialing = ent !== null && ent.status === "trialing";
  const isFree = (ent === null || ent.planSlug === "free") && !isTrialing;

  return (
    <AppShell>
      <div className="space-y-4">
        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                <StatusDot pulse /> MODULE 07 · PLANS &amp; MONETIZATION
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">Subscription</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Plans are admin-configured. Trials are single-use. Google Play purchases are recorded server-side and
                never trusted from the client.
              </p>
            </div>
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <TerminalBadge tone={isFree ? "ink" : "ok"}>
                {ent ? `${ent.planName.toUpperCase()} · ${ent.status.toUpperCase()}` : "FREE"}
              </TerminalBadge>
              {isTrialing && ent !== null && ent.trialEndsAt !== null && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  TRIAL ENDS {new Date(ent.trialEndsAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </Panel>

        <SectionHeader index="01" title="AI USAGE TODAY" hint="per-plan limits, admin-configurable" />
        <Panel>
          {usage ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>
                  <span className="font-semibold">{usage.used}</span> of{" "}
                  <span className="font-semibold">{usage.limit === -1 ? "∞" : usage.limit}</span> AI messages used today
                  ({usage.planName})
                </span>
                <span className="text-muted-foreground">
                  {usage.remaining === -1 ? "unlimited" : `${usage.remaining} remaining`}
                </span>
              </div>
              <AsciiBar value={usage.limit === -1 ? 0.05 : Math.min(1, usage.used / Math.max(usage.limit, 1))} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Usage appears after your first coach message.</p>
          )}
        </Panel>

        <SectionHeader index="02" title="PLANS" hint="admin-configured pricing and features" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {activePlans.map((p) => {
            const current = ent !== null && ent.planSlug === p.slug;
            return (
              <Panel key={p._id} className={current ? "border-terminal-green/60" : undefined}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em]">{p.name}</h3>
                  {current && <TerminalBadge tone="ok">CURRENT</TerminalBadge>}
                </div>
                <p className="mt-2 text-2xl font-bold">
                  {p.priceInr === 0 ? "FREE" : `₹${p.priceInr}`}
                  {p.priceInr > 0 && <span className="text-xs font-normal text-muted-foreground">/mo</span>}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {p.aiMessageLimit === -1 ? "Unlimited" : p.aiMessageLimit} AI msg/day ·{" "}
                  {p.reportsPerMonth === -1 ? "∞" : p.reportsPerMonth} reports/mo
                </p>
                <ul className="mt-3 space-y-1 text-[11px]">
                  {p.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex gap-1.5">
                      <span className="text-status-ok">›</span>
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                {p.slug === "premium" && isFree && (
                  <Button
                    onClick={handleStartTrial}
                    disabled={busy}
                    className="mt-3 w-full rounded-none text-[10px] uppercase tracking-[0.12em]"
                  >
                    {busy ? "STARTING…" : "START 14-DAY TRIAL →"}
                  </Button>
                )}
                {p.slug !== "free" && !current && (
                  <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
                    Billing runs through Google Play on Android (server-verified) or an admin grant for beta access.
                  </p>
                )}
              </Panel>
            );
          })}
        </div>

        <Panel title="FULL FEATURE MATRIX">
          {activePlans.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-1.5 pr-3">Feature</th>
                    {activePlans.map((p) => (
                      <th key={p.slug} className="py-1.5 pr-3">
                        {p.name}
                        <span className="block text-[10px] font-normal normal-case">
                          {p.priceInr === 0 ? "FREE" : `₹${p.priceInr}/mo`}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_ROWS.map((row) => (
                    <tr key={row.key} className="border-b border-border/60">
                      <td className="py-1.5 pr-3">{row.label}</td>
                      {activePlans.map((p) => (
                        <td key={p.slug} className="py-1.5 pr-3">
                          {featureCell(p, row.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Plans load shortly…</p>
          )}
        </Panel>

        <SectionHeader index="03" title="MANAGE" hint="trial, auto-renew, purchases" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="CURRENT SUBSCRIPTION">
            {sub !== null && sub.subscription !== null ? (
              <div className="space-y-1 text-xs">
                <p>
                  <span className="font-semibold">Plan:</span> {sub.plan?.name ?? sub.subscription.planSlug}
                </p>
                <p>
                  <span className="font-semibold">Status:</span> {sub.subscription.status}
                </p>
                <p>
                  <span className="font-semibold">Source:</span> {sub.subscription.source ?? "system"}
                </p>
                {sub.subscription.cancelAtPeriodEnd && (
                  <p className="text-status-warn">Auto-renew is OFF — access continues until the period ends.</p>
                )}
                {sub.subscription.status === "active" &&
                  sub.subscription.planSlug !== "free" &&
                  !sub.subscription.cancelAtPeriodEnd && (
                    <Button
                      onClick={handleCancel}
                      disabled={busy}
                      variant="outline"
                      className="mt-2 rounded-none text-[10px] uppercase tracking-[0.12em]"
                    >
                      TURN OFF AUTO-RENEW
                    </Button>
                  )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No subscription row yet.</p>
            )}
          </Panel>
          <Panel title="GOOGLE PLAY PURCHASES" subtitle="server-side records — never client-trusted">
            <p className="text-xs leading-5 text-muted-foreground">
              After an Android purchase the app sends the purchaseToken here for server-side verification. Without the
              Play service-account credential, purchases are stored as <span className="font-semibold">unverified</span>{" "}
              and grant <span className="font-semibold">no</span> entitlement.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="purchaseToken" className="rounded-none" />
              <Input
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder="productId (e.g. premium_monthly)"
                className="rounded-none"
              />
            </div>
            <Button
              onClick={handleRecordPurchase}
              disabled={busy}
              variant="outline"
              className="mt-2 rounded-none text-[10px] uppercase tracking-[0.12em]"
            >
              RECORD PURCHASE →
            </Button>
            {purchases && purchases.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                {purchases.map((p) => (
                  <div key={p._id} className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5 text-xs last:border-0">
                    <span className="font-mono text-[11px]">{p.productId}</span>
                    <TerminalBadge tone={p.verificationStatus === "verified" ? "ok" : "warn"}>
                      {p.verificationStatus}
                    </TerminalBadge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[10px] text-muted-foreground">No purchase records.</p>
            )}
          </Panel>
        </div>

        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          BASIC SAFETY INFORMATION IS NEVER PAYWALLED ·{" "}
          <Link to="/coach" className="text-status-ok underline underline-offset-4">
            BACK TO COACH
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
