import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { goalValidator, experienceValidator, GOAL_LABELS } from "./services/domain";

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

export const getActiveGoal = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile?.activeGoalId) return null;
    return await ctx.db.get(profile.activeGoalId);
  },
});

export const getAssessment = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("fitnessAssessments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
  },
});

export const getMemory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("aiMemory")
      .withIndex("by_user_scope", (q) => q.eq("userId", userId).eq("scope", "event"))
      .take(12);
    const longTerm = await ctx.db
      .query("aiMemory")
      .withIndex("by_user_scope", (q) => q.eq("userId", userId).eq("scope", "long_term"))
      .take(12);
    return [...rows, ...longTerm].sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
    return all;
  },
});

export const getPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

/* ------------------------------------------------------------------ */
/* Onboarding                                                          */
/* ------------------------------------------------------------------ */

/** Complete save at the end of onboarding — validates the required shape. */
export const completeOnboarding = mutation({
  args: {
    // step 1
    name: v.string(),
    age: v.number(),
    sex: v.string(),
    heightCm: v.number(),
    weightKg: v.number(),
    experience: experienceValidator,
    // step 2
    // step 2
    goal: goalValidator,
    goalDescription: v.string(),
    targetDate: v.optional(v.string()),
    // step 4
    training: v.object({
      daysPerWeek: v.number(),
      sessionMinutes: v.number(),
      location: v.string(),
      equipment: v.array(v.string()),
      currentRoutine: v.optional(v.string()),
      preferredDays: v.array(v.string()),
    }),
    // step 5
    diet: v.object({
      dietType: v.string(),
      restrictions: v.array(v.string()),
      allergies: v.array(v.string()),
      preferences: v.optional(v.string()),
      budgetLevel: v.optional(v.string()),
      mealsPerDay: v.number(),
    }),
    // step 6
    lifestyle: v.object({
      dailyActivity: v.string(),
      dailySteps: v.optional(v.number()),
      sleepHours: v.optional(v.number()),
      workType: v.string(),
      stressLevel: v.string(),
      waterIntakeLiters: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Upsert the goal (single active goal at a time).
    const previousGoals = await ctx.db
      .query("fitnessGoals")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .collect();
    let goalId: Id<"fitnessGoals"> | undefined;
    for (const g of previousGoals) {
      await ctx.db.patch(g._id, { status: "archived" });
    }
    goalId = await ctx.db.insert("fitnessGoals", {
      userId,
      goal: args.goal,
      description: args.goalDescription,
      targetDate: args.targetDate,
      status: "active",
      createdAt: Date.now(),
    });

    // Upsert profile.
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const profileFields = {
      userId,
      onboardingComplete: true,
      currentStep: 7,
      name: args.name,
      age: args.age,
      sex: args.sex,
      heightCm: args.heightCm,
      weightKg: args.weightKg,
      experience: args.experience,
      training: args.training,
      diet: args.diet,
      lifestyle: args.lifestyle,
      activeGoalId: goalId,
    };
    let profileId: Id<"userProfiles">;
    if (existing) {
      await ctx.db.patch(existing._id, profileFields);
      profileId = existing._id;
    } else {
      profileId = await ctx.db.insert("userProfiles", profileFields);
    }

    // Keep the user's display name in sync.
    const user = await ctx.db.get(userId);
    if (user && !user.name) {
      await ctx.db.patch(userId, { name: args.name });
    }

    // Build + persist the structured assessment (deterministic).
    const assessment = buildAssessment({
      name: args.name,
      age: args.age,
      sex: args.sex,
      heightCm: args.heightCm,
      weightKg: args.weightKg,
      experience: args.experience,
      goal: args.goal,
      goalDescription: args.goalDescription,
      targetDate: args.targetDate,
      training: args.training,
      diet: args.diet,
      lifestyle: args.lifestyle,
    });
    await ctx.db.insert("fitnessAssessments", {
      userId,
      goalId,
      ...assessment,
      createdAt: Date.now(),
    });

    // Store experience as a long-term memory so the AI coach knows it.
    await ctx.runMutation(internal.services.memory.writeMemory, {
      userId,
      scope: "long_term",
      key: "experience",
      content: `Training experience: ${args.experience}`,
      source: "user_provided",
    });

    await ctx.runMutation(internal.services.memory.createNotification, {
      userId,
      type: "assessment",
      title: "Fitness assessment ready",
      body: "Your structured assessment has been generated from your onboarding data.",
    });
    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: "onboarding_completed",
      detail: `goal=${args.goal}`,
    });

    return { profileId, goalId };
  },
});

/** Update basic profile fields from the Profile page. */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    age: v.optional(v.number()),
    heightCm: v.optional(v.number()),
    weightKg: v.optional(v.number()),
    training: v.optional(
      v.object({
        daysPerWeek: v.number(),
        sessionMinutes: v.number(),
        location: v.string(),
        equipment: v.array(v.string()),
        currentRoutine: v.optional(v.string()),
        preferredDays: v.array(v.string()),
      }),
    ),
    diet: v.optional(
      v.object({
        dietType: v.string(),
        restrictions: v.array(v.string()),
        allergies: v.array(v.string()),
        preferences: v.optional(v.string()),
        budgetLevel: v.optional(v.string()),
        mealsPerDay: v.number(),
      }),
    ),
    lifestyle: v.optional(
      v.object({
        dailyActivity: v.string(),
        dailySteps: v.optional(v.number()),
        sleepHours: v.optional(v.number()),
        workType: v.string(),
        stressLevel: v.string(),
        waterIntakeLiters: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("Complete onboarding first");
    await ctx.db.patch(profile._id, args);
    return profile._id;
  },
});

/** Change the user's active goal (also writes an event memory). */
export const updateGoal = mutation({
  args: {
    goal: goalValidator,
    description: v.string(),
    targetDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("Complete onboarding first");

    const previous = await ctx.db
      .query("fitnessGoals")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .collect();
    for (const g of previous) await ctx.db.patch(g._id, { status: "archived" });

    const goalId = await ctx.db.insert("fitnessGoals", {
      userId,
      goal: args.goal,
      description: args.description,
      targetDate: args.targetDate,
      status: "active",
      createdAt: Date.now(),
    });
    await ctx.db.patch(profile._id, { activeGoalId: goalId });

    await ctx.runMutation(internal.services.memory.writeMemory, {
      userId,
      scope: "event",
      key: "goal_update",
      content: `Goal changed to ${GOAL_LABELS[args.goal] ?? args.goal}: ${args.description}`,
      source: "user_provided",
    });
    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: "goal_changed",
      detail: args.goal,
    });
    return goalId;
  },
});

/** Choose/switch coach persona (creates a coachAssignments row). */
export const assignCoach = mutation({
  args: { personaId: v.id("coachPersonas") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const persona = await ctx.db.get(args.personaId);
    if (!persona || !persona.isActive) throw new Error("Unknown coach");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("Complete onboarding first");
    await ctx.db.patch(profile._id, { coachPersonaId: args.personaId });

    const existing = await ctx.db
      .query("coachAssignments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { personaId: args.personaId, assignedAt: Date.now() });
    } else {
      await ctx.db.insert("coachAssignments", {
        userId,
        personaId: args.personaId,
        assignedAt: Date.now(),
      });
    }
    return args.personaId;
  },
});

/** Save communication preference; used by the Profile page. */
export const savePreferences = mutation({
  args: {
    communicationStyle: v.optional(v.string()),
    units: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("userPreferences", {
      userId,
      communicationStyle: args.communicationStyle,
      units: args.units ?? "metric",
      coachPersonaSlug: undefined,
    });
  },
});

/** Add a bodyweight measurement from the Profile page. */
export const addMeasurement = mutation({
  args: {
    weightKg: v.number(),
    bodyFatPct: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("Complete onboarding first");

    const date = new Date().toISOString().slice(0, 10);
    const entry = { date, weightKg: args.weightKg, bodyFatPct: args.bodyFatPct, notes: args.notes };
    const measurements = [...(profile.measurements ?? []), entry].slice(-52);
    await ctx.db.patch(profile._id, {
      measurements,
      weightKg: args.weightKg,
    });

    await ctx.runMutation(internal.services.memory.writeMemory, {
      userId,
      scope: "event",
      key: "measurement",
      content: `Logged weight ${args.weightKg}kg on ${date}.`,
      source: "user_provided",
    });
    return measurements.length;
  },
});

/* ------------------------------------------------------------------ */
/* Assessment builder (FitnessAssessmentService)                       */
/* ------------------------------------------------------------------ */

type OnboardingInput = {
  name?: string;
  age?: number;
  sex?: string;
  heightCm?: number;
  weightKg?: number;
  experience?: string;
  goal?: string;
  goalDescription?: string;
  targetDate?: string;
  training?: {
    daysPerWeek: number;
    sessionMinutes: number;
    location: string;
    equipment: string[];
    currentRoutine?: string;
    preferredDays: string[];
  };
  diet?: {
    dietType: string;
    restrictions: string[];
    allergies: string[];
    preferences?: string;
    budgetLevel?: string;
    mealsPerDay: number;
  };
  lifestyle?: {
    dailyActivity: string;
    dailySteps?: number;
    sleepHours?: number;
    workType: string;
    stressLevel: string;
    waterIntakeLiters?: number;
  };
};

export function buildAssessment(input: OnboardingInput) {
  const obstacles: string[] = [];
  const tracking: string[] = ["Bodyweight (weekly)", "Workout completion rate"];

  const bmi =
    input.weightKg && input.heightCm
      ? Number((input.weightKg / (input.heightCm / 100) ** 2).toFixed(1))
      : null;

  const goal = input.goal ?? "general_fitness";
  if (goal === "muscle_gain" || goal === "bodybuilding") {
    tracking.push("Progressive overload on main lifts");
  } else if (goal === "fat_loss") {
    tracking.push("Waist measurement", "Weekly average weight");
  } else if (goal === "strength" || goal === "competition_preparation") {
    tracking.push("Top-set numbers on the big lifts");
  }

  if (input.training) {
    if (input.training.daysPerWeek <= 2)
      obstacles.push("Low training frequency — recovery gaps may slow progress");
    if (input.training.sessionMinutes < 40)
      obstacles.push("Short sessions — plan must be time-efficient");
    if (!input.training.equipment.length && input.training.location === "home")
      obstacles.push("No equipment listed — bodyweight progressions will be used");
  } else {
    obstacles.push("Training details missing — plan quality will improve with more info");
  }

  if (input.lifestyle) {
    if (input.lifestyle.sleepHours && input.lifestyle.sleepHours < 7)
      obstacles.push("Sleep under 7h — recovery limited, keep intensity moderate");
    if (input.lifestyle.stressLevel === "high")
      obstacles.push("High stress — autoregulate intensity, prioritize consistency");
    if (input.lifestyle.dailyActivity === "sedentary")
      obstacles.push("Sedentary work — add daily steps as low-cost activity");
    tracking.push("Sleep hours", "Daily steps");
  }

  if (input.diet) {
    if (input.diet.dietType === "vegan" || input.diet.dietType === "vegetarian")
      tracking.push("Protein sources audited weekly");
    if (input.diet.allergies.length)
      obstacles.push(`Allergies to respect: ${input.diet.allergies.join(", ")}`);
  }

  const goalLabel = GOAL_LABELS[goal] ?? goal;

  return {
    startingPoint: `Starting point: ${input.weightKg ?? "?"}kg at ${input.heightCm ?? "?"}cm (BMI ${bmi ?? "n/a"} — ESTIMATED indicator, not a diagnosis). Experience: ${input.experience ?? "unspecified"}. Current routine: ${input.training?.currentRoutine || "not provided"}.`,
    goalAnalysis: `Goal "${goalLabel}": ${input.goalDescription || "no detailed description provided"}. Target date: ${input.targetDate || "not set"}. ${
      input.targetDate
        ? "Timeline noted — weekly checkpoints will be used."
        : "No target date — suggest setting one for measurable checkpoints."
    }`,
    trainingAssessment: input.training
      ? `${input.training.daysPerWeek} days/week at ${input.training.sessionMinutes} min in a ${input.training.location} setting with ${input.training.equipment.join(", ") || "bodyweight only"}. Preferred days: ${input.training.preferredDays.join(", ") || "flexible"}.`
      : "Training details not provided yet.",
    lifestyleAssessment: input.lifestyle
      ? `Activity: ${input.lifestyle.dailyActivity}; sleep ${input.lifestyle.sleepHours ?? "?"}h; stress ${input.lifestyle.stressLevel}; work type ${input.lifestyle.workType}.`
      : "Lifestyle details not provided yet.",
    nutritionOverview: input.diet
      ? `${input.diet.dietType} pattern, ${input.diet.mealsPerDay} meals/day, budget ${input.diet.budgetLevel ?? "unspecified"}. Allergies: ${input.diet.allergies.join(", ") || "none"}.`
      : "Diet details not provided yet.",
    obstacles,
    strategy: `For ${goalLabel.toLowerCase()} at ${input.experience ?? "beginner"} level: consistent ${input.training?.daysPerWeek ?? 3}-day training, protein-forward nutrition matching the ${input.diet?.dietType ?? "current"} pattern, and weekly tracking of ${tracking.slice(0, 3).join(", ").toLowerCase()}. Adjust every 2-3 weeks based on logged results — changes stay gradual and safe.`,
    trackingMetrics: tracking,
  };
}
