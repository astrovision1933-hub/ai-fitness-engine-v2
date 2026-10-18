import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";

/* ------------------------------------------------------------------ */
/* HistoryService — one merged timeline of everything the user did:    */
/* workouts, check-ins, meals, activity, water, milestones, reviews.    */
/* The engine renders real records only — nothing is fabricated.       */
/* ------------------------------------------------------------------ */

export interface HistoryItem {
  at: number; // sort key (ms epoch)
  date: string; // yyyy-mm-dd where the record has one
  kind:
    | "workout"
    | "checkin"
    | "meal"
    | "water"
    | "activity"
    | "milestone"
    | "review"
    | "report";
  title: string;
  detail: string;
  status: string; // rendered as a badge (completed / skipped / measured …)
}

const CUT = 80; // timeline cap across all sources

async function collectTimeline(ctx: QueryCtx, userId: Id<"users">) {
  const items: HistoryItem[] = [];

  // Workouts — scheduled, completed or skipped sessions.
  const sessions: Doc<"workoutSessions">[] = await ctx.db
    .query("workoutSessions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(25);
  for (const s of sessions) {
    items.push({
      at: s.completedAt ?? s.startedAt ?? s._creationTime,
      date: s.completedAt
        ? new Date(s.completedAt).toISOString().slice(0, 10)
        : "upcoming",
      kind: "workout",
      title: s.name,
      detail:
        s.status === "completed"
          ? `${s.durationMinutes ?? "?"} min${
              s.difficultyFeedback ? ` · felt ${s.difficultyFeedback.replace(/_/g, " ")}` : ""
            }`
          : s.notes ?? "session planned",
      status: s.status,
    });
  }

  // Daily check-ins.
  const checkins: Doc<"dailyCheckins">[] = await ctx.db
    .query("dailyCheckins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(25);
  for (const c of checkins) {
    items.push({
      at: c.createdAt,
      date: c.date,
      kind: "checkin",
      title: c.didWorkout ? "Workout done" : "Rest day",
      detail: `energy ${c.energyLevel}/5 · stress ${c.stressLevel}${
        c.painOrSymptoms && c.painOrSymptoms !== "none"
          ? ` · pain: ${c.painOrSymptoms}`
          : ""
      }`,
      status: c.didWorkout ? "trained" : "rest",
    });
  }

  // Meals logged.
  const meals: Doc<"mealLogs">[] = await ctx.db
    .query("mealLogs")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", userId).gte("date", "0000-01-01"),
    )
    .order("desc")
    .take(30);
  for (const m of meals) {
    items.push({
      at: m.createdAt,
      date: m.date,
      kind: "meal",
      title: m.foodName,
      detail: `${m.mealSlot} · ${m.calories} kcal · ${m.proteinG}g protein`,
      status: "logged",
    });
  }

  // Manual activity entries.
  const activities: Doc<"activityLogs">[] = await ctx.db
    .query("activityLogs")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(20);
  for (const a of activities) {
    items.push({
      at: a.createdAt,
      date: a.date,
      kind: "activity",
      title: a.kind.replace(/_/g, " "),
      detail: `${a.value} (${a.source})`,
      status: "logged",
    });
  }

  // Water.
  const waters: Doc<"waterLogs">[] = await ctx.db
    .query("waterLogs")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(20);
  for (const w of waters) {
    items.push({
      at: w.createdAt,
      date: w.date,
      kind: "water",
      title: "Water intake",
      detail: `${w.amountMl} ml`,
      status: "logged",
    });
  }

  // Milestones.
  const milestones: Doc<"fitnessMilestones">[] = await ctx.db
    .query("fitnessMilestones")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(15);
  for (const m of milestones) {
    items.push({
      at: m.achievedAt,
      date: new Date(m.achievedAt).toISOString().slice(0, 10),
      kind: "milestone",
      title: m.title,
      detail: m.detail,
      status: m.kind.replace(/_/g, " "),
    });
  }

  // Weekly reviews.
  const reviews: Doc<"weeklyReviews">[] = await ctx.db
    .query("weeklyReviews")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(10);
  for (const r of reviews) {
    items.push({
      at: r._creationTime,
      date: r.weekStart,
      kind: "review",
      title: `Weekly review — week of ${r.weekStart}`,
      detail: `workouts ${(r.workoutAdherence * 100).toFixed(0)}% · nutrition ${(
        r.nutritionAdherence * 100
      ).toFixed(0)}% · weight trend ${r.weightTrend}`,
      status: r.nextWeekPriorities.length > 0 ? r.nextWeekPriorities[0] : "reviewed",
    });
  }

  // Generated reports.
  const reports: Doc<"generatedReports">[] = await ctx.db
    .query("generatedReports")
    .withIndex("by_user_created", (q) => q.eq("userId", userId))
    .order("desc")
    .take(10);
  for (const r of reports) {
    items.push({
      at: r.createdAt,
      date: r.periodEnd,
      kind: "report",
      title: `${r.kind} report`,
      detail: `${r.periodStart} → ${r.periodEnd}`,
      status: "generated",
    });
  }

  items.sort((a, b) => b.at - a.at);
  return items.slice(0, CUT);
}

/** Own history — every signed-in user can always see their own timeline. */
export const getMyHistory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await collectTimeline(ctx, userId);
  },
});

/** Any client's history — admin only, exactly like the admin panel detail. */
export const getClientHistory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const adminId = await getAuthUserId(ctx);
    if (!adminId) throw new Error("Not authenticated");
    const admin = await ctx.db.get(adminId);
    if (!admin || admin.role !== "admin" || admin.disabled) {
      throw new Error("Admin access required");
    }
    const client = await ctx.db.get(args.userId);
    if (!client) return null;
    const timeline = await collectTimeline(ctx, args.userId);
    return {
      client: {
        _id: client._id,
        email: client.email ?? "(anonymous)",
        name: client.name ?? null,
        role: client.role ?? "user",
      },
      timeline,
    };
  },
});
