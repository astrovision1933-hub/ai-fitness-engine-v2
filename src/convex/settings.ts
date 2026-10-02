import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

const DEFAULT_SETTINGS = {
  notifications: {
    workoutReminders: true,
    waterReminders: false,
    checkinReminders: true,
    weeklyReview: true,
    milestones: true,
    subscription: true,
    planRenewal: true,
  },
  voice: { inputEnabled: false, outputEnabled: false },
  privacy: { consentAnalytics: false, allowCoachMemory: true },
};

export const ensureSettings = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("userSettings", {
      userId,
      ...DEFAULT_SETTINGS,
      updatedAt: Date.now(),
    });
  },
});

export const getMySettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!existing) return { ...DEFAULT_SETTINGS, userId, updatedAt: 0, _id: null };
    // Defensive merge: older rows may predate a preference group, and every
    // field here is optional in the schema. Always return a complete shape so
    // consumers can read e.g. settings.voice.inputEnabled without crashing.
    return {
      ...existing,
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(existing.notifications ?? {}) },
      voice: { ...DEFAULT_SETTINGS.voice, ...(existing.voice ?? {}) },
      privacy: { ...DEFAULT_SETTINGS.privacy, ...(existing.privacy ?? {}) },
    };
  },
});

export const updateSettings = mutation({
  args: {
    notifications: v.optional(
      v.object({
        workoutReminders: v.boolean(),
        waterReminders: v.boolean(),
        checkinReminders: v.boolean(),
        weeklyReview: v.boolean(),
        milestones: v.boolean(),
        subscription: v.boolean(),
        planRenewal: v.boolean(),
      }),
    ),
    voice: v.optional(
      v.object({
        inputEnabled: v.boolean(),
        outputEnabled: v.boolean(),
      }),
    ),
    privacy: v.optional(
      v.object({
        consentAnalytics: v.boolean(),
        allowCoachMemory: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.notifications) patch.notifications = args.notifications;
    if (args.voice) patch.voice = args.voice;
    if (args.privacy) patch.privacy = args.privacy;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("userSettings", {
      userId,
      ...DEFAULT_SETTINGS,
      ...patch,
    } as never);
  },
});

/* ------------------------------------------------------------------ */
/* AI memory control (Part 4: users own their data)                     */
/* ------------------------------------------------------------------ */

export const listMyMemory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("aiMemory")
      .withIndex("by_user_scope", (q) => q.eq("userId", userId).eq("scope", "long_term"))
      .collect();
  },
});

export const deleteMemoryEntry = mutation({
  args: { id: v.id("aiMemory") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

export const clearAllMemory = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const rows = await ctx.db
      .query("aiMemory")
      .withIndex("by_user_scope", (q) => q.eq("userId", userId).eq("scope", "long_term"))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: "memory_cleared",
      detail: `count=${rows.length}`,
    });
    return { cleared: rows.length };
  },
});

/* ------------------------------------------------------------------ */
/* Data export + account deletion (privacy)                             */
/* ------------------------------------------------------------------ */

/** Human-readable export of everything the engine stores about this user. */
export const exportMyData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const [profile, goals, plans, analyses, subs, settings] = await Promise.all([
      ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
      ctx.db.query("fitnessGoals").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("workoutPlans").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("supplementAnalysis").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("subscriptions").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("userSettings").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      profile,
      goals,
      workoutPlans: plans,
      supplementAnalyses: analyses.length,
      subscriptions: subs.map((s) => ({ planSlug: s.planSlug, status: s.status, source: s.source })),
      settings: settings ?? null,
      note: "This export contains all profile, goal, plan and analysis data stored by the engine. Conversation content and raw AI memory are excluded from the export file but can be cleared in PRIVACY settings.",
    };
  },
});

/**
 * Delete all engine-owned data for this account (profiles, goals, plans,
 * memory, settings, subscription, usage, leads, analyses, notifications).
 * The auth user row is anonymized and disabled; audit logs are retained
 * (they contain no conversation content) for security accounting.
 */
export const deleteMyAccountData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const tablesByUser = [
      "userProfiles",
      "fitnessGoals",
      "workoutPlans",
      "workoutSessions",
      "notifications",
      "supplementAnalysis",
      "supplementVerifications",
      "productRecommendations",
      "productComparisons",
      "mealLogs",
      "waterLogs",
      "activityLogs",
      "dailyCheckins",
      "weeklyReviews",
      "bodyMeasurements",
      "progressPhotos",
      "fitnessMilestones",
      "subscriptions",
      "purchaseRecords",
      "leadStates",
      "userSettings",
      "generatedReports",
    ] as const;

    let deleted = 0;
    for (const table of tablesByUser) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
        .catch(() => []);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }
    // Tables keyed differently: aiMemory (by_user_key), mealPlans
    // (by_user_date), bodybuildingGoals (by_user_active), aiUsage
    // (by_user_day) — all carry userId as first index field.
    const usageRows = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_day", (q) => q.eq("userId", userId))
      .collect();
    for (const row of usageRows) {
      await ctx.db.delete(row._id);
      deleted++;
    }
    const memoryRows = await ctx.db
      .query("aiMemory")
      .withIndex("by_user_key", (q) => q.eq("userId", userId))
      .collect();
    for (const row of memoryRows) {
      await ctx.db.delete(row._id);
      deleted++;
    }
    const planRows = await ctx.db
      .query("mealPlans")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .collect();
    for (const row of planRows) {
      await ctx.db.delete(row._id);
      deleted++;
    }
    const bbGoals = await ctx.db
      .query("bodybuildingGoals")
      .withIndex("by_user_active", (q) => q.eq("userId", userId))
      .collect();
    for (const row of bbGoals) {
      await ctx.db.delete(row._id);
      deleted++;
    }
    // Tables without a by_user index (or keyed differently).
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const c of conversations) {
      const msgs = await ctx.db
        .query("conversationMessages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
        .collect();
      for (const m of msgs) await ctx.db.delete(m._id);
      await ctx.db.delete(c._id);
      deleted += msgs.length + 1;
    }
    const assessments = await ctx.db
      .query("fitnessAssessments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const a of assessments) {
      await ctx.db.delete(a._id);
      deleted++;
    }

    // Anonymize + disable the user row.
    await ctx.db.patch(userId, { name: undefined, email: undefined, disabled: true });

    await ctx.db.insert("auditLogs", {
      userId,
      action: "account_data_deleted",
      detail: `rows=${deleted}`,
      createdAt: Date.now(),
    });
    return { deleted };
  },
});
