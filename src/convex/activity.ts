import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

function today() {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* ActivityService — manual logging only; the engine never fabricates  */
/* device data.                                                        */
/* ------------------------------------------------------------------ */

export const logActivity = mutation({
  args: {
    kind: v.union(
      v.literal("steps"),
      v.literal("active_minutes"),
      v.literal("calories_burned"),
      v.literal("sleep_hours"),
    ),
    value: v.number(),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (args.value < 0) throw new Error("Value must be positive");

    const date = args.date ?? today();
    // Replace any existing manual entry of the same kind for that day.
    const existing = await ctx.db
      .query("activityLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .filter((q) => q.eq(q.field("kind"), args.kind))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value, createdAt: Date.now() });
      return existing._id;
    }
    const id = await ctx.db.insert("activityLogs", {
      userId,
      date,
      kind: args.kind,
      value: args.value,
      source: "manual",
      createdAt: Date.now(),
    });
    await ctx.runMutation(internal.services.memory.writeMemory, {
      userId,
      scope: "event",
      key: "activity_logged",
      content: `${args.kind.replace(/_/g, " ")}: ${args.value}`,
      source: "user_provided",
    });
    return id;
  },
});

export const getTodayActivity = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const logs = await ctx.db
      .query("activityLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today()))
      .collect();
    const map: Record<string, number> = {};
    for (const l of logs) map[l.kind] = l.value;
    return map;
  },
});

export const getActivityRange = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const days = args.days ?? 30;
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const logs = await ctx.db
      .query("activityLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return logs.filter((l) => l.date >= since).sort((a, b) => a.date.localeCompare(b.date));
  },
});

/* ------------------------------------------------------------------ */
/* CheckInService                                                      */
/* ------------------------------------------------------------------ */

export const submitCheckin = mutation({
  args: {
    didWorkout: v.boolean(),
    energyLevel: v.number(), // 1-5
    sleepHours: v.optional(v.number()),
    proteinOnTrack: v.optional(v.boolean()),
    waterOnTrack: v.optional(v.boolean()),
    steps: v.optional(v.number()),
    stressLevel: v.union(v.literal("low"), v.literal("moderate"), v.literal("high")),
    painOrSymptoms: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const date = today();

    // Upsert per day.
    const existing = await ctx.db
      .query("dailyCheckins")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .first();

    let id: Id<"dailyCheckins">;
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, createdAt: Date.now() });
      id = existing._id;
    } else {
      id = await ctx.db.insert("dailyCheckins", {
        userId,
        date,
        ...args,
        createdAt: Date.now(),
      });
    }

    // Event memory + milestone for streak building.
    await ctx.runMutation(internal.services.memory.writeMemory, {
      userId,
      scope: "event",
      key: "checkin",
      content: `Check-in: workout ${args.didWorkout ? "done" : "skipped"}, energy ${args.energyLevel}/5, stress ${args.stressLevel}.`,
      source: "user_provided",
    });
    await ctx.runMutation(internal.progress.recordStreak, {
      userId,
      kind: "checkin_streak",
    });

    // Pain flags are never diagnosed — surfaced to the coach context only.
    if (args.painOrSymptoms && args.painOrSymptoms !== "none") {
      await ctx.runMutation(internal.services.memory.writeMemory, {
        userId,
        scope: "event",
        key: "pain_report",
        content: `Reported: ${args.painOrSymptoms}`,
        source: "user_provided",
      });
    }
    return id;
  },
});

export const getCheckinHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("dailyCheckins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 30);
  },
});

export const getTodayCheckin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("dailyCheckins")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today()))
      .first();
  },
});
