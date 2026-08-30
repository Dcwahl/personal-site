/**
 * The about sequence: the door opens onto an empty doorway, the robot walks
 * into view from behind the far jamb, then continues to the middle of the
 * screen.
 *
 * Everything hard here was already solved elsewhere and is only being called:
 * `planRoute` sizes the walk to the viewport and hands back the route, the step
 * count, the cadence and the duration in one call; `routePose` turns a phase
 * into a place and a heading; `drawRobot` does the line rendering. This file is
 * the choreography and nothing else.
 */

import { getScene, getDoorAngle, openDoor, closeDoor, setDoorAngle } from "./room.js";
import { DOOR_PANEL, openingPath, panelPath } from "./door.js";
import { mockupToScreen } from "./camera.js";
import { buildRobot, placeRobot, drawRobot, robotDefaults, robotPresets } from "./robot.js";
import {
  planRoute,
  routePose,
  routeCycles,
  START_PHASE,
} from "./walk.js";

const canvas = document.querySelector(".stage--robot");
const context = canvas.getContext("2d");
const stillFrames = matchMedia("(prefers-reduced-motion: reduce)");

/* `D mild` is the body and gait ROBOT.md settled on: the bmo shape, neckless,
 * with the stride spread across cadence, size and leg length so that crossing
 * the room takes about five seconds instead of an honest twenty-five. */
const params = { ...robotDefaults, ...robotPresets["D mild"] };

/* The entrance starts 3.4 steps behind the threshold. That is deep
 * enough for the oblique jamb to hide him completely, while keeping the walk
 * into view under a second at the quicker viewport cadences. */
const ENTRY_STEPS = 3.4;

const TIMING = {
  /** Seconds the door takes to swing. Matches room.js's default. */
  door: 1.1,
  /** Tiny beat on the empty open doorway before he walks into view. */
  beat: 0.2,
  /** Leaning from upright into the walking rock, before the first step. */
  windUp: 0.3,
  /** Rocking to a standstill after the last one. */
  settle: 0.5,
  /** How far along the visible room walk the door starts closing, 0..1. */
  shutAt: 0.2,
  /** How far along the visible room walk his arms finish coming up, 0..1. */
  armsBy: 0.12,
};

let plan = null;
let running = null;

/* ── the route ────────────────────────────────────────────────────── */

function rebuildPlan() {
  const scene = getScene();
  if (!scene) return;
  /* Aimed at the middle of the window. The destination is a floor point and the
   * room's camera has no tilt, so centring it centres him. */
  plan = planRoute(buildRobot(params), scene, window.innerWidth / 2, {
    entrySteps: ENTRY_STEPS,
  });
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* ── drawing him ──────────────────────────────────────────────────── */

/**
 * @param clip clip him to the *gap* — the opening minus the panel — while he is
 *   still in the doorway.
 *
 *   Clipping to the opening alone does not hide him: the shut panel fills the
 *   opening, and the canvas sits above the room, so he would otherwise draw
 *   straight over the door. While the route is behind the threshold, this gap
 *   is the portion of the real doorway through which he can actually be seen.
 */
/**
 * @param rock 0..1 scale on the gait's lean, for the two moments he is not
 *   walking.
 *
 * `roll` is a sine a quarter cycle out of phase with the leg swing, so it peaks
 * exactly where the legs come together — the two can never both be zero. Both
 * ends of the walk sit on that beat: START_PHASE by choice, and the arrival
 * because `quantiseReach` lands the route on a whole number of steps. So the
 * poses either side of the walk are feet-together *and* leaning 15 degrees,
 * which reads as falling over rather than as waiting or stopping. This is the
 * amplitude decay ROBOT.md recorded as never built.
 *
 * It is free, and it is exact. `routePose` always returns `travel: 0`, so
 * `placeRobot` takes the pose as given and never consults `distanceWalked` —
 * which means the pose can be computed once, at full rock, and then reused
 * while only the rendered lean changes. Nothing re-enters the memoised
 * `gaitTable` (36ms cold, and it is keyed on rockAngle, so ramping the
 * parameter itself would rebuild it every frame).
 *
 * @param arms 0..1 scale on `armRaise`, for getting through the door.
 *
 * Held out at 42 degrees he is 140px wide against a 117px opening, so the
 * doorway cuts his arm off. Arms down he is 128px, and the overhang drops from
 * 21px to 10px and moves to one side. This is the fix ROBOT.md prescribed —
 * lower them in the doorway, raise them once clear — and it is free, because
 * `armRaise` is not part of the `gaitTable` cache key the way `rockAngle` is.
 */
function drawRobotAt(
  phase,
  { clip = false, rock = 1, arms = 1, alpha = 1 } = {},
) {
  const scene = getScene();
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  if (!scene || !plan) return;

  // Posed at full rock so the route lands where the gait says it should.
  const pose = routePose(buildRobot({ ...params, phase }), plan.route);
  const robot = buildRobot({
    ...params,
    phase,
    rockAngle: params.rockAngle * rock,
    armRaise: params.armRaise * arms,
  });
  const quads = placeRobot(robot, pose);

  if (clip || alpha !== 1) context.save();
  if (clip) {
    /* Even-odd across the two: inside both counts twice and drops out, which
     * leaves the opening with the panel punched out of it. Intersect with the
     * opening first: once the panel swings past edge-on its projected polygon
     * sits outside the doorway, where it must not become a second clip island. */
    const opening = new Path2D(openingPath(scene));
    const gap = new Path2D(opening);
    gap.addPath(new Path2D(panelPath(scene, getDoorAngle())));
    context.clip(opening);
    context.clip(gap, "evenodd");
  }
  context.globalAlpha = alpha;
  drawRobot(context, quads, mockupToScreen(scene), {
    weight: Math.max(1, scene.scale * 1.35),
  });
  if (clip || alpha !== 1) context.restore();
}

/**
 * Hold the real walk-in for inspection. `along` is 0 behind the wall and 1 at
 * the threshold, matching the opening portion of the live route exactly.
 */
function drawEntryAt(along, { xray = false } = {}) {
  const phase = START_PHASE + (ENTRY_STEPS / 2) * along;

  drawRobotAt(phase, {
    clip: !xray,
    rock: along === 0 ? 0 : 1,
    arms: 0,
    alpha: xray ? 0.48 : 1,
  });
}

const clear = () => context.clearRect(0, 0, window.innerWidth, window.innerHeight);

/* ── the sequence ─────────────────────────────────────────────────── */

export function runAbout() {
  if (running) return;
  rebuildPlan();
  if (!plan) return;

  const robot = buildRobot(params);
  const finish = routeCycles(robot, plan.route);
  const entryFinish = START_PHASE + ENTRY_STEPS / 2;

  if (stillFrames.matches) {
    /* No motion: show the end state. The door is open and he has arrived,
     * which is what the sequence was there to say. */
    openDoor();
    running = { still: true };
    drawRobotAt(finish, { rock: 0 });
    return;
  }

  openDoor();

  const started = performance.now();
  let shut = false;

  running = {
    frame: requestAnimationFrame(function step(now) {
      const elapsed = (now - started) / 1000;
      const waited = TIMING.door + TIMING.beat;
      const walked = elapsed - waited - TIMING.windUp;

      if (elapsed < waited) {
        // He is waiting behind the wall while the door opens onto empty space.
        drawRobotAt(START_PHASE, { clip: true, rock: 0, arms: 0 });
      } else if (walked <= 0) {
        // Lean into the gait out of sight, then enter already walking.
        drawRobotAt(START_PHASE, {
          clip: true,
          rock: (elapsed - waited) / TIMING.windUp,
          arms: 0,
        });
      } else {
        // Two steps make a cycle, so cadence halves into cycles per second.
        const phase = Math.min(finish, START_PHASE + walked * (plan.cadence / 2));

        if (phase < finish) {
          const entering = phase < entryFinish;
          const outside = Math.max(
            0,
            (phase - entryFinish) / (finish - entryFinish),
          );
          drawRobotAt(phase, {
            clip: entering,
            arms: Math.min(1, outside / TIMING.armsBy),
          });
          if (!shut && outside >= TIMING.shutAt) {
            shut = true;
            closeDoor();
          }
        } else {
          // Arrived. Feet are together; let the lean run out of him.
          const over = walked - (finish - START_PHASE) / (plan.cadence / 2);
          const rock = Math.max(0, 1 - over / TIMING.settle);
          drawRobotAt(finish, { rock });
          if (rock === 0) {
            running = { done: true };
            return;
          }
        }
      }
      running.frame = requestAnimationFrame(step);
    }),
  };
}

export function resetAbout() {
  if (running?.frame) cancelAnimationFrame(running.frame);
  running = null;
  closeDoor();
  clear();
}

/* ── wiring ───────────────────────────────────────────────────────── */

window.addEventListener("room:layout", () => {
  resizeCanvas();
  /* Replanning mid-walk slides him along the new route by up to two steps, so
   * the route is frozen once he is moving — see "Resizing mid-walk" in
   * ROBOT.md. Before that, rebuild freely. */
  if (!running) rebuildPlan();
  if (running?.entry) drawEntryAt(running.entry.along, running.entry);
  else if (running?.still || running?.done) {
    drawRobotAt(routeCycles(buildRobot(params), plan.route), { rock: 0 });
  }
});

resizeCanvas();
rebuildPlan();

document.querySelector('.masthead a[href="#about"]')?.addEventListener("click", (event) => {
  event.preventDefault();
  if (running) resetAbout();
  else runAbout();
});

if (location.hash === "#about") runAbout();

/* `?about=0.4` holds a still frame four tenths of the way along the walk, with
 * the door open. The sequence is over in about seven seconds and a headless
 * screenshot lands wherever it lands, so this is the only way to look at a
 * chosen moment of it. `?about=0` is the hidden starting pose behind the wall. */
const query = new URLSearchParams(location.search);
const held = query.get("about");
if (held !== null && plan) {
  const along = Math.max(0, Math.min(1, Number(held) || 0));
  const finish = routeCycles(buildRobot(params), plan.route);
  // An explicit ?door= wins, so the reveal can be inspected part-open.
  if (!query.has("door")) setDoorAngle(DOOR_PANEL.open);
  running = { done: true };
  const atEnd = along === 0 || along === 1;
  const entryAlong = ENTRY_STEPS / plan.steps;
  const outside = Math.max(0, (along - entryAlong) / (1 - entryAlong));
  drawRobotAt(START_PHASE + along * (finish - START_PHASE), {
    clip: along < entryAlong,
    rock: atEnd ? 0 : 1,
    arms: Math.min(1, outside / TIMING.armsBy),
  });
}

/* `?entry=0` holds the real start 3.4 steps behind the threshold;
 * `?entry=0.35` shows the first peek round the far jamb. At zero the correct
 * visitor view is an empty doorway, so `&xray=1` draws the occluded robot at
 * reduced opacity for placement inspection. */
const heldEntry = query.get("entry");
if (heldEntry !== null && plan) {
  const along = Math.max(0, Math.min(1, Number(heldEntry) || 0));
  const entry = { along, xray: query.get("xray") === "1" };
  if (!query.has("door")) setDoorAngle(DOOR_PANEL.open);
  running = { entry };
  drawEntryAt(along, entry);
}
