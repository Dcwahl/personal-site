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
- [ ] Needs actual content — bio, contact. Contact lives here rather than as its
      own nav item; if other work gets hosted it goes under "selected work". The
      copy in the paper study is placeholder.
- [x] Decide how the robot presents that content. He walks nearly into the lens
      and holds up a sheet; the copy is real DOM text mapped onto the sheet's
      projected corners, so it stays selectable and accessible. Studied in
      `experiments/tools/paper-sequence.html`. See "The paper" in `ROBOT.md`.
- [ ] Wire the paper into `about.js`. Nothing of the study has landed on the
      live page yet, and `REACH_LIMITS.max` in `walk.js` has to be overturned or
      bypassed to let him come that close.
- [ ] Decide where the sheet comes from. He arrives empty-handed and it appears
      in his hands; it is too big to be born below the frame at any distance
      that keeps it readable, and folding was rejected.
- [ ] Portrait fallback for the sheet. At 390px wide the type sets at ~9px.
      Probably folds into the portrait decision above.
- [ ] Revisit repeat/skip behavior once content exists. A second click currently
      resets the sequence, but a returning visitor should not have to wait
      through the full entrance (~10s) to reach the bio.

## Before/around publishing

- [ ] Favicon — none yet.
- [ ] Debounce `resizeCanvas()`. It calls `buildTrailDots()`, which walks 1,400
      path samples, and it runs on every resize event — dragging a window edge
      rebuilds it hundreds of times.
- [ ] Reduced-motion path (`drawReducedMotionFrame` in `flight.js`) survived the
      trail refactor by inspection but has not been rendered and checked.

## Deploy

- [ ] Version the asset URLs (`styles.css?v=N`, `room.js?v=N`, ...) so a stale
      cached `index.html` can never pair with fresh assets, or vice versa. Wisp
      sends `max-age=600`, so for ten minutes after each deploy a returning
      visitor can get new HTML with old CSS, which renders as a completely
      unstyled page. Bumping N per deploy makes the failure consistent-but-old
      instead of mixed-and-broken.

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
