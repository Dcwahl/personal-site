const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");
const shapeButtons = [...document.querySelectorAll("[data-shape]")];
const variantButtons = [...document.querySelectorAll("[data-variant]")];
const sceneLayers = [...document.querySelectorAll(".scene")];
const imageToggle = document.querySelector("[data-image-toggle]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const flightDuration = 10_500;
const cycleDuration = 14_500;
const rotationFramesPerSecond = 7;
const startTime = performance.now() - 650;

const planeModels = {
  dart: {
    vertices: [
      [2.55, 0, 0],
      [-1.55, 0, -0.32],
      [-1.35, 1.32, 0.15],
      [-1.35, -1.32, 0.15],
      [-1.42, 0.2, 0.02],
      [-1.42, -0.2, 0.02],
    ],
    faces: [
      [0, 4, 2],
      [0, 1, 4],
      [0, 5, 1],
      [0, 3, 5],
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
    scale: 1,
  },
  glider: {
    vertices: [
      [1.75, 0, 0],
      [-1.3, 0, -0.14],
      [0.15, 1.95, 0.08],
      [0.15, -1.95, 0.08],
      [-1.18, 1.3, 0.02],
      [-1.18, -1.3, 0.02],
    ],
    faces: [
      [0, 4, 2],
      [0, 1, 4],
      [0, 5, 1],
      [0, 3, 5],
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
    scale: 0.92,
  },
  wingtips: {
    vertices: [
      [2.35, 0, 0],
      [-1.5, 0, -0.3],
      [-1.05, 0.78, 0.03],
      [-1.05, -0.78, 0.03],
      [-0.55, 1.38, 0.82],
      [-0.55, -1.38, 0.82],
    ],
    faces: [
      [0, 2, 4],
      [0, 1, 2],
      [0, 3, 1],
      [0, 5, 3],
    ],
    edges: [
      [0, 4],
      [4, 2],
      [2, 1],
      [1, 3],
      [3, 5],
      [5, 0],
      [0, 2],
      [0, 3],
      [0, 1],
    ],
    scale: 0.98,
  },
};

let viewport = { width: 0, height: 0, scale: 1 };
let shape = getShape();
let variant = getVariant();
let imageVisible = getImageVisible();
let flightProfile = createFlightProfile();
let currentCycle = -1;
let animationFrame;

function getShape() {
  const requested = new URLSearchParams(window.location.search).get("shape");
  return requested in planeModels ? requested : "dart";
}

function getVariant() {
  const requested = new URLSearchParams(window.location.search).get("variant");
  return requested === "outline" ? "outline" : "translucent";
}

function getImageVisible() {
  return new URLSearchParams(window.location.search).get("image") !== "off";
}

function updateUrl(parameter, value) {
  const url = new URL(window.location.href);
  url.searchParams.set(parameter, value);
  window.history.replaceState({}, "", url);
}

function setShape(nextShape) {
  shape = nextShape in planeModels ? nextShape : "dart";
  updateUrl("shape", shape);

  for (const button of shapeButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.shape === shape));
  }

  redrawReducedMotionFrame();
}

function setVariant(nextVariant) {
  variant = nextVariant;
  updateUrl("variant", variant);

  for (const button of variantButtons) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.variant === variant),
    );
  }

  redrawReducedMotionFrame();
}

function setImageVisible(visible) {
  imageVisible = visible;
  for (const layer of sceneLayers) {
    layer.hidden = !visible;
  }
  imageToggle.setAttribute("aria-pressed", String(visible));
  imageToggle.textContent = visible ? "image on" : "image off";
  updateUrl("image", visible ? "on" : "off");
}

function redrawReducedMotionFrame() {
  if (reducedMotion.matches && viewport.width > 0) {
    restartAnimation();
  }
}

function createFlightProfile() {
  return {
    oscillations: 2.45 + Math.random() * 0.85,
    phaseOffset: -Math.PI / 2 + (Math.random() - 0.5) * 0.42,
    verticalAmplitude: 0.045 + Math.random() * 0.026,
    overallDrop: 0.14 + Math.random() * 0.1,
    secondHarmonic: 0.12 + Math.random() * 0.16,
    harmonicPhase: Math.random() * Math.PI * 2,
    driftPhase: Math.random() * Math.PI * 2,
    speedPulse: 0.012 + Math.random() * 0.012,
    bankAmplitude: 0.42 + Math.random() * 0.2,
    firstBankDirection: Math.random() < 0.5 ? -1 : 1,
    pitchAmplitude: 0.13 + Math.random() * 0.09,
    yawAmplitude: 0.045 + Math.random() * 0.06,
    depthAmount: 0.28 + Math.random() * 0.14,
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
    depth: y * 0.84 + z * 0.46,
  };
}

function drawFace(points, face, fill) {
  context.beginPath();
  context.moveTo(points[face[0]].x, points[face[0]].y);
  context.lineTo(points[face[1]].x, points[face[1]].y);
  context.lineTo(points[face[2]].x, points[face[2]].y);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
}

function getGlidePhase(progress) {
  return (
    progress * Math.PI * 2 * flightProfile.oscillations +
    flightProfile.phaseOffset
  );
}

function drawPlane(centerX, centerY, elapsed, progress = 0.5) {
  const model = planeModels[shape];
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
  const roll =
    bankDirection * flightProfile.bankAmplitude * bankEnvelope +
    0.045 * Math.sin(glidePhase * 0.53 + flightProfile.driftPhase);
  const pitch =
    -0.04 +
    flightProfile.pitchAmplitude * Math.cos(glidePhase + 0.15);
  const yaw =
    Math.PI +
    bankDirection * flightProfile.yawAmplitude * bankEnvelope +
    0.025 * Math.sin(glidePhase * 0.47 + flightProfile.driftPhase);
  const depthScale =
    0.82 +
    flightProfile.depthAmount * Math.sin(progress * Math.PI) +
    0.035 *
      Math.sin(progress * Math.PI * 2 + flightProfile.driftPhase) *
      Math.sin(progress * Math.PI);
  const size =
    Math.max(19, Math.min(29, viewport.width / 48)) *
    model.scale *
    depthScale;

  const points = model.vertices.map((vertex) =>
    projectVertex(
      rotateVertex(vertex, roll, pitch, yaw),
      centerX,
      centerY,
      size,
    ),
  );

  if (variant === "translucent") {
    const orderedFaces = model.faces
      .map((face, index) => ({
        face,
        index,
        depth:
          face.reduce((sum, pointIndex) => sum + points[pointIndex].depth, 0) /
          face.length,
      }))
      .sort((a, b) => a.depth - b.depth);

    for (const { face, index } of orderedFaces) {
      const alpha = 0.075 + (index % 3) * 0.02;
      drawFace(points, face, `rgba(255, 252, 231, ${alpha})`);
    }
  }

  context.beginPath();
  for (const [start, end] of model.edges) {
    context.moveTo(points[start].x, points[start].y);
    context.lineTo(points[end].x, points[end].y);
  }
  context.lineWidth = variant === "outline" ? 1.4 : 1.2;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle =
    variant === "outline" ? "rgba(0, 0, 0, 0.88)" : "rgba(0, 0, 0, 0.7)";
  context.stroke();
}

function render(now) {
  context.clearRect(0, 0, viewport.width, viewport.height);

  if (reducedMotion.matches) {
    drawPlane(viewport.width * 0.55, viewport.height * 0.42, 0);
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
    const margin = Math.max(170, viewport.width * 0.12);
    const glidePhase = getGlidePhase(progress);
    const horizontalProgress =
      progress +
      flightProfile.speedPulse *
        Math.sin(glidePhase) *
        Math.sin(progress * Math.PI) +
      0.005 *
        Math.sin(glidePhase * 0.5 + flightProfile.driftPhase) *
        Math.sin(progress * Math.PI);
    const verticalWave =
      Math.sin(glidePhase) +
      flightProfile.secondHarmonic *
        Math.sin(glidePhase * 2 + flightProfile.harmonicPhase) +
      0.15 *
        Math.sin(glidePhase * 0.47 + flightProfile.driftPhase);
    const x =
      viewport.width +
      margin -
      horizontalProgress * (viewport.width + margin * 2);
    const y =
      viewport.height * 0.25 +
      progress * viewport.height * flightProfile.overallDrop +
      verticalWave *
        Math.min(58, viewport.height * flightProfile.verticalAmplitude);

    drawPlane(x, y, cycleTime, progress);
  }

  animationFrame = requestAnimationFrame(render);
}

function restartAnimation() {
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(render);
}

for (const button of shapeButtons) {
  button.addEventListener("click", () => setShape(button.dataset.shape));
}

for (const button of variantButtons) {
  button.addEventListener("click", () => setVariant(button.dataset.variant));
}

imageToggle.addEventListener("click", () => setImageVisible(!imageVisible));

window.addEventListener("resize", resizeCanvas);
reducedMotion.addEventListener("change", restartAnimation);

setShape(shape);
setVariant(variant);
setImageVisible(imageVisible);
resizeCanvas();
restartAnimation();
