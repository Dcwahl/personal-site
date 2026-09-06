/**
 * The site's colour, in one place.
 *
 * The room is line art on flat paper, so the whole look is three values: the
 * paper the walls are made of, the ink every line is drawn in, and the colour
 * of the space beyond the door. Everything else — the seam strokes, the
 * robot's fills, the plane's trail, the rules on the sheet — is one of those
 * three, sometimes at reduced alpha.
 *
 * They used to be spelled out in five files (`styles.css`, `robot.js`,
 * `trail.js`, `flight.js`, the `theme-color` meta, and `door.svg`'s baked
 * stroke), which is why trying a different palette meant a search-and-replace
 * across the repo. Now CSS holds the live values as custom properties, this
 * module is the only thing that writes them, and the canvas code reads them
 * back out rather than carrying its own copies.
 *
 * Switching, for looking at alternatives:
 *
 *   ?palette=night     load with a named palette (sticks, via localStorage)
 *   ?palette=clay      back to the default
 *   Shift+P            cycle to the next one and log its name
 *
 * The choice is persisted so a reload — or clicking through to `#about` — does
 * not drop you back to the default mid-comparison.
 */

/**
 * `paper` is the walls; `ink` is every line; `beyond` is what the open door
 * reveals. `beyond` is the only one with any freedom: it is a different room,
 * seen as a flat shape, so it can carry the accent the rest of the page cannot.
 */
export const PALETTES = {
  clay: {
    label: "Clay — the current one",
    paper: "#dac9a4",
    ink: "#17140f",
    beyond: "#cd9268",
  },
  slate: {
    label: "Slate — cool grey paper, teal beyond",
    paper: "#d7d9d3",
    ink: "#16191a",
    beyond: "#5c7d78",
  },
  night: {
    label: "Night — dark room, lamplight through the door",
    paper: "#1b1f26",
    ink: "#ccd4dc",
    beyond: "#e6b35c",
  },
  riso: {
    label: "Riso — navy ink on bright stock, orange beyond",
    paper: "#efeeea",
    ink: "#1b2a63",
    beyond: "#ff5a36",
  },
  moss: {
    label: "Moss — green paper, ochre beyond",
    paper: "#ccd4c3",
    ink: "#1b231a",
    beyond: "#d0913a",
  },
  plum: {
    label: "Plum — aubergine ink on bone, violet beyond",
    paper: "#e7e1e4",
    ink: "#241a2b",
    beyond: "#77518a",
  },
};

export const DEFAULT_PALETTE = "clay";

const root = document.documentElement;
const names = Object.keys(PALETTES);

/** "#dac9a4" -> "218 201 164", the form `rgb(... / 88%)` wants. */
const channels = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/* ── reading the live values ──────────────────────────────────────── */

/*
 * The canvas layers cannot use `var(--ink)`, so they ask here. Read from
 * computed style rather than from PALETTES so that anything set by hand in
 * devtools takes effect too — which is the whole point of a tuning knob. The
 * fallbacks are the default palette, for the tools under `experiments/` that
 * import `robot.js` without loading the site's stylesheet.
 */
let cache = null;

const readVar = (name, fallback) =>
  getComputedStyle(root).getPropertyValue(name).trim() || fallback;

export function colors() {
  if (!cache) {
    const paper = readVar("--paper", PALETTES[DEFAULT_PALETTE].paper);
    const inkRgb = readVar("--ink-rgb", channels(PALETTES[DEFAULT_PALETTE].ink));
    cache = { paper, inkRgb };
  }
  return cache;
}

/** The ink as a canvas colour, optionally softened. */
export const ink = (alpha = 1) => `rgb(${colors().inkRgb} / ${alpha})`;

/** The paper as a canvas colour. Used as a fill, to hide what is behind. */
export const paper = () => colors().paper;

/* ── switching ────────────────────────────────────────────────────── */

/*
 * The door is an `<img>`, so CSS cannot reach inside it: its ink is baked into
 * the file as a `stroke` attribute. Re-fetching the source and handing the img
 * a recoloured copy is the cheapest way to keep the one raster-ish asset in
 * step with the rest. Skipped for the default palette, whose ink is what the
 * file already carries — the normal path costs nothing.
 */
async function recolourDoor(inkHex) {
  const img = document.querySelector(".room__door");
  if (!img) return;

  const source = img.dataset.source ?? img.getAttribute("src");
  img.dataset.source = source;

  if (inkHex === PALETTES[DEFAULT_PALETTE].ink) {
    img.src = source;
    return;
  }

  img.style.visibility = "hidden";
  try {
    const svg = await fetch(source).then((response) => response.text());
    const recoloured = svg.replace(/stroke="[^"]*"/, `stroke="${inkHex}"`);
    img.src = URL.createObjectURL(new Blob([recoloured], { type: "image/svg+xml" }));
  } catch {
    img.src = source;
  }
  img.style.visibility = "";
}

export function applyPalette(name) {
  const palette = PALETTES[name] ?? PALETTES[DEFAULT_PALETTE];
  const resolved = PALETTES[name] ? name : DEFAULT_PALETTE;

  root.style.setProperty("--paper", palette.paper);
  root.style.setProperty("--ink", palette.ink);
  root.style.setProperty("--ink-rgb", channels(palette.ink));
  root.style.setProperty("--beyond", palette.beyond);
  root.dataset.palette = resolved;
  cache = null;

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", palette.paper);

  recolourDoor(palette.ink);
  return resolved;
}

export function currentPalette() {
  return root.dataset.palette ?? DEFAULT_PALETTE;
}

/* ── choosing one ─────────────────────────────────────────────────── */

const STORE_KEY = "palette";

const stored = () => {
  try {
    return localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
};

const remember = (name) => {
  try {
    localStorage.setItem(STORE_KEY, name);
  } catch {
    /* private mode; the URL still works */
  }
};

const asked = new URLSearchParams(location.search).get("palette");
applyPalette(asked ?? stored() ?? DEFAULT_PALETTE);
if (asked) remember(currentPalette());

/* Shift+P steps through them, so alternatives can be compared against the live
 * scene rather than against swatches. */
window.addEventListener("keydown", (event) => {
  if (event.key !== "P" || event.metaKey || event.ctrlKey || event.altKey) return;
  const next = names[(names.indexOf(currentPalette()) + 1) % names.length];
  applyPalette(next);
  remember(next);
  console.log(`palette: ${next} — ${PALETTES[next].label}`);
});
