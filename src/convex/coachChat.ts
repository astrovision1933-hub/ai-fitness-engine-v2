import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

async function requireProfile(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (!profile) throw new Error("Complete onboarding first");
  return profile;
}

/* ------------------------------------------------------------------ */
/* ContextService — everything the AI needs, loaded in one query       */
/* ------------------------------------------------------------------ */

export const getContextBundle = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const activeGoal = profile?.activeGoalId
      ? await ctx.db.get(profile.activeGoalId)
      : null;

    const activePlan = await ctx.db
      .query("workoutPlans")
      .withIndex("by_user_active", (q) => q.eq("userId", args.userId).eq("isActive", true))
      .first();

    const recentSessions = await ctx.db
      .query("workoutSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(3);

    const persona = profile?.coachPersonaId
      ? await ctx.db.get(profile.coachPersonaId)
      : null;

    const memories = await ctx.db
      .query("aiMemory")
      .withIndex("by_user_scope", (q) => q.eq("userId", args.userId).eq("scope", "long_term"))
      .take(10);

    const recentMessages = await ctx.db
      .query("conversationMessages")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(8);

    // Part 2 context: today's nutrition + latest check-in (if present).
    const date = new Date().toISOString().slice(0, 10);
    const [mealLogs, waterLogs, todayCheckin] = await Promise.all([
      ctx.db
        .query("mealLogs")
        .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", date))
        .collect(),
      ctx.db
        .query("waterLogs")
        .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", date))
        .collect(),
      ctx.db
        .query("dailyCheckins")
        .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", date))
        .first(),
    ]);
    const consumed = mealLogs.reduce(
      (acc, l) => ({ kcal: acc.kcal + l.calories, protein: acc.protein + l.proteinG }),
      { kcal: 0, protein: 0 },
    );
    const waterMl = waterLogs.reduce((s, w) => s + w.amountMl, 0);

    const summaryLines: string[] = [];
    if (profile) {
      summaryLines.push(
        `NAME: ${profile.name ?? "unknown"}`,
        `AGE/SEX: ${profile.age ?? "?"} / ${profile.sex ?? "?"}`,
        `HEIGHT/WEIGHT: ${profile.heightCm ?? "?"}cm / ${profile.weightKg ?? "?"}kg`,
      );
    }
    if (profile?.training)
      summaryLines.push(
        `TRAINING: ${profile.training.daysPerWeek}d/wk, ${profile.training.sessionMinutes}min, ${profile.training.location}, equipment: ${profile.training.equipment.join(", ") || "none"}`,
      );
    if (profile?.diet)
      summaryLines.push(
        `DIET: ${profile.diet.dietType}, ${profile.diet.mealsPerDay} meals/day, allergies: ${profile.diet.allergies.join(", ") || "none"}, restrictions: ${profile.diet.restrictions.join(", ") || "none"}`,
      );
    if (profile?.lifestyle)
      summaryLines.push(
        `LIFESTYLE: activity ${profile.lifestyle.dailyActivity}, sleep ${profile.lifestyle.sleepHours ?? "?"}h, stress ${profile.lifestyle.stressLevel}, work ${profile.lifestyle.workType}`,
      );
    if (activeGoal)
      summaryLines.push(
        `GOAL: ${activeGoal.goal} — "${activeGoal.description ?? ""}" (target: ${activeGoal.targetDate ?? "not set"})`,
      );
    if (activePlan)
      summaryLines.push(`ACTIVE PLAN: ${activePlan.name} (${activePlan.weeks}w, ${activePlan.daysPerWeek}d/wk)`);
    if (recentSessions.length)
      summaryLines.push(
        `RECENT WORKOUTS: ${recentSessions.map((s) => `${s.name} (${s.status})`).join("; ")}`,
      );
    if (memories.length)
      summaryLines.push(`LONG-TERM MEMORY: ${memories.map((m) => m.content).join("; ")}`);
    if (consumed.kcal > 0 || waterMl > 0 || todayCheckin) {
      summaryLines.push(
        `TODAY (PART 2 DATA): consumed ${consumed.kcal} kcal / ${consumed.protein}g protein logged; water ${waterMl}ml${
          todayCheckin
            ? `; check-in: workout ${todayCheckin.didWorkout ? "done" : "skipped"}, energy ${todayCheckin.energyLevel}/5, stress ${todayCheckin.stressLevel}${todayCheckin.painOrSymptoms && todayCheckin.painOrSymptoms !== "none" ? `, reported: ${todayCheckin.painOrSymptoms}` : ""}`
            : ""
        }`,
      );
    }
    if (!summaryLines.length)
      summaryLines.push("No profile data yet — user may still be onboarding.");

    return {
      summary: summaryLines.join("\n"),
      persona: persona
        ? { name: persona.name, role: persona.role, systemInstructions: persona.systemInstructions }
        : null,
      recentMessages: recentMessages.map((m) => ({ role: m.role, content: m.content })),
    };
  },
});

/* ------------------------------------------------------------------ */
/* Persistence + conversation management                               */
/* ------------------------------------------------------------------ */

/** Persist a user+assistant exchange with intent metadata. */
export const persistExchange = internalMutation({
  args: {
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    userMessage: v.string(),
    assistantReply: v.string(),
    intent: v.string(),
    intentConfidence: v.optional(v.number()),
    safetyFlag: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("conversationMessages", {
      conversationId: args.conversationId,
      userId: args.userId,
      role: "user",
      content: args.userMessage,
      intent: args.intent,
      intentConfidence: args.intentConfidence,
      safetyFlag: args.safetyFlag,
      createdAt: now,
    });
    await ctx.db.insert("conversationMessages", {
      conversationId: args.conversationId,
      userId: args.userId,
      role: "assistant",
      content: args.assistantReply,
      intent: args.intent,
      intentConfidence: args.intentConfidence,
      safetyFlag: args.safetyFlag,
      createdAt: now + 1,
    });
    await ctx.db.patch(args.conversationId, { lastMessageAt: now + 1 });
    return { ok: true };
  },
});

/** Ensure a conversation exists for the user; create if missing. */
export const ensureConversation = mutation({
  args: { personaId: v.id("coachPersonas") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    // Plan-tier gating — same rules as assignCoach (backend-enforced).
    const persona = await ctx.db.get(args.personaId);
    if (!persona || !persona.isActive) throw new Error("Unknown coach");
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    const trialActive = sub?.status === "trialing" && (sub.trialEndsAt ?? 0) > Date.now();
    const effectiveSlug =
      sub && (sub.planSlug === "free" || sub.status === "active" || trialActive) ? sub.planSlug : "free";
    const rank =
      effectiveSlug === "competition" ? 3 : effectiveSlug === "pro_coach" ? 2 : effectiveSlug === "premium" ? 1 : 0;
    const plan = await ctx.db
      .query("subscriptionPlans")
      .withIndex("by_slug", (q) => q.eq("slug", effectiveSlug))
      .first();
    const botLimit = plan?.botLimit ?? 2;
    const allPersonas = await ctx.db.query("coachPersonas").collect();
    const ordered = allPersonas
      .filter((p) => p.isActive)
      .sort((a, b) => (a.rosterOrder ?? 99) - (b.rosterOrder ?? 99) || a.name.localeCompare(b.name));
    const idx = ordered.findIndex((p) => p._id === args.personaId);
    const minRank = persona.minPlanRank ?? 0;
    const alreadyExists = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("personaId"), args.personaId))
      .first();
    if (!alreadyExists && (idx >= botLimit || rank < minRank)) {
      throw new Error(
        `${persona.name} is locked on your plan. Upgrade in SUBSCRIPTION to unlock more AI coach bots.`,
      );
    }
    if (alreadyExists) return alreadyExists._id;
    const id = await ctx.db.insert("conversations", {
      userId,
      personaId: args.personaId,
      title: "Coaching session",
      lastMessageAt: Date.now(),
    });
    return id;
  },
});

/** The public entry point: stores the user message, schedules the AI orchestrator. */
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireProfile(ctx, userId);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    const now = Date.now();
    const userMessageId = await ctx.db.insert("conversationMessages", {
      conversationId: args.conversationId,
      userId,
      role: "user",
      content: args.content,
      createdAt: now,
    });
    await ctx.db.patch(args.conversationId, { lastMessageAt: now });

    await ctx.scheduler.runAfter(0, internal.coach.orchestrateCoachReply, {
      userId,
      conversationId: args.conversationId,
      message: args.content,
    });

    return { userMessageId };
  },
});

/** List conversations for the signed-in user. */
export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(30);
    return rows;
  },
});

/** All messages in a conversation, oldest first. */
export const getMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) return null;
    return await ctx.db
      .query("conversationMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();
  },
});

/** Latest conversation across all personas — used by the Coach page on load. */
export const getLatestConversation = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const latest = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    return latest;
  },
});
