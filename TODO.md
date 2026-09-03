# TODO

## Mobile / portrait

The room is composed for landscape. In portrait the corner hits the
`width * 0.3` clamp in `scene.js` and the door ends up nearly filling the right
wall — geometrically correct, compositionally cramped.

Two directions, undecided:

1. **Adapt the room.** Shrink the door (shorter relative to viewport height, not
   just uniformly scaled), raise the horizon, move the door further from the
   corner. Cheapest, keeps one scene.
2. **A different portrait composition entirely.** Possibly built around other
   visuals rather than the room — the landscape scene may simply not be the
   right idea on a phone.

Tabled for now. Whichever way it goes, `scene.js` already isolates the decision:
`buildScene()` owns the corner position and scale, and the door placement
follows from `DOOR_PLACEMENT`.

## About page

- [x] The visual entrance exists: clicking **about** opens the door, reveals the
      robot, and walks him to centre frame. Loading `#about` starts it directly;
      reduced motion jumps to the arrived pose.
- [x] Needs actual content — bio, contact. Landed. Contact is the email on the
      sheet rather than its own nav item; if other work gets hosted it goes
      under "selected work".
- [x] Decide how the robot presents that content. He walks nearly into the lens
      and holds up a sheet; the copy is real DOM text mapped onto the sheet's
      projected corners, so it stays selectable and accessible. Studied in
      `experiments/tools/paper-sequence.html`. See "The paper" in `ROBOT.md`.
- [x] Wire the paper into `about.js`. Done, by extracting the shared half into
      `paper.js` so the study and the site cannot drift. `REACH_LIMITS` is not
      bypassed so much as unused: `planPaper` aims down the camera axis and
      centres on the perpendicular, which is the thing `reach` could not
      express, so the cap never applies to this walk.
- [x] Decide where the sheet comes from. He picks it up off something below the
      frame: it is born lying flat, which puts it genuinely off-screen, and
      opens as it rises. Lowering the arms alone never hides it — the top edge
      bottoms out 314px inside the frame — so the tilt is what does the work,
      at both ends. See "Laying it down, not cutting it" in `ROBOT.md`.
- [x] Decide how he leaves. He puts the sheet back down, then walks past the
      camera and off the left edge. He cannot walk *into* the lens — he is
      shorter than the camera, so head-on he engulfs the frame instead of
      leaving it. See "Walking back out" in `ROBOT.md`.
- [x] Wire the close into `about.js` along with the paper.
- [x] Make `#about` a real route: linkable, and Back closes it.
- [x] Hold off new paper planes while the sheet is up, letting any plane already
      in the air finish.
- [ ] Check the copy actually fits the sheet. `TYPE` in `about.js` is a guess
      sized to the current bio by arithmetic, not by looking; `?type=` retunes.
- [ ] Idea, parked: something animating on the sheet itself — the paper is a
      surface we control completely, so there is room for a bit of whimsy on it.
- [x] Revisit repeat/skip behavior. No skip: a **speed up** link appears on the
      second open and after, and only during the entrance. It scales the clock
      rather than the cadence, so the gait stays honest.
- [ ] Portrait fallback for the sheet. At 390px wide the type sets at ~9px.
      Probably folds into the portrait decision above.


## Known and accepted

- [ ] The arms draw behind the torso where they cross in front of it. They pass
      *through* the torso rather than being sunk into it, so no back-to-front
      order is correct — 83% of the contested pixels want the torso in front and
      17% want the arm. Fixing it means splitting the arm at the elbow or moving
      the shoulder out to the surface; both change how he looks. Minor, left
      alone deliberately. See "The arms pass through the torso" in `ROBOT.md`.

## Before/around publishing

- [ ] Favicon — none yet.
- [ ] Debounce `resizeCanvas()`. It calls `buildTrailDots()`, which walks 1,400
      path samples, and it runs on every resize event — dragging a window edge
      rebuilds it hundreds of times.
- [ ] Reduced-motion path (`drawReducedMotionFrame` in `flight.js`) survived the
      trail refactor by inspection but has not been rendered and checked.

## Deploy

- [x] Version the asset URLs so a stale cached `index.html` can never pair with
      fresh assets. `node version.mjs` stamps `?v=N` onto the tags in
      `index.html` and onto every relative import between the modules — the
      entry points alone would not have been enough, since a versioned
      `about.js` still imports `./paper.js`. Run it before each deploy; the
      README has it in the publish steps.

## Art

- [x] **Notch in the floor seam at the door's near jamb.** The two anchor
      corners land on the floor line at 0.00px, so placement is correct; the
      threshold *between* them is not the straight line through them. Measured
      against the floor line at 1440x900:

      | point in `door.svg` | vs floor |
      | --- | --- |
      | outer bottom-left `(0.5, 529.489)` | 0.00px |
      | frame bottom `(21, 526.545)` | **-6.32px** |
      | frame bottom `(150.39, 556.977)` | -1.80px |
      | outer bottom-right `(150.5, 558.989)` | 0.00px |

      Cause: the left jamb's vertical extends ~8 art-units below where the
      bottom edge meets it, and `DOOR.anchors` is pinned to that overshoot.
      Their slope happens to match the floor almost exactly (0.19667 vs
      0.19754), which is why it measures perfectly and still looks wrong. The
      original PNG trace has no such rise, so it entered during the Figma
      trace. Fixed by redrawing the threshold between the placement anchors.

- [x] Two paths in `door.svg` were filled outlines rather than strokes (Figma's
      Outline Stroke), so the door's ink weight can't be retuned independently
      of its geometry. Everything landed at ~1px so it's self-consistent; only
      worth redoing if the weight needs to change. Redrawn as real strokes; the
      stray duplicate at `fill-opacity="0.2"` was removed at the same time.
- [ ] The plane's 3D model doesn't match the mockup's dart — wing sweep differs
      and the trailing edge sits further back in the drawing. Cosmetic.
- [ ] Not built from the mockup: the books by the door, the `01 / 02 / 03 / 04`
      counter.

## Ideas

- [ ] More variety in how the plane crosses the canvas (different entry heights,
      curves, occasional steeper banks). Worth revisiting now that the trail
      marks are line segments — long marks read very differently on a tight
      curve than on a straight glide.
