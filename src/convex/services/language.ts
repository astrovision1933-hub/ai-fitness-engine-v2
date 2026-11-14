/**
 * LanguageService — one place that turns the stored preference into the exact
 * instruction block the AI coach receives. Pure functions, Convex-runtime safe.
 */

export type PreferredLanguage = "en" | "hi" | "hinglish";

export const LANGUAGES: PreferredLanguage[] = ["en", "hi", "hinglish"];

export function normalizeLanguage(value: string | null | undefined): PreferredLanguage {
  if (value === "hi" || value === "hinglish" || value === "en") return value;
  return "en"; // English stays the safe default for every existing account.
}

const INSTRUCTIONS: Record<PreferredLanguage, string[]> = {
  en: [
    "=== LANGUAGE (MANDATORY — HIGHEST PRIORITY AFTER SAFETY) ===",
    "Communicate entirely in professional, clear English.",
    "Never switch language randomly. Keep English for the whole conversation, including workout plans, diet analysis, progress reports and recommendations.",
    "Exercise names may keep their standard English form.",
  ],
  hi: [
    "=== भाषा (अनिवार्य — सुरक्षा के बाद सर्वोच्च प्राथमिकता) ===",
    "पूरी बातचीत स्वाभाविक, स्पष्ट और व्याकरण-शुद्ध हिन्दी (देवनागरी लिपि) में करें।",
    "तकनीकी फिटनेस शब्दों (जैसे progressive overload, protein, calories) को आसान हिन्दी में समझाएँ; व्यायामों के मानक अंग्रेज़ी नाम कोष्ठक में रख सकते हैं।",
    "भाषा बीच में न बदलें। वर्कआउट प्लान, डाइट विश्लेषण, प्रगति रिपोर्ट और सभी सुझाव हिन्दी में दें।",
    "यदि उपयोगकर्ता भाषा बदलता है, तो अगला उत्तर नई भाषा में दें।",
  ],
  hinglish: [
    "=== LANGUAGE (MANDATORY — HIGHEST PRIORITY AFTER SAFETY) ===",
    "Communicate in natural Indian Hinglish using Roman script (English letters, Hindi-English mix).",
    "Use familiar fitness words as-is: workout, sets, reps, protein, calories, muscle recovery, progressive overload, form.",
    "Do not switch to pure English or Devanagari Hindi mid-conversation. Keep Hinglish for workout plans, diet analysis, progress reports and recommendations.",
    "If the user changes language, the next reply must use the new language.",
  ],
};

export function languageInstruction(value: string | null | undefined): string {
  return INSTRUCTIONS[normalizeLanguage(value)].join("\n");
}

/** Short label used in audit logs / debug output. */
export function languageLabel(value: string | null | undefined): string {
  return normalizeLanguage(value);
}
