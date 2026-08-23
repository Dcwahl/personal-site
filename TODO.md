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

- [ ] It does not exist. `href="#about"` in the masthead targets nothing, so the
      site's only link is currently dead.
- [ ] Needs actual content — bio, contact. Contact lives here rather than as its
      own nav item; if other work gets hosted it goes under "selected work".
- [ ] Wants its own visual gimmick, to sit alongside the room without repeating
      it. Undecided. The room's paper-plane-crossing-a-space idea sets the tone:
      quiet, hand-drawn, one moving element.

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

- [ ] **Notch in the floor seam at the door's near jamb.** The two anchor
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
      trace. Fix in the art: make the threshold one straight segment between
      the two outer corners, deleting the kink vertex at x=21.

- [ ] Two paths in `door.svg` are filled outlines rather than strokes (Figma's
      Outline Stroke), so the door's ink weight can't be retuned independently
      of its geometry. Everything landed at ~1px so it's self-consistent; only
      worth redoing if the weight needs to change. There is also a stray
      duplicate path at `fill-opacity="0.2"`.
- [ ] The plane's 3D model doesn't match the mockup's dart — wing sweep differs
      and the trailing edge sits further back in the drawing. Cosmetic.
- [ ] Not built from the mockup: the books by the door, the `01 / 02 / 03 / 04`
      counter.

## Ideas

- [ ] More variety in how the plane crosses the canvas (different entry heights,
      curves, occasional steeper banks). Worth revisiting now that the trail
      marks are line segments — long marks read very differently on a tight
      curve than on a straight glide.
