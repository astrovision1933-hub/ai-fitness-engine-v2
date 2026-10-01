import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

/* ------------------------------------------------------------------ */
/* Exercise library (foundation for the Part 2 engine)                 */
/* ------------------------------------------------------------------ */

type ExerciseTemplate = {
  name: string;
  muscleGroup: string;
  needsGym: boolean;
  alternatives: string[];
};

const EXERCISES: Record<string, ExerciseTemplate[]> = {
  push: [
    { name: "Push-ups / Bench press", muscleGroup: "chest", needsGym: false, alternatives: ["Incline push-ups", "Dumbbell press"] },
    { name: "Overhead press", muscleGroup: "shoulders", needsGym: false, alternatives: ["Pike push-ups"] },
  ],
  pull: [
    { name: "Rows (barbell/dumbbell/band)", muscleGroup: "back", needsGym: false, alternatives: ["Inverted rows", "Band rows"] },
    { name: "Pull-ups / Lat pulldown", muscleGroup: "back", needsGym: false, alternatives: ["Band pulldowns"] },
  ],
  legs: [
    { name: "Squats (barbell/goblet/bodyweight)", muscleGroup: "quads", needsGym: false, alternatives: ["Box squats", "Split squats"] },
    { name: "Romanian deadlift", muscleGroup: "hamstrings", needsGym: false, alternatives: ["Hip hinge with band"] },
    { name: "Calf raises", muscleGroup: "calves", needsGym: false, alternatives: [] },
  ],
  fullbody: [
    { name: "Goblet squats", muscleGroup: "quads", needsGym: false, alternatives: ["Bodyweight squats"] },
    { name: "Push-ups", muscleGroup: "chest", needsGym: false, alternatives: ["Incline push-ups"] },
    { name: "Band/dumbbell rows", muscleGroup: "back", needsGym: false, alternatives: [] },
    { name: "Plank", muscleGroup: "core", needsGym: false, alternatives: ["Dead bug"] },
  ],
};

type SessionTemplate = {
  name: string;
  focus: string;
  exercises: Array<{ name: string; muscleGroup: string; sets: number; reps: string; rest: number; technique?: string; alternatives: string[] }>;
};

const SESSION_TEMPLATES: SessionTemplate[] = [
  {
    name: "Full Body A",
    focus: "Squat pattern + push + pull",
    exercises: [
      { name: "Goblet squats", muscleGroup: "quads", sets: 3, reps: "8-10", rest: 90, technique: "Chest up, knees track over toes, controlled 3s descent.", alternatives: ["Bodyweight squats", "Box squats"] },
      { name: "Push-ups", muscleGroup: "chest", sets: 3, reps: "8-15", rest: 75, technique: "Body in one line; full lockout at the top.", alternatives: ["Incline push-ups", "Bench press"] },
      { name: "One-arm rows", muscleGroup: "back", sets: 3, reps: "10-12", rest: 75, technique: "Pull to the hip, squeeze the shoulder blade.", alternatives: ["Band rows", "Inverted rows"] },
      { name: "Plank", muscleGroup: "core", sets: 3, reps: "30-45s", rest: 45, technique: "Ribs down, glutes tight, breathe.", alternatives: ["Dead bug"] },
    ],
  },
  {
    name: "Full Body B",
    focus: "Hinge + vertical push + arms",
    exercises: [
      { name: "Romanian deadlift", muscleGroup: "hamstrings", sets: 3, reps: "8-10", rest: 90, technique: "Hips back, flat back, feel hamstring stretch.", alternatives: ["Hip hinge with band"] },
      { name: "Overhead press", muscleGroup: "shoulders", sets: 3, reps: "8-10", rest: 90, technique: "Ribs down, press to lockout, no back arch.", alternatives: ["Pike push-ups"] },
      { name: "Lat pulldown / Pull-ups", muscleGroup: "back", sets: 3, reps: "8-12", rest: 90, technique: "Chest tall, drive elbows down.", alternatives: ["Band pulldowns"] },
      { name: "Farmer carries", muscleGroup: "core", sets: 3, reps: "30-40m", rest: 60, technique: "Tall posture, don't lean.", alternatives: ["Suitcase carries"] },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* WorkoutEngine — deterministic generation from profile data          */
/* ------------------------------------------------------------------ */

function pickTemplates(daysPerWeek: number): SessionTemplate[] {
  if (daysPerWeek <= 2) return [SESSION_TEMPLATES[0], SESSION_TEMPLATES[1]];
  if (daysPerWeek === 3) return SESSION_TEMPLATES.slice(0, 3);
  return SESSION_TEMPLATES;
}

export const generatePlan = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("Complete onboarding first");

    const goal = profile.activeGoalId
      ? (await ctx.db.get(profile.activeGoalId))?.goal ?? "general_fitness"
      : "general_fitness";

    const daysPerWeek = Math.max(2, Math.min(6, profile.training?.daysPerWeek ?? 3));
    const location = profile.training?.location ?? "gym";
    const experience = profile.experience ?? "beginner";
    const homeOnly = location === "home";

    const templates = pickTemplates(daysPerWeek);
    const name = `${goal.replace(/_/g, " ")} — ${daysPerWeek}-day plan`;

    // Archive previous active plans (single active plan at a time).
    const previous = await ctx.db
      .query("workoutPlans")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .collect();
    for (const plan of previous) {
      await ctx.db.patch(plan._id, { isActive: false });
    }

    const planId = await ctx.db.insert("workoutPlans", {
      userId,
      goalId: profile.activeGoalId,
      name,
      weeks: 8,
      daysPerWeek,
      source: "engine",
      notes: `Auto-generated from profile: ${experience} level, ${location} training.${
        homeOnly ? " Home-equipment options included." : ""
      }`,
      isActive: true,
      createdAt: Date.now(),
    });

    // Pre-create scheduled sessions for week 1.
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      const sessionId = await ctx.db.insert("workoutSessions", {
        userId,
        planId,
        name: template.name,
        dayIndex: i,
        status: "scheduled",
      });
      for (let j = 0; j < template.exercises.length; j++) {
        const ex = template.exercises[j];
        await ctx.db.insert("workoutExercises", {
          sessionId,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          restSeconds: ex.rest,
          order: j,
          muscleGroup: ex.muscleGroup,
          techniqueNotes: ex.technique ?? undefined,
          alternatives: ex.alternatives,
          phase: "main",
        });
      }
    }

    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: "workout_plan_generated",
      detail: name,
    });
    await ctx.runMutation(internal.services.memory.createNotification, {
      userId,
      type: "plan",
      title: "New training plan ready",
      body: `${name} — week 1 sessions are scheduled.`,
    });

    return { planId, name };
  },
});

export const getActivePlan = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("workoutPlans")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .first();
  },
});

export const getPlanSessions = query({
  args: { planId: v.id("workoutPlans") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== userId) return null;
    return await ctx.db
      .query("workoutSessions")
      .withIndex("by_plan", (q) => q.eq("planId", args.planId))
      .collect();
  },
});

export const getSessionDetail = query({
  args: { sessionId: v.id("workoutSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) return null;
    const [exercises, logs] = await Promise.all([
      ctx.db
        .query("workoutExercises")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
      ctx.db
        .query("exerciseLogs")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect(),
    ]);
    return { session, exercises: exercises.sort((a, b) => a.order - b.order), logs };
  },
});

export const getRecentSessions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("workoutSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 10);
  },
});

/* ------------------------------------------------------------------ */
/* Session lifecycle                                                   */
/* ------------------------------------------------------------------ */

export const startSession = mutation({
  args: { sessionId: v.id("workoutSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) throw new Error("Session not found");
    if (session.status === "completed") throw new Error("Session already completed");
    await ctx.db.patch(args.sessionId, {
      status: "in_progress",
      startedAt: Date.now(),
    });
  },
});

export const logSet = mutation({
  args: {
    sessionId: v.id("workoutSessions"),
    exerciseOrder: v.number(),
    setIndex: v.number(),
    weightKg: v.optional(v.number()),
    reps: v.optional(v.number()),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) throw new Error("Session not found");

    const existing = await ctx.db
      .query("exerciseLogs")
      .withIndex("by_session_exercise", (q) =>
        q.eq("sessionId", args.sessionId).eq("exerciseOrder", args.exerciseOrder),
      )
      .filter((q) => q.eq(q.field("setIndex"), args.setIndex))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        weightKg: args.weightKg,
        reps: args.reps,
        completed: args.completed,
      });
      return existing._id;
    }
    return await ctx.db.insert("exerciseLogs", {
      sessionId: args.sessionId,
      exerciseOrder: args.exerciseOrder,
      setIndex: args.setIndex,
      weightKg: args.weightKg,
      reps: args.reps,
      completed: args.completed,
      createdAt: Date.now(),
    });
  },
});

export const finishSession = mutation({
  args: {
    sessionId: v.id("workoutSessions"),
    difficultyFeedback: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) throw new Error("Session not found");

    const completedAt = Date.now();
    const durationMinutes = session.startedAt
      ? Math.max(1, Math.round((completedAt - session.startedAt) / 60000))
      : undefined;

    await ctx.db.patch(args.sessionId, {
      status: "completed",
      completedAt,
      durationMinutes,
      difficultyFeedback: args.difficultyFeedback,
      notes: args.notes,
    });

    await ctx.runMutation(internal.services.memory.writeMemory, {
      userId,
      scope: "event",
      key: "workout_completed",
      content: `Completed "${session.name}"${durationMinutes ? ` in ${durationMinutes} min` : ""}${args.difficultyFeedback ? ` — felt ${args.difficultyFeedback.replace(/_/g, " ")}` : ""}.`,
      source: "system_data",
    });
    await ctx.runMutation(internal.services.memory.createNotification, {
      userId,
      type: "workout",
      title: "Workout logged",
      body: `${session.name} completed.`,
    });
    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: "workout_completed",
      detail: session.name,
    });
  },
});
