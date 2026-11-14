import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SCAN_DURATION_SEC, SCAN_STAGES } from "@/lib/physique";
import { cn } from "@/lib/utils";

const DOTS = [
  { x: 38, y: 18 }, { x: 62, y: 15 }, { x: 30, y: 34 }, { x: 70, y: 36 },
  { x: 46, y: 30 }, { x: 54, y: 46 }, { x: 34, y: 56 }, { x: 66, y: 58 },
  { x: 44, y: 68 }, { x: 58, y: 74 }, { x: 40, y: 84 }, { x: 60, y: 88 },
];

/**
 * <PhysiqueScan /> — the ~30s VISUAL scan experience.
 *
 * This is deliberately a presentation, not a measurement: it shows the user the
 * uploaded photo inside a HUD frame while staged status messages play. The real
 * assessment is generated separately from actual profile/measurement data, so
 * nothing here invents scientific results.
 */
export function PhysiqueScan({
  imageSrc,
  onComplete,
  onCancel,
}: {
  imageSrc?: string | null;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const cbRef = useRef(onComplete);
  const doneRef = useRef(false);

  useEffect(() => {
    cbRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    let lastWhole = -1;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / (SCAN_DURATION_SEC * 1000));
      // Re-render only when the whole percentage changes (~100 renders over the
      // whole scan) instead of every animation frame. A 60fps re-render over a
      // full-size photo is what made phones drop the tab after the camera step.
      const whole = Math.round(p * 100);
      if (whole !== lastWhole) {
        lastWhole = whole;
        setProgress(whole);
      }
      if (p >= 1) {
        if (!doneRef.current) {
          doneRef.current = true;
          cbRef.current();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const elapsed = (progress / 100) * SCAN_DURATION_SEC;

  const stageIndex = Math.max(
    0,
    SCAN_STAGES.reduce((acc, s, i) => (elapsed >= s.at ? i : acc), 0),
  );
  const band =
    stageIndex === 2
      ? "top-0 h-1/3"
      : stageIndex === 3
        ? "top-1/3 h-1/3"
        : stageIndex >= 4
          ? "top-2/3 h-1/3"
          : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md">
        <p className="font-display text-center text-[11px] font-bold uppercase tracking-[0.28em] text-primary">
          Physique AI Scan
        </p>

        <div className="relative mx-auto mt-4 aspect-[3/4] w-full overflow-hidden rounded-2xl border border-primary/30 bg-[#050705] shadow-[0_0_40px_rgba(163,230,53,0.18)]">
          {imageSrc ? (
            <img src={imageSrc} alt="Physique scan" className="absolute inset-0 size-full object-cover opacity-60" draggable={false} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Profile analysis
            </div>
          )}

          {/* futuristic grid */}
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden
            style={{
              backgroundImage:
                "linear-gradient(rgba(163,230,53,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(163,230,53,0.14) 1px, transparent 1px)",
              backgroundSize: "30px 30px",
            }}
          />
          {/* horizontal scan lines */}
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            aria-hidden
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(163,230,53,0.06) 0 1px, transparent 1px 5px)",
            }}
          />

          {/* body outline detection */}
          <div
            className={cn(
              "pointer-events-none absolute inset-x-[24%] inset-y-[5%] rounded-[45%] border transition-opacity duration-700",
              stageIndex >= 1 ? "border-primary/70 opacity-100" : "border-primary/20 opacity-0",
            )}
            aria-hidden
          />

          {/* active analysis band */}
          {band && (
            <div
              className={cn("pointer-events-none absolute inset-x-0 border-y border-primary/50 bg-primary/10 transition-all", band)}
              aria-hidden
            />
          )}

          {/* scan beam — CSS eases between the throttled steps */}
          <div
            className="pointer-events-none absolute inset-x-0 h-28 -translate-y-1/2 transition-[top] duration-150 ease-linear"
            style={{ top: `${progress}%`, background: "linear-gradient(180deg, transparent, rgba(163,230,53,0.35), transparent)" }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 h-0.5 bg-primary shadow-[0_0_20px_var(--neon-glow)] transition-[top] duration-150 ease-linear"
            style={{ top: `${progress}%` }}
            aria-hidden
          />

          {/* data points */}
          {DOTS.map((d, i) => (
            <span
              key={i}
              className="absolute size-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_8px_var(--neon-glow)]"
              style={{ left: `${d.x}%`, top: `${d.y}%`, animationDelay: `${(i % 5) * 0.25}s` }}
              aria-hidden
            />
          ))}

          {/* HUD corner brackets */}
          {[
            "left-2 top-2 border-l-2 border-t-2",
            "right-2 top-2 border-r-2 border-t-2",
            "left-2 bottom-2 border-l-2 border-b-2",
            "right-2 bottom-2 border-r-2 border-b-2",
          ].map((c) => (
            <span key={c} className={cn("absolute size-5 border-primary/80", c)} aria-hidden />
          ))}

          {/* percentage */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-primary/40 bg-background/80 px-3 py-1 font-display text-xs font-bold text-[#dcff8a]">
            {Math.round(progress)}%
          </div>
        </div>

        {/* status log */}
        <ul className="mt-4 space-y-1.5">
          {SCAN_STAGES.map((s, i) => (
            <li
              key={s.label}
              className={cn(
                "flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] transition-colors",
                i < stageIndex ? "text-status-ok" : i === stageIndex ? "text-[#dcff8a]" : "text-muted-foreground/50",
              )}
            >
              {i < stageIndex ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <span className={cn("size-1.5 rounded-full", i === stageIndex ? "animate-pulse bg-primary" : "bg-muted-foreground/40")} aria-hidden />
              )}
              {s.label}
            </li>
          ))}
        </ul>

        <p className="mt-3 text-center text-[10px] leading-4 text-muted-foreground">
          Visual scan presentation · your real assessment uses the information you provided.
        </p>

        <div className="mt-4 flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="rounded-xl border-border text-[10px] uppercase tracking-[0.14em]"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!doneRef.current) {
                doneRef.current = true;
                cbRef.current();
              }
            }}
            className="rounded-xl bg-gradient-to-r from-[#a3e635] to-[#65d413] text-[10px] font-bold uppercase tracking-[0.14em] text-[#0a1205] hover:brightness-110"
          >
            Skip to results →
          </Button>
        </div>
      </div>
    </div>
  );
}
