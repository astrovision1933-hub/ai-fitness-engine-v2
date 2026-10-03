import { v } from "convex/values";
import { action, mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

type Plan = Doc<"subscriptionPlans">;

/* ------------------------------------------------------------------ */
/* Plans (admin-configurable; seeded defaults, idempotent)              */
/* ------------------------------------------------------------------ */

// AI COACH BOT TIERS — bots are divided by plan:
//   ₹499  Premium    → 2 bots (ARJUN + VEER)
//   ₹999  Pro Coach  → 3 bots (AARAV unlocks)
//   ₹1499 Elite Pro  → ALL bots incl. PRO CATEGORY (KABIR, RHEA, RUDRA, ATHENA,
//                      MAX, COACH PRIME): competition preparation, nutrition
//                      tracking, supplement suggestions, weekly body tracking,
//                      food/body-weight planning + protein/carb/fat quantities.
const DEFAULT_PLANS: Array<Omit<Plan, "_id" | "_creationTime">> = [
  {
    slug: "free",
    name: "Free",
    priceInr: 0,
    features: ["2 AI coach bots", "Workout plans", "Basic nutrition targets", "Progress tracking"],
    aiMessageLimit: 10,
    reportsPerMonth: 1,
    coachingAccess: true,
    nutritionAccess: true,
    competitionAccess: false,
    supplementAccess: true,
    voiceAccess: false,
    advancedAnalytics: false,
    botLimit: 2,
    isActive: true,
    sortOrder: 0,
  },
  {
    slug: "premium",
    name: "Premium",
    priceInr: 499,
    features: [
      "2 AI coach bots (ARJUN + VEER)",
      "Personalized nutrition plans",
      "Supplement intelligence + product analysis",
      "Weekly + monthly reports",
      "Voice coaching",
    ],
    aiMessageLimit: 100,
    reportsPerMonth: 10,
    coachingAccess: true,
    nutritionAccess: true,
    competitionAccess: false,
    supplementAccess: true,
    voiceAccess: true,
    advancedAnalytics: true,
    botLimit: 2,
    isActive: true,
    sortOrder: 1,
  },
  {
    slug: "pro_coach",
    name: "Pro Coach",
    priceInr: 999,
    features: [
      "3 AI coach bots (+ AARAV nutrition)",
      "Everything in Premium",
      "Advanced analytics",
      "Priority AI responses",
      "Extended plan adaptation",
    ],
    aiMessageLimit: 300,
    reportsPerMonth: 30,
    coachingAccess: true,
    nutritionAccess: true,
    competitionAccess: false,
    supplementAccess: true,
    voiceAccess: true,
    advancedAnalytics: true,
    botLimit: 3,
    isActive: true,
    sortOrder: 2,
  },
  {
    slug: "competition",
    name: "Elite Pro",
    priceInr: 1499,
    features: [
      "ALL AI coach bots — PRO category",
      "Competition preparation + peak week",
      "Nutrition tracking + supplement suggestions",
      "Weekly body tracking + food/body-weight planning",
      "Protein / carbs / fat quantity guidance",
    ],
    aiMessageLimit: 500,
    reportsPerMonth: 60,
    coachingAccess: true,
    nutritionAccess: true,
    competitionAccess: true,
    supplementAccess: true,
    voiceAccess: true,
    advancedAnalytics: true,
    botLimit: 9,
    isActive: true,
    sortOrder: 3,
  },
];

export const seedPlans = mutation({
  args: {},
  handler: async (ctx) => {
    for (const plan of DEFAULT_PLANS) {
      const existing = await ctx.db
        .query("subscriptionPlans")
        .withIndex("by_slug", (q) => q.eq("slug", plan.slug))
        .first();
      if (!existing) {
        await ctx.db.insert("subscriptionPlans", plan);
      } else {
        // Upsert key pricing/features so tier redesigns propagate to live data.
        await ctx.db.patch(existing._id, {
          name: plan.name,
          priceInr: plan.priceInr,
          features: plan.features,
          botLimit: plan.botLimit,
          sortOrder: plan.sortOrder,
          isActive: true,
        });
      }
    }
    return { ok: true };
  },
});

export const getPlans = query({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db.query("subscriptionPlans").collect();
    return plans.filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/* ------------------------------------------------------------------ */
/* My subscription                                                      */
/* ------------------------------------------------------------------ */

export const getMySubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    if (!sub) return null;
    const plan = await ctx.db
      .query("subscriptionPlans")
      .withIndex("by_slug", (q) => q.eq("slug", sub.planSlug))
      .first();
    return { subscription: sub, plan: plan ?? null };
  },
});

/** Create the default free subscription for a user if none exists. */
export const ensureSubscription = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("subscriptions", {
      userId,
      planSlug: "free",
      status: "active",
      source: "admin",
      cancelAtPeriodEnd: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const startTrial = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (sub && (sub.status === "trialing" || (sub.source === "trial" && sub.status !== "expired"))) {
      throw new Error("You have already used or are using a trial.");
    }
    // Trials were used if any past subscription row for this user had source "trial".
    const past = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (past.some((s) => s.source === "trial")) {
      throw new Error("Trial already used on this account.");
    }

    const trialSetting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "trial_days"))
      .first();
    const days = trialSetting ? Math.max(1, Number(trialSetting.value) || 14) : 14;

    const now = Date.now();
    const trialEndsAt = now + days * 24 * 60 * 60 * 1000;
    if (sub) {
      await ctx.db.patch(sub._id, {
        planSlug: "premium",
        status: "trialing",
        source: "trial",
        trialStartedAt: now,
        trialEndsAt,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        userId,
        planSlug: "premium",
        status: "trialing",
        source: "trial",
        trialStartedAt: now,
        trialEndsAt,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.runMutation(internal.services.memory.createNotification, {
      userId,
      type: "subscription",
      title: "Premium trial started",
      body: `Your ${days}-day Premium trial is active. Premium features are unlocked until ${new Date(trialEndsAt).toLocaleDateString()}.`,
    });
    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: "trial_started",
      detail: `days=${days}`,
    });
    return { trialEndsAt };
  },
});

export const cancelSubscription = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!sub) throw new Error("No subscription found");
    if (sub.planSlug === "free") throw new Error("The free plan cannot be canceled.");
    await ctx.db.patch(sub._id, {
      cancelAtPeriodEnd: true,
      status: sub.status === "trialing" ? "canceled" : sub.status,
      updatedAt: Date.now(),
    });
    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: "subscription_cancel_requested",
      detail: `plan=${sub.planSlug}`,
    });
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ */
/* Entitlement (single source of truth for feature gating)              */
/* ------------------------------------------------------------------ */

export type Entitlement = {
  planSlug: string;
  planName: string;
  status: string;
  aiMessageLimit: number;
  reportsPerMonth: number;
  coachingAccess: boolean;
  nutritionAccess: boolean;
  competitionAccess: boolean;
  supplementAccess: boolean;
  voiceAccess: boolean;
  advancedAnalytics: boolean;
  trialEndsAt: number | null;
};

function isEntitled(sub: Doc<"subscriptions"> | null): sub is Doc<"subscriptions"> {
  if (!sub) return false;
  if (sub.planSlug === "free") return true;
  if (sub.status === "active") return true;
  if (sub.status === "trialing" && (sub.trialEndsAt ?? 0) > Date.now()) return true;
  return false;
}

export const getEntitlement = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<Entitlement> => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
    const effectiveSlug = isEntitled(sub) ? sub!.planSlug : "free";
    const plan =
      (await ctx.db.query("subscriptionPlans").withIndex("by_slug", (q) => q.eq("slug", effectiveSlug)).first()) ??
      (await ctx.db.query("subscriptionPlans").withIndex("by_slug", (q) => q.eq("slug", "free")).first());
    const trialActive = sub?.status === "trialing" && (sub.trialEndsAt ?? 0) > Date.now();
    return {
      planSlug: effectiveSlug,
      planName: plan?.name ?? "Free",
      status: sub?.status ?? "none",
      aiMessageLimit: plan?.aiMessageLimit ?? 10,
      reportsPerMonth: plan?.reportsPerMonth ?? 1,
      coachingAccess: plan?.coachingAccess ?? true,
      nutritionAccess: plan?.nutritionAccess ?? true,
      competitionAccess: plan?.competitionAccess ?? false,
      supplementAccess: plan?.supplementAccess ?? true,
      voiceAccess: plan?.voiceAccess ?? false,
      advancedAnalytics: plan?.advancedAnalytics ?? false,
      trialEndsAt: trialActive ? sub!.trialEndsAt! : null,
    };
  },
});

/** Public read of entitlement for the UI. */
export const getMyEntitlement = query({
  args: {},
  handler: async (ctx): Promise<Entitlement | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    const effectiveSlug = isEntitled(sub) ? sub!.planSlug : "free";
    const plan =
      (await ctx.db.query("subscriptionPlans").withIndex("by_slug", (q) => q.eq("slug", effectiveSlug)).first()) ??
      null;
    const trialActive = sub?.status === "trialing" && (sub.trialEndsAt ?? 0) > Date.now();
    return {
      planSlug: effectiveSlug,
      planName: plan?.name ?? "Free",
      status: sub?.status ?? "none",
      aiMessageLimit: plan?.aiMessageLimit ?? 10,
      reportsPerMonth: plan?.reportsPerMonth ?? 1,
      coachingAccess: plan?.coachingAccess ?? true,
      nutritionAccess: plan?.nutritionAccess ?? true,
      competitionAccess: plan?.competitionAccess ?? false,
      supplementAccess: plan?.supplementAccess ?? true,
      voiceAccess: plan?.voiceAccess ?? false,
      advancedAnalytics: plan?.advancedAnalytics ?? false,
      trialEndsAt: trialActive ? sub!.trialEndsAt! : null,
    };
  },
});

/* ------------------------------------------------------------------ */
/* AI usage enforcement — runs BEFORE any AI spend                      */
/* ------------------------------------------------------------------ */

/**
 * Check + consume one AI message atomically. Throws when over the plan limit
 * with an actionable message. Returns remaining usage.
 */
export const getMyUsage = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    day: string;
    used: number;
    limit: number;
    remaining: number;
    planName: string;
    planSlug: string;
  } | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const ent = await ctx.runQuery(internal.subscriptions.getEntitlement, { userId });
    const day = new Date().toISOString().slice(0, 10);
    const row = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .first();
    const used = row?.messages ?? 0;
    return {
      day,
      used,
      limit: ent.aiMessageLimit,
      remaining: ent.aiMessageLimit === -1 ? -1 : Math.max(0, ent.aiMessageLimit - used),
      planName: ent.planName,
      planSlug: ent.planSlug,
    };
  },
});

export const useAiMessage = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
    const effectiveSlug = isEntitled(sub) ? sub!.planSlug : "free";
    const plan =
      (await ctx.db.query("subscriptionPlans").withIndex("by_slug", (q) => q.eq("slug", effectiveSlug)).first()) ??
      null;
    const limit = plan?.aiMessageLimit ?? 10;

    const day = new Date().toISOString().slice(0, 10);
    const usage = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_day", (q) => q.eq("userId", args.userId).eq("day", day))
      .first();
    const used = usage?.messages ?? 0;
    if (limit !== -1 && used >= limit) {
      throw new Error(
        `Daily AI message limit reached for the ${plan?.name ?? "Free"} plan (${limit}/day). Upgrade in SUBSCRIPTION or wait for tomorrow.`,
      );
    }
    const newUsed = used + 1;
    if (usage) {
      await ctx.db.patch(usage._id, { messages: newUsed, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("aiUsage", {
        userId: args.userId,
        day,
        messages: 1,
        actions: 0,
        updatedAt: Date.now(),
      });
    }
    return { used: newUsed, limit, remaining: limit === -1 ? -1 : limit - newUsed };
  },
});

/* ------------------------------------------------------------------ */
/* Google Play Billing — server-side record keeping. Entitlement is     */
/* NEVER granted from client claims alone.                              */
/* ------------------------------------------------------------------ */

export const validatePlayPurchase = action({
  args: {
    purchaseToken: v.string(),
    productId: v.string(),
    packageName: v.optional(v.string()),
    orderId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ id: Id<"purchaseRecords">; status: string; message: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (!args.purchaseToken.trim()) throw new Error("purchaseToken is required.");

    // Server-side verification with the Google Play Developer API requires a
    // service-account credential (GOOGLE_PLAY_SERVICE_ACCOUNT_JSON). Without
    // it we record the purchase as UNVERIFIED and grant NO entitlement.
    const hasCredentials = Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
    const status = hasCredentials ? "pending" : "unverified";

    const id = await ctx.runMutation(internal.subscriptionStore.savePurchase, {
      userId,
      platform: "android",
      productId: args.productId,
      purchaseToken: args.purchaseToken,
      orderId: args.orderId,
      packageName: args.packageName,
      status,
      note: hasCredentials
        ? "Recorded pending Play Developer API verification."
        : "Recorded. Server-side verification requires the Google Play service-account credential; no entitlement granted from client claims.",
    });

    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: "play_purchase_submitted",
      detail: `productId=${args.productId}; status=${status}`,
    });

    return {
      id,
      status,
      message: hasCredentials
        ? "Purchase recorded — pending server-side verification."
        : "Purchase recorded, but it is NOT verified and grants no premium access yet. Server-side verification with Google Play must be completed (Play Console + service account).",
    };
  },
});

export const getMyPurchases = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("purchaseRecords")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});
