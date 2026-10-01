// Usage/RateLimitService — per-user daily AI message limit enforced before any
// AI spend. Plan limits come from subscriptionPlans.aiMessageLimit (admin-tunable).
import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";

export type UsageState = {
  day: string;
  used: number;
  limit: number;
  planSlug: string;
  remaining: number;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Read the user's usage state for today. `limit` -1 means unlimited. */
export const getUsage = internalQuery({
  args: { userId: v.id("users"), planSlug: v.string(), limit: v.number() },
  handler: async (ctx, args): Promise<UsageState> => {
    const day = today();
    const row = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_day", (q) => q.eq("userId", args.userId).eq("day", day))
      .first();
    const used = row?.messages ?? 0;
    return {
      day,
      used,
      limit: args.limit,
      planSlug: args.planSlug,
      remaining: args.limit === -1 ? Infinity : Math.max(0, args.limit - used),
    };
  },
});

/** Increment today's counter. Returns the new used count. */
export const incrementUsage = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const day = today();
    const row = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_day", (q) => q.eq("userId", args.userId).eq("day", day))
      .first();
    if (row) {
      await ctx.db.patch(row._id, { messages: row.messages + 1, updatedAt: Date.now() });
      return row.messages + 1;
    }
    await ctx.db.insert("aiUsage", {
      userId: args.userId,
      day,
      messages: 1,
      actions: 0,
      updatedAt: Date.now(),
    });
    return 1;
  },
});
