// MotivationalJourneyService — a STRUCTURED, day-by-day coaching journey.
//
// Everything here is derived from real user + plan data passed in by the caller
// (coachJourney.ts reads the DB and hands over the facts). Nothing is fabricated:
// if a target or session does not exist, its mission line is simply omitted.
//
// The course runs Day 1..7 on a fixed curriculum and then continues in cycles,
// delivered in the selected coach's personality. Language is deliberately
// non-shaming and safety-first.

export type CoachVoice = {
  slug: string;
  name: string;
  role: string;
  philosophy: string;
  expertise: string[];
};

/** Facts the caller resolves from the user's real profile, plan and logs. */
export type MissionContext = {
  name: string;
  coachName: string;
  coachTitle: string; // "Mr." | "Ms." | "Coach"
  goal: string;
  experience: string;
  trainingToday: boolean;
  sessionName?: string;
  calorieTarget?: number;
  proteinTarget?: number;
  waterLiters?: number;
  stepsTarget?: number;
};

export type JourneyStats = {
  completedThisWeek: number;
  missedThisWeek: number;
  adherence: number; // 0..1 across recent planned sessions
  weightTrend?: string; // only when real measurements exist
};

export type MotivationDayContent = {
  day: number;
  cycle: number;
  phase: string;
  title: string;
  coachIntro: string;
  lesson: string;
  mission: string[];
  motivation: string;
  focus: string;
};

/* ------------------------------------------------------------------ */
/* Persona voice — same coach slug, different delivery.                */
/* ------------------------------------------------------------------ */

type VoiceNoun = { push: string; anchor: string };

const VOICE: Record<string, VoiceNoun> = {
  arjun: {
    push: "Strength is built on numbers and repeatable effort — not wishes.",
    anchor: "Add a little weight or a rep where you can, and log it.",
  },
  veer: {
    push: "Fat loss is a system, not a sprint. We keep it sustainable.",
    anchor: "Protein first, daily movement, no extremes.",
  },
  aarav: {
    push: "Adherence beats perfection. Today's food is today's fuel.",
    anchor: "Build the meal around protein, then fill with foods you actually eat.",
  },
  kabir: {
    push: "Every set has a target muscle and a tempo. Spend your volume where it counts.",
    anchor: "Feel the muscle working — quality beats ego.",
  },
  rhea: {
    push: "Strength training is for everyone. Capability first, aesthetics follow.",
    anchor: "Respect your energy today and train with intent.",
  },
  rudra: {
    push: "This is project management: checkpoints, backups, no crash protocols.",
    anchor: "Hit the checkpoint, stay structured, avoid extremes.",
  },
  max: {
    push: "Consistency first, intensity later. A workout done beats a perfect plan skipped.",
    anchor: "Keep it simple — one small step you can repeat tomorrow.",
  },
  athena: {
    push: "Food, sleep and training come first. Supplements are the last 2%.",
    anchor: "Stay evidence-aware and skip the marketing noise.",
  },
  coach_prime: {
    push: "Training, food, sleep and stress are one system — fix the weakest link first.",
    anchor: "Improve the weakest link today, not everything at once.",
  },
};

function voiceFor(slug: string): VoiceNoun {
  return VOICE[slug] ?? {
    push: "Progress comes from repeatable days, not perfect ones.",
    anchor: "Do today's work well and let consistency compound.",
  };
}

function personaLine(coach: CoachVoice, name: string): string {
  const v = voiceFor(coach.slug);
  return `${name}, I'm your ${coach.role.toLowerCase()}. ${v.push}`;
}

/* ------------------------------------------------------------------ */
/* Daily mission — only real targets become lines.                     */
/* ------------------------------------------------------------------ */

export function buildTodayMission(ctx: MissionContext): { focus: string; items: string[] } {
  const items: string[] = [];

  if (ctx.sessionName) {
    items.push(`Complete your planned workout — ${ctx.sessionName}`);
  } else if (ctx.trainingToday) {
    items.push("Complete your planned workout");
  } else {
    items.push("Stay active on your rest day — light movement or mobility");
  }

  if (ctx.calorieTarget != null && ctx.proteinTarget != null) {
    items.push(`Follow today's nutrition target (${ctx.calorieTarget} kcal · ${ctx.proteinTarget}g protein)`);
  } else if (ctx.proteinTarget != null) {
    items.push(`Hit your protein target (${ctx.proteinTarget}g)`);
  } else {
    items.push("Follow today's nutrition plan");
  }

  if (ctx.waterLiters != null) items.push(`Drink your planned water (${ctx.waterLiters}L)`);
  if (ctx.stepsTarget != null) items.push(`Reach your movement target (${ctx.stepsTarget} steps)`);

  items.push(`Check in with ${ctx.coachTitle} ${ctx.coachName} after completing the day`);

  const focus = ctx.sessionName ?? (ctx.trainingToday ? "TRAIN AS PLANNED" : "BUILD YOUR MOMENTUM");
  return { focus: focus.toUpperCase(), items };
}

/* ------------------------------------------------------------------ */
/* Adaptive motivation — driven by real adherence, never shaming.      */
/* ------------------------------------------------------------------ */

export function buildAdaptiveMessage(input: {
  name: string;
  coachName: string;
  coachTitle: string;
  completedThisWeek: number;
  missedThisWeek: number;
  adherence: number;
  weightTrend?: string;
}): string {
  const { name, completedThisWeek, missedThisWeek, adherence, weightTrend } = input;

  if (missedThisWeek >= 2) {
    return `${name}, you missed ${missedThisWeek} planned sessions recently. Let's reset today. You don't need to make up everything at once — just complete today's session and we rebuild from there.`;
  }
  if (completedThisWeek >= 3 && adherence >= 0.7) {
    const trend = weightTrend ? ` ${weightTrend}` : "";
    return `${name}, you've completed ${completedThisWeek} sessions this week. That's consistency — keep going.${trend}`;
  }
  if (completedThisWeek >= 1) {
    return `${name}, you're moving: ${completedThisWeek} session${completedThisWeek === 1 ? "" : "s"} logged this week. Let's stack another one today.`;
  }
  if (adherence > 0) {
    return `${name}, your recent progress is moving in the direction of your goal. Let's keep the same consistency today.`;
  }
  return `${name}, today is day one of the habit. Show up once and we build from there.`;
}

/* ------------------------------------------------------------------ */
/* The 7-day curriculum (cycles continue beyond day 7).                */
/* ------------------------------------------------------------------ */

type Theme = {
  phase: string;
  title: string;
  lead: string;
  lesson: string;
  motivation: string;
};

const THEMES: Theme[] = [
  {
    phase: "START",
    title: "YOUR FITNESS JOURNEY STARTS TODAY",
    lead: "Before we chase results, we build the mindset and commitment that carry them.",
    lesson:
      "You don't need to become perfect today. You only need to start. One completed day becomes two, and two becomes a habit.",
    motivation: "One completed day becomes two. Two becomes a habit. Let's build it together.",
  },
  {
    phase: "CONSISTENCY",
    title: "BUILD THE HABIT",
    lead: "Motivation is a mood; consistency is a decision. Today we make the decision repeatable.",
    lesson:
      "Your plan works when it happens often enough to matter. Same time, same structure, no negotiation with yourself.",
    motivation: "You don't have to feel like it. You just have to show up — that's the whole trick.",
  },
  {
    phase: "DISCIPLINE",
    title: "DO THE WORK EVEN WHEN MOTIVATION IS LOW",
    lead: "Low-motivation days are where progress is quietly made.",
    lesson:
      "On a hard day, do the minimum version of the plan — a shorter session, a simpler meal. Never nothing.",
    motivation: "Discipline is doing it on the day you least feel like it. That day counts double.",
  },
  {
    phase: "NUTRITION",
    title: "WHY TODAY'S NUTRITION MATTERS",
    lead: "Training builds the signal; food and recovery build the result.",
    lesson:
      "Anchor today's meals around protein and your target intake. Consistency across the week beats one perfect day.",
    motivation: "Food isn't the reward for training — it's half the training itself.",
  },
  {
    phase: "TRAINING",
    title: "FOCUS ON WORKOUT QUALITY",
    lead: "Today is about the quality of the work, not the size of the effort.",
    lesson:
      "Control the tempo, hit the target muscles, log your sets. Good reps today are stronger reps next week.",
    motivation: "One honest set is worth more than three rushed ones.",
  },
  {
    phase: "RECOVERY",
    title: "SLEEP, RECOVERY & PREPARATION",
    lead: "Recovery is where the adaptation actually happens.",
    lesson:
      "Protect your sleep, hydrate, and prepare tomorrow's session and meals in advance so the day runs itself.",
    motivation: "You don't grow in the workout — you grow in the recovery that follows it.",
  },
  {
    phase: "WEEKLY REVIEW",
    title: "REVIEW PROGRESS & PREPARE NEXT WEEK",
    lead: "Look back honestly, then set up the next week to be better.",
    lesson:
      "Count what you actually completed, note what got in the way, and choose one improvement for next week.",
    motivation: "A week reviewed is a week that compounds. Let's set up the next one.",
  },
];

export function buildMotivationDay(input: {
  day: number;
  coach: CoachVoice;
  missionContext: MissionContext;
  stats: JourneyStats;
}): MotivationDayContent {
  const { coach, missionContext, stats } = input;
  const day = Math.max(1, Math.floor(input.day));
  const index = (day - 1) % THEMES.length;
  const cycle = Math.floor((day - 1) / THEMES.length) + 1;
  const theme = THEMES[index];
  const voice = voiceFor(coach.slug);

  const { focus, items } = buildTodayMission(missionContext);

  const cycleNote =
    cycle > 1
      ? `This is cycle ${cycle} of the journey — same principles, higher standard.`
      : "";

  const coachIntro = [
    personaLine(coach, missionContext.name),
    theme.lead,
    cycleNote,
    voice.anchor,
  ]
    .filter(Boolean)
    .join(" ");

  const motivation = [
    buildAdaptiveMessage({
      name: missionContext.name,
      coachName: missionContext.coachName,
      coachTitle: missionContext.coachTitle,
      completedThisWeek: stats.completedThisWeek,
      missedThisWeek: stats.missedThisWeek,
      adherence: stats.adherence,
      weightTrend: stats.weightTrend,
    }),
    theme.motivation,
  ].join(" ");

  return {
    day,
    cycle,
    phase: theme.phase,
    title: theme.title,
    coachIntro,
    lesson: theme.lesson,
    mission: items,
    motivation,
    focus,
  };
}
