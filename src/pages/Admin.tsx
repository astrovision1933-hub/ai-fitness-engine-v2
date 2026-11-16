import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/AppShell";
import { AdminSitePanel } from "@/components/admin-site-panel";
import { Panel, TerminalBadge, StatChip, StatusDot, AsciiBar } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router";
import { Lock, ShieldCheck, Cpu, Eye, Wifi, Zap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { GOAL_LABELS, CATEGORY_LABELS, KNOWLEDGE_CATEGORIES } from "@/lib/labels";

type AdminUser = {
  _id: Id<"users">;
  email: string;
  name: string | null;
  role: string;
  disabled: boolean;
  isAnonymous: boolean;
  plan: string;
  subStatus: string;
  createdAt: number;
};

type Coach = {
  _id: Id<"coachPersonas">;
  slug: string;
  name: string;
  role: string;
  avatarGlyph?: string;
  personality: string;
  communicationStyle: string;
  expertise: string[];
  philosophy: string;
  systemInstructions: string;
  isActive: boolean;
};

type KnowledgeDoc = {
  _id: Id<"knowledgeDocuments">;
  title: string;
  category: string;
  content: string;
  source?: string;
  isActive: boolean;
  createdAt: number;
};

type CatalogRow = {
  _id: Id<"productCatalog">;
  name: string;
  brand: string;
  category: string;
  price: number;
  servings?: number;
  stockStatus: string;
  approvedForRecommendation: boolean;
  isActive: boolean;
};

type Rule = {
  _id: Id<"adminProductRules">;
  name: string;
  enabled: boolean;
  goal?: string;
  dietType?: string;
  budgetLevel?: string;
  experience?: string;
  category?: string;
  notes?: string;
};

type PlanRow = {
  _id: Id<"subscriptionPlans">;
  slug: string;
  name: string;
  priceInr: number;
  aiMessageLimit: number;
  reportsPerMonth: number;
  competitionAccess: boolean;
  voiceAccess: boolean;
  advancedAnalytics: boolean;
  isActive: boolean;
};

type AuditRow = { _id: Id<"auditLogs">; userId?: Id<"users">; action: string; detail?: string; createdAt: number };
type ConvoMeta = { _id: Id<"conversations">; persona: string; title?: string; lastMessageAt: number };
type SettingRow = { key: string; value: string; locked: boolean };
const TABS = [
  "DASHBOARD",
  "SITE",
  "AI PROVIDERS",
  "USERS",
  "COACHES",
  "CONVERSATIONS",
  "KNOWLEDGE",
  "PRODUCTS",
  "RULES",
  "PLANS",
  "SETTINGS",
  "SAFETY",
  "AUDIT",
] as const;

type Tab = (typeof TABS)[number];

/**
 * Console route gate. The panel itself only mounts once the account has
 * entered the admin password, so no admin query fires while locked.
 */
export default function Admin() {
  const { user, isLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const gate = useQuery(api.admin.getAdminGate, isAdmin ? {} : "skip");

  if (isLoading || (isAdmin && gate === undefined)) {
    return (
      <AppShell>
        <div className="space-y-2 font-mono text-xs text-muted-foreground">
          <p>&gt; verifying credentials…</p>
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <Panel title="ACCESS RESTRICTED">
          <p className="text-sm text-muted-foreground">
            This console requires an administrator account. Role-based access is enforced server-side — every admin
            function re-checks the caller's role against the database.
          </p>
          <Button asChild variant="outline" className="mt-3 rounded-none text-[10px] uppercase tracking-[0.12em]">
            <Link to="/dashboard">BACK TO DASHBOARD →</Link>
          </Button>
        </Panel>
      </AppShell>
    );
  }

  if (!gate?.unlocked) return <AdminLockScreen />;

  return <AdminConsole />;
}

function AdminLockScreen() {
  const unlock = useMutation(api.admin.unlockAdminPanel);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    try {
      await unlock({ password });
      setPassword("");
      toast.success("Admin console unlocked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wrong admin password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <Panel title="ADMIN LOCKED" subtitle="password protected console">
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <span className="flex size-9 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
              <Lock className="size-4" aria-hidden />
            </span>
            <p className="text-xs leading-5">
              Enter the admin password to open the control console. The unlock stays valid for 12 hours on this account.
            </p>
          </div>
          <form onSubmit={submit} className="mt-4 space-y-2.5">
            <label
              htmlFor="admin-password"
              className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
            >
              ADMIN PASSWORD
            </label>
            <Input
              id="admin-password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="rounded-none"
            />
            <Button
              type="submit"
              disabled={busy || !password}
              className="w-full rounded-none text-[10px] uppercase tracking-[0.14em]"
            >
              <ShieldCheck className="mr-2 size-4" aria-hidden />
              {busy ? "VERIFYING…" : "UNLOCK CONSOLE"}
            </Button>
          </form>
          <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
            The password is verified on the server and is never stored in the browser.
          </p>
        </Panel>
      </div>
    </AppShell>
  );
}

function AdminConsole() {
  const { user, isLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const lockAdmin = useMutation(api.admin.lockAdminPanel);

  const [tab, setTab] = useState<Tab>("DASHBOARD");
  const [search, setSearch] = useState("");
  const [openUser, setOpenUser] = useState<Id<"users"> | null>(null);

  const metrics = useQuery(api.admin.getMetrics, {});
  const users = useQuery(api.admin.listUsers, { search: search || undefined });
  const userDetail = useQuery(api.admin.getUserDetail, openUser ? { userId: openUser } : "skip");
  const coaches = useQuery(api.admin.listCoaches, {});
  const convos = useQuery(api.admin.listConversationsMeta, {});
  const knowledge = useQuery(api.admin.listKnowledge, {});
  const catalog = useQuery(api.admin.listCatalogAdmin, {});
  const rules = useQuery(api.admin.listRulesAdmin, {});
  const plans = useQuery(api.admin.listPlansAdmin, {});
  const settings = useQuery(api.admin.listSettings, {});
  const audit = useQuery(api.admin.listAuditLogs, {});
  const safety = useQuery(api.admin.getSafetyOverview, {});
  const aiProviderStatus = useQuery(api.aiProviderAdmin.getAiProviderStatus, {});

  const setUserDisabled = useMutation(api.admin.setUserDisabled);
  const setUserRole = useMutation(api.admin.setUserRole);
  const grantPlan = useMutation(api.admin.grantPlan);
  const saveCoachM = useMutation(api.admin.saveCoach);
  const deleteCoachM = useMutation(api.admin.deleteCoach);
  const saveKnowledgeM = useMutation(api.admin.saveKnowledge);
  const deleteKnowledgeM = useMutation(api.admin.deleteKnowledge);
  const setApproval = useMutation(api.admin.setProductApproval);
  const deleteProductM = useMutation(api.admin.deleteProduct);
  const saveRuleM = useMutation(api.admin.saveRule);
  const deleteRuleM = useMutation(api.admin.deleteRule);
  const savePlanM = useMutation(api.admin.savePlan);
  const saveSettingM = useMutation(api.admin.saveSetting);

  // Forms
  const [coachForm, setCoachForm] = useState({ slug: "", name: "", role: "", personality: "", communicationStyle: "", expertise: "", philosophy: "", systemInstructions: "", isActive: true });
  const [kForm, setKForm] = useState({ title: "", category: "fitness", content: "", source: "" });
  const [ruleForm, setRuleForm] = useState({ name: "", goal: "", category: "", budgetLevel: "", enabled: true });


  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-2 font-mono text-xs text-muted-foreground">
          <p>&gt; verifying credentials…</p>
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <Panel title="ACCESS RESTRICTED">
          <p className="text-sm text-muted-foreground">
            This console requires an administrator account. Role-based access is enforced server-side — every admin
            function re-checks the caller's role against the database.
          </p>
          <Button asChild variant="outline" className="mt-3 rounded-none text-[10px] uppercase tracking-[0.12em]">
            <Link to="/dashboard">BACK TO DASHBOARD →</Link>
          </Button>
        </Panel>
      </AppShell>
    );
  }

  const maxGoalCount = metrics?.popularGoals[0]?.count ?? 1;

  return (
    <AppShell>
      <div className="space-y-4">
        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                <StatusDot pulse tone="warn" /> CONTROL CONSOLE · ADMINISTRATOR
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">Admin Panel</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Real aggregates only — every number is computed from the database at query time. Conversation content is
                never exposed; safety settings cannot be disabled.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <TerminalBadge tone="warn">PRIVILEGED ACCESS</TerminalBadge>
              <Button
                variant="outline"
                size="sm"
                className="rounded-none text-[9px] uppercase tracking-[0.12em]"
                onClick={() =>
                  lockAdmin({})
                    .then(() => toast.success("Console locked"))
                    .catch(() => toast.error("Could not lock the console"))
                }
              >
                <Lock className="mr-1.5 size-3.5" aria-hidden /> LOCK
              </Button>
            </div>
          </div>
        </Panel>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                tab === t
                  ? "border-terminal-amber/60 bg-[#fdf3e7] text-status-warn"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "SITE" && <AdminSitePanel />}

        {tab === "AI PROVIDERS" && <AiProvidersPanel />}

        {tab === "DASHBOARD" && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              <StatChip label="TOTAL USERS" value={metrics?.totalUsers ?? "…"} />
              <StatChip label="NEW (7D)" value={metrics?.newUsers7d ?? "…"} tone="info" />
              <StatChip label="ACTIVE SUBS" value={metrics?.activeUsers ?? "…"} tone="ok" />
              <StatChip label="COACHED" value={metrics?.coachingUsers ?? "…"} />
              <StatChip label="PREMIUM" value={metrics?.premiumUsers ?? "…"} tone="ok" />
              <StatChip label="FREE" value={metrics?.freeUsers ?? "…"} />
              <StatChip label="AI MSG TODAY" value={metrics?.aiMessagesToday ?? "…"} tone="info" />
              <StatChip label="TRIALS" value={metrics?.trialCount ?? "…"} />
              <StatChip label="PRODUCT INQ" value={metrics?.productInquiries ?? "…"} />
              <StatChip label="RECS SHOWN" value={metrics?.productRecommendations ?? "…"} />
              <StatChip label="HIGH INTENT" value={metrics?.highIntentUsers ?? "…"} tone="warn" />
              <StatChip label="RETENTION 7D" value={metrics ? `${metrics.retention}%` : "…"} tone="ok" />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="POPULAR GOALS" subtitle="active goals across users">
                {metrics?.popularGoals.length ? (
                  <div className="space-y-1.5">
                    {metrics.popularGoals.map((g) => (
                      <div key={g.goal} className="flex items-center gap-2 text-xs">
                        <span className="w-36 shrink-0 truncate">{GOAL_LABELS[g.goal] ?? g.goal}</span>
                        <AsciiBar value={g.count / Math.max(maxGoalCount, 1)} width={14} />
                        <span className="ml-auto font-semibold">{g.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No active goals recorded yet.</p>
                )}
              </Panel>
              <Panel title="POPULAR QUESTIONS" subtitle="intent counts only — never message content">
                {metrics?.popularQuestions.length ? (
                  <div className="space-y-1">
                    {metrics.popularQuestions.map((q) => (
                      <div key={q.intent} className="flex items-center justify-between border-b border-border/60 py-1 text-xs last:border-0">
                        <span className="uppercase tracking-wider text-muted-foreground">{q.intent.replace(/_/g, " ")}</span>
                        <span className="font-semibold">{q.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No conversations yet.</p>
                )}
              </Panel>
              <Panel title="PLAN DISTRIBUTION">
                {metrics?.planCounts.length ? (
                  <div className="space-y-1">
                    {metrics.planCounts.map((p) => (
                      <div key={p.slug} className="flex items-center justify-between border-b border-border/60 py-1 text-xs last:border-0">
                        <span className="uppercase tracking-wider">{p.slug}</span>
                        <span className="font-semibold">{p.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No active subscriptions yet.</p>
                )}
              </Panel>
            </div>
          </>
        )}

        {tab === "USERS" && (
          <>
            <Panel title="USER MANAGEMENT" subtitle="privacy-safe: profile, plan and subscription only">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="search by email or name…"
                className="rounded-none"
              />
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-1.5 pr-3">Email</th>
                      <th className="py-1.5 pr-3">Role</th>
                      <th className="py-1.5 pr-3">Plan</th>
                      <th className="py-1.5 pr-3">Status</th>
                      <th className="py-1.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(users ?? []).map((u: AdminUser) => (
                      <tr key={u._id} className="border-b border-border/60">
                        <td className="py-1.5 pr-3">
                          <button className="text-left hover:underline" onClick={() => setOpenUser(u._id)}>
                            {u.email}
                          </button>
                        </td>
                        <td className="py-1.5 pr-3">{u.role}</td>
                        <td className="py-1.5 pr-3">
                          {u.plan}
                          {u.subStatus !== "none" ? ` (${u.subStatus})` : ""}
                        </td>
                        <td className="py-1.5 pr-3">
                          {u.disabled ? <TerminalBadge tone="warn">DISABLED</TerminalBadge> : <TerminalBadge tone="ok">ACTIVE</TerminalBadge>}
                        </td>
                        <td className="py-1.5">
                          <div className="flex gap-1">
                            <select
                              className="border border-border bg-background px-1 py-0.5 text-[10px]"
                              value={u.plan}
                              onChange={(e) =>
                                act(() => grantPlan({ userId: u._id, planSlug: e.target.value }), `Plan granted: ${e.target.value}`)
                              }
                            >
                              {["free", "premium", "pro_coach", "competition"].map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-none px-2 text-[10px]"
                              onClick={() => act(() => setUserDisabled({ userId: u._id, disabled: !u.disabled }), u.disabled ? "Account enabled" : "Account disabled")}
                            >
                              {u.disabled ? "ENABLE" : "DISABLE"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            {openUser && userDetail && (
              <Panel
                title={`USER DETAIL — ${userDetail.user.email}`}
                right={
                  <Button size="sm" variant="ghost" className="rounded-none text-[10px]" onClick={() => setOpenUser(null)}>
                    CLOSE ✕
                  </Button>
                }
              >
                <div className="grid gap-3 text-xs sm:grid-cols-3">
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">PROFILE</p>
                    <p>Name: {userDetail.user.name ?? "—"}</p>
                    <p>Age/Sex: {userDetail.profile?.age ?? "—"} / {userDetail.profile?.sex ?? "—"}</p>
                    <p>Weight: {userDetail.profile?.weightKg ?? "—"}kg</p>
                    <p>Experience: {userDetail.profile?.experience ?? "—"}</p>
                    <p>Diet: {userDetail.profile?.dietType ?? "—"}</p>
                    <p>Onboarded: {userDetail.profile?.onboardingComplete ? "yes" : "no"}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">GOAL & PLAN</p>
                    <p>Goal: {userDetail.activeGoal ? (GOAL_LABELS[userDetail.activeGoal.goal] ?? userDetail.activeGoal.goal) : "—"}</p>
                    <p>Plan: {userDetail.subscription?.planSlug ?? "free"} ({userDetail.subscription?.status ?? "none"})</p>
                    <p>Active plans: {userDetail.planCount}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">ACCOUNT</p>
                    <p>Role: {userDetail.user.role}</p>
                    <p>Disabled: {userDetail.user.disabled ? "yes" : "no"}</p>
                    <p>Anonymous: {userDetail.user.isAnonymous ? "yes" : "no"}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-1.5">
                  {(["user", "member", "admin"] as const).map((r) => (
                    <Button
                      key={r}
                      size="sm"
                      variant="outline"
                      className="rounded-none text-[10px]"
                      onClick={() => act(() => setUserRole({ userId: openUser, role: r }), `Role set to ${r}`)}
                    >
                      SET {r.toUpperCase()}
                    </Button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Conversation content is intentionally not shown — only aggregate counts.
                </p>
              </Panel>
            )}
          </>
        )}

        {tab === "COACHES" && (
          <>
            <Panel title="AI COACHES" subtitle="personas drive the orchestrator's system instructions">
              <div className="space-y-2">
                {(coaches ?? []).map((c: Coach) => (
                  <div key={c._id} className="flex flex-wrap items-center justify-between gap-2 border border-border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {c.avatarGlyph} {c.name} <span className="text-[10px] text-muted-foreground">/{c.slug}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{c.role} · {c.communicationStyle} · {c.expertise.join(", ")}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TerminalBadge tone={c.isActive ? "ok" : "ink"}>{c.isActive ? "ACTIVE" : "OFF"}</TerminalBadge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-none text-[10px]"
                        onClick={() => act(() => saveCoachM({ id: c._id, slug: c.slug, name: c.name, role: c.role, personality: c.personality, communicationStyle: c.communicationStyle, expertise: c.expertise, philosophy: c.philosophy, systemInstructions: c.systemInstructions, isActive: !c.isActive }), "Coach updated")}
                      >
                        {c.isActive ? "DISABLE" : "ENABLE"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-none text-[10px]"
                        onClick={() => act(() => deleteCoachM({ id: c._id }), "Coach deleted")}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="CREATE COACH">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="slug (unique)" value={coachForm.slug} onChange={(e) => setCoachForm({ ...coachForm, slug: e.target.value })} className="rounded-none" />
                <Input placeholder="name" value={coachForm.name} onChange={(e) => setCoachForm({ ...coachForm, name: e.target.value })} className="rounded-none" />
                <Input placeholder="role (e.g. strength coach)" value={coachForm.role} onChange={(e) => setCoachForm({ ...coachForm, role: e.target.value })} className="rounded-none" />
                <Input placeholder="communication style" value={coachForm.communicationStyle} onChange={(e) => setCoachForm({ ...coachForm, communicationStyle: e.target.value })} className="rounded-none" />
                <Input placeholder="expertise (comma separated)" value={coachForm.expertise} onChange={(e) => setCoachForm({ ...coachForm, expertise: e.target.value })} className="rounded-none" />
                <Input placeholder="personality" value={coachForm.personality} onChange={(e) => setCoachForm({ ...coachForm, personality: e.target.value })} className="rounded-none" />
              </div>
              <Textarea placeholder="coaching philosophy" value={coachForm.philosophy} onChange={(e) => setCoachForm({ ...coachForm, philosophy: e.target.value })} className="mt-2 min-h-[60px] rounded-none text-xs" />
              <Textarea placeholder="system instructions (the persona's core prompt)" value={coachForm.systemInstructions} onChange={(e) => setCoachForm({ ...coachForm, systemInstructions: e.target.value })} className="mt-2 min-h-[70px] rounded-none text-xs" />
              <Button
                className="mt-2 rounded-none text-[10px] uppercase tracking-[0.12em]"
                onClick={() =>
                  act(async () => {
                    await saveCoachM({
                      slug: coachForm.slug,
                      name: coachForm.name,
                      role: coachForm.role,
                      personality: coachForm.personality,
                      communicationStyle: coachForm.communicationStyle,
                      expertise: coachForm.expertise.split(",").map((s) => s.trim()).filter(Boolean),
                      philosophy: coachForm.philosophy,
                      systemInstructions: coachForm.systemInstructions,
                      isActive: true,
                    });
                    setCoachForm({ slug: "", name: "", role: "", personality: "", communicationStyle: "", expertise: "", philosophy: "", systemInstructions: "", isActive: true });
                  }, "Coach created")
                }
              >
                CREATE COACH →
              </Button>
            </Panel>
          </>
        )}

        {tab === "CONVERSATIONS" && (
          <Panel title="CONVERSATIONS (METADATA ONLY)" subtitle="message content is never exposed to admins">
            {(convos ?? []).length ? (
              <div className="space-y-1">
                {(convos ?? []).map((c: ConvoMeta) => (
                  <div key={c._id} className="flex items-center justify-between border-b border-border/60 py-1.5 text-xs last:border-0">
                    <span>
                      <span className="font-semibold">{c.persona}</span>
                      <span className="text-muted-foreground"> — {c.title ?? "session"}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground">{new Date(c.lastMessageAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No conversations yet.</p>
            )}
          </Panel>
        )}

        {tab === "KNOWLEDGE" && (
          <>
            <Panel title="KNOWLEDGE BASE" subtitle="retrieved into the coach's context per message">
              <div className="space-y-2">
                {(knowledge ?? []).length ? (
                  (knowledge ?? []).map((k: KnowledgeDoc) => (
                    <div key={k._id} className="flex items-start justify-between gap-3 border border-border p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {k.title} <TerminalBadge tone="info">{k.category}</TerminalBadge>
                          {!k.isActive && <TerminalBadge tone="warn">OFF</TerminalBadge>}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{k.content}</p>
                        {k.source && <p className="mt-1 text-[10px] text-muted-foreground">SOURCE: {k.source}</p>}
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-none text-[10px]"
                          onClick={() => act(() => saveKnowledgeM({ id: k._id, title: k.title, category: k.category, content: k.content, source: k.source, tags: [], isActive: !k.isActive }), "Document updated")}
                        >
                          {k.isActive ? "DISABLE" : "ENABLE"}
                        </Button>
                        <Button size="sm" variant="ghost" className="rounded-none text-[10px]" onClick={() => act(() => deleteKnowledgeM({ id: k._id }), "Document deleted")}>
                          ✕
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No documents yet — add the first one below.</p>
                )}
              </div>
            </Panel>
            <Panel title="ADD DOCUMENT">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="title" value={kForm.title} onChange={(e) => setKForm({ ...kForm, title: e.target.value })} className="rounded-none" />
                <select
                  value={kForm.category}
                  onChange={(e) => setKForm({ ...kForm, category: e.target.value })}
                  className="border border-border bg-background px-2 py-2 text-xs"
                >
                  {KNOWLEDGE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <Textarea placeholder="content — facts the coach may cite (ADMIN PROVIDED)" value={kForm.content} onChange={(e) => setKForm({ ...kForm, content: e.target.value })} className="mt-2 min-h-[90px] rounded-none text-xs" />
              <Input placeholder="source metadata (optional, e.g. policy doc v2)" value={kForm.source} onChange={(e) => setKForm({ ...kForm, source: e.target.value })} className="mt-2 rounded-none" />
              <Button
                className="mt-2 rounded-none text-[10px] uppercase tracking-[0.12em]"
                onClick={() =>
                  act(async () => {
                    await saveKnowledgeM({ title: kForm.title, category: kForm.category, content: kForm.content, source: kForm.source || undefined, tags: [], isActive: true });
                    setKForm({ title: "", category: "fitness", content: "", source: "" });
                  }, "Document saved")
                }
              >
                SAVE DOCUMENT →
              </Button>
            </Panel>
          </>
        )}

        {tab === "PRODUCTS" && (
          <Panel title="PRODUCT CATALOG" subtitle="approval controls the recommendation engine">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-1.5 pr-3">Product</th>
                    <th className="py-1.5 pr-3">Category</th>
                    <th className="py-1.5 pr-3">Price</th>
                    <th className="py-1.5 pr-3">Stock</th>
                    <th className="py-1.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(catalog ?? []).map((p: CatalogRow) => (
                    <tr key={p._id} className="border-b border-border/60">
                      <td className="py-1.5 pr-3 font-medium">{p.brand} {p.name}</td>
                      <td className="py-1.5 pr-3">{CATEGORY_LABELS[p.category] ?? p.category}</td>
                      <td className="py-1.5 pr-3">₹{p.price}</td>
                      <td className="py-1.5 pr-3">{p.stockStatus.replace("_", " ")}</td>
                      <td className="py-1.5">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant={p.approvedForRecommendation ? "default" : "outline"}
                            className="rounded-none px-2 text-[10px]"
                            onClick={() => act(() => setApproval({ id: p._id, approved: !p.approvedForRecommendation }), p.approvedForRecommendation ? "Approval revoked" : "Approved for recommendations")}
                          >
                            {p.approvedForRecommendation ? "APPROVED ✓" : "APPROVE"}
                          </Button>
                          <Button size="sm" variant="ghost" className="rounded-none px-2 text-[10px]" onClick={() => act(() => deleteProductM({ id: p._id }), "Product removed")}>
                            ✕
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!catalog?.length && <p className="mt-2 text-xs text-muted-foreground">Catalog is empty. Products can be seeded via the API or added by an admin script.</p>}
            </div>
          </Panel>
        )}

        {tab === "RULES" && (
          <>
            <Panel title="RECOMMENDATION RULES" subtitle="no recommendation ships without a matching rule">
              <div className="space-y-2">
                {(rules ?? []).length ? (
                  (rules ?? []).map((r: Rule) => (
                    <div key={r._id} className="flex flex-wrap items-center justify-between gap-2 border border-border p-3 text-xs">
                      <div>
                        <p className="font-semibold">{r.name}</p>
                        <p className="text-muted-foreground">
                          {r.goal ? `goal=${r.goal} ` : ""}
                          {r.category ? `→ ${CATEGORY_LABELS[r.category] ?? r.category} ` : ""}
                          {r.budgetLevel ? `budget=${r.budgetLevel}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TerminalBadge tone={r.enabled ? "ok" : "ink"}>{r.enabled ? "ON" : "OFF"}</TerminalBadge>
                        <Button size="sm" variant="outline" className="rounded-none text-[10px]" onClick={() => act(() => saveRuleM({ id: r._id, name: r.name, enabled: !r.enabled }), "Rule updated")}>
                          {r.enabled ? "DISABLE" : "ENABLE"}
                        </Button>
                        <Button size="sm" variant="ghost" className="rounded-none text-[10px]" onClick={() => act(() => deleteRuleM({ id: r._id }), "Rule deleted")}>
                          ✕
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No rules yet — the engine will fall back to conservative goal-category defaults.</p>
                )}
              </div>
            </Panel>
            <Panel title="ADD RULE">
              <div className="grid gap-2 sm:grid-cols-4">
                <Input placeholder="rule name" value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} className="rounded-none" />
                <select value={ruleForm.goal} onChange={(e) => setRuleForm({ ...ruleForm, goal: e.target.value })} className="border border-border bg-background px-2 py-2 text-xs">
                  <option value="">any goal</option>
                  {Object.entries(GOAL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <select value={ruleForm.category} onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })} className="border border-border bg-background px-2 py-2 text-xs">
                  <option value="">any category</option>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <select value={ruleForm.budgetLevel} onChange={(e) => setRuleForm({ ...ruleForm, budgetLevel: e.target.value })} className="border border-border bg-background px-2 py-2 text-xs">
                  <option value="">any budget</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </div>
              <Button
                className="mt-2 rounded-none text-[10px] uppercase tracking-[0.12em]"
                onClick={() =>
                  act(async () => {
                    await saveRuleM({
                      name: ruleForm.name,
                      enabled: true,
                      goal: ruleForm.goal || undefined,
                      category: ruleForm.category || undefined,
                      budgetLevel: ruleForm.budgetLevel || undefined,
                    });
                    setRuleForm({ name: "", goal: "", category: "", budgetLevel: "", enabled: true });
                  }, "Rule saved")
                }
              >
                SAVE RULE →
              </Button>
            </Panel>
          </>
        )}

        {tab === "PLANS" && (
          <Panel title="SUBSCRIPTION PLANS" subtitle="edit price and limits — takes effect immediately">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-1.5 pr-3">Plan</th>
                    <th className="py-1.5 pr-3">₹/mo</th>
                    <th className="py-1.5 pr-3">AI/day</th>
                    <th className="py-1.5 pr-3">Reports/mo</th>
                    <th className="py-1.5">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {(plans ?? []).map((p: PlanRow) => (
                    <tr key={p._id} className="border-b border-border/60">
                      <td className="py-1.5 pr-3 font-semibold">{p.name}</td>
                      <td className="py-1.5 pr-3">
                        <PlanCell planId={p._id} field="priceInr" value={p.priceInr} save={savePlanM} />
                      </td>
                      <td className="py-1.5 pr-3">
                        <PlanCell planId={p._id} field="aiMessageLimit" value={p.aiMessageLimit} save={savePlanM} />
                      </td>
                      <td className="py-1.5 pr-3">
                        <PlanCell planId={p._id} field="reportsPerMonth" value={p.reportsPerMonth} save={savePlanM} />
                      </td>
                      <td className="py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {(
                            [
                              ["competitionAccess", p.competitionAccess],
                              ["voiceAccess", p.voiceAccess],
                              ["advancedAnalytics", p.advancedAnalytics],
                            ] as const
                          ).map(([flag, on]) => (
                            <Button
                              key={flag}
                              size="sm"
                              variant={on ? "default" : "outline"}
                              className="rounded-none px-2 text-[10px]"
                              onClick={() =>
                                act(() => savePlanM({ id: p._id, [flag]: !on } as { id: Id<"subscriptionPlans"> } & Record<string, unknown> as never), `${flag} ${on ? "off" : "on"}`)
                              }
                            >
                              {flag.replace("Access", "").replace("advancedAnalytics", "analytics").toUpperCase()} {on ? "✓" : "✕"}
                            </Button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {tab === "SETTINGS" && (
          <Panel title="APP SETTINGS" subtitle="safety-critical settings are locked by design">
            <div className="divide-y divide-border/60">
              {(settings ?? []).map((s: SettingRow) => (
                <SettingRowView key={s.key} row={s} save={saveSettingM} />
              ))}
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground">
              The safety layer cannot be disabled by anyone, including administrators. This is enforced server-side.
            </p>
          </Panel>
        )}

        {tab === "SAFETY" && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatChip label="FLAGGED (7D)" value={safety?.flagged7d ?? "…"} tone="warn" />
              <StatChip label="FLAGGED TOTAL" value={safety?.flaggedTotal ?? "…"} tone="warn" />
              <StatChip label="SAFETY ACTIVE" value="ALWAYS ON" tone="ok" />
              <StatChip label="AI BYPASS" value="BLOCKED" tone="ok" />
            </div>
            <Panel title="SAFETY BLOCKS BY CATEGORY" subtitle="rule hits from audit logs — content is never shown">
              {safety?.blocksByCategory.length ? (
                <div className="space-y-1.5">
                  {safety.blocksByCategory.map((c) => (
                    <div key={c.category} className="flex items-center gap-2 text-xs">
                      <span className="w-44 shrink-0 truncate uppercase tracking-wider">{c.category.replace(/_/g, " ")}</span>
                      <AsciiBar value={c.count / Math.max(safety.blocksByCategory[0]?.count ?? 1, 1)} width={14} />
                      <span className="ml-auto font-semibold">{c.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No safety blocks recorded yet.</p>
              )}
            </Panel>
            <Panel title="RECENT FLAGGED MESSAGES" subtitle="metadata only — intents and timestamps, never content">
              {safety?.recent.length ? (
                <div className="space-y-1">
                  {safety.recent.map((m) => (
                    <div key={m._id} className="flex items-center justify-between border-b border-border/60 py-1.5 text-xs last:border-0">
                      <TerminalBadge tone="warn">{(m.intent ?? "unknown").replace(/_/g, " ")}</TerminalBadge>
                      <span className="text-[10px] text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No flagged messages — the safety layer short-circuits dangerous requests before any AI call.</p>
              )}
            </Panel>
            <p className="text-[10px] text-muted-foreground">
              The safety layer (extreme dieting, dehydration, PEDs, medical symptoms, injury, dangerous supplements) runs
              first in the orchestration pipeline and cannot be disabled — not by admins, not by configuration.
            </p>
          </>
        )}

        {tab === "AUDIT" && (
          <Panel title="AUDIT LOGS" subtitle="security accounting — retained through account deletion">
            {(audit ?? []).length ? (
              <div className="space-y-1">
                {(audit ?? []).map((a: AuditRow) => (
                  <div key={a._id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 py-1.5 text-xs last:border-0">
                    <span>
                      <span className="font-semibold">{a.action}</span>
                      {a.detail && <span className="text-muted-foreground"> — {a.detail}</span>}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No audit entries yet.</p>
            )}
          </Panel>
        )}
      </div>
    </AppShell>
  );
}

function AiProvidersPanel() {
  const aiProviderStatus = useQuery(api.aiProviderAdmin.getAiProviderStatus, {});
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [openrouterModel, setOpenrouterModel] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("");

  const saveOpenRouterKeyM = useMutation(api.aiProviderAdmin.saveOpenRouterKey);
  const saveOpenRouterModelM = useMutation(api.aiProviderAdmin.saveOpenRouterModel);
  const saveGeminiKeyM = useMutation(api.aiProviderAdmin.saveGeminiKey);
  const saveGeminiModelM = useMutation(api.aiProviderAdmin.saveGeminiModel);

  async function saveOpenrouterKey() {
    await saveOpenRouterKeyM({ key: openrouterKey || undefined }).catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save"));
  }

  async function saveOpenrouterModel() {
    await saveOpenRouterModelM({ model: openrouterModel || undefined }).catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save"));
  }

  async function saveGeminiKey() {
    await saveGeminiKeyM({ key: geminiKey || undefined }).catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save"));
  }

  async function saveGeminiModel() {
    await saveGeminiModelM({ model: geminiModel || undefined }).catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save"));
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              <StatusDot pulse /> AI ROUTING · PROVIDER KEYS & MODEL OVERRIDES
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">AI Providers</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              OpenRouter free models are the first preference and are fetched live, so new free models join automatically.
              Gemini is the immediate fallback when OpenRouter is unavailable; the fastest healthy model wins each turn.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-none text-[9px] uppercase tracking-[0.12em]"
            onClick={() => toast.info("Keys set in Keys → API keys are used automatically by the AI action.")}
            disabled={false}
          >
            ENV READY
          </Button>
        </div>
      </Panel>

      <AiProviderCard
        icon={<Wifi className="size-4" />}
        title="OPENROUTER"
        subtitle="1st preference — free models, fastest-first"
        configured={aiProviderStatus?.openrouter?.configured ?? false}
        masked={aiProviderStatus?.openrouter?.masked ?? ""}
        modelOverride={aiProviderStatus?.openrouter?.modelOverride ?? ""}
        key={aiProviderStatus?.openrouter?.masked ?? "openrouter-empty"}
        onKeyChange={setOpenrouterKey}
        onModelChange={setOpenrouterModel}
        onSaveKey={saveOpenrouterKey}
        onSaveModel={saveOpenrouterModel}
      />

      <AiProviderCard
        icon={<Cpu className="size-4" />}
        title="GEMINI"
        subtitle="2nd preference — immediate fallback"
        configured={aiProviderStatus?.gemini?.configured ?? false}
        masked={aiProviderStatus?.gemini?.masked ?? ""}
        modelOverride={aiProviderStatus?.gemini?.modelOverride ?? ""}
        key={aiProviderStatus?.gemini?.masked ?? "gemini-empty"}
        onKeyChange={setGeminiKey}
        onModelChange={setGeminiModel}
        onSaveKey={saveGeminiKey}
        onSaveModel={saveGeminiModel}
      />

      <Panel title="PROVIDER FALLBACK BEHAVIOR" subtitle="what happens when a provider fails">
        <div className="space-y-2 text-xs">
          <div className="flex items-start gap-2 border border-border bg-card p-3">
            <Eye className="mt-0.5 size-4 shrink-0 text-status-ok" />
            <div>
              <p className="font-semibold uppercase tracking-wider">OpenRouter fails or is rate limited</p>
              <p className="text-muted-foreground">
                That model is skipped for 2 minutes and the next fastest free model answers immediately. If every
                OpenRouter attempt fails, the engine falls through to Gemini without waiting.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 border border-border bg-card p-3">
            <Zap className="mt-0.5 size-4 shrink-0 text-status-warn" />
            <div>
              <p className="font-semibold uppercase tracking-wider">Gemini fallback when OpenRouter is down</p>
              <p className="text-muted-foreground">
                Gemini is tried next using its fastest healthy chat model. A retired or failing Gemini model is
                skipped and the next Gemini model answers instantly. If Gemini also fails, the engine uses the
                platform default (VLY_INTEGRATION_KEY) if it is configured.
              </p>
            </div>
          </div>
          <p className="text-muted-foreground">
            Keys are stored in Convex appSettings and mirrored to process.env by the AI action and the SYNC ENV NOW button.
            Set the real keys in Keys → API keys first; this panel only controls model overrides and shows masked status.
          </p>
        </div>
      </Panel>
    </div>
  );
}

function AiProviderCard({
  icon,
  title,
  subtitle,
  configured,
  masked,
  modelOverride,
  key,
  onKeyChange,
  onModelChange,
  onSaveKey,
  onSaveModel,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  configured: boolean;
  masked: string;
  modelOverride: string;
  key: string;
  onKeyChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onSaveKey: () => Promise<void>;
  onSaveModel: () => Promise<void>;
}) {
  const [savingKey, setSavingKey] = useState(false);
  const [savingModel, setSavingModel] = useState(false);

  async function handleSaveKey() {
    setSavingKey(true);
    try {
      await onSaveKey();
      toast.success(`${title} key saved`);
    } catch {
      // error toast is shown by the mutation
    } finally {
      setSavingKey(false);
    }
  }

  async function handleSaveModel() {
    setSavingModel(true);
    try {
      await onSaveModel();
      toast.success(`${title} model override saved`);
    } catch {
      // error toast is shown by the mutation
    } finally {
      setSavingModel(false);
    }
  }

  return (
    <Panel title={title} subtitle={subtitle}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">API KEY</label>
          <div className="mt-1 flex gap-2">
            <Input
              value={key}
              onChange={(e) => onKeyChange(e.target.value)}
              placeholder={configured ? masked : "Paste key here"}
              className="rounded-none font-mono text-xs"
              disabled={configured}
            />
            <Button
              size="sm"
              variant="outline"
              className="rounded-none text-[9px] uppercase"
              onClick={handleSaveKey}
              disabled={savingKey || (!key && !configured)}
            >
              {savingKey ? "SAVING…" : configured ? "MATCHED" : "SAVE KEY"}
            </Button>
          </div>
          {configured && (
            <p className="mt-1 text-[10px] text-status-ok">Configured · value masked · paste in Keys → API keys to replace</p>
          )}
          {!configured && (
            <p className="mt-1 text-[10px] text-muted-foreground">Add the real key under Keys → API keys, then come back and save it here.</p>
          )}
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">MODEL OVERRIDE</label>
          <div className="mt-1 flex gap-2">
            <Input
              value={modelOverride}
              onChange={(e) => onModelChange(e.target.value)}
              placeholder={title === "OPENROUTER" ? "e.g. openrouter/free" : "e.g. gemini-2.5-flash"}
              className="rounded-none font-mono text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              className="rounded-none text-[9px] uppercase"
              onClick={handleSaveModel}
              disabled={savingModel}
            >
              {savingModel ? "SAVING…" : "SAVE MODEL"}
            </Button>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Leave empty to use the fastest free model automatically. Set this only if you want to pin a specific model.
          </p>
          {modelOverride && (
            <p className="mt-1 text-[10px] text-status-ok">Override: {modelOverride}</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

function PlanCell({
  planId,
  field,
  value,
  save,
}: {
  planId: Id<"subscriptionPlans">;
  field: "priceInr" | "aiMessageLimit" | "reportsPerMonth";
  value: number;
  save: (args: { id: Id<"subscriptionPlans">; priceInr?: number; aiMessageLimit?: number; reportsPerMonth?: number }) => Promise<unknown>;
}) {
  const [v, setV] = useState(String(value));
  const dirty = v !== String(value);
  return (
    <span className="flex items-center gap-1">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="w-16 border border-border bg-background px-1 py-0.5 text-[11px]"
      />
      {dirty && (
        <Button
          size="sm"
          variant="outline"
          className="rounded-none px-1.5 text-[10px]"
          onClick={() => {
            const num = Number(v);
            if (Number.isFinite(num)) save({ id: planId, [field]: num } as never).catch(() => undefined);
          }}
        >
          ✓
        </Button>
      )}
    </span>
  );
}

function SettingRowView({
  row,
  save,
}: {
  row: SettingRow;
  save: (args: { key: string; value: string }) => Promise<unknown>;
}) {
  const [v, setV] = useState(row.value);
  const dirty = v !== row.value;
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div>
        <p className="text-xs font-semibold">{row.key}</p>
        {row.locked && <p className="text-[10px] text-status-warn">LOCKED — safety-critical</p>}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          value={v}
          disabled={row.locked}
          onChange={(e) => setV(e.target.value)}
          className="w-28 border border-border bg-background px-2 py-1 text-[11px] disabled:opacity-50"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={row.locked || !dirty}
          className="rounded-none px-2 text-[10px]"
          onClick={() => save({ key: row.key, value: v }).catch(() => undefined)}
        >
          SAVE
        </Button>
      </div>
    </div>
  );
}
