/**
 * The robot's route across the room.
 *
 * Kept apart from `robot.js`, which knows how to *be* a robot but nothing about
 * where it is going. This file owns the choreography: the path out of the
 * doorway, the heading along it, and how it arrives facing the viewer.
 *
 * Distance along the route is spent, never set. It comes from `distanceWalked`,
 * which is itself solved from the gait, so the robot covers ground at exactly
 * the rate its feet carry it however the route bends.
 */

import { distanceWalked, robotScale, gaitTable } from "./robot.js";
import { doorFootprint, CAMERA_IN_ROOM } from "./camera.js";

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
 * It leaves the doorway square to the wall, because that is the only way out of
 * a door, then curves toward the middle of the floor.
 *
 * Both handles scale with `reach`. That keeps the curve's *shape* fixed as the
 * route shortens instead of letting it degenerate at one end: a handle that
 * stays long on a short route makes the path swing away from the camera first
 * and come back, and one that stays short makes the whole turn happen in the
 * last two steps as a hook. Scaled, the turn stays monotone and peaks around
 * 6 degrees per step at every length worth using.
 */
export function doorRoute(reach = 1, { arrive = "camera" } = {}) {
  const { nearJamb, farJamb } = doorFootprint();
  const threshold = (nearJamb + farJamb) / 2;

  /* `reach` slides the destination back toward the doorway. A small toy with
   * short legs genuinely needs a lot of steps to cross a whole room, so how
   * far it walks is one of the few honest ways to spend less time doing it. */
  const to = {
    x: threshold + (4.6 - threshold) * reach,
    z: 3.55 * reach,
  };

  return {
    from: { x: threshold, z: 0 },
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
 * Arc-length parameterise the curve.
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
  const length = lengths[samples];

  const tAt = (distance) => {
    if (distance <= 0) return 0;
    if (distance >= length) return 1;
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
    const t = tAt(distance);
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

  return { at, length, point, spec };
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
  const step = stepLength(robot);
  const lengthAt = (value) => buildRoute(doorRoute(value, options)).length;

  const steps = Math.max(1, Math.round(lengthAt(reach) / step));
  const target = steps * step;

  let low = 0.05;
  let high = Math.max(2, reach * 1.5);
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    if (lengthAt(mid) < target) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/* ── driving it ───────────────────────────────────────────────────── */

/**
 * The phase the walk starts from.
 *
 * 0.25 is where `cos` puts the legs together, so the robot is standing in the
 * open doorway before it moves and lands standing when it arrives. Starting at
 * 0 instead would have it appear mid-straddle.
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
