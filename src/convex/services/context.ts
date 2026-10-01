import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

/**
 * ContextService — retrieves everything the AI needs before answering:
 * profile, goal, plan, recent sessions, recent messages and memory.
 * Returns typed `Doc` rows so the rest of the engine stays consistent.
 */
export type UserContext = {
  user: Doc<"users"> | null;
  profile: Doc<"userProfiles"> | null;
  activeGoal: Doc<"fitnessGoals"> | null;
  activePlan: Doc<"workoutPlans"> | null;
  recentSessions: Doc<"workoutSessions">[];
  recentMessages: Doc<"conversationMessages">[];
  memories: Doc<"aiMemory">[];
};

export async function buildUserContext(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<UserContext> {
  const [user, profile] = await Promise.all([
    ctx.db.get(userId),
    ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first(),
  ]);

  const activeGoal = profile?.activeGoalId
    ? await ctx.db.get(profile.activeGoalId)
    : null;

  const activePlan = await ctx.db
    .query("workoutPlans")
    .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
    .first();

  const recentSessions = await ctx.db
    .query("workoutSessions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(5);

  const recentMessages = await ctx.db
    .query("conversationMessages")
    .withIndex("by_user_created", (q) => q.eq("userId", userId))
    .order("desc")
    .take(10);

  const memories = await ctx.db
    .query("aiMemory")
    .withIndex("by_user_scope", (q) => q.eq("userId", userId).eq("scope", "long_term"))
    .take(10);

  return { user, profile, activeGoal, activePlan, recentSessions, recentMessages, memories };
}

/** Compact textual summary injected into every AI system prompt. */
export function summarizeContext(c: UserContext): string {
  const lines: string[] = [];
  const p = c.profile;
  if (p) {
    lines.push(
      `NAME: ${p.name ?? c.user?.name ?? "unknown"}`,
      `AGE/SEX: ${p.age ?? "?"} / ${p.sex ?? "?"}`,
      `HEIGHT/WEIGHT: ${p.heightCm ?? "?"}cm / ${p.weightKg ?? "?"}kg`,
    );
    if (p.training)
      lines.push(
        `TRAINING: ${p.training.daysPerWeek}d/wk, ${p.training.sessionMinutes}min, ${p.training.location}, equipment: ${p.training.equipment.join(", ") || "none"}, preferred days: ${p.training.preferredDays.join(", ")}`,
      );
    if (p.diet)
      lines.push(
        `DIET: ${p.diet.dietType}, meals/day ${p.diet.mealsPerDay}, allergies: ${p.diet.allergies.join(", ") || "none"}, restrictions: ${p.diet.restrictions.join(", ") || "none"}, budget: ${p.diet.budgetLevel ?? "?"}`,
      );
    if (p.lifestyle)
      lines.push(
        `LIFESTYLE: activity ${p.lifestyle.dailyActivity}, steps ${p.lifestyle.dailySteps ?? "?"}, sleep ${p.lifestyle.sleepHours ?? "?"}h, work ${p.lifestyle.workType}, stress ${p.lifestyle.stressLevel}, water ${p.lifestyle.waterIntakeLiters ?? "?"}L`,
      );
  }
  if (c.activeGoal)
    lines.push(
      `GOAL: ${c.activeGoal.goal} — "${c.activeGoal.description ?? ""}" (target: ${c.activeGoal.targetDate ?? "no date"}, status ${c.activeGoal.status})`,
    );
  if (c.activePlan)
    lines.push(`ACTIVE PLAN: ${c.activePlan.name} (${c.activePlan.weeks} weeks, ${c.activePlan.daysPerWeek} days/week)`);
  if (c.recentSessions.length) {
    lines.push(
      `RECENT WORKOUTS: ${c.recentSessions
        .map(
          (s) =>
            `${s.name} (${s.status}${s.difficultyFeedback ? `, felt ${s.difficultyFeedback}` : ""})`,
        )
        .join("; ")}`,
    );
  }
  if (c.memories.length) {
    lines.push(`LONG-TERM MEMORY: ${c.memories.map((m) => m.content).join("; ")}`);
  }
  if (!lines.length) return "No profile data yet — user may still be onboarding.";
  return lines.join("\n");
}
