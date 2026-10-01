// Internal persistence + data collection for reports. Separate module so
// report actions never reference their own module's API (self-references
// break Convex type inference).
import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

export const collectReportData = internalQuery({
  args: { userId: v.id("users"), start: v.string(), end: v.string() },
  handler: async (ctx, args) => {
    const [sessions, mealLogs, waterLogs, checkins, measurements, analyses, activity] = await Promise.all([
      ctx.db.query("workoutSessions").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("mealLogs").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("waterLogs").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("dailyCheckins").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("bodyMeasurements").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("supplementAnalysis").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("activityLogs").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect(),
    ]);
    return {
      sessions: sessions
        .filter((s) => (s.completedAt ?? 0) >= new Date(args.start + "T00:00:00Z").getTime())
        .slice(0, 40),
      mealLogs: mealLogs.filter((l) => l.date >= args.start && l.date <= args.end).slice(0, 200),
      waterMl: waterLogs
        .filter((l) => l.date >= args.start && l.date <= args.end)
        .reduce((s, l) => s + l.amountMl, 0),
      checkins: checkins.filter((c) => c.date >= args.start && c.date <= args.end).slice(0, 40),
      measurements: measurements.filter((m) => m.date >= args.start && m.date <= args.end).slice(0, 20),
      analyses: analyses.filter((a) => a.createdAt >= new Date(args.start + "T00:00:00Z").getTime()).slice(0, 10),
      activity: activity.filter((a) => a.date >= args.start && a.date <= args.end).slice(0, 60),
    };
  },
});

export const saveReport = internalMutation({
  args: {
    userId: v.id("users"),
    kind: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    content: v.string(),
    dataSnapshot: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("generatedReports", {
      userId: args.userId,
      kind: args.kind,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      content: args.content,
      dataSnapshot: args.dataSnapshot,
      createdAt: Date.now(),
    });
  },
});
