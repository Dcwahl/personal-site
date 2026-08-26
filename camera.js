/**
 * The room's 3D camera.
 *
 * Recovered from the existing art, not chosen. `scene.js` places the door as a
 * 2D sprite and never needs to know what camera drew it — but anything that has
 * to *stand in* the room does, or it will disagree with the hand-drawn
 * perspective the moment it moves.
 *
 * Everything below is derived from constants already in `scene.js` and
 * `door.svg`, and every step cross-checks against something independent:
 *
 *   1. The door's horizontal edges (top slope -0.21, base slope 0.19667)
 *      converge at (122.17, 495.61) in mockup space. The right wall's floor
 *      seam, extended, passes through y = 495.61 at that same x. The door and
 *      the floor share a vanishing point, which they must, since the door is
 *      flat against the wall. Agreement: 0.00px.
 *
 *   2. That fixes the horizon at y = 495.61. The mockup is 992 tall, so its
 *      centre is y = 496 — the principal point is the image centre, to 0.4px.
 *
 *   3. Two perpendicular horizontal directions with vanishing points V1, V2
 *      satisfy (V1 - pp) . (V2 - pp) = -f^2. The left wall's floor seam puts
 *      its vanishing point at (6553.4, 495.6), giving f = 1965.8px. The two
 *      recovered wall axes come out perpendicular to six decimal places.
 *
 *   4. Under that camera, both door jambs give height x depth-divisor = 393.041
 *      — identical, which is the signature of a real rectangle in a real
 *      perspective. That also fixes the only free ratio left: the door is
 *      2.0590 camera-heights tall.
 *
 * Camera height is therefore the natural unit and is taken as 1.
 */

const MOCKUP = { width: 1586, height: 992 };

export const ROOM_CAMERA = {
  focalLength: 1965.8,
  principal: { x: MOCKUP.width / 2, y: 495.61 },

  /** Height of the door, in camera-heights. The scale reference for the room. */
  doorHeight: 2.059,

  /**
   * The room's far corner, in camera space (x right, y down, z into screen),
   * with the camera at the origin and the floor one unit below it.
   */
  corner: { x: 1.548, y: 1, z: 10.298 },

  /**
   * Room axes in camera space, both pointing *toward* the viewer — the
   * direction a thing walks when it comes out of the corner.
   *
   * `alongRightWall` runs under the door; `alongLeftWall` runs out to the left.
   * The two vanishing points give these directly, negated because a vanishing
   * point is the far end of the axis and we want the near one.
   */
  alongRightWall: { x: 0.32297, y: 0, z: -0.94641 },
  alongLeftWall: { x: -0.94641, y: 0, z: -0.32297 },
  up: { x: 0, y: -1, z: 0 },
};

/**
 * Place a point given in room coordinates into camera space.
 *
 * Room coordinates are metres-of-camera-height from the far floor corner:
 * `x` toward the viewer along the right wall (the wall with the door), `z`
 * toward the viewer along the left wall, `y` straight up off the floor.
 */
export function toCameraSpace({ x = 0, y = 0, z = 0 }) {
  const { corner, alongRightWall: r, alongLeftWall: l, up } = ROOM_CAMERA;

  return {
    x: corner.x + r.x * x + l.x * z + up.x * y,
    y: corner.y + r.y * x + l.y * z + up.y * y,
    z: corner.z + r.z * x + l.z * z + up.z * y,
  };
}

/** Camera space -> mockup pixels. Also returns depth, for painter sorting. */
export function projectCameraSpace(point) {
  const { focalLength, principal } = ROOM_CAMERA;

  return {
    x: principal.x + (focalLength * point.x) / point.z,
    y: principal.y + (focalLength * point.y) / point.z,
    depth: point.z,
  };
}

/**
 * Where the camera itself stands, in room coordinates. Solving the room basis
 * backwards for the camera-space origin; needed to decide which side of a
 * separating plane the viewer is on.
 */
export const CAMERA_IN_ROOM = (() => {
  const { corner, alongRightWall: r, alongLeftWall: l } = ROOM_CAMERA;
  const det = r.x * l.z - r.z * l.x;
  return {
    x: (-corner.x * l.z + corner.z * l.x) / det,
    y: 1,
    z: (-r.x * corner.z + r.z * corner.x) / det,
  };
})();

/** Room coordinates -> mockup pixels. */
export const project = (point) => projectCameraSpace(toCameraSpace(point));

/**
 * Mockup pixels -> screen pixels, for a scene from `buildScene`.
 *
 * The room image is a rigid, uniformly scaled copy of the mockup pinned at the
 * corner, so this is the same mapping `scene.js` applies to the door and the
 * seams. Rebuilt from the scene's own numbers rather than exported from it, so
 * there is one definition of the room's placement and it stays in `scene.js`.
 */
export function mockupToScreen(scene) {
  return ({ x, y, depth }) => ({
    x: scene.corner.x + (x - ROOM_CAMERA_CORNER_MOCKUP.x) * scene.scale,
    y: scene.corner.y + (y - ROOM_CAMERA_CORNER_MOCKUP.y) * scene.scale,
    depth,
  });
}

/** The corner's mockup position, as measured in `scene.js`. */
const ROOM_CAMERA_CORNER_MOCKUP = { x: 1088.5, y: 686.5 };

/**
 * Where the door stands, in room coordinates — solved from the x positions
 * `scene.js` composed it at, so the robot can be placed relative to the door
 * without either of them being measured by eye.
 */
export function doorFootprint() {
  const solve = (mockupX) => {
    // Invert the projection along the right wall's floor line (y = 0, z = 0).
    const { focalLength: f, principal, corner, alongRightWall: r } = ROOM_CAMERA;
    const offset = mockupX - principal.x;
    // (corner.x + r.x t) f = offset (corner.z + r.z t)
    return (
      (offset * corner.z - f * corner.x) / (f * r.x - offset * r.z)
    );
  };

  return { nearJamb: solve(1343.65), farJamb: solve(1493.42) };
}
