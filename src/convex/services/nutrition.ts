// NutritionService — target estimation + Indian food database + substitutions.
// All outputs are ESTIMATES computed from user-provided profile data and
// standard estimation formulas. They are not medical prescriptions.

export type NutritionProfileInput = {
  age?: number;
  sex?: string;
  heightCm?: number;
  weightKg?: number;
  goal?: string;
  dailyActivity?: string;
  daysPerWeek?: number;
  dietType?: string;
  allergies?: string[];
  restrictions?: string[];
  budgetLevel?: string;
  mealsPerDay?: number;
};

export type NutritionTargets = {
  bmr: number;
  tdee: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: 2500 | 3000 | 3500 | 4000;
  label: "ESTIMATED";
  disclaimer: string;
};

const ACTIVITY_FACTORS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

const GOAL_ADJUSTMENTS: Record<string, { calories: number; proteinPerKg: number }> = {
  fat_loss: { calories: -400, proteinPerKg: 2.0 },
  cutting: { calories: -400, proteinPerKg: 2.2 },
  muscle_gain: { calories: 300, proteinPerKg: 1.8 },
  lean_muscle: { calories: 200, proteinPerKg: 1.8 },
  lean_bulk: { calories: 250, proteinPerKg: 1.8 },
  bodybuilding: { calories: 200, proteinPerKg: 1.8 },
  body_recomposition: { calories: 0, proteinPerKg: 2.0 },
  strength: { calories: 150, proteinPerKg: 1.8 },
  general_fitness: { calories: 0, proteinPerKg: 1.6 },
  athletic_performance: { calories: 150, proteinPerKg: 1.8 },
  competition_preparation: { calories: -300, proteinPerKg: 2.2 },
};

export function estimateNutritionTargets(input: NutritionProfileInput): NutritionTargets {
  const weight = input.weightKg ?? 70;
  const height = input.heightCm ?? 170;
  const age = input.age ?? 28;
  const isMale = (input.sex ?? "male") !== "female";

  // Mifflin-St Jeor (standard estimation formula).
  const bmr = Math.round(
    isMale ? 10 * weight + 6.25 * height - 5 * age + 5 : 10 * weight + 6.25 * height - 5 * age - 161,
  );
  const activity = ACTIVITY_FACTORS[input.dailyActivity ?? "moderate"] ?? 1.55;
  const trainingBonus = Math.min(150, (input.daysPerWeek ?? 3) * 25);
  const tdee = Math.round(bmr * activity + trainingBonus);

  const goalKey = input.goal ?? "general_fitness";
  const adj = GOAL_ADJUSTMENTS[goalKey] ?? { calories: 0, proteinPerKg: 1.6 };
  const proteinG = Math.round(weight * adj.proteinPerKg);
  const calories = Math.max(1200, tdee + adj.calories);
  // Fat at ~25% of calories (min 0.6g/kg), carbs fill the remainder.
  const fatG = Math.max(Math.round(weight * 0.8), Math.round((calories * 0.25) / 9));
  const carbsG = Math.max(50, Math.round((calories - proteinG * 4 - fatG * 9) / 4));

  const waterMl = weight > 85 ? 4000 : weight > 70 ? 3500 : weight > 55 ? 3000 : 2500;

  return {
    bmr,
    tdee,
    calories,
    proteinG,
    carbsG,
    fatG,
    waterMl: waterMl as NutritionTargets["waterMl"],
    label: "ESTIMATED",
    disclaimer:
      "Estimates from standard formulas (Mifflin-St Jeor) using your profile data — not a medical prescription. Adjust based on real-world results.",
  };
}

/* ------------------------------------------------------------------ */
/* Indian food database (approximate values per serving)              */
/* ------------------------------------------------------------------ */

export type FoodSeed = {
  name: string;
  aliases: string[];
  category: string;
  dietTags: string[];
  servingSize: string;
  servingGrams?: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export const FOOD_DB: FoodSeed[] = [
  { name: "Paneer", aliases: ["cottage cheese", "indian cheese"], category: "dairy", dietTags: ["vegetarian", "eggetarian", "indian"], servingSize: "100g", servingGrams: 100, calories: 265, proteinG: 18, carbsG: 3, fatG: 21 },
  { name: "Soya chunks", aliases: ["meal maker", "soy chunks", "nutrela"], category: "legume", dietTags: ["vegetarian", "vegan", "eggetarian", "indian"], servingSize: "50g dry", servingGrams: 50, calories: 172, proteinG: 26, carbsG: 17, fatG: 1 },
  { name: "Dal (cooked)", aliases: ["dal", "lentils", "toor dal", "moong dal", "masoor dal"], category: "legume", dietTags: ["vegetarian", "vegan", "eggetarian", "indian"], servingSize: "1 cup (200g cooked)", servingGrams: 200, calories: 180, proteinG: 12, carbsG: 30, fatG: 2 },
  { name: "Rajma (cooked)", aliases: ["rajma", "kidney beans"], category: "legume", dietTags: ["vegetarian", "vegan", "eggetarian", "indian"], servingSize: "1 cup (175g cooked)", servingGrams: 175, calories: 190, proteinG: 13, carbsG: 34, fatG: 1 },
  { name: "Chole (cooked)", aliases: ["chole", "chana", "chickpeas", "kabuli chana"], category: "legume",  dietTags: ["vegetarian", "vegan", "eggetarian", "indian"], servingSize: "1 cup (170g cooked)", servingGrams: 170, calories: 210, proteinG: 11, carbsG: 36, fatG: 4 },
  { name: "Rice (white, cooked)", aliases: ["rice", "chawal", "steamed rice", "white rice"], category: "grain", dietTags: ["vegetarian", "vegan", "eggetarian", "non_vegetarian", "indian"], servingSize: "1 cup (160g cooked)", servingGrams: 160, calories: 205, proteinG: 4, carbsG: 45, fatG: 0.5 },
  { name: "Roti (whole wheat)", aliases: ["roti", "chapati", "phulka"], category: "grain", dietTags: ["vegetarian", "vegan", "eggetarian", "non_vegetarian", "indian"], servingSize: "1 medium (40g)", servingGrams: 40, calories: 104, proteinG: 3, carbsG: 20, fatG: 1 },
  { name: "Oats (dry)", aliases: ["oats", "oatmeal", "rolled oats"], category: "grain", dietTags: ["vegetarian", "vegan", "eggetarian", "non_vegetarian", "indian"], servingSize: "50g dry", servingGrams: 50, calories: 190, proteinG: 6.5, carbsG: 33, fatG: 3.5 },
  { name: "Daliya (dry)", aliases: ["daliya", "dalia", "broken wheat", "bulgur"], category: "grain", dietTags: ["vegetarian", "vegan", "eggetarian", "indian"], servingSize: "50g dry", servingGrams: 50, calories: 175, proteinG: 6, carbsG: 37, fatG: 1 },
  { name: "Milk (toned)", aliases: ["milk", "doodh", "toned milk"], category: "dairy", dietTags: ["vegetarian", "eggetarian", "indian"], servingSize: "1 glass (250ml)", servingGrams: 250, calories: 125, proteinG: 8, carbsG: 12, fatG: 5 },
  { name: "Curd (plain)", aliases: ["curd", "dahi", "yogurt"], category: "dairy", dietTags: ["vegetarian", "eggetarian", "indian"], servingSize: "1 cup (200g)", servingGrams: 200, calories: 120, proteinG: 7, carbsG: 9, fatG: 6 },
  { name: "Eggs (whole)", aliases: ["eggs", "egg", "anda"], category: "egg", dietTags: ["eggetarian", "non_vegetarian"], servingSize: "2 large (100g)", servingGrams: 100, calories: 143, proteinG: 13, carbsG: 1, fatG: 10 },
  { name: "Sprouts (moong)", aliases: ["sprouts", "moong sprouts", "bean sprouts"], category: "legume", dietTags: ["vegetarian", "vegan", "eggetarian", "indian"], servingSize: "1 cup (100g)", servingGrams: 100, calories: 30, proteinG: 3, carbsG: 6, fatG: 0 },
  { name: "Banana", aliases: ["banana", "kela"], category: "produce", dietTags: ["vegetarian", "vegan", "eggetarian", "non_vegetarian", "indian"], servingSize: "1 medium (118g)", servingGrams: 118, calories: 105, proteinG: 1, carbsG: 27, fatG: 0 },
  { name: "Apple", aliases: ["apple", "seb"], category: "produce", dietTags: ["vegetarian", "vegan", "eggetarian", "non_vegetarian", "indian"], servingSize: "1 medium (180g)", servingGrams: 180, calories: 95, proteinG: 0, carbsG: 25, fatG: 0 },
  { name: "Mixed vegetables (cooked)", aliases: ["vegetables", "sabzi", "sabji", "mixed veg"], category: "produce", dietTags: ["vegetarian", "vegan", "eggetarian", "non_vegetarian", "indian"], servingSize: "1 cup (150g)", servingGrams: 150, calories: 75, proteinG: 3, carbsG: 12, fatG: 2 },
  { name: "Almonds", aliases: ["almonds", "badam"], category: "nuts_seeds", dietTags: ["vegetarian", "vegan", "eggetarian", "non_vegetarian", "indian"], servingSize: "10 pcs (12g)", servingGrams: 12, calories: 70, proteinG: 2.5, carbsG: 2.5, fatG: 6 },
  { name: "Peanut butter", aliases: ["peanut butter", "pb"], category: "nuts_seeds", dietTags: ["vegetarian", "vegan", "eggetarian", "non_vegetarian", "indian"], servingSize: "2 tbsp (32g)", servingGrams: 32, calories: 190, proteinG: 8, carbsG: 6, fatG: 16 },
  { name: "Chia seeds", aliases: ["chia", "chia seeds"], category: "nuts_seeds", dietTags: ["vegetarian", "vegan", "eggetarian", "non_vegetarian", "indian"], servingSize: "1 tbsp (12g)", servingGrams: 12, calories: 58, proteinG: 2, carbsG: 5, fatG: 3.5 },
  { name: "Chicken breast (cooked)", aliases: ["chicken", "chicken breast", "murgh"], category: "other", dietTags: ["non_vegetarian"], servingSize: "100g cooked", servingGrams: 100, calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
  { name: "Whey protein (1 scoop)", aliases: ["whey", "protein powder", "whey scoop"], category: "other", dietTags: ["vegetarian", "eggetarian", "non_vegetarian"], servingSize: "30g scoop", servingGrams: 30, calories: 120, proteinG: 24, carbsG: 3, fatG: 1.5 },
];

export function findFood(db: FoodSeed[], query: string): FoodSeed | undefined {
  const q = query.trim().toLowerCase();
  return db.find(
    (f) =>
      f.name.toLowerCase() === q ||
      f.aliases.includes(q) ||
      f.name.toLowerCase().includes(q),
  );
}

/** Substitution logic: same category, diet-compatible, not the excluded food. */
export function suggestSubstitutes(
  db: FoodSeed[],
  food: FoodSeed,
  dietType: string,
  exclude: string[] = [],
): FoodSeed[] {
  const dietMatch = (f: FoodSeed) =>
    dietType === "non_vegetarian" || f.dietTags.includes(dietType);
  return db
    .filter(
      (f) =>
        f.name !== food.name &&
        f.category === food.category &&
        !exclude.includes(f.name) &&
        dietMatch(f),
    )
    .sort((a, b) => b.proteinG - a.proteinG)
    .slice(0, 4);
}
