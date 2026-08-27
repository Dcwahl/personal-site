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
- Route: reactive reach, **yes**. Reactive cadence, undecided — wants a ceiling
  and a look at worst cases first.
- Variants are **presets, never replacements**. New shape parameters default to
  0 so they reproduce the plain box, and nothing has to be deleted to explore.

## Open

### The settle

The gait runs at full amplitude forever, so after arriving it marches in place
facing camera at 20° rock — the one angle that is too much. Options:

1. **Amplitude decay** — ramp `stepAngle` and `rockAngle` to 0 over the last
   ~1.5 cycles. Steps shorten, rock fades, body comes upright.
   *Gotcha:* `gaitTable` is memoised on constant gait parameters, so a
   phase-varying `stepAngle` silently invalidates it. Either bake the decay into
   the table or keep the settle out of `distanceWalked` entirely.
2. **Quantise the route** so the walk ends exactly on a step boundary and the
   last step lands feet-together. Adjust `reach` slightly to make the route a
   whole number of steps. Cheap, and no decay machinery needed.
3. **Both** — quantise so it lands clean, plus a short rock decay. Probably right.

### The turn

Never designed. Options:

1. **Steps in place** — shuffle steps that rotate it. Most honest, reuses the
   gait, but shows the full rock head-on, which is the problem above.
2. **Pivot on one foot** — plant one, swing the other round. Quicker, fewer
   steps, still mechanical.
3. **Rigid rotation** — the whole robot turns as one piece, no stepping. Reads
   like a turntable, which is arguably very wind-up-toy.
4. **Arc into it** — curve the last stretch of the route so it *arrives* facing
   camera and never turns in place at all. Eliminates the beat rather than
   solving it; worth considering against the original brief, which wanted the
   turn as a distinct moment.

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
