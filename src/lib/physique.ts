/** Client-side physique helpers (mirrors convex/services/physique.ts labels). */

export const PHYSIQUE_CATEGORY_LABELS: Record<string, string> = {
  lean: "Lean",
  athletic: "Athletic",
  muscular: "Muscular",
  average: "Average",
  higher_body_fat_appearance: "Higher body-fat appearance",
  muscle_building_focus: "Muscle-building focus",
  fat_loss_focus: "Fat-loss focus",
  recomposition_focus: "Recomposition focus",
  unknown: "Not enough information for a reliable physique estimate",
};

export const FITNESS_STAGES: Array<{ name: string; focus: string }> = [
  { name: "FOUNDATION", focus: "Build consistency and establish habits." },
  { name: "DEVELOPMENT", focus: "Progress strength, muscle and movement quality." },
  { name: "TRANSFORMATION", focus: "Adapt training and nutrition based on progress." },
  { name: "ADVANCED GOAL", focus: "Move toward your specific goal." },
];

/** The ~30s visual scan experience timeline (a presentation, not a measurement). */
export const SCAN_STAGES: Array<{ label: string; at: number }> = [
  { label: "INITIALIZING AI VISION", at: 0 },
  { label: "BODY OUTLINE DETECTION", at: 5 },
  { label: "UPPER BODY ANALYSIS", at: 10 },
  { label: "CORE / MIDSECTION ANALYSIS", at: 15 },
  { label: "LOWER BODY ANALYSIS", at: 20 },
  { label: "FITNESS PROFILE PROCESSING", at: 25 },
  { label: "GENERATING PERSONALIZED COACHING PLAN", at: 28 },
];

export const SCAN_DURATION_SEC = 30;

/** Weekly photo guidelines shown next to uploads. */
export const PHOTO_GUIDELINES = [
  "Similar lighting",
  "Similar camera distance",
  "Similar angle",
  "Similar background",
  "Full body from head to feet",
  "Natural standing position",
  "No filters",
  "Similar clothing when practical",
];

export const MEASUREMENT_FIELDS = [
  { key: "weightKg", label: "WEIGHT (KG)", step: "0.1" },
  { key: "neckCm", label: "NECK (CM)", step: "0.5" },
  { key: "chestCm", label: "CHEST (CM)", step: "0.5" },
  { key: "waistCm", label: "WAIST (CM)", step: "0.5" },
  { key: "abdomenCm", label: "ABDOMEN (CM)", step: "0.5" },
  { key: "hipsCm", label: "HIPS (CM)", step: "0.5" },
  { key: "armCm", label: "BICEPS (CM)", step: "0.5" },
  { key: "legCm", label: "THIGH (CM)", step: "0.5" },
  { key: "calfCm", label: "CALF (CM)", step: "0.5" },
] as const;
