// Internal helpers kept OUT of coach.ts / subscriptions.ts so action modules
// never reference their own module's API (self-references break Convex type
// inference and cascade TS7022 errors across the app).
import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

/** Minimal account gate for the coach orchestrator. */
export const getAccountState = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return { disabled: user?.disabled ?? false };
  },
});

/** Full user row for actions that need role/plan context. */
export const getUserRow = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});
