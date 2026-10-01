import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Panel, StatChip, TerminalBadge, AsciiBar, StatusDot, SectionHeader } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { GOAL_LABELS } from "@/lib/labels";

const QUICK_ACTIONS = [
  { label: "TODAY'S WORKOUT", to: "/workout" },
  { label: "CREATE WORKOUT", to: "/workout?generate=1" },
  { label: "LOG FOOD", to: "/nutrition" },
  { label: "MEAL PLAN", to: "/nutrition" },
  { label: "DAILY CHECK-IN", to: "/checkin" },
  { label: "MY PROGRESS", to: "/progress" },
  { label: "MY GOAL", to: "/goals" },
  { label: "ASK COACH", to: "/coach" },
  { label: "SUPPLEMENTS", to: "/supplements" },
  { label: "PRODUCTS", to: "/products" },
  { label: "REPORTS", to: "/reports" },
] as const;

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const profile = useQuery(api.profile.getProfile);
  const goal = useQuery(api.profile.getActiveGoal);
  const plan = useQuery(api.workouts.getActivePlan);
  const sessions = useQuery(api.workouts.getRecentSessions, { limit: 6 });
  const notifications = useQuery(api.profile.getNotifications);
  const memory = useQuery(api.profile.getMemory);
  const latestConversation = useQuery(api.coachChat.getLatestConversation);

  const seedPersonas = useMutation(api.coachPersonas.seedPersonasPublic);

  useEffect(() => {
    seedPersonas({}).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loading =
    authLoading ||
    profile === undefined ||
    goal === undefined ||
    plan === undefined ||
    sessions === undefined;

  // Signed-in users must complete onboarding before the console unlocks.
  useEffect(() => {
    if (!loading && profile && !profile.onboardingComplete) {
      navigate("/onboarding", { replace: true });
    }
    if (!loading && profile === null) {
      navigate("/onboarding", { replace: true });
    }
  }, [loading, profile, navigate]);

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-2 font-mono text-xs text-muted-foreground">
          <p>&gt; loading engine modules…</p>
          <p>&gt; profile ………… OK</p>
          <p>&gt; rendering console</p>
        </div>
      </AppShell>
    );
  }

  const firstName = profile?.name ?? user?.name ?? "athlete";
  const now = new Date();
  const greeting = greetingFor(now.getHours());

  const nextSession = sessions?.find((s) => s.status === "scheduled" || s.status === "in_progress");
  const completedCount = sessions?.filter((s) => s.status === "completed").length ?? 0;
  const adherence = sessions && sessions.length > 0 ? completedCount / Math.max(sessions.length, 4) : 0;

  const daysLeft = goal?.targetDate
    ? Math.max(
        0,
        Math.ceil((new Date(goal.targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      )
    : null;

  // Contextual coach line — real data, never a generic hello.
  const coachLine = goal
    ? `You're currently working toward ${GOAL_LABELS[goal.goal] ?? goal.goal}. ${
        nextSession
          ? `Today's priority: ${nextSession.name} — complete it and stay consistent with your nutrition target.`
          : "No session scheduled — generate a plan in the WORKOUT module or ask me to build one."
      }`
    : "Set your goal and I'll structure your training around it.";

  return (
    <AppShell>
      <div className="space-y-4">
        {/* greeting block */}
        <Panel>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                <StatusDot pulse /> DAILY COACH · {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" }).toUpperCase()}
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                {greeting}, {firstName}.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {goal ? (
                  <>
                    Your current goal is{" "}
                    <span className="font-semibold text-status-ok">
                      {(GOAL_LABELS[goal.goal] ?? goal.goal).toLowerCase()}
                    </span>
                    .{daysLeft !== null ? ` ${daysLeft} days to target.` : ""}
                  </>
                ) : (
                  "No active goal on file."
                )}
              </p>
            </div>
            <TerminalBadge tone="ok">ENGINE ONLINE</TerminalBadge>
          </div>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* today's workout */}
          <Panel title="TODAY'S WORKOUT" className="lg:col-span-2">
            {nextSession ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold">{nextSession.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {nextSession.status === "in_progress" ? "IN PROGRESS" : "SCHEDULED"} ·{" "}
                    {profile?.training ? `${profile.training.sessionMinutes} min target` : "time n/a"}
                  </div>
                  <div className="mt-2">
                    <AsciiBar value={nextSession.status === "in_progress" ? 0.4 : 0} />
                  </div>
                </div>
                <Button asChild className="rounded-none text-[11px] uppercase tracking-[0.14em]">
                  <Link to="/workout">
                    {nextSession.status === "in_progress" ? "RESUME →" : "START →"}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {plan
                    ? "All scheduled sessions done. Rest or ask the coach for extra work."
                    : "No active plan. Generate one from your profile in one click."}
                </p>
                <Button asChild variant="outline" className="rounded-none text-[11px] uppercase tracking-[0.14em]">
                  <Link to="/workout?generate=1">OPEN WORKOUT ENGINE →</Link>
                </Button>
              </div>
            )}
          </Panel>

          {/* goal progress */}
          <Panel title="GOAL PROGRESS">
            <div className="space-y-3">
              <StatChip label="ADHERENCE (LAST SESSIONS)" value={`${Math.round(adherence * 100)}%`} tone="ok" />
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>TARGET</span>
                  <span className="text-foreground">{goal?.targetDate ?? "NOT SET"}</span>
                </div>
                <div className="flex justify-between">
                  <span>ACTIVE PLAN</span>
                  <span className="text-foreground">{plan ? plan.daysPerWeek + "D/WK" : "NONE"}</span>
                </div>
                <div className="flex justify-between">
                  <span>WORKOUTS DONE</span>
                  <span className="text-foreground">{completedCount}</span>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full rounded-none text-[10px] uppercase tracking-[0.14em]">
                <Link to="/profile">VIEW FULL PROFILE →</Link>
              </Button>
            </div>
          </Panel>
        </div>

        {/* coach message */}
        <Panel title="COACH MESSAGE" subtitle="contextual — built from your live profile data">
          <p className="text-sm leading-6">{coachLine}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" className="rounded-none text-[10px] uppercase tracking-[0.14em]">
              <Link to="/coach">OPEN COACH CHAT →</Link>
            </Button>
            {latestConversation && (
              <span className="self-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                LAST SESSION: {new Date(latestConversation.lastMessageAt).toLocaleString()}
              </span>
            )}
          </div>
        </Panel>

        {/* quick actions */}
        <Panel title="QUICK ACTIONS">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className="border border-border bg-secondary/50 px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors hover:border-terminal-green/50 hover:bg-[#eef3ea] hover:text-status-ok"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* recent activity */}
          <Panel title="RECENT ACTIVITY">
            {sessions && sessions.length > 0 ? (
              <div className="space-y-1.5">
                {sessions.slice(0, 5).map((s) => (
                  <div key={s._id} className="flex items-center justify-between border-b border-border/60 py-1.5 text-xs last:border-0">
                    <span>{s.name}</span>
                    <span className="flex items-center gap-2">
                      <TerminalBadge tone={s.status === "completed" ? "ok" : s.status === "in_progress" ? "warn" : "ink"}>
                        {s.status}
                      </TerminalBadge>
                      {s.completedAt && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(s.completedAt).toLocaleDateString()}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No sessions logged yet.</p>
            )}
          </Panel>

          {/* notifications + memory */}
          <Panel title="EVENT MEMORY / NOTIFICATIONS">
            <div className="space-y-1.5">
              {(notifications ?? []).slice(0, 3).map((n) => (
                <div key={n._id} className="border-b border-border/60 py-1.5 text-xs last:border-0">
                  <span className="font-semibold">{n.title}</span>
                  <span className="text-muted-foreground"> — {n.body}</span>
                </div>
              ))}
              {(memory ?? []).slice(0, 4).map((m) => (
                <div key={m._id} className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 text-xs last:border-0">
                  <span className="text-muted-foreground">{m.content}</span>
                  <TerminalBadge tone={m.scope === "event" ? "info" : "ink"}>{m.scope}</TerminalBadge>
                </div>
              ))}
              {!notifications?.length && !memory?.length && (
                <p className="text-xs text-muted-foreground">No events yet — they appear as you train.</p>
              )}
            </div>
          </Panel>
        </div>

        <SectionHeader index="→" title="MODULE MAP" hint="all 12 modules live" />
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          CORE · COACH · WORKOUT · NUTRITION · PROGRESS · CHECK-IN · GOALS · BODYBUILDING · SUPPLEMENTS · PRODUCTS · REPORTS · SETTINGS &amp; PLAN
        </p>
      </div>
    </AppShell>
  );
}
