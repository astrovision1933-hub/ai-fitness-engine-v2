// Internal persistence helpers for products/recommendations/comparisons and
// admin internal reads. Separate module so action modules never reference
// their own module's API (self-references break Convex type inference).
import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

export const getProductPair = internalQuery({
  args: { aId: v.id("productCatalog"), bId: v.id("productCatalog") },
  handler: async (ctx, args) => {
    const [a, b] = await Promise.all([ctx.db.get(args.aId), ctx.db.get(args.bId)]);
    if (!a || !b || !a.isActive || !b.isActive) return null;
    return { a, b };
  },
});

export const saveComparison = internalMutation({
  args: {
    userId: v.id("users"),
    productAId: v.id("productCatalog"),
    productBId: v.id("productCatalog"),
    metrics: v.string(),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("productComparisons", {
      userId: args.userId,
      productAId: args.productAId,
      productBId: args.productBId,
      metrics: args.metrics,
      summary: args.summary,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const getUserRuleContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const goal = profile?.activeGoalId ? (await ctx.db.get(profile.activeGoalId))?.goal : undefined;
    return {
      goal: goal ?? undefined,
      dietType: profile?.diet?.dietType,
      budgetLevel: profile?.diet?.budgetLevel,
      experience: profile?.experience,
      weightKg: profile?.weightKg,
    };
  },
});

export const listRules = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("adminProductRules").collect();
  },
});

export const listCatalogInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("productCatalog").collect();
  },
});

export const getProductInternal = internalQuery({
  args: { id: v.id("productCatalog") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const saveRecommendations = internalMutation({
  args: {
    userId: v.id("users"),
    items: v.array(
      v.object({
        productId: v.id("productCatalog"),
        reason: v.string(),
        userContext: v.optional(v.string()),
        alternatives: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const disclosure =
      "Product recommendation from the admin-approved catalog — a convenience suggestion based on your profile, not medical advice. Verify authenticity via the listed verification method; prices are admin-maintained.";
    const now = Date.now();
    const ids = [];
    for (const item of args.items) {
      const id = await ctx.db.insert("productRecommendations", {
        userId: args.userId,
        productId: item.productId,
        reason: item.reason,
        userContext: item.userContext,
        disclosure,
        alternatives: item.alternatives,
        status: "shown",
        createdAt: now,
      });
      ids.push(id);
    }
    return ids;
  },
});
