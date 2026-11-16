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
      disabled: v.optional(v.boolean()), // Part 4: admin account control
      adminUnlockedAt: v.optional(v.number()), // password unlock timestamp for the admin console
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
      // Plan-tier gating: minimum plan rank required to chat with this bot.
      // 0 = free, 1 = Premium (₹499), 2 = Pro Coach (₹999), 3 = Elite Pro (₹1499).
      // `rosterOrder` fixes the display order so users always see which bots
      // their plan unlocks first.
      minPlanRank: v.optional(v.number()),
      rosterOrder: v.optional(v.number()),
    }).index("by_slug", ["slug"]),

    coachAssignments: defineTable({
      userId: v.id("users"),
      personaId: v.id("coachPersonas"),
      assignedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_persona", ["personaId"]),

    // Personalized coach onboarding + motivational journey state.
    // `selectedCoachId` is the source of truth for "which coach is mine" and is
    // kept in sync with userProfiles.coachPersonaId whenever a coach is assigned.
    // Nothing here is fabricated: missions/check-ins are derived from real plan data.
    coachJourney: defineTable({
      userId: v.id("users"),
      selectedCoachId: v.optional(v.id("coachPersonas")),
      coachAssignedAt: v.optional(v.number()),
      // One-time "✓ COACH ASSIGNED" first-time banner flag.
      coachWelcomeShown: v.boolean(),
      // Structured motivational course progress (survives logout).
      motivationCourseId: v.optional(v.string()),
      currentMotivationDay: v.number(),
      completedMotivationDays: v.array(v.number()),
      journeyStarted: v.boolean(),
      todayMission: v.optional(
        v.object({
          date: v.string(),
          focus: v.string(),
          items: v.array(v.string()),
        }),
      ),
      lastCoachCheckIn: v.optional(v.string()),
      // Previous coaches are preserved (history is never deleted on switch).
      coachHistory: v.array(
        v.object({
          personaId: v.id("coachPersonas"),
          assignedAt: v.number(),
          until: v.number(),
        }),
      ),
      // Physique tracking — baseline + weekly check-in cadence.
      baselineCheckinId: v.optional(v.id("physiqueCheckins")),
      lastPhysiqueCheckIn: v.optional(v.string()),
      nextPhysiqueCheckInDue: v.optional(v.string()),
      physiqueCategory: v.optional(v.string()),
      fitnessStage: v.optional(v.string()),
      priorityAreas: v.optional(v.array(v.string())),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    // Physique check-ins — private photos + cautious visual assessment.
    // Photos are stored as small client-downscaled data URLs (same pattern as
    // progressPhotos) and are only ever returned to their owner. `isBaseline`
    // marks the first check-in (WEEK 0) used as the comparison reference.
    physiqueCheckins: defineTable({
      userId: v.id("users"),
      isBaseline: v.boolean(),
      date: v.string(),
      weekIndex: v.number(),
      photoDataUrl: v.optional(v.string()),
      userDescription: v.optional(v.string()),
      physiqueCategory: v.optional(v.string()),
      priorityAreas: v.array(v.string()),
      areasToDevelop: v.array(v.string()),
      areasToMaintain: v.array(v.string()),
      fitnessStageIndex: v.number(),
      fitnessStageName: v.string(),
      trainingFocus: v.array(v.string()),
      nutritionFocus: v.array(v.string()),
      recoveryFocus: v.array(v.string()),
      userProvided: v.array(v.string()),
      measured: v.array(v.string()),
      estimates: v.array(v.string()),
      observations: v.array(v.string()),
      recommendations: v.array(v.string()),
      coachId: v.optional(v.id("coachPersonas")),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_created", ["userId", "createdAt"]),

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
      defaultWeightKg: v.optional(v.number()),
      supersetWith: v.optional(v.string()),
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
      preferredLanguage: v.optional(v.string()), // en | hi | hinglish
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

    // ===================================================================
    // PART 2 — NUTRITION + ACTIVITY + PROGRESS + BODYBUILDING
    // ===================================================================

    foods: defineTable({
      name: v.string(),
      aliases: v.array(v.string()),
      category: v.string(), // dairy | legume | grain | egg | produce | nuts_seeds | other
      dietTags: v.array(v.string()), // vegetarian | vegan | eggetarian | non_vegetarian | indian
      servingSize: v.string(), // "100g", "1 cup (240ml)"
      servingGrams: v.optional(v.number()),
      calories: v.number(),
      proteinG: v.number(),
      carbsG: v.number(),
      fatG: v.number(),
      isEstimate: v.boolean(), // always true — values are approximations
      isPublic: v.boolean(),
    }).index("by_name", ["name"]),

    foodNutrients: defineTable({
      foodId: v.id("foods"),
      label: v.string(),
      amount: v.number(),
      unit: v.string(),
    }).index("by_food", ["foodId"]),

    mealPlans: defineTable({
      userId: v.id("users"),
      date: v.string(), // yyyy-mm-dd local
      targets: v.object({
        calories: v.number(),
        proteinG: v.number(),
        carbsG: v.number(),
        fatG: v.number(),
        waterMl: v.number(),
      }),
      meals: v.array(
        v.object({
          slot: v.string(), // breakfast | lunch | pre_workout | post_workout | dinner | snacks
          name: v.string(),
          items: v.array(
            v.object({
              foodName: v.string(),
              quantity: v.string(),
              calories: v.number(),
              proteinG: v.number(),
              carbsG: v.number(),
              fatG: v.number(),
            }),
          ),
          estimatedCalories: v.number(),
          estimatedProteinG: v.number(),
        }),
      ),
      notes: v.optional(v.string()),
      source: v.string(), // engine
      isActive: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_user_date", ["userId", "date"])
      .index("by_user_active", ["userId", "isActive"]),

    mealLogs: defineTable({
      userId: v.id("users"),
      date: v.string(),
      mealSlot: v.string(),
      foodName: v.string(),
      quantity: v.string(),
      calories: v.number(),
      proteinG: v.number(),
      carbsG: v.number(),
      fatG: v.number(),
      createdAt: v.number(),
    })
      .index("by_user_date", ["userId", "date"])
      .index("by_user", ["userId"]),

    waterLogs: defineTable({
      userId: v.id("users"),
      date: v.string(),
      amountMl: v.number(),
      createdAt: v.number(),
    })
      .index("by_user_date", ["userId", "date"])
      .index("by_user", ["userId"]),

    activityLogs: defineTable({
      userId: v.id("users"),
      date: v.string(),
      kind: v.string(), // steps | active_minutes | calories_burned | sleep_hours
      value: v.number(),
      source: v.string(), // manual — never fabricated
      createdAt: v.number(),
    })
      .index("by_user_date", ["userId", "date"])
      .index("by_user", ["userId"]),

    dailyCheckins: defineTable({
      userId: v.id("users"),
      date: v.string(),
      didWorkout: v.boolean(),
      energyLevel: v.number(), // 1-5
      sleepHours: v.optional(v.number()),
      proteinOnTrack: v.optional(v.boolean()),
      waterOnTrack: v.optional(v.boolean()),
      steps: v.optional(v.number()),
      stressLevel: v.string(), // low | moderate | high
      painOrSymptoms: v.string(),
      notes: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_user_date", ["userId", "date"])
      .index("by_user", ["userId"]),

    weeklyReviews: defineTable({
      userId: v.id("users"),
      weekStart: v.string(), // yyyy-mm-dd of Monday
      workoutAdherence: v.number(), // 0-1
      nutritionAdherence: v.number(),
      proteinConsistency: v.number(),
      weightTrend: v.string(),
      activityTrend: v.string(),
      goalProgress: v.string(),
      obstacles: v.array(v.string()),
      nextWeekPriorities: v.array(v.string()),
      summary: v.string(),
      createdAt: v.number(),
    })
      .index("by_user_week", ["userId", "weekStart"])
      .index("by_user", ["userId"]),

    bodyMeasurements: defineTable({
      userId: v.id("users"),
      date: v.string(),
      weightKg: v.optional(v.number()),
      waistCm: v.optional(v.number()),
      chestCm: v.optional(v.number()),
      armCm: v.optional(v.number()),
      legCm: v.optional(v.number()),
      shoulderCm: v.optional(v.number()),
      // Extended physique tracker measurements (all user-provided, optional).
      neckCm: v.optional(v.number()),
      abdomenCm: v.optional(v.number()),
      hipsCm: v.optional(v.number()),
      calfCm: v.optional(v.number()),
      bodyFatPct: v.optional(v.number()),
      notes: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    progressPhotos: defineTable({
      userId: v.id("users"),
      date: v.string(),
      pose: v.string(), // front | side | back
      storageId: v.optional(v.id("_storage")),
      dataUrl: v.optional(v.string()), // small client-side downscale fallback
      notes: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    bodybuildingGoals: defineTable({
      userId: v.id("users"),
      mode: v.string(), // hypertrophy | strength | lean_bulk | cutting | recomp | comp_prep
      isActive: v.boolean(),
      targetWeightKg: v.optional(v.number()),
      targetBodyFatPct: v.optional(v.number()),
      startDate: v.string(),
      targetDate: v.optional(v.string()),
      notes: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_user_active", ["userId", "isActive"]),

    competitionProfiles: defineTable({
      userId: v.id("users"),
      category: v.string(), // mens_physique | classic_physique | bodybuilding | womens_division
      competitionDate: v.string(),
      currentWeightKg: v.optional(v.number()),
      trainingHistory: v.optional(v.string()),
      previousCompetitions: v.optional(v.string()),
      prepStartWeeks: v.number(),
      phase: v.string(), // base | build | cut | peak | done
      isActive: v.boolean(),
      createdAt: v.number(),
    }).index("by_user_active", ["userId", "isActive"]),

    competitionCheckins: defineTable({
      profileId: v.id("competitionProfiles"),
      userId: v.id("users"),
      weekLabel: v.string(),
      weightKg: v.optional(v.number()),
      notes: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_profile", ["profileId"]),

    fitnessMilestones: defineTable({
      userId: v.id("users"),
      kind: v.string(), // workout_streak | nutrition_streak | water_streak | checkin_streak | pr
      title: v.string(),
      detail: v.string(),
      achievedAt: v.number(),
    }).index("by_user", ["userId"]),

    // ===================================================================
    // PART 3 — SUPPLEMENT INTELLIGENCE + PRODUCT INTELLIGENCE
    // ===================================================================

    // Education knowledge base (public, seeded; admin-extendable via knowledgeDocuments)
    supplements: defineTable({
      slug: v.string(),
      category: v.string(), // whey_protein | mass_gainer | creatine | pre_workout | bcaa | eaa | electrolytes | vitamins | minerals | protein_blend | other
      name: v.string(),
      whatIs: v.string(),
      whoMayUse: v.string(),
      evidence: v.string(), // what research suggests, stated conservatively
      commonUse: v.string(),
      limitations: v.string(),
      cautionWho: v.string(), // who should be cautious / seek professional advice
      evidenceLevel: v.string(), // strong | moderate | limited | unclear
    }).index("by_slug", ["slug"]).index("by_category", ["category"]),

    // Ingredients extracted from one label analysis
    supplementIngredients: defineTable({
      analysisId: v.id("supplementAnalysis"),
      name: v.string(),
      amount: v.optional(v.string()),
      role: v.optional(v.string()), // protein_source | sweetener | filler | stimulant | vitamin | mineral | other
      note: v.optional(v.string()),
    }).index("by_analysis", ["analysisId"]),

    // One label-scan / typed-label analysis result per user
    supplementAnalysis: defineTable({
      userId: v.id("users"),
      inputType: v.string(), // typed | scanned_text (image OCR not available — text only)
      rawLabel: v.string(),
      productName: v.optional(v.string()),
      brand: v.optional(v.string()),
      category: v.optional(v.string()),
      servingSize: v.optional(v.string()),
      nutritionFacts: v.optional(v.object({
        calories: v.optional(v.number()),
        proteinG: v.optional(v.number()),
        carbsG: v.optional(v.number()),
        fatG: v.optional(v.number()),
      })),
      manufacturer: v.optional(v.string()),
      importer: v.optional(v.string()),
      batchNumber: v.optional(v.string()),
      expiry: v.optional(v.string()),
      mrp: v.optional(v.number()),
      barcode: v.optional(v.string()),
      verificationInfo: v.optional(v.string()),
      priceIntel: v.optional(v.object({
        pricePerServing: v.optional(v.number()),
        pricePerGram: v.optional(v.number()),
        pricePerProteinGram: v.optional(v.number()),
        note: v.optional(v.string()),
      })),
      verdict: v.string(), // one of the 5 evidence verdicts — never "definitely genuine/fake"
      evidenceChecked: v.array(v.string()),
      evidenceMissing: v.array(v.string()),
      redFlags: v.array(v.string()),
      verificationSteps: v.array(v.string()),
      fitnessRelevance: v.optional(v.string()), // AI enrichment, context-aware
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_created", ["userId", "createdAt"]),

    // Verification attempts (QR / auth code / batch / official channel)
    supplementVerifications: defineTable({
      userId: v.id("users"),
      analysisId: v.optional(v.id("supplementAnalysis")),
      method: v.string(), // qr | auth_code | batch | official_website | manual
      identifier: v.string(),
      result: v.string(), // submitted | instructions_provided | authoritative_confirmation | could_not_verify
      sourceName: v.optional(v.string()),
      sourceUrl: v.optional(v.string()),
      notes: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_user", ["userId"]).index("by_analysis", ["analysisId"]),

    // Brands / manufacturers researched or admin-entered
    brands: defineTable({
      slug: v.string(),
      name: v.string(),
      website: v.optional(v.string()),
      manufacturerName: v.optional(v.string()),
      distributor: v.optional(v.string()),
      certificationsClaimed: v.array(v.string()), // always labeled BRAND CLAIM until verified
      verificationMethods: v.array(v.string()),
      notes: v.optional(v.string()),
      isPublic: v.boolean(),
    }).index("by_slug", ["slug"]),

    manufacturers: defineTable({
      name: v.string(),
      country: v.optional(v.string()),
      website: v.optional(v.string()),
      notes: v.optional(v.string()),
    }).index("by_name", ["name"]),

    // Admin-controlled catalog — only approvedForRecommendation rows are recommendable
    productCatalog: defineTable({
      name: v.string(),
      brand: v.string(),
      category: v.string(),
      imageUrl: v.optional(v.string()),
      price: v.number(),
      mrp: v.optional(v.number()),
      sizeGrams: v.optional(v.number()),
      servings: v.optional(v.number()),
      servingSize: v.optional(v.string()),
      flavour: v.optional(v.string()),
      ingredients: v.optional(v.string()),
      nutrition: v.optional(v.object({
        calories: v.optional(v.number()),
        proteinG: v.optional(v.number()),
        carbsG: v.optional(v.number()),
        fatG: v.optional(v.number()),
      })),
      manufacturer: v.optional(v.string()),
      distributor: v.optional(v.string()),
      verificationMethod: v.optional(v.string()),
      verificationUrl: v.optional(v.string()),
      batchInstructions: v.optional(v.string()),
      targetAudience: v.optional(v.string()),
      fitnessGoals: v.array(v.string()),
      benefits: v.optional(v.string()),
      warnings: v.optional(v.string()),
      usage: v.optional(v.string()),
      stockStatus: v.string(), // in_stock | out_of_stock | discontinued
      approvedForRecommendation: v.boolean(),
      isActive: v.boolean(),
    }).index("by_category", ["category"]).index("by_brand", ["brand"]),

    // Source engine rows — evidence attached to analyses or products
    productSources: defineTable({
      analysisId: v.optional(v.id("supplementAnalysis")),
      productId: v.optional(v.id("productCatalog")),
      sourceName: v.string(),
      url: v.optional(v.string()),
      date: v.optional(v.string()),
      claim: v.string(),
      evidenceType: v.string(), // verified_fact | brand_claim | third_party_claim | unverified
      createdAt: v.number(),
    }).index("by_analysis", ["analysisId"]).index("by_product", ["productId"]),

    productRecommendations: defineTable({
      userId: v.id("users"),
      productId: v.id("productCatalog"),
      reason: v.string(),
      userContext: v.optional(v.string()),
      disclosure: v.string(), // always shown to the user
      alternatives: v.optional(v.string()),
      status: v.string(), // shown | accepted | dismissed
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_created", ["userId", "createdAt"]),

    productComparisons: defineTable({
      userId: v.id("users"),
      productAId: v.id("productCatalog"),
      productBId: v.id("productCatalog"),
      metrics: v.optional(v.string()), // JSON comparison rows
      summary: v.string(),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    // Admin recommendation rules: goal/diet/budget/experience/weight/category gates
    adminProductRules: defineTable({
      name: v.string(),
      enabled: v.boolean(),
      goal: v.optional(v.string()),
      dietType: v.optional(v.string()),
      budgetLevel: v.optional(v.string()), // low | medium | high
      experience: v.optional(v.string()),
      weightMinKg: v.optional(v.number()),
      weightMaxKg: v.optional(v.number()),
      category: v.optional(v.string()),
      notes: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_enabled", ["enabled"]),

    // Admin knowledge base retrieved by the coach
    knowledgeDocuments: defineTable({
      title: v.string(),
      category: v.string(), // fitness | nutrition | faq | product | brand | coaching_method | policy | verification
      content: v.string(),
      tags: v.array(v.string()),
      source: v.optional(v.string()),
      isActive: v.boolean(),
      createdAt: v.number(),
    }).index("by_active", ["isActive"]).index("by_category", ["category"]),

    // ===================================================================
    // PART 4 — ADMIN + MONETIZATION + ADVANCED AI
    // ===================================================================

    subscriptionPlans: defineTable({
      slug: v.string(), // free | premium | pro_coach | competition
      name: v.string(),
      priceInr: v.number(), // monthly
      features: v.array(v.string()),
      aiMessageLimit: v.number(), // per day
      reportsPerMonth: v.number(),
      coachingAccess: v.boolean(),
      nutritionAccess: v.boolean(),
      competitionAccess: v.boolean(),
      supplementAccess: v.boolean(),
      voiceAccess: v.boolean(),
      advancedAnalytics: v.boolean(),
      // How many AI coach bots this plan unlocks in the roster.
      botLimit: v.optional(v.number()),
      isActive: v.boolean(),
      sortOrder: v.number(),
    }).index("by_slug", ["slug"]),

    subscriptions: defineTable({
      userId: v.id("users"),
      planSlug: v.string(),
      status: v.string(), // active | trialing | canceled | expired
      trialStartedAt: v.optional(v.number()),
      trialEndsAt: v.optional(v.number()),
      currentPeriodEnd: v.optional(v.number()),
      source: v.string(), // admin | play_billing | web | trial
      cancelAtPeriodEnd: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]).index("by_plan", ["planSlug"]),

    // Google Play Billing records — entitlement NEVER granted from client claims
    purchaseRecords: defineTable({
      userId: v.id("users"),
      platform: v.string(), // android | web
      productId: v.string(),
      purchaseToken: v.string(),
      orderId: v.optional(v.string()),
      packageName: v.optional(v.string()),
      verificationStatus: v.string(), // pending | verified | failed | unverified
      verificationNote: v.optional(v.string()),
      verifiedAt: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_user", ["userId"]).index("by_token", ["purchaseToken"]),

    aiUsage: defineTable({
      userId: v.id("users"),
      day: v.string(), // yyyy-mm-dd
      messages: v.number(),
      actions: v.optional(v.number()),
      updatedAt: v.number(),
    }).index("by_user_day", ["userId", "day"]),

    leadStates: defineTable({
      userId: v.id("users"),
      temperature: v.string(), // cold | warm | interested | high_intent
      signals: v.array(v.string()),
      lastSignalAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]).index("by_temperature", ["temperature"]),

    userSettings: defineTable({
      userId: v.id("users"),
      notifications: v.object({
        workoutReminders: v.boolean(),
        waterReminders: v.boolean(),
        checkinReminders: v.boolean(),
        weeklyReview: v.boolean(),
        milestones: v.boolean(),
        subscription: v.boolean(),
        planRenewal: v.boolean(),
      }),
      voice: v.object({
        inputEnabled: v.boolean(),
        outputEnabled: v.boolean(),
      }),
      privacy: v.object({
        consentAnalytics: v.boolean(),
        allowCoachMemory: v.boolean(),
      }),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    generatedReports: defineTable({
      userId: v.id("users"),
      kind: v.string(), // weekly | monthly | progress | workout | nutrition | competition
      periodStart: v.string(),
      periodEnd: v.string(),
      content: v.string(),
      dataSnapshot: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_user", ["userId"]).index("by_user_created", ["userId", "createdAt"]),

    analyticsEvents: defineTable({
      userId: v.optional(v.id("users")),
      name: v.string(),
      props: v.optional(v.string()), // JSON, aggregate-only
      createdAt: v.number(),
    }).index("by_name", ["name"]).index("by_created", ["createdAt"]),

    // Site-wide promotional banners shown on the public home page. Images are
    // stored as downscaled data URLs (same private approach as physique photos).
    siteBanners: defineTable({
      imageDataUrl: v.string(),
      linkUrl: v.optional(v.string()),
      title: v.optional(v.string()),
      isActive: v.boolean(),
      order: v.number(),
      createdAt: v.number(),
      createdBy: v.optional(v.id("users")),
    }).index("by_active", ["isActive"]),

    // Admin-created promo codes that grant a paid plan for free.
    coupons: defineTable({
      code: v.string(),
      planSlug: v.string(), // premium | pro_coach | competition
      durationDays: v.number(), // 0 = no expiry
      maxUses: v.number(), // 0 = unlimited
      usedCount: v.number(),
      isActive: v.boolean(),
      note: v.optional(v.string()),
      createdAt: v.number(),
      createdBy: v.optional(v.id("users")),
    }).index("by_code", ["code"]),

    // Admin app settings + feature flags. Safety-critical keys are protected
    // in admin.ts and can never be disabled.
    appSettings: defineTable({
      key: v.string(),
      value: v.string(),
      updatedAt: v.number(),
    }).index("by_key", ["key"]),

    // AI routing telemetry: rolling reply latency per free model so the
    // fastest model keeps the first slot and failing models cool down.
    aiModelStats: defineTable({
      provider: v.string(), // openrouter | gemini
      model: v.string(),
      avgLatencyMs: v.number(),
      samples: v.number(),
      failures: v.number(),
      lastLatencyMs: v.optional(v.number()),
      lastUsedAt: v.number(),
      lastFailedAt: v.optional(v.number()),
    })
      .index("by_provider", ["provider"])
      .index("by_provider_model", ["provider", "model"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
