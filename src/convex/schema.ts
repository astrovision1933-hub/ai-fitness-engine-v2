import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);

export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
    }).index("email", ["email"]),

    // ---- Part 1: AI Fitness Engine domain tables ----

    userProfiles: defineTable({
      userId: v.id("users"),
      onboardingComplete: v.boolean(),
      currentStep: v.optional(v.number()),
      // step 1 basic
      name: v.optional(v.string()),
      age: v.optional(v.number()),
      sex: v.optional(v.string()),
      heightCm: v.optional(v.number()),
      weightKg: v.optional(v.number()),
      // step 3 experience
      experience: v.optional(v.string()), // beginner | intermediate | advanced | competitive
      // step 4 training
      training: v.optional(v.object({
        daysPerWeek: v.number(),
        sessionMinutes: v.number(),
        location: v.string(), // gym | home | mixed
        equipment: v.array(v.string()),
        currentRoutine: v.optional(v.string()),
        preferredDays: v.array(v.string()),
      })),
      // step 5 diet
      diet: v.optional(v.object({
        dietType: v.string(), // vegetarian | vegan | eggetarian | non-vegetarian | indian
        restrictions: v.array(v.string()),
        allergies: v.array(v.string()),
        preferences: v.optional(v.string()),
        budgetLevel: v.optional(v.string()), // low | medium | high
        mealsPerDay: v.number(),
      })),
      // step 6 lifestyle
      lifestyle: v.optional(v.object({
        dailyActivity: v.string(), // sedentary | light | moderate | active
        dailySteps: v.optional(v.number()),
        sleepHours: v.optional(v.number()),
        workType: v.string(), // desk | physical | mixed | student
        stressLevel: v.string(), // low | moderate | high
        waterIntakeLiters: v.optional(v.number()),
      })),
      // step 7 target
      activeGoalId: v.optional(v.id("fitnessGoals")),
      coachPersonaId: v.optional(v.id("coachPersonas")),
      measurements: v.optional(v.array(v.object({
        date: v.string(),
        weightKg: v.optional(v.number()),
        bodyFatPct: v.optional(v.number()),
        notes: v.optional(v.string()),
      }))),
    })
      .index("by_user", ["userId"])
      .index("by_goal", ["activeGoalId"]),

    fitnessGoals: defineTable({
      userId: v.id("users"),
      goal: v.string(), // fat_loss | muscle_gain | lean_muscle | strength | recomp | general | athletic | bodybuilding | comp_prep
      description: v.optional(v.string()), // "what exactly do you want to achieve?"
      targetDate: v.optional(v.string()),
      status: v.string(), // active | achieved | archived
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_status", ["userId", "status"]),

    fitnessAssessments: defineTable({
      userId: v.id("users"),
      goalId: v.optional(v.id("fitnessGoals")),
      startingPoint: v.string(),
      goalAnalysis: v.string(),
      trainingAssessment: v.string(),
      lifestyleAssessment: v.string(),
      nutritionOverview: v.string(),
      obstacles: v.array(v.string()),
      strategy: v.string(),
      trackingMetrics: v.array(v.string()),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    coachPersonas: defineTable({
      slug: v.string(),
      name: v.string(),
      role: v.string(),
      avatarGlyph: v.string(), // short monospace glyph used by the terminal UI
      personality: v.string(),
      communicationStyle: v.string(),
      expertise: v.array(v.string()),
      philosophy: v.string(),
      systemInstructions: v.string(),
      isActive: v.boolean(),
    }).index("by_slug", ["slug"]),

    coachAssignments: defineTable({
      userId: v.id("users"),
      personaId: v.id("coachPersonas"),
      assignedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_persona", ["personaId"]),

    conversations: defineTable({
      userId: v.id("users"),
      personaId: v.id("coachPersonas"),
      title: v.string(),
      lastMessageAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_persona", ["personaId"]),

    conversationMessages: defineTable({
      conversationId: v.id("conversations"),
      userId: v.id("users"),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      intent: v.optional(v.string()),
      intentConfidence: v.optional(v.number()),
      safetyFlag: v.optional(v.boolean()),
      personaId: v.optional(v.id("coachPersonas")),
      createdAt: v.number(),
    })
      .index("by_conversation", ["conversationId"])
      .index("by_user", ["userId"])
      .index("by_user_created", ["userId", "createdAt"]),

    workoutPlans: defineTable({
      userId: v.id("users"),
      goalId: v.optional(v.id("fitnessGoals")),
      name: v.string(),
      weeks: v.number(),
      daysPerWeek: v.number(),
      source: v.string(), // engine | ai
      notes: v.optional(v.string()),
      isActive: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_active", ["userId", "isActive"]),

    workoutSessions: defineTable({
      userId: v.id("users"),
      planId: v.optional(v.id("workoutPlans")),
      name: v.string(),
      dayIndex: v.number(),
      status: v.string(), // scheduled | in_progress | completed | skipped
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      durationMinutes: v.optional(v.number()),
      difficultyFeedback: v.optional(v.string()), // easy | just_right | hard | too_hard
      notes: v.optional(v.string()),
    })
      .index("by_user", ["userId"])
      .index("by_user_status", ["userId", "status"])
      .index("by_plan", ["planId"]),

    workoutExercises: defineTable({
      sessionId: v.id("workoutSessions"),
      name: v.string(),
      sets: v.number(),
      reps: v.string(), // "8-10", "AMRAP", "12"
      restSeconds: v.number(),
      order: v.number(),
      muscleGroup: v.string(),
      techniqueNotes: v.optional(v.string()),
      alternatives: v.array(v.string()),
      phase: v.string(), // warmup | main | cooldown
    }).index("by_session", ["sessionId"]),

    exerciseLogs: defineTable({
      sessionId: v.id("workoutSessions"),
      exerciseOrder: v.number(),
      setName: v.optional(v.string()),
      setIndex: v.number(),
      weightKg: v.optional(v.number()),
      reps: v.optional(v.number()),
      completed: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_session", ["sessionId"])
      .index("by_session_exercise", ["sessionId", "exerciseOrder"]),

    userPreferences: defineTable({
      userId: v.id("users"),
      communicationStyle: v.optional(v.string()), // concise | detailed | motivational
      units: v.string(), // metric | imperial
      coachPersonaSlug: v.optional(v.string()),
    }).index("by_user", ["userId"]),

    aiMemory: defineTable({
      userId: v.id("users"),
      scope: v.string(), // short_term | long_term | event | preference
      key: v.string(),
      content: v.string(),
      source: v.string(), // user_provided | system_data | estimated
      createdAt: v.number(),
    })
      .index("by_user_scope", ["userId", "scope"])
      .index("by_user_key", ["userId", "key"]),

    notifications: defineTable({
      userId: v.id("users"),
      type: v.string(),
      title: v.string(),
      body: v.string(),
      read: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_read", ["userId", "read"]),

    auditLogs: defineTable({
      userId: v.optional(v.id("users")),
      action: v.string(),
      detail: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
