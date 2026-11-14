import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

/* ------------------------------------------------------------------ */
/* Auth guard — every admin function checks role from the users table   */
/* ------------------------------------------------------------------ */

async function requireAdminMutation(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin" || user.disabled) throw new Error("Admin access required");
  return user;
}

/**
 * One-time owner bootstrap — run from the CLI only (`convex run`), never from
 * the client. Grants the admin role to a verified account so the console can
 * be opened the first time.
 */
export const grantAdminByUserId = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("No account found for that id");
    await ctx.db.patch(user._id, { role: "admin", disabled: false });
    return { userId: user._id, email: user.email ?? null, role: "admin" };
  },
});

export const grantAdminByEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const users = await ctx.db.query("users").collect();
    const match = users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (!match) throw new Error(`No account found for ${email}`);
    await ctx.db.patch(match._id, { role: "admin", disabled: false });
    return { userId: match._id, email: match.email ?? email, role: "admin" };
  },
});

/* ------------------------------------------------------------------ */
/* Dashboard metrics — real aggregates, no fabricated numbers           */
/* ------------------------------------------------------------------ */

export const getMetrics = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminMutation(ctx);

    const now = Date.now();
    const [users, subs, assignments, goals, messages, usage, leads, analytics, recommendations] =
      await Promise.all([
        ctx.db.query("users").collect(),
        ctx.db.query("subscriptions").collect(),
        ctx.db.query("coachAssignments").collect(),
        ctx.db.query("fitnessGoals").collect(),
        ctx.db.query("conversationMessages").withIndex("by_conversation").take(0), // placeholder, replaced below
        ctx.db.query("aiUsage").collect(),
        ctx.db.query("leadStates").collect(),
        ctx.db.query("analyticsEvents").take(1000),
        ctx.db.query("productRecommendations").collect(),
      ]);
    void messages;

    const totalUsers = users.length;
    const newUsers7d = users.filter((u) => u._creationTime >= now - 7 * 86400000).length;
    const activeSubs = subs.filter((s) => s.status === "active" || s.status === "trialing");
    const activeUsers = new Set(activeSubs.map((s) => s.userId)).size;
    const coachingUsers = new Set(assignments.map((a) => a.userId)).size;

    const planCounts = new Map<string, number>();
    for (const s of activeSubs) planCounts.set(s.planSlug, (planCounts.get(s.planSlug) ?? 0) + 1);
    const premiumUsers =
      (planCounts.get("premium") ?? 0) + (planCounts.get("pro_coach") ?? 0) + (planCounts.get("competition") ?? 0);
    const freeUsers = Math.max(0, totalUsers - premiumUsers);

    const today = new Date().toISOString().slice(0, 10);
    const aiMessagesToday = usage
      .filter((u) => u.day === today)
      .reduce((sum, u) => sum + u.messages, 0);

    const goalCounts = new Map<string, number>();
    for (const g of goals) if (g.status === "active") goalCounts.set(g.goal, (goalCounts.get(g.goal) ?? 0) + 1);

    // Popular question intents — aggregate only, never message content.
    const intentCounts = new Map<string, number>();
    const userMsgs = await ctx.db.query("conversationMessages").take(4000);
    for (const m of userMsgs) {
      if (m.role === "user" && m.intent) intentCounts.set(m.intent, (intentCounts.get(m.intent) ?? 0) + 1);
    }
    const popularQuestions = [...intentCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([intent, count]) => ({ intent, count }));

    const productInquiries = analytics.filter((e) => e.name === "product_interest").length;
    const highIntentUsers = leads.filter((l) => l.temperature === "high_intent" || l.temperature === "interested").length;

    // 7-day engagement proxy: share of users with any AI usage in the last week.
    const weekAgo = now - 7 * 86400000;
    const recentUsageDays = new Set(usage.filter((u) => u.updatedAt >= weekAgo).map((u) => u.userId));
    const retention = totalUsers ? Math.round((recentUsageDays.size / totalUsers) * 100) : 0;

    const trialCount = subs.filter((s) => s.status === "trialing").length;

    return {
      totalUsers,
      newUsers7d,
      activeUsers,
      coachingUsers,
      freeUsers,
      premiumUsers,
      planCounts: [...planCounts.entries()].map(([slug, count]) => ({ slug, count })),
      aiMessagesToday,
      productInquiries,
      productRecommendations: recommendations.length,
      highIntentUsers,
      popularGoals: [...goalCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([goal, count]) => ({ goal, count })),
      popularQuestions,
      retention,
      trialCount,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Users — management without exposing private conversation content     */
/* ------------------------------------------------------------------ */

export const listUsers = query({
  args: { search: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    const rows = await ctx.db.query("users").take(args.limit ?? 200);
    const subs = await ctx.db.query("subscriptions").collect();
    const subByUser = new Map(subs.map((s) => [s.userId, s]));
    const q = args.search?.trim().toLowerCase();
    return rows
      .filter((u) => !q || (u.email ?? "").toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q))
      .map((u) => {
        const s = subByUser.get(u._id);
        return {
          _id: u._id,
          email: u.email ?? "(anonymous)",
          name: u.name ?? null,
          role: u.role ?? "user",
          disabled: u.disabled ?? false,
          isAnonymous: u.isAnonymous ?? false,
          plan: s?.planSlug ?? "free",
          subStatus: s?.status ?? "none",
          createdAt: u._creationTime,
        };
      });
  },
});

/** Profile/goal/plan/subscription view. Deliberately excludes chat content. */
export const getUserDetail = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const [profile, goalRow, plans, sub] = await Promise.all([
      ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", args.userId)).first(),
      ctx.db.query("fitnessGoals").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("workoutPlans").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("subscriptions").withIndex("by_user", (q) => q.eq("userId", args.userId)).first(),
    ]);
    return {
      user: { email: user.email, name: user.name, role: user.role, disabled: user.disabled, isAnonymous: user.isAnonymous },
      profile: profile
        ? {
            age: profile.age,
            sex: profile.sex,
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
            experience: profile.experience,
            onboardingComplete: profile.onboardingComplete,
            dietType: profile.diet?.dietType,
          }
        : null,
      activeGoal: goalRow.find((g) => g.status === "active") ?? null,
      planCount: plans.length,
      subscription: sub ? { planSlug: sub.planSlug, status: sub.status, source: sub.source } : null,
    };
  },
});

export const setUserDisabled = mutation({
  args: { userId: v.id("users"), disabled: v.boolean() },
  handler: async (ctx, args) => {
    const admin = await requireAdminMutation(ctx);
    if (admin._id === args.userId) throw new Error("You cannot disable your own account.");
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");
    if (target.role === "admin" && args.disabled) {
      const admins = (await ctx.db.query("users").collect()).filter((u) => u.role === "admin" && !u.disabled);
      if (admins.length <= 1) throw new Error("Cannot disable the last active admin.");
    }
    await ctx.db.patch(args.userId, { disabled: args.disabled });
    await ctx.db.insert("auditLogs", {
      userId: admin._id,
      action: "admin_user_disabled",
      detail: `target=${args.userId}; disabled=${args.disabled}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const setUserRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("admin"), v.literal("user"), v.literal("member")) },
  handler: async (ctx, args) => {
    const admin = await requireAdminMutation(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");
    if (target.role === "admin" && args.role !== "admin") {
      const admins = (await ctx.db.query("users").collect()).filter((u) => u.role === "admin" && !u.disabled);
      if (admins.length <= 1) throw new Error("Cannot demote the last admin.");
    }
    await ctx.db.patch(args.userId, { role: args.role });
    await ctx.db.insert("auditLogs", {
      userId: admin._id,
      action: "admin_role_change",
      detail: `target=${args.userId}; role=${args.role}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ */
/* AI coaches CRUD                                                      */
/* ------------------------------------------------------------------ */

export const listCoaches = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminMutation(ctx);
    return await ctx.db.query("coachPersonas").collect();
  },
});

export const saveCoach = mutation({
  args: {
    id: v.optional(v.id("coachPersonas")),
    slug: v.string(),
    name: v.string(),
    role: v.string(),
    avatarGlyph: v.optional(v.string()),
    personality: v.string(),
    communicationStyle: v.string(),
    expertise: v.array(v.string()),
    philosophy: v.string(),
    systemInstructions: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    const { id, avatarGlyph, ...rest } = args;
    if (id) {
      await ctx.db.patch(id, { ...rest, avatarGlyph: avatarGlyph ?? "◈" });
      return id;
    }
    const dupe = await ctx.db.query("coachPersonas").withIndex("by_slug", (q) => q.eq("slug", args.slug)).first();
    if (dupe) throw new Error("A coach with this slug already exists");
    return await ctx.db.insert("coachPersonas", {
      slug: args.slug,
      name: args.name,
      role: args.role,
      avatarGlyph: avatarGlyph ?? "◈",
      personality: args.personality,
      communicationStyle: args.communicationStyle,
      expertise: args.expertise,
      philosophy: args.philosophy,
      systemInstructions: args.systemInstructions,
      isActive: args.isActive,
    });
  },
});

export const deleteCoach = mutation({
  args: { id: v.id("coachPersonas") },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    const assignments = await ctx.db
      .query("coachAssignments")
      .withIndex("by_persona", (q) => q.eq("personaId", args.id))
      .first();
    if (assignments) throw new Error("Coach is assigned to users — disable it instead of deleting.");
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ */
/* Knowledge base CRUD                                                  */
/* ------------------------------------------------------------------ */

export const listKnowledge = query({
  args: { category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    const rows = await ctx.db.query("knowledgeDocuments").collect();
    return rows
      .filter((d) => !args.category || d.category === args.category)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const saveKnowledge = mutation({
  args: {
    id: v.optional(v.id("knowledgeDocuments")),
    title: v.string(),
    category: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    source: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    if (args.id) {
      await ctx.db.patch(args.id, {
        title: args.title,
        category: args.category,
        content: args.content,
        tags: args.tags,
        source: args.source,
        isActive: args.isActive,
      });
      return args.id;
    }
    return await ctx.db.insert("knowledgeDocuments", {
      title: args.title,
      category: args.category,
      content: args.content,
      tags: args.tags,
      source: args.source,
      isActive: args.isActive,
      createdAt: Date.now(),
    });
  },
});

export const deleteKnowledge = mutation({
  args: { id: v.id("knowledgeDocuments") },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ */
/* Product catalog CRUD (admin)                                         */
/* ------------------------------------------------------------------ */

export const listCatalogAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminMutation(ctx);
    return await ctx.db.query("productCatalog").collect();
  },
});

const nutritionValidator = v.object({
  calories: v.optional(v.number()),
  proteinG: v.optional(v.number()),
  carbsG: v.optional(v.number()),
  fatG: v.optional(v.number()),
});

export const saveProduct = mutation({
  args: {
    id: v.optional(v.id("productCatalog")),
    name: v.string(),
    brand: v.string(),
    category: v.string(),
    imageUrl: v.optional(v.string()),
    price: v.number(),
    mrp: v.optional(v.number()),
    sizeGrams: v.optional(v.number()),
    servings: v.optional(v.number()),
    servingSize: v.optional(v.string()),
    flavour: v.optional(v.string()),
    ingredients: v.optional(v.string()),
    nutrition: v.optional(nutritionValidator),
    manufacturer: v.optional(v.string()),
    distributor: v.optional(v.string()),
    verificationMethod: v.optional(v.string()),
    verificationUrl: v.optional(v.string()),
    batchInstructions: v.optional(v.string()),
    targetAudience: v.optional(v.string()),
    fitnessGoals: v.array(v.string()),
    benefits: v.optional(v.string()),
    warnings: v.optional(v.string()),
    usage: v.optional(v.string()),
    stockStatus: v.union(v.literal("in_stock"), v.literal("out_of_stock"), v.literal("discontinued")),
    approvedForRecommendation: v.boolean(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    const { id, ...rest } = args;
    if (id) {
      await ctx.db.patch(id, rest);
      await ctx.db.insert("auditLogs", {
        userId: undefined,
        action: "admin_product_updated",
        detail: `productId=${id}`,
        createdAt: Date.now(),
      });
      return id;
    }
    const created = await ctx.db.insert("productCatalog", rest);
    return created;
  },
});

export const setProductApproval = mutation({
  args: { id: v.id("productCatalog"), approved: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    await ctx.db.patch(args.id, { approvedForRecommendation: args.approved });
    return { ok: true };
  },
});

export const deleteProduct = mutation({
  args: { id: v.id("productCatalog") },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    await ctx.db.patch(args.id, { isActive: false, approvedForRecommendation: false });
    return { ok: true }; // soft delete keeps history/recommendation rows valid
  },
});

/* ------------------------------------------------------------------ */
/* Recommendation rules CRUD                                            */
/* ------------------------------------------------------------------ */

export const listRulesAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminMutation(ctx);
    return await ctx.db.query("adminProductRules").collect();
  },
});

export const saveRule = mutation({
  args: {
    id: v.optional(v.id("adminProductRules")),
    name: v.string(),
    enabled: v.boolean(),
    goal: v.optional(v.string()),
    dietType: v.optional(v.string()),
    budgetLevel: v.optional(v.string()),
    experience: v.optional(v.string()),
    weightMinKg: v.optional(v.number()),
    weightMaxKg: v.optional(v.number()),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    const { id, ...rest } = args;
    if (id) {
      await ctx.db.patch(id, rest);
      return id;
    }
    return await ctx.db.insert("adminProductRules", { ...rest, createdAt: Date.now() });
  },
});

export const deleteRule = mutation({
  args: { id: v.id("adminProductRules") },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ */
/* Subscription plans + app settings (safety keys protected)            */
/* ------------------------------------------------------------------ */

export const listPlansAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminMutation(ctx);
    const plans = await ctx.db.query("subscriptionPlans").collect();
    return plans.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const savePlan = mutation({
  args: {
    id: v.id("subscriptionPlans"),
    priceInr: v.optional(v.number()),
    aiMessageLimit: v.optional(v.number()),
    reportsPerMonth: v.optional(v.number()),
    competitionAccess: v.optional(v.boolean()),
    voiceAccess: v.optional(v.boolean()),
    advancedAnalytics: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    const { id, ...patch } = args;
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    await ctx.db.patch(id, clean);
    return { ok: true };
  },
});

// Safety-critical settings can never be disabled — enforced here.
const PROTECTED_SETTINGS: Record<string, { validate: (value: string) => boolean; locked: boolean }> = {
  safety_layer_enabled: { validate: (v) => v === "true", locked: true },
  trial_days: { validate: (v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 90, locked: false },
  voice_provider: { validate: (v) => ["web_speech", "external"].includes(v), locked: false },
};

export const listSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminMutation(ctx);
    const rows = await ctx.db.query("appSettings").collect();
    const existing = new Map(rows.map((r) => [r.key, r.value]));
    // Surface defaults so the admin sees the full controls.
    return Object.keys(PROTECTED_SETTINGS).map((key) => ({
      key,
      value: existing.get(key) ?? (key === "safety_layer_enabled" ? "true" : key === "trial_days" ? "14" : "web_speech"),
      locked: PROTECTED_SETTINGS[key].locked,
    }));
  },
});

export const saveSetting = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    const rule = PROTECTED_SETTINGS[args.key];
    if (!rule) throw new Error("Unknown setting key");
    if (rule.locked && rule.validate(args.value) === false) {
      throw new Error("This safety-critical setting cannot be disabled.");
    }
    if (!rule.validate(args.value)) throw new Error("Invalid value for this setting");
    const existing = await ctx.db.query("appSettings").withIndex("by_key", (q) => q.eq("key", args.key)).first();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("appSettings", { key: args.key, value: args.value, updatedAt: Date.now() });
    }
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ */
/* Audit logs                                                           */
/* ------------------------------------------------------------------ */

export const listAuditLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    return await ctx.db.query("auditLogs").take(args.limit ?? 100);
  },
});

/** Safety overview — aggregate + recent flagged-message METADATA only.
 *  Message content is never exposed. Safety rules themselves are always on
 *  and cannot be disabled from the admin panel. */
export const getSafetyOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminMutation(ctx);
    const weekAgo = Date.now() - 7 * 86400000;
    const msgs = await ctx.db.query("conversationMessages").take(4000);
    const flagged = msgs.filter((m) => m.safetyFlag === true);
    const byIntent = new Map<string, number>();
    for (const m of flagged) {
      const k = m.intent ?? "unknown";
      byIntent.set(k, (byIntent.get(k) ?? 0) + 1);
    }
    const safetyBlocks = await ctx.db
      .query("auditLogs")
      .take(2000);
    const blocksByCategory = new Map<string, number>();
    for (const l of safetyBlocks) {
      if (l.action !== "safety_block" || !l.detail) continue;
      const cat = l.detail.replace("category=", "") || "unknown";
      blocksByCategory.set(cat, (blocksByCategory.get(cat) ?? 0) + 1);
    }
    return {
      flaggedTotal: flagged.length,
      flagged7d: flagged.filter((m) => m.createdAt >= weekAgo).length,
      byIntent: [...byIntent.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([intent, count]) => ({ intent, count })),
      blocksByCategory: [...blocksByCategory.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([category, count]) => ({ category, count })),
      recent: flagged.slice(-10).map((m) => ({
        _id: m._id,
        intent: m.intent ?? null,
        createdAt: m.createdAt,
      })),
    };
  },
});

/** Conversation METADATA only — message content is never exposed to admin UI. */
export const listConversationsMeta = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    const rows = await ctx.db.query("conversations").take(args.limit ?? 60);
    const personas = await ctx.db.query("coachPersonas").collect();
    const personaName = new Map(personas.map((p) => [p._id, p.name]));
    return rows.map((c) => ({
      _id: c._id,
      persona: personaName.get(c.personaId) ?? "coach",
      title: c.title,
      lastMessageAt: c.lastMessageAt,
      // counts only — no content
    }));
  },
});

/* ------------------------------------------------------------------ */
/* Grant entitlement manually (support flow) — audited                  */
/* ------------------------------------------------------------------ */

export const grantPlan = mutation({
  args: { userId: v.id("users"), planSlug: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdminMutation(ctx);
    if (!["free", "premium", "pro_coach", "competition"].includes(args.planSlug)) {
      throw new Error("Unknown plan slug");
    }
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        planSlug: args.planSlug,
        status: "active",
        source: "admin",
        cancelAtPeriodEnd: false,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        userId: args.userId,
        planSlug: args.planSlug,
        status: "active",
        source: "admin",
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.insert("auditLogs", {
      userId: admin._id,
      action: "admin_grant_plan",
      detail: `target=${args.userId}; plan=${args.planSlug}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
