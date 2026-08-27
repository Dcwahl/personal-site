# Wind-up robot

State of the "click about → robot walks out of the door" interaction. Not
published; see `.wispignore`.

Branch **`robot`**. `main` is untouched.

## Where it stands

Working: the robot, its gait, and its walk from the doorway to centre frame,
all driveable from `experiments/tools/robot-tuner.html`.

Not built yet: the settle, the turn-to-camera *style*, reactive routing, the
door opening, the paper it presents, and any integration with the actual page.

| File | Role |
| --- | --- |
| `camera.js` | The room's 3D camera, recovered from the existing art |
| `robot.js` | Parametric robot, gait, and the line renderer |
| `walk.js` | Choreography: the route out of the door and the turn |
| `experiments/tools/robot-tuner.html` | Live control of every parameter |

Serve with `python3 -m http.server 4173` and open
<http://127.0.0.1:4173/experiments/tools/robot-tuner.html>.
Press **walk**. Press **h** to collapse the panel. `?preset=…&play=1` also works.

## Numbers that were solved, not chosen

Re-deriving these is the expensive part. Each was cross-checked against
something independent, and each check is reproducible from the files.

- **The room's camera.** The door's horizontal edges and the right wall's floor
  seam share a vanishing point at (122.17, 495.61). That fixes the horizon, puts
  the principal point at the image centre (495.61 against 496), and gives
  f = 1965.8px. Both door jambs then satisfy height × depth-divisor = 393.041,
  identical, which pins the last free ratio: the door is 2.059 camera-heights.
  Reprojecting the door's frame corners lands within **0.13px** of where
  `scene.js` places the hand-drawn art.

- **Step length is 0.200, not 0.120.** The naive `2 · legLength · sin(stepAngle)`
  is wrong by 66%, because a stiff foot with no ankle rolls heel to toe and that
  rolling carries the body further than a point-contact pendulum would.

- **`rockLead` = 0.115.** The lean must anticipate the step. At 0 the rock is
  zero exactly at the weight transfer, so the still-planted trailing foot gets
  rolled backwards — an 11% backslide twice a cycle. Sweeping it, the value that
  removes the backslide is the same value that maximises step length.

- **Screen centre is at mockup x = 1586 − 496·aspect.** Viewport *height*
  cancels out entirely, so the reach needed to land the robot centre-screen
  depends only on aspect ratio, not window size. Holds for aspect 0.716–2.786;
  outside that the clamp in `scene.js` pins the corner and the rule breaks.

## Verification

These are the checks that caught real bugs. Worth re-running after touching the
gait.

- **Nothing through the floor.** Sample `buildRobot` across a cycle; the deepest
  vertex must be exactly 0. Body height is *solved* (drop until the lower foot
  rests on the floor) rather than computed from the compass-gait formula, which
  put the toe 0.024 under.
- **Advance is monotonic.** `gaitTable(p).table` must never decrease.
- **The planted foot does not skate.** For each phase, the most stationary
  touching vertex must move at ≈0% of body speed. Currently: median **0.22%**,
  80% of the cycle under 1%. Spikes at the flat-foot instant (a stiff foot
  really does slap heel to toe) and at the transfer.
- **It fits through the door.** Doorway is 0.940 wide. Body alone is 0.761.
  With `armRaise` at 42° it is 1.041 — **11% too wide**.

## Decisions

- Body: **`bmo`** — neckless, screen face, `headHeight` 0.25 / `headWidth` 0.34 /
  `headDepth` 0.23. Chamfer and dome were tried and rejected (dome read as a
  birdcage, because every tessellation edge gets stroked).
- Gait: `stepAngle` **27.5**, `rockAngle` **20**, `legLength` **0.13**.
  20° of rock is deliberately too much head-on and right at the walk angle.
- Duration: **`D mild`** — cadence 3.2, height 0.4, legLength 0.17, ~5.2s.
  25s was honest physics; a small toy really does need 30 steps to cross a room.
- Arrival: **arc to camera**, not a turn on the spot. `doorRoute`'s last handle
  is aimed at the camera, so the path's own tangent delivers the heading.
- Settle: **quantise the route to whole steps**. No amplitude decay was built.
- Route: **reactive reach and reactive cadence**, both clamped. Reach 0.3-1.25
  (a cap on size, not position), cadence 2.6-4.4 steps/s, duration floats
  2.3-5.9s. See "Fitting the viewport".
- Resize mid-walk: **freeze the route** once walking; replan freely before.
- Variants are **presets, never replacements**. New shape parameters default to
  0 so they reproduce the plain box, and nothing has to be deleted to explore.

## Arrival, settled

Both were answered together, because they turn out to be the same problem.

### The arc

A cubic's tangent at its end is `to - control2`, so aiming that last handle at
the camera makes the path deliver the turn. `doorRoute(reach, { arrive })` does
this; `arrive: "wall"` keeps the original square-to-the-room arrival and the
pivot afterwards, so the two can be compared rather than one replacing the other.

Both handles scale with `reach`. That is what keeps the curve's *shape* fixed as
the route shortens. A handle that stays long on a short route makes the path
swing away from the camera first and come back (an S); one that stays short puts
the whole turn in the last two steps as a hook. Scaled at `1.8 * reach`, over
reach 0.3–1.15:

- end heading lands on the camera to within **0.06°**
- the turn is **monotone** — zero direction reversals at any reach
- it peaks at **~6°/step** for reach ≥ 0.6 (14.6°/step at reach 0.3, which is
  60° of turn crammed into six steps — inherently tight, and an extreme)
- the path never dips back toward the corner: min x is exactly the threshold

`faceCamera` was a hard-coded 15°. That is only correct at reach 1 — the true
heading to camera swings to ~30° on a short route — so it is derived from the
arrival point now. That was a latent bug in the pivot-on-the-spot path too.

### Whole steps

The gait is mirror-symmetric, so a half cycle covers **exactly** the same ground
whichever foot leads: 0.21424 local units measured from any starting phase, not
approximately. `quantiseReach` bisects on `reach` until the route is a whole
multiple of that (route length is monotone in reach). Verified to land on
8.00000 / 11.00000 / 15.00000 / 17.00000 / 21.00000 steps, with the finishing
phase always on x.25 or x.75 and `legAngle` exactly 0 — feet together.

The destination moves by at most half a step to get there, a few pixels.

This is the whole settle. Nothing decays, so nothing has to be kept out of the
memoised `gaitTable`. The robot reads as having stopped rather than as having run
out of animation because its last footfall lands on the beat.

`START_PHASE` is 0.25 for the same reason: legs together, so the robot is
standing in the open doorway before it moves. `routePose` measures distance from
that phase rather than from zero, which is what makes both ends land clean.

### Resizing mid-walk

Room coordinates are absolute and the camera is fixed, so a resize re-projects
the robot and it stays glued to the floor for free. Only the *destination* is
aspect-dependent. Swapping the route underneath a walk in progress slides the
robot, by an amount that grows along the route:

| how far along | reach 0.72 → 0.60 | → 0.90 | → 0.71 |
| --- | --- | --- | --- |
| 10% | 0.01 steps, −1.2° | 0.01, +0.9° | 0.00, −0.3° |
| 50% | 0.61 steps, −11.4° | 0.48, +9.4° | 0.17, −3.3° |
| 75% | 1.47 steps, −12.8° | 1.36, +16.2° | 0.45, −4.4° |
| 95% | 2.27 steps, +0.7° | 2.16, +15.6° | 0.56, −1.5° |

Near the door it is invisible; near the end it is a visible pop of one to two
steps, and a shortening route can even land *behind* the robot, so it arrives
instantly. **Decision: freeze the route when the walk starts.** A resize during
the ~5s walk leaves it slightly off-centre, which is much cheaper than a pop, and
the room is sliding under a resize anyway. Rebuild freely before the walk begins.

If off-centre ever matters, the fix is to keep travelled distance and re-solve
phase against the new route's nearest point — no positional pop, only a gradual
heading correction — but it breaks quantisation and is not worth it for a case
this rare.

## Fitting the viewport

`planRoute(robot, scene, targetX)` returns `{ reach, route, steps, cadence,
seconds, offCentre }` — one call, everything the page needs.

**Reach is bisected, not solved from aspect ratio.** The closed form
(`mockup x at screen centre = 1586 - 496 * aspect`) is real and it is exact, but
it ignores `buildScene`'s clamp on the corner, which is what actually happens at
the extremes. Screen x falls monotonically as reach grows — 1312 mockup px at
reach 0.2 down to 384 at 1.2 — so a bisection is exact enough and stays honest.

**It aims the silhouette, not the floor.** The robot's local origin is not its
visual centre: it stands turned toward the camera, so its depth projects
asymmetrically and the ink lands 10 to 53 px left of the spot underfoot,
depending how far it walked. Aiming the destination point left it visibly left
of centre on wide screens. `silhouetteX` poses it at `START_PHASE` at the
arrival and takes the middle of its projected bounding box.

**Reach never saturates.** The earlier note that it caps out at 1.0 was an
artifact of the tuner slider's maximum, not the geometry. A 32:9 viewport wants
1.43 and gets there fine.

The cap that matters is **size, not position**. The route runs toward the
camera, so a longer one arrives *bigger* — unclamped, a 32:9 lands the robot
taller than the door it walked out of. `REACH_LIMITS.max` 1.25 holds it under
90%. Everything from a portrait phone through 21:9 still lands dead centre, so
the trade only ever bites on superwide.

Holding a flat duration everywhere needs cadence 1.4 to 6.2 — a slow amble at
one end, a scramble at the other, the same toy visibly changing speed with the
window. `CADENCE_LIMITS` 2.6–4.4 clamps it and lets duration float instead.
`seconds` is exactly `steps / cadence`: the route is a whole number of steps by
construction, and two steps make a cycle, so the cycles cancel.

| viewport | aspect | reach | steps | cadence | seconds | size vs door | off centre |
| --- | --- | --- | --- | --- | --- | --- | --- |
| iPhone portrait 390x844 | 0.46 | 0.40 | 8 | 2.6 | 3.1s | 55% | -13px |
| iPad portrait 820x1180 | 0.69 | 0.30 | 6 | 2.6 | 2.3s | 53% | +2px |
| iPad landscape 1180x820 | 1.44 | 0.78 | 16 | 3.2 | 5.0s | 67% | -13px |
| laptop 1440x900 | 1.60 | 0.83 | 17 | 3.4 | 5.0s | 69% | +17px |
| MacBook 16 1728x1117 | 1.55 | 0.83 | 17 | 3.4 | 5.0s | 69% | -9px |
| 1080p 1920x1080 | 1.78 | 0.92 | 19 | 3.8 | 5.0s | 73% | +9px |
| iPhone landscape 844x390 | 2.16 | 1.10 | 23 | 4.4 | 5.2s | 81% | -10px |
| ultrawide 2560x1080 | 2.37 | 1.14 | 24 | 4.4 | 5.5s | 84% | +14px |
| superwide 3840x1080 | 3.56 | 1.23 | 26 | 4.4 | 5.9s | 89% | +356px |

The residual off-centre is the whole-step snap and nothing else: half a step is
about 20px on screen at the destination, and every row lands inside that. Losing
20px of centring to gain a feet-together stop is the right way round.

## Open

### Smaller things

- **Arms are unresolved.** Parked deliberately. They currently hold static at
  `armRaise` 42°, which is also what makes it too wide for the door. Lowering
  them in the doorway and raising them once clear would fix the clearance and
  give a beat on the way out.
- The chest panel competes with the screen face; BMO has a d-pad and buttons
  there.
- The key overlaps the torso silhouette at near-side angles.
- The walk must be skippable, deep-linkable via `#about`, and respect
  `prefers-reduced-motion` — the site already does for the plane. Even 5s is a
  long gate on a second visit.
- `favicon.ico` 404s in the tuner. Pre-existing, already in `TODO.md`.
