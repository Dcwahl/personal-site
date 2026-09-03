/**
 * The robot's route across the room.
 *
 * Kept apart from `robot.js`, which knows how to *be* a robot but nothing about
 * where it is going. This file owns the choreography: the approach from behind
 * the doorway, the path into the room, and how it arrives facing the viewer.
 *
 * Distance along the route is spent, never set. It comes from `distanceWalked`,
 * which is itself solved from the gait, so the robot covers ground at exactly
 * the rate its feet carry it however the route bends.
 */

import { distanceWalked, robotScale, gaitTable, buildRobot, placeRobot } from "./robot.js?v=1";
import {
  doorFootprint,
  CAMERA_IN_ROOM,
  project,
  mockupToScreen,
  toCameraSpace,
  projectCameraSpace,
} from "./camera.js?v=1";

/**
 * Heading, in degrees, from a point on the floor toward the camera.
 *
 * Worth deriving rather than hard-coding: the right answer swings from about
 * 15 degrees at the far end of a full-length route to nearly 30 on a short one,
 * so a single constant is only ever correct for one route length.
 */
export const headingToCamera = ({ x, z }) =>
  (Math.atan2(CAMERA_IN_ROOM.z - z, CAMERA_IN_ROOM.x - x) * 180) / Math.PI;

/**
 * Pull the final handle back down the line the robot should be facing when it
 * arrives.
 *
 * A cubic's tangent at the end is `to - control2`, so aiming that handle at the
 * camera makes the path's own heading deliver the turn. The robot arrives
 * already looking at the viewer and never pivots on the spot — which is both
 * one less thing to animate and, for a wind-up toy, the more honest motion: a
 * clockwork walker turns by walking in an arc, because that is all it can do.
 */
function aimedHandle(to, length) {
  const radians = (headingToCamera(to) * Math.PI) / 180;
  return {
    x: to.x - length * Math.cos(radians),
    z: to.z - length * Math.sin(radians),
  };
}

/**
 * Control points for the walk, in room coordinates.
 *
 * It approaches and leaves the doorway square to the wall, because that is the
 * only way through a door, then curves toward the middle of the floor.
 *
 * Both handles scale with `reach`. That keeps the curve's *shape* fixed as the
 * route shortens instead of letting it degenerate at one end: a handle that
 * stays long on a short route makes the path swing away from the camera first
 * and come back, and one that stays short makes the whole turn happen in the
 * last two steps as a hook. Scaled, the turn stays monotone and peaks around
 * 6 degrees per step at every length worth using.
 */
export function doorRoute(
  reach = 1,
  { arrive = "camera", entryDistance = 0 } = {},
) {
  const { nearJamb, farJamb } = doorFootprint();
  const threshold = (nearJamb + farJamb) / 2;
  const from = { x: threshold, z: 0 };

  /* `reach` slides the destination back toward the doorway. A small toy with
   * short legs genuinely needs a lot of steps to cross a whole room, so how
   * far it walks is one of the few honest ways to spend less time doing it. */
  const to = {
    x: threshold + (4.6 - threshold) * reach,
    z: 3.55 * reach,
  };

  return {
    /* Optional straight approach from behind the wall. Its heading is the same
     * as the cubic's first tangent, so the two pieces join without a turn. */
    entry:
      entryDistance > 0
        ? { from: { x: threshold, z: -entryDistance }, to: from }
        : null,
    from,
    control1: { x: threshold, z: Math.max(0.5, 1.35 * reach) },
    // "wall" is the original arrival: square to the room, turn on the spot
    // afterwards. Kept so the two can be compared rather than replaced.
    control2:
      arrive === "camera"
        ? aimedHandle(to, 1.8 * reach)
        : { x: to.x - 0.45, z: to.z - 0.8 },
    to,
    arrive,
  };
}

const cubic = (a, b, c, d, t) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

/**
 * Arc-length parameterise the straight entry and curve as one route.
 *
 * A Bezier's parameter is not distance — it runs fast through the straight
 * stretches and slow round the bend — so walking at constant t would change
 * pace as the path curved, and the feet would skate again after all the work
 * spent stopping them. Sampling into a cumulative length table and inverting it
 * means one step covers one step's worth of ground anywhere on the route.
 */
export function buildRoute(spec = doorRoute(), samples = 600) {
  const point = (t) => ({
    x: cubic(spec.from.x, spec.control1.x, spec.control2.x, spec.to.x, t),
    z: cubic(spec.from.z, spec.control1.z, spec.control2.z, spec.to.z, t),
  });

  const lengths = [0];
  let previous = point(0);
  for (let i = 1; i <= samples; i += 1) {
    const here = point(i / samples);
    lengths.push(lengths[i - 1] + Math.hypot(here.x - previous.x, here.z - previous.z));
    previous = here;
  }
  const curveLength = lengths[samples];
  const entryLength = spec.entry
    ? Math.hypot(
        spec.entry.to.x - spec.entry.from.x,
        spec.entry.to.z - spec.entry.from.z,
      )
    : 0;
  const length = entryLength + curveLength;

  const tAt = (distance) => {
    if (distance <= 0) return 0;
    if (distance >= curveLength) return 1;
    let low = 0;
    let high = samples;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (lengths[mid] <= distance) low = mid;
      else high = mid;
    }
    const span = lengths[high] - lengths[low] || 1;
    return (low + (distance - lengths[low]) / span) / samples;
  };

  const at = (distance) => {
    if (spec.entry && distance < entryLength) {
      const along = Math.max(0, distance) / entryLength;
      const dx = spec.entry.to.x - spec.entry.from.x;
      const dz = spec.entry.to.z - spec.entry.from.z;
      return {
        x: spec.entry.from.x + dx * along,
        z: spec.entry.from.z + dz * along,
        heading: (Math.atan2(dz, dx) * 180) / Math.PI,
      };
    }

    const t = tAt(distance - entryLength);
    const here = point(t);
    // Heading comes off the path itself, the way flight.js reads the plane's
    // attitude from its own trajectory rather than storing it separately.
    const step = 1e-3;
    const behind = point(Math.max(0, t - step));
    const ahead = point(Math.min(1, t + step));
    return {
      ...here,
      heading: (Math.atan2(ahead.z - behind.z, ahead.x - behind.x) * 180) / Math.PI,
    };
  };

  return { at, length, entryLength, curveLength, point, spec };
}

/* ── landing on the beat ──────────────────────────────────────────── */

/** One step's worth of ground, in room units. */
export const stepLength = (robot) =>
  (gaitTable(robot.params).perCycle / 2) * robotScale(robot);

/**
 * Nudge `reach` until the route is a whole number of steps long.
 *
 * The gait is mirror-symmetric, so a half cycle covers exactly the same ground
 * whichever foot leads — measured at 0.21424 local units from any starting
 * phase, not approximately. Ending the route on a multiple of that puts the
 * final footfall on the beat where the feet come together, which is the whole
 * of the settle: the robot reads as having stopped rather than as having run
 * out of animation, with no amplitude decay to build or to keep out of the
 * memoised gait table.
 *
 * Route length rises monotonically with reach, so a bisection lands on the
 * nearest whole step exactly. The destination moves by at most half a step to
 * get there, which is a few pixels on screen.
 */
export function quantiseReach(robot, reach, options = {}) {
  const { maxReach = Infinity } = options;
  const step = stepLength(robot);
  const lengthAt = (value) => buildRoute(doorRoute(value, options)).length;

  const reachFor = (target) => {
    let low = 0.05;
    let high = Math.max(2, reach * 1.5);
    for (let i = 0; i < 40; i += 1) {
      const mid = (low + high) / 2;
      if (lengthAt(mid) < target) low = mid;
      else high = mid;
    }
    return (low + high) / 2;
  };

  // Rounding up can push past a cap the caller set, so drop a step rather than
  // quietly exceed it — a cap on reach is a cap on how big the robot arrives.
  let steps = Math.max(1, Math.round(lengthAt(reach) / step));
  let result = reachFor(steps * step);
  while (steps > 1 && result > maxReach) {
    steps -= 1;
    result = reachFor(steps * step);
  }
  return result;
}

/* ── fitting the performance to the viewport ──────────────────────── */

/**
 * How far the route is allowed to stretch.
 *
 * The cap is not about screen position, it is about size: the route runs toward
 * the camera, so a longer one arrives *bigger*. At reach 1.25 the robot stands
 * about 92% of the door's height; unclamped, a 32:9 viewport wants 1.43 and the
 * robot arrives taller than the door it came out of. Everything from a portrait
 * phone through 21:9 lands dead centre inside these limits, so the trade only
 * ever bites on the extreme wide end.
 */
export const REACH_LIMITS = { min: 0.3, max: 1.25 };

/**
 * How fast it is allowed to walk, in steps per second.
 *
 * Holding a flat duration at every aspect needs cadence 1.4 to 6.2, which is a
 * slow amble at one end and a scramble at the other — the same toy visibly
 * changing speed with the window. Clamping instead lets the duration float
 * (about 2.7s to 6.1s across real viewports) and keeps the walk recognisably
 * the same walk.
 */
export const CADENCE_LIMITS = { min: 2.6, max: 4.4 };

export const TARGET_SECONDS = 5;

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

/**
 * Screen x of the middle of the robot's silhouette, standing settled at the end
 * of a route of this length.
 *
 * Not the same as the screen x of the destination itself. The robot's local
 * origin is not its visual centre — it stands turned toward the camera, so its
 * depth projects asymmetrically — and the ink ends up 10 to 53 px left of the
 * spot underfoot depending on how far it walked. Aiming the point on the floor
 * would leave the robot visibly left of centre on a wide screen.
 *
 * Measured at `START_PHASE`, which is where the walk both begins and ends: feet
 * together, arms and key where they will actually be when it stops.
 */
function silhouetteX(robot, scene, reach, options) {
  const to = doorRoute(reach, options).to;
  const settled = buildRobot({ ...robot.params, phase: START_PHASE });
  const toScreen = mockupToScreen(scene);

  let low = Infinity;
  let high = -Infinity;
  for (const solid of placeRobot(settled, { x: to.x, z: to.z, facing: headingToCamera(to), travel: 0 })) {
    for (const quad of solid.quads) {
      for (const vertex of quad.points) {
        const x = toScreen(project(vertex)).x;
        low = Math.min(low, x);
        high = Math.max(high, x);
      }
    }
  }
  return (low + high) / 2;
}

/**
 * The reach that puts the robot under `targetX` on screen.
 *
 * Bisected rather than solved: screen x falls monotonically as reach grows
 * (1312 mockup px at reach 0.2 down to 384 at 1.2), so a bisection is exact
 * enough and stays honest about `buildScene`'s clamp on the corner, which a
 * closed form in aspect ratio quietly ignores at the extremes.
 *
 * Pass a `robot` to aim its silhouette; without one this aims the point on the
 * floor it will be standing on, which is off by up to a robot's half-width.
 */
export function reachForScreenX(scene, targetX, options = {}) {
  const toScreen = mockupToScreen(scene);
  const screenX = options.robot
    ? (reach) => silhouetteX(options.robot, scene, reach, options)
    : (reach) => toScreen(project({ ...doorRoute(reach, options).to, y: 0 })).x;

  let low = REACH_LIMITS.min;
  let high = REACH_LIMITS.max;
  if (screenX(low) < targetX) return low;
  if (screenX(high) > targetX) return high;

  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    if (screenX(mid) > targetX) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/**
 * Fit the whole walk to a viewport: how far, how many steps, how fast.
 *
 * Duration is exactly `steps / cadence` — the route is a whole number of steps
 * by construction, and two steps make a cycle, so the cycles cancel.
 */
export function planRoute(robot, scene, targetX, options = {}) {
  const { seconds = TARGET_SECONDS, snap = true, entrySteps = 0 } = options;
  const routeOptions = {
    ...options,
    entryDistance:
      options.entryDistance ?? entrySteps * stepLength(robot),
  };

  const wanted = reachForScreenX(scene, targetX, {
    ...routeOptions,
    robot,
  });
  const reach = snap
    ? quantiseReach(robot, wanted, {
        ...routeOptions,
        maxReach: REACH_LIMITS.max,
      })
    : wanted;
  const route = buildRoute(doorRoute(reach, routeOptions));
  const steps = Math.round(route.length / stepLength(robot));
  const cadence = clamp(steps / seconds, CADENCE_LIMITS.min, CADENCE_LIMITS.max);

  return {
    reach,
    route,
    steps,
    cadence,
    seconds: steps / cadence,
    // How far the robot actually lands from where it was aimed. Snapping to
    // whole steps costs under 20px on every viewport measured.
    offCentre: silhouetteX(robot, scene, reach, options) - targetX,
  };
}

/* ── driving it ───────────────────────────────────────────────────── */

/**
 * The phase the walk starts from.
 *
 * 0.25 is where `cos` puts the legs together, so the robot is standing behind
 * the wall before it moves and lands standing when it arrives. Starting at 0
 * instead would have it appear mid-straddle.
 */
export const START_PHASE = 0.25;

/**
 * Total phase at which the performance is over, so a previewer knows when to
 * stop rather than guessing. On an arc route there is no turn to wait for.
 */
export function routeCycles(robot, route, options = {}) {
  const { startPhase = START_PHASE, turnOver = 0.55 } = options;
  const perCycle = gaitTable(robot.params).perCycle * robotScale(robot);
  const tail = route.spec.arrive === "camera" ? 0 : turnOver;
  return startPhase + (route.length + tail) / perCycle;
}

/** Shortest signed turn from one heading to another, in degrees. */
const shortestTurn = (from, to) => (((to - from + 540) % 360) - 180);

/**
 * Where the robot is, and which way it points, for the distance it has walked.
 *
 * Distance is measured from `startPhase` rather than from zero, so the walk
 * begins and ends on a feet-together beat.
 *
 * The turn on the spot is still here and still runs, but on an arc route the
 * path has already delivered the heading, so the residual is under a tenth of a
 * degree and it costs nothing. On the older square-to-the-wall route it is the
 * whole turn: eased rather than linear so it settles instead of stopping dead.
 */
export function routePose(robot, route, options = {}) {
  const { startPhase = START_PHASE, turnOver = 0.55 } = options;
  const scale = robotScale(robot);
  const origin = distanceWalked({ ...robot.params, phase: startPhase }) * scale;
  const travelled = distanceWalked(robot.params) * scale - origin;
  const arrived = travelled >= route.length;
  const here = route.at(Math.min(Math.max(travelled, 0), route.length));

  if (!arrived) return { x: here.x, z: here.z, facing: here.heading, travel: 0, arrived };

  const faceCamera = options.faceCamera ?? headingToCamera(here);
  const overshoot = turnOver > 0 ? Math.min(1, (travelled - route.length) / turnOver) : 1;
  const eased = overshoot * overshoot * (3 - 2 * overshoot);

  return {
    x: here.x,
    z: here.z,
    facing: here.heading + shortestTurn(here.heading, faceCamera) * eased,
    travel: 0,
    arrived,
    turned: eased,
  };
}

/* ── walking back out ─────────────────────────────────────────────── */

/**
 * He cannot leave by walking into the lens, and it is worth writing down why,
 * because it looks like it ought to work and it never can.
 *
 * The camera stands at one door-height. He is 0.4 of one. So he is entirely
 * below the horizon, and everything below the horizon projects *toward* the
 * horizon as it approaches — walking straight at the camera his crown goes
 * y 446, 441, 435, converging on the horizon and never reaching it. His feet
 * leave the bottom of the frame a step and a half in and his head simply stays
 * in the middle of the picture getting wider, until the geometry detonates on
 * the camera plane. There is no near plane in `camera.js` to catch that.
 *
 * So he leaves the way anyone walks past you: off to one side. Thirty degrees
 * takes him off the left edge in about eleven steps with the nearest vertex
 * still 1.6 door-heights in front of the lens, and it reads as the same
 * gesture — he comes at the camera and then goes by it.
 *
 * The turn is delivered by an arc rather than a pivot, for the reason
 * `aimedHandle` gives: a clockwork walker turns by walking, because that is all
 * it can do. The first handle runs along the arrival heading, so the exit
 * leaves tangent to the walk that fed it and there is no kink at the stop.
 */
export function exitRoute(route, { turn = 30, span = 4, bend = 0.45 } = {}) {
  const from = route.at(route.length);
  const unit = (degrees) => {
    const radians = (degrees * Math.PI) / 180;
    return { x: Math.cos(radians), z: Math.sin(radians) };
  };
  const arriving = unit(from.heading);
  const leaving = unit(from.heading + turn);
  const to = { x: from.x + leaving.x * span, z: from.z + leaving.z * span };

  return buildRoute({
    from: { x: from.x, z: from.z },
    control1: {
      x: from.x + arriving.x * bend * span,
      z: from.z + arriving.z * bend * span,
    },
    control2: { x: to.x - leaving.x * bend * span, z: to.z - leaving.z * bend * span },
    to,
    arrive: "camera",
  });
}

/**
 * Two routes end to end, presented as one, with the second one truncated to
 * however much of it is actually walked.
 *
 * Everything downstream keeps working because the result is still a route —
 * same `at`, same units, a longer `length`. `routePose` clamps to `length` and
 * would otherwise park him at the arrival treading air.
 */
export function extendRoute(route, exit, along = exit.length) {
  return {
    ...route,
    length: route.length + along,
    exitFrom: route.length,
    at: (distance) =>
      distance <= route.length ? route.at(distance) : exit.at(distance - route.length),
  };
}

/**
 * The exit arc, and how far along it he has to get before he is gone.
 *
 * Scanned forward rather than bisected. "Off screen" is not monotone in
 * distance here: he leaves the frame and then, if the arc is long enough,
 * passes behind the camera, where the projection turns inside out and every
 * predicate about pixels becomes meaningless. A bisection reads that far side
 * as "not gone" and walks the bracket into it. So this takes the *first*
 * arc-length at which he is off frame with every vertex still `margin` in
 * front of the lens, and it widens the arc only if that never happens.
 */
export function planExit(robot, route, scene, options = {}) {
  const {
    margin = 0.5,
    /* Tried in order, gentlest first, so the motion stays as easy as the
     * viewport allows. How sharply he has to turn depends on how close he
     * finished: from the far side of the room 30 degrees clears the frame
     * everywhere, but from the near arrival the paper study walks him to — 2.4
     * door-heights, where he fills most of the picture — a shallow turn keeps
     * him crossing the frame long enough to reach the lens first, and 2560,
     * 3840 and 844x390 all fail at 30. 50 clears every viewport tested. */
    turns = [30, 40, 50, 65],
    spans = [4, 5, 6, 7],
    resolution = 0.02,
    /* One step's ground, if the exit should land on a whole number of them.
     * Rounding *outside* this function quietly walks him past the point that
     * was checked — up to a step closer to the lens than the margin allows —
     * so the rounding belongs in here, where the rounded point can be verified
     * too. */
    step = null,
  } = options;
  const toScreen = mockupToScreen(scene);

  /** Is every vertex still `margin` in front of the lens at this point? */
  const clearOfLens = (exit, along) => {
    const here = exit.at(along);
    for (const solid of placeRobot(robot, { ...here, facing: here.heading, travel: 0 })) {
      for (const quad of solid.quads) {
        for (const vertex of quad.points) {
          if (toCameraSpace(vertex).z < margin) return false;
        }
      }
    }
    return true;
  };

  const goneAt = (exit) => {
    for (let along = 0; along <= exit.length; along += resolution) {
      const here = exit.at(along);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      let safe = true;
      for (const solid of placeRobot(robot, { ...here, facing: here.heading, travel: 0 })) {
        for (const quad of solid.quads) {
          for (const vertex of quad.points) {
            const camSpace = toCameraSpace(vertex);
            if (camSpace.z < margin) { safe = false; break; }
            const point = toScreen(projectCameraSpace(camSpace));
            x0 = Math.min(x0, point.x); x1 = Math.max(x1, point.x);
            y0 = Math.min(y0, point.y); y1 = Math.max(y1, point.y);
          }
          if (!safe) break;
        }
        if (!safe) break;
      }
      if (!safe) return null;
      if (x0 > window.innerWidth || x1 < 0 || y0 > window.innerHeight || y1 < 0) return along;
    }
    return null;
  };

  for (const turn of options.turn !== undefined ? [options.turn] : turns) {
    for (const span of spans) {
      const exit = exitRoute(route, { turn, span });
      const found = goneAt(exit);
      if (found === null) continue;

      if (step === null) return { exit, along: found, steps: found / step, span, turn };

      const steps = Math.ceil(found / step);
      const along = Math.min(steps * step, exit.length);
      if (!clearOfLens(exit, along)) continue;
      return { exit, along, steps, span, turn };
    }
  }
  return null;
}
