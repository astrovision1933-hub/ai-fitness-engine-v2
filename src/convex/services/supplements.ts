// SupplementAnalysisService — Part 3 core brain. Pure functions (no ctx) so it
// stays testable and reusable from supplements.ts / products.ts.
//
// HARD RULES enforced here:
// - Verdicts are evidence-based, never "definitely genuine/fake".
// - Price alone is NEVER a red flag. Cheap ≠ fake. Expensive ≠ genuine.
// - The counterfeit-prevalence claim is never repeated without evidence.
// - External claims are always labeled FACT / ESTIMATE / CLAIM / UNCERTAINTY.

export const VERDICTS = {
  VERIFIED: "VERIFIED BY AVAILABLE EVIDENCE",
  CONSISTENT: "EVIDENCE APPEARS CONSISTENT",
  INCOMPLETE: "VERIFICATION INCOMPLETE",
  RED_FLAGS: "POTENTIAL RED FLAGS",
  UNABLE: "UNABLE TO VERIFY",
} as const;

export type Verdict = (typeof VERDICTS)[keyof typeof VERDICTS];

/** The ONLY acceptable public framing of counterfeit prevalence. */
export const PREVALENCE_STATEMENT =
  "There are documented cases of counterfeit and adulterated supplement products, but the overall prevalence cannot be assumed without reliable, current evidence.";

export const SUPPLEMENT_CATEGORIES = [
  "whey_protein",
  "mass_gainer",
  "creatine",
  "pre_workout",
  "bcaa",
  "eaa",
  "electrolytes",
  "vitamins",
  "minerals",
  "protein_blend",
  "other_sports_nutrition",
] as const;

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

export type ClaimLabel = "FACT" | "ESTIMATE" | "CLAIM" | "UNCERTAINTY";

/** Conservative claim classifier used across UI + AI prompts. */
export function classifyClaim(kind: string): ClaimLabel {
  switch (kind) {
    case "verified_fact":
    case "admin_provided":
    case "system_data":
      return "FACT";
    case "estimate":
    case "estimated":
      return "ESTIMATE";
    case "brand_claim":
    case "user_provided":
      return "CLAIM";
    default:
      return "UNCERTAINTY";
  }
}

/* ------------------------------------------------------------------ */
/* Supplement education knowledge base (seeded to the supplements table) */
/* ------------------------------------------------------------------ */

export type SupplementEdu = {
  slug: string;
  category: string;
  name: string;
  whatIs: string;
  whoMayUse: string;
  evidence: string;
  commonUse: string;
  limitations: string;
  cautionWho: string;
  evidenceLevel: string;
};

export const SUPPLEMENT_EDU: SupplementEdu[] = [
  {
    slug: "whey-protein",
    category: "whey_protein",
    name: "Whey protein",
    whatIs: "A milk-derived protein powder, rich in essential amino acids and leucine.",
    whoMayUse: "People who struggle to hit daily protein targets through food alone.",
    evidence:
      "Evidence suggests whey supplementation, combined with resistance training, can support muscle protein synthesis and strength gains. It is a food, not a magic builder — total daily protein matters most.",
    commonUse: "Commonly 20–40g per serving, around training or across the day to fill protein gaps.",
    limitations: "Does not replace whole-food protein variety; quality varies between products.",
    cautionWho:
      "Anyone with milk allergy; lactose-sensitive people may prefer isolate. If you have kidney disease, are pregnant, or take medications, ask a qualified professional before supplementing.",
    evidenceLevel: "strong",
  },
  {
    slug: "creatine-monohydrate",
    category: "creatine",
    name: "Creatine monohydrate",
    whatIs: "A compound that helps regenerate ATP for short, intense efforts. Monohydrate is the most-studied form.",
    whoMayUse: "Strength and muscle-gain trainees; also studied for general performance.",
    evidence:
      "Among the best-researched sports supplements: consistent evidence for improved strength, power and training volume. Typical protocols are 3–5g daily; loading is optional, not required.",
    commonUse: "3–5g daily, any time of day, with water or a meal.",
    limitations: "Responses vary; non-responders exist. Water-weight increase is common and harmless for most.",
    cautionWho:
      "If you have kidney conditions or take medications affecting the kidneys, consult a doctor first. Keep doses conventional — higher is not better.",
    evidenceLevel: "strong",
  },
  {
    slug: "pre-workout",
    category: "pre_workout",
    name: "Pre-workout",
    whatIs: "Multi-ingredient blends, usually caffeine plus pumps/amino/vitamin ingredients.",
    whoMayUse: "Healthy adults who want a pre-session energy boost and tolerate caffeine.",
    evidence:
      "Caffeine has good evidence for reducing perceived effort. Effects of many blended ingredients are weaker or inconsistent; proprietary blends often hide per-ingredient doses.",
    commonUse: "Often 5–15g, 20–30 minutes before training. Check the caffeine amount per serving.",
    limitations: "Blends can be under-dosed per ingredient; stimulant load varies widely between products.",
    cautionWho:
      "Caffeine-sensitive people, evening trainers (sleep impact), heart conditions, high blood pressure, pregnancy or anxiety — a professional should guide use. Never stack multiple stimulants.",
    evidenceLevel: "moderate",
  },
  {
    slug: "mass-gainer",
    category: "mass_gainer",
    name: "Mass gainer",
    whatIs: "Calorie-dense powders combining carbs, protein and fats to make a surplus easier.",
    whoMayUse: "People with high calorie needs who struggle to eat enough through food.",
    evidence:
      "Weight gain comes from a calorie surplus — the gainer is simply a convenient source. No evidence it builds muscle better than equivalent calories from food.",
    commonUse: "One or more shakes daily on top of meals to reach a surplus target.",
    limitations: "Easy to overshoot into fat gain; sugars per serving can be high; satiety is low.",
    cautionWho:
      "Diabetics and anyone managing blood sugar, insulin resistance, or a sedentary lifestyle should get professional guidance before using calorie-dense supplements.",
    evidenceLevel: "moderate",
  },
  {
    slug: "bcaa",
    category: "bcaa",
    name: "BCAA",
    whatIs: "Three essential amino acids: leucine, isoleucine and valine.",
    whoMayUse: "Context where it may help: training fasted, or very low daily protein.",
    evidence:
      "Evidence suggests BCAAs add little for people already eating adequate protein — a complete protein source covers them. Unclear benefit in well-fed trainees.",
    commonUse: "Typically 5–10g around training when used at all.",
    limitations: "Redundant with adequate whey/food protein; often an unnecessary expense.",
    cautionWho: "Generally well tolerated; no special group cautions beyond standard label warnings.",
    evidenceLevel: "limited",
  },
  {
    slug: "eaa",
    category: "eaa",
    name: "EAA",
    whatIs: "All nine essential amino acids, which the body cannot make itself.",
    whoMayUse: "Similar niche to BCAA — fasted training or protein-limited situations.",
    evidence:
      "Complete proteins (whey, eggs, meat, soy) already supply EAAs. Evidence for extra benefit beyond adequate total protein is limited.",
    commonUse: "Often 5–10g around workouts.",
    limitations: "Costly way to get what a protein shake already contains.",
    cautionWho: "Standard cautions; check quality and labeling since dosing claims vary.",
    evidenceLevel: "limited",
  },
  {
    slug: "electrolytes",
    category: "electrolytes",
    name: "Electrolytes",
    whatIs: "Sodium, potassium, magnesium and related minerals lost in sweat.",
    whoMayUse: "Long or sweaty sessions, hot climates, heavy sweaters.",
    evidence:
      "Good evidence that replacing sodium/fluid supports endurance performance in long sessions; unnecessary for short gym workouts with normal meals.",
    commonUse: "During or after long, sweaty sessions; dose per label.",
    limitations: "Whole meals hydrate fine for most gym training; sugary versions add calories.",
    cautionWho: "Blood-pressure conditions or sodium-restricted diets — check with a professional.",
    evidenceLevel: "moderate",
  },
  {
    slug: "multivitamin",
    category: "vitamins",
    name: "Multivitamin",
    whatIs: "Broad-spectrum micronutrient insurance policy in one tablet.",
    whoMayUse: "People with restricted diets or consistently poor vegetable/fruit intake.",
    evidence:
      "Evidence suggests a basic multi is low-risk but low-benefit for people with varied diets; it does not enhance performance directly. Fixing a real deficiency does help.",
    commonUse: "Once daily with a meal, per label.",
    limitations: "Cannot replace food quality; mega-doses are not better and can be harmful.",
    cautionWho:
      "Do not exceed label doses. If you take medications or have conditions, confirm with a professional; fat-soluble vitamins accumulate.",
    evidenceLevel: "limited",
  },
  {
    slug: "vitamin-d3",
    category: "vitamins",
    name: "Vitamin D3",
    whatIs: "A fat-soluble vitamin involved in bone, muscle and immune function.",
    whoMayUse: "People with little sun exposure — a very common gap.",
    evidence:
      "Correcting deficiency improves measurable outcomes; supplementing above adequate levels shows no performance benefit.",
    commonUse: "Commonly 1000–2000 IU daily with a fat-containing meal; testing guides dosing.",
    limitations: "Blood testing is the only reliable way to know your status.",
    cautionWho:
      "Do not megadose without medical supervision — toxicity is real. Kidney or parathyroid conditions need professional oversight.",
    evidenceLevel: "moderate",
  },
  {
    slug: "protein-blend",
    category: "protein_blend",
    name: "Protein blends",
    whatIs: "Mixtures of protein sources (whey + casein + soy + others) in one powder.",
    whoMayUse: "People wanting slower + faster protein or plant-only blends for dietary reasons.",
    evidence:
      "Evidence supports total daily protein as the main driver; blend speed differences are modest in real-world outcomes.",
    commonUse: "Same as whey — 20–40g per serving to fill protein gaps.",
    limitations: "Blend ratios are often undisclosed; per-source quality varies.",
    cautionWho: "Allergy check matters more (milk, soy, egg). Standard cautions apply.",
    evidenceLevel: "moderate",
  },
];

/* ------------------------------------------------------------------ */
/* Label parsing — typed/pasted label text. Image OCR is NOT available  */
/* in this environment, so the scanner is text-first and says so.        */
/* ------------------------------------------------------------------ */

export type ParsedLabel = {
  productName?: string;
  brand?: string;
  category?: string;
  servingSize?: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  manufacturer?: string;
  importer?: string;
  batchNumber?: string;
  expiry?: string;
  mrp?: number;
  barcode?: string;
  verificationInfo?: string;
  ingredientNames: string[];
  hasIngredients: boolean;
  hasNutrition: boolean;
  hasBatchInfo: boolean;
  hasManufacturerInfo: boolean;
  hasVerificationInfo: boolean;
};

function num(s: string): number | undefined {
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

const CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/whey|protein (concentrate|isolate|hydrolysate)/i, "whey_protein"],
  [/\bmass (gainer|gain)|serious mass\b/i, "mass_gainer"],
  [/creatine\s*(mono)?hydrate|\bcreatine\b/i, "creatine"],
  [/pre[-\s]?workout|c4|nitric/i, "pre_workout"],
  [/\bbcaa\b|branch(ed)? chain amino/i, "bcaa"],
  [/\beaa\b|essential amino/i, "eaa"],
  [/electrolyte|isotonic|ors|hydrat(ion|e)/i, "electrolytes"],
  [/multivitamin|vitamin\s*[a-z]|ascorbic/i, "vitamins"],
  [/\bzinc\b|\bmagnesium\b|\bcalcium\b|\biron\b/i, "minerals"],
  [/\bblend\b.*(whey|protein)|casein|soy protein/i, "protein_blend"],
];

export function parseLabel(raw: string): ParsedLabel {
  const text = raw.slice(0, 6000);
  const out: ParsedLabel = {
    ingredientNames: [],
    hasIngredients: false,
    hasNutrition: false,
    hasBatchInfo: false,
    hasManufacturerInfo: false,
    hasVerificationInfo: false,
  };

  // Product name: first non-generic line, or explicit markers.
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const nameMarker = text.match(/(?:product(?:\s*name)?|item)\s*[:\-]\s*(.+)/i);
  out.productName = (nameMarker?.[1] ?? lines.find((l) => l.length >= 3 && l.length <= 60))?.slice(0, 80);

  const brandMarker =
    text.match(/brand\s*[:\-]\s*([^\n]+)/i) ??
    text.match(/(?:from|by)\s+([A-Z][\w&.\- ]{2,30})(?:\s+(?:nutrition|labs?|supplements?|india))?/i);
  if (brandMarker) out.brand = brandMarker[1].trim().slice(0, 60);

  for (const [re, cat] of CATEGORY_HINTS) {
    if (re.test(text)) {
      out.category = cat;
      break;
    }
  }

  const serving = text.match(/serving\s*size\s*[:\-]?\s*([^\n]{1,40})/i);
  if (serving) out.servingSize = serving[1].trim();

  const cal = text.match(/(?:energy|calories?)\s*[:\-]?\s*(?:~)?\s*([\d,.]+)\s*(?:kcal|cal)/i);
  if (cal) out.calories = num(cal[1]);
  const protein = text.match(/protein\s*[:\-]?\s*(?:~)?\s*([\d,.]+)\s*g/i);
  if (protein) out.proteinG = num(protein[1]);
  const carbs = text.match(/(?:total\s*)?carbohydrates?\s*[:\-]?\s*(?:~)?\s*([\d,.]+)\s*g/i);
  if (carbs) out.carbsG = num(carbs[1]);
  const fat = text.match(/(?:total\s*)?fat\s*[:\-]?\s*(?:~)?\s*([\d,.]+)\s*g/i);
  if (fat) out.fatG = num(fat[1]);
  out.hasNutrition = out.calories !== undefined || out.proteinG !== undefined;

  const mfr =
    text.match(/manufactured\s*(?:by|for)?\s*[:\-]?\s*([^\n]{3,80})/i) ??
    text.match(/(?:marketed|mfd\.?)\s*(?:by)?\s*[:\-]?\s*([^\n]{3,80})/i);
  if (mfr) out.manufacturer = mfr[1].trim();
  const importer = text.match(/imported\s*(?:by|for)?\s*[:\-]?\s*([^\n]{3,80})/i);
  if (importer) out.importer = importer[1].trim();
  out.hasManufacturerInfo = Boolean(out.manufacturer || out.importer);

  const batch = text.match(/(?:batch|lot)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([\w\-\/]{3,24})/i);
  if (batch) {
    out.batchNumber = batch[1];
    out.hasBatchInfo = true;
  }
  const exp = text.match(/(?:best\s*before|use\s*by|exp(?:iry)?\.?)\s*[:\-]?\s*([^\n]{4,24})/i);
  if (exp) {
    out.expiry = exp[1].trim();
    out.hasBatchInfo = true;
  }

  const mrp = text.match(/(?:mrp|m\.r\.p)\s*[:\-]?\s*(?:rs\.?|₹|inr)?\s*([\d,.]+)/i);
  if (mrp) out.mrp = num(mrp[1]);
  const barcode = text.match(/(?:barcode|ean|upc)\s*[:\-]?\s*([\d\-]{6,20})/i);
  if (barcode) out.barcode = barcode[1];

  const verif = text.match(
    /(scan|verify|authentic(?:ity)?|genuine|qr\s*code|authentication\s*code|check\s*genuineness)[^\n]{0,90}/i,
  );
  if (verif) {
    out.verificationInfo = verif[0].trim().slice(0, 140);
    out.hasVerificationInfo = true;
  }

  const ingSection = text.match(
    /ingredients?\s*[:\-]?\s*([\s\S]{0,600}?)(?:\n\s*\n|nutrition|allergen|storage|directions|suggested|manufactur|$)/i,
  );
  if (ingSection) {
    out.hasIngredients = true;
    out.ingredientNames = ingSection[1]
      .split(/[,;\n•]/)
      .map((s) => s.trim().replace(/\([^)]*\)/g, "").replace(/\s*\d+(\.\d+)?\s*(g|mg|mcg|iu)\b.*$/i, "").trim())
      .filter((s) => s.length >= 2 && s.length <= 48)
      .slice(0, 30);
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Evidence-based verdict engine                                        */
/* ------------------------------------------------------------------ */

export type VerdictInput = {
  parsed: ParsedLabel;
  authoritativeConfirmation?: boolean; // e.g. brand's official verification channel confirmed
};

export type VerdictResult = {
  verdict: Verdict;
  evidenceChecked: string[];
  evidenceMissing: string[];
  redFlags: string[];
  verificationSteps: string[];
  note: string;
};

export const VERIFICATION_STEPS_BASE = [
  "Check the brand's official website for a QR/authentication code verification page and scan or enter the code on the pack.",
  "Compare the printed manufacturer/importer with the brand's officially listed details.",
  "Check batch number and expiry are printed (not a sticker over another print) and consistent with the brand's batch format.",
  "Buy from the brand's official store or an authorized seller; keep the invoice for batch tracing.",
  "If the brand publishes lab/quality reports, cross-check the batch number on the report.",
];

export function evaluateVerdict(input: VerdictInput): VerdictResult {
  const { parsed } = input;
  const evidenceChecked: string[] = [];
  const evidenceMissing: string[] = [];
  const redFlags: string[] = [];

  if (parsed.productName) evidenceChecked.push("Product name extracted from label");
  else evidenceMissing.push("Product name could not be identified");

  if (parsed.brand) evidenceChecked.push("Brand identified");
  else evidenceMissing.push("Brand not identifiable from the provided text");

  if (parsed.hasIngredients) evidenceChecked.push(`Ingredients list present (${parsed.ingredientNames.length} items parsed)`);
  else evidenceMissing.push("No ingredients list found in the provided text");

  if (parsed.hasNutrition) evidenceChecked.push("Nutrition facts present");
  else evidenceMissing.push("No nutrition facts found in the provided text");

  if (parsed.hasManufacturerInfo) evidenceChecked.push("Manufacturer/importer information present");
  else evidenceMissing.push("No manufacturer or importer information found");

  if (parsed.hasBatchInfo) evidenceChecked.push("Batch/expiry information present");
  else evidenceMissing.push("Batch number or expiry missing from the provided text");

  if (parsed.barcode) evidenceChecked.push("Barcode identifier present");
  if (parsed.hasVerificationInfo) evidenceChecked.push("On-pack authentication/verification reference present");
  else evidenceMissing.push("No on-pack authentication reference (QR / auth code / verify URL) mentioned");

  // Physical consistency checks — never price-based.
  if (parsed.proteinG !== undefined) {
    const servingMatch = parsed.servingSize?.match(/([\d.]+)\s*g/i);
    const servingG = servingMatch ? Number(servingMatch[1]) : undefined;
    if (servingG && parsed.proteinG > servingG) {
      redFlags.push(
        `Inconsistent label: declared protein (${parsed.proteinG}g) exceeds the serving size (${servingG}g), which is physically impossible — re-check the label or the product.`,
      );
    }
    if (parsed.calories !== undefined && parsed.calories < parsed.proteinG * 3) {
      redFlags.push(
        `Inconsistent label: calories (${parsed.calories}) are implausibly low for the declared protein (${parsed.proteinG}g) — protein alone contributes ~4 kcal/g.`,
      );
    }
  }

  if (redFlags.length > 0) {
    return {
      verdict: VERDICTS.RED_FLAGS,
      evidenceChecked,
      evidenceMissing,
      redFlags,
      verificationSteps: VERIFICATION_STEPS_BASE,
      note: "Label consistency issues were found. This is evidence of a label problem — it is NOT proof of counterfeiting. Contact the brand with the batch number.",
    };
  }

  if (input.authoritativeConfirmation) {
    return {
      verdict: VERDICTS.VERIFIED,
      evidenceChecked: [...evidenceChecked, "Authoritative verification channel confirmed this unit/batch"],
      evidenceMissing,
      redFlags,
      verificationSteps: VERIFICATION_STEPS_BASE,
      note: "An authoritative verification source confirmed the product. Keep your invoice with the batch number for future reference.",
    };
  }

  const completeness =
    (parsed.hasIngredients ? 1 : 0) +
    (parsed.hasNutrition ? 1 : 0) +
    (parsed.hasManufacturerInfo ? 1 : 0) +
    (parsed.hasBatchInfo ? 1 : 0);

  if (completeness === 0 && !parsed.productName) {
    return {
      verdict: VERDICTS.UNABLE,
      evidenceChecked,
      evidenceMissing: [...evidenceMissing, "Not enough label text provided to evaluate anything"],
      redFlags,
      verificationSteps: VERIFICATION_STEPS_BASE,
      note: "Paste more of the label text (ingredients, nutrition facts, manufacturer, batch, expiry) so the evidence engine has something to check.",
    };
  }

  if (completeness >= 3 && parsed.hasIngredients) {
    return {
      verdict: VERDICTS.CONSISTENT,
      evidenceChecked,
      evidenceMissing,
      redFlags,
      verificationSteps: VERIFICATION_STEPS_BASE,
      note: `Nothing on the label contradicts a genuine product. Consistency is NOT the same as verification — use the steps listed to complete verification. ${PREVALENCE_STATEMENT}`,
    };
  }

  return {
    verdict: VERDICTS.INCOMPLETE,
    evidenceChecked,
    evidenceMissing,
    redFlags,
    verificationSteps: VERIFICATION_STEPS_BASE,
    note: "Some evidence was checked but key elements (ingredients / nutrition / manufacturer / batch) are missing. This is an incomplete verification, not a judgment about the product.",
  };
}

/* ------------------------------------------------------------------ */
/* Price intelligence — computes unit economics, NEVER verdicts         */
/* ------------------------------------------------------------------ */

export type PriceIntel = {
  pricePerServing?: number;
  pricePerGram?: number;
  pricePerProteinGram?: number;
  note: string;
};

export function computePriceIntel(opts: {
  price: number;
  servings?: number;
  sizeGrams?: number;
  proteinPerServingG?: number;
}): PriceIntel {
  const { price, servings, sizeGrams, proteinPerServingG } = opts;
  const out: PriceIntel = { note: "" };
  const lines: string[] = [];

  if (servings && servings > 0) {
    out.pricePerServing = Math.round((price / servings) * 100) / 100;
    lines.push(`₹${out.pricePerServing.toFixed(2)} per serving`);
    if (proteinPerServingG && proteinPerServingG > 0) {
      out.pricePerProteinGram = Math.round((out.pricePerServing / proteinPerServingG) * 100) / 100;
      lines.push(`₹${out.pricePerProteinGram.toFixed(2)} per gram of protein`);
    }
  }
  if (sizeGrams && sizeGrams > 0) {
    out.pricePerGram = Math.round((price / sizeGrams) * 100) / 100;
    lines.push(`₹${out.pricePerGram.toFixed(2)} per gram of product`);
  }

  out.note = lines.length
    ? `Unit economics: ${lines.join(" · ")}. Price alone says nothing about authenticity — ${PREVALENCE_STATEMENT}`
    : "Add serving count or size to compute unit economics. Price alone says nothing about authenticity.";
  return out;
}
