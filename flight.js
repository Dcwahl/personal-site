import {
  buildTrailDots,
  drawTrail as drawTrailDots,
  trailStyle,
} from "./trail.js";
import {
  createFlightProfile,
  drawPlane,
  getFlightPosition,
  planeStyle,
} from "./plane.js";

const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const flightDuration = 10_800;
const trailLifetime = 9_000;
// Long enough for the last of the trail to fade out before the next plane
// enters, so the two never overlap.
const cycleDuration = flightDuration + trailLifetime + 1_800;
const startTime = performance.now() - 1_300;

let viewport = { width: 0, height: 0, scale: 1 };
let flightProfile = createFlightProfile();
let trailDots = [];
let currentCycle = -1;
let animationFrame;
let resizeTimer;

const pathAt = (progress) => getFlightPosition(progress, viewport, flightProfile);

function resizeCanvas() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const scale = Math.min(window.devicePixelRatio || 1, 2);

  viewport = { width, height, scale };
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  context.setTransform(scale, 0, 0, scale, 0, 0);
  trailDots = buildTrailDots(pathAt);
}

function drawTrail(progress, ageOffset = 0) {
  drawTrailDots(context, trailDots, {
    progress,
    ageOffset,
    flightDuration,
    trailLifetime,
  });
}

function drawFrame(progress, elapsed) {
  const point = pathAt(progress);

  drawTrail(progress);
  drawPlane(context, {
    x: point.x,
    y: point.y,
    progress,
    elapsed,
    profile: flightProfile,
    viewport,
    flightDuration,
  });
}

function render(now) {
  context.clearRect(0, 0, viewport.width, viewport.height);

  if (reducedMotion.matches) {
    drawFrame(0.54, 0.54 * flightDuration);
    return;
  }

  const elapsed = now - startTime;
  const cycle = Math.floor(elapsed / cycleDuration);
  const cycleTime = elapsed % cycleDuration;

  if (cycle !== currentCycle) {
    currentCycle = cycle;
    flightProfile = createFlightProfile();
    trailDots = buildTrailDots(pathAt);
  }

  if (cycleTime < flightDuration) {
    drawFrame(cycleTime / flightDuration, cycleTime);
  } else {
    drawTrail(1, cycleTime - flightDuration);
  }

  animationFrame = requestAnimationFrame(render);
}

function restartAnimation() {
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(render);
}

// buildTrailDots walks the path 1,400 times, so it is kept off the resize
// event itself and run once the drag has settled.
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    resizeCanvas();
    restartAnimation();
  }, 120);
});
reducedMotion.addEventListener("change", restartAnimation);

// Live tweaking from the console: window.plane.style.bankAmplitude = 0.4; then
// window.plane.reroll(). Trail: window.trail.style.length = 4; window.trail.rebuild().
window.trail = {
  style: trailStyle,
  rebuild: () => {
    trailDots = buildTrailDots(pathAt);
  },
};
window.plane = {
  style: planeStyle,
  reroll: (seed) => {
    flightProfile = createFlightProfile(seed);
    trailDots = buildTrailDots(pathAt);
  },
};

resizeCanvas();
restartAnimation();
