import { v } from "convex/values";
import { action, mutation, query, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

type ReportKind = "weekly" | "monthly" | "progress" | "workout" | "nutrition" | "competition";

const KINDS: ReportKind[] = ["weekly", "monthly", "progress", "workout", "nutrition", "competition"];

/** Check the user's plan allows another report this month (deterministic). */
export const checkReportAllowance = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const ent = await ctx.runQuery(internal.subscriptions.getEntitlement, { userId });
    const monthStart = today().slice(0, 7) + "-01";
    const rows = await ctx.db
      .query("generatedReports")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const usedThisMonth = rows.filter((r) => r.createdAt >= new Date(monthStart + "T00:00:00Z").getTime()).length;
    if (usedThisMonth >= ent.reportsPerMonth) {
      throw new Error(
        `Monthly report limit reached for the ${ent.planName} plan (${ent.reportsPerMonth}/month). Upgrade in SUBSCRIPTION for more.`,
      );
    }
    return { used: usedThisMonth, limit: ent.reportsPerMonth, plan: ent.planName };
  },
});

export const generateReport = action({
  args: { kind: v.union(...KINDS.map((k) => v.literal(k))) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const ent = await ctx.runQuery(internal.subscriptions.getEntitlement, { userId });
    if (args.kind === "competition" && !ent.competitionAccess) {
      throw new Error("Competition reports require the Competition plan.");
    }

    const end = today();
    const start =
      args.kind === "monthly" ? daysAgo(30) : args.kind === "weekly" ? daysAgo(7) : daysAgo(14);

    // Real recorded data only — the report summarizes what actually exists.
    const data = await ctx.runQuery(internal.reportStore.collectReportData, { userId, start, end });
    const content = buildReport(args.kind, start, end, data);

    const saved = await ctx.runMutation(internal.reportStore.saveReport, {
      userId,
      kind: args.kind,
      periodStart: start,
      periodEnd: end,
      content,
      dataSnapshot: JSON.stringify({
        sessions: data.sessions.length,
        completed: data.sessions.filter((s) => s.status === "completed").length,
        mealsLogged: data.mealLogs.length,
        waterMl: data.waterMl,
        checkins: data.checkins.length,
        measurements: data.measurements.length,
        analyses: data.analyses.length,
      }),
    });

    await ctx.runMutation(internal.services.lead.recordLeadSignal, {
      userId,
      signal: "report_generated",
      minRank: 2,
    });

    return { id: saved, content, period: { start, end } };
  },
});

export const getMyReports = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("generatedReports")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 10);
  },
});

/* ---------------- deterministic report builder ---------------- */

type ReportData = {
  sessions: Array<{
    name: string;
    status: string;
    completedAt?: number;
    durationMinutes?: number;
    difficultyFeedback?: string;
  }>;
  mealLogs: Array<{ date: string; calories: number; proteinG: number }>;
  waterMl: number;
  checkins: Array<{ date: string; didWorkout: boolean; energyLevel: number; stressLevel: string }>;
  measurements: Array<{ date: string; weightKg?: number }>;
  analyses: unknown[];
  activity: Array<{ kind: string; value: number }>;
};

function buildReport(kind: ReportKind, start: string, end: string, data: ReportData): string {
  const completed = data.sessions.filter((s) => s.status === "completed");
  const totalMin = completed.reduce((s, x) => s + (x.durationMinutes ?? 0), 0);
  const kcal = data.mealLogs.reduce((s, x) => s + x.calories, 0);
  const protein = data.mealLogs.reduce((s, x) => s + x.proteinG, 0);
  const days = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
  const weights = data.measurements.filter((m) => m.weightKg !== undefined).map((m) => m.weightKg!);
  const weightTrend =
    weights.length >= 2
      ? `${(weights[weights.length - 1] - weights[0]).toFixed(1)}kg over ${weights.length} entries`
      : weights.length === 1
        ? "single entry recorded"
        : "no measurements recorded";

  const lines: string[] = [];
  lines.push(`REPORT: ${kind.toUpperCase()}`);
  lines.push(`PERIOD: ${start} → ${end} (${days} days)`);
  lines.push(`SOURCE: engine-recorded data only — nothing here is estimated or invented.`);
  lines.push("");
  lines.push("TRAINING");
  lines.push(`- Sessions completed: ${completed.length}`);
  lines.push(`- Training minutes logged: ${totalMin}`);
  if (completed.length)
    lines.push(
      `- Session load felt: ${completed
        .map((s) => s.difficultyFeedback ?? "not rated")
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(", ")}`,
    );
  lines.push("");
  lines.push("NUTRITION");
  lines.push(`- Days with meals logged: ${new Set(data.mealLogs.map((l) => l.date)).size}`);
  lines.push(`- Average protein: ${Math.round(protein / days)}g/day (from logged food)`);
  lines.push(`- Average calories: ${Math.round(kcal / days)}/day (from logged food)`);
  lines.push(`- Water logged: ${(data.waterMl / 1000).toFixed(1)}L total`);
  lines.push("");
  lines.push("RECOVERY & ACTIVITY");
  lines.push(`- Check-ins: ${data.checkins.length} (energy avg ${data.checkins.length ? (data.checkins.reduce((s, c) => s + c.energyLevel, 0) / data.checkins.length).toFixed(1) : "—"}/5)`);
  lines.push(`- Weight trend: ${weightTrend}`);
  if (data.analyses.length) lines.push(`- Supplement labels analyzed: ${data.analyses.length}`);
  lines.push("");
  lines.push(
    completed.length >= Math.ceil(days / 3)
      ? "ADHERENCE: strong — training frequency is on track."
      : "ADHERENCE: gap detected — training sessions are below the planned frequency. Consider scheduling sessions in advance.",
  );
  return lines.join("\n");
}
