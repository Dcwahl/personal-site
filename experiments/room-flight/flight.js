const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const flightDuration = 10_800;
const cycleDuration = 14_500;
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

function projectVertex([x, y, z], centerX, centerY, size) {
  return {
    x: centerX + x * size,
    y: centerY + (y * 0.5 - z * 0.92) * size,
  };
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
      -0.33 +
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

function drawTrail(progress) {
  const trailEnd = Math.max(0, progress - 0.022);
  const samples = Math.max(2, Math.ceil(trailEnd * 180));

  context.save();
  context.beginPath();

  for (let index = 0; index <= samples; index += 1) {
    const sampleProgress = (index / samples) * trailEnd;
    const point = getFlightPosition(sampleProgress);

    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  }

  context.setLineDash([1.25, 5.25]);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 1;
  context.strokeStyle = "rgba(23, 20, 15, 0.68)";
  context.stroke();
  context.restore();
}

function drawPlane(centerX, centerY, elapsed, progress) {
  const rotation = getPlaneRotation(progress, elapsed);
  const size =
    Math.max(19, Math.min(29, viewport.width / 48)) *
    0.67 *
    rotation.depthScale;
  const points = plane.vertices.map((vertex) =>
    projectVertex(
      rotateVertex(vertex, rotation.roll, rotation.pitch, rotation.yaw),
      centerX,
      centerY,
      size,
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
  }

  if (cycleTime < flightDuration) {
    const progress = cycleTime / flightDuration;
    const point = getFlightPosition(progress);
    drawTrail(progress);
    drawPlane(point.x, point.y, cycleTime, progress);
  } else {
    drawTrail(1);
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

resizeCanvas();
restartAnimation();
