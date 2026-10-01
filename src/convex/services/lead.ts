// LeadIntelligenceService — classifies user interest temperature from
// legitimate interaction signals only. No manipulation: the coach may surface
// an offer once, only when genuine signals exist, and never nag.
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export type LeadTemperature = "cold" | "warm" | "interested" | "high_intent";

const TEMPERATURE_RANK: Record<LeadTemperature, number> = {
  cold: 0,
  warm: 1,
  interested: 2,
  high_intent: 3,
};

/**
 * Advance the lead temperature based on a signal. Signals are things the user
 * actually did: requested a personalized plan, asked about coaching, started a
 * trial, asked about subscription/pricing, used supplement/product modules.
 */
export const recordLeadSignal = internalMutation({
  args: {
    userId: v.id("users"),
    signal: v.string(),
    minRank: v.optional(v.number()), // minimum temperature rank this signal maps to
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("leadStates")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const currentRank = existing ? TEMPERATURE_RANK[existing.temperature as LeadTemperature] ?? 0 : -1;
    const targetRank = args.minRank ?? 1; // default: any signal → at least "warm"
    const newRank = Math.max(currentRank, Math.min(targetRank, 3));
    const temperature =
      (Object.keys(TEMPERATURE_RANK) as LeadTemperature[]).find((k) => TEMPERATURE_RANK[k] === newRank) ??
      "warm";

    const signals = existing?.signals ?? [];
    signals.push(`${new Date().toISOString().slice(0, 10)}:${args.signal}`);
    // Keep the last 20 signals — enough history, no surveillance hoarding.
    const trimmed = signals.slice(-20);

    if (existing) {
      await ctx.db.patch(existing._id, {
        temperature,
        signals: trimmed,
        lastSignalAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("leadStates", {
        userId: args.userId,
        temperature,
        signals: trimmed,
        lastSignalAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    return { temperature };
  },
});
