import {
  buildTrailDots,
  drawTrail as drawTrailDots,
  trailStyle,
} from "./trail.js";

const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const flightDuration = 10_800;
const trailLifetime = 9_000;
// Long enough for the last of the trail to fade out before the next plane
// enters, so the two never overlap.
const cycleDuration = flightDuration + trailLifetime + 1_800;
const rotationFramesPerSecond = 7;
const startTime = performance.now() - 1_300;

const plane = {
  vertices: [
    [2.55, 0, 0],
    [-1.55, 0, -0.32],
    [-1.35, 1.32, 0.15],
    [-1.35, -1.32, 0.15],
    [-1.42, 0.2, 0.02],
    [-1.42, -0.2, 0.02],
  ],
  edges: [
    [0, 2],
    [2, 4],
    [4, 1],
    [1, 5],
    [5, 3],
    [3, 0],
    [0, 4],
    [0, 5],
    [0, 1],
  ],
};

let viewport = { width: 0, height: 0, scale: 1 };
let flightProfile = createFlightProfile();
let trailDots = [];
let currentCycle = -1;
let animationFrame;

function createFlightProfile() {
  return {
    oscillations: 1.15 + Math.random() * 0.25,
    phaseOffset: -Math.PI / 2 + (Math.random() - 0.5) * 0.34,
    verticalAmplitude: 0.014 + Math.random() * 0.008,
    overallRise: 0.065 + Math.random() * 0.03,
    secondHarmonic: 0.04 + Math.random() * 0.06,
    harmonicPhase: Math.random() * Math.PI * 2,
    driftPhase: Math.random() * Math.PI * 2,
    speedPulse: 0.01 + Math.random() * 0.012,
    bankAmplitude: 0.16 + Math.random() * 0.08,
    firstBankDirection: Math.random() < 0.5 ? -1 : 1,
    pitchAmplitude: 0.12 + Math.random() * 0.08,
    yawAmplitude: 0.025 + Math.random() * 0.035,
    depthAmount: 0.25 + Math.random() * 0.13,
  };
}

function resizeCanvas() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const scale = Math.min(window.devicePixelRatio || 1, 2);

  viewport = { width, height, scale };
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  context.setTransform(scale, 0, 0, scale, 0, 0);
  trailDots = buildTrailDots(getFlightPosition);
}

function getGlidePhase(progress) {
  return (
    progress * Math.PI * 2 * flightProfile.oscillations +
    flightProfile.phaseOffset
  );
}

function getFlightPosition(progress) {
  const margin = Math.max(150, viewport.width * 0.11);
  const glidePhase = getGlidePhase(progress);
  const easedProgress =
    progress +
    flightProfile.speedPulse *
      Math.sin(glidePhase) *
      Math.sin(progress * Math.PI);
  const verticalWave =
    Math.sin(glidePhase) +
    flightProfile.secondHarmonic *
      Math.sin(glidePhase * 2 + flightProfile.harmonicPhase) +
    0.12 * Math.sin(glidePhase * 0.48 + flightProfile.driftPhase);

  return {
    x: -margin + easedProgress * (viewport.width + margin * 2),
    y:
      viewport.height * 0.56 -
      progress * viewport.height * flightProfile.overallRise +
      verticalWave *
        Math.min(52, viewport.height * flightProfile.verticalAmplitude),
  };
}

function rotateVertex([x, y, z], roll, pitch, yaw) {
  const cosRoll = Math.cos(roll);
  const sinRoll = Math.sin(roll);
  const rolledY = y * cosRoll - z * sinRoll;
  const rolledZ = y * sinRoll + z * cosRoll;

  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const pitchedX = x * cosPitch + rolledZ * sinPitch;
  const pitchedZ = -x * sinPitch + rolledZ * cosPitch;

  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);

  return [
    pitchedX * cosYaw - rolledY * sinYaw,
    pitchedX * sinYaw + rolledY * cosYaw,
    pitchedZ,
  ];
}

/**
 * Camera. Fixed, viewing the plane from the side at CAMERA_ELEVATION above
 * horizontal, so the model's forward axis maps straight to screen-right.
 *
 * Keeping the camera free of any baked-in heading is what lets the nose track
 * the flight path: the projected shape is rotated by the path's own tangent in
 * drawPlane, rather than the heading being frozen into the projection.
 */
const CAMERA_ELEVATION = 0.52; // ~30 degrees above the horizontal
const CAMERA_AZIMUTH = 0.35; // ~20 degrees around from abeam, toward the tail

const SIN_ELEVATION = Math.sin(CAMERA_ELEVATION);
const COS_ELEVATION = Math.cos(CAMERA_ELEVATION);
const SIN_AZIMUTH = Math.sin(CAMERA_AZIMUTH);
const COS_AZIMUTH = Math.cos(CAMERA_AZIMUTH);

// Viewing straight from the side collapses the whole wingspan onto screen-Y and
// the plane reads as a sliver. The azimuth swings the camera behind the wing so
// the planform opens up, which is the three-quarter view the mockup is drawn in.
const projectAxes = ([x, y, z]) => [
  COS_AZIMUTH * x - SIN_AZIMUTH * y,
  -SIN_ELEVATION * SIN_AZIMUTH * x - SIN_ELEVATION * COS_AZIMUTH * y -
    COS_ELEVATION * z,
];

// The nose does not land on screen-horizontal under that camera, so its resting
// angle is measured once and taken back out when aligning to the flight path.
const NOSE_ANGLE = Math.atan2(
  -SIN_ELEVATION * SIN_AZIMUTH,
  COS_AZIMUTH,
);

function projectVertex(vertex, centerX, centerY, size, heading) {
  const [ax, ay] = projectAxes(vertex);
  const localX = ax * size;
  const localY = ay * size;
  const angle = heading - NOSE_ANGLE;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: centerX + localX * cos - localY * sin,
    y: centerY + localX * sin + localY * cos,
  };
}

/**
 * Screen-space direction of travel, sampled off the flight path itself. The
 * plane is drawn along this, so its attitude and its velocity stay locked
 * together no matter how the path bends.
 */
function getHeading(progress) {
  const step = 0.004;
  const from = getFlightPosition(Math.max(0, progress - step));
  const to = getFlightPosition(Math.min(1, progress + step));

  return Math.atan2(to.y - from.y, to.x - from.x);
}

function getPlaneRotation(progress, elapsed) {
  const steppedSeconds =
    Math.floor((elapsed / 1_000) * rotationFramesPerSecond) /
    rotationFramesPerSecond;
  const steppedProgress = Math.min(
    1,
    steppedSeconds / (flightDuration / 1_000),
  );
  const glidePhase = getGlidePhase(steppedProgress);
  const bankPosition = steppedProgress * flightProfile.oscillations;
  const bankSegment = Math.floor(bankPosition);
  const bankProgress = bankPosition - bankSegment;
  const bankDirection =
    (bankSegment % 2 === 0 ? 1 : -1) *
    flightProfile.firstBankDirection;
  const bankEnvelope = Math.sin(bankProgress * Math.PI);

  return {
    roll:
      bankDirection * flightProfile.bankAmplitude * bankEnvelope +
      0.04 * Math.sin(glidePhase * 0.53 + flightProfile.driftPhase),
    pitch:
      -0.035 + flightProfile.pitchAmplitude * Math.cos(glidePhase + 0.15),
    yaw:
      bankDirection * flightProfile.yawAmplitude * bankEnvelope +
      0.02 * Math.sin(glidePhase * 0.47 + flightProfile.driftPhase),
    depthScale:
      0.84 +
      flightProfile.depthAmount * Math.sin(progress * Math.PI) +
      0.03 *
        Math.sin(progress * Math.PI * 2 + flightProfile.driftPhase) *
        Math.sin(progress * Math.PI),
  };
}

function drawTrail(progress, ageOffset = 0) {
  drawTrailDots(context, trailDots, {
    progress,
    ageOffset,
    flightDuration,
    trailLifetime,
  });
}

function drawPlane(centerX, centerY, elapsed, progress) {
  const rotation = getPlaneRotation(progress, elapsed);
  const size =
    Math.max(16, Math.min(29, viewport.width / 57)) * rotation.depthScale;
  const heading = getHeading(progress);
  const points = plane.vertices.map((vertex) =>
    projectVertex(
      rotateVertex(vertex, rotation.roll, rotation.pitch, rotation.yaw),
      centerX,
      centerY,
      size,
      heading,
    ),
  );

  context.save();
  context.beginPath();

  for (const [start, end] of plane.edges) {
    context.moveTo(points[start].x, points[start].y);
    context.lineTo(points[end].x, points[end].y);
  }

  context.lineWidth = 1.35;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = "rgba(23, 20, 15, 0.9)";
  context.stroke();
  context.restore();
}

function drawReducedMotionFrame() {
  const progress = 0.54;
  const point = getFlightPosition(progress);
  drawTrail(progress);
  drawPlane(point.x, point.y, progress * flightDuration, progress);
}

function render(now) {
  context.clearRect(0, 0, viewport.width, viewport.height);

  if (reducedMotion.matches) {
    drawReducedMotionFrame();
    return;
  }

  const elapsed = now - startTime;
  const cycle = Math.floor(elapsed / cycleDuration);
  const cycleTime = elapsed % cycleDuration;

  if (cycle !== currentCycle) {
    currentCycle = cycle;
    flightProfile = createFlightProfile();
    trailDots = buildTrailDots(getFlightPosition);
  }

  if (cycleTime < flightDuration) {
    const progress = cycleTime / flightDuration;
    const point = getFlightPosition(progress);
    drawTrail(progress);
    drawPlane(point.x, point.y, cycleTime, progress);
  } else {
    drawTrail(1, cycleTime - flightDuration);
  }

  animationFrame = requestAnimationFrame(render);
}

function restartAnimation() {
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(render);
}

window.addEventListener("resize", () => {
  resizeCanvas();
  restartAnimation();
});
reducedMotion.addEventListener("change", restartAnimation);

// Live tweaking from the console: window.trail.style.length = 4; then
// window.trail.rebuild() if you changed spacing.
window.trail = {
  style: trailStyle,
  rebuild: () => {
    trailDots = buildTrailDots(getFlightPosition);
  },
};

resizeCanvas();
restartAnimation();
