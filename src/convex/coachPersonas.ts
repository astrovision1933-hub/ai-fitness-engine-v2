import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

/** Seed the coach persona roster (idempotent; called on app bootstrap). */
export const seedPersonasPublic = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(internal.services.personas.seedPersonas, {});
    return { ok: true };
  },
});

/** Plan rank helper: free=0, premium=1, pro_coach=2, competition/elite=3. */
function planRankFor(slug: string): number {
  if (slug === "competition") return 3;
  if (slug === "pro_coach") return 2;
  if (slug === "premium") return 1;
  return 0;
}

/** List active coach personas (the persona engine roster). */
export const listPersonas = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("coachPersonas").collect();
    return all
      .filter((p) => p.isActive)
      .sort((a, b) => (a.rosterOrder ?? 99) - (b.rosterOrder ?? 99) || a.name.localeCompare(b.name));
  },
});

/**
 * The plan-tiered roster: bots within the plan's limit are open, the rest are
 * LOCKED with an upgrade pointer. Single source of truth for Coach.tsx,
 * Onboarding and Dashboard.
 */
export const listPersonasForMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { botLimit: 2, rank: 0, planName: "Free", personas: [], upgradeTo: "premium" as const };
    }
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
     .first();
    const trialActive = sub?.status === "trialing" && (sub.trialEndsAt ?? 0) > Date.now();
    const effectiveSlug =
      sub && (sub.planSlug === "free" || sub.status === "active" || trialActive) ? sub.planSlug : "free";
    const plan =
      (await ctx.db.query("subscriptionPlans").withIndex("by_slug", (q) => q.eq("slug", effectiveSlug)).first()) ??
      (await ctx.db.query("subscriptionPlans").withIndex("by_slug", (q) => q.eq("slug", "free")).first());

    const rank = planRankFor(effectiveSlug);
    const botLimit = plan?.botLimit ?? 2;
    const all = await ctx.db.query("coachPersonas").collect();
    const active = all
      .filter((p) => p.isActive)
      .sort((a, b) => (a.rosterOrder ?? 99) - (b.rosterOrder ?? 99) || a.name.localeCompare(b.name));

    const personas = active.map((p, index) => {
      const minRank = p.minPlanRank ?? 0;
      const tierOk = rank >= minRank;
      // Plan has a hard bot count: within botLimit AND tier requirement.
      const unlocked = tierOk && index < botLimit;
      return {
        _id: p._id,
        name: p.name,
        role: p.role,
        avatarGlyph: p.avatarGlyph,
        expertise: p.expertise,
        personality: p.personality,
        minPlanRank: minRank,
        locked: !unlocked,
        isAssigned: false,
      };
    });

    const upgradeTarget =
      rank >= 3 ? null : rank === 0 ? ("premium" as const) : rank === 1 ? ("pro_coach" as const) : ("competition" as const);

    return { botLimit, rank, planName: plan?.name ?? "Free", personas, upgradeTo: upgradeTarget };
  },
});
