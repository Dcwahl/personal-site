/**
 * The about sequence.
 *
 * The door opens onto an empty doorway, the robot walks into view from behind
 * the far jamb, crosses the floor on an arc and comes almost into the lens,
 * picks a sheet of paper up from below the frame and holds it out. The copy on
 * it is real DOM text, mapped onto the drawn sheet's projected corners, so it
 * stays selectable and accessible. It holds there until it is dismissed, and
 * then he puts the paper back down and walks off past the camera.
 *
 * Everything hard is called, not done, here: `paper.js` sizes the walk and the
 * sheet, `walk.js` owns the route and the exit, `robot.js` the gait and the
 * line rendering, `room.js` the door. This file is choreography and state.
 *
 * It began as `experiments/tools/paper-sequence.html`, which is still the place
 * to feel any of it — the two share `paper.js` rather than a copy.
 */

import { getScene, getDoorAngle, openDoor, closeDoor, setDoorAngle } from "./room.js?v=1";
import { DOOR_PANEL, openingPath, panelPath } from "./door.js?v=1";
import { mockupToScreen, toCameraSpace, projectCameraSpace } from "./camera.js?v=1";
import { buildRobot, placeRobot, drawRobot, robotDefaults } from "./robot.js?v=1";
import { routePose, extendRoute, planExit, START_PHASE } from "./walk.js?v=1";
import {
  planPaper,
  applyHomography,
  paperParams,
  HOLD,
  CARRY,
  LAY,
  SHEET,
  ENTRY_STEPS,
} from "./paper.js?v=1";

const canvas = document.querySelector(".stage--robot");
const context = canvas.getContext("2d");
const domSheet = document.querySelector(".sheet");
const dismissButton = document.querySelector(".sheet__close");
const hurryButton = document.querySelector(".hurry");
const aboutLink = document.querySelector('.masthead a[href="#about"]');
const stillFrames = matchMedia("(prefers-reduced-motion: reduce)");

const query = new URLSearchParams(location.search);
const num = (name, fallback) => {
  const value = Number(query.get(name));
  return query.has(name) && Number.isFinite(value) ? value : fallback;
};

const params = paperParams;

/** Steps per second. Whole-step route, so duration is steps / cadence exactly. */
const CADENCE = num("cadence", 4);

/**
 * How much faster the speed-up link runs him. Fast enough to be worth pressing,
 * short of where the gait reads as a cartoon scramble.
 */
const HURRY_RATE = num("hurry", 2.2);

/**
 * Type size on the sheet, as a fraction of the sheet's height in pixels.
 *
 * The copy has to *fit*: the box is a fixed size and the text is centred in it,
 * so anything too long spills off the paper rather than scrolling. That makes
 * this a function of how much copy there is, and it wants re-checking whenever
 * the words change. `?type=10` to try another. At 1440x900 the sheet is 579x462
 * and this sets 16.9px.
 */
const TYPE = num("type", 9.5) / 260;

const TIMING = {
  /** Seconds the door takes to swing. Matches room.js's default. */
  door: 1.1,
  /** Tiny beat on the empty open doorway before he walks into view. */
  beat: 0.15,
  /** Leaning from upright into the walking rock, before the first step. */
  windUp: 0.3,
  /** A quick clockwork catch after the final footfall. */
  settle: 0.2,
  /** Reaching down out of frame for the paper. */
  reachDown: 0.45,
  /** Raising it into view. */
  lift: 0.75,
  /**
   * Putting it back. Longer than picking it up: reaching down is a grab and the
   * eye follows his hands, while putting it away ends the beat and wants to
   * feel unhurried.
   */
  lower: 0.7,
  /** How far along the visible room walk the door starts closing, 0..1. */
  shutAt: 0.2,
  /** How far along the visible room walk his arms finish coming up, 0..1. */
  armsBy: 0.12,
};

const ease = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

/* ── the plan ─────────────────────────────────────────────────────── */

let plan = null;

function rebuildPlan() {
  const scene = getScene();
  if (!scene) return;

  const paper = planPaper(params, scene);

  /* The exit is measured on a body with its arms down, because that is how he
   * leaves — the sheet is back below the frame by then. */
  const leaving = buildRobot({ ...params, phase: START_PHASE, armRaise: CARRY });
  const away = planExit(leaving, paper.route, scene, { step: paper.step });

  plan = {
    ...paper,
    exitSteps: away?.steps ?? 0,
    turn: away?.turn ?? 0,
    route: away ? extendRoute(paper.route, away.exit, away.along) : paper.route,
    seconds: paper.steps / CADENCE,
  };
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * Lay the copy out at the size it is read at.
 *
 * The box is the resting sheet's true pixel size, so the resting scale is
 * exactly 1.00x. Everything inside is authored in `em` off a root size set from
 * here, so the type tracks the viewport the way the sheet does.
 */
function sizeSheet() {
  if (!plan || !domSheet) return;
  domSheet.style.width = `${plan.sheetBox.w.toFixed(2)}px`;
  domSheet.style.height = `${plan.sheetBox.h.toFixed(2)}px`;
  domSheet.style.fontSize = `${(TYPE * plan.sheetBox.h).toFixed(2)}px`;
}

/* ── the timeline ─────────────────────────────────────────────────── */

/**
 * Everything up to the read pose runs on a clock. Everything after it waits.
 *
 * He holds the sheet up until he is dismissed, so until that happens the
 * sequence has no end — which is the honest description of a modal. `end` is
 * Infinity and the loop keeps running the read pose.
 */
function beats() {
  /* He walks the first 3.4 steps behind the wall, so those seconds can be spent
   * while the door is still swinging — nothing visible is lost, and it is the
   * cheapest second in the whole sequence. A small beat is kept so the doorway
   * is briefly, visibly empty. */
  const hidden = ENTRY_STEPS / CADENCE;
  const walkAt = Math.max(0.2, TIMING.door + TIMING.beat - hidden);
  const settleAt = walkAt + plan.seconds;
  const downAt = settleAt; // overlaps the settle
  const liftAt = downAt + TIMING.reachDown;
  const readAt = liftAt + TIMING.lift;

  if (dismissedAt === null) {
    return { walkAt, settleAt, downAt, liftAt, readAt, end: Infinity };
  }

  /* He puts it back where it came from, then leaves the way he came in: lean
   * into the gait first, walk second. Same wind-up as the entrance, because it
   * is the same toy and it only knows one way to start. */
  const lowerAt = Math.max(dismissedAt, readAt);
  const leaveAt = lowerAt + TIMING.lower;
  const exitAt = leaveAt + TIMING.windUp;

  return {
    walkAt,
    settleAt,
    downAt,
    liftAt,
    readAt,
    lowerAt,
    leaveAt,
    exitAt,
    end: exitAt + plan.exitSteps / CADENCE + 0.3,
  };
}

function frameAt(t) {
  const b = beats();
  const walked = t - b.walkAt;
  const windUp = clamp01((t - (b.walkAt - TIMING.windUp)) / TIMING.windUp);
  const cycles = START_PHASE + Math.max(0, walked) * (CADENCE / 2);
  const finish = START_PHASE + plan.steps / 2;

  /* The exit is more of the same route, so it is more of the same phase.
   * Distance along it is still spent by the gait and never set, which is the
   * only reason his feet stay planted on the way out too. */
  const exitWalked = b.exitAt !== undefined && t > b.exitAt ? t - b.exitAt : 0;
  const phase = Math.min(cycles, finish) + exitWalked * (CADENCE / 2);
  const gone = phase >= finish + plan.exitSteps / 2;

  const settle = clamp01((t - b.settleAt) / TIMING.settle);
  // Leaving reverses the settle: the lean comes back before the first step.
  const relean = b.leaveAt === undefined ? 0 : clamp01((t - b.leaveAt) / TIMING.windUp);
  const rock =
    walked <= 0
      ? windUp
      : cycles < finish
        ? 1
        : relean > 0
          ? relean
          : (1 - settle) ** 2;

  /* Arms. Down through the doorway, because at 42 degrees he is 1.041 wide
   * against a 0.940 opening and the jamb cuts his arm off; up once clear, which
   * turns the width problem into a readable beat. Then down to his sides to
   * pick the paper up, and up to present it. */
  const outside = clamp01((phase - (START_PHASE + ENTRY_STEPS / 2)) / (finish - (START_PHASE + ENTRY_STEPS / 2)));
  const cleared = Math.min(1, outside / TIMING.armsBy);
  const walking = robotDefaults.armRaise * cleared;

  const down = clamp01((t - b.downAt) / TIMING.reachDown);
  const up = clamp01((t - b.liftAt) / TIMING.lift);
  const put = b.lowerAt === undefined ? 0 : clamp01((t - b.lowerAt) / TIMING.lower);

  const armRaise =
    put > 0
      ? HOLD + (CARRY - HOLD) * ease(put)
      : up > 0
        ? CARRY + (HOLD - CARRY) * ease(up)
        : walking + (CARRY - walking) * ease(down);

  /* The sheet lies flat when it is down and opens as it comes up, on the same
   * progress as the arms. Both ends of the beat get it: it is born flat and
   * below the frame rather than appearing at full size 314px inside it, and it
   * goes back the same way. Paper picked up off a surface really does rotate as
   * it rises. */
  const sheetTilt = put > 0 ? SHEET.tilt + (LAY - SHEET.tilt) * ease(put) : LAY + (SHEET.tilt - LAY) * ease(up);

  return {
    phase,
    rock,
    armRaise,
    sheetTilt,
    /* It exists from the bottom of the reach until it is back down there. It
     * leaves the frame the way it entered — carried, below the crop — so there
     * is nothing to hide and nothing to fade. */
    sheet: t >= b.downAt + TIMING.reachDown && put < 1,
    entering: phase < START_PHASE + ENTRY_STEPS / 2,
    walkedOutside: outside,
    reading: put === 0 && t >= b.readAt,
    gone,
    end: b.end,
  };
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
 *
 * @param rock 0..1 scale on the gait's lean, for the moments he is not walking.
 *
 * `roll` is a sine a quarter cycle out of phase with the leg swing, so it peaks
 * exactly where the legs come together — the two can never both be zero. Both
 * ends of the walk sit on that beat, so the poses either side would be
 * feet-together *and* leaning 15 degrees, which reads as falling over rather
 * than as waiting. Scaling only the *rendered* lean is free and exact:
 * `routePose` always returns `travel: 0`, so the pose can be computed once at
 * full rock and reused while the lean changes, and nothing re-enters the
 * memoised `gaitTable` — which is keyed on `rockAngle`, so ramping the
 * parameter itself would rebuild it every frame.
 */
function drawFrame(f, { clip = f.entering, alpha = 1 } = {}) {
  const scene = getScene();
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  if (!scene || !plan) return;

  if (f.gone) {
    domSheet?.classList.remove("sheet--on");
    return;
  }

  // Posed at full rock so the route lands where the gait says it should.
  const pose = routePose(buildRobot({ ...params, phase: f.phase }), plan.route);
  const robot = buildRobot({
    ...params,
    phase: f.phase,
    rockAngle: params.rockAngle * f.rock,
    armRaise: f.armRaise,
  });
  if (f.sheet) robot.parts.push({ name: "sheet", quads: plan.sheetQuads(robot, f.sheetTilt) });

  const solids = placeRobot(robot, pose);
  const toScreen = mockupToScreen(scene);

  context.save();
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
  drawRobot(context, solids, toScreen, { weight: Math.max(1, scene.scale * 1.35) });
  context.restore();

  if (!domSheet) return;
  const placed = solids.find((s) => s.name === "sheet");
  if (!placed) {
    domSheet.classList.remove("sheet--on");
    return;
  }

  const corners = placed.quads[0].points.map((p) => toScreen(projectCameraSpace(toCameraSpace(p))));
  /* Laid flat the quad foreshortens to a line, where the homography is
   * near-singular and the type is a smear of its own scaling. By then it is off
   * the bottom of the frame anyway, so there is nothing to show and every
   * reason not to transform it. */
  const height = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
  const legible = height > 12 && Math.min(...corners.map((p) => p.y)) < window.innerHeight;

  domSheet.classList.toggle("sheet--on", legible);
  if (legible) applyHomography(domSheet, corners);
}

const clear = () => context.clearRect(0, 0, window.innerWidth, window.innerHeight);

/* ── the interaction ──────────────────────────────────────────────── */

/* Three states and two edges: **closed**, and clicking about opens it; **open**,
 * running the entrance and then holding on the read pose for as long as it
 * takes; **closing**, from the dismissal through the walk off, back to closed.
 *
 * The dismissal is a *time* rather than a flag because everything downstream of
 * it is still a timeline — `beats` needs to know when the lowering started, not
 * merely that it did. Recording it on the same clock as the entrance keeps
 * `frameAt` a pure function of `t` and one number.
 */
let frame = null;
let started = null;
let dismissedAt = null;
let opens = 0;
let shut = false;
/** True from the moment he is holding the sheet up. The gate on dismissal. */
let readable = false;

/* A virtual clock, so the speed-up can change the rate mid-walk without
 * anything jumping. `frameAt` is a pure function of elapsed seconds, so the
 * honest way to hurry him is to hand it seconds faster — rather than to reach
 * into the cadence, which is welded to the gait and would put his feet back to
 * skating. Rate changes bank the virtual time spent so far and restart the
 * measurement, so both formulas agree at the instant of the change. */
let clockBase = 0;
let clockFrom = 0;
let rate = 1;

const now = () => clockBase + ((performance.now() - clockFrom) / 1000) * rate;
const isOpen = () => started !== null;

/**
 * A dismissal only counts once he is actually holding the sheet up.
 *
 * An earlier version accepted one at any time and clamped it forward to the
 * read pose, so that a click was never swallowed. In practice that is worse
 * than swallowing it: you click during the walk, nothing happens, you forget,
 * and then the instant he gets the sheet up it slams shut in your face. A modal
 * that has not finished opening has nothing to close.
 */
const dismissable = () => isOpen() && dismissedAt === null && readable;

export function runAbout() {
  if (isOpen()) return;
  rebuildPlan();
  if (!plan) return;
  sizeSheet();

  /* No new paper planes while someone is reading. `flight.js` holds its clock
   * at the next cycle boundary rather than cutting anything off, so a plane
   * already in the air finishes its path. */
  window.dispatchEvent(new CustomEvent("about:open"));

  opens += 1;
  dismissedAt = null;
  readable = false;
  shut = false;
  started = performance.now();
  clockBase = 0;
  clockFrom = started;
  rate = 1;

  if (stillFrames.matches) {
    /* No motion: go straight to what the sequence was there to say — he is
     * here, and this is the paper. Dismissing still works; it just has nothing
     * to animate, so it closes. */
    openDoor();
    readable = true;
    setDismissVisible(true);
    drawFrame(frameAt(beats().readAt), { clip: false });
    return;
  }

  /* Second visit onward. He is worth watching once; after that a reader who
   * already knows the joke should be able to say so. */
  hurryButton?.classList.toggle("hurry--on", opens > 1);

  openDoor();
  frame = requestAnimationFrame(function step() {
    const t = now();
    const f = frameAt(t);
    drawFrame(f);

    if (!shut && f.walkedOutside >= TIMING.shutAt) {
      shut = true;
      closeDoor();
    }
    if (f.reading && dismissedAt === null) {
      readable = true;
      setDismissVisible(true);
      /* Nothing left to hurry — from here the page waits on the reader. */
      hurryButton?.classList.remove("hurry--on");
    }

    if (t < f.end + 0.2) frame = requestAnimationFrame(step);
    else closeAbout();
  });
}

function dismiss() {
  if (!dismissable()) return;
  strip();
  dismissedAt = now();
  setDismissVisible(false);
  hurryButton?.classList.remove("hurry--on");
  if (stillFrames.matches) closeAbout();
}

function hurry() {
  if (!isOpen() || rate !== 1) return;
  clockBase = now();
  clockFrom = performance.now();
  rate = HURRY_RATE;
  hurryButton?.classList.remove("hurry--on");
}

export function closeAbout() {
  strip();
  if (frame) cancelAnimationFrame(frame);
  frame = null;
  started = null;
  dismissedAt = null;
  readable = false;
  shut = false;
  setDismissVisible(false);
  hurryButton?.classList.remove("hurry--on");
  domSheet?.classList.remove("sheet--on", "sheet--live");
  closeDoor();
  clear();
  window.dispatchEvent(new CustomEvent("about:close"));
}

/* The copy only becomes clickable once it is up. While it is riding into frame
 * a click belongs to the backdrop, not to the paper. */
function setDismissVisible(on) {
  domSheet?.classList.toggle("sheet--live", on);
}

/* ── wiring ───────────────────────────────────────────────────────── */

window.addEventListener("room:layout", () => {
  resizeCanvas();
  /* Replanning mid-walk slides him along the new route by up to two steps, so
   * the route is frozen once he is moving — see "Resizing mid-walk" in
   * ROBOT.md. Before that, rebuild freely. */
  if (!isOpen()) {
    rebuildPlan();
    sizeSheet();
  }
});

/* ── the route ────────────────────────────────────────────────────── */

/* `#about` is the state, and `hashchange` is the only thing that opens or
 * closes it. That is worth the indirection: it makes the bio a real address —
 * linkable, and closable with the back button, which is what anyone expects of
 * something modal-shaped. Before this the URL could drive the page but the page
 * never drove the URL, so opening it left you at `/` with no way to link to
 * what you were looking at.
 *
 * Opening lets the anchor navigate normally, which pushes a history entry, so
 * Back pops it and the resulting `hashchange` closes. Dismissing *replaces*
 * that entry instead of pushing a clean one — pushing would leave `#about`
 * behind in the history, and Back would reopen the thing you just closed. */
const strip = () => {
  if (location.hash === "#about") {
    history.replaceState(null, "", location.pathname + location.search);
  }
};

window.addEventListener("hashchange", () => {
  if (location.hash === "#about") runAbout();
  else if (isOpen()) closeAbout();
});

aboutLink?.addEventListener("click", (event) => {
  /* Closed: let the browser set the hash and let `hashchange` do the opening,
   * so there is exactly one path in. Open: it is a toggle. */
  if (!isOpen()) return;
  event.preventDefault();
  if (dismissable()) dismiss();
});

dismissButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  dismiss();
});

hurryButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  hurry();
});

/* Click away to close. The sheet itself is excluded — it is selectable text,
 * which is the entire reason the copy is DOM and not canvas, and a modal that
 * closes when you try to select its contents is broken. */
window.addEventListener("click", (event) => {
  if (!dismissable()) return;
  if (event.target.closest(".sheet, .masthead, .hurry")) return;
  dismiss();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") dismiss();
});

resizeCanvas();
rebuildPlan();
sizeSheet();

if (location.hash === "#about") runAbout();

/* ── inspection hooks ─────────────────────────────────────────────── */

/* Not public controls. The sequence is over in about fifteen seconds and a
 * headless screenshot lands wherever it lands, so these are the only way to
 * look at a chosen moment of it.
 *
 * `?about=0.4` holds four tenths of the way along the walk; `?about=1` is the
 * arrival. `?entry=0` holds the real start 3.4 steps behind the threshold and
 * `?entry=0.35` its first peek round the far jamb — at zero the correct
 * visitor view is an empty doorway, so `&xray=1` draws the occluded robot at
 * reduced opacity for placement inspection. `?read=1` is the finished frame,
 * sheet up. An explicit `?door=` wins over all of them. */
const hold = (draw) => {
  if (!plan) return;
  if (!query.has("door")) setDoorAngle(DOOR_PANEL.open);
  started = performance.now();
  clockFrom = started;
  draw();
};

if (query.has("read")) {
  hold(() => {
    readable = true;
    setDismissVisible(true);
    drawFrame(frameAt(beats().readAt), { clip: false });
  });
} else if (query.has("about")) {
  const along = clamp01(num("about", 0));
  hold(() => {
    const finish = START_PHASE + plan.steps / 2;
    const phase = START_PHASE + along * (finish - START_PHASE);
    const entry = START_PHASE + ENTRY_STEPS / 2;
    const outside = clamp01((phase - entry) / (finish - entry));
    drawFrame({
      phase,
      rock: along === 0 || along === 1 ? 0 : 1,
      armRaise: robotDefaults.armRaise * Math.min(1, outside / TIMING.armsBy),
      sheetTilt: LAY,
      sheet: false,
      entering: phase < entry,
      walkedOutside: outside,
      reading: false,
      gone: false,
    });
  });
} else if (query.has("entry")) {
  const along = clamp01(num("entry", 0));
  const xray = query.get("xray") === "1";
  hold(() =>
    drawFrame(
      {
        phase: START_PHASE + (ENTRY_STEPS / 2) * along,
        rock: along === 0 ? 0 : 1,
        armRaise: 0,
        sheetTilt: LAY,
        sheet: false,
        entering: true,
        walkedOutside: 0,
        reading: false,
        gone: false,
      },
      { clip: !xray, alpha: xray ? 0.48 : 1 },
    ),
  );
}
