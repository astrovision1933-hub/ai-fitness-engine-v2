import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import {
  FOOD_DB,
  findFood,
  suggestSubstitutes,
  estimateNutritionTargets,
} from "./services/nutrition";

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Ensure the food database exists (idempotent). */
export const seedFoods = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("foods")
      .withIndex("by_name", (q) => q.eq("name", FOOD_DB[0].name))
      .first();
    if (existing) return { seeded: false };
    for (const f of FOOD_DB) {
      await ctx.db.insert("foods", {
        ...f,
        isEstimate: true,
        isPublic: true,
      });
    }
    return { seeded: true };
  },
});

/** Search foods by name/alias, diet-filtered. */
export const searchFoods = query({
  args: { query: v.string(), dietType: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const all = await ctx.db.query("foods").collect();
    const q = args.query.trim().toLowerCase();
    return all
      .filter((f) => {
        const matches =
          f.name.toLowerCase().includes(q) || f.aliases.some((a) => a.includes(q));
        const dietOk =
          !args.dietType ||
          args.dietType === "non_vegetarian" ||
          f.dietTags.includes(args.dietType);
        return matches && dietOk;
      })
      .slice(0, 20);
  },
});

/** Estimated daily targets for the signed-in user (from their profile). */
export const getTargets = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile) return null;
    const goal = profile.activeGoalId ? (await ctx.db.get(profile.activeGoalId))?.goal : undefined;
    return estimateNutritionTargets({
      age: profile.age,
      sex: profile.sex,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      goal,
      dailyActivity: profile.lifestyle?.dailyActivity,
      daysPerWeek: profile.training?.daysPerWeek,
      dietType: profile.diet?.dietType,
      allergies: profile.diet?.allergies,
      restrictions: profile.diet?.restrictions,
      budgetLevel: profile.diet?.budgetLevel,
      mealsPerDay: profile.diet?.mealsPerDay,
    });
  },
});

/** Generate today's meal plan from the food DB, profile diet and targets. */
export const generateMealPlan = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("Complete onboarding first");

    const goal = profile.activeGoalId ? (await ctx.db.get(profile.activeGoalId))?.goal : undefined;
    const targets = estimateNutritionTargets({
      age: profile.age,
      sex: profile.sex,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      goal,
      dailyActivity: profile.lifestyle?.dailyActivity,
      daysPerWeek: profile.training?.daysPerWeek,
      dietType: profile.diet?.dietType,
      mealsPerDay: profile.diet?.mealsPerDay,
    });

    const dietType = profile.diet?.dietType ?? "vegetarian";
    const allergens = (profile.diet?.allergies ?? []).map((a) => a.toLowerCase());
    const restrictions = (profile.diet?.restrictions ?? []).map((r) => r.toLowerCase());
    const excluded = [...allergens, ...restrictions];

    const foods = (await ctx.db.query("foods").collect()).filter((f) => {
      const dietOk = dietType === "non_vegetarian" || f.dietTags.includes(dietType);
      const allergyOk = !excluded.some(
        (e) => f.name.toLowerCase().includes(e) || f.aliases.some((a) => a.includes(e)),
      );
      return dietOk && allergyOk;
    });

    if (foods.length === 0) throw new Error("Food database not seeded");

    const byCategory = (cat: string) => foods.filter((f) => f.category === cat);
    const proteins = foods.filter((f) => f.proteinG >= 10).sort((a, b) => b.proteinG - a.proteinG);
    const grains = byCategory("grain");
    const produce = byCategory("produce");
    const nuts = byCategory("nuts_seeds");

    const pick = (arr: typeof foods, i: number) =>
      arr.length > 0 ? arr[i % arr.length] : foods[0];

    // Meal slots scale to the user's meals-per-day preference (min 4 slots).
    const slots: string[] = ["breakfast", "lunch"];
    if ((profile.diet?.mealsPerDay ?? 3) >= 4) slots.push("snacks");
    slots.push("dinner");

    const meals = slots.map((slot, i) => {
      const protein = pick(proteins, i);
      const grain = pick(grains, i);
      const veg = pick(produce, i);
      const fat = pick(nuts, i);
      const items = [protein, grain, veg, fat].map((f) => ({
        foodName: f.name,
        quantity: f.servingSize,
        calories: f.calories,
        proteinG: f.proteinG,
        carbsG: f.carbsG,
        fatG: f.fatG,
      }));
      const calories = items.reduce((s, it) => s + it.calories, 0);
      const proteinG = items.reduce((s, it) => s + it.proteinG, 0);
      return {
        slot,
        name:
          slot === "breakfast"
            ? "Breakfast"
            : slot === "lunch"
              ? "Lunch"
              : slot === "dinner"
                ? "Dinner"
                : "Snack",
        items,
        estimatedCalories: calories,
        estimatedProteinG: proteinG,
      };
    });

    // Pre/post workout suggestions appended when training days are set.
    const extras: typeof meals = [];
    if ((profile.training?.daysPerWeek ?? 0) > 0) {
      const pre = findFood(FOOD_DB, "banana");
      const post = findFood(FOOD_DB, "whey") ?? findFood(FOOD_DB, "milk");
      if (pre) {
        extras.push({
          slot: "pre_workout",
          name: "Pre-workout",
          items: [{ foodName: pre.name, quantity: pre.servingSize, calories: pre.calories, proteinG: pre.proteinG, carbsG: pre.carbsG, fatG: pre.fatG }],
          estimatedCalories: pre.calories,
          estimatedProteinG: pre.proteinG,
        });
      }
      if (post) {
        extras.push({
          slot: "post_workout",
          name: "Post-workout",
          items: [{ foodName: post.name, quantity: post.servingSize, calories: post.calories, proteinG: post.proteinG, carbsG: post.carbsG, fatG: post.fatG }],
          estimatedCalories: post.calories,
          estimatedProteinG: post.proteinG,
        });
      }
    }

    const allMeals = [...meals, ...extras];

    // Deactivate previous plans for today and insert the new one.
    const prev = await ctx.db
      .query("mealPlans")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today()))
      .collect();
    for (const p of prev) await ctx.db.patch(p._id, { isActive: false });

    const planId = await ctx.db.insert("mealPlans", {
      userId,
      date: today(),
      targets: {
        calories: targets.calories,
        proteinG: targets.proteinG,
        carbsG: targets.carbsG,
        fatG: targets.fatG,
        waterMl: targets.waterMl,
      },
      meals: allMeals,
      notes: "ESTIMATED plan from your profile — swap items freely; values are approximations.",
      source: "engine",
      isActive: true,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: "meal_plan_generated",
      detail: `${allMeals.length} meals`,
    });

    return { planId, mealCount: allMeals.length };
  },
});

/** Suggest diet-compatible substitutes for a food ("no paneer today"). */
export const getSubstitutes = query({
  args: { foodName: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const food = findFood(FOOD_DB, args.foodName);
    if (!food) return [];
    return suggestSubstitutes(FOOD_DB, food, profile?.diet?.dietType ?? "vegetarian").map((f) => ({
      name: f.name,
      servingSize: f.servingSize,
      calories: f.calories,
      proteinG: f.proteinG,
    }));
  },
});

/** Today's nutrition dashboard: targets + plan + logs + water. */
export const getToday = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const date = today();

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const goal = profile?.activeGoalId ? (await ctx.db.get(profile.activeGoalId))?.goal : undefined;

    const targets = profile
      ? estimateNutritionTargets({
          age: profile.age,
          sex: profile.sex,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          goal,
          dailyActivity: profile.lifestyle?.dailyActivity,
          daysPerWeek: profile.training?.daysPerWeek,
          dietType: profile.diet?.dietType,
          mealsPerDay: profile.diet?.mealsPerDay,
        })
      : null;

    const plan = await ctx.db
      .query("mealPlans")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    const logs = await ctx.db
      .query("mealLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .collect();

    const water = await ctx.db
      .query("waterLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .collect();

    const consumed = logs.reduce(
      (acc, l) => ({
        calories: acc.calories + l.calories,
        proteinG: acc.proteinG + l.proteinG,
        carbsG: acc.carbsG + l.carbsG,
        fatG: acc.fatG + l.fatG,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );

    return {
      date,
      targets: targets
        ? {
            calories: targets.calories,
            proteinG: targets.proteinG,
            carbsG: targets.carbsG,
            fatG: targets.fatG,
            waterMl: targets.waterMl,
            bmr: targets.bmr,
            tdee: targets.tdee,
            disclaimer: targets.disclaimer,
          }
        : null,
      plan: plan ?? null,
      logs,
      water: water.reduce((s, w) => s + w.amountMl, 0),
      consumed,
    };
  },
});

/** Log a food item against a meal slot. */
export const logFood = mutation({
  args: {
    mealSlot: v.string(),
    foodName: v.string(),
    quantity: v.string(),
    calories: v.number(),
    proteinG: v.number(),
    carbsG: v.number(),
    fatG: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const id = await ctx.db.insert("mealLogs", {
      userId,
      date: today(),
      ...args,
      createdAt: Date.now(),
    });
    await ctx.runMutation(internal.services.memory.writeMemory, {
      userId,
      scope: "event",
      key: "meal_logged",
      content: `Logged ${args.foodName} (${args.quantity}) — ${args.calories} kcal / ${args.proteinG}g protein.`,
      source: "user_provided",
    });
    return id;
  },
});

/** Log water in ml (also used by quick-add buttons). */
export const logWater = mutation({
  args: { amountMl: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const id = await ctx.db.insert("waterLogs", {
      userId,
      date: today(),
      amountMl: args.amountMl,
      createdAt: Date.now(),
    });
    return id;
  },
});
