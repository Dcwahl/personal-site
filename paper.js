/**
 * The sheet he holds up, and the walk that gets him close enough to read it.
 *
 * Split out of `experiments/tools/paper-sequence.html` when the study landed on
 * the live page, so that the tuning tool and the site run the same code rather
 * than two copies of it that drift. The study is still where this gets felt;
 * this is only where it lives.
 *
 * `walk.js` owns the route across the room and cannot express what this needs:
 * `reach` slides the destination along one diagonal, so how big he arrives and
 * where on screen he lands are the same number. Presenting something readable
 * needs them to be two. So the destination here is aimed down the camera's own
 * view axis and centred by sliding along that axis's perpendicular.
 */

import { buildRobot, placeRobot, robotDefaults, robotPresets } from "./robot.js?v=5";
import { buildRoute, doorRoute, stepLength, headingToCamera, START_PHASE } from "./walk.js?v=5";
import {
  mockupToScreen,
  toCameraSpace,
  projectCameraSpace,
  CAMERA_IN_ROOM,
} from "./camera.js?v=5";

/* ── the poses ────────────────────────────────────────────────────── */

/** Arms up, presenting. */
export const HOLD = 140;
/** Arms at his sides, hands below the crop, where the paper comes from. */
export const CARRY = -12;

/**
 * The angle the sheet lies at when it is down.
 *
 * Lowering the arms alone can never put the sheet away: sweep `armRaise` from
 * 140 all the way to -70 and the top edge bottoms out 314px *inside* the frame,
 * because dropping his hands moves the paper down and toward the camera at once
 * and the two nearly cancel. So it vanished at close to full size, which read
 * as being cut rather than put down.
 *
 * Tilting it flat is what actually does it, and it is also what the gesture is:
 * paper you put down goes flat. Rotating toward horizontal foreshortens the
 * sheet to a sliver and swings its top edge away from the lens. At -75 the whole
 * thing clears the bottom of the frame everywhere tested — 60px to spare at
 * 844x390, 124-167px on the rest.
 */
export const LAY = -75;

/** Proportions of the sheet itself, in room units. */
export const SHEET = { grip: 1.0, height: 0.6, out: 0.15, tilt: -12 };

/** Steps he walks behind the wall before the doorway can show him. */
export const ENTRY_STEPS = 3.4;

/** The body and gait the study settled on. */
export const paperParams = {
  ...robotDefaults,
  ...robotPresets["D mild"],
  stepAngle: 34,
  armReach: 12,
};

/* ── the sheet, gripped at his hands ──────────────────────────────── */

/**
 * The far end of an arm: the four vertices furthest from the shoulder,
 * averaged. Cheaper than naming a hand part, and it follows the arm through
 * both hinges without knowing anything about them.
 */
export function handPoint(robot, name) {
  const p = robot.params;
  const shoulderY = robot.shoulderLine - p.shoulderDrop + robot.lift;
  const part = robot.parts.find((q) => q.name === name);
  const seen = new Map();
  for (const pt of part.quads.flatMap((q) => q.points)) {
    seen.set([pt.x, pt.y, pt.z].map((n) => n.toFixed(6)).join(","), pt);
  }
  const d = (pt) => pt.x ** 2 + (pt.y - shoulderY) ** 2 + pt.z ** 2;
  return [...seen.values()]
    .sort((a, b) => d(b) - d(a))
    .slice(0, 4)
    .reduce((a, q) => ({ x: a.x + q.x / 4, y: a.y + q.y / 4, z: a.z + q.z / 4 }), {
      x: 0,
      y: 0,
      z: 0,
    });
}

/** Half the sheet's width, in room units, for the pose given. */
export const handSpan = (robot, sheet = SHEET) =>
  ((handPoint(robot, "arm.left").z - handPoint(robot, "arm.right").z) / 2) * sheet.grip;

/**
 * A sheet builder with its width already frozen.
 *
 * The span is a *constructor argument*, not something read per frame, because
 * deriving it from the live hands made the paper elastic: `armRaise` swings the
 * arms in the y-z plane, so the hands are furthest apart around 90 degrees and
 * closer together at the 140 he finishes on. The sheet grew to 800px mid-lift
 * and shrank back to 593, which reads as the text zooming. Paper is rigid; only
 * where he holds it moves.
 *
 * @param span half-width in room units, from `handSpan` at the finishing pose.
 * @param crease fold-line alpha. Off: folding was a tidy answer to where the
 *   sheet came from, but it buys that with a fold to explain and a fold to
 *   animate, and at any alpha that reads at 20px type the lines strike through
 *   the copy.
 */
export function sheetBuilder(span, { sheet = SHEET, crease = 0 } = {}) {
  return function sheetQuads(robot, tilt = sheet.tilt) {
    const [L, R] = [handPoint(robot, "arm.left"), handPoint(robot, "arm.right")];
    const t = (tilt * Math.PI) / 180;
    const up = { x: -Math.sin(t), y: Math.cos(t), z: 0 };
    const nx = { x: Math.cos(t), y: Math.sin(t), z: 0 };
    const spanZ = span ?? ((L.z - R.z) / 2) * sheet.grip;
    const midZ = (L.z + R.z) / 2;
    const bx = (L.x + R.x) / 2 + sheet.out;
    const by = (L.y + R.y) / 2;
    const c = (su, sv) => ({
      x: bx + up.x * sheet.height * sv,
      y: by + up.y * sheet.height * sv,
      z: midZ + su * spanZ,
    });

    /* Corners pulled slightly off square. A quadrilateral still maps exactly
     * under the DOM homography — it is a projective map of a quad, not of a
     * rectangle — so this costs nothing and stops the sheet reading as a UI
     * panel bolted into the drawing. */
    const SKEW = [[0.012, 0.01], [-0.008, 0.016], [0, 0], [0, 0]];
    const corners = [c(1, 1), c(-1, 1), c(-1, 0), c(1, 0)].map((q, i) => ({
      x: q.x,
      y: q.y + SKEW[i][1] * sheet.height,
      z: q.z + SKEW[i][0],
    }));

    const folds =
      crease <= 0
        ? []
        : [
            { points: [[0, 0.5], [1, 0.5]], open: true, alpha: crease },
            { points: [[0.5, 0], [0.5, 1]], open: true, alpha: crease },
          ];

    /* A hair of thickness, so the top edge reads as a sheet seen slightly from
     * below rather than as a hole cut in the wall. */
    const thickness = 0.006;
    const shift = (pts, k) =>
      pts.map((q) => ({ x: q.x + nx.x * k, y: q.y + nx.y * k, z: q.z + nx.z * k }));
    const front = shift(corners, thickness / 2);
    const back = shift(corners, -thickness / 2);
    const side = (i, j, normal) => ({
      normal,
      points: [front[i], front[j], back[j], back[i]],
      detail: [],
    });
    const edge = { x: -nx.y, y: nx.x, z: 0 };

    return [
      { normal: nx, points: front, detail: folds },
      { normal: { x: -nx.x, y: -nx.y, z: -nx.z }, points: [...back].reverse(), detail: [] },
      side(1, 0, edge),
      side(3, 2, { x: -edge.x, y: -edge.y, z: -edge.z }),
      side(0, 3, { x: 0, y: 0, z: 1 }),
      side(2, 1, { x: 0, y: 0, z: -1 }),
    ];
  };
}

/* ── where he ends up ─────────────────────────────────────────────── */

const AHEAD = (() => {
  const d = Math.hypot(CAMERA_IN_ROOM.x, CAMERA_IN_ROOM.z);
  return { x: -CAMERA_IN_ROOM.x / d, z: -CAMERA_IN_ROOM.z / d };
})();
const SIDE = { x: -AHEAD.z, z: AHEAD.x };

/** A floor point `distance` in front of the camera, `offset` to one side. */
export const along = (distance, offset) => ({
  x: CAMERA_IN_ROOM.x + AHEAD.x * distance + SIDE.x * offset,
  z: CAMERA_IN_ROOM.z + AHEAD.z * distance + SIDE.z * offset,
});

/**
 * `doorRoute`'s cubic, aimed at an arbitrary destination instead of at a
 * `reach` along the diagonal.
 */
export function routeTo(to, robot, { entrySteps = ENTRY_STEPS, handle = 0.45 } = {}) {
  const spec = doorRoute(1, { entryDistance: entrySteps * stepLength(robot) });
  const span = Math.hypot(to.x - spec.from.x, to.z - spec.from.z);
  const radians = (headingToCamera(to) * Math.PI) / 180;
  return buildRoute({
    ...spec,
    control1: { x: spec.from.x, z: Math.max(0.5, 0.45 * span) },
    // A cubic's end tangent is `to - control2`, so pulling the handle back
    // along the line to the camera makes the path deliver the turn.
    control2: {
      x: to.x - handle * span * Math.cos(radians),
      z: to.z - handle * span * Math.sin(radians),
    },
    to,
    arrive: "camera",
  });
}

/** Screen bounds of a posed robot, for centring the composition. */
function screenBox(robot, at, scene) {
  const toScreen = mockupToScreen(scene);
  let x0 = Infinity;
  let x1 = -Infinity;
  for (const solid of placeRobot(robot, { ...at, facing: headingToCamera(at), travel: 0 })) {
    for (const quad of solid.quads) {
      for (const v of quad.points) {
        const p = toScreen(projectCameraSpace(toCameraSpace(v)));
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
      }
    }
  }
  return (x0 + x1) / 2;
}

/**
 * Where he stands to present, the route that gets him there, and a sheet sized
 * to the pose he finishes in.
 *
 * @returns route, destination, distance from the camera, whole step count, the
 *   sheet builder, and the sheet's resting size in screen pixels — everything
 *   the page needs to lay out DOM copy on the paper.
 */
export function planPaper(params, scene, options = {}) {
  const {
    near = 2.4,
    entrySteps = ENTRY_STEPS,
    handle = 0.45,
    hold = HOLD,
    carry = CARRY,
    lay = LAY,
    sheet = SHEET,
    crease = 0,
  } = options;

  const robot = buildRobot(params);
  const step = stepLength(robot);

  /* Freeze the sheet's width before anything asks for a sheet.
   *
   * `rockAngle: 0` matters. START_PHASE is where the roll *peaks*, and a body
   * rolled 20 degrees turns y into z, so the hands stop being symmetric about
   * the spine — measuring there made the sheet 3% narrow and slightly
   * lopsided. The frame this freezes for has the rock scaled out, so measure it
   * there. Span is otherwise phase-invariant: `armSwing` is fore/aft and
   * nothing else moves the hands in z. */
  const span = handSpan(
    buildRobot({ ...params, phase: START_PHASE, rockAngle: 0, armRaise: hold }),
    sheet,
  );
  const sheetQuads = sheetBuilder(span, { sheet, crease });

  /* Centre the *finished* composition — arms up, sheet in hand — not the
   * walking body. He stands turned toward the camera, so his near arm projects
   * wider than his far one; raising both arms and adding a sheet moves the
   * silhouette's middle by about 90px, which is exactly the drift that was
   * visible. Measuring at full rock leans him 20 degrees and slides it by the
   * same again, for a pose that is never on screen. */
  const holdingAt = (phase) => {
    const posed = buildRobot({ ...params, phase, rockAngle: 0, armRaise: hold });
    posed.parts.push({ name: "sheet", quads: sheetQuads(posed) });
    return posed;
  };

  /* Do not assume which way the perpendicular runs on screen: whether screen x
   * rises or falls with the offset depends on the room basis, and a bisection
   * that guesses wrong walks to its bracket's edge instead of the root. */
  const centre = (distance, phase = START_PHASE) => {
    const holding = holdingAt(phase);
    const midX = (offset) => screenBox(holding, along(distance, offset), scene);
    const rising = midX(0.5) > midX(-0.5);
    let low = -3;
    let high = 3;
    for (let i = 0; i < 30; i += 1) {
      const mid = (low + high) / 2;
      if ((midX(mid) < window.innerWidth / 2) === rising) low = mid;
      else high = mid;
    }
    return (low + high) / 2;
  };

  /* Land on a whole number of steps, so the last footfall is the stop. Route
   * length falls monotonically as he stands further away, so a bisection on
   * distance lands exactly, the way `quantiseReach` does on reach. */
  const lengthAt = (d) => routeTo(along(d, centre(d)), robot, { entrySteps, handle }).length;
  const steps = Math.round(lengthAt(near) / step);
  let low = near - 0.6;
  let high = near + 0.6;
  for (let i = 0; i < 30; i += 1) {
    const mid = (low + high) / 2;
    if (lengthAt(mid) > steps * step) low = mid;
    else high = mid;
  }
  const distance = (low + high) / 2;

  /* Second pass: now that the step count is known, centre on the phase he
   * actually finishes on. An odd step count lands him on the mirrored half of
   * the cycle, which projects differently on a body turned toward the camera. */
  const finishPhase = START_PHASE + steps / 2;
  const to = along(distance, centre(distance, finishPhase));
  const route = routeTo(to, robot, { entrySteps, handle });

  const toScreen = mockupToScreen(scene);
  const pose = { ...to, facing: headingToCamera(to), travel: 0 };
  const project = (robot_, tilt) => {
    const posed = buildRobot(robot_);
    posed.parts.push({ name: "sheet", quads: sheetQuads(posed, tilt) });
    return placeRobot(posed, pose)
      .find((q) => q.name === "sheet")
      .quads[0].points.map((v) => toScreen(projectCameraSpace(toCameraSpace(v))));
  };

  /* Where the sheet's top edge sits at the instant he has it but has not
   * raised it. Below the window bottom means it can come into being unseen. */
  const carried = project({ ...params, phase: START_PHASE, armRaise: carry }, lay);
  const carriedTop = Math.min(...carried.map((p) => p.y));

  const rest = project(
    { ...params, phase: finishPhase, rockAngle: 0, armRaise: hold },
    sheet.tilt,
  );
  const width = rest.map((p) => p.x);

  return {
    route,
    to,
    distance,
    steps,
    step,
    finishPhase,
    sheetQuads,
    span,
    carriedTop,
    sheetWide: Math.max(...width) - Math.min(...width),
    /* The DOM box is sized to this once and never resized — see
     * `applyHomography`. */
    sheetBox: {
      w: Math.hypot(rest[1].x - rest[0].x, rest[1].y - rest[0].y),
      h: Math.hypot(rest[3].x - rest[0].x, rest[3].y - rest[0].y),
    },
  };
}

/* ── the copy, mapped onto the paper ──────────────────────────────── */

/**
 * Four corners -> `matrix3d`, so DOM copy sits on the drawn sheet in the room's
 * own perspective and stays real, selectable text.
 *
 * The box must be sized once, to the sheet's *resting* size, and never resized
 * again. Resizing it per frame was the bug: a projective map is not a rigid
 * one, so the quad's top edge foreshortens as he tilts the paper up, and
 * tracking that with the CSS width re-wrapped the copy on every frame. Paper
 * does not reflow when you tilt it. Holding the box fixed also means the
 * resting scale is exactly 1, which is the other half of the fix: a transformed
 * layer rasterises at its own size, so at 260px tall being blown up 1.82x the
 * type was a scaled bitmap rather than glyphs.
 */
export function applyHomography(el, [tl, tr, br, bl]) {
  const W = parseFloat(el.style.width);
  const H = parseFloat(el.style.height);
  const src = [[0, 0], [W, 0], [W, H], [0, H]];
  const dst = [[tl.x, tl.y], [tr.x, tr.y], [br.x, br.y], [bl.x, bl.y]];

  const A = [];
  const b = [];
  for (let i = 0; i < 4; i += 1) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  const M = A.map((row, r) => [...row, b[r]]);
  for (let col = 0; col < 8; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < 8; r += 1) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    // Degenerate: the quad has collapsed to a line. Leave the last good map.
    if (Math.abs(M[pivot][col]) < 1e-12) return;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < 8; r += 1) {
      if (r === col) continue;
      const k = M[r][col] / M[col][col];
      for (let c = col; c <= 8; c += 1) M[r][c] -= k * M[col][c];
    }
  }

  const [a, c, e, d, f, g, i, j] = M.map((row, r) => row[8] / row[r]);
  el.style.transform = `matrix3d(${a},${d},0,${i}, ${c},${f},0,${j}, 0,0,1,0, ${e},${g},0,1)`;
}
