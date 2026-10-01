// SafetyService — detects potentially dangerous requests before any AI call.
// The engine must never provide dangerous protocols; these rules run first
// in the orchestration pipeline and short-circuit the AI entirely when hit.
export type SafetyResult = {
  flagged: boolean;
  category?: string;
  response?: string;
};

const RULES: Array<{ category: string; patterns: RegExp[]; response: string }> = [
  {
    category: "extreme_dieting",
    patterns: [
      /\b(water\s*fast|dry\s*fast)\b/i,
      /\b(500|600|800)\s*(k?cal|calories)\s*(a\s*|per\s*day|\/d)/i,
      /\bstarv(e|ing|ation)\b/i,
      /\bcrash\s*diet\b/i,
      /\bskipping\s+((all\s+)?meals|food)\b.*\b(days|weeks)\b/i,
    ],
    response:
      "I can't help with extreme dieting or prolonged fasting protocols — they carry real health risks and usually backfire. What I can do is build a sustainable deficit around foods you enjoy, with enough protein to protect muscle. Want me to adjust your nutrition strategy in a safe range instead?",
  },
  {
    category: "dehydration_protocol",
    patterns: [
      /\b(dehydrat|water\s*cut|cut\s*water)\w*/i,
      /\b(sweat\s*suit|sauna\s*suit)\b/i,
      /\bdiuretic\w*/i,
    ],
    response:
      "I won't provide dehydration or water-cutting protocols — they're genuinely dangerous. If you're making a weight class, the safe path is gradual planning with a qualified coach and medical oversight. I can help you plan the rest of your prep instead.",
  },
  {
    category: "ped_request",
    patterns: [
      /\b(steroids?|anabolic|sarm\w*|testosterone\s+(cycle|cyp|enanthate)|hgh|gh\s*use|clenbuterol|trenbolone|dianabol|winstrol|anavar|prohormone\w*)\b/i,
      /\b(peds?|juicing\s*(up|steroids))\b/i,
    ],
    response:
      "Performance-enhancing drugs are off the table — I won't advise on acquiring, cycling or using them. The natural route still has enormous headroom: progressive overload, sleep, protein and patience. Let's push those instead.",
  },
  {
    category: "injury_or_medical",
    patterns: [
      /\b(sharp|shooting|severe)\s+(pain|sting)\w*/i,
      /\b(chest\s*pain|can'?t\s*breathe|dizzy|faint\w*|numb\w*|tingling)\b/i,
      /\b(torn|ruptured|fracture\w*|sprain\w*)\b/i,
      /\b(blood|vomit)\b.*\b(urine|stool|cough)\b/i,
      /\b(swollen|swelling)\s+(joint|knee|ankle|shoulder)\b/i,
    ],
    response:
      "That sounds like something a medical professional needs to evaluate — I'm an AI coach and I don't diagnose injuries or symptoms. Please pause the affected training, and if anything feels severe (chest pain, numbness, inability to bear weight), seek medical care now. Once you're cleared, I'll adapt your plan around it.",
  },
  {
    category: "medical_symptoms",
    patterns: [
      /\b(diagnos\w+)\b/i,
      /\b(am\s*i|do\s*i\s+have)\s+(diabetic|hypothyroid|pcos|ana?emic)\b/i,
      /\b(medication|prescription)\b.*\b(dose|dosage|stop|increase)\b/i,
    ],
    response:
      "I can't diagnose conditions or advise on medications — that's for your doctor. I can keep your training and nutrition support inside safe, general ranges while you get proper medical advice.",
  },
  {
    category: "dangerous_supplements",
    patterns: [
      /\b(dnp|2,4-dinitrophenol)\b/i,
      /\b(ephedra|ephedrine)\b/i,
      /\b(yohimbine\s+overdose|megados\w*)\b/i,
      /\b(dried|powdered)\s+organ\w*\s+protocol/i,
    ],
    response:
      "That's not something I'll advise on — those substances carry serious risks. If you want, I can walk through which supplements actually have good evidence and what a safe, basic stack looks like.",
  },
];

export function assessSafety(message: string): SafetyResult {
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(message)) {
        return {
          flagged: true,
          category: rule.category,
          response: rule.response,
        };
      }
    }
  }
  return { flagged: false };
}
