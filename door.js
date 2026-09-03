/**
 * The door's moving panel.
 *
 * `scene.js` places the door as a flat sprite and deliberately never needs to
 * know what camera drew it. The panel is the one part that does: it swings
 * about a vertical axis, so its corners have to travel through the room's real
 * camera or they will disagree with the hand-drawn perspective the moment they
 * move. `camera.js` recovered that camera from this same art, so the two agree.
 *
 * The art is drawn with the door already ajar, which is what makes the panel
 * solvable: it is a rectangle seen at an unknown angle, and there is exactly
 * one rectangle-plus-angle that projects to the drawn quad.
 *
 * Fitted from the two *base* corners only — un-projected onto the floor, which
 * is where a door's foot has to be. Width, hinge and angle fall out of that
 * pair. The two *top* corners were then held back as a check, and reproject to
 * within 0.53 art units of the ink. That is the cross-check: a hand-drawn quad
 * that is not really a swinging rectangle would not close like this.
 */

import { project, mockupToScreen } from "./camera.js?v=1";

export const DOOR_PANEL = {
  /* Room coordinates: x toward the viewer along the right wall, z out from it.
   * The hinge is the jamb nearest the viewer, and the panel opens away. */
  hinge: { x: 3.15718, z: -0.0444 },
  width: 1.00751,
  height: 2.05222,

  /** Degrees open. The art is drawn at `rest`, so this is where it sits. */
  rest: 13.05,

  /**
   * How far it opens.
   *
   * Not a taste call. A panel swung by `theta` still covers `width * cos theta`
   * of its own opening, so the clear gap is what is left over. The robot's body
   * is 0.761 wide (see ROBOT.md), which needs 79 degrees. 85 buys a margin
   * without swinging so far that the panel's own thickness would start to show.
   */
  open: 85,
};

/**
 * The angle past which the panel cannot be seen at all.
 *
 * We are looking along the wall, so the panel turns edge-on to the camera long
 * before it is fully open — its free edge projects onto the hinge, the quad
 * collapses to a line, and everything beyond that is behind the wall and
 * clipped away. Solved rather than eyeballed, because it decides the timing:
 * the whole visible swing is `rest` to here, a quarter of the travel, so
 * easing across the full 85 degrees would spend most of the animation on
 * motion nobody can see.
 *
 * What the eye actually reads is not the panel but the opening behind it
 * widening, from a sliver to the full doorway.
 */
export const EDGE_ON = (() => {
  const hingeX = project({ ...DOOR_PANEL.hinge, y: 0 }).x;
  const freeX = (degrees) => project(panelCorners(degrees)[2]).x;

  let lo = DOOR_PANEL.rest;
  let hi = 90;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (freeX(mid) < hingeX) lo = mid;
    else hi = mid;
  }
  return lo;
})();

/**
 * The visible opening, in the door art's own coordinates.
 *
 * Read off `door.svg`. Which edge bounds it is not the same on all four sides,
 * because the wall has thickness and we are looking along it: the far side and
 * the top show their reveal, so they are bounded by the *inner* edges, while
 * the near side is the one we are looking from and shows none, so it is bounded
 * by the outer jamb. That asymmetry is exactly what the hand-drawn tan strip
 * already depicts.
 */
const OPENING = [
  { x: 21.5, y: 40.4893 },
  { x: 150.5, y: 9.04 },
  { x: 150.5, y: 556.5 },
  { x: 21.5, y: 527.12 },
];

/** The panel's four corners in room coordinates, hinge first, going round. */
export function panelCorners(degrees) {
  const { hinge, width, height } = DOOR_PANEL;
  const turn = (degrees * Math.PI) / 180;
  const free = {
    x: hinge.x - width * Math.cos(turn),
    z: hinge.z - width * Math.sin(turn),
  };

  return [
    { x: hinge.x, y: height, z: hinge.z },
    { x: free.x, y: height, z: free.z },
    { x: free.x, y: 0, z: free.z },
    { x: hinge.x, y: 0, z: hinge.z },
  ];
}

const closedPath = (points) =>
  `${points
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ")}Z`;

/** The opening, in screen pixels. Static — a hole in a wall does not move. */
export function openingPath(scene) {
  const { a, b, c, d, e, f } = scene.door.matrix;
  return closedPath(
    OPENING.map((p) => ({ x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f })),
  );
}

/** The panel at `degrees` open, in screen pixels. */
export function panelPath(scene, degrees) {
  const toScreen = mockupToScreen(scene);
  return closedPath(panelCorners(degrees).map((p) => toScreen(project(p))));
}
