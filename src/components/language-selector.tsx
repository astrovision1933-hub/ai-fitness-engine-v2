import { LANGUAGES, useI18n, type Language } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * <LanguageSelector /> — the single control used in the header, Settings and
 * onboarding. Switching is instant: the provider re-renders the whole tree and
 * persists the choice locally + to the account.
 */
export function LanguageSelector({
  variant = "compact",
  className,
}: {
  variant?: "compact" | "full";
  className?: string;
}) {
  const { language, setLanguage, t } = useI18n();

  if (variant === "full") {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("lang.title")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("lang.subtitle")}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {LANGUAGES.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setLanguage(l.value)}
              aria-pressed={language === l.value}
              className={cn(
                "border px-3 py-2.5 text-left transition-colors",
                language === l.value
                  ? "border-terminal-green bg-[#eef3ea] text-status-ok"
                  : "border-border bg-card hover:border-muted-foreground/40",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">{l.label}</span>
                <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{l.short}</span>
              </span>
              <span className="mt-1 block text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                {l.hint}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <label className={cn("relative flex items-center", className)}>
      <span className="sr-only">{t("lang.title")}</span>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="h-8 cursor-pointer appearance-none border border-border bg-card pl-2 pr-6 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground outline-none transition-colors hover:border-terminal-green/60 focus:border-terminal-green"
        aria-label={t("lang.title")}
      >
        {LANGUAGES.map((l) => (
          <option key={l.value} value={l.value}>
            {l.short} · {l.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-1.5 text-[8px] text-muted-foreground">▼</span>
    </label>
  );
}
