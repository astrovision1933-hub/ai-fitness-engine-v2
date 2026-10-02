// PhysiqueService — cautious, fitness-oriented physique assessment.
//
// TRUTH RULES (enforced here):
//  • No exact body-fat / muscle-mass figures are ever derived from a photo.
//  • Nothing is fabricated — every "measured" line comes from real profile or
//    measurement data; missing data is simply omitted.
//  • Output is split into USER-PROVIDED / MEASURED / ESTIMATE / OBSERVATION /
//    RECOMMENDATION so the UI can label each claim honestly.
//  • No medical diagnosis, no unsafe protocols.

export const STAGES = [
  { name: "FOUNDATION", focus: "Build consistency and establish habits." },
  { name: "DEVELOPMENT", focus: "Progress strength, muscle and movement quality." },
  { name: "TRANSFORMATION", focus: "Adapt training and nutrition based on progress." },
  { name: "ADVANCED GOAL", focus: "Move toward your specific goal." },
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
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

export type MeasurementEntry = {
  date: string;
  weightKg?: number;
  waistCm?: number;
  chestCm?: number;
  armCm?: number;
  legCm?: number;
  shoulderCm?: number;
  neckCm?: number;
  abdomenCm?: number;
  hipsCm?: number;
  calfCm?: number;
  bodyFatPct?: number;
};

export type PhysiqueInput = {
  name: string;
  sex?: string;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  goal: string;
  experience: string;
  trainingDays?: number;
  dietType?: string;
  dailyActivity?: string;
  sleepHours?: number;
  stepsTarget?: number;
  userDescription?: string;
  hasPhoto: boolean;
  measurement?: MeasurementEntry;
  adherence: number;
  completedThisWeek: number;
  competitionDate?: string;
};

export type AreaNote = { area: string; note: string; group: "priority" | "develop" | "maintain" };

export type PhysiqueAssessment = {
  physiqueCategory: string;
  categoryRationale: string;
  insufficient: boolean;
  priorityAreas: string[];
  areasToDevelop: string[];
  areasToMaintain: string[];
  areaNotes: AreaNote[];
  fitnessStageIndex: number;
  fitnessStageName: string;
  trainingFocus: string[];
  nutritionFocus: string[];
  recoveryFocus: string[];
  userProvided: string[];
  measured: string[];
  estimates: string[];
  observations: string[];
  recommendations: string[];
};

/* ------------------------------------------------------------------ */
/* Area detection from the user's own words (never from the photo)     */
/* ------------------------------------------------------------------ */

const AREA_KEYWORDS: Array<{ area: string; note: string; words: string[] }> = [
  { area: "Midsection", note: "Common fat-storage area — responds to a consistent deficit plus core work.", words: ["belly", "midsection", "abdomen", "stomach", "tummy", "waist", "love handle"] },
  { area: "Upper chest", note: "Often underdeveloped relative to the mid-chest — prioritize incline pressing.", words: ["chest", "pec"] },
  { area: "Side delts", note: "Adds shoulder width — lateral raises with controlled tempo.", words: ["shoulder", "delt"] },
  { area: "Back width", note: "Builds the V-taper — vertical pulling and rowing volume.", words: ["back", "lat", "v-taper"] },
  { area: "Arms", note: "Grows with direct biceps/triceps work and enough weekly volume.", words: ["arm", "bicep", "tricep"] },
  { area: "Lower body", note: "Squat/hinge patterns drive strength and shape.", words: ["leg", "thigh", "glute", "quad", "hamstring", "calf"] },
  { area: "Neck / posture", note: "Posture work and upper-back training support appearance.", words: ["neck", "posture", "hunch"] },
];

function detectAreas(description: string | undefined, goal: string): AreaNote[] {
  const text = (description ?? "").toLowerCase();
  const found: AreaNote[] = [];
  for (const entry of AREA_KEYWORDS) {
    if (entry.words.some((w) => text.includes(w))) {
      found.push({ area: entry.area, note: entry.note, group: "priority" });
    }
  }
  if (found.length > 0) return found;

  // No description → derive a conservative default set from the goal only.
  const defaults: Record<string, string[]> = {
    fat_loss: ["Midsection", "Lower body", "Back width"],
    muscle_gain: ["Upper chest", "Back width", "Side delts"],
    lean_muscle: ["Upper chest", "Side delts", "Arms"],
    strength: ["Lower body", "Back width", "Midsection"],
    body_recomposition: ["Midsection", "Upper chest", "Lower body"],
    general_fitness: ["Midsection", "Lower body"],
    athletic_performance: ["Lower body", "Midsection", "Back width"],
    bodybuilding: ["Upper chest", "Side delts", "Back width", "Arms", "Lower body"],
    competition_preparation: ["Back width", "Side delts", "Lower body", "Midsection"],
  };
  const list = defaults[goal] ?? ["Midsection", "Lower body"];
  return list.map((area) => {
    const meta = AREA_KEYWORDS.find((a) => a.area === area);
    return { area, note: meta?.note ?? "Balanced development supports your goal.", group: "priority" as const };
  });
}

/* ------------------------------------------------------------------ */
/* Category — conservative, and honest about insufficient information  */
/* ------------------------------------------------------------------ */

function chooseCategory(input: PhysiqueInput, hasDescription: boolean): { category: string; rationale: string; insufficient: boolean } {
  const bmi =
    input.weightKg && input.heightCm
      ? input.weightKg / (input.heightCm / 100) ** 2
      : null;
  const text = (input.userDescription ?? "").toLowerCase();

  // Explicit focus categories are safe to state from the goal alone.
  if (!hasDescription && !input.measurement && !input.hasPhoto) {
    if (input.goal === "fat_loss") return { category: "fat_loss_focus", rationale: "Derived from your stated goal (fat loss).", insufficient: false };
    if (input.goal === "muscle_gain" || input.goal === "bodybuilding")
      return { category: "muscle_building_focus", rationale: "Derived from your stated goal (muscle/building).", insufficient: false };
    if (input.goal === "body_recomposition")
      return { category: "recomposition_focus", rationale: "Derived from your stated goal (recomposition).", insufficient: false };
    return { category: "unknown", rationale: "No physique photo or description was provided.", insufficient: true };
  }

  // Described-lean / muscular signals.
  if (/(skinny|thin|slim|underweight)/.test(text))
    return { category: "muscle_building_focus", rationale: "Based on the description you provided.", insufficient: false };
  if (/(muscular|built|athletic)/.test(text))
    return { category: "muscular", rationale: "Based on the description you provided.", insufficient: false };
  if (/(lean|abs visible|defined)/.test(text))
    return { category: "lean", rationale: "Based on the description you provided.", insufficient: false };

  if (bmi !== null) {
    if (bmi < 20) return { category: "lean", rationale: "Estimated from your height and weight (BMI-based indicator, not a diagnosis).", insufficient: false };
    if (bmi < 25) return { category: "average", rationale: "Estimated from your height and weight (BMI-based indicator, not a diagnosis).", insufficient: false };
    if (bmi < 30) return { category: "higher_body_fat_appearance", rationale: "Estimated from your height and weight (BMI-based indicator, not a diagnosis).", insufficient: false };
    return { category: "higher_body_fat_appearance", rationale: "Estimated from height/weight plus a photo or description. This is approximate, not a diagnosis.", insufficient: false };
  }

  return { category: "average", rationale: "Based on the information provided.", insufficient: false };
}

/* ------------------------------------------------------------------ */
/* Fitness stage                                                       */
/* ------------------------------------------------------------------ */

function chooseStage(input: PhysiqueInput): number {
  if (input.goal === "competition_preparation" || input.experience === "competitive") return 3;
  if (input.experience === "advanced") return input.adherence >= 0.6 ? 3 : 2;
  if (input.experience === "intermediate") return input.adherence >= 0.7 ? 2 : 1;
  // beginner
  if (input.adherence >= 0.6 && input.completedThisWeek >= (input.trainingDays ?? 3) * 0.6) return 1;
  return 0;
}

/* ------------------------------------------------------------------ */
/* Main builder                                                        */
/* ------------------------------------------------------------------ */

export function buildPhysiqueAssessment(input: PhysiqueInput): PhysiqueAssessment {
  const hasDescription = Boolean(input.userDescription && input.userDescription.trim().length > 0);
  const { category, rationale, insufficient } = chooseCategory(input, hasDescription);

  const areaNotes = detectAreas(input.userDescription, input.goal);
  const priorityAreas = areaNotes.slice(0, 5).map((a) => a.area);
  const areasToDevelop = priorityAreas.slice(0, 3);
  const areasToMaintain = maintainAreas(input);

  const stageIndex = chooseStage(input);
  const stage = STAGES[stageIndex];

  const userProvided: string[] = [];
  if (hasDescription) userProvided.push(`Your description: "${input.userDescription!.trim()}"`);
  if (input.dietType) userProvided.push(`Diet preference: ${input.dietType}`);
  if (input.trainingDays) userProvided.push(`Training: ${input.trainingDays} days/week`);

  const measured: string[] = [];
  const m = input.measurement;
  if (m) {
    if (m.weightKg != null) measured.push(`Weight: ${m.weightKg} kg (USER-PROVIDED MEASUREMENT)`);
    if (m.waistCm != null) measured.push(`Waist: ${m.waistCm} cm (USER-PROVIDED MEASUREMENT)`);
    if (m.chestCm != null) measured.push(`Chest: ${m.chestCm} cm (USER-PROVIDED MEASUREMENT)`);
    if (m.armCm != null) measured.push(`Arm: ${m.armCm} cm (USER-PROVIDED MEASUREMENT)`);
    if (m.legCm != null) measured.push(`Thigh: ${m.legCm} cm (USER-PROVIDED MEASUREMENT)`);
    if (m.shoulderCm != null) measured.push(`Shoulders: ${m.shoulderCm} cm (USER-PROVIDED MEASUREMENT)`);
    if (m.neckCm != null) measured.push(`Neck: ${m.neckCm} cm (USER-PROVIDED MEASUREMENT)`);
    if (m.abdomenCm != null) measured.push(`Abdomen: ${m.abdomenCm} cm (USER-PROVIDED MEASUREMENT)`);
    if (m.hipsCm != null) measured.push(`Hips: ${m.hipsCm} cm (USER-PROVIDED MEASUREMENT)`);
    if (m.calfCm != null) measured.push(`Calf: ${m.calfCm} cm (USER-PROVIDED MEASUREMENT)`);
    if (m.bodyFatPct != null) measured.push(`Body-fat: ${m.bodyFatPct}% (USER-PROVIDED MEASUREMENT)`);
  } else if (input.weightKg != null) {
    measured.push(`Weight: ${input.weightKg} kg (USER-PROVIDED)`);
  }
  if (input.heightCm != null) measured.push(`Height: ${input.heightCm} cm (USER-PROVIDED)`);

  const estimates: string[] = [];
  if (input.weightKg && input.heightCm) {
    const bmi = Number((input.weightKg / (input.heightCm / 100) ** 2).toFixed(1));
    estimates.push(`BMI: ${bmi} — a height/weight indicator only, not a body-fat measurement (ESTIMATE)`);
  }
  estimates.push("Body-fat percentage and muscle mass cannot be measured accurately from a single photo (NOT ESTIMATED)");

  const observations: string[] = [];
  if (input.hasPhoto) {
    observations.push(
      "Your physique photo is stored privately as your baseline for visual progress comparison over time.",
    );
    observations.push(
      "No automated medical or exact-body-composition analysis is performed on photos — comparisons are visual and approximate.",
    );
  } else {
    observations.push("No physique photo was provided — this assessment uses your profile and description only.");
  }
  if (hasDescription) {
    observations.push(`You reported focus areas around: ${priorityAreas.slice(0, 3).join(", ")}.`);
  }

  const trainingFocus = trainingFocusFor(input.goal);
  const nutritionFocus = nutritionFocusFor(input.goal, input.dietType);
  const recoveryFocus = recoveryFocusFor(input);

  const recommendations: string[] = [
    `Current fitness stage: ${stage.name} — ${stage.focus}`,
    "Log a photo and measurements on the same day each week for the most useful comparison.",
  ];
  if ((input.sleepHours ?? 8) < 7) recommendations.push("Aim to raise sleep toward 7–8 hours — it supports recovery and appetite control.");
  if (input.dailyActivity === "sedentary") recommendations.push("Add a daily walk target to raise activity outside training.");
  if (measured.length === 0) recommendations.push("Add waist and weight measurements for measurable progress tracking.");

  return {
    physiqueCategory: category,
    categoryRationale: rationale,
    insufficient,
    priorityAreas,
    areasToDevelop,
    areasToMaintain,
    areaNotes,
    fitnessStageIndex: stageIndex,
    fitnessStageName: stage.name,
    trainingFocus,
    nutritionFocus,
    recoveryFocus,
    userProvided,
    measured,
    estimates,
    observations,
    recommendations,
  };
}

function maintainAreas(input: PhysiqueInput): string[] {
  if (input.goal === "fat_loss") return ["Strength on main lifts", "Protein intake", "Training consistency"];
  if (input.goal === "muscle_gain" || input.goal === "bodybuilding") return ["Training consistency", "Sleep and recovery", "Protein intake"];
  return ["Training consistency", "Daily movement", "Sleep"];
}

function trainingFocusFor(goal: string): string[] {
  switch (goal) {
    case "fat_loss":
      return ["Full-body strength 3–4x/week", "Daily movement target", "Progressive overload maintained"];
    case "muscle_gain":
    case "bodybuilding":
      return ["Push/Pull/Legs or Upper/Lower split", "Progressive overload on main lifts", "Direct work for priority areas"];
    case "lean_muscle":
      return ["Strength + hypertrophy blend", "Moderate volume with high effort", "Consistent weekly progression"];
    case "strength":
      return ["Squat / bench / deadlift focus", "Heavy top sets + back-off work", "Technique before load"];
    case "athletic_performance":
      return ["Strength base plus conditioning", "Power and speed work", "Mobility and movement quality"];
    case "competition_preparation":
      return ["Structured periodized plan", "Checkpoint-driven progression", "No crash protocols — gradual changes only"];
    case "body_recomposition":
      return ["Strength training with adequate volume", "Moderate deficit + high protein", "Track weekly"];
    default:
      return ["Full-body training 3x/week", "Consistency over intensity", "Gradual progression"];
  }
}

function nutritionFocusFor(goal: string, dietType?: string): string[] {
  const protein = "Protein at every meal";
  const base: Record<string, string[]> = {
    fat_loss: ["Moderate, sustainable deficit", protein, "High-volume, high-fibre foods"],
    muscle_gain: ["Small calorie surplus", protein, "Carbs around training"],
    lean_muscle: ["Slight surplus", protein, "Consistent meal timing"],
    strength: ["Enough calories to fuel heavy sessions", protein, "Adequate carbs for performance"],
    athletic_performance: ["Fuel training and recovery", protein, "Hydration and electrolytes"],
    body_recomposition: ["Maintenance calories", protein, "Whole-food focus"],
    bodybuilding: ["Structured surplus or maintenance by phase", protein, "Consistent daily intake"],
    competition_preparation: ["Planned, gradual adjustments", protein, "No crash dieting — professional guidance for peak week"],
    general_fitness: ["Balanced meals", protein, "Regular hydration"],
  };
  const list = base[goal] ?? base.general_fitness;
  return dietType ? [...list, `Respect your ${dietType} pattern`] : list;
}

function recoveryFocusFor(input: PhysiqueInput): string[] {
  const list = ["Sleep 7–8 hours where possible", "At least one full rest day per week", "Manage stress around training"];
  if ((input.sleepHours ?? 8) < 7) list.unshift("Prioritize sleep — currently below 7 hours");
  if (input.dailyActivity === "sedentary") list.push("Light daily walking as active recovery");
  return list;
}

/* ------------------------------------------------------------------ */
/* Weekly comparison                                                   */
/* ------------------------------------------------------------------ */

export type WeeklyComparison = {
  observations: string[];
  measurements: string[];
  hasMeasuredChange: boolean;
  physiqueChange: string;
  uncertaintyNote: string;
  whatsWorking: string[];
  whatsToImprove: string[];
  nextFocus: string[];
};

export function buildWeeklyComparison(input: {
  previousDate: string;
  currentDate: string;
  previousMeasurement?: MeasurementEntry;
  currentMeasurement?: MeasurementEntry;
  previousCategory?: string;
  currentCategory?: string;
  workoutAdherence: number;
  nutritionAdherence: number;
  completedThisWeek: number;
  plannedPerWeek: number;
}): WeeklyComparison {
  const observations = [
    "Visual comparison is approximate and can be affected by lighting, camera angle, distance, clothing and posing.",
  ];
  if (input.previousCategory && input.currentCategory) {
    observations.push(
      input.previousCategory === input.currentCategory
        ? `Physique classification is unchanged (${input.currentCategory.replace(/_/g, " ")}) — visible change between weekly photos is often subtle.`
        : `Physique classification shifted from ${input.previousCategory.replace(/_/g, " ")} to ${input.currentCategory.replace(/_/g, " ")}.`,
    );
  } else {
    observations.push("Overall visible change is subtle — a single week rarely shows large differences.");
  }

  const measurements: string[] = [];
  let hasMeasuredChange = false;
  const p = input.previousMeasurement;
  const c = input.currentMeasurement;
  const diffLine = (label: string, a?: number, b?: number, unit = "kg") => {
    if (a == null || b == null) return;
    const d = Number((b - a).toFixed(1));
    if (d === 0) return;
    hasMeasuredChange = true;
    measurements.push(`${label}: ${a}${unit} → ${b}${unit} (${d > 0 ? "+" : ""}${d}${unit})`);
  };
  diffLine("Weight", p?.weightKg, c?.weightKg, "kg");
  diffLine("Waist", p?.waistCm, c?.waistCm, "cm");
  diffLine("Chest", p?.chestCm, c?.chestCm, "cm");
  diffLine("Arm", p?.armCm, c?.armCm, "cm");
  diffLine("Thigh", p?.legCm, c?.legCm, "cm");
  diffLine("Shoulders", p?.shoulderCm, c?.shoulderCm, "cm");

  const whatsWorking: string[] = [];
  const whatsToImprove: string[] = [];
  if (input.workoutAdherence >= 0.8) whatsWorking.push("Training consistency was strong this week");
  else whatsToImprove.push("Rebuild training consistency — protect the scheduled sessions");
  if (input.nutritionAdherence >= 0.7) whatsWorking.push("Nutrition logging/consistency held up");
  else whatsToImprove.push("Tighten nutrition consistency — plan and prep meals ahead");
  if (input.previousMeasurement?.weightKg != null && input.currentMeasurement?.weightKg != null) {
    if (input.currentMeasurement.weightKg < input.previousMeasurement.weightKg) whatsWorking.push("Body weight trended down this week");
    else if (input.currentMeasurement.weightKg > input.previousMeasurement.weightKg) whatsWorking.push("Body weight trended up this week");
  }
  if (whatsWorking.length === 0) whatsWorking.push("You checked in and logged data — that's the habit that makes tracking work");

  const nextFocus = [
    "Complete planned workouts",
    "Follow nutrition consistently",
    "Maintain hydration",
    "Prioritize recovery and sleep",
    "Complete next weekly check-in",
  ];

  return {
    observations,
    measurements,
    hasMeasuredChange,
    physiqueChange: "Not enough measured data to quantify this change from the photo alone.",
    uncertaintyNote:
      "Photo comparisons are approximate and can be affected by lighting, camera angle, distance, clothing, pose and time of day. No exact body-fat or muscle-mass change can be determined from photos alone.",
    whatsWorking,
    whatsToImprove,
    nextFocus,
  };
}
