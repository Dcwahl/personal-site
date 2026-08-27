/**
 * The robot's route across the room.
 *
 * Kept apart from `robot.js`, which knows how to *be* a robot but nothing about
 * where it is going. This file owns the choreography: the path out of the
 * doorway, the heading along it, and the turn to face the viewer at the end.
 *
 * Distance along the route is spent, never set. It comes from `distanceWalked`,
 * which is itself solved from the gait, so the robot covers ground at exactly
 * the rate its feet carry it however the route bends.
 */

import { distanceWalked, robotScale } from "./robot.js";
import { doorFootprint } from "./camera.js";

/**
 * Control points for the walk, in room coordinates.
 *
 * It leaves the doorway square to the wall, because that is the only way out
 * of a door, then curves toward the middle of the floor. Both handles are
 * therefore perpendicular to their walls: the first pushes straight out along
 * z, the second brings it in facing the room rather than the corner.
 */
export function doorRoute() {
  const { nearJamb, farJamb } = doorFootprint();
  const threshold = (nearJamb + farJamb) / 2;

  return {
    from: { x: threshold, z: 0 },
    control1: { x: threshold, z: 1.35 },
    control2: { x: 4.15, z: 2.75 },
    to: { x: 4.6, z: 3.55 },
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

/** Shortest signed turn from one heading to another, in degrees. */
const shortestTurn = (from, to) => (((to - from + 540) % 360) - 180);

/**
 * Where the robot is, and which way it points, for the distance it has walked.
 *
 * Past the end of the route it stops and turns on the spot to face the camera.
 * The turn is eased rather than linear so it settles instead of stopping dead,
 * which is the one moment a wind-up toy is allowed to look deliberate.
 */
export function routePose(robot, route, options = {}) {
  const { faceCamera = 15, turnOver = 0.55 } = options;
  const travelled = distanceWalked(robot.params) * robotScale(robot);
  const arrived = travelled >= route.length;
  const here = route.at(Math.min(travelled, route.length));

  if (!arrived) return { x: here.x, z: here.z, facing: here.heading, travel: 0, arrived };

  const overshoot = Math.min(1, (travelled - route.length) / turnOver);
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
