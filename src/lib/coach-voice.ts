/**
 * Coach voice helpers — the honorific used when an AI coach addresses the user
 * ("Mr. Veer", "Ms. Rhea", "Coach Prime"). Purely derived from the persona
 * name so nothing is hard-coded per user and any new persona works.
 */

const FEMALE = new Set(["RHEA", "ATHENA"]);

/** Honorific for a persona name: "Mr." | "Ms." | "Coach". */
export function coachTitle(name: string | null | undefined): string {
  const n = (name ?? "").trim().toUpperCase();
  if (!n) return "Coach";
  if (FEMALE.has(n)) return "Ms.";
  if (n === "COACH PRIME") return "Coach";
  return "Mr.";
}

/** "Mr. VEER" / "Ms. RHEA" / "COACH PRIME" — respects names that already carry a title. */
export function coachFullName(name: string | null | undefined): string {
  const raw = (name ?? "").trim();
  if (!raw) return "COACH";
  if (/^(mr|ms|mrs|coach)\.?\s/i.test(raw)) return raw.toUpperCase();
  const title = coachTitle(raw);
  if (title === "Coach") return raw.toUpperCase();
  return `${title} ${raw.toUpperCase()}`;
}
