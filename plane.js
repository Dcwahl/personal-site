/**
 * The plane: its model, how it moves, and how it is drawn.
 *
 * Split out of flight.js so the tuner in experiments/tools can drive the exact
 * same code the site runs. Everything adjustable lives in `planeStyle`; the
 * per-flight randomness lives in a profile rolled from a seed, so re-rolling
 * with the same seed changes only the parameter you moved and leaves the
 * flight's character alone. That is what makes A/B comparison possible.
 */

/** Bumped on every change here, so a stale module cache is visible, not guessed. */
export const BUILD = "b4-irregular";

export const planeModel = {
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

/** Live-tunable. The tuner writes straight into this object. */
export const planeStyle = {
  // ── path shape ──
  oscillations: 1.15, // full up-down cycles across the screen
  verticalAmplitude: 0.014, // wave height, as a fraction of viewport height
  verticalTrend: 0.065, // + climbs across the screen, - descends
  secondHarmonic: 0.04, // adds asymmetry to the wave
  speedPulse: 0.01, // slight surge and ease along the path

  // ── irregularity ──
  // Sines alone always read as a pattern once you watch a whole flight, so the
  // aperiodic part comes from seeded value noise instead of more sine terms.
  // All default to 0, which is exactly the old purely-sinusoidal path.
  irregularity: 0, // aperiodic drift added to the vertical wave
  swoopVariation: 0, // some swoops deeper than their neighbours
  phaseWander: 0, // the swoop period breathes instead of staying fixed
  swoopSkew: 0, // dive steeper than the climb, the way a real glider does
  noiseScale: 3, // how many noise features fit across one flight

  // ── attitude ──
  bankAmplitude: 0.16, // roll into each turn, radians
  pitchAmplitude: 0.12, // nose up/down through the wave, radians
  yawAmplitude: 0.025, // nose left/right into each turn, radians
  yawOffset: 0, // extra constant yaw bias, on top of the direction of travel
  direction: 1, // +1 flies left to right, -1 right to left

  // ── camera ──
  // Elevation's SIGN picks which face you see: positive looks down on the
  // plane, negative looks up at its underside. Azimuth 0 is straight abeam,
  // which collapses the wingspan; winding it up opens the planform out.
  elevation: 0.52,
  azimuth: 0.35,

  // ── render ──
  depthAmount: 0.25, // how much it swells toward mid-screen
  sizeDivisor: 57, // viewport.width / this, clamped by sizeMin/sizeMax
  sizeMin: 16,
  sizeMax: 29,
  rotationFps: 7, // attitude is stepped to this rate; 0 = smooth
  stepEverything: false, // also step heading and depth, not just attitude
  trackHeading: true, // point the nose along the path's own tangent
  variance: 1, // 0 pins every flight to the base values
  seed: 1, // tuner keeps this fixed; the site re-rolls per flight
};

/**
 * Spread of the per-flight randomness, as a fraction of each base value, so
 * the spread scales sensibly when a slider moves instead of staying pinned to
 * an amount that only suited the original number.
 */
const VARY_FRACTION = {
  oscillations: 0.25,
  verticalAmplitude: 0.57,
  verticalTrend: 0.5,
  secondHarmonic: 1.4,
  speedPulse: 1.1,
  bankAmplitude: 0.5,
  pitchAmplitude: 0.67,
  yawAmplitude: 1.4,
  depthAmount: 0.52,
};

/** Reference points from the two flights worth comparing. */
export const presets = {
  current: {
    oscillations: 1.15,
    verticalAmplitude: 0.014,
    verticalTrend: 0.065,
    secondHarmonic: 0.04,
    speedPulse: 0.01,
    bankAmplitude: 0.16,
    pitchAmplitude: 0.12,
    yawAmplitude: 0.025,
    yawOffset: 0,
    direction: 1,
    irregularity: 0,
    swoopVariation: 0,
    phaseWander: 0,
    swoopSkew: 0,
    elevation: 0.52,
    azimuth: 0.35,
    depthAmount: 0.25,
    trackHeading: true,
    rotationFps: 7,
  },
  // experiments/paper-plane, the dart. Descends rather than climbs, banks
  // roughly three times as hard, and never turns to follow its path. The study
  // itself flew right to left; this carries its dynamics over to the site's
  // left-to-right flight. Tick "fly right to left" to see the original.
  dart: {
    oscillations: 2.45,
    verticalAmplitude: 0.045,
    verticalTrend: -0.14,
    secondHarmonic: 0.12,
    speedPulse: 0.012,
    bankAmplitude: 0.42,
    pitchAmplitude: 0.13,
    yawAmplitude: 0.045,
    yawOffset: 0,
    direction: 1,
    irregularity: 0,
    swoopVariation: 0,
    phaseWander: 0,
    swoopSkew: 0,
    elevation: -0.52,
    azimuth: 0,
    depthAmount: 0.28,
    trackHeading: false,
    rotationFps: 7,
  },
};

function makeRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createFlightProfile(seed, style = planeStyle) {
  const random = makeRandom(
    seed === undefined ? Math.floor(Math.random() * 1e9) : seed,
  );
  // Each base value gets a one-sided spread, matching how the original flight
  // profile was written (base + random * amount).
  const vary = (key) =>
    style[key] +
    random() * Math.abs(style[key]) * VARY_FRACTION[key] * style.variance;

  return {
    oscillations: vary("oscillations"),
    verticalAmplitude: vary("verticalAmplitude"),
    verticalTrend: vary("verticalTrend"),
    secondHarmonic: vary("secondHarmonic"),
    speedPulse: vary("speedPulse"),
    bankAmplitude: vary("bankAmplitude"),
    pitchAmplitude: vary("pitchAmplitude"),
    yawAmplitude: vary("yawAmplitude"),
    depthAmount: vary("depthAmount"),
    phaseOffset: -Math.PI / 2 + (random() - 0.5) * 0.34 * style.variance,
    harmonicPhase: random() * Math.PI * 2,
    driftPhase: random() * Math.PI * 2,
    firstBankDirection: random() < 0.5 ? -1 : 1,
    // Drawn last on purpose: every value above keeps its position in the
    // random sequence, so a seed that produced a flight you liked still does.
    noise: makeNoiseTable(random),
  };
}

/**
 * With heading tracking off the nose direction is fixed, so it has to be turned
 * to match the way the plane is actually travelling. Applied here as 3D yaw
 * rather than as a screen rotation: those are not the same transform, and the
 * 3D one is what the dart study used.
 */
function baseYaw(style) {
  return !style.trackHeading && style.direction < 0 ? Math.PI : 0;
}

const NOISE_SIZE = 256;

function makeNoiseTable(random) {
  return Array.from({ length: NOISE_SIZE }, () => random() * 2 - 1);
}

/**
 * 1D value noise. Smoothstep between lattice points keeps it C1, which the
 * path needs -- the trail is sampled from it and a kink would show as a
 * corner in the etched line.
 */
function sampleNoise(table, x) {
  const index = Math.floor(x);
  const frac = x - index;
  const smooth = frac * frac * (3 - 2 * frac);
  const a = table[((index % NOISE_SIZE) + NOISE_SIZE) % NOISE_SIZE];
  const b = table[(((index + 1) % NOISE_SIZE) + NOISE_SIZE) % NOISE_SIZE];

  return a + (b - a) * smooth;
}

/** Three octaves at a non-integer ratio, so they never line up into a beat. */
function fbm(table, x) {
  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;

  for (let octave = 0; octave < 3; octave += 1) {
    sum += amplitude * sampleNoise(table, x * frequency + octave * 37.7);
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.13;
  }

  return sum / total;
}

/**
 * Phase wander lives here rather than in getFlightPosition so the attitude
 * follows it too -- pitch and roll are driven off this phase, and if the
 * swoops breathe while the attitude keeps a fixed beat they come apart.
 */
function getGlidePhase(progress, profile, style = planeStyle) {
  const base = progress * Math.PI * 2 * profile.oscillations + profile.phaseOffset;

  if (!style.phaseWander) {
    return base;
  }

  return (
    base +
    style.phaseWander * fbm(profile.noise, progress * style.noiseScale * 0.7)
  );
}

export function getFlightPosition(progress, viewport, profile, style = planeStyle) {
  const margin = Math.max(150, viewport.width * 0.11);
  const span = viewport.width + margin * 2;
  const glidePhase = getGlidePhase(progress, profile, style);
  const easedProgress =
    progress +
    profile.speedPulse * Math.sin(glidePhase) * Math.sin(progress * Math.PI);
  // sin(t + k sin t) leans the wave onto one side: the dive gets steep and the
  // climb gets long, which is the shape that stops it reading as a sine.
  const swoop = Math.sin(
    glidePhase + style.swoopSkew * Math.sin(glidePhase),
  );
  const swell = style.swoopVariation
    ? 1 +
      style.swoopVariation *
        fbm(profile.noise, progress * style.noiseScale * 0.6 + 41.1)
    : 1;
  const verticalWave =
    swoop * swell +
    profile.secondHarmonic *
      Math.sin(glidePhase * 2 + profile.harmonicPhase) +
    0.12 * Math.sin(glidePhase * 0.48 + profile.driftPhase) +
    (style.irregularity
      ? style.irregularity *
        fbm(profile.noise, progress * style.noiseScale * 1.7 + 11.3)
      : 0);

  return {
    x:
      style.direction < 0
        ? viewport.width + margin - easedProgress * span
        : -margin + easedProgress * span,
    y:
      viewport.height * 0.56 -
      progress * viewport.height * profile.verticalTrend +
      verticalWave * Math.min(52, viewport.height * profile.verticalAmplitude),
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
 * Orthographic camera at a given elevation and azimuth. Kept free of any baked
 * in heading so the nose can be aligned to the path separately -- freezing a
 * heading into the projection is what decorrelated attitude from velocity in
 * an earlier version.
 */
function makeCamera(elevation, azimuth) {
  const sinE = Math.sin(elevation);
  const cosE = Math.cos(elevation);
  const sinA = Math.sin(azimuth);
  const cosA = Math.cos(azimuth);

  return {
    project: ([x, y, z]) => [
      cosA * x - sinA * y,
      -sinE * sinA * x - sinE * cosA * y - cosE * z,
    ],
    // The nose does not land on screen-horizontal under an arbitrary camera,
    // so its resting angle is taken back out when aligning to the path.
    noseAngle: Math.atan2(-sinE * sinA, cosA),
  };
}

function stepProgress(progress, elapsed, flightDuration, fps) {
  if (!fps) {
    return progress;
  }

  const steppedSeconds = Math.floor((elapsed / 1_000) * fps) / fps;
  return Math.min(1, steppedSeconds / (flightDuration / 1_000));
}

export function getPlaneRotation(options) {
  const { progress, elapsed, profile, flightDuration, style = planeStyle } =
    options;
  const stepped = stepProgress(
    progress,
    elapsed,
    flightDuration,
    style.rotationFps,
  );
  const depthProgress = style.stepEverything ? stepped : progress;
  const glidePhase = getGlidePhase(stepped, profile, style);
  const bankPosition = stepped * profile.oscillations;
  const bankSegment = Math.floor(bankPosition);
  const bankProgress = bankPosition - bankSegment;
  const bankDirection =
    (bankSegment % 2 === 0 ? 1 : -1) * profile.firstBankDirection;
  const bankEnvelope = Math.sin(bankProgress * Math.PI);

  return {
    roll:
      bankDirection * profile.bankAmplitude * bankEnvelope +
      0.04 * Math.sin(glidePhase * 0.53 + profile.driftPhase),
    pitch: -0.035 + profile.pitchAmplitude * Math.cos(glidePhase + 0.15),
    yaw:
      style.yawOffset +
      baseYaw(style) +
      bankDirection * profile.yawAmplitude * bankEnvelope +
      0.02 * Math.sin(glidePhase * 0.47 + profile.driftPhase),
    depthScale:
      0.84 +
      profile.depthAmount * Math.sin(depthProgress * Math.PI) +
      0.03 *
        Math.sin(depthProgress * Math.PI * 2 + profile.driftPhase) *
        Math.sin(depthProgress * Math.PI),
  };
}

/** Screen-space direction of travel, sampled off the path itself. */
export function getHeading(progress, viewport, profile, style = planeStyle) {
  const step = 0.004;
  const from = getFlightPosition(
    Math.max(0, progress - step),
    viewport,
    profile,
    style,
  );
  const to = getFlightPosition(
    Math.min(1, progress + step),
    viewport,
    profile,
    style,
  );

  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function drawPlane(context, options) {
  const {
    x,
    y,
    progress,
    elapsed,
    profile,
    viewport,
    flightDuration,
    style = planeStyle,
    lineWidth = 1.35,
  } = options;
  const rotation = getPlaneRotation({
    progress,
    elapsed,
    profile,
    flightDuration,
    style,
  });
  const camera = makeCamera(style.elevation, style.azimuth);
  const size =
    Math.max(
      style.sizeMin,
      Math.min(style.sizeMax, viewport.width / style.sizeDivisor),
    ) * rotation.depthScale;

  let heading = 0;

  if (style.trackHeading) {
    const headingProgress = style.stepEverything
      ? stepProgress(progress, elapsed, flightDuration, style.rotationFps)
      : progress;
    heading = getHeading(headingProgress, viewport, profile, style);
  }

  const angle = heading - (style.trackHeading ? camera.noseAngle : 0);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const points = planeModel.vertices.map((vertex) => {
    const [ax, ay] = camera.project(
      rotateVertex(vertex, rotation.roll, rotation.pitch, rotation.yaw),
    );
    const localX = ax * size;
    const localY = ay * size;

    return {
      x: x + localX * cos - localY * sin,
      y: y + localX * sin + localY * cos,
    };
  });

  context.save();
  context.beginPath();

  for (const [start, end] of planeModel.edges) {
    context.moveTo(points[start].x, points[start].y);
    context.lineTo(points[end].x, points[end].y);
  }

  context.lineWidth = lineWidth;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = "rgba(23, 20, 15, 0.9)";
  context.stroke();
  context.restore();
}
