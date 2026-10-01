import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";

/** List active coach personas (the persona engine roster). */
export const listPersonas = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("coachPersonas").collect();
    if (all.length === 0) {
      // Auto-seed on first read so the UI always has the roster available.
      await ctx.runMutation(internal.personas.seedPersonas, {});
      const seeded = await ctx.db.query("coachPersonas").collect();
      return seeded.filter((p) => p.isActive).sort((a, b) => a.name.localeCompare(b.name));
    }
    return all.filter((p) => p.isActive).sort((a, b) => a.name.localeCompare(b.name));
  },
});
