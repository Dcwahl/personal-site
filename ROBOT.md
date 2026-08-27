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
- Route: reactive reach, **yes**. Reactive cadence, undecided — wants a ceiling
  and a look at worst cases first.
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

## Open

### Reactive routing

Reach depends only on aspect (see above). Centring costs time on wider screens:
5.0s at aspect 1.25 up to 6.9s at 1.78+. Holding a flat 5.0s needs cadence
3.2→4.4 steps/s. **Wants a cadence ceiling and a look at worst cases.**
Also: at aspect ≥ 2.0 reach saturates at 1.0 and still cannot reach centre — the
route's far end would need extending for ultrawide.

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
