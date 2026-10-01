export const GOAL_LABELS: Record<string, string> = {
  fat_loss: "Fat loss",
  muscle_gain: "Muscle gain",
  lean_muscle: "Lean muscle",
  strength: "Strength",
  body_recomposition: "Body recomposition",
  general_fitness: "General fitness",
  athletic_performance: "Athletic performance",
  bodybuilding: "Bodybuilding",
  competition_preparation: "Competition preparation",
};

export const INTENT_LABELS: Record<string, string> = {
  fitness_question: "Fitness question",
  workout_question: "Workout question",
  nutrition_question: "Nutrition question",
  supplement_question: "Supplement question",
  product_question: "Product question",
  coaching_request: "Coaching request",
  progress_update: "Progress update",
  goal_update: "Goal update",
  competition_question: "Competition question",
  general_conversation: "General conversation",
  safety_sensitive: "Safety-sensitive request",
  unknown: "Unknown",
};

// Client-side category/verdict labels for the Part 3 modules.
// Mirrors src/convex/services/supplements.ts (which cannot be imported client-side).

export const CATEGORY_LABELS: Record<string, string> = {
  whey_protein: "Whey protein",
  mass_gainer: "Mass gainer",
  creatine: "Creatine",
  pre_workout: "Pre-workout",
  bcaa: "BCAA",
  eaa: "EAA",
  electrolytes: "Electrolytes",
  vitamins: "Vitamins",
  minerals: "Minerals",
  protein_blend: "Protein blend",
  other_sports_nutrition: "Other sports nutrition",
};

export const VERDICT_TONE: Record<
  string,
  { tone: "ok" | "warn" | "info" | "ink"; short: string }
> = {
  "VERIFIED BY AVAILABLE EVIDENCE": { tone: "ok", short: "VERIFIED (EVIDENCE)" },
  "EVIDENCE APPEARS CONSISTENT": { tone: "info", short: "CONSISTENT" },
  "VERIFICATION INCOMPLETE": { tone: "ink", short: "INCOMPLETE" },
  "POTENTIAL RED FLAGS": { tone: "warn", short: "RED FLAGS" },
  "UNABLE TO VERIFY": { tone: "warn", short: "UNABLE TO VERIFY" },
};

export const REPORT_KINDS: Array<{ kind: string; label: string; description: string }> = [
  { kind: "weekly", label: "WEEKLY", description: "Last 7 days — training, nutrition, recovery" },
  { kind: "monthly", label: "MONTHLY", description: "Last 30 days — full engine-recorded summary" },
  { kind: "progress", label: "PROGRESS", description: "Measurements and body-weight trend" },
  { kind: "workout", label: "WORKOUT", description: "Sessions, adherence and load feedback" },
  { kind: "nutrition", label: "NUTRITION", description: "Logged meals, protein and water" },
  { kind: "competition", label: "COMPETITION", description: "Contest-prep tracking (Competition plan)" },
];

export const KNOWLEDGE_CATEGORIES = [
  "fitness",
  "nutrition",
  "faq",
  "product",
  "brand",
  "coaching_method",
  "business_policy",
] as const;

export const LEAD_LABELS: Record<string, string> = {
  cold: "COLD",
  warm: "WARM",
  interested: "INTERESTED",
  high_intent: "HIGH INTENT",
};
