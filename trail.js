/**
 * The etched trail the plane leaves behind.
 *
 * Marks are placed once at even spacing in ARC LENGTH along the whole path and
 * cached, rather than being re-derived per frame. An earlier version stroked a
 * dash pattern over a polyline that was re-sampled every frame, so the marks
 * crawled along the path as the sample count grew. Fixing them in space is what
 * makes the plane read as etching the line rather than dragging it.
 */

/** Tunable look of the trail. `length: 0` renders round dots. */
export const trailStyle = {
  spacing: 12, // distance between mark centres, px
  length: 7, // mark length along the path, px (0 = dot)
  width: 1, // mark thickness, px
  opacity: 0.68,
};

/**
 * @param getPosition maps progress 0..1 to a point on the path
 */
export function buildTrailDots(getPosition, steps = 1_400) {
  const dots = [];
  const { spacing } = trailStyle;
  let previous = getPosition(0);
  let sinceDot = 0;

  for (let index = 1; index <= steps; index += 1) {
    const point = getPosition(index / steps);
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const length = Math.hypot(dx, dy);
    let travelled = 0;

    while (length > 0 && sinceDot + (length - travelled) >= spacing) {
      travelled += spacing - sinceDot;
      const along = travelled / length;

      dots.push({
        x: previous.x + dx * along,
        y: previous.y + dy * along,
        // Tangent, so a mark with length can lie along the direction of travel.
        angle: Math.atan2(dy, dx),
        progress: (index - 1 + along) / steps,
      });
      sinceDot = 0;
    }

    sinceDot += length - travelled;
    previous = point;
  }

  return dots;
}

export function drawTrail(context, dots, options) {
  const { progress, ageOffset = 0, flightDuration, trailLifetime } = options;
  const { length, width, opacity } = trailStyle;
  const lead = progress - 0.022;
  const half = length / 2;

  context.save();
  context.strokeStyle = "rgb(23, 20, 15)";
  context.lineWidth = width;
  context.lineCap = "round";

  for (const dot of dots) {
    // Marks are ordered along the path, so everything past here is ahead of
    // the plane and not etched yet.
    if (dot.progress > lead) {
      break;
    }

    const age = (progress - dot.progress) * flightDuration + ageOffset;
    const life = 1 - age / trailLifetime;

    if (life > 0) {
      const dx = Math.cos(dot.angle) * half;
      const dy = Math.sin(dot.angle) * half;

      context.globalAlpha = Math.min(1, life) * opacity;
      context.beginPath();
      context.moveTo(dot.x - dx, dot.y - dy);
      context.lineTo(dot.x + dx, dot.y + dy);
      context.stroke();
    }
  }

  context.restore();
}
