// Shared validators + types for the AI Fitness Engine domain.
// Part 1 of 4 — kept modular so Parts 2-4 (nutrition, supplements, admin)
// can add new files without touching this core.
import { v } from "convex/values";

export const GOALS = [
  "fat_loss",
  "muscle_gain",
  "lean_muscle",
  "strength",
  "body_recomposition",
  "general_fitness",
  "athletic_performance",
  "bodybuilding",
  "competition_preparation",
] as const;

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

export const goalValidator = v.union(
  v.literal("fat_loss"),
  v.literal("muscle_gain"),
  v.literal("lean_muscle"),
  v.literal("strength"),
  v.literal("body_recomposition"),
  v.literal("general_fitness"),
  v.literal("athletic_performance"),
  v.literal("bodybuilding"),
  v.literal("competition_preparation"),
);

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced", "competitive"] as const;
export const experienceValidator = v.union(
  v.literal("beginner"),
  v.literal("intermediate"),
  v.literal("advanced"),
  v.literal("competitive"),
);

export const INTENTS = [
  "fitness_question",
  "workout_question",
  "nutrition_question",
  "supplement_question",
  "product_question",
  "coaching_request",
  "progress_update",
  "goal_update",
  "competition_question",
  "general_conversation",
  "safety_sensitive",
  "unknown",
] as const;

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

export const intentValidator = v.union(
  v.literal("fitness_question"),
  v.literal("workout_question"),
  v.literal("nutrition_question"),
  v.literal("supplement_question"),
  v.literal("product_question"),
  v.literal("coaching_request"),
  v.literal("progress_update"),
  v.literal("goal_update"),
  v.literal("competition_question"),
  v.literal("general_conversation"),
  v.literal("safety_sensitive"),
  v.literal("unknown"),
);

export const MEMORY_SCOPES = ["short_term", "long_term", "event", "preference"] as const;

export type Goal = (typeof GOALS)[number];
export type Intent = (typeof INTENTS)[number];
