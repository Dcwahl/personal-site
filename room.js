import { buildScene } from "./scene.js";
import { DOOR_PANEL, EDGE_ON, openingPath, panelPath } from "./door.js";

const svg = document.querySelector(".room__seams");
const door = document.querySelector(".room__door");
const doorway = document.querySelector(".room__doorway");
const doorPart = (name) => doorway.querySelector(`[data-door="${name}"]`);

const path = (points) =>
  points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");

/* How far the door currently stands open, in degrees. The art is drawn ajar,
 * so this starts at the angle the ink already shows rather than at zero. */
let doorAngle = DOOR_PANEL.rest;
let scene = null;

function layoutDoorway() {
  const opening = openingPath(scene);
  doorPart("hole").setAttribute("d", opening);
  doorPart("clip").setAttribute("d", opening);
  doorPart("panel").setAttribute("d", panelPath(scene, doorAngle));
}

export function setDoorAngle(degrees) {
  doorAngle = degrees;
  if (scene) doorPart("panel").setAttribute("d", panelPath(scene, doorAngle));
}

export function layoutRoom() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  scene = buildScene(width, height);

  for (const target of [svg, doorway]) {
    target.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  for (const [name, points] of Object.entries(scene.seams)) {
    svg.querySelector(`[data-seam="${name}"]`).setAttribute("d", path(points));
  }

  svg.style.setProperty("--seam-weight", `${scene.inkWeight.toFixed(2)}`);
  doorway.style.setProperty("--seam-weight", `${scene.inkWeight.toFixed(2)}`);

  const { a, b, c, d, e, f } = scene.door.matrix;
  door.style.width = `${scene.door.natural.width}px`;
  door.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;

  layoutDoorway();
  window.dispatchEvent(new CustomEvent("room:layout", { detail: scene }));
  return scene;
}

/** The scene as last laid out. `about.js` needs it to place the robot. */
export const getScene = () => scene;

/** How far the panel currently stands open. `about.js` clips the robot to the
 * gap beside it, which is what makes the door reveal him. */
export const getDoorAngle = () => doorAngle;

/* ── opening it ───────────────────────────────────────────────────── */

const stillFrames = matchMedia("(prefers-reduced-motion: reduce)");

/* Ease out only. A door has a latch to leave and nothing to slow it at the far
 * end, so easing both ends reads as hesitant. */
const eased = (t) => 1 - (1 - t) * (1 - t) * (1 - t);

let swing = null;

/**
 * Swing the door, easing across the part of the travel that can be seen.
 *
 * Only `rest`..`EDGE_ON` renders anything; beyond that the panel is edge-on and
 * clipped away. So the animation is run over that span and the angle is left at
 * the real target afterwards — the door ends up properly open, and none of the
 * duration is spent on invisible degrees.
 */
export function swingDoor(to, seconds = 1.1) {
  if (swing) cancelAnimationFrame(swing.frame);
  if (stillFrames.matches) return setDoorAngle(to);

  const seen = (angle) => Math.min(angle, EDGE_ON);
  const from = seen(doorAngle);
  const target = seen(to);
  const started = performance.now();

  swing = {
    frame: requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - started) / (seconds * 1000));
      setDoorAngle(t < 1 ? from + (target - from) * eased(t) : to);
      if (t < 1) swing.frame = requestAnimationFrame(step);
      else swing = null;
    }),
  };
}

export const openDoor = () => swingDoor(DOOR_PANEL.open);
export const closeDoor = () => swingDoor(DOOR_PANEL.rest);

window.addEventListener("resize", layoutRoom);
layoutRoom();

/* `?door=40` holds the panel at a fixed angle. The whole swing is over in about
 * a second, and a headless screenshot lands wherever it lands, so there is
 * otherwise no way to look at a partly-open door. */
const held = Number(new URLSearchParams(location.search).get("door"));
if (Number.isFinite(held) && held !== 0) setDoorAngle(held);
