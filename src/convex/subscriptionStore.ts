// Internal persistence for Play purchases. Kept out of subscriptions.ts so
// its action never references its own module's API (self-references break
// Convex type inference).
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const savePurchase = internalMutation({
  args: {
    userId: v.id("users"),
    platform: v.string(),
    productId: v.string(),
    purchaseToken: v.string(),
    orderId: v.optional(v.string()),
    packageName: v.optional(v.string()),
    status: v.string(),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("purchaseRecords")
      .withIndex("by_token", (q) => q.eq("purchaseToken", args.purchaseToken))
      .first();
    if (existing) return existing._id; // idempotent restore
    return await ctx.db.insert("purchaseRecords", {
      userId: args.userId,
      platform: args.platform,
      productId: args.productId,
      purchaseToken: args.purchaseToken,
      orderId: args.orderId,
      packageName: args.packageName,
      verificationStatus: args.status,
      verificationNote: args.note,
      createdAt: Date.now(),
    });
  },
});
