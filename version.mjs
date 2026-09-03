/**
 * Stamp a cache-busting version onto every asset URL the published site loads.
 *
 *   node version.mjs          bump to the next number
 *   node version.mjs 7        set it explicitly
 *   node version.mjs --check  print the current version and exit
 *
 * Run it before `wispctl deploy`, and commit the result.
 *
 * Why this exists: Wisp serves `cache-control: public, max-age=600`, and the
 * file paths never change between deploys. So for ten minutes after a deploy a
 * returning visitor can hold a stale `index.html` and fetch fresh assets, or
 * the reverse — and a fresh `index.html` paired with a stale `styles.css`
 * renders as a completely unstyled page. Bumping N makes every URL new, so the
 * failure becomes consistent-but-old instead of mixed-and-broken.
 *
 * It stamps the ES module imports too, not just the tags in `index.html`. That
 * is the part it would be easy to skip and wrong to: `about.js?v=7` still
 * imports `./paper.js`, and if only the entry points were versioned the browser
 * would happily pair a new entry with a module it cached an hour ago. Every
 * relative specifier in the graph has to carry the same N.
 *
 * The studies under `experiments/` get stamped too, even though `.wispignore`
 * keeps them off the published site. Not for caching — for module identity. A
 * tool that imports `../../robot.js` while `paper.js` imports `./robot.js?v=7`
 * is asking the browser for two different URLs, and it will duly instantiate
 * the module twice. Nothing there holds state that would corrupt, but a
 * duplicated module graph is the kind of thing that is invisible until it is
 * baffling, and agreeing on one specifier costs nothing.
 */

import { readFileSync, writeFileSync } from "node:fs";

/** Everything Wisp serves. Order is irrelevant; the same N goes on all of it. */
const FILES = [
  "index.html",
  "about.js",
  "camera.js",
  "door.js",
  "flight.js",
  "paper.js",
  "robot.js",
  "room.js",
  "scene.js",
  "trail.js",
  "walk.js",
  // Unpublished, but stamped so every specifier resolves to the same module.
  "experiments/tools/paper-sequence.html",
  "experiments/tools/paper-probe.html",
  "experiments/tools/robot-tuner.html",
  "experiments/tools/trail-tuner.html",
];

/**
 * The URLs worth versioning: the tags `index.html` loads, and every relative
 * import between modules. Each pattern keeps the path in group 1 and drops any
 * `?v=` already there, so running this twice is the same as running it once.
 */
const PATTERNS = [
  // <link rel="stylesheet" href="styles.css">
  /(href=")([\w./-]+\.css)(?:\?v=\d+)?(")/g,
  // <script src="about.js" type="module">, <img src="door.svg">
  /(src=")([\w./-]+\.(?:js|svg|png|ico))(?:\?v=\d+)?(")/g,
  // import { x } from "./paper.js", or "../../paper.js" from a study
  /(from ")((?:\.\.?\/)+[\w./-]+\.js)(?:\?v=\d+)?(")/g,
];

const current = () => {
  const html = readFileSync("index.html", "utf8");
  const found = html.match(/\?v=(\d+)/);
  return found ? Number(found[1]) : 0;
};

const arg = process.argv[2];
if (arg === "--check") {
  console.log(current());
  process.exit(0);
}

const version = arg === undefined ? current() + 1 : Number(arg);
if (!Number.isInteger(version) || version < 1) {
  console.error(`Not a version: ${arg}`);
  process.exit(1);
}

let stamped = 0;
for (const file of FILES) {
  const before = readFileSync(file, "utf8");
  let after = before;
  for (const pattern of PATTERNS) {
    after = after.replace(pattern, (_, open, path, close) => {
      stamped += 1;
      return `${open}${path}?v=${version}${close}`;
    });
  }
  if (after !== before) writeFileSync(file, after);
}

console.log(`v=${version} on ${stamped} URLs across ${FILES.length} files`);
