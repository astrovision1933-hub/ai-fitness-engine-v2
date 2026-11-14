// Context bundle + exchange persistence, kept in a LEAF module so that
// coach.ts -> coachContext and coachChat.ts -> coach never form a module
// cycle (cyclic Convex API references break type inference and cascade
// TS7022 errors across the app).
import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

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

    const activeGoal = profile?.activeGoalId ? await ctx.db.get(profile.activeGoalId) : null;

    const activePlan = await ctx.db
      .query("workoutPlans")
      .withIndex("by_user_active", (q) => q.eq("userId", args.userId).eq("isActive", true))
      .first();

    const recentSessions = await ctx.db
      .query("workoutSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(3);

    const journey = await ctx.db
      .query("coachJourney")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    // The journey's selectedCoachId is the source of truth for the assigned coach.
    const personaId = journey?.selectedCoachId ?? profile?.coachPersonaId ?? null;
    const persona = personaId ? await ctx.db.get(personaId) : null;

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
    if (persona)
      summaryLines.push(`ASSIGNED AI COACH: ${persona.name} (${persona.role})`);
    if (journey?.journeyStarted)
      summaryLines.push(
        `MOTIVATIONAL JOURNEY: day ${journey.currentMotivationDay}; completed days: ${journey.completedMotivationDays.join(", ") || "none"}${
          journey.todayMission
            ? `; today's focus: ${journey.todayMission.focus}; mission: ${journey.todayMission.items.join("; ")}`
            : ""
        }`,
      );
    const latestPhysique = await ctx.db
      .query("physiqueCheckins")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
    if (journey?.physiqueCategory || latestPhysique) {
      summaryLines.push(
        `PHYSIQUE: ${journey?.physiqueCategory ?? latestPhysique?.physiqueCategory ?? "unknown"} · stage ${journey?.fitnessStage ?? latestPhysique?.fitnessStageName ?? "unknown"}${
          journey?.priorityAreas?.length ? ` · priority areas: ${journey.priorityAreas.join(", ")}` : ""
        }${latestPhysique?.userDescription ? ` · user description: "${latestPhysique.userDescription.slice(0, 200)}"` : ""}${
          latestPhysique ? ` · last physique check-in ${latestPhysique.date}` : ""
        }`,
      );
    }
    if (activePlan)
      summaryLines.push(`ACTIVE PLAN: ${activePlan.name} (${activePlan.weeks}w, ${activePlan.daysPerWeek}d/wk)`);
    if (recentSessions.length)
      summaryLines.push(`RECENT WORKOUTS: ${recentSessions.map((s) => `${s.name} (${s.status})`).join("; ")}`);
    if (memories.length) summaryLines.push(`LONG-TERM MEMORY: ${memories.map((m) => m.content).join("; ")}`);
    if (consumed.kcal > 0 || waterMl > 0 || todayCheckin) {
      summaryLines.push(
        `TODAY (PART 2 DATA): consumed ${consumed.kcal} kcal / ${consumed.protein}g protein logged; water ${waterMl}ml${
          todayCheckin
            ? `; check-in: workout ${todayCheckin.didWorkout ? "done" : "skipped"}, energy ${todayCheckin.energyLevel}/5, stress ${todayCheckin.stressLevel}${todayCheckin.painOrSymptoms && todayCheckin.painOrSymptoms !== "none" ? `, reported: ${todayCheckin.painOrSymptoms}` : ""}`
            : ""
        }`,
      );
    }
    if (!summaryLines.length) summaryLines.push("No profile data yet — user may still be onboarding.");

    // Language preference lives on userPreferences (one row per user).
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    return {
      summary: summaryLines.join("\n"),
      persona: persona
        ? { name: persona.name, role: persona.role, systemInstructions: persona.systemInstructions }
        : null,
      preferredLanguage: prefs?.preferredLanguage ?? "en",
      recentMessages: recentMessages.map((m) => ({ role: m.role, content: m.content })),
    };
  },
});

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
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
