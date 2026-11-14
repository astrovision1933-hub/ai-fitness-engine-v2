import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useSiteCustomization } from "@/lib/site-theme";

/* ------------------------------------------------------------------ */
/* Centralized i18n — English (default) · हिन्दी · Hinglish            */
/* ------------------------------------------------------------------ */

export type Language = "en" | "hi" | "hinglish";

export const LANGUAGES: Array<{ value: Language; label: string; short: string; hint: string }> = [
  { value: "en", label: "English", short: "EN", hint: "Professional English" },
  { value: "hi", label: "हिन्दी", short: "HI", hint: "देवनागरी हिन्दी" },
  { value: "hinglish", label: "Hinglish", short: "HI-EN", hint: "Hindi + English mix" },
];

const STORAGE_KEY = "afe.language";
export const DEFAULT_LANGUAGE: Language = "en";

type Dict = Record<string, string>;

const en: Dict = {
  "lang.title": "Language",
  "lang.subtitle": "Choose how the app and your AI coach talk to you",
  "lang.saved": "Language preference saved",
  "lang.guest": "Saved on this device. Sign in to sync across devices.",
  "lang.synced": "Synced to your account",

  "nav.home": "Home",
  "nav.coach": "AI Coach",
  "nav.workout": "Workout",
  "nav.nutrition": "Nutrition",
  "nav.progress": "Progress",
  "nav.supplements": "Supplements",
  "nav.products": "Products",
  "nav.goals": "Goals",
  "nav.competition": "Competition",
  "nav.checkin": "Check-In",
  "nav.reports": "Reports",
  "nav.profile": "Profile",
  "nav.settings": "Settings",
  "nav.plan": "Plan",
  "nav.admin": "Admin",
  "nav.signOut": "Sign out",
  "nav.search": "Search modules…",
  "nav.modules": "Modules",
  "nav.account": "Account",

  "hero.badge": "System online — 24/7 coaching engine",
  "hero.line1": "Your coach",
  "hero.line2": "doesn't sleep.",
  "hero.line3": "Neither does the engine.",
  "hero.body":
    "AI Fitness Engine builds a persistent model of you — body, schedule, diet, equipment and goals — and helps you train, track and transform every single day.",
  "hero.openApp": "Open app",
  "hero.openCenter": "Open command center",
  "hero.signIn": "Sign in",
  "hero.startFree": "Start free",
  "hero.getStarted": "Get started",

  "common.loading": "Loading…",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.retry": "Retry",
  "common.error": "Something went wrong. Please try again.",
  "common.empty": "Nothing here yet",
  "common.you": "You",
  "common.today": "Today",

  "auth.initialize": "Initialize session",
  "auth.tagline":
    "Enter your email to log in or sign up. New accounts are created automatically — email verification happens via the code.",
  "auth.email": "Email",
  "auth.emailPlaceholder": "name@example.com",
  "auth.guest": "Continue as guest",
  "auth.checkInbox": "Check your inbox",
  "auth.codeSent": "Verification code sent to",
  "auth.verify": "Verify code →",
  "auth.verifying": "Verifying…",
  "auth.differentEmail": "← Different email",
  "auth.resend": "Resend",
  "auth.otpError": "The verification code you entered is incorrect.",
  "auth.sendError": "Failed to send verification code. Please try again.",
  "auth.secureTerminal": "Secure terminal",

  "dash.title": "Command center",
  "dash.subtitle": "Your training, nutrition and progress in one place",
  "dash.greeting": "Good to see you",
  "dash.startWorkout": "Start workout",
  "dash.askCoach": "Ask coach",
  "dash.logMeal": "Log meal",
  "dash.nextMove": "Your next move",
  "dash.goalProgress": "Goal progress",
  "dash.coachMessage": "Coach message",
  "dash.quickActions": "Quick actions",
  "dash.recentActivity": "Recent activity",
  "dash.memory": "Event memory / notifications",
  "dash.moduleMap": "Module map",
  "profile.physiqueTracker": "Physique tracker",

  "coach.title": "AI Coach Chat",
  "coach.roster": "Coach roster",
  "coach.history": "Session history",
  "coach.noSessions": "No sessions yet.",
  "coach.typing": "Coach typing",
  "coach.ready": "Ready",
  "coach.processing": "Coach is composing a reply…",
  "coach.placeholder": "Type your message…",
  "coach.initializing": "Initializing session…",
  "coach.send": "Send →",
  "coach.locked": "Locked — upgrade to unlock",
  "coach.aiPersonas": "AI personas — not real humans",
  "coach.welcome": "here.",
  "coach.welcomeBody":
    "Tell me how many days you can train this week and I'll structure your workout around your goal — or use a quick action below.",
  "coach.setGoalFirst": "Set your goal first and I'll structure your training around it.",
  "coach.quick.today": "Today's Workout",
  "coach.quick.create": "Create Workout",
  "coach.quick.diet": "Analyze My Diet",
  "coach.quick.progress": "My Progress",
  "coach.quick.goal": "My Goal",
  "coach.quick.ask": "Ask Coach",
  "coach.failed": "Failed to send",
  "coach.upgrade": "Upgrade +",
  "coach.bots": "bots",

  "profile.title": "Fitness profile",
  "profile.subtitle": "persistent structured data — the engine's model of you",
  "profile.history": "User history",
  "profile.historySubtitle":
    "one merged timeline — workouts, check-ins, meals, activity, milestones, reviews and reports",
  "profile.myHistory": "My history",
  "profile.clientLookup": "Client lookup",
  "profile.searchClient": "search client name or email…",
  "profile.pickClient": "Pick a client above to pull their full activity history.",
  "profile.noHistory": "No history yet — it fills up as you train, eat and check in.",
  "profile.clientNoHistory": "This client has no activity records yet.",
  "profile.measurements": "Measurements",
  "profile.currentGoal": "Current goal",
  "profile.yourCoach": "Your coach",
  "profile.memory": "AI memory — what the engine remembers",
  "profile.assessment": "Fitness assessment",

  "settings.title": "Settings",
  "settings.language": "Language & AI coach",
  "settings.languageHint":
    "Your AI coaches reply in this language — in chat, workout plans and nutrition advice.",

  "onboarding.languageTitle": "Choose your language",
  "onboarding.languageHint":
    "The whole app and your AI coach will speak this language. You can change it anytime in Settings.",

  "workout.title": "Workout",
  "nutrition.title": "Nutrition",
  "progress.title": "Progress",
  "reports.title": "Reports",
  "goals.title": "Goals",
  "supplements.title": "Supplements",
  "products.title": "Products",
  "subscription.title": "Plan",
  "bodybuilding.title": "Competition",
  "checkin.title": "Daily check-in",
};

const hi: Dict = {
  "lang.title": "भाषा",
  "lang.subtitle": "चुनें कि ऐप और आपका AI कोच आपसे कैसे बात करें",
  "lang.saved": "भाषा की पसंद सहेज दी गई",
  "lang.guest": "इस डिवाइस पर सहेजा गया। सभी डिवाइस पर सिंक करने के लिए साइन इन करें।",
  "lang.synced": "आपके खाते में सिंक हो गया",

  "nav.home": "होम",
  "nav.coach": "AI कोच",
  "nav.workout": "वर्कआउट",
  "nav.nutrition": "पोषण",
  "nav.progress": "प्रगति",
  "nav.supplements": "सप्लीमेंट",
  "nav.products": "उत्पाद",
  "nav.goals": "लक्ष्य",
  "nav.competition": "प्रतियोगिता",
  "nav.checkin": "चेक-इन",
  "nav.reports": "रिपोर्ट",
  "nav.profile": "प्रोफ़ाइल",
  "nav.settings": "सेटिंग्स",
  "nav.plan": "प्लान",
  "nav.admin": "एडमिन",
  "nav.signOut": "साइन आउट",
  "nav.search": "मॉड्यूल खोजें…",
  "nav.modules": "मॉड्यूल",
  "nav.account": "खाता",

  "common.loading": "लोड हो रहा है…",
  "common.save": "सहेजें",
  "common.cancel": "रद्द करें",
  "common.close": "बंद करें",
  "common.retry": "फिर कोशिश करें",
  "common.error": "कुछ गड़बड़ हो गई। कृपया दोबारा कोशिश करें।",
  "common.empty": "अभी यहाँ कुछ नहीं है",
  "common.you": "आप",
  "common.today": "आज",

  "auth.initialize": "सत्र शुरू करें",
  "auth.tagline":
    "लॉग इन या साइन अप करने के लिए अपना ईमेल दर्ज करें। नए खाते अपने आप बन जाते हैं — ईमेल सत्यापन कोड से होता है।",
  "auth.email": "ईमेल",
  "auth.emailPlaceholder": "name@example.com",
  "auth.guest": "अतिथि के रूप में जारी रखें",
  "auth.checkInbox": "अपना इनबॉक्स देखें",
  "auth.codeSent": "सत्यापन कोड भेजा गया",
  "auth.verify": "कोड सत्यापित करें →",
  "auth.verifying": "सत्यापित हो रहा है…",
  "auth.differentEmail": "← दूसरा ईमेल",
  "auth.resend": "फिर भेजें",
  "auth.otpError": "दर्ज किया गया सत्यापन कोड गलत है।",
  "auth.sendError": "सत्यापन कोड नहीं भेजा जा सका। कृपया दोबारा कोशिश करें।",
  "auth.secureTerminal": "सुरक्षित टर्मिनल",

  "hero.badge": "सिस्टम ऑनलाइन — 24/7 कोचिंग इंजन",
  "hero.line1": "आपका कोच",
  "hero.line2": "कभी नहीं सोता।",
  "hero.line3": "इंजन भी नहीं।",
  "hero.body":
    "AI फिटनेस इंजन आपका एक स्थायी मॉडल बनाता है — शरीर, समय, आहार, उपकरण और लक्ष्य — और हर दिन ट्रेन, ट्रैक और ट्रांसफ़ॉर्म करने में मदद करता है।",
  "hero.openApp": "ऐप खोलें",
  "hero.openCenter": "कमांड सेंटर खोलें",
  "hero.signIn": "साइन इन",
  "hero.startFree": "मुफ़्त शुरू करें",
  "hero.getStarted": "शुरू करें",

  "dash.title": "कमांड सेंटर",
  "dash.subtitle": "आपकी ट्रेनिंग, पोषण और प्रगति एक जगह",
  "dash.greeting": "आपका स्वागत है",
  "dash.startWorkout": "वर्कआउट शुरू करें",
  "dash.askCoach": "कोच से पूछें",
  "dash.logMeal": "भोजन दर्ज करें",
  "dash.nextMove": "आपका अगला कदम",
  "dash.goalProgress": "लक्ष्य प्रगति",
  "dash.coachMessage": "कोच संदेश",
  "dash.quickActions": "त्वरित क्रियाएँ",
  "dash.recentActivity": "हाल की गतिविधि",
  "dash.memory": "इवेंट मेमोरी / सूचनाएँ",
  "dash.moduleMap": "मॉड्यूल मैप",
  "profile.physiqueTracker": "फिज़ीक ट्रैकर",

  "coach.title": "AI कोच चैट",
  "coach.roster": "कोच सूची",
  "coach.history": "सत्र इतिहास",
  "coach.noSessions": "अभी कोई सत्र नहीं।",
  "coach.typing": "कोच लिख रहा है",
  "coach.ready": "तैयार",
  "coach.processing": "कोच उत्तर तैयार कर रहा है…",
  "coach.placeholder": "अपना संदेश लिखें…",
  "coach.initializing": "सत्र शुरू हो रहा है…",
  "coach.send": "भेजें →",
  "coach.locked": "लॉक है — अनलॉक करने के लिए अपग्रेड करें",
  "coach.aiPersonas": "AI व्यक्तित्व — असली इंसान नहीं",
  "coach.welcome": "उपस्थित है।",
  "coach.welcomeBody":
    "बताइए इस हफ़्ते कितने दिन ट्रेनिंग कर सकते हैं, मैं आपके लक्ष्य के हिसाब से वर्कआउट बनाऊँगा — या नीचे कोई त्वरित विकल्प चुनें।",
  "coach.setGoalFirst": "पहले अपना लक्ष्य तय करें, मैं उसी के अनुसार ट्रेनिंग बनाऊँगा।",
  "coach.quick.today": "आज का वर्कआउट",
  "coach.quick.create": "वर्कआउट बनाएँ",
  "coach.quick.diet": "मेरे भोजन का विश्लेषण",
  "coach.quick.progress": "मेरी प्रगति",
  "coach.quick.goal": "मेरा लक्ष्य",
  "coach.quick.ask": "कोच से पूछें",
  "coach.failed": "भेजा नहीं जा सका",
  "coach.upgrade": "अपग्रेड +",
  "coach.bots": "बॉट",

  "profile.title": "फिटनेस प्रोफ़ाइल",
  "profile.subtitle": "स्थायी संरचित डेटा — इंजन की आपकी समझ",
  "profile.history": "उपयोगकर्ता इतिहास",
  "profile.historySubtitle":
    "एक साझा टाइमलाइन — वर्कआउट, चेक-इन, भोजन, गतिविधि, उपलब्धियाँ, समीक्षाएँ और रिपोर्ट",
  "profile.myHistory": "मेरा इतिहास",
  "profile.clientLookup": "क्लाइंट खोजें",
  "profile.searchClient": "क्लाइंट का नाम या ईमेल खोजें…",
  "profile.pickClient": "पूरी गतिविधि इतिहास देखने के लिए ऊपर क्लाइंट चुनें।",
  "profile.noHistory": "अभी कोई इतिहास नहीं — जैसे आप ट्रेनिंग और भोजन दर्ज करेंगे, यह भरता जाएगा।",
  "profile.clientNoHistory": "इस क्लाइंट की अभी कोई गतिविधि दर्ज नहीं है।",
  "profile.measurements": "माप",
  "profile.currentGoal": "वर्तमान लक्ष्य",
  "profile.yourCoach": "आपका कोच",
  "profile.memory": "AI स्मृति — इंजन क्या याद रखता है",
  "profile.assessment": "फिटनेस मूल्यांकन",

  "settings.title": "सेटिंग्स",
  "settings.language": "भाषा और AI कोच",
  "settings.languageHint":
    "आपके AI कोच इसी भाषा में जवाब देंगे — चैट, वर्कआउट प्लान और पोषण सलाह में।",

  "onboarding.languageTitle": "अपनी भाषा चुनें",
  "onboarding.languageHint":
    "पूरा ऐप और आपका AI कोच इसी भाषा में बात करेंगे। आप इसे सेटिंग्स में कभी भी बदल सकते हैं।",

  "workout.title": "वर्कआउट",
  "nutrition.title": "पोषण",
  "progress.title": "प्रगति",
  "reports.title": "रिपोर्ट",
  "goals.title": "लक्ष्य",
  "supplements.title": "सप्लीमेंट",
  "products.title": "उत्पाद",
  "subscription.title": "प्लान",
  "bodybuilding.title": "प्रतियोगिता",
  "checkin.title": "दैनिक चेक-इन",
};

const hinglish: Dict = {
  "lang.title": "Language",
  "lang.subtitle": "Chuno ki app aur aapka AI coach aapse kaise baat kare",
  "lang.saved": "Language preference save ho gayi",
  "lang.guest": "Is device pe saved. Sab devices pe sync karne ke liye sign in karo.",
  "lang.synced": "Aapke account me sync ho gaya",

  "nav.home": "Home",
  "nav.coach": "AI Coach",
  "nav.workout": "Workout",
  "nav.nutrition": "Nutrition",
  "nav.progress": "Progress",
  "nav.supplements": "Supplements",
  "nav.products": "Products",
  "nav.goals": "Goals",
  "nav.competition": "Competition",
  "nav.checkin": "Check-In",
  "nav.reports": "Reports",
  "nav.profile": "Profile",
  "nav.settings": "Settings",
  "nav.plan": "Plan",
  "nav.admin": "Admin",
  "nav.signOut": "Sign out",
  "nav.search": "Modules search karo…",
  "nav.modules": "Modules",
  "nav.account": "Account",

  "common.loading": "Load ho raha hai…",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.close": "Band karo",
  "common.retry": "Phir try karo",
  "common.error": "Kuch gadbad ho gayi. Please dobara try karo.",
  "common.empty": "Abhi yahan kuch nahi hai",
  "common.you": "Aap",
  "common.today": "Aaj",

  "auth.initialize": "Session start karo",
  "auth.tagline":
    "Login ya signup ke liye apna email daalo. Naye account automatic ban jaate hain — email verification code se hota hai.",
  "auth.email": "Email",
  "auth.emailPlaceholder": "name@example.com",
  "auth.guest": "Guest ke roop me continue karo",
  "auth.checkInbox": "Apna inbox check karo",
  "auth.codeSent": "Verification code bheja gaya",
  "auth.verify": "Code verify karo →",
  "auth.verifying": "Verify ho raha hai…",
  "auth.differentEmail": "← Doosra email",
  "auth.resend": "Phir bhejo",
  "auth.otpError": "Verification code galat hai.",
  "auth.sendError": "Verification code nahi bheja ja saka. Please dobara try karo.",
  "auth.secureTerminal": "Secure terminal",

  "hero.badge": "System online — 24/7 coaching engine",
  "hero.line1": "Aapka coach",
  "hero.line2": "kabhi nahi sota.",
  "hero.line3": "Engine bhi nahi.",
  "hero.body":
    "AI Fitness Engine aapka persistent model banata hai — body, schedule, diet, equipment aur goals — aur har din train, track aur transform karne me help karta hai.",
  "hero.openApp": "App kholo",
  "hero.openCenter": "Command center kholo",
  "hero.signIn": "Sign in",
  "hero.startFree": "Free start karo",
  "hero.getStarted": "Shuru karo",

  "dash.title": "Command center",
  "dash.subtitle": "Aapki training, nutrition aur progress ek jagah",
  "dash.greeting": "Aapka swagat hai",
  "dash.startWorkout": "Workout shuru karo",
  "dash.askCoach": "Coach se poocho",
  "dash.logMeal": "Meal log karo",
  "dash.nextMove": "Aapka Next Move",
  "dash.goalProgress": "Goal Progress",
  "dash.coachMessage": "Coach Message",
  "dash.quickActions": "Quick Actions",
  "dash.recentActivity": "Recent Activity",
  "dash.memory": "Event Memory / Notifications",
  "dash.moduleMap": "Module Map",
  "profile.physiqueTracker": "Physique Tracker",

  "coach.title": "AI Coach Chat",
  "coach.roster": "Coach roster",
  "coach.history": "Session history",
  "coach.noSessions": "Abhi koi session nahi.",
  "coach.typing": "Coach likh raha hai",
  "coach.ready": "Ready",
  "coach.processing": "Coach reply ready kar raha hai…",
  "coach.placeholder": "Apna message likho…",
  "coach.initializing": "Session initialize ho raha hai…",
  "coach.send": "Send →",
  "coach.locked": "Locked hai — unlock karne ke liye upgrade karo",
  "coach.aiPersonas": "AI personas — real humans nahi",
  "coach.welcome": "present hai.",
  "coach.welcomeBody":
    "Bataao is hafte kitne din train kar sakte ho, main aapke goal ke hisaab se workout banaunga — ya neeche quick action choose karo.",
  "coach.setGoalFirst": "Pehle apna goal set karo, main usi ke hisaab se training banaunga.",
  "coach.quick.today": "Aaj ka Workout",
  "coach.quick.create": "Workout Banao",
  "coach.quick.diet": "Meri Diet Analyze Karo",
  "coach.quick.progress": "Meri Progress",
  "coach.quick.goal": "Mera Goal",
  "coach.quick.ask": "Coach se Poocho",
  "coach.failed": "Send nahi hua",
  "coach.upgrade": "Upgrade +",
  "coach.bots": "bots",

  "profile.title": "Fitness Profile",
  "profile.subtitle": "persistent structured data — engine ka aapka model",
  "profile.history": "User History",
  "profile.historySubtitle":
    "ek merged timeline — workouts, check-ins, meals, activity, milestones, reviews aur reports",
  "profile.myHistory": "Meri History",
  "profile.clientLookup": "Client Lookup",
  "profile.searchClient": "client ka naam ya email search karo…",
  "profile.pickClient": "Poora activity history dekhne ke liye upar client select karo.",
  "profile.noHistory": "Abhi history khali hai — training, khaana aur check-in ke saath bharegi.",
  "profile.clientNoHistory": "Is client ka abhi koi activity record nahi hai.",
  "profile.measurements": "Measurements",
  "profile.currentGoal": "Current Goal",
  "profile.yourCoach": "Aapka Coach",
  "profile.memory": "AI Memory — engine kya yaad rakhta hai",
  "profile.assessment": "Fitness Assessment",

  "settings.title": "Settings",
  "settings.language": "Language aur AI Coach",
  "settings.languageHint":
    "Aapke AI coaches isi language me reply karenge — chat, workout plans aur nutrition advice me.",

  "onboarding.languageTitle": "Apni language chuno",
  "onboarding.languageHint":
    "Poora app aur aapka AI coach isi language me baat karenge. Settings me kabhi bhi badal sakte ho.",

  "workout.title": "Workout",
  "nutrition.title": "Nutrition",
  "progress.title": "Progress",
  "reports.title": "Reports",
  "goals.title": "Goals",
  "supplements.title": "Supplements",
  "products.title": "Products",
  "subscription.title": "Plan",
  "bodybuilding.title": "Competition",
  "checkin.title": "Daily Check-In",
};

export const DICTIONARIES: Record<Language, Dict> = { en, hi, hinglish };

/* ------------------------------------------------------------------ */
/* Provider                                                           */
/* ------------------------------------------------------------------ */

function readStored(): Language | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "en" || raw === "hi" || raw === "hinglish") return raw;
  return null;
}

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Locale for date/number formatting. */
  locale: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "hi" || value === "hinglish";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { textOverrides } = useSiteCustomization();
  const [localLanguage, setLocalLanguage] = useState<Language>(() => readStored() ?? DEFAULT_LANGUAGE);
  const [userTouched, setUserTouched] = useState(false);
  const serverLanguage = useQuery(
    api.settings.getMyLanguage,
    isAuthenticated ? {} : "skip",
  );
  const saveLanguage = useMutation(api.settings.setMyLanguage);

  // Cross-device sync without setState-in-effect: until the user picks a
  // language in this session, a valid account preference wins over the local
  // one. Existing accounts default to English server-side.
  const language: Language =
    !userTouched && isLanguage(serverLanguage) ? serverLanguage : localLanguage;

  // Mirror the effective language locally (side effect only — no state writes).
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const setLanguage = useCallback(
    (lang: Language) => {
      setUserTouched(true);
      setLocalLanguage(lang);
      if (isAuthenticated) {
        void saveLanguage({ language: lang }).catch(() => {
          // Offline / guest downgrade: the local preference still applies.
        });
      }
    },
    [isAuthenticated, saveLanguage],
  );

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      // Admin-edited copy (site text overrides) wins over the dictionary — it is
      // deliberate, human-authored replacement text.
      const raw = textOverrides[key] ?? DICTIONARIES[language]?.[key] ?? en[key] ?? key;
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
    },
    [language, textOverrides],
  );

  const locale = language === "hi" ? "hi-IN" : "en-IN";
  const value = useMemo(() => ({ language, setLanguage, t, locale }), [language, setLanguage, t, locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <LanguageProvider>");
  return ctx;
}
