import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  buildPhysiqueAssessment,
  buildWeeklyComparison,
  CATEGORY_LABELS,
  type MeasurementEntry,
} from "./services/physique";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const MAX_PHOTO_CHARS = 900_000;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

async function getOrCreateJourney(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await ctx.db
    .query("coachJourney")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("coachJourney", {
    userId,
    coachWelcomeShown: false,
    currentMotivationDay: 1,
    completedMotivationDays: [],
    journeyStarted: false,
    coachHistory: [],
    updatedAt: Date.now(),
  });
  return (await ctx.db.get(id))!;
}

type Ctx = QueryCtx | MutationCtx;

/** Nearest body measurement on or before a date (oldest→newest list). */
function measurementOnOrBefore(rows: MeasurementEntry[], date: string): MeasurementEntry | undefined {
  let found: MeasurementEntry | undefined;
  for (const r of rows) {
    if (r.date <= date) found = r;
  }
  return found;
}

async function loadPhysiqueContext(ctx: Ctx, userId: Id<"users">) {
  const [profile, journey] = await Promise.all([
    ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
    ctx.db.query("coachJourney").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
  ]);

  const personaId = journey?.selectedCoachId ?? profile?.coachPersonaId ?? null;
  const persona = personaId ? await ctx.db.get(personaId) : null;

  const goal = profile?.activeGoalId ? await ctx.db.get(profile.activeGoalId) : null;

  const measurementRows = await ctx.db
    .query("bodyMeasurements")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("asc")
    .take(120);
  const measurements: MeasurementEntry[] = measurementRows.map((m) => ({
    date: m.date,
    weightKg: m.weightKg,
    waistCm: m.waistCm,
    chestCm: m.chestCm,
    armCm: m.armCm,
    legCm: m.legCm,
    shoulderCm: m.shoulderCm,
    neckCm: m.neckCm,
    abdomenCm: m.abdomenCm,
    hipsCm: m.hipsCm,
    calfCm: m.calfCm,
    bodyFatPct: m.bodyFatPct,
  }));

  const sessions = await ctx.db
    .query("workoutSessions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(12);

  const now = Date.now();
  const weekAgo = now - 7 * 86_400_000;
  const completedThisWeek = sessions.filter(
    (s) => s.status === "completed" && (s.completedAt ?? 0) >= weekAgo,
  ).length;
  const completedTotal = sessions.filter((s) => s.status === "completed").length;
  const adherence = sessions.length ? completedTotal / sessions.length : 0;

  const checkins = await ctx.db
    .query("physiqueCheckins")
    .withIndex("by_user_created", (q) => q.eq("userId", userId))
    .order("desc")
    .take(40);

  return {
    profile,
    journey,
    persona,
    goal,
    measurements,
    completedThisWeek,
    adherence,
    plannedPerWeek: profile?.training?.daysPerWeek ?? 3,
    checkins,
  };
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export const getPhysiqueState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const c = await loadPhysiqueContext(ctx, userId);
    const todayStr = today();
    const nextDue = c.journey?.nextPhysiqueCheckInDue ?? null;
    const dueNow = nextDue ? todayStr >= nextDue : false;

    const baseline = c.checkins.find((x) => x.isBaseline) ?? null;
    const latest = c.checkins[0] ?? null;

    // Keep the payload small: full images are only embedded for the newest
    // check-in and the baseline. Any other pair is fetched via getComparison.
    const history = c.checkins.map((x, i) => ({
      _id: x._id,
      date: x.date,
      weekIndex: x.weekIndex,
      isBaseline: x.isBaseline,
      hasPhoto: Boolean(x.photoDataUrl),
      photoDataUrl: x.isBaseline || i === 0 ? x.photoDataUrl : undefined,
      physiqueCategory: x.physiqueCategory ?? null,
      fitnessStageName: x.fitnessStageName,
      trainingFocus: x.trainingFocus,
      nutritionFocus: x.nutritionFocus,
      recoveryFocus: x.recoveryFocus,
      priorityAreas: x.priorityAreas,
      measured: x.measured,
      observations: x.observations,
      recommendations: x.recommendations,
      userProvided: x.userProvided,
      estimates: x.estimates,
      areasToDevelop: x.areasToDevelop,
      areasToMaintain: x.areasToMaintain,
      userDescription: x.userDescription ?? null,
    }));

    return {
      hasCoach: Boolean(c.persona),
      coach: c.persona
        ? { _id: c.persona._id, name: c.persona.name, role: c.persona.role, philosophy: c.persona.philosophy }
        : null,
      userName: c.profile?.name ?? "athlete",
      category: c.journey?.physiqueCategory ?? latest?.physiqueCategory ?? null,
      categoryLabel: c.journey?.physiqueCategory
        ? CATEGORY_LABELS[c.journey.physiqueCategory] ?? c.journey.physiqueCategory
        : null,
      fitnessStage: c.journey?.fitnessStage ?? latest?.fitnessStageName ?? null,
      priorityAreas: c.journey?.priorityAreas ?? latest?.priorityAreas ?? [],
      description: profileDescription(c.checkins),
      lastCheckIn: c.journey?.lastPhysiqueCheckIn ?? null,
      nextDue,
      dueNow,
      daysUntilDue: nextDue ? daysBetween(todayStr, nextDue) : null,
      counts: {
        checkins: c.checkins.length,
        photos: c.checkins.filter((x) => x.photoDataUrl).length,
      },
      hasBaseline: Boolean(baseline),
      // Photos travel once, inside `history` (newest + baseline only). Extra
      // `latestPhoto`/`baselinePhoto` copies tripled a ~700KB base64 payload on
      // every subscription push and are not read by any screen.
      history,
    };
  },
});

function profileDescription(checkins: Array<{ userDescription?: string | null }>): string | null {
  for (const c of checkins) if (c.userDescription) return c.userDescription;
  return null;
}

/** Full comparison payload for two check-ins (photos + measured changes + review). */
export const getComparison = query({
  args: { fromId: v.id("physiqueCheckins"), toId: v.id("physiqueCheckins") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const [from, to] = await Promise.all([ctx.db.get(args.fromId), ctx.db.get(args.toId)]);
    if (!from || !to || from.userId !== userId || to.userId !== userId) return null;

    const c = await loadPhysiqueContext(ctx, userId);
    const review = buildWeeklyComparison({
      previousDate: from.date,
      currentDate: to.date,
      previousMeasurement: measurementOnOrBefore(c.measurements, from.date),
      currentMeasurement: measurementOnOrBefore(c.measurements, to.date),
      previousCategory: from.physiqueCategory,
      currentCategory: to.physiqueCategory,
      workoutAdherence: c.adherence,
      nutritionAdherence: 0,
      completedThisWeek: c.completedThisWeek,
      plannedPerWeek: c.plannedPerWeek,
    });

    return {
      from: { _id: from._id, date: from.date, photoDataUrl: from.photoDataUrl ?? null, weekIndex: from.weekIndex },
      to: { _id: to._id, date: to.date, photoDataUrl: to.photoDataUrl ?? null, weekIndex: to.weekIndex },
      review,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

/** Save a physique check-in (baseline on first use) and generate its assessment. */
export const savePhysiqueCheckIn = mutation({
  args: {
    dataUrl: v.optional(v.string()),
    userDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (args.dataUrl && args.dataUrl.length > MAX_PHOTO_CHARS) {
      throw new Error("Image too large — please use a smaller photo");
    }
    const c = await loadPhysiqueContext(ctx, userId);
    if (!c.profile) throw new Error("Complete onboarding first");

    const journey = await getOrCreateJourney(ctx, userId);
    const date = today();
    const isBaseline = c.checkins.length === 0;
    const latest = c.checkins[0];
    const weekIndex = isBaseline ? 0 : (latest?.weekIndex ?? 0) + 1;

    const assessment = buildPhysiqueAssessment({
      name: c.profile.name ?? "athlete",
      sex: c.profile.sex,
      age: c.profile.age,
      heightCm: c.profile.heightCm,
      weightKg: c.profile.weightKg,
      goal: c.goal?.goal ?? "general_fitness",
      experience: c.profile.experience ?? "beginner",
      trainingDays: c.profile.training?.daysPerWeek,
      dietType: c.profile.diet?.dietType,
      dailyActivity: c.profile.lifestyle?.dailyActivity,
      sleepHours: c.profile.lifestyle?.sleepHours,
      stepsTarget: c.profile.lifestyle?.dailySteps,
      userDescription: args.userDescription ?? latest?.userDescription ?? undefined,
      hasPhoto: Boolean(args.dataUrl),
      measurement: c.measurements[c.measurements.length - 1],
      adherence: c.adherence,
      completedThisWeek: c.completedThisWeek,
      competitionDate: c.goal?.targetDate,
    });

    const checkinId = await ctx.db.insert("physiqueCheckins", {
      userId,
      isBaseline,
      date,
      weekIndex,
      photoDataUrl: args.dataUrl,
      userDescription: args.userDescription ?? latest?.userDescription,
      physiqueCategory: assessment.physiqueCategory,
      priorityAreas: assessment.priorityAreas,
      areasToDevelop: assessment.areasToDevelop,
      areasToMaintain: assessment.areasToMaintain,
      fitnessStageIndex: assessment.fitnessStageIndex,
      fitnessStageName: assessment.fitnessStageName,
      trainingFocus: assessment.trainingFocus,
      nutritionFocus: assessment.nutritionFocus,
      recoveryFocus: assessment.recoveryFocus,
      userProvided: assessment.userProvided,
      measured: assessment.measured,
      estimates: assessment.estimates,
      observations: assessment.observations,
      recommendations: assessment.recommendations,
      coachId: c.persona?._id,
      createdAt: Date.now(),
    });

    await ctx.db.patch(journey._id, {
      baselineCheckinId: journey.baselineCheckinId ?? checkinId,
      lastPhysiqueCheckIn: date,
      nextPhysiqueCheckInDue: addDays(date, 7),
      physiqueCategory: assessment.physiqueCategory,
      fitnessStage: assessment.fitnessStageName,
      priorityAreas: assessment.priorityAreas,
      updatedAt: Date.now(),
    });

    await ctx.runMutation(internal.services.memory.writeMemory, {
      userId,
      scope: "event",
      key: isBaseline ? "physique_baseline" : "physique_checkin",
      content: `${isBaseline ? "Baseline physique recorded" : `Physique check-in week ${weekIndex}`} — category: ${assessment.physiqueCategory}, stage: ${assessment.fitnessStageName}.`,
      source: "system_data",
    });
    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: isBaseline ? "physique_baseline_saved" : "physique_checkin_saved",
      detail: `week=${weekIndex}`,
    });
    if (!isBaseline) {
      await ctx.runMutation(internal.services.memory.createNotification, {
        userId,
        type: "physique",
        title: "Weekly check-in added",
        body: "Your latest progress has been added to your physique journey.",
      });
    }

    return { checkinId, isBaseline, weekIndex, assessment };
  },
});

/** Save/replace the written physique description without a photo. */
export const savePhysiqueDescription = mutation({
  args: { description: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const c = await loadPhysiqueContext(ctx, userId);
    if (!c.profile) throw new Error("Complete onboarding first");

    const date = today();
    // Reuse today's check-in if it exists, otherwise create a description-only row.
    const existing = c.checkins.find((x) => x.date === date);
    const assessment = buildPhysiqueAssessment({
      name: c.profile.name ?? "athlete",
      sex: c.profile.sex,
      age: c.profile.age,
      heightCm: c.profile.heightCm,
      weightKg: c.profile.weightKg,
      goal: c.goal?.goal ?? "general_fitness",
      experience: c.profile.experience ?? "beginner",
      trainingDays: c.profile.training?.daysPerWeek,
      dietType: c.profile.diet?.dietType,
      dailyActivity: c.profile.lifestyle?.dailyActivity,
      sleepHours: c.profile.lifestyle?.sleepHours,
      stepsTarget: c.profile.lifestyle?.dailySteps,
      userDescription: args.description,
      hasPhoto: Boolean(existing?.photoDataUrl),
      measurement: c.measurements[c.measurements.length - 1],
      adherence: c.adherence,
      completedThisWeek: c.completedThisWeek,
      competitionDate: c.goal?.targetDate,
    });

    if (existing) {
      await ctx.db.patch(existing._id, {
        userDescription: args.description,
        physiqueCategory: assessment.physiqueCategory,
        priorityAreas: assessment.priorityAreas,
        areasToDevelop: assessment.areasToDevelop,
        areasToMaintain: assessment.areasToMaintain,
        fitnessStageIndex: assessment.fitnessStageIndex,
        fitnessStageName: assessment.fitnessStageName,
        trainingFocus: assessment.trainingFocus,
        nutritionFocus: assessment.nutritionFocus,
        recoveryFocus: assessment.recoveryFocus,
        userProvided: assessment.userProvided,
        measured: assessment.measured,
        estimates: assessment.estimates,
        observations: assessment.observations,
        recommendations: assessment.recommendations,
      });
      return existing._id;
    }

    const isBaseline = c.checkins.length === 0;
    const id = await ctx.db.insert("physiqueCheckins", {
      userId,
      isBaseline,
      date,
      weekIndex: isBaseline ? 0 : (c.checkins[0]?.weekIndex ?? 0) + 1,
      userDescription: args.description,
      physiqueCategory: assessment.physiqueCategory,
      priorityAreas: assessment.priorityAreas,
      areasToDevelop: assessment.areasToDevelop,
      areasToMaintain: assessment.areasToMaintain,
      fitnessStageIndex: assessment.fitnessStageIndex,
      fitnessStageName: assessment.fitnessStageName,
      trainingFocus: assessment.trainingFocus,
      nutritionFocus: assessment.nutritionFocus,
      recoveryFocus: assessment.recoveryFocus,
      userProvided: assessment.userProvided,
      measured: assessment.measured,
      estimates: assessment.estimates,
      observations: assessment.observations,
      recommendations: assessment.recommendations,
      coachId: c.persona?._id,
      createdAt: Date.now(),
    });

    const journey = await getOrCreateJourney(ctx, userId);
    await ctx.db.patch(journey._id, {
      baselineCheckinId: journey.baselineCheckinId ?? id,
      lastPhysiqueCheckIn: date,
      nextPhysiqueCheckInDue: addDays(date, 7),
      physiqueCategory: assessment.physiqueCategory,
      fitnessStage: assessment.fitnessStageName,
      priorityAreas: assessment.priorityAreas,
      updatedAt: Date.now(),
    });
    return id;
  },
});

/** Replace a check-in's photo (privacy: the user controls their own photos). */
export const replacePhysiquePhoto = mutation({
  args: { checkinId: v.id("physiqueCheckins"), dataUrl: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (args.dataUrl.length > MAX_PHOTO_CHARS) throw new Error("Image too large");
    const row = await ctx.db.get(args.checkinId);
    if (!row || row.userId !== userId) throw new Error("Check-in not found");
    await ctx.db.patch(args.checkinId, { photoDataUrl: args.dataUrl });
    return { ok: true };
  },
});

/** Delete only the photo from a check-in (the assessment row is preserved). */
export const deletePhysiquePhoto = mutation({
  args: { checkinId: v.id("physiqueCheckins") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.checkinId);
    if (!row || row.userId !== userId) throw new Error("Check-in not found");
    await ctx.db.patch(args.checkinId, { photoDataUrl: undefined });
    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: "physique_photo_deleted",
      detail: args.checkinId,
    });
    return { ok: true };
  },
});

/** Delete the entire physique history + cadence (full transparency/control). */
export const deletePhysiqueHistory = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("physiqueCheckins")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);

    const journey = await ctx.db
      .query("coachJourney")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (journey) {
      await ctx.db.patch(journey._id, {
        baselineCheckinId: undefined,
        lastPhysiqueCheckIn: undefined,
        nextPhysiqueCheckInDue: undefined,
        physiqueCategory: undefined,
        fitnessStage: undefined,
        priorityAreas: undefined,
        updatedAt: Date.now(),
      });
    }
    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: "physique_history_deleted",
      detail: `rows=${rows.length}`,
    });
    return { deleted: rows.length };
  },
});

/**
 * Extended physique measurements — all optional, all user-provided.
 * Nothing is fabricated; the user types what they actually measured.
 */
export const addPhysiqueMeasurement = mutation({
  args: {
    weightKg: v.optional(v.number()),
    neckCm: v.optional(v.number()),
    chestCm: v.optional(v.number()),
    waistCm: v.optional(v.number()),
    abdomenCm: v.optional(v.number()),
    hipsCm: v.optional(v.number()),
    armCm: v.optional(v.number()),
    legCm: v.optional(v.number()),
    calfCm: v.optional(v.number()),
    shoulderCm: v.optional(v.number()),
    bodyFatPct: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const hasAny = Object.values(args).some((x) => typeof x === "number");
    if (!hasAny) throw new Error("Enter at least one measurement");

    const id = await ctx.db.insert("bodyMeasurements", {
      userId,
      date: today(),
      ...args,
      createdAt: Date.now(),
    });

    if (args.weightKg) {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      if (profile) await ctx.db.patch(profile._id, { weightKg: args.weightKg });
    }

    await ctx.runMutation(internal.services.memory.writeMemory, {
      userId,
      scope: "event",
      key: "physique_measurement",
      content: `Logged physique measurements${args.weightKg ? ` (weight ${args.weightKg}kg)` : ""}.`,
      source: "user_provided",
    });
    return id;
  },
});

/** Skip this week's check-in (never blocks the app) — pushes the due date. */
export const skipWeeklyCheckIn = mutation({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const journey = await getOrCreateJourney(ctx, userId);
    const base = journey.lastPhysiqueCheckIn ?? today();
    const days = args.days ?? 7;
    await ctx.db.patch(journey._id, {
      nextPhysiqueCheckInDue: addDays(base, days),
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});
