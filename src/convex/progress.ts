import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function weekStart(d = new Date()): string {
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Measurements                                                        */
/* ------------------------------------------------------------------ */

export const addBodyMeasurement = mutation({
  args: {
    date: v.optional(v.string()),
    weightKg: v.optional(v.number()),
    waistCm: v.optional(v.number()),
    chestCm: v.optional(v.number()),
    armCm: v.optional(v.number()),
    legCm: v.optional(v.number()),
    shoulderCm: v.optional(v.number()),
    bodyFatPct: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const id = await ctx.db.insert("bodyMeasurements", {
      userId,
      date: args.date ?? today(),
      ...args,
      createdAt: Date.now(),
    });

    // Sync primary weight into the profile for context engine accuracy.
    if (args.weightKg) {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      if (profile) await ctx.db.patch(profile._id, { weightKg: args.weightKg });
    }

    await ctx.runMutation(internal.services.memory.writeMemory, {
      userId,
      scope: "event",
      key: "measurement",
      content: `Measured ${args.weightKg ? `${args.weightKg}kg` : ""}${args.waistCm ? ` waist ${args.waistCm}cm` : ""}${args.armCm ? ` arm ${args.armCm}cm` : ""} on ${args.date ?? today()}.`,
      source: "user_provided",
    });
    return id;
  },
});

export const getMeasurements = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const all = await ctx.db
      .query("bodyMeasurements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 60);
    return all.reverse(); // oldest first for charting
  },
});

/* ------------------------------------------------------------------ */
/* Progress photos — private by default, user-controlled               */
/* ------------------------------------------------------------------ */

export const addProgressPhoto = mutation({
  args: {
    date: v.optional(v.string()),
    pose: v.union(v.literal("front"), v.literal("side"), v.literal("back")),
    dataUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (args.dataUrl && args.dataUrl.length > 400_000) {
      throw new Error("Image too large — use a smaller photo (max ~300KB)");
    }
    const id = await ctx.db.insert("progressPhotos", {
      userId,
      date: args.date ?? today(),
      pose: args.pose,
      dataUrl: args.dataUrl,
      createdAt: Date.now(),
    });
    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: "progress_photo_added",
      detail: args.pose,
    });
    return id;
  },
});

export const getProgressPhotos = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("progressPhotos")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(24);
  },
});

export const deleteProgressPhoto = mutation({
  args: { photoId: v.id("progressPhotos") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const photo = await ctx.db.get(args.photoId);
    if (!photo || photo.userId !== userId) throw new Error("Photo not found");
    await ctx.db.delete(args.photoId);
    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: "progress_photo_deleted",
      detail: args.photoId,
    });
  },
});

/* ------------------------------------------------------------------ */
/* Streaks & milestones                                                */
/* ------------------------------------------------------------------ */

/** Records a same-day action; awards milestone at streak thresholds. */
export const recordStreak = internalMutation({
  args: { userId: v.id("users"), kind: v.string() },
  handler: async (ctx, args) => {
    const userId = args.userId;
    const kind = args.kind;
    const date = today();

    const existing = await ctx.db
      .query("fitnessMilestones")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);

    const todayMilestone = existing.find(
      (m) => m.kind === kind && new Date(m.achievedAt).toISOString().slice(0, 10) === date,
    );
    if (todayMilestone) return; // once per day per kind

    const streakDays = existing.filter(
      (m) => m.kind === kind && m.title.includes("day streak"),
    ).length;

    const next = streakDays + 1;
    const thresholds = [1, 3, 7, 14, 30, 60, 100];
    if (thresholds.includes(next)) {
      await ctx.db.insert("fitnessMilestones", {
        userId,
        kind,
        title: `${next} day ${kind.replace(/_/g, " ")}`,
        detail: `Consistency milestone reached — ${next} consecutive days.`,
        achievedAt: Date.now(),
      });
      await ctx.runMutation(internal.services.memory.createNotification, {
        userId,
        type: "milestone",
        title: "Milestone unlocked",
        body: `${next} day ${kind.replace(/_/g, " ")} streak.`,
      });
    }
  },
});

export const getMilestones = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("fitnessMilestones")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});

/* ------------------------------------------------------------------ */
/* Weekly review (ProgressService — deterministic analysis)            */
/* ------------------------------------------------------------------ */

export const generateWeeklyReview = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const ws = weekStart();

    const existing = await ctx.db
      .query("weeklyReviews")
      .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekStart", ws))
      .first();
    if (existing) return { reviewId: existing._id, weekStart: ws };

    const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const sessions = (await ctx.db
      .query("workoutSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()).filter((s) => s.completedAt && s.completedAt >= new Date(since).getTime());

    const checkins = (await ctx.db
      .query("dailyCheckins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()).filter((c) => c.date >= since);

    const meals = (await ctx.db
      .query("mealLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()).filter((m) => m.date >= since);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const goal = profile?.activeGoalId ? await ctx.db.get(profile.activeGoalId) : null;
    const plannedPerWeek = profile?.training?.daysPerWeek ?? 3;

    const workoutAdherence = Math.min(1, sessions.length / plannedPerWeek);
    const daysWithLogs = new Set(meals.map((m) => m.date)).size;
    const nutritionAdherence = Math.min(1, daysWithLogs / 7);
    const proteinDays = checkins.filter((c) => c.proteinOnTrack).length;
    const proteinConsistency = checkins.length ? proteinDays / checkins.length : 0;

    const measurements = (await ctx.db
      .query("bodyMeasurements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10)).reverse();
    const weights = measurements.map((m) => m.weightKg).filter((w): w is number => w != null);
    const weightTrend =
      weights.length >= 2
        ? (() => {
            const delta = Number((weights[weights.length - 1] - weights[0]).toFixed(1));
            return `${delta > 0 ? "+" : ""}${delta}kg over last ${weights.length} entries`;
          })()
        : "not enough data";

    const stepsLogs = (await ctx.db
      .query("activityLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()).filter((l) => l.date >= since && l.kind === "steps");
    const avgSteps = stepsLogs.length
      ? Math.round(stepsLogs.reduce((s, l) => s + l.value, 0) / stepsLogs.length)
      : null;

    const obstacles: string[] = [];
    const priorities: string[] = [];
    if (workoutAdherence < 0.6)
      obstacles.push("Workout adherence below target — check schedule and session difficulty");
    if (nutritionAdherence < 0.5)
      obstacles.push("Nutrition logging was sparse — meal prep or reminders may help");
    if (proteinConsistency < 0.5 && checkins.length > 0)
      obstacles.push("Protein target hit on fewer than half of checked-in days");
    if (avgSteps !== null && avgSteps < 5000)
      obstacles.push(`Daily steps averaged ${avgSteps} — low activity outside training`);
    if (checkins.some((c) => c.stressLevel === "high"))
      obstacles.push("High stress reported — keep intensity moderate and prioritize sleep");
    if (checkins.some((c) => c.painOrSymptoms && c.painOrSymptoms !== "none"))
      obstacles.push("Pain or symptoms reported — get cleared before pushing intensity");

    if (workoutAdherence >= 0.8) priorities.push("Maintain training consistency");
    else priorities.push("Rebuild workout consistency — protect the schedule first");
    if (nutritionAdherence < 0.7) priorities.push("Focus on meal preparation and logging");
    if (proteinConsistency < 0.7) priorities.push("Anchor protein at every meal");
    if (avgSteps !== null && avgSteps < 6000) priorities.push("Add a daily walk target");
    if (priorities.length === 0) priorities.push("Hold the course — current inputs are working");

    const summary =
      `Workout adherence ${Math.round(workoutAdherence * 100)}% (${sessions.length}/${plannedPerWeek} sessions). ` +
      `Nutrition logged on ${daysWithLogs}/7 days. ` +
      (workoutAdherence >= 0.7 && nutritionAdherence < 0.6
        ? "Your workout consistency was solid this week; nutrition consistency was lower, so let's focus on meal preparation next week."
        : workoutAdherence < 0.6
          ? "Training slipped this week — we'll look at schedule, recovery and difficulty before changing any volume."
          : "Steady week — trends look consistent.");

    const id = await ctx.db.insert("weeklyReviews", {
      userId,
      weekStart: ws,
      workoutAdherence,
      nutritionAdherence,
      proteinConsistency,
      weightTrend,
      activityTrend: avgSteps !== null ? `avg ${avgSteps} steps/day` : "no step data logged",
      goalProgress: goal ? `Working toward ${goal.goal} — target ${goal.targetDate ?? "not set"}` : "no active goal",
      obstacles,
      nextWeekPriorities: priorities,
      summary,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.services.memory.writeMemory, {
      userId,
      scope: "event",
      key: "weekly_review",
      content: summary,
      source: "system_data",
    });

    return { reviewId: id, weekStart: ws };
  },
});

export const getWeeklyReviews = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("weeklyReviews")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 8);
  },
});

export const getProgressSummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const measurements = await ctx.db
      .query("bodyMeasurements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(60);

    const sessions = await ctx.db
      .query("workoutSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(30);

    const completed = sessions.filter((s) => s.status === "completed").length;
    const adherence = sessions.length ? completed / sessions.length : 0;

    return { measurements: measurements.reverse(), adherence };
  },
});
