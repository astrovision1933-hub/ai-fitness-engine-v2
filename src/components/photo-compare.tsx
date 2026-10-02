import { useState } from "react";

/**
 * <PhotoCompare /> — touch-friendly slider comparison between two physique
 * photos (previous vs current). Pure visual tool: it never quantifies change.
 */
export function PhotoCompare({
  beforeSrc,
  afterSrc,
  beforeLabel,
  afterLabel,
}: {
  beforeSrc?: string | null;
  afterSrc?: string | null;
  beforeLabel: string;
  afterLabel: string;
}) {
  const [pos, setPos] = useState(50);

  if (!beforeSrc || !afterSrc) {
    return (
      <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl border border-border bg-secondary/40 p-4 text-center text-xs text-muted-foreground">
        Both photos are needed for a slider comparison.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-[3/4] w-full select-none overflow-hidden rounded-xl border border-border bg-[#050705]">
        <img src={afterSrc} alt={afterLabel} className="absolute inset-0 size-full object-cover" />
        <img
          src={beforeSrc}
          alt={beforeLabel}
          className="absolute inset-0 size-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        />
        <span
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary shadow-[0_0_16px_var(--neon-glow)]"
          style={{ left: `${pos}%` }}
          aria-hidden
        />
        <span className="absolute left-2 top-2 rounded-full border border-primary/40 bg-background/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#dcff8a]">
          {beforeLabel}
        </span>
        <span className="absolute right-2 top-2 rounded-full border border-primary/40 bg-background/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#dcff8a]">
          {afterLabel}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Compare photos"
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>
      <p className="text-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        Drag to compare · photo comparisons are approximate
      </p>
    </div>
  );
}
