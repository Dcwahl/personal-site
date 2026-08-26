/**
 * The windup robot.
 *
 * Geometry is *generated from named numbers*, never listed as vertices. That is
 * the whole point: adjusting this robot means turning a labelled dial
 * ("legLength"), not hunting a corner in a coordinate soup. If we ever find
 * ourselves wanting to nudge one specific vertex, this approach has failed and
 * the model belongs in Blender instead.
 *
 * Local space: +y up, +x the way the robot faces, +z its left. Origin on the
 * floor between the feet. Every proportion below is a fraction of `height`, so
 * the shape is scale-free and `height` alone sizes it in the room.
 */

import { toCameraSpace, projectCameraSpace, ROOM_CAMERA, CAMERA_IN_ROOM } from "./camera.js";

export const robotDefaults = {
  /* Placement ─────────────────────────────────────────────────────── */
  height: 0.33, // door-heights, floor to top of head. Antenna is extra.
  standX: 4.5, // room coords: toward the viewer along the door's wall
  standZ: 3.5, // toward the viewer along the empty left wall
  facing: 15, // degrees. 15 looks straight at the camera from this spot.

  /* Legs and feet ─────────────────────────────────────────────────── */
  footHeight: 0.06,
  footWidth: 0.155,
  footDepth: 0.215,
  footForward: 0.05, // slab feet overhang forward, the way toys' do
  legLength: 0.265,
  legWidth: 0.125,
  legDepth: 0.125,
  legSpread: 0.105, // centre of each leg, off the midline

  /* Torso ─────────────────────────────────────────────────────────── */
  torsoHeight: 0.36,
  torsoWidth: 0.42,
  torsoDepth: 0.28,
  panelWidth: 0.2,
  panelHeight: 0.13,
  panelHeightOnTorso: 0.42,
  torsoChamfer: 0, // 0 = square corners // fraction up the torso

  /* Head ──────────────────────────────────────────────────────────── */
  neckHeight: 0.055,
  neckWidth: 0.1,
  headHeight: 0.215,
  headWidth: 0.285,
  headDepth: 0.25,
  eyeSize: 0.05,
  eyeSpread: 0.072,
  eyeHeightOnHead: 0.58,
  /* Screen face. `screenWidth` at 0 keeps the plain square eyes. */
  screenWidth: 0, // fraction of the head's front face
  screenHeight: 0.62,
  screenY: 0.52, // height up the face
  screenRadius: 0.09,
  screenEyeSpread: 0.44, // fraction of the screen's width
  screenEyeRadius: 0.052,
  screenEyeRise: 0.06,
  screenMouthWidth: 0.34,
  screenMouthDrop: 0.14,
  screenMouthDepth: 0.05,
  expression: "happy", // happy | neutral | blink | surprised

  headChamfer: 0, // 0 = square corners; raises to cut them off
  headDome: 0, // fraction of the head's height given to a rounded top
  headDomeSegments: 5,

  /* Arms ──────────────────────────────────────────────────────────── */
  armLength: 0.265,
  armWidth: 0.072,
  armDepth: 0.078,
  shoulderDrop: 0.06, // below the top of the torso
  armSwing: 0, // degrees fore/aft at the shoulder; the walk will drive this
  armRaise: 42, // degrees out sideways, clearing the flank for the key

  /* Antenna ───────────────────────────────────────────────────────── */
  antennaHeight: 0.155,
  antennaWidth: 0.014,
  antennaTip: 0.042,

  /* Winding key ───────────────────────────────────────────────────── */
  keyShaft: 0.09,
  keyShaftWidth: 0.028,
  keyBowLength: 0.1,
  keyBowHeight: 0.13,
  keyBowBar: 0.026,
  keyBowThickness: 0.02,
  keyHeightOnTorso: 0.22,
  keyTurn: 0, // degrees about the shaft; the walk will drive this
};

/**
 * Named variants.
 *
 * Each is a partial override of `robotDefaults`, so a direction we try is kept
 * as an option rather than replacing the last one — nothing has to be deleted
 * to explore, and the original is always one selection away. New shape
 * parameters all default to zero for exactly this reason: at zero they
 * reproduce the plain box.
 */
export const robotPresets = {
  "tin toy": {},

  /* Baby schema: the oversized head, low wide eyes, stubby limbs and big feet
   * that read as cute. Proportion alone, no new geometry. */
  baby: {
    footHeight: 0.07, footWidth: 0.2, footDepth: 0.26,
    legLength: 0.15, legWidth: 0.15, legDepth: 0.14, legSpread: 0.115,
    torsoHeight: 0.28, torsoWidth: 0.44, torsoDepth: 0.31,
    neckHeight: 0.02, neckWidth: 0.13,
    headHeight: 0.34, headWidth: 0.4, headDepth: 0.35,
    eyeSize: 0.085, eyeSpread: 0.1, eyeHeightOnHead: 0.42,
    armLength: 0.2, armWidth: 0.09, armDepth: 0.095, armRaise: 38,
    antennaHeight: 0.1, antennaTip: 0.05,
    panelWidth: 0.2, panelHeight: 0.1, panelHeightOnTorso: 0.45,
    keyHeightOnTorso: 0.3, keyShaft: 0.08, keyBowLength: 0.09, keyBowHeight: 0.11,
  },

  chamfered: { torsoChamfer: 0.3, headChamfer: 0.3 },

  /* Tin-toy proportions, but the face is a little screen. The head grows a
   * touch to give the screen somewhere to live without crowding it. */
  bmo: {
    headHeight: 0.25, headWidth: 0.34, headDepth: 0.23,
    neckHeight: 0, antennaHeight: 0.13,
    screenWidth: 0.74, screenHeight: 0.6, screenY: 0.52,
  },

  domed: { headDome: 0.45, headChamfer: 0.15 },

  /* All three of the directions at once. */
  soft: {
    footHeight: 0.07, footWidth: 0.2, footDepth: 0.26,
    legLength: 0.15, legWidth: 0.15, legDepth: 0.14, legSpread: 0.115,
    torsoHeight: 0.28, torsoWidth: 0.44, torsoDepth: 0.31,
    neckHeight: 0.02, neckWidth: 0.13,
    headHeight: 0.34, headWidth: 0.4, headDepth: 0.35,
    eyeSize: 0.085, eyeSpread: 0.1, eyeHeightOnHead: 0.42,
    armLength: 0.2, armWidth: 0.09, armDepth: 0.095, armRaise: 38,
    antennaHeight: 0.1, antennaTip: 0.05,
    panelWidth: 0.2, panelHeight: 0.1, panelHeightOnTorso: 0.45,
    keyHeightOnTorso: 0.3, keyShaft: 0.08, keyBowLength: 0.09, keyBowHeight: 0.11,
    torsoChamfer: 0.28, headChamfer: 0.22, headDome: 0.4,
  },
};

/* ── geometry primitives ──────────────────────────────────────────── */

/**
 * An axis-aligned box as six quads, each carrying its own outward normal.
 *
 * Normals are stored rather than derived from winding order, because winding
 * has a handedness and the room's camera is left-handed (y down, z into the
 * screen). Carrying the normal explicitly means back-face culling cannot come
 * out inside-out.
 */
function box(centre, size, details = {}) {
  const [hw, hh, hd] = [size.x / 2, size.y / 2, size.z / 2];
  const corner = (ix, iy, iz) => ({
    x: centre.x + (ix ? hw : -hw),
    y: centre.y + (iy ? hh : -hh),
    z: centre.z + (iz ? hd : -hd),
  });
  const c = [];
  for (let ix = 0; ix < 2; ix += 1)
    for (let iy = 0; iy < 2; iy += 1)
      for (let iz = 0; iz < 2; iz += 1) c[(ix << 2) | (iy << 1) | iz] = corner(ix, iy, iz);

  const face = (key, normal, ...indices) => ({
    normal,
    points: indices.map((i) => c[i]),
    // Rectangles in this face's own (u, v), drawn as outlines once the face
    // itself has been drawn. Eyes and panels are surface markings, not objects
    // — modelling them as proud little boxes is what made them pop in and out.
    detail: details[key] ?? [],
  });

  return [
    face("+x", { x: 1, y: 0, z: 0 }, 4, 5, 7, 6),
    face("-x", { x: -1, y: 0, z: 0 }, 0, 1, 3, 2),
    face("+y", { x: 0, y: 1, z: 0 }, 2, 3, 7, 6),
    face("-y", { x: 0, y: -1, z: 0 }, 0, 1, 5, 4),
    face("+z", { x: 0, y: 0, z: 1 }, 1, 3, 7, 5),
    face("-z", { x: 0, y: 0, z: -1 }, 0, 2, 6, 4),
  ];
}

/**
 * A solid built from stacked horizontal rings.
 *
 * Generalises the box so a shape can be softened without abandoning flat
 * faces: chamfering is just an eight-point ring instead of a four-point one,
 * and a dome is a stack of shrinking rings. Culling stays exact either way,
 * because every face is still planar and convex.
 *
 * Normals are derived per face and then turned outward against the solid's own
 * centre, which keeps them right without depending on winding handedness.
 */
function lathe(rings, details = {}) {
  const all = rings.flatMap((ring) => ring.points.map((p) => ({ ...p, y: ring.y })));
  const centre = all.reduce(
    (a, p) => ({ x: a.x + p.x / all.length, y: a.y + p.y / all.length, z: a.z + p.z / all.length }),
    { x: 0, y: 0, z: 0 },
  );

  const outward = (points) => {
    const [a, b, c] = points;
    const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    let n = {
      x: u.y * v.z - u.z * v.y,
      y: u.z * v.x - u.x * v.z,
      z: u.x * v.y - u.y * v.x,
    };
    const length = Math.hypot(n.x, n.y, n.z) || 1;
    n = { x: n.x / length, y: n.y / length, z: n.z / length };
    const mid = points.reduce(
      (a2, p) => ({ x: a2.x + p.x / points.length, y: a2.y + p.y / points.length, z: a2.z + p.z / points.length }),
      { x: 0, y: 0, z: 0 },
    );
    const away = (mid.x - centre.x) * n.x + (mid.y - centre.y) * n.y + (mid.z - centre.z) * n.z;
    return away < 0 ? { x: -n.x, y: -n.y, z: -n.z } : n;
  };

  const quads = [];
  const at = (ring, i) => ({ x: ring.points[i].x, y: ring.y, z: ring.points[i].z });

  for (let r = 0; r < rings.length - 1; r += 1) {
    const [low, high] = [rings[r], rings[r + 1]];
    const n = low.points.length;
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      const points = [at(low, i), at(low, j), at(high, j), at(high, i)];
      quads.push({ normal: outward(points), points, detail: [] });
    }
  }

  /* Caps. A ring collapsed to a point (the top of a dome) needs none. */
  for (const [ring, flip] of [[rings[0], true], [rings[rings.length - 1], false]]) {
    const spread = Math.max(...ring.points.map((p) => Math.hypot(p.x, p.z)));
    if (spread < 1e-6) continue;
    const points = ring.points.map((_, i) => at(ring, flip ? ring.points.length - 1 - i : i));
    quads.push({ normal: outward(points), points, detail: [] });
  }

  /* Markings go on whichever side face looks most directly forward. */
  if (details.front?.length) {
    let best = null;
    for (const quad of quads) if (!best || quad.normal.x > best.normal.x) best = quad;
    if (best) best.detail = details.front;
  }

  return quads;
}

/** How much each corner loses to a chamfer, in world units. */
const cornerCut = (halfX, halfZ, chamfer) =>
  Math.min(chamfer, 0.49) * Math.min(halfX, halfZ) * 2;

/** Horizontal cross-section: a rectangle with its corners optionally cut off. */
function section(halfX, halfZ, chamfer = 0) {
  const cut = cornerCut(halfX, halfZ, chamfer);
  if (cut <= 1e-6) {
    return [
      { x: halfX, z: -halfZ }, { x: halfX, z: halfZ },
      { x: -halfX, z: halfZ }, { x: -halfX, z: -halfZ },
    ];
  }
  return [
    { x: halfX, z: -halfZ + cut }, { x: halfX, z: halfZ - cut },
    { x: halfX - cut, z: halfZ }, { x: -halfX + cut, z: halfZ },
    { x: -halfX, z: halfZ - cut }, { x: -halfX, z: -halfZ + cut },
    { x: -halfX + cut, z: -halfZ }, { x: halfX - cut, z: -halfZ },
  ];
}

/** Scale a section about the axis, for the shrinking rings of a dome. */
const scaled = (points, factor) => points.map((p) => ({ x: p.x * factor, z: p.z * factor }));

/**
 * Surface markings, in a face's own (u, v).
 *
 * Each is a polyline: closed and stroked by default, optionally filled with
 * ink, optionally left open (a mouth curve is not a closed shape). Faces are
 * rarely square, so anything meant to read as round takes the face's aspect
 * and works in fractions of *height* for both axes.
 */
const patch = (u, v, du, dv) => ({
  points: [
    [u - du / 2, v - dv / 2], [u + du / 2, v - dv / 2],
    [u + du / 2, v + dv / 2], [u - du / 2, v + dv / 2],
  ],
});

/** A rectangle with its corners rounded off — the screen's bezel. */
function roundPatch(u, v, du, dv, radius, steps = 5) {
  const rx = Math.min(radius, du / 2);
  const ry = Math.min(radius, dv / 2);
  const points = [];
  const corners = [
    [u + du / 2 - rx, v + dv / 2 - ry, 0],
    [u - du / 2 + rx, v + dv / 2 - ry, Math.PI / 2],
    [u - du / 2 + rx, v - dv / 2 + ry, Math.PI],
    [u + du / 2 - rx, v - dv / 2 + ry, (3 * Math.PI) / 2],
  ];
  for (const [cu, cv, start] of corners)
    for (let i = 0; i <= steps; i += 1) {
      const a = start + (i / steps) * (Math.PI / 2);
      points.push([cu + rx * Math.cos(a), cv + ry * Math.sin(a)]);
    }
  return { points };
}

/** A filled dot. `aspect` is the face's width/height, keeping it circular. */
function disc(u, v, radius, aspect, steps = 14) {
  const points = [];
  for (let i = 0; i < steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    points.push([u + (radius / aspect) * Math.cos(a), v + radius * Math.sin(a)]);
  }
  return { points, fill: "ink" };
}

/** An open parabola: ends up for a smile, ends down for a frown. */
function curve(u, v, width, depth, aspect, steps = 12) {
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * 2 - 1;
    points.push([u + (t * width) / 2 / aspect, v + depth * t * t]);
  }
  return { points, open: true };
}

/** Rotate about the z axis — the shoulder hinge, and the key's turn. */
function hinge(quads, pivot, degrees) {
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const spin = (p, isPoint) => {
    const x = isPoint ? p.x - pivot.x : p.x;
    const y = isPoint ? p.y - pivot.y : p.y;
    return {
      x: x * cos - y * sin + (isPoint ? pivot.x : 0),
      y: x * sin + y * cos + (isPoint ? pivot.y : 0),
      z: p.z,
    };
  };

  return quads.map((q) => ({
    ...q,
    normal: spin(q.normal, false),
    points: q.points.map((p) => spin(p, true)),
  }));
}

/** Rotate about the x axis — raising an arm out sideways. */
function hingeX(quads, pivot, degrees) {
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const spin = (p, isPoint) => {
    const y = isPoint ? p.y - pivot.y : p.y;
    const z = isPoint ? p.z - pivot.z : p.z;
    return {
      x: p.x,
      y: y * cos - z * sin + (isPoint ? pivot.y : 0),
      z: y * sin + z * cos + (isPoint ? pivot.z : 0),
    };
  };

  return quads.map((q) => ({
    ...q,
    normal: spin(q.normal, false),
    points: q.points.map((p) => spin(p, true)),
  }));
}

/** Mirror across the midline, for the second of a symmetrical pair. */
const mirrorZ = (quads) =>
  quads.map((q) => ({
    ...q,
    normal: { ...q.normal, z: -q.normal.z },
    points: q.points.map((p) => ({ ...p, z: -p.z })),
    // Mirroring flips the face's u axis, so its markings must flip with it.
    detail: q.detail.map((mark) => ({
      ...mark,
      points: mark.points.map(([u, v]) => [1 - u, v]),
    })),
  }));

/* ── the body ─────────────────────────────────────────────────────── */

export function buildRobot(params = {}) {
  const p = { ...robotDefaults, ...params };
  const parts = [];
  const add = (name, quads) => parts.push({ name, quads });

  /* Stacked heights, measured up from the floor. */
  const ankle = p.footHeight;
  const hip = ankle + p.legLength;
  const shoulderLine = hip + p.torsoHeight;
  const chin = shoulderLine + p.neckHeight;
  const crown = chin + p.headHeight;

  /* Feet and legs. Built on the +z side, then mirrored. */
  const foot = box(
    { x: p.footForward / 2, y: p.footHeight / 2, z: p.legSpread },
    { x: p.footDepth, y: p.footHeight, z: p.footWidth },
  );
  const leg = box(
    { x: 0, y: (ankle + hip) / 2, z: p.legSpread },
    { x: p.legDepth, y: p.legLength, z: p.legWidth },
  );
  add("foot.left", foot);
  add("foot.right", mirrorZ(foot));
  add("leg.left", leg);
  add("leg.right", mirrorZ(leg));

  /* Torso. The chest panel is a marking on the front face, not a proud box. */
  // Chamfering narrows the front face, so the panel is sized against the face
  // it actually sits on rather than against the torso's full width.
  const torsoFront = p.torsoWidth - 2 * cornerCut(p.torsoDepth / 2, p.torsoWidth / 2, p.torsoChamfer);
  add(
    "torso",
    lathe(
      [
        { y: hip, points: section(p.torsoDepth / 2, p.torsoWidth / 2, p.torsoChamfer) },
        { y: shoulderLine, points: section(p.torsoDepth / 2, p.torsoWidth / 2, p.torsoChamfer) },
      ],
      {
        front: [
          patch(0.5, p.panelHeightOnTorso, p.panelWidth / torsoFront, p.panelHeight / p.torsoHeight),
        ],
      },
    ),
  );

  /* Arms. Two hinges at the shoulder: `armRaise` lifts them out sideways,
   * `armSwing` swings them fore and aft for the walk. Raising them is what
   * clears the flank so the winding key has somewhere to live. */
  const shoulderY = shoulderLine - p.shoulderDrop;
  const arm = box(
    { x: 0, y: shoulderY - p.armLength / 2, z: p.torsoWidth / 2 + p.armWidth / 2 },
    { x: p.armDepth, y: p.armLength, z: p.armWidth },
  );
  const posed = hinge(
    hingeX(arm, { y: shoulderY, z: p.torsoWidth / 2 }, -p.armRaise),
    { x: 0, y: shoulderY },
    p.armSwing,
  );
  add("arm.left", posed);
  add("arm.right", mirrorZ(hinge(
    hingeX(arm, { y: shoulderY, z: p.torsoWidth / 2 }, -p.armRaise),
    { x: 0, y: shoulderY },
    -p.armSwing,
  )));

  /* Neck, head, eyes. */
  if (p.neckHeight > 1e-6) {
    add(
      "neck",
      box(
        { x: 0, y: (shoulderLine + chin) / 2, z: 0 },
        { x: p.neckWidth, y: p.neckHeight, z: p.neckWidth },
      ),
    );
  }
  /* Head. `headDome` is the fraction of its height given over to a rounded
   * top; at 0 the rings collapse to two and it is exactly the box it was.
   * Markings sit on the flat part of the face, so their coordinates are
   * relative to that, not to the whole head. */
  const headHalf = [p.headDepth / 2, p.headWidth / 2];
  const headFront = p.headWidth - 2 * cornerCut(...headHalf, p.headChamfer);
  const domeHeight = p.headDome * p.headHeight;
  const domeBase = crown - domeHeight;
  const headRings = [
    { y: chin, points: section(...headHalf, p.headChamfer) },
    { y: domeBase, points: section(...headHalf, p.headChamfer) },
  ];
  for (let k = 1; k <= (domeHeight > 1e-6 ? Math.round(p.headDomeSegments) : 0); k += 1) {
    const t = (k / Math.round(p.headDomeSegments)) * (Math.PI / 2);
    headRings.push({
      y: domeBase + domeHeight * Math.sin(t),
      points: scaled(section(...headHalf, p.headChamfer), Math.cos(t)),
    });
  }
  /* A BMO-style screen face, when `screenWidth` is turned up. At 0 the head
   * keeps its two plain square eyes and nothing below runs. Faces are wider
   * than they are tall, so anything meant to read as round is given the
   * face's aspect to work against. */
  const faceAspect = headFront / (p.headHeight - domeHeight);
  const screenMarks = () => {
    const marks = [roundPatch(0.5, p.screenY, p.screenWidth, p.screenHeight, p.screenRadius)];
    const eyeU2 = (p.screenWidth * p.screenEyeSpread) / 2;
    const eyeV = p.screenY + p.screenEyeRise;
    const mouthV = p.screenY - p.screenMouthDrop;
    const mouth = (depth) =>
      curve(0.5, mouthV, p.screenWidth * p.screenMouthWidth, depth, faceAspect);

    switch (p.expression) {
      case "blink":
        for (const side of [-1, 1])
          marks.push(patch(0.5 + side * eyeU2, eyeV, p.screenEyeRadius * 2.4 / faceAspect, p.screenEyeRadius * 0.5));
        marks.push(mouth(p.screenMouthDepth));
        break;
      case "surprised":
        for (const side of [-1, 1])
          marks.push(disc(0.5 + side * eyeU2, eyeV, p.screenEyeRadius * 1.5, faceAspect));
        marks.push({ ...disc(0.5, mouthV, p.screenEyeRadius * 1.2, faceAspect), fill: undefined });
        break;
      case "neutral":
        for (const side of [-1, 1])
          marks.push(disc(0.5 + side * eyeU2, eyeV, p.screenEyeRadius, faceAspect));
        marks.push(mouth(0.004));
        break;
      default: // happy
        for (const side of [-1, 1])
          marks.push(disc(0.5 + side * eyeU2, eyeV, p.screenEyeRadius, faceAspect));
        marks.push(mouth(p.screenMouthDepth));
    }
    return marks;
  };

  const eyeU = p.eyeSpread / headFront;
  const eyeSize = [p.eyeSize / headFront, p.eyeSize / (p.headHeight - domeHeight)];
  add(
    "head",
    lathe(headRings, {
      front:
        p.screenWidth > 0
          ? screenMarks()
          : [
              patch(0.5 - eyeU, p.eyeHeightOnHead, ...eyeSize),
              patch(0.5 + eyeU, p.eyeHeightOnHead, ...eyeSize),
            ],
    }),
  );

  /* Antenna. */
  add(
    "antenna",
    box(
      { x: 0, y: crown + p.antennaHeight / 2, z: 0 },
      { x: p.antennaWidth, y: p.antennaHeight, z: p.antennaWidth },
    ),
  );
  add(
    "antenna.tip",
    box(
      { x: 0, y: crown + p.antennaHeight + p.antennaTip / 2, z: 0 },
      { x: p.antennaTip, y: p.antennaTip, z: p.antennaTip },
    ),
  );

  /* Winding key, on the hip rather than the back.
   *
   * On the back its bow sat edge-on to the camera and read as a stray tick —
   * correct geometry, useless picture, and invisible in the one pose the whole
   * interaction ends on. On the hip the shaft runs out sideways and the bow's
   * flat face turns toward the front, so it reads from straight on and from
   * three-quarters, which is every pose we actually use. */
  const keyY = hip + p.torsoHeight * p.keyHeightOnTorso;
  const hipZ = -(p.torsoWidth / 2);
  const keyParts = [
    box(
      { x: 0, y: keyY, z: hipZ - p.keyShaft / 2 },
      { x: p.keyShaftWidth, y: p.keyShaftWidth, z: p.keyShaft },
    ),
  ];
  const bowZ = hipZ - p.keyShaft - p.keyBowLength / 2;
  const bar = (dz, dy, sz, sy) =>
    box(
      { x: 0, y: keyY + dy, z: bowZ + dz },
      { x: p.keyBowThickness, y: sy, z: sz },
    );
  keyParts.push(
    bar(0, p.keyBowHeight / 2 - p.keyBowBar / 2, p.keyBowLength, p.keyBowBar),
    bar(0, -p.keyBowHeight / 2 + p.keyBowBar / 2, p.keyBowLength, p.keyBowBar),
    bar(-p.keyBowLength / 2 + p.keyBowBar / 2, 0, p.keyBowBar, p.keyBowHeight),
    bar(p.keyBowLength / 2 - p.keyBowBar / 2, 0, p.keyBowBar, p.keyBowHeight),
  );
  // Each box is added separately: sorting happens per convex solid, and the
  // key as a whole is not convex.
  keyParts.forEach((solid, index) =>
    add(`key.${index}`, hinge(solid, { x: 0, y: keyY }, p.keyTurn)),
  );

  return { parts, params: p, crown, shoulderLine };
}

/* ── placing it in the room ───────────────────────────────────────── */

/**
 * Local space -> room coordinates: scale to `height`, spin to `facing`, drop it
 * on the floor at (standX, standZ).
 *
 * Height is given in door-heights because the door is the room's only stated
 * scale reference — see `camera.js`.
 */
export function placeRobot(robot) {
  const p = robot.params;
  // Normalise on the crown, so `height` is the real floor-to-head height in
  // door-heights no matter what the proportions sum to. Without this, retuning
  // any one segment silently rescales the whole robot.
  const scale = (p.height * ROOM_CAMERA.doorHeight) / robot.crown;
  const yaw = (p.facing * Math.PI) / 180;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);

  const toRoom = (v) => ({
    x: p.standX + (v.x * cos - v.z * sin) * scale,
    y: v.y * scale,
    z: p.standZ + (v.x * sin + v.z * cos) * scale,
  });
  const dirToRoom = (v) => ({
    x: v.x * cos - v.z * sin,
    y: v.y,
    z: v.x * sin + v.z * cos,
  });

  // Grouping survives: visibility is solved per convex solid, so the caller
  // must be able to tell which faces belong together.
  return robot.parts.map((part) => ({
    name: part.name,
    quads: part.quads.map((quad) => ({
      normal: dirToRoom(quad.normal),
      points: quad.points.map(toRoom),
      detail: quad.detail ?? [],
    })),
  }));
}

/* ── drawing ──────────────────────────────────────────────────────── */

/**
 * Draw the robot as a line drawing rather than a wireframe.
 *
 * A raw wireframe shows every back edge and reads as a technical diagram, which
 * is wrong next to the room's clean ink. So: cull the faces pointing away from
 * the camera, sort what is left back-to-front, and *fill each face with the
 * paper colour* before stroking it. The fill is what hides the parts behind —
 * an arm crossing the torso occludes it for free, with no hidden-line solve.
 */
/**
 * Put non-interpenetrating convex solids into a correct back-to-front order.
 *
 * Any two disjoint convex solids have a plane with one on each side. The camera
 * sits on one side of that plane, and whichever solid shares that side is
 * genuinely in front — this is exact, not a depth heuristic, which is what a
 * single scalar per solid can never be. For boxes the separating plane is
 * almost always parallel to a face of one of them, so their own face planes are
 * the candidates, and they are already to hand.
 *
 * The pairwise results form a DAG; a topological sort turns it into a draw
 * order. Anything left over (a genuine cycle, or a pair with no face-parallel
 * separator) falls back to nearest-corner depth.
 */
function order(solids) {
  const EPSILON = 1e-9;
  const camera = CAMERA_IN_ROOM;

  /* Screen bounds, so only solids that actually overlap constrain each other. */
  for (const solid of solids) {
    const xs = solid.faces.flatMap((f) => f.screen.map((p) => p.x));
    const ys = solid.faces.flatMap((f) => f.screen.map((p) => p.y));
    solid.box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  const overlaps = (a, b) =>
    a.box[0] <= b.box[2] && b.box[0] <= a.box[2] && a.box[1] <= b.box[3] && b.box[1] <= a.box[3];

  /** Does one of `a`'s own face planes separate it from `b`? */
  const separates = (a, b) => {
    for (const { point, normal } of a.planes) {
      const side = (p) =>
        (p.x - point.x) * normal.x + (p.y - point.y) * normal.y + (p.z - point.z) * normal.z;
      if (b.hull.every((p) => side(p) >= -EPSILON)) {
        // `b` lies outside this face. The camera decides which is nearer.
        return side(camera) > 0 ? "b" : "a";
      }
    }
    return null;
  };

  const behind = new Map(solids.map((s) => [s, new Set()]));
  const fallback = [];
  for (let i = 0; i < solids.length; i += 1) {
    for (let j = i + 1; j < solids.length; j += 1) {
      const [a, b] = [solids[i], solids[j]];
      if (!overlaps(a, b)) continue;
      const front = separates(a, b) ?? (separates(b, a) === "a" ? "b" : separates(b, a) === "b" ? "a" : null);
      if (front === null) fallback.push([a, b]);
      else if (front === "b") behind.get(b).add(a);
      else behind.get(a).add(b);
    }
  }
  for (const [a, b] of fallback) {
    if (a.nearest <= b.nearest) behind.get(a).add(b);
    else behind.get(b).add(a);
  }

  /* Kahn: emit a solid once everything it sits in front of has been drawn. */
  const sorted = [];
  const pending = new Set(solids);
  while (pending.size) {
    let progressed = false;
    for (const solid of [...pending]) {
      if ([...behind.get(solid)].every((other) => !pending.has(other))) {
        sorted.push(solid);
        pending.delete(solid);
        progressed = true;
      }
    }
    if (progressed) continue;
    // A cycle. Break it on depth and carry on rather than dropping anything.
    const deepest = [...pending].sort((a, b) => b.nearest - a.nearest)[0];
    sorted.push(deepest);
    pending.delete(deepest);
  }

  solids.length = 0;
  solids.push(...sorted);
}

export function drawRobot(context, solids, toScreen, style = {}) {
  const { ink = "rgba(23, 20, 15, 0.9)", paper = "#dac9a4", weight = 1.35 } = style;

  /* Solve visibility one solid at a time.
   *
   * Sorting individual faces by centroid depth is not a visibility solve, and
   * it fails exactly where the parts meet: a large face's centroid can be
   * nearer the camera than a small face sitting flat on it, so the big one
   * draws last and paints the small one out. That is what made the eyes and
   * the leg sides flicker in and out under rotation.
   *
   * Within one convex solid, back-face culling is exact and no ordering is
   * needed at all. Between solids, see `order` — depth along any single axis is
   * not enough, because a foot that juts forward past the shin owns the nearest
   * corner while still being behind it. So: cull inside, order outside. */
  const drawable = [];
  for (const solid of solids) {
    const faces = [];
    const hull = [];
    const planes = [];
    let nearest = Infinity;

    for (const quad of solid.quads) {
      hull.push(...quad.points);
      planes.push({ point: quad.points[0], normal: quad.normal });

      const camera = quad.points.map(toCameraSpace);
      const centre = camera.reduce(
        (a, q) => ({ x: a.x + q.x / 4, y: a.y + q.y / 4, z: a.z + q.z / 4 }),
        { x: 0, y: 0, z: 0 },
      );

      // Transport a point along the normal rather than reasoning about the
      // room's handedness.
      const tip = toCameraSpace({
        x: quad.points.reduce((a, q) => a + q.x / 4, 0) + quad.normal.x * 1e-3,
        y: quad.points.reduce((a, q) => a + q.y / 4, 0) + quad.normal.y * 1e-3,
        z: quad.points.reduce((a, q) => a + q.z / 4, 0) + quad.normal.z * 1e-3,
      });
      const normal = { x: tip.x - centre.x, y: tip.y - centre.y, z: tip.z - centre.z };

      // The camera sits at the origin, so the centroid is the view vector.
      if (normal.x * centre.x + normal.y * centre.y + normal.z * centre.z >= 0) continue;

      for (const q of camera) nearest = Math.min(nearest, q.z);
      faces.push({
        screen: camera.map((q) => toScreen(projectCameraSpace(q))),
        detail: quad.detail,
        points: quad.points,
      });
    }

    if (faces.length) drawable.push({ name: solid.name, nearest, faces, hull, planes });
  }

  order(drawable);

  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";
  context.lineWidth = weight;
  context.fillStyle = paper;
  context.strokeStyle = ink;

  const trace = (points) => {
    context.beginPath();
    points.forEach((q, i) => (i ? context.lineTo(q.x, q.y) : context.moveTo(q.x, q.y)));
    context.closePath();
  };

  for (const solid of drawable) {
    for (const face of solid.faces) {
      trace(face.screen);
      context.fill();
      context.stroke();

      /* Surface markings, in the face's own (u, v). Interpolating in 3D and
       * projecting afterwards keeps them in perspective — the face is planar,
       * so bilinear interpolation lands exactly in its plane. */
      const [a, b, c, d] = face.points;
      const at = (u, v) => {
        const top = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u };
        const bottom = { x: d.x + (c.x - d.x) * u, y: d.y + (c.y - d.y) * u, z: d.z + (c.z - d.z) * u };
        return toScreen(projectCameraSpace(toCameraSpace({
          x: top.x + (bottom.x - top.x) * v,
          y: top.y + (bottom.y - top.y) * v,
          z: top.z + (bottom.z - top.z) * v,
        })));
      };
      for (const mark of face.detail) {
        const points = mark.points.map(([u, v]) => at(u, v));
        context.beginPath();
        points.forEach((q, i) => (i ? context.lineTo(q.x, q.y) : context.moveTo(q.x, q.y)));
        if (!mark.open) context.closePath();
        if (mark.fill === "ink") {
          context.fillStyle = ink;
          context.fill();
          context.fillStyle = paper;
        }
        context.stroke();
      }
    }
  }

  context.restore();

  // The resolved back-to-front order, so ordering can be asserted on.
  return drawable.map((solid) => solid.name);
}
