# imgprobe

Pure-Python PNG decode/encode, no Pillow. Written because this machine has no
PIL and every geometric constant in `scene.js` was measured out of
`redesign-mockup.png` by scanning it for ink.

Keep it: re-deriving the room's perspective, or fitting anchors for new door
art, means measuring pixels again.

## Use

```python
from png import load, rgba_getter
w, h, ch, ct, plte, trns, px = load("some.png")
get = rgba_getter(w, h, ch, ct, plte, trns, px)
r, g, b, a = get(x, y)
```

Crop and magnify, for looking at a junction closely:

```sh
python3 crop.py in.png out.png X0 Y0 X1 Y1 ZOOM
```

Handles 8-bit non-interlaced PNGs in all five colour types.

## Measuring the rendered site

Screenshots come from headless Chrome; there is no browser-automation
extension connected here.

```sh
python3 -m http.server 4173 --bind 127.0.0.1 &

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1586,992 --virtual-time-budget=6000 \
  --screenshot=/tmp/shot.png --user-data-dir=/tmp/chrome-profile \
  "http://127.0.0.1:4173/"
```

`--virtual-time-budget` advances the clock, so different values sample
different points of the plane's flight. Use a throwaway `--user-data-dir`, and
a *fresh* one when checking the deployed site — otherwise you measure your own
cache rather than the origin.

1586x992 is the mockup's own size, so a screenshot at that size overlays
`redesign-mockup.png` one-to-one.
