/**
 * Room geometry.
 *
 * Everything here is measured from redesign-mockup.png (1586 x 992) by
 * scanning the image for ink, so "mockup space" is the shared coordinate
 * system for the room and the door art.
 *
 * The door is a hand-drawn raster: its perspective is baked in and cannot be
 * re-derived. So the door is the source of truth. We place it first, then draw
 * the floor seams *to* its corners — the seam can never disagree with the art.
 */

const MOCKUP = { width: 1586, height: 992 };

const ROOM = {
  // Where the two walls meet the floor. Everything on the right wall is
  // positioned relative to this point.
  corner: { x: 1088.5, y: 686.5 },

  // Fitted from the ink, both dead straight across their whole run.
  leftSlope: -0.03493,
  rightSlope: 0.19754,

  // Corner -> right edge of the mockup. Sets the on-screen size of the right
  // wall, which is the only part of the room that holds anything.
  rightRun: 497.5,

  // Weight of the seam stroke in mockup pixels, matched to the ink in the door
  // art (the Figma export draws at ~1px throughout). This gets multiplied by the scene scale rather than pinned to device
  // pixels: the door is a raster, so its ink thickens and thins as it scales,
  // and a fixed-width seam would visibly drift away from it on large screens.
  inkWeight: 1.0,
};

/**
 * Door sprite. `anchors` are the two bottom corners of the frame, read straight
 * off the endpoints of the jamb paths in door.svg — exact, since the art is
 * vector now rather than something to be measured out of pixels.
 *
 * Their base runs at slope 0.19667 against the floor's 0.19754, 0.05 degrees
 * apart, so placement is essentially a pure translate + scale.
 */
const DOOR = {
  natural: { width: 151, height: 559 },
  anchors: {
    nearBase: { x: 0.5, y: 529.489 },
    farBase: { x: 150.5, y: 558.989 },
  },
};

/**
 * Where those two anchors belong in mockup space — the x positions the door was
 * composed at. Kept separate from `anchors` so the art can live in whatever
 * coordinate space its authoring tool exported, without the placement moving.
 */
const DOOR_PLACEMENT = { nearBaseX: 1343.65, farBaseX: 1493.42 };

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/** Height of the right-wall floor seam at a given mockup x. */
const floorY = (x) => ROOM.corner.y + ROOM.rightSlope * (x - ROOM.corner.x);

/**
 * Solve the similarity transform (uniform scale + rotation + translation) that
 * carries two image-space points onto two scene-space points.
 *
 * Two point-pairs give four equations for four unknowns, so this is exact and
 * closed-form. Treating the points as complex numbers, scale and rotation are
 * just the quotient ds/di — no trig needed. Returns CSS matrix() components.
 */
function solveSimilarity(fromA, fromB, toA, toB) {
  const di = { x: fromB.x - fromA.x, y: fromB.y - fromA.y };
  const ds = { x: toB.x - toA.x, y: toB.y - toA.y };
  const lengthSquared = di.x * di.x + di.y * di.y;

  const a = (ds.x * di.x + ds.y * di.y) / lengthSquared; // scale * cos(theta)
  const b = (ds.y * di.x - ds.x * di.y) / lengthSquared; // scale * sin(theta)

  return {
    a,
    b,
    c: -b,
    d: a,
    e: toA.x - (a * fromA.x - b * fromA.y),
    f: toA.y - (b * fromA.x + a * fromA.y),
  };
}

const applyMatrix = (m, point) => ({
  x: m.a * point.x + m.c * point.y + m.e,
  y: m.b * point.x + m.d * point.y + m.f,
});

/**
 * Build the scene for a viewport.
 *
 * The right-wall slope is a fixed constant and is never recomputed — a raster
 * door's perspective is baked in, so if the floor slope moved the door would
 * stop agreeing with the room. Viewport variation is absorbed by the corner's
 * horizontal position and the overall scale instead. The left wall is empty,
 * so it can stretch as far as it needs to.
 */
export function buildScene(width, height) {
  const scale = height / MOCKUP.height;
  const cornerX = clamp(
    width - ROOM.rightRun * scale,
    width * 0.3,
    width * 0.82,
  );
  const cornerY = ROOM.corner.y * scale;

  // Right-wall content is a rigid, uniformly scaled copy of the mockup pinned
  // at the corner.
  const toScene = (x, y) => ({
    x: cornerX + (x - ROOM.corner.x) * scale,
    y: cornerY + (y - ROOM.corner.y) * scale,
  });

  // Target the door's corners at their drawn x, snapped onto the floor seam.
  // That keeps the door where it was composed while guaranteeing contact.
  const matrix = solveSimilarity(
    DOOR.anchors.nearBase,
    DOOR.anchors.farBase,
    toScene(DOOR_PLACEMENT.nearBaseX, floorY(DOOR_PLACEMENT.nearBaseX)),
    toScene(DOOR_PLACEMENT.farBaseX, floorY(DOOR_PLACEMENT.farBaseX)),
  );

  // Read the seam endpoints back out of the placed door rather than trusting
  // the targets, so the line always meets the art that actually got drawn.
  const nearBase = applyMatrix(matrix, DOOR.anchors.nearBase);
  const farBase = applyMatrix(matrix, DOOR.anchors.farBase);

  return {
    scale,
    // Clamped so the seam stays visible on small screens and never turns into a
    // slab on very large ones.
    inkWeight: clamp(ROOM.inkWeight * scale, 1, 3.2),
    corner: { x: cornerX, y: cornerY },
    door: { matrix, nearBase, farBase, natural: DOOR.natural },
    seams: {
      wallCorner: [
        { x: cornerX, y: 0 },
        { x: cornerX, y: cornerY },
      ],
      leftFloor: [
        { x: 0, y: cornerY - ROOM.leftSlope * cornerX },
        { x: cornerX, y: cornerY },
      ],
      // Two segments: the door's own inked bottom edge carries the seam
      // between them.
      floorToDoor: [{ x: cornerX, y: cornerY }, nearBase],
      floorPastDoor: [
        farBase,
        { x: width, y: cornerY + ROOM.rightSlope * (width - cornerX) },
      ],
    },
  };
}
