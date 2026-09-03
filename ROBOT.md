# Wind-up robot

State of the "click about → robot walks out of the door" interaction.

The interaction itself ships — it is wired into `index.html`. These notes, the
studies under `experiments/` and the source art do not; see `.wispignore`.

Built on branch **`robot`**, merged to `main`.

## Where it stands

Integrated into the site, end to end: click **about**, the door opens onto an
empty doorway, the robot walks into view from behind the far jamb and continues
on an arc across the floor, raises his arms once clear of the doorway, closes
the door behind him, and arrives facing the camera on a feet-together, upright
beat. The route and cadence size themselves to the viewport.

The paper landed too. Clicking **about** now runs the whole thing on the live
page: he comes almost into the lens, picks a sheet up from below the frame and
holds it out with the real bio on it, waits, and walks off past the camera when
dismissed. `#about` is a real route, so it is linkable and Back closes it.

The study and the site share `paper.js` rather than a copy of it, so they cannot
drift; `experiments/tools/paper-sequence.html` is still where any of it gets
felt.

Not built: the shuffle gait, and portrait.

| File | Role |
| --- | --- |
| `camera.js` | The room's 3D camera, recovered from the existing art |
| `robot.js` | Parametric robot, gait, and the line renderer |
| `walk.js` | Choreography: the route from behind the door through the turn |
| `door.js` | Projects the swinging door panel through the room camera |
| `paper.js` | The near-lens walk, the sheet, and the DOM homography |
| `about.js` | Site choreography and modal state, end to end |
| `experiments/tools/robot-tuner.html` | Live control of every parameter |
| `experiments/tools/paper-sequence.html` | The paper study: the full sequence, end to end |
| `experiments/tools/paper-probe.html` | The paper study: one static pose, on sliders |

Serve with `python3 -m http.server 4173` and open
<http://127.0.0.1:4173/experiments/tools/robot-tuner.html>.
Press **walk**. Press **h** to collapse the panel. `?preset=…&play=1` also works.

`paper-sequence.html` plays on load; click or press space to replay. `?t=3.5`
renders one deterministic frame (`?t=99` is the final one), and `?near=`,
`?cadence=`, `?stepAngle=`, `?height=`, `?sheetH=`, `?grip=`, `?armRaise=` and
`?crease=` are the knobs. Its HUD reports the step count, the walk duration, the
sheet's width, whether the sheet could be hidden below the frame, the DOM box's
scale factor, and how far off centre the final composition lands.

On the site, `?door=40` holds the door at a chosen angle, `?about=0.4` holds the
robot four tenths of the way along the walk, `?read=1` is the finished frame with
the sheet up, `?entry=0` holds the actual start behind the far jamb, `?entry=0.35`
its first readable peek, and `?entry=0&xray=1` the otherwise occluded starting
pose. `?cadence=`, `?hurry=` and `?type=` retune the pace, the speed-up
multiplier and the size of the copy. Inspection hooks for screenshots, not
public controls.

## Site integration

This was built in the uncommitted integration pass after the gait and route
were settled.

- `door.svg` is now the fixed frame only. Its Figma outlined strokes were
  redrawn as real SVG strokes, the duplicate translucent path was removed, and
  the threshold was straightened between the two placement anchors.
- `door.js` reconstructs the panel as a rectangle in room space and projects it
  through `camera.js`. The fitted top corners agree with the original ink to
  within 0.53 art units. The panel rests at 13.05°, opens to 85°, and disappears
  behind the wall once it reaches the solved edge-on angle.
- `room.js` owns the door angle and swing. It draws the opening, clips the panel
  to it, responds to reduced motion, and emits `room:layout` after resize so the
  robot can stay registered to the same scene.
- The page has separate robot and plane canvases. `flight.js` clears its canvas
  every frame, so sharing one would erase the robot; their order also keeps the
  plane in front when their paths cross.
- `about.js` is deliberately choreography only. It opens the door onto an empty
  doorway, holds a short beat, starts the gait behind the wall, clips the entry
  to the real aperture, raises the arms after he clears the frame, closes the
  door 20% into the visible room walk, and catches the final lean back to
  upright in 0.2 seconds.
- Clicking **about** starts the sequence and clicking again resets it. Loading
  `#about` starts it directly. Reduced motion skips to the arrived pose with the
  door open.

The entry is a straight 3.4-step segment behind the wall, joined tangent to the
existing curve at the threshold. While he is behind the threshold the robot is
clipped to the opening minus the visible panel, so only the portion that could
really be seen through the aperture is drawn. Because that segment participates
in the same arc-length route, the gait does not restart or change speed at the
jamb.

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
- Settle: **quantise the route to whole steps**, then quickly scale the rendered
  rock to zero after the final footfall.
- Route: **reactive reach and reactive cadence**, both clamped. Reach 0.3-1.25
  (a cap on size, not position), cadence 2.6-4.4 steps/s, duration floats
  2.3-5.9s. See "Fitting the viewport".
- Resize mid-walk: **freeze the route** once walking; replan freely before.
- Door: **project a real swinging rectangle**, not a 2D squash. It is fitted to
  the old panel art and clipped to the opening once it passes behind the wall.
- Doorway clearance: **arms down, then raise them once clear**. This turns the
  width problem into a readable choreography beat.
- Start/stop lean: **scale the rendered rock**, without rebuilding the memoised
  gait table every frame. This keeps both stationary poses upright.
- Presenting: **walk him nearly into the lens** rather than enlarging him in
  place, so the sheet is readable and the crop is the gag. See "The paper".
- Variants are **presets, never replacements**. New shape parameters default to
  0 so they reproduce the plain box, and nothing has to be deleted to explore.
  `armReach` is the newest: `armSwing` is a *counter*-swing (the right arm gets
  its negation, because that is what walking does), so it can never bring both
  hands together in front. Reaching is a separate motion and needs its own term,
  added to both shoulders with the same sign. At 0 the arms are exactly where
  they were, verified pixel-for-pixel on the live `?about=1` frame.

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

This supplies the positional stop. The final footfall lands on the beat rather
than simply running out of animation; `about.js` then scales only the rendered
rock to zero with a 0.2-second ease-out. The underlying full-rock pose remains
the route source, so the memoised `gaitTable` is never rebuilt during the catch.

`START_PHASE` is 0.25 for the same reason: legs together, so the robot is
standing behind the wall before it moves. `routePose` measures distance from
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

## The paper

How he presents the about copy. Explored in `paper-sequence.html`; **not
integrated**. The shape of it is settled, two things are not.

The original idea was that he holds up a sheet. The obstacle was readability:
at the arrival distance the walk had been tuned for, he is about 350px tall and
anything he could hold gives roughly **8px type**. No amount of layout fixes
that.

- **Walk him almost into the lens.** At 2.34 door-heights from the camera the
  sheet projects **593 x 474px** and the copy sets at **20px**. His feet land at
  y 1234 in a 900px viewport, so he is cropped at the chest and it is mostly
  head — which is the joke, and it comes free with the fix.

- **Distance and screen position are two degrees of freedom; `reach` is one.**
  Pushing `reach` up to enlarge him also slides him sideways past the camera's
  own z, and `planRoute` then bisects it back to centre, undoing the size. The
  study aims down the camera's view axis instead and centres by bisecting on
  the perpendicular. `REACH_LIMITS.max = 1.25` is a composition cap justified by
  "he arrives taller than the door" — a rule about a robot standing *in* the
  room, and void for one who comes up to the glass. It will have to be
  overturned or bypassed when this lands.

- **Centre the composition, not the body.** Same trap as "Arrival, settled", hit
  again: measuring at `START_PHASE` measures a pose at full rock, and the drawn
  final frame has the rock scaled to zero. Centring the arms-up, sheet-in-hand,
  rock-free pose — with a second pass once the step count fixes the finishing
  phase — takes the composition from 94px off to **0px** (body 9, sheet -4,
  because the sheet overhangs his arms).

- **The copy is real DOM text, not canvas.** The sheet is a quad in the robot's
  own geometry, stroked by `drawRobot` like any other part. A `<div>` of HTML
  sits above the canvas, and each frame a four-point homography (DLT, then
  Gaussian elimination) maps its rectangle onto the sheet's projected corners
  and is handed to CSS as `matrix3d`. So the bio stays selectable, searchable
  and accessible while sitting in the room's perspective.

- **The sheet is rigid, and so is its box.** Both had to be made so, and both
  had gone wrong the same way — something was being re-derived per frame that
  should have been fixed once:

  1. The sheet's width came from the live hand positions. `armRaise` swings the
     arms in the y-z plane, so the hands are furthest apart around 90 degrees
     and closer at the 140 he finishes on; the paper stretched to 800px
     mid-lift and shrank back to 593. Paper is rigid. The half-span is now
     frozen at plan time from the finishing pose — and measured at
     `rockAngle: 0`, because a body rolled 20 degrees turns y into z and the
     hands stop being symmetric about the spine.
  2. The `<div>`'s CSS width was set from the current quad's aspect ratio. Even
     with a rigid sheet the top edge foreshortens as he tilts it up, so the box
     was re-laid-out and the copy re-wrapped every frame. It is now sized once
     and only transformed.

  Horizontal scale across the lift went from `1.82x` at a wildly varying box
  width to `1.04, 1.02, 1.00`.

- **Size the box in real screen pixels.** A layer under a 3D transform
  rasterises at its own size and is then scaled as a bitmap, so a 260px box
  blown up 1.82x rendered the type as a grey smear. The box is now the resting
  sheet's true pixel size (593 x 474 at 1440x900, 519 x 427 at 1200x800) and
  the resting scale is exactly **1.00x**. The copy is authored in `em` off a
  root size set from JS, so it tracks the viewport the way the sheet does.

- **No fade.** "The words shouldn't just appear on the sheet" was solved by
  deleting the transition: the copy is on the paper from the moment the paper
  exists, and rides up into frame from below with it.

- **Creases were built and rejected.** Fold lines on the sheet answered where it
  came from, but bought that with a fold to explain and a fold to animate, and
  at any alpha that read at 20px type they struck through the lines. Off by
  default; `?crease=0.13` still draws them. The per-marking `alpha` in
  `drawRobot` was added for this and is now unused.

### Settled since

- **Where the sheet comes from: below the camera, and that is the whole
  answer.** It was treated as a problem to be measured away — the sheet's top
  edge sits 393px inside the frame when carried, so it provably cannot be born
  off-screen at any distance that keeps the type readable, and folding was
  rejected. The measurements are right and the conclusion did not follow: the
  frame crops him at the chest, so *everything* below his hands is off-screen
  as far as the viewer is concerned. He reaches down out of frame and comes up
  with it. Nobody asks where it came from, because they watched him get it.

  This retires the `born` latch in `paper-sequence.html`, which was there to
  refuse to draw a sheet that appeared inside the picture. (It never worked
  anyway: it tests a bare `top`, which resolves to `window.top`, so the
  comparison is `NaN` and the latch never opens. Nothing reads the flag.)

- **Duration: `stepAngle` 34.** Re-run against all three gait checks, against
  27.5 as the control. Identical on every one — deepest vertex exactly 0, same
  worst advance delta, skate distributions within noise of each other — at a
  29% longer stride (0.275 vs 0.214 room units). The caveat in "Numbers that
  were solved, not chosen" was about not having *checked* 34, not about a
  reason to expect it to fail, and it passes.

### Walking back out

The close: he puts the sheet back down where it came from, leans into the gait
again, and leaves past the camera.

**It waits rather than counts.** The study used to run the whole thing off one
clock, which made the read beat a duration to tune. It is not one — it is a
modal, and a modal is open until someone closes it. Everything up to the read
pose is still timed; from there `beats()` returns `end: Infinity` and the loop
holds the pose. The dismissal is recorded as a *time* on the same clock, not as
a flag, because everything downstream of it is a timeline again — so `frameAt`
stays a pure function of `t` plus one number, and `?t=` frames stay
reproducible.

Three states, two edges: **closed**, and clicking *about* opens it; **open**,
running the entrance and then holding; **closing**, from the dismissal through
the walk off and back to closed.

A dismissal only counts once he is actually holding the sheet up. The first
version accepted one at any time and clamped it forward to the read pose, on
the theory that a click should never be swallowed. That is worse than
swallowing it: you click during the walk, nothing happens, you forget, and then
the instant he gets the sheet up it slams shut in your face. A modal that has
not finished opening has nothing to close — the click has no meaning yet, and
deferring it only defers the surprise.

Dismissed by clicking away, by the ×, or by Escape. The sheet itself is
excluded from click-away: it is selectable text — the entire reason the copy is
DOM and not canvas — and a modal that closes when you try to select its
contents is broken. Click-anywhere-to-replay is gone; space replays.

`?play=0` starts closed, which is the state the real page loads in. `?read=N`
dismisses him automatically N seconds in, which is the only way to get a
determinate timeline back for `?t=` frames.

### Laying it down, not cutting it

The first version lowered his arms and stopped drawing the sheet. It read as
wrong, and the reason is measurable: **lowering the arms cannot put the sheet
away.** Swept from `armRaise` 140 down to -70, the top edge bottoms out 314px
*inside* the frame and never gets lower, because dropping his hands moves the
paper down and toward the lens at once and the two nearly cancel. So it was
disappearing at very close to full size — cut, not put down.

| `armRaise` | top edge, vs frame bottom |
| --- | --- |
| 140 (held up) | −715 |
| 60 | −449 |
| 0 | −316 |
| −12 (carried) | −314 |
| −70 | −505 |

Tilting it flat is what actually does it, and it is also what the gesture *is*:
paper you put down goes flat. Rotating toward horizontal foreshortens the sheet
to a sliver and swings its top edge away from the lens. At `LAY` = −75° the
whole thing clears the bottom of the frame everywhere tested — 60px to spare on
the tightest (844x390), 124–167px on the rest — so the moment it stops being
drawn there is nothing on screen to notice.

The same tilt runs on the way up, on the same progress as the arms: it is born
flat and below the frame rather than appearing at full size 314px inside it.
That, not the earlier reasoning about the crop, is what actually answers where
the sheet comes from — he picks it up off something below, and paper picked up
off a surface really does rotate as it rises.

The DOM copy is hidden once the quad is under 12px tall or has left the frame,
where the homography is near-singular and the type would be a smear of its own
scaling.

### The × and the speed-up

The × lives **on the paper**, inside the transformed box, so it tilts and rides
with the sheet under the same homography as the copy. Square to the screen it
would have been a second, unrelated piece of modal chrome. Sized in `em` off
the sheet's own font size, so it tracks the viewport the way the type does.

A **speed up** link appears on the second open and after, and only while he is
still on his way in. It scales the *clock*, not the cadence: `frameAt` is a pure
function of elapsed seconds, so handing it seconds faster speeds him up without
touching the gait — cadence is welded to the stride, and changing it would put
his feet back to skating. Rate changes bank the virtual time spent so far and
restart the measurement, so both formulas agree at the instant of the change and
nothing jumps. `?hurry=2.2` sets the multiplier.

The reasoning for offering it only on a repeat visit: a first-time viewer is
watching the thing the page is for. A returning one has seen it and is here for
the copy. No skip button, though — he is worth watching once.

**He cannot leave by walking into the lens.** This looks like it should work
and it never can. The camera stands at one door-height and he is 0.4 of one, so
he is entirely below the horizon — and everything below the horizon projects
*toward* the horizon as it approaches. Walking straight at the camera his crown
goes y 446, 441, 435, converging on the horizon line and never crossing it. His
feet leave the bottom of the frame a step and a half in, and then his head just
sits in the middle of the picture getting wider until the geometry detonates on
the camera plane, which `camera.js` has no near plane to catch:

| distance walked past the arrival | box x | box y |
| --- | --- | --- |
| 0.0 | 612–853 | 446–799 |
| 1.2 | 570–884 | 445–906 |
| 2.8 | 449–973 | 442–1222 |
| 4.4 | −188–1433 | 428–2966 |
| 5.2 | −306309–20167 | −250138–397882 |

So he leaves the way anyone walks past you: off to one side. Swept, the turn has
to be at least 10° to clear the frame at all, and 30° is comfortable:

| turn | off frame after | closest approach to camera |
| --- | --- | --- |
| 0–5° | never — reaches the lens first | — |
| 10° | 15.9 steps | 0.85 |
| 20° | 12.6 steps | 1.88 |
| **30°** | **10.9 steps** | **2.58** |
| 40° | 9.4 steps | 3.07 |

`exitRoute` builds it as an arc, not a pivot, for the reason `aimedHandle`
gives — a clockwork walker turns by walking. Its first handle runs along the
arrival heading, so the exit leaves tangent to the walk that fed it.

`planExit` **scans forward rather than bisecting**, and that is not a style
choice. Off-screen is not monotone in distance: he leaves the frame, and then,
on a long enough arc, passes behind the camera, where the projection inverts and
every predicate about pixels goes meaningless. A bisection reads that far side
as "not gone" and walks its bracket into it — which is exactly what the first
version did, returning a distance with the nearest vertex 0.23 in front of the
lens and the robot still filling the screen. It takes the *first* arc length at
which he is off frame with every vertex still 0.5 in front, and widens the arc
only if that never happens.

| viewport | steps out | at 4/s | nearest vertex to the lens |
| --- | --- | --- | --- |
| iPhone portrait 390x844 | 9 | 2.25s | 4.50 |
| iPad portrait 820x1180 | 10 | 2.50s | 4.56 |
| iPhone landscape 844x390 | 11 | 2.75s | 1.67 |
| 1200x800 | 12 | 3.00s | 2.49 |
| laptop 1440x900 | 12 | 3.00s | 2.27 |
| 1080p 1920x1080 | 12 | 3.00s | 2.06 |
| ultrawide 2560x1080 | 11 | 2.75s | 1.48 |
| superwide 3840x1080 | 12 | 3.00s | 0.87 |

### Still open

- **Portrait.** At 390px wide the sheet caps at about 85% of the viewport and
  the type at 9.1px. Landscape carries the copy on the paper; portrait needs
  either a flatten-to-panel fallback or the separate composition already tabled
  in `TODO.md`.

## On the live page

- **`paper.js` is the shared middle.** It owns the destination solve, the sheet's
  geometry and the homography. Both the study and `about.js` call `planPaper`,
  so tuning one tunes the other. Extracted rather than copied precisely because
  a copy would have drifted the first time either changed.

- **`#about` is the state.** `hashchange` is the only thing that opens or closes
  it. Opening lets the anchor navigate normally, which pushes a history entry,
  so Back pops it and closes. Dismissing *replaces* that entry rather than
  pushing a clean one — pushing would leave `#about` in the history and Back
  would reopen what you just closed.

- **The arms still come down through the doorway.** The study never addressed
  this because it was studying the paper; the live page had already solved it,
  and at 42° he is 1.041 wide against a 0.940 opening. So the beat survives: arms
  down through the aperture, up once clear, down again to pick up the sheet.

- **No new paper planes while the sheet is up.** There is no discrete spawn to
  suppress — the flight is a continuous cycle read off one clock, and a plane
  "starts" by the cycle counter ticking over. So `flight.js` withholds the
  *clock*: it pins elapsed time one millisecond short of the next cycle
  boundary, which is deep in the tail where the last trail has already faded and
  the frame draws empty. A plane already in the air is untouched, because the
  pin cannot bite until that flight is over. When the hold lifts the clock steps
  over the boundary on the next frame and a plane enters straight away, rather
  than the page owing the viewer a cycle of empty sky.

- **`planExit` escalates the turn.** 30° clears the frame from the far side of
  the room but not from the near arrival, where he fills most of the picture: at
  2560x1080, 3840x1080 and 844x390 a shallow turn keeps him crossing the frame
  long enough to reach the lens first. It now tries 30, 40, 50, 65 and takes the
  gentlest that works — 30° on most, 40° on wide, 50° on superwide.

- **`planExit` quantises internally.** Rounding the exit up to whole steps
  *outside* it quietly walked him past the point that had been checked, up to a
  step nearer the lens than the margin allows. The rounding belongs where the
  rounded landing can be verified too.

| viewport | steps in | steps out | turn | nearest vertex to the lens |
| --- | --- | --- | --- | --- |
| iPhone portrait 390x844 | 26 | 6 | 30° | 0.73 |
| iPad portrait 820x1180 | 26 | 6 | 30° | 0.72 |
| iPhone landscape 844x390 | 28 | 6 | 50° | 0.69 |
| 1200x800 | 27 | 6 | 40° | 0.67 |
| laptop 1440x900 | 27 | 7 | 40° | 0.51 |
| 1080p 1920x1080 | 27 | 7 | 40° | 0.57 |
| ultrawide 2560x1080 | 28 | 7 | 40° | 0.54 |
| superwide 3840x1080 | 30 | 7 | 50° | 0.52 |

- **The type size is a function of how much copy there is.** The box is fixed
  and the text is centred in it, so anything too long spills off the paper
  rather than scrolling. `TYPE` in `about.js` is set for the current bio;
  `?type=` retunes it. Worth re-checking whenever the words change.

## Open

### The arms pass through the torso

Known, and deliberately not fixed — it is minor next to what it would cost.

The legs had the same *symptom* and a different cause. Limbs are sunk into the
torso so the joints show no seam, which means they interpenetrate, which means
`separates` finds no plane and the pair falls through to one depth scalar per
solid. The torso is a big box and owns the nearest corner even when the leg is
in front of it, so the near leg drew behind the body. Fixed by using the plane
that comes *closest* to separating them, which still knows which side of the
body the limb is on — gated on the violation being under 25% of the limb's
thickness, since sunk joints miss separation by 3-22% while genuinely tangled
boxes (the key's four, against each other and the arm) miss by 31-103%. The
leg/torso pair went from 4 of 13 poses right to 9 of 13, and 3 of 9 to 6 of 9.

The arm is not a sunk joint. It passes *through* the torso, 6% of body height
deep, with the shoulder end genuinely behind and the hand end genuinely in
front. Ray-casting the contested pixels: the torso is nearer in 83% of them and
the arm in the other 17%, and those 17% are the crossing that looks wrong. **No
back-to-front ordering can be right there** — that is the failure mode a
painter's algorithm has by definition, not a bug in this one. The fixes are rig
changes, not sort changes:

1. **Split the arm at the elbow.** The forearm then sits entirely outside the
   torso and sorts correctly on its own. Costs a seam line at the elbow.
2. **Move the shoulder out** to the torso's surface so the arm abuts instead of
   passing through. No new geometry, but the arms sit wider and a gap may open
   at some swing angles.

### How this was verified

Worth recording, because none of it involved looking at the drawing.

- **Which pairs fall through.** The sort's pairwise test, reimplemented in a
  Node probe, reporting every overlapping pair with no separating plane.
- **What the right answer is.** A hand-rolled depth test: take the intersection
  of two solids' screen boxes, cast a ray through each sample point, intersect
  it with every front-facing quad of both, and compare the nearest hit. This
  answers "which is in front *here*" with no ordering assumption, and it is what
  showed that the arm is genuinely both.
- **What the shipped code actually does.** `drawRobot` driven with a stub canvas
  context that records `moveTo` calls; each face begins with exactly one, so
  mapping first vertices back to solids recovers the real draw order. This is
  the only one of the three that tests the shipped path rather than a copy.

### The shuffle gait

Asked for alongside the stride ("would it be too greedy to ask for both?").
Never started — the stride is the one that got built. It is **not** half-done,
and it is **not** a preset away, which is the useful thing to know:

**Every bit of forward motion in the rig comes from the leg swing.** At
`stepAngle` 0 the gait table's `perCycle` is exactly 0 no matter how hard it
rocks. `roll` is a `hingeX` — side to side — and there is no yaw anywhere in
`gait()`. A real waddle advances by *pivoting about the planted foot*, which is
yaw, so the motion a shuffle is made of does not exist here yet.

Small-step-plus-heavy-rock is reachable today, but it cannot cross the room.
Step length falls off fast, and the step count is what pays for it:

| stepAngle | step (room units) | steps to cross | at the 4.4 ceiling | for a 5s crossing |
| --- | --- | --- | --- | --- |
| 27.5 (the stride) | 0.210 | 17 | 3.9s | 3.4 steps/s |
| 20 | 0.145 | 25 | 5.7s | 5.0 steps/s |
| 14 | 0.094 | 39 | 8.9s | 7.8 steps/s |
| 10 | 0.065 | 56 | 12.7s | 11.2 steps/s |
| 8 | 0.051 | 71 | 16.1s | 14.2 steps/s |

So the options are:

1. **Add yaw about the stance foot.** The honest waddle, and the advance then
   comes from the turn rather than the swing, so it can be tuned to any speed.
   Real work: the anti-skate integration in `gaitTable` currently measures
   `-d(contact.x)`, and a yawing contact needs the same treatment in two axes
   plus a heading contribution feeding back into the route.
2. **Drop it.** The arc arrival removed the turn-in-place, which was the other
   place a shuffle would have earned its keep.

Worth noting the second option got stronger since the shuffle was first asked
for — there is no longer a turn beat that needs a different gait.

### Smaller things

- The chest panel competes with the screen face; BMO has a d-pad and buttons
  there.
- The key overlaps the torso silhouette at near-side angles.
- The current second click resets the sequence, `#about` starts it on load, and
  reduced motion jumps to the end state. Revisit those semantics with the real
  content in place: even 5s is a long gate on a second visit, and changing the
  URL hash on click may be desirable.
- `favicon.ico` 404s in the tuner. Pre-existing, already in `TODO.md`.
