import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/AppShell";
import { Panel, TerminalBadge, SectionHeader, StatusDot, StatChip } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router";
import { REPORT_KINDS } from "@/lib/labels";

type ReportRow = {
  _id: string;
  kind: string;
  periodStart: string;
  periodEnd: string;
  content: string;
  dataSnapshot?: string;
  createdAt: number;
};

export default function Reports() {
  const navigate = useNavigate();
  const profile = useQuery(api.profile.getProfile);
  const reports = useQuery(api.reports.getMyReports, {});
  const ent = useQuery(api.subscriptions.getMyEntitlement, {});

  const seedPlans = useMutation(api.subscriptions.seedPlans);
  const ensureSub = useMutation(api.subscriptions.ensureSubscription);
  const checkAllowance = useMutation(api.reports.checkReportAllowance);
  const generate = useAction(api.reports.generateReport);

  useEffect(() => {
    seedPlans({}).catch(() => undefined);
    ensureSub({}).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile === null) navigate("/onboarding");
  }, [profile, navigate]);

  const [busyKind, setBusyKind] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  async function runGenerate(kind: string) {
    setBusyKind(kind);
    try {
      // Deterministic gating first — a clear upgrade message instead of a failure.
      await checkAllowance({});
      const res = await generate({ kind: kind as "weekly" | "monthly" | "progress" | "workout" | "nutrition" | "competition" });
      setOpenId(res.id);
      toast.success(`${kind.toUpperCase()} report generated.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Report generation failed.");
    } finally {
      setBusyKind(null);
    }
  }

  if (profile === undefined || reports === undefined || ent === undefined) {
    return (
      <AppShell>
        <div className="space-y-2 font-mono text-xs text-muted-foreground">
          <p>&gt; loading report engine…</p>
        </div>
      </AppShell>
    );
  }

  const used = reports.length;
  const limit = ent?.reportsPerMonth ?? 0;

  return (
    <AppShell>
      <div className="space-y-4">
        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                <StatusDot pulse /> MODULE 05 · REPORT GENERATION
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">Reports</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Every report summarizes engine-recorded data only — logged sessions, meals, water, check-ins and
                measurements. Nothing is estimated or invented.
              </p>
            </div>
            <div className="flex gap-2">
              <StatChip label="USED THIS MONTH" value={used} />
              <StatChip label="PLAN LIMIT" value={limit === -1 ? "∞" : limit} tone="info" />
            </div>
          </div>
        </Panel>

        <SectionHeader index="01" title="GENERATE" hint="pick a report type" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REPORT_KINDS.map((k) => {
            const gated = k.kind === "competition" && !ent?.competitionAccess;
            return (
              <Panel key={k.kind} className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{k.label}</h3>
                    {gated ? <TerminalBadge tone="warn">COMPETITION PLAN</TerminalBadge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{k.description}</p>
                </div>
                <Button
                  onClick={() => runGenerate(k.kind)}
                  disabled={busyKind !== null || gated}
                  variant="outline"
                  className="mt-3 rounded-none text-[10px] uppercase tracking-[0.12em]"
                >
                  {busyKind === k.kind ? "GENERATING…" : gated ? "LOCKED" : "GENERATE →"}
                </Button>
              </Panel>
            );
          })}
        </div>

        <SectionHeader index="02" title="MY REPORTS" hint="newest first" />
        {reports.length === 0 ? (
          <Panel>
            <p className="text-sm text-muted-foreground">No reports yet — generate your first weekly review above.</p>
          </Panel>
        ) : (
          <div className="space-y-3">
            {reports.map((r: ReportRow) => (
              <Panel
                key={r._id}
                title={`${r.kind.toUpperCase()} · ${r.periodStart} → ${r.periodEnd}`}
                subtitle={new Date(r.createdAt).toLocaleString()}
                right={
                  <Button size="sm" variant="ghost" className="rounded-none text-[10px]" onClick={() => setOpenId(openId === r._id ? null : r._id)}>
                    {openId === r._id ? "HIDE ▲" : "VIEW ▼"}
                  </Button>
                }
              >
                {openId === r._id ? (
                  <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-foreground">{r.content}</pre>
                ) : (
                  r.dataSnapshot && (
                    <p className="font-mono text-[10px] text-muted-foreground">{r.dataSnapshot.replace(/[{}"]/g, " ").trim()}</p>
                  )
                )}
              </Panel>
            ))}
          </div>
        )}

        {!ent || ent.planSlug === "free" ? (
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            FREE PLAN INCLUDES {ent?.reportsPerMonth ?? 1} REPORT(S)/MONTH —{" "}
            <Link to="/subscription" className="text-status-ok underline underline-offset-4">UPGRADE FOR MORE</Link>
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
