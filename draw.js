// Drawing: turns a settings object into a finished SVG string.
// A port of the script that draws the covers on elkushi.github.io/blog, so
// covers made here look like those.
// Plain script, not a module, so the app also works opened straight from disk.

(() => {
const ICON_SETS = {
  lucide: { url: "https://cdn.jsdelivr.net/npm/lucide-static@0.460.0/icons/{}.svg", licence: "Lucide, ISC licence", browse: "https://lucide.dev/icons" },
  tabler: { url: "https://cdn.jsdelivr.net/npm/@tabler/icons@3.19.0/icons/outline/{}.svg", licence: "Tabler Icons, MIT licence", browse: "https://tabler.io/icons" },
};

// Only drawing elements survive the clean-up: no scripts, links, styles or
// foreign content can come in with a downloaded icon.
const SHAPES = new Set(["path", "circle", "rect", "line", "polyline", "polygon", "ellipse"]);
const GEOMETRY = new Set(["d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "width", "height", "points"]);

// The motifs are laid out on this grid, then scaled into the chosen canvas.
const BW = 1200, BH = 630;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f1 = (n) => (Math.round(n * 10) / 10).toString();

// --- icons -------------------------------------------------------------------

const memory = new Map();

function cacheGet(key) {
  if (memory.has(key)) return memory.get(key);
  try { const v = localStorage.getItem("cs-icon:" + key); if (v !== null) { memory.set(key, v); return v; } } catch {}
  return null;
}
function cachePut(key, value) {
  memory.set(key, value);
  try { localStorage.setItem("cs-icon:" + key, value); } catch {}
}

/** Inner shapes of one icon on a 24x24 grid. Throws with a readable message. */
async function loadIcon(set, name) {
  if (!ICON_SETS[set]) throw new Error(`Unknown icon set "${set}"`);
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`"${name}" is not a valid icon name`);
  const key = `${set}/${name}`;
  const hit = cacheGet(key);
  if (hit !== null) return hit;
  let raw;
  try {
    const r = await fetch(ICON_SETS[set].url.replace("{}", name));
    if (!r.ok) throw new Error(r.status);
    raw = await r.text();
  } catch {
    throw new Error(`No ${set} icon called "${name}"`);
  }
  const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
  if (doc.querySelector("parsererror")) throw new Error(`"${name}" did not parse as SVG`);
  const out = [];
  for (const el of doc.documentElement.querySelectorAll("*")) {
    if (!SHAPES.has(el.localName) || el.getAttribute("stroke") === "none") continue;
    const attrs = [...el.attributes].filter((a) => GEOMETRY.has(a.name)).map((a) => `${a.name}="${esc(a.value)}"`).join(" ");
    out.push(`<${el.localName} ${attrs}/>`);
  }
  const shapes = out.join("");
  cachePut(key, shapes);
  return shapes;
}

function glyph(shapes, x, y, size, colour, width = 2) {
  const k = size / 24;
  return `<g transform="translate(${f1(x - size / 2)} ${f1(y - size / 2)}) scale(${k.toFixed(3)})" fill="none" ` +
    `stroke="${colour}" stroke-width="${(width / k * 1.6).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">${shapes}</g>`;
}

function mono(x, y, text, colour, size = 18, anchor = "start", weight = 500) {
  const family = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";
  return `<text x="${f1(x)}" y="${f1(y)}" fill="${colour}" font-family="${family}" font-size="${size}" ` +
    `font-weight="${weight}" text-anchor="${anchor}" dominant-baseline="middle">${esc(text)}</text>`;
}

// A small seeded random generator, so a seed always gives the same layout.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- motifs ------------------------------------------------------------------

/** Stacked isometric plates: a system in layers. */
function layers(p, icons, labels, hot) {
  const n = icons.length;
  const w = 400, d = 200, thick = 22, cx = labels.some(Boolean) ? 660 : 600;
  const gap = Math.min(150, 420 / Math.max(n - 1, 1));
  const top = BH / 2 - gap * (n - 1) / 2;
  const pts = (...q) => q.map(([x, y]) => `${f1(x)},${f1(y)}`).join(" ");
  const out = [];
  for (let i = n - 1; i >= 0; i--) {          // bottom first, so upper plates sit on top
    const cy = top + gap * i, on = i === hot;
    const face = on ? p.card2 : p.card, edge = on ? p.accent : p.line;
    const L = [cx - w / 2, cy], T = [cx, cy - d / 2], R = [cx + w / 2, cy], B = [cx, cy + d / 2];
    out.push(`<polygon points="${pts(L, B, [B[0], B[1] + thick], [L[0], L[1] + thick])}" fill="${p.bg0}" stroke="${edge}" stroke-width="1.5"/>`);
    out.push(`<polygon points="${pts(B, R, [R[0], R[1] + thick], [B[0], B[1] + thick])}" fill="${p.bg1}" stroke="${edge}" stroke-width="1.5"/>`);
    out.push(`<polygon points="${pts(L, T, R, B)}" fill="${face}" stroke="${edge}" stroke-width="${on ? 2.5 : 1.5}"/>`);
    if (on) out.push(`<polygon points="${pts(L, T, R, B)}" fill="${p.glow}" opacity=".22" class="pulse"/>`);
    // The icon lies flat on the plate: map its 24x24 grid onto the diamond.
    const s = 46, a = w / (2 * s), b = d / (2 * s), c = -w / (2 * s), dd = d / (2 * s);
    out.push(`<g transform="matrix(${a.toFixed(4)} ${b.toFixed(4)} ${c.toFixed(4)} ${dd.toFixed(4)} ${f1(T[0])} ${f1(T[1])}) translate(${s / 2 - 12} ${s / 2 - 12})" ` +
      `fill="none" stroke="${on ? p.accent : p.ink}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${icons[i]}</g>`);
    if (labels[i]) {
      const lx = cx - w / 2 - 36;
      out.push(`<line x1="${lx + 8}" y1="${f1(cy)}" x2="${L[0] - 8}" y2="${f1(cy)}" stroke="${p.line}" stroke-width="1.5"/>`);
      out.push(mono(lx, cy, labels[i], on ? p.accent : p.muted, 22, "end", on ? 600 : 500));
    }
  }
  return out.join("");
}

/** Nodes in a row, left to right, with an optional gate: a pipeline. */
function flow(p, icons, labels, gate) {
  const n = icons.length, size = 132, y = BH / 2, span = BW - 260;
  const xs = icons.map((_, i) => 130 + span * i / Math.max(n - 1, 1));
  const out = [];
  for (let i = 0; i < n - 1; i++) {
    const x1 = xs[i] + size / 2 + 10, x2 = xs[i + 1] - size / 2 - 18;
    out.push(`<line x1="${f1(x1)}" y1="${y}" x2="${f1(x2)}" y2="${y}" stroke="${p.line}" stroke-width="3"/>`);
    out.push(`<line x1="${f1(x1)}" y1="${y}" x2="${f1(x2)}" y2="${y}" stroke="${p.accent}" stroke-width="3" stroke-dasharray="4 16" stroke-linecap="round" class="flow"/>`);
    out.push(`<path d="M${f1(x2)} ${y - 9} L${f1(x2 + 14)} ${y} L${f1(x2)} ${y + 9}z" fill="${p.accent}"/>`);
  }
  xs.forEach((x, i) => {
    const on = i === gate, r = 28;
    if (on) out.push(`<rect x="${f1(x - size / 2 - 14)}" y="${y - size / 2 - 14}" width="${size + 28}" height="${size + 28}" rx="${r + 12}" fill="none" stroke="${p.accent}" stroke-width="2" stroke-dasharray="6 8" class="pulse"/>`);
    out.push(`<rect x="${f1(x - size / 2)}" y="${y - size / 2}" width="${size}" height="${size}" rx="${r}" fill="${on ? p.card2 : p.card}" stroke="${on ? p.accent : p.line}" stroke-width="${on ? 2.5 : 1.5}"/>`);
    out.push(glyph(icons[i], x, y, 56, on ? p.accent : p.ink));
    if (labels[i]) out.push(mono(x, y + size / 2 + 40, labels[i], on ? p.accent : p.muted, 20, "middle", on ? 600 : 500));
  });
  return out.join("");
}

/** One thing in the middle, the things it uses around it. */
function network(p, icons, labels, seed) {
  const rnd = seeded(seed);
  const cx = BW / 2, cy = BH / 2, k = icons.length - 1, rx = 400, ry = 205;
  const out = [0.62, 1].map((f) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx * f}" ry="${ry * f}" fill="none" stroke="${p.line}" stroke-width="1.2" opacity=".8"/>`);
  const turn = rnd() * 2 * Math.PI / k;
  const pts = Array.from({ length: k }, (_, i) => {
    const t = turn + 2 * Math.PI * i / k + (rnd() * 0.24 - 0.12);
    return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry];
  });
  for (const [x, y] of pts) out.push(`<line x1="${cx}" y1="${cy}" x2="${f1(x)}" y2="${f1(y)}" stroke="${p.accent}" stroke-width="2.5" stroke-dasharray="4 16" stroke-linecap="round" class="flow" opacity=".85"/>`);
  pts.forEach(([x, y], i) => {
    out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="46" fill="${p.card}" stroke="${p.line}" stroke-width="1.5"/>`);
    out.push(glyph(icons[i + 1], x, y, 40, p.ink));
    if (labels[i + 1]) out.push(mono(x, y + 72, labels[i + 1], p.muted, 18, "middle"));
  });
  out.push(`<circle cx="${cx}" cy="${cy}" r="96" fill="${p.glow}" opacity=".25" class="pulse"/>`);
  out.push(`<circle cx="${cx}" cy="${cy}" r="74" fill="${p.card2}" stroke="${p.accent}" stroke-width="2.5"/>`);
  out.push(glyph(icons[0], cx, cy, 64, p.accent));
  if (labels[0]) out.push(mono(cx, cy + 118, labels[0], p.accent, 18, "middle", 600));
  return out.join("");
}

// --- the frame ---------------------------------------------------------------

function frame(p, body, { width: W, height: H, alt, animate, motif }) {
  const [gx, gy] = motif === "flow" ? [0.5, 0.5] : [0.55, 0.5];
  // The motif keeps its proportions and sits in the middle of any canvas.
  const s = Math.min(W / BW, H / BH);
  const tx = (W - BW * s) / 2, ty = (H - BH * s) / 2;
  const motion = animate ? `<style>
  .flow { animation: flow 2.4s linear infinite; }
  .pulse { animation: pulse 3.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes flow { to { stroke-dashoffset: -40; } }
  @keyframes pulse { 50% { opacity: .35; } }
  @media (prefers-reduced-motion: reduce) { .flow, .pulse { animation: none; } }
</style>
` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(alt)}">
<!-- Made with Cover Studio. Icons: ${Object.values(ICON_SETS).map((v) => v.licence).join(", ")}. -->
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bg0}"/><stop offset="1" stop-color="${p.bg1}"/></linearGradient>
  <radialGradient id="glow" cx="${gx}" cy="${gy}" r="0.55"><stop offset="0" stop-color="${p.glow}" stop-opacity=".42"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>
  <radialGradient id="warm" cx="0.12" cy="0.95" r="0.5"><stop offset="0" stop-color="${p.warm}" stop-opacity=".18"/><stop offset="1" stop-color="${p.warm}" stop-opacity="0"/></radialGradient>
  <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="${p.line}"/></pattern>
  <radialGradient id="fade" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
  <mask id="dotmask"><rect width="${W}" height="${H}" fill="url(#fade)"/></mask>
</defs>
${motion}<rect width="${W}" height="${H}" fill="url(#bg)"/>
<rect width="${W}" height="${H}" fill="url(#dots)" mask="url(#dotmask)" opacity=".7"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<rect width="${W}" height="${H}" fill="url(#warm)"/>
<g transform="translate(${f1(tx)} ${f1(ty)}) scale(${s.toFixed(4)})">${body}</g>
</svg>
`;
}

/**
 * settings: { motif, rows: [{set, name, label}], hot, gate, seed, alt,
 *             width, height, animate }
 * icons:    the loaded shapes, one per row, same order
 * palette:  { bg0, bg1, card, card2, ink, muted, line, accent, glow, warm }
 */
function draw(settings, icons, palette) {
  const labels = settings.rows.map((r) => (r.label || "").trim());
  const motif = settings.motif;
  const body = motif === "layers" ? layers(palette, icons, labels, settings.hot)
    : motif === "network" ? network(palette, icons, labels, settings.seed)
    : flow(palette, icons, labels, settings.gate);
  return frame(palette, body, settings);
}

window.CoverDraw = { ICON_SETS, loadIcon, draw };
})();
