import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

function today() {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* BodybuildingService                                                 */
/* ------------------------------------------------------------------ */

export const activateMode = mutation({
  args: {
    mode: v.union(
      v.literal("hypertrophy"),
      v.literal("strength"),
      v.literal("lean_bulk"),
      v.literal("cutting"),
      v.literal("recomp"),
      v.literal("comp_prep"),
    ),
    targetWeightKg: v.optional(v.number()),
    targetBodyFatPct: v.optional(v.number()),
    targetDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const previous = await ctx.db
      .query("bodybuildingGoals")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .collect();
    for (const g of previous) await ctx.db.patch(g._id, { isActive: false });

    const id = await ctx.db.insert("bodybuildingGoals", {
      userId,
      mode: args.mode,
      isActive: true,
      targetWeightKg: args.targetWeightKg,
      targetBodyFatPct: args.targetBodyFatPct,
      startDate: today(),
      targetDate: args.targetDate,
      notes: args.notes,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.services.memory.writeMemory, {
      userId,
      scope: "event",
      key: "mode_change",
      content: `Activated bodybuilding mode: ${args.mode.replace(/_/g, " ")}.`,
      source: "user_provided",
    });
    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: "bb_mode_activated",
      detail: args.mode,
    });
    return id;
  },
});

export const getActiveMode = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("bodybuildingGoals")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .first();
  },
});

/* ------------------------------------------------------------------ */
/* CompetitionService — safety-guarded                                 */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  mens_physique: "Men's Physique",
  classic_physique: "Classic Physique",
  bodybuilding: "Bodybuilding",
  womens_bikini: "Women's Bikini",
  womens_wellness: "Women's Wellness",
  womens_figure: "Women's Figure",
};

export const createCompetitionProfile = mutation({
  args: {
    category: v.string(),
    competitionDate: v.string(),
    currentWeightKg: v.optional(v.number()),
    trainingHistory: v.optional(v.string()),
    previousCompetitions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const daysOut = Math.max(
      0,
      Math.ceil((new Date(args.competitionDate).getTime() - Date.now()) / 86400000),
    );

    const previous = await ctx.db
      .query("competitionProfiles")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .collect();
    for (const p of previous) await ctx.db.patch(p._id, { isActive: false, phase: "done" });

    const phase = daysOut > 140 ? "base" : daysOut > 90 ? "build" : daysOut > 28 ? "cut" : "peak";
    const prepWeeks = Math.max(8, Math.min(24, Math.ceil(daysOut / 7)));

    const id = await ctx.db.insert("competitionProfiles", {
      userId,
      category: args.category,
      competitionDate: args.competitionDate,
      currentWeightKg: args.currentWeightKg,
      trainingHistory: args.trainingHistory,
      previousCompetitions: args.previousCompetitions,
      prepStartWeeks: prepWeeks,
      phase,
      isActive: true,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.services.memory.writeMemory, {
      userId,
      scope: "event",
      key: "competition_created",
      content: `Competition prep started: ${CATEGORY_LABELS[args.category] ?? args.category} on ${args.competitionDate} (${daysOut} days out, phase: ${phase}).`,
      source: "user_provided",
    });
    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: "competition_profile_created",
      detail: `${args.category} ${args.competitionDate}`,
    });
    return id;
  },
});

export const getCompetitionProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query("competitionProfiles")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .first();
    if (!profile) return null;

    const daysOut = Math.max(
      0,
      Math.ceil((new Date(profile.competitionDate).getTime() - Date.now()) / 86400000),
    );

    // Prep timeline: phases with dates and what each focuses on.
    const compDate = new Date(profile.competitionDate);
    const phaseEnd = (weeksBefore: number) => {
      const d = new Date(compDate);
      d.setDate(d.getDate() - weeksBefore * 7);
      return d.toISOString().slice(0, 10);
    };

    const timeline = [
      { phase: "base", until: phaseEnd(16), focus: "Volume base, movement quality, build work capacity" },
      { phase: "build", until: phaseEnd(12), focus: "Intensity ramps, hypertrophy emphasis, conditioning intro" },
      { phase: "cut", until: phaseEnd(4), focus: "Nutrition in deficit (ESTIMATED), maintain lifts, conditioning" },
      { phase: "peak", until: profile.competitionDate, focus: "Peak week logistics with a qualified coach — no dehydration or diuretic protocols" },
    ].filter((p) => p.phase === profile.phase || p.until >= new Date().toISOString().slice(0, 10));

    const checkins = await ctx.db
      .query("competitionCheckins")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .order("desc")
      .take(20);

    return { profile, daysOut, timeline, checkins, categoryLabel: CATEGORY_LABELS[profile.category] ?? profile.category };
  },
});

export const addCompetitionCheckin = mutation({
  args: {
    weightKg: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const profile = await ctx.db
      .query("competitionProfiles")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .first();
    if (!profile) throw new Error("No active competition profile");

    const weekLabel = `W-${Math.max(0, Math.ceil((new Date(profile.competitionDate).getTime() - Date.now()) / 604800000))}`;

    const id = await ctx.db.insert("competitionCheckins", {
      profileId: profile._id,
      userId,
      weekLabel,
      weightKg: args.weightKg,
      notes: args.notes,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.services.memory.writeMemory, {
      userId,
      scope: "event",
      key: "competition_checkin",
      content: `Prep check-in ${weekLabel}: ${args.weightKg ? `${args.weightKg}kg` : "no weight"} — ${args.notes ?? "no notes"}.`,
      source: "user_provided",
    });
    return id;
  },
});
