// IntentService — deterministic classifier that runs on every incoming
// message before routing. Keywords are weighted; the best match wins with
// a confidence score. Unknown falls through to the general coaching path.
import type { Intent } from "./domain";

type Rule = { intent: Intent; weight: number; patterns: RegExp[] };

const RULES: Rule[] = [
  {
    intent: "safety_sensitive",
    weight: 6,
    patterns: [
      /\b(steroids?|sarms?|clenbuterol|dnp|water\s*fast|dry\s*fast|dehydrat\w*|diuretic\w*)\b/i,
      /\b(chest\s*pain|sharp\s*pain|can'?t\s*breathe)\b/i,
    ],
  },
  {
    intent: "goal_update",
    weight: 5,
    patterns: [
      /\b(change|switch|update|set)\s+(my\s+)?(goal|target|objective)\b/i,
      /\bnew\s+goal\b/i,
      /\bI\s+want\s+to\s+(lose|gain|build|bulk|cut)\b/i,
    ],
  },
  {
    intent: "progress_update",
    weight: 5,
    patterns: [
      /\b(logged|finished|completed|did)\s+(my\s+)?(workout|session|training)\b/i,
      /\b(update|check[- ]?in|weigh(ed)?|weight\s+today|measurement)\b/i,
      /\bI\s+(hit|pr|personal\s+record)\b/i,
    ],
  },
  {
    intent: "workout_question",
    weight: 4,
    patterns: [
      /\b(workout|training\s+(plan|split|session)|exercise|routine|sets?|reps?|warm[- ]?up)\b/i,
      /\b(program|programme|split)\b/i,
      /\b(gym|home\s+workout)\b/i,
    ],
  },
  {
    intent: "nutrition_question",
    weight: 4,
    patterns: [
      /\b(diet|nutrition|calories|macros?|protein|carbs?|fats?|meal|eat|eating)\b/i,
      /\b(deficit|surplus|maintenance)\b/i,
      /\b(breakfast|lunch|dinner|snack)\b/i,
    ],
  },
  {
    intent: "supplement_question",
    weight: 4,
    patterns: [
      /\b(supplement\w*|creatine|whey|pre[- ]?workout|vitamin\w*|fish\s*oil|multivitamin)\b/i,
      /\b(bcaa|eaas?|beta\s*alanine|caffeine\s+pill\w*)\b/i,
    ],
  },
  {
    intent: "product_question",
    weight: 3,
    patterns: [
      /\b(which|what)\s+(brand|product|shaker|belt|shoes?|equipment)\b/i,
      /\b(buy|purchase|worth\s+it)\b/i,
    ],
  },
  {
    intent: "competition_question",
    weight: 3,
    patterns: [
      /\b(competition|contest|show|stage|peak\s*week|weight\s*class)\b/i,
    ],
  },
];

const RULES2: Rule[] = [
  {
    intent: "coaching_request",
    weight: 3,
    patterns: [
      /\b(coach|guide|help\s+me\s+(plan|train)|make\s+me\s+a)\b/i,
      /\b(create|build|make|generate|write)\s+(me\s+)?(a\s+)?(workout|plan|program)\b/i,
    ],
  },
  {
    intent: "fitness_question",
    weight: 2,
    patterns: [
      /\b(fitness|cardio|strength|mobility|flexibility|recovery|sleep|stress)\b/i,
      /\bhow\s+(do|can)\s+I\b/i,
    ],
  },
  {
    intent: "general_conversation",
    weight: 1,
    patterns: [
      /\b(hi|hello|hey|thanks|thank\s+you)\b/i,
    ],
  },
];

const ALL_RULES = [...RULES, ...RULES2];

export function classifyIntent(message: string): {
  intent: Intent;
  confidence: number;
} {
  let best: { intent: Intent; score: number } = {
    intent: "unknown",
    score: 0,
  };

  for (const rule of ALL_RULES) {
    let score = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(message)) score += rule.weight;
    }
    if (score > best.score) best = { intent: rule.intent, score };
  }

  if (best.score === 0) {
    return { intent: "general_conversation", confidence: 0.3 };
  }

  // Confidence: how decisively one intent dominated the message.
  const total = ALL_RULES.reduce((sum, rule) => {
    let hit = 0;
    for (const pattern of rule.patterns) if (pattern.test(message)) hit += rule.weight;
    return sum + hit;
  }, 0);

  const confidence = Math.min(0.95, 0.5 + (best.score / total) * 0.45);
  return { intent: best.intent, confidence: Number(confidence.toFixed(2)) };
}
