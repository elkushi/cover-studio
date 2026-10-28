// The form, the preview and the exports. Drawing lives in draw.js, colour
// sets in palettes.js.
(() => {
const { ICON_SETS, loadIcon, draw } = window.CoverDraw;
const { KEYS, PRESETS, importCss } = window.CoverPalettes;
const $ = (id) => document.getElementById(id);
const STORE = "cs-settings";
const QUICK = ["bot", "brain", "database", "globe", "search", "file-text", "code", "braces", "server", "cloud", "shield-check",
  "lock", "key-round", "mail", "message-square", "users", "workflow", "list-checks", "wrench", "zap", "chart-line", "image", "video", "smartphone"];

const DEFAULTS = {
  motif: "flow",
  rows: [
    { set: "lucide", name: "globe", label: "fetch" },
    { set: "lucide", name: "braces", label: "schema" },
    { set: "lucide", name: "shield-check", label: "validator" },
    { set: "lucide", name: "file-text", label: "pdf" },
  ],
  gate: 2, hot: 1, seed: 7,
  width: 1200, height: 630,
  preset: "elkushi",
  palette: structuredClone({ dark: PRESETS.elkushi.dark, light: PRESETS.elkushi.light }),
  slug: "my-cover", alt: "", animate: true,
};

let S = load();
const shapes = new Map();        // "set/name" -> shapes, or an Error
let output = { dark: "", light: "" };
let urls = { dark: null, light: null };

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (saved && Array.isArray(saved.rows)) return { ...structuredClone(DEFAULTS), ...saved };
  } catch {}
  return structuredClone(DEFAULTS);
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch {} }

// --- form → settings ---------------------------------------------------------

function renderRows() {
  const ol = $("rows");
  ol.innerHTML = "";
  S.rows.forEach((r, i) => {
    const li = document.createElement("li");
    li.className = "row";
    li.innerHTML = `
      <div class="tile" aria-hidden="true"></div>
      <div class="fields">
        <select aria-label="Icon set ${i + 1}">${Object.keys(ICON_SETS).map((k) => `<option value="${k}">${k[0].toUpperCase() + k.slice(1)}</option>`).join("")}</select>
        <input type="text" aria-label="Icon name ${i + 1}" placeholder="icon name" spellcheck="false">
        <input type="text" aria-label="Label ${i + 1}" placeholder="label (optional)" maxlength="24">
      </div>
      <div class="tools">
        <span class="role">${roleOf(i)}</span>
        <button type="button" aria-label="Move up" ${i === 0 ? "disabled" : ""}>↑</button>
        <button type="button" aria-label="Move down" ${i === S.rows.length - 1 ? "disabled" : ""}>↓</button>
        <button type="button" aria-label="Remove" ${S.rows.length <= 2 ? "disabled" : ""}>✕</button>
      </div>
      <div class="err" hidden></div>`;
    const [sel, name, label] = li.querySelectorAll("select, input");
    sel.value = r.set; name.value = r.name; label.value = r.label || "";
    sel.onchange = () => { r.set = sel.value; update(); };
    name.oninput = debounce(() => { r.name = name.value.trim().toLowerCase(); update(); }, 350);
    label.oninput = debounce(() => { r.label = label.value; update(); }, 200);
    const [up, down, rm] = li.querySelectorAll(".tools button");
    up.onclick = () => { move(i, -1); };
    down.onclick = () => { move(i, 1); };
    rm.onclick = () => { S.rows.splice(i, 1); fixIndexes(); renderAll(); };
    ol.appendChild(li);
  });
  $("add").disabled = S.rows.length >= 7;
}

function roleOf(i) {
  if (S.motif === "network") return i === 0 ? "centre" : `around ${i}`;
  if (S.motif === "layers") return i === 0 ? "top layer" : `layer ${i + 1}`;
  return `step ${i + 1}`;
}

function move(i, d) {
  const j = i + d;
  [S.rows[i], S.rows[j]] = [S.rows[j], S.rows[i]];
  if (S.gate === i) S.gate = j; else if (S.gate === j) S.gate = i;
  if (S.hot === i) S.hot = j; else if (S.hot === j) S.hot = i;
  renderAll();
}

function fixIndexes() {
  if (S.gate >= S.rows.length) S.gate = -1;
  if (S.hot >= S.rows.length) S.hot = 0;
}

function renderOptions() {
  for (const m of document.querySelectorAll("input[name=motif]")) m.checked = m.value === S.motif;
  $("opt-gate").hidden = S.motif !== "flow";
  $("opt-hot").hidden = S.motif !== "layers";
  $("opt-seed").hidden = S.motif !== "network";
  $("gate").innerHTML = `<option value="-1">none</option>` + S.rows.map((_, i) => `<option value="${i}">step ${i + 1}</option>`).join("");
  $("gate").value = S.gate;
  $("hot").innerHTML = S.rows.map((_, i) => `<option value="${i}">${i === 0 ? "top" : "layer " + (i + 1)}</option>`).join("");
  $("hot").value = S.hot;
  $("seed").value = S.seed;
  const key = `${S.width}x${S.height}`;
  $("size").value = [...$("size").options].some((o) => o.value === key) ? key : "custom";
  $("w").value = S.width; $("h").value = S.height;
  $("preset").value = PRESETS[S.preset] ? S.preset : "custom";
  $("slug").value = S.slug; $("alt").value = S.alt; $("animate").checked = S.animate;
}

function renderSwatches() {
  $("swatches").innerHTML = KEYS.map(([k, label]) => `
    <div class="swatch"><span>${label}</span>
      <input type="color" data-theme="dark" data-key="${k}" value="${S.palette.dark[k]}" aria-label="${label}, dark">
      <input type="color" data-theme="light" data-key="${k}" value="${S.palette.light[k]}" aria-label="${label}, light">
    </div>`).join("");
  for (const inp of $("swatches").querySelectorAll("input")) {
    inp.oninput = () => { S.palette[inp.dataset.theme][inp.dataset.key] = inp.value; S.preset = "custom"; $("preset").value = "custom"; update(); };
  }
}

function renderAll() { renderRows(); renderOptions(); update(); }

// --- drawing -----------------------------------------------------------------

async function getShapes(r) {
  const key = `${r.set}/${r.name}`;
  if (!shapes.has(key)) {
    try { shapes.set(key, await loadIcon(r.set, r.name)); } catch (e) { shapes.set(key, e); }
  }
  return shapes.get(key);
}

let ticket = 0;
async function update() {
  save();
  const mine = ++ticket;
  const loaded = await Promise.all(S.rows.map(getShapes));
  if (mine !== ticket) return;               // a newer edit is already drawing

  // Tiles and errors next to each row.
  const rows = $("rows").children;
  let bad = 0;
  loaded.forEach((sh, i) => {
    const li = rows[i]; if (!li) return;
    const tile = li.querySelector(".tile"), err = li.querySelector(".err");
    if (sh instanceof Error || !sh) {
      bad++;
      tile.className = "tile bad"; tile.textContent = "?";
      err.hidden = false; err.textContent = S.rows[i].name ? (sh?.message || "Not found") : "Type an icon name";
    } else {
      tile.className = "tile";
      tile.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${sh}</svg>`;
      err.hidden = true;
    }
  });

  if (bad) { status(`${bad} icon${bad > 1 ? "s" : ""} not found. Check the name on the icon site.`, true); setExports(false); return; }
  for (const theme of ["dark", "light"]) {
    output[theme] = draw({ ...S, alt: S.alt || `Cover art for ${S.slug.replace(/-/g, " ")}` }, loaded, S.palette[theme]);
    if (urls[theme]) URL.revokeObjectURL(urls[theme]);
    urls[theme] = URL.createObjectURL(new Blob([output[theme]], { type: "image/svg+xml" }));
    $("img-" + theme).src = urls[theme];
    $("img-" + theme).alt = `${theme} version`;
  }
  const kb = Math.ceil(new Blob([output.dark]).size / 1024);
  status(`${S.width} × ${S.height} · about ${kb} KB per SVG`);
  setExports(true);
}

function status(text, err = false) { $("status").textContent = text; $("status").className = "status" + (err ? " err" : ""); }
function setExports(on) { for (const b of document.querySelectorAll(".exports button")) b.disabled = !on; }

// --- exports -----------------------------------------------------------------

function fileName(theme, ext) { return `${slug()}-${theme}.${ext}`; }
function slug() { return /^[a-z0-9-]+$/.test(S.slug) ? S.slug : "cover"; }

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function downloadSvg(theme) { download(new Blob([output[theme]], { type: "image/svg+xml" }), fileName(theme, "svg")); }

async function downloadPng(theme) {
  const img = new Image();
  img.src = urls[theme];
  await img.decode();
  const scale = 2;
  const c = document.createElement("canvas");
  c.width = S.width * scale; c.height = S.height * scale;
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  c.toBlob((b) => download(b, fileName(theme, "png")), "image/png");
  status(`PNG at ${c.width} × ${c.height} (2× for sharp screens)`);
}

function htmlSnippet() {
  const alt = (S.alt || "").replace(/"/g, "&quot;");
  return `<picture>
  <source srcset="${fileName("dark", "svg")}" media="(prefers-color-scheme: dark)">
  <img src="${fileName("light", "svg")}" width="${S.width}" height="${S.height}" alt="${alt}">
</picture>`;
}

async function copy(text, what) {
  try { await navigator.clipboard.writeText(text); status(`${what} copied`); }
  catch { status("The browser blocked copying. Use the download buttons instead.", true); }
}

// --- wiring ------------------------------------------------------------------

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

function wire() {
  $("preset").innerHTML = Object.entries(PRESETS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("") + `<option value="custom">Custom</option>`;
  $("quick").innerHTML = QUICK.map((n) => `<button type="button" data-icon="${n}">${n}</button>`).join("");

  for (const m of document.querySelectorAll("input[name=motif]")) m.onchange = () => { S.motif = m.value; renderAll(); };
  $("add").onclick = () => { if (S.rows.length < 7) { S.rows.push({ set: "lucide", name: "", label: "" }); renderAll(); $("rows").lastElementChild.querySelector("input").focus(); } };
  $("quick").onclick = (e) => {
    const n = e.target.dataset?.icon; if (!n) return;
    const empty = S.rows.find((r) => !r.name);
    if (empty) { empty.set = "lucide"; empty.name = n; }
    else if (S.rows.length < 7) S.rows.push({ set: "lucide", name: n, label: "" });
    else { status("Seven icons is the most a cover can hold. Remove one first.", true); return; }
    renderAll();
  };
  $("gate").onchange = () => { S.gate = +$("gate").value; update(); };
  $("hot").onchange = () => { S.hot = +$("hot").value; update(); };
  $("seed").oninput = debounce(() => { S.seed = Math.max(1, +$("seed").value || 1); update(); }, 200);
  $("shuffle").onclick = () => { S.seed = 1 + Math.floor(Math.random() * 9999); $("seed").value = S.seed; update(); };

  $("size").onchange = () => {
    if ($("size").value === "custom") { $("w").focus(); return; }
    [S.width, S.height] = $("size").value.split("x").map(Number);
    renderOptions(); update();
  };
  const dims = debounce(() => {
    const w = +$("w").value, h = +$("h").value;
    if (w >= 200 && w <= 4000 && h >= 200 && h <= 4000) { S.width = w; S.height = h; renderOptions(); update(); }
  }, 300);
  $("w").oninput = dims; $("h").oninput = dims;

  $("preset").onchange = () => {
    const p = PRESETS[$("preset").value]; if (!p) return;
    S.preset = $("preset").value;
    S.palette = structuredClone({ dark: p.dark, light: p.light });
    renderSwatches(); update();
  };
  $("import").onclick = () => {
    const r = importCss($("css").value, $("rootis").value);
    const n = Object.keys(r.dark).length + Object.keys(r.light).length;
    if (!n) { $("import-msg").textContent = "No colour variables found. They need to look like --name: #hex."; return; }
    for (const t of ["dark", "light"]) Object.assign(S.palette[t], r[t]);
    S.preset = "custom";
    renderSwatches(); renderOptions(); update();
    $("import-msg").textContent = `Used ${r.found.length} of ${KEYS.length} colours.` +
      (r.missing.length ? ` Kept the current ${r.missing.join(", ")}; set them by hand above.` : "") +
      (r.hasOther ? "" : " No second theme found, so both versions use the same colours.");
  };

  $("slug").oninput = () => { S.slug = $("slug").value.trim(); save(); };
  $("alt").oninput = debounce(() => { S.alt = $("alt").value; update(); }, 300);
  $("animate").onchange = () => { S.animate = $("animate").checked; update(); };

  $("save").onclick = () => download(new Blob([JSON.stringify(S, null, 2)], { type: "application/json" }), `${slug()}.cover.json`);
  $("load").onchange = async () => {
    const f = $("load").files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data.rows) || !data.palette) throw new Error();
      S = { ...structuredClone(DEFAULTS), ...data };
      renderSwatches(); renderAll(); status(`Opened ${f.name}`);
    } catch { status("That file is not a Cover Studio settings file.", true); }
    $("load").value = "";
  };
  $("reset").onclick = () => { S = structuredClone(DEFAULTS); renderSwatches(); renderAll(); status("Started over"); };

  for (const b of document.querySelectorAll("[data-dl]")) b.onclick = () => {
    if (b.dataset.dl === "both") { downloadSvg("dark"); setTimeout(() => downloadSvg("light"), 400); }
    else downloadSvg(b.dataset.dl);
  };
  for (const b of document.querySelectorAll("[data-png]")) b.onclick = () => downloadPng(b.dataset.png);
  $("copy-svg").onclick = () => copy(output.dark, "Dark SVG");
  $("copy-html").onclick = () => copy(htmlSnippet(), "HTML");
}

wire();
renderSwatches();
renderAll();
})();
