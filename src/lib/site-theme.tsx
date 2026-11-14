import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/* ------------------------------------------------------------------ */
/* Site appearance — 10 preset themes + font presets, applied at root. */
/* The admin panel stores the active theme/font; every visitor gets it. */
/* ------------------------------------------------------------------ */

export interface ThemePalette {
  id: string;
  name: string;
  /** Dark or light base, used for one quick swatch preview. */
  preview: string;
  vars: Record<string, string>;
}

function makeTheme(
  id: string,
  name: string,
  palette: {
    bg: string;
    fg: string;
    card: string;
    primary: string;
    primaryFg: string;
    secondary: string;
    muted: string;
    border: string;
    accent: string;
    accent2: string;
    sidebar: string;
  },
): ThemePalette {
  return {
    id,
    name,
    preview: palette.primary,
    vars: {
      "--background": palette.bg,
      "--foreground": palette.fg,
      "--card": palette.card,
      "--card-foreground": palette.fg,
      "--popover": palette.card,
      "--popover-foreground": palette.fg,
      "--primary": palette.primary,
      "--primary-foreground": palette.primaryFg,
      "--secondary": palette.secondary,
      "--secondary-foreground": palette.fg,
      "--muted": palette.secondary,
      "--muted-foreground": palette.muted,
      "--accent": palette.secondary,
      "--accent-foreground": palette.fg,
      "--border": palette.border,
      "--input": palette.border,
      "--ring": palette.primary,
      "--sidebar": palette.sidebar,
      "--sidebar-foreground": palette.fg,
      "--sidebar-border": palette.border,
      "--sidebar-primary": palette.primary,
      "--sidebar-primary-foreground": palette.primaryFg,
      "--sidebar-accent": palette.secondary,
      "--sidebar-accent-foreground": palette.fg,
      "--sidebar-ring": palette.primary,
      "--terminal-green": palette.primary,
      "--terminal-green-bright": palette.accent2,
      "--terminal-amber": "#f0b429",
      "--terminal-cyan": "#67e8f9",
      "--gold": "#f0b429",
    },
  };
}

export const SITE_THEMES: ThemePalette[] = [
  makeTheme("neon-lime", "Neon Lime", {
    bg: "#050705", fg: "#e9f2e4", card: "#0c110c", primary: "#a3e635", primaryFg: "#0a1205",
    secondary: "#131a12", muted: "#93a48c", border: "#222b20", accent: "#d0ff67", accent2: "#65d413", sidebar: "#080c07",
  }),
  makeTheme("midnight-blue", "Midnight Blue", {
    bg: "#050a14", fg: "#e3ecff", card: "#0a1222", primary: "#38bdf8", primaryFg: "#04121f",
    secondary: "#101b30", muted: "#8ea3c0", border: "#1d2b44", accent: "#7dd3fc", accent2: "#0ea5e9", sidebar: "#070d18",
  }),
  makeTheme("cyber-violet", "Cyber Violet", {
    bg: "#0a0613", fg: "#eee6ff", card: "#140b26", primary: "#c084fc", primaryFg: "#160627",
    secondary: "#1c1033", muted: "#a395c2", border: "#2c1d47", accent: "#e9d5ff", accent2: "#a855f7", sidebar: "#0b0717",
  }),
  makeTheme("ember-orange", "Ember Orange", {
    bg: "#0d0705", fg: "#fdeee5", card: "#1a0e09", primary: "#fb923c", primaryFg: "#1c0a02",
    secondary: "#25150c", muted: "#c0a394", border: "#3a2318", accent: "#fdba74", accent2: "#f97316", sidebar: "#100806",
  }),
  makeTheme("ocean-teal", "Ocean Teal", {
    bg: "#04100f", fg: "#e0f7f3", card: "#08201d", primary: "#2dd4bf", primaryFg: "#03140f",
    secondary: "#0d2c28", muted: "#8dbdb5", border: "#173f39", accent: "#5eead4", accent2: "#14b8a6", sidebar: "#050f0e",
  }),
  makeTheme("rose-quartz", "Rose Quartz", {
    bg: "#120709", fg: "#ffe9ef", card: "#1f0d12", primary: "#fb7185", primaryFg: "#21060c",
    secondary: "#2a141a", muted: "#c39aa3", border: "#3d2029", accent: "#fda4af", accent2: "#f43f5e", sidebar: "#14080b",
  }),
  makeTheme("monochrome", "Monochrome Slate", {
    bg: "#0a0b0d", fg: "#e8eaee", card: "#14161a", primary: "#cbd5e1", primaryFg: "#0a0b0d",
    secondary: "#1c1f24", muted: "#98a2b3", border: "#2a2e36", accent: "#e2e8f0", accent2: "#94a3b8", sidebar: "#0c0d10",
  }),
  makeTheme("forest-emerald", "Forest Emerald", {
    bg: "#040f08", fg: "#e4f7e9", card: "#0a1e12", primary: "#34d399", primaryFg: "#03150c",
    secondary: "#102a19", muted: "#8fb99f", border: "#1b3d28", accent: "#6ee7b7", accent2: "#10b981", sidebar: "#06120b",
  }),
  makeTheme("solar-amber", "Solar Amber", {
    bg: "#0d0a03", fg: "#fbf3dd", card: "#1a1407", primary: "#fbbf24", primaryFg: "#1a1203",
    secondary: "#251d0c", muted: "#c2b28c", border: "#3a2e15", accent: "#fcd34d", accent2: "#f59e0b", sidebar: "#100c04",
  }),
  makeTheme("crimson-carbon", "Crimson Carbon", {
    bg: "#0b0505", fg: "#fdeaea", card: "#180b0b", primary: "#ef4444", primaryFg: "#1a0404",
    secondary: "#221010", muted: "#c09a9a", border: "#381a1a", accent: "#fca5a5", accent2: "#dc2626", sidebar: "#0e0606",
  }),
  makeTheme("desert-bronze", "Desert Bronze", {
    bg: "#0e0a06", fg: "#f6ece0", card: "#1a130c", primary: "#d9a066", primaryFg: "#1a1208",
    secondary: "#241a11", muted: "#bfa892", border: "#362619", accent: "#e8c39e", accent2: "#b9834a", sidebar: "#100b07",
  }),
];

export interface FontPreset {
  id: string;
  name: string;
  body: string;
  display: string;
  google?: string; // families to load, when the network allows
}

export const SITE_FONTS: FontPreset[] = [
  {
    id: "space-inter",
    name: "Space Grotesk + Inter",
    body: '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
    display: '"Space Grotesk", "Inter", ui-sans-serif, system-ui, sans-serif',
    google: "Space+Grotesk:wght@400;500;700&family=Inter:wght@400;500;600;700",
  },
  {
    id: "poppins",
    name: "Poppins",
    body: '"Poppins", "Inter", ui-sans-serif, system-ui, sans-serif',
    display: '"Poppins", "Space Grotesk", ui-sans-serif, sans-serif',
    google: "Poppins:wght@400;500;600;700&display=swap",
  },
  {
    id: "montserrat",
    name: "Montserrat",
    body: '"Montserrat", "Inter", ui-sans-serif, system-ui, sans-serif',
    display: '"Montserrat", "Space Grotesk", ui-sans-serif, sans-serif',
    google: "Montserrat:wght@400;500;600;700",
  },
  {
    id: "roboto",
    name: "Roboto",
    body: '"Roboto", "Inter", ui-sans-serif, system-ui, sans-serif',
    display: '"Roboto", "Space Grotesk", ui-sans-serif, sans-serif',
    google: "Roboto:wght@400;500;700",
  },
  {
    id: "lora",
    name: "Lora (serif)",
    body: '"Lora", Georgia, "Times New Roman", serif',
    display: '"Lora", Georgia, serif',
    google: "Lora:wght@400;500;600;700",
  },
  {
    id: "orbitron",
    name: "Orbitron (futuristic)",
    body: '"Orbitron", "Space Grotesk", ui-sans-serif, sans-serif',
    display: '"Orbitron", "Space Grotesk", ui-sans-serif, sans-serif',
    google: "Orbitron:wght@400;500;600;700",
  },
  {
    id: "dm-sans",
    name: "DM Sans (clean geometric)",
    body: '"DM Sans", "Inter", ui-sans-serif, system-ui, sans-serif',
    display: '"DM Sans", "Space Grotesk", ui-sans-serif, sans-serif',
    google: "DM+Sans:wght@400;500;700",
  },
  {
    id: "oswald",
    name: "Oswald (condensed athletic)",
    body: '"Oswald", "Inter", ui-sans-serif, sans-serif',
    display: '"Oswald", "Space Grotesk", ui-sans-serif, sans-serif',
    google: "Oswald:wght@400;500;600;700",
  },
  {
    id: "playfair",
    name: "Playfair Display (premium serif)",
    body: '"Playfair Display", Georgia, serif',
    display: '"Playfair Display", Georgia, serif',
    google: "Playfair+Display:wght@400;500;600;700",
  },
  {
    id: "rajdhani",
    name: "Rajdhani (tech scoreboard)",
    body: '"Rajdhani", "Inter", ui-sans-serif, sans-serif',
    display: '"Rajdhani", "Space Grotesk", ui-sans-serif, sans-serif',
    google: "Rajdhani:wght@400;500;600;700",
  },
];

export const DEFAULT_THEME_ID = "neon-lime";
export const DEFAULT_FONT_ID = "space-inter";

interface Customization {
  theme: string;
  font: string;
  /** Admin-uploaded artwork for the hero; null keeps the built-in coach. */
  heroImage: string | null;
  textOverrides: Record<string, string>;
  banners: Array<{ _id: string; imageDataUrl: string; linkUrl: string | null; title: string | null }>;
}

const SiteThemeContext = createContext<Customization | null>(null);

export function SiteThemeProvider({ children }: { children: ReactNode }) {
  const data = useQuery(api.site.getCustomization);

  const customization = useMemo<Customization>(
    () =>
      data ?? {
        theme: DEFAULT_THEME_ID,
        font: DEFAULT_FONT_ID,
        heroImage: null,
        textOverrides: {},
        banners: [],
      },
    [data],
  );

  // Apply the palette as CSS variables on :root — every existing Tailwind token
  // (background, card, primary, terminal-*, sidebar) follows automatically.
  useEffect(() => {
    const theme = SITE_THEMES.find((t) => t.id === customization.theme) ?? SITE_THEMES[0];
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme.vars)) {
      root.style.setProperty(key, value);
    }
    root.dataset.siteTheme = theme.id;
  }, [customization.theme]);

  // Apply the font preset (loading the Google family when the network allows).
  useEffect(() => {
    const font = SITE_FONTS.find((f) => f.id === customization.font) ?? SITE_FONTS[0];
    const root = document.documentElement;
    root.style.setProperty("--font-body", font.body);
    root.style.setProperty("--font-display", font.display);
    document.body.style.fontFamily = font.body;

    if (!font.google) return;
    const href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
    const existing = document.getElementById("afe-site-font") as HTMLLinkElement | null;
    if (existing) {
      if (existing.href !== href) existing.href = href;
      return;
    }
    const link = document.createElement("link");
    link.id = "afe-site-font";
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [customization.font]);

  return <SiteThemeContext.Provider value={customization}>{children}</SiteThemeContext.Provider>;
}

export function useSiteCustomization(): Customization {
  return (
    useContext(SiteThemeContext) ?? {
      theme: DEFAULT_THEME_ID,
      font: DEFAULT_FONT_ID,
      heroImage: null,
      textOverrides: {},
      banners: [],
    }
  );
}
