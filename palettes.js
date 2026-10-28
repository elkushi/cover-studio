// Colour sets. Each has a dark and a light version, so every cover comes out
// as a pair. "elkushi" is the portfolio site's own tokens from style.css.
(() => {
const KEYS = [
  ["bg0", "Background, top"],
  ["bg1", "Background, bottom"],
  ["card", "Card"],
  ["card2", "Highlighted card"],
  ["ink", "Icons and text"],
  ["muted", "Labels"],
  ["line", "Lines and dots"],
  ["accent", "Accent"],
  ["glow", "Glow"],
  ["warm", "Warm corner light"],
];

const PRESETS = {
  elkushi: {
    name: "Violet (elkushi.github.io)",
    dark: { bg0: "#07050b", bg1: "#0d0912", card: "#171121", card2: "#221a2e", ink: "#f7f5fa", muted: "#aaa2b8", line: "#2e2540", accent: "#a855f7", glow: "#7c3aed", warm: "#e3a53c" },
    light: { bg0: "#fbf7f1", bg1: "#f6efe6", card: "#ffffff", card2: "#ebe0d2", ink: "#140d14", muted: "#5a4a55", line: "#c9b8a6", accent: "#7a2fd1", glow: "#7a2fd1", warm: "#c46a1c" },
  },
  ocean: {
    name: "Ocean blue",
    dark: { bg0: "#050a12", bg1: "#0a1220", card: "#101b2d", card2: "#172540", ink: "#eef4fb", muted: "#9fb0c6", line: "#22324d", accent: "#38bdf8", glow: "#0ea5e9", warm: "#f59e0b" },
    light: { bg0: "#f6f9fc", bg1: "#eef3f9", card: "#ffffff", card2: "#dfe8f3", ink: "#0b1726", muted: "#4a5b70", line: "#bfcde0", accent: "#0369a1", glow: "#0284c7", warm: "#b45309" },
  },
  emerald: {
    name: "Emerald",
    dark: { bg0: "#04100c", bg1: "#08160f", card: "#0f2219", card2: "#163024", ink: "#effaf4", muted: "#9cbcab", line: "#1f3b2d", accent: "#34d399", glow: "#10b981", warm: "#fbbf24" },
    light: { bg0: "#f5faf7", bg1: "#ecf5f0", card: "#ffffff", card2: "#dcebe2", ink: "#0b1a12", muted: "#46604f", line: "#b9d3c3", accent: "#047857", glow: "#059669", warm: "#b45309" },
  },
  graphite: {
    name: "Graphite and orange",
    dark: { bg0: "#0a0a0b", bg1: "#111113", card: "#19191c", card2: "#232327", ink: "#f4f4f5", muted: "#a1a1aa", line: "#2c2c31", accent: "#f97316", glow: "#ea580c", warm: "#facc15" },
    light: { bg0: "#fafafa", bg1: "#f4f4f5", card: "#ffffff", card2: "#e4e4e7", ink: "#18181b", muted: "#52525b", line: "#d4d4d8", accent: "#c2410c", glow: "#ea580c", warm: "#a16207" },
  },
};

// Which CSS custom properties fill which colour, when importing a project's
// stylesheet. The first name found wins.
const TOKEN_NAMES = {
  bg0: ["surface-000", "bg-0", "background-0", "bg", "background"],
  bg1: ["surface-100", "bg-1", "background-1", "surface", "bg-subtle"],
  card: ["surface-200", "card", "surface-raised", "panel"],
  card2: ["surface-300", "card-2", "surface-sunken", "muted-bg"],
  ink: ["ink", "text", "foreground", "fg", "text-primary"],
  muted: ["ink-muted", "text-muted", "muted", "muted-foreground", "text-secondary"],
  line: ["line", "border", "divider", "outline"],
  accent: ["accent-violet", "accent", "primary", "brand"],
  glow: ["accent-glow", "glow", "primary-strong", "accent-strong", "primary"],
  warm: ["accent-gold", "accent-amber", "warning", "warm", "secondary"],
};

/**
 * Reads --name: #hex pairs from pasted CSS. The first :root block is dark or
 * light depending on `firstIs`; a later [data-theme="light"|"dark"] block or a
 * prefers-color-scheme block fills the other. Returns { dark, light, found, missing }.
 */
function importCss(css, firstIs = "dark") {
  const grab = (text) => Object.fromEntries([...text.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/g)].map((m) => [m[1], expand(m[2])]));
  const block = (re) => { const m = css.match(re); return m ? grab(m[1]) : {}; };
  const root = block(/:root\s*\{([^}]*)\}/);
  const other = firstIs === "dark"
    ? { ...block(/prefers-color-scheme:\s*light\)\s*\{[^{]*\{([^}]*)\}/), ...block(/\[data-theme=["']?light["']?\]\s*\{([^}]*)\}/) }
    : { ...block(/prefers-color-scheme:\s*dark\)\s*\{[^{]*\{([^}]*)\}/), ...block(/\[data-theme=["']?dark["']?\]\s*\{([^}]*)\}/) };
  const pick = (tokens) => {
    const out = {}, found = [], missing = [];
    for (const [key] of KEYS) {
      const name = TOKEN_NAMES[key].find((n) => tokens[n]);
      if (name) { out[key] = tokens[name]; found.push(`${key} ← --${name}`); } else missing.push(key);
    }
    return { out, found, missing };
  };
  const a = pick(root), b = pick({ ...root, ...other });
  const [dark, light] = firstIs === "dark" ? [a, b] : [b, a];
  return { dark: dark.out, light: light.out, found: a.found, missing: a.missing, hasOther: Object.keys(other).length > 0 };
}

function expand(hex) {
  return hex.length === 4 ? "#" + [...hex.slice(1)].map((c) => c + c).join("").toLowerCase() : hex.toLowerCase();
}

window.CoverPalettes = { KEYS, PRESETS, importCss };
})();
