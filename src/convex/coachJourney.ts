import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  buildMotivationDay,
  buildTodayMission,
  type CoachVoice,
  type JourneyStats,
  type MissionContext,
} from "./services/motivation";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Honorific used in welcome / confirmation / mission copy. */
export function coachTitleFor(name: string): string {
  const n = name.trim().toUpperCase();
  if (n === "RHEA" || n === "ATHENA") return "Ms.";
  if (n === "COACH PRIME") return "Coach";
  return "Mr.";
}

async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

type ResolvedCoach = {
  profile: Doc<"userProfiles"> | null;
  journey: Doc<"coachJourney"> | null;
  persona: Doc<"coachPersonas"> | null;
  coachTitle: string;
  userName: string;
  missionContext: MissionContext;
  stats: JourneyStats;
};

/**
 * Resolve everything the motivational journey needs from REAL data only.
 * No target, session or trend is invented — missing data simply yields
 * fewer mission lines / a generic (still honest) motivation line.
 */
async function resolveCoaching(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<ResolvedCoach> {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  const journey = await ctx.db
    .query("coachJourney")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  const personaId = journey?.selectedCoachId ?? profile?.coachPersonaId ?? undefined;
  const persona = personaId ? await ctx.db.get(personaId) : null;

  const goal = profile?.activeGoalId ? await ctx.db.get(profile.activeGoalId) : null;

  const sessions = await ctx.db
    .query("workoutSessions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(12);

  const today = todayStr();
  const mealPlan = await ctx.db
    .query("mealPlans")
    .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
    .first();

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const completedThisWeek = sessions.filter(
    (s) => s.status === "completed" && (s.completedAt ?? 0) >= weekAgo,
  ).length;
  const missedThisWeek = sessions.filter((s) => s.status === "skipped").length;
  const completedTotal = sessions.filter((s) => s.status === "completed").length;
  const adherence = sessions.length > 0 ? completedTotal / sessions.length : 0;

  // Real weight trend from logged measurements (omitted when we lack two points).
  let weightTrend: string | undefined;
  const measurements = (profile?.measurements ?? []).filter((m) => typeof m.weightKg === "number");
  if (measurements.length >= 2) {
    const diff = (measurements[measurements.length - 1].weightKg ?? 0) - (measurements[0].weightKg ?? 0);
    if (Math.abs(diff) >= 0.2) {
      weightTrend = `Your logged weight is ${diff < 0 ? "down" : "up"} ${Math.abs(diff).toFixed(1)}kg since your first check-in.`;
    }
  }

  const weekday = WEEKDAYS[new Date().getDay()];
  const trainingToday = profile?.training?.preferredDays?.includes(weekday) ?? false;
  const nextSession = sessions.find((s) => s.status === "scheduled" || s.status === "in_progress");

  const coachName = persona?.name ?? "";
  const userName = profile?.name ?? "athlete";

  const missionContext: MissionContext = {
    name: userName,
    coachName,
    coachTitle: coachName ? coachTitleFor(coachName) : "Coach",
    goal: goal?.goal ?? "general_fitness",
    experience: profile?.experience ?? "beginner",
    trainingToday,
    sessionName: nextSession?.name,
    calorieTarget: mealPlan?.targets.calories,
    proteinTarget: mealPlan?.targets.proteinG,
    waterLiters: mealPlan
      ? Math.round((mealPlan.targets.waterMl / 1000) * 10) / 10
      : profile?.lifestyle?.waterIntakeLiters,
    stepsTarget: profile?.lifestyle?.dailySteps,
  };

  return {
    profile,
    journey,
    persona,
    coachTitle: missionContext.coachTitle,
    userName,
    missionContext,
    stats: { completedThisWeek, missedThisWeek, adherence, weightTrend },
  };
}

function toCoachVoice(persona: Doc<"coachPersonas">): CoachVoice {
  return {
    slug: persona.slug,
    name: persona.name,
    role: persona.role,
    philosophy: persona.philosophy,
    expertise: persona.expertise,
  };
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

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

/**
 * One bundle for the whole personalized onboarding experience:
 * assigned coach, honorific, journey state, today's mission + focus,
 * and the current motivational day rendered in the coach's voice.
 */
export const getJourney = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const r = await resolveCoaching(ctx, userId);
    if (!r.persona) {
      return {
        hasCoach: false as const,
        userName: r.userName,
        coach: null,
        coachTitle: "Coach",
        journeyStarted: false,
        coachWelcomeShown: true,
        currentDay: 1,
        completedDays: [] as number[],
        todayMission: null,
        todayFocus: null,
        motivationDay: null,
        checkInMessage: null,
        lastCheckIn: null,
      };
    }

    const voice = toCoachVoice(r.persona);
    const day = r.journey?.currentMotivationDay ?? 1;
    const motivationDay = buildMotivationDay({
      day,
      coach: voice,
      missionContext: r.missionContext,
      stats: r.stats,
    });
    const mission = buildTodayMission(r.missionContext);

    return {
      hasCoach: true as const,
      userName: r.userName,
      coach: {
        _id: r.persona._id,
        name: r.persona.name,
        slug: r.persona.slug,
        role: r.persona.role,
        philosophy: r.persona.philosophy,
        expertise: r.persona.expertise,
      },
      coachTitle: r.coachTitle,
      coachAssignedAt: r.journey?.coachAssignedAt ?? null,
      journeyStarted: r.journey?.journeyStarted ?? false,
      coachWelcomeShown: r.journey?.coachWelcomeShown ?? false,
      currentDay: day,
      completedDays: r.journey?.completedMotivationDays ?? [],
      todayMission: r.journey?.todayMission ?? null,
      todayFocus: mission.focus,
      motivationDay,
      checkInMessage: r.stats,
      lastCheckIn: r.journey?.lastCoachCheckIn ?? null,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

/**
 * Assign / switch the user's AI coach. Idempotent:
 *  - one coachAssignments row per user (updated, never duplicated)
 *  - coachJourney.selectedCoachId is the source of truth
 *  - previous coaches are appended to coachHistory (history is preserved)
 *  - coaching, workout, nutrition and progress history is NEVER touched
 */
export const assignCoach = mutation({
  args: { personaId: v.id("coachPersonas") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const persona = await ctx.db.get(args.personaId);
    if (!persona || !persona.isActive) throw new Error("Unknown coach");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("Complete onboarding first");
    await ctx.db.patch(profile._id, { coachPersonaId: args.personaId });

    const existingAssignment = await ctx.db
      .query("coachAssignments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const now = Date.now();
    if (existingAssignment) {
      await ctx.db.patch(existingAssignment._id, { personaId: args.personaId, assignedAt: now });
    } else {
      await ctx.db.insert("coachAssignments", {
        userId,
        personaId: args.personaId,
        assignedAt: now,
      });
    }

    const journey = await getOrCreateJourney(ctx, userId);
    const previousId = journey.selectedCoachId;
    let history = journey.coachHistory;
    if (previousId && previousId !== args.personaId) {
      history = [
        ...history,
        { personaId: previousId, assignedAt: journey.coachAssignedAt ?? now, until: now },
      ].slice(-12);
    }

    await ctx.db.patch(journey._id, {
      selectedCoachId: args.personaId,
      coachAssignedAt: now,
      coachHistory: history,
      // One-time first-assignment banner is preserved across switches.
      coachWelcomeShown: journey.coachWelcomeShown,
      updatedAt: now,
    });

    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: previousId && previousId !== args.personaId ? "coach_changed" : "coach_assigned",
      detail: persona.name,
    });

    return {
      personaId: args.personaId,
      name: persona.name,
      coachTitle: coachTitleFor(persona.name),
      isChange: Boolean(previousId && previousId !== args.personaId),
    };
  },
});

/** Mark the one-time "COACH ASSIGNED" first-time banner as shown. */
export const markCoachWelcomeShown = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const journey = await getOrCreateJourney(ctx, userId);
    if (!journey.coachWelcomeShown) {
      await ctx.db.patch(journey._id, { coachWelcomeShown: true, updatedAt: Date.now() });
    }
    return { ok: true };
  },
});

/**
 * Start the motivational journey. Idempotent: an already-started journey is
 * never reset (day, completed days and mission are preserved).
 */
export const startJourney = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const r = await resolveCoaching(ctx, userId);
    if (!r.persona) throw new Error("Choose an AI coach first");

    const journey = await getOrCreateJourney(ctx, userId);
    const now = Date.now();

    if (journey.journeyStarted && journey.selectedCoachId === r.persona._id) {
      // Already running — refresh today's mission but never roll progress back.
      const mission = buildTodayMission(r.missionContext);
      await ctx.db.patch(journey._id, {
        todayMission: { date: todayStr(), focus: mission.focus, items: mission.items },
        lastCoachCheckIn: todayStr(),
        updatedAt: now,
      });
      return { day: journey.currentMotivationDay, resumed: true };
    }

    const mission = buildTodayMission(r.missionContext);
    await ctx.db.patch(journey._id, {
      selectedCoachId: r.persona._id,
      coachAssignedAt: journey.coachAssignedAt ?? now,
      motivationCourseId: journey.motivationCourseId ?? `journey_${r.persona.slug}`,
      journeyStarted: true,
      currentMotivationDay: journey.journeyStarted ? journey.currentMotivationDay : 1,
      todayMission: { date: todayStr(), focus: mission.focus, items: mission.items },
      lastCoachCheckIn: todayStr(),
      updatedAt: now,
    });

    await ctx.runMutation(internal.services.memory.writeMemory, {
      userId,
      scope: "event",
      key: "journey_started",
      content: `Motivational journey started with ${r.persona.name}.`,
      source: "system_data",
    });

    return { day: journey.journeyStarted ? journey.currentMotivationDay : 1, resumed: false };
  },
});

/**
 * Complete today's mission (explicit user action — never inferred) and advance
 * to the next day. Advancing is idempotent: a day is only appended once.
 */
export const completeTodayMission = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const r = await resolveCoaching(ctx, userId);
    if (!r.persona) throw new Error("Choose an AI coach first");

    const journey = await getOrCreateJourney(ctx, userId);
    const completedDay = journey.currentMotivationDay;
    const nextDay = completedDay + 1;
    const now = Date.now();

    const completedDays = journey.completedMotivationDays.includes(completedDay)
      ? journey.completedMotivationDays
      : [...journey.completedMotivationDays, completedDay].sort((a, b) => a - b);

    const mission = buildTodayMission(r.missionContext);
    await ctx.db.patch(journey._id, {
      journeyStarted: true,
      currentMotivationDay: nextDay,
      completedMotivationDays: completedDays,
      todayMission: { date: todayStr(), focus: mission.focus, items: mission.items },
      lastCoachCheckIn: todayStr(),
      updatedAt: now,
    });

    await ctx.runMutation(internal.services.memory.writeMemory, {
      userId,
      scope: "event",
      key: "mission_completed",
      content: `Completed motivational day ${completedDay} (${r.persona.name}).`,
      source: "user_provided",
    });
    await ctx.runMutation(internal.services.memory.createNotification, {
      userId,
      type: "journey",
      title: `Day ${completedDay} complete`,
      body: `You completed day ${completedDay}. Day ${nextDay} is ready.`,
    });

    return { completedDay, nextDay };
  },
});

/** Refresh today's mission from real plan data (called on page mount). */
export const refreshToday = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const r = await resolveCoaching(ctx, userId);
    if (!r.persona) return { ok: false };

    const journey = await getOrCreateJourney(ctx, userId);
    const mission = buildTodayMission(r.missionContext);
    const stale =
      !journey.todayMission || journey.todayMission.date !== todayStr();
    if (stale) {
      await ctx.db.patch(journey._id, {
        todayMission: { date: todayStr(), focus: mission.focus, items: mission.items },
        lastCoachCheckIn: todayStr(),
        updatedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});
