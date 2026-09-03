# Personal site

Static personal-site experiments hosted locally during development and intended
for publication through [Wisp.place](https://wisp.place/).

## Run locally

From the repository root:

```sh
python3 -m http.server 4173
```

Then open <http://localhost:4173/>.

The room scene lives at the repository root and *is* the site:

| File | Role |
| --- | --- |
| `index.html` | Page shell |
| `styles.css` | Styling |
| `scene.js` | Room perspective model, door placement, floor-seam geometry |
| `room.js` | Applies the scene to the DOM on load and resize |
| `door.js` | The door's swinging panel, and the opening behind it |
| `camera.js` | The room's 3D camera, recovered from the door art |
| `robot.js` | The robot's body, gait, and line renderer |
| `walk.js` | The route out of the doorway, sized to the viewport |
| `about.js` | The about sequence: door, reveal, walk |
| `flight.js` | Paper-plane motion and camera |
| `trail.js` | The etched trail the plane leaves behind |
| `door.svg` | The door artwork |

Stop the server with `Ctrl-C` in the terminal where it is running.

### Development tools

Not part of the site, and excluded from publication:

- <http://localhost:4173/experiments/tools/trail-tuner.html> — sliders for the
  trail's mark length, width, spacing, and opacity. It imports the same
  `trail.js` the site uses, so what you tune is what you get. Paste the values
  it prints into `trailStyle` in `trail.js`.
- `experiments/tools/perspective-scaffold.svg` — the room's horizon, vanishing
  point, floor seams, and the two points the door's base corners must land on.
  Drop it into Figma as a locked layer to draw new room artwork against.
- `experiments/tools/imgprobe/` — pure-Python PNG measuring, plus the headless
  Chrome screenshot recipe. Every constant in `scene.js` was measured out of
  `redesign-mockup.png` with it; needed again for new art. See its README.
- The robot's own tools — `robot-tuner.html` for the body and gait,
  `paper-sequence.html` for the about sequence end to end — are documented in
  `ROBOT.md`, along with every number in `robot.js` and `walk.js` that was
  solved rather than chosen.

### Where the numbers came from

`scene.js` and `flight.js` are built on constants measured from
`redesign-mockup.png` (1586x992) rather than chosen by eye, and both files
document their own derivations inline. The two load-bearing ideas:

- **The door is the source of truth for the room's perspective.** It is
  hand-drawn art whose perspective cannot be re-derived, so the floor seams are
  drawn *to* its corners rather than the door being fitted to the seams. A
  two-point similarity solve places it; the seam endpoints are then read back
  out of the placed door, so they cannot disagree with it. Verified at 0.00px
  gap across every viewport tested.
- **The right-wall floor slope is a fixed constant** (0.19754) and is never
  recomputed. A raster or vector door has its perspective baked in, so if the
  floor slope moved the door would stop agreeing with the room. Viewport
  variation is absorbed by the corner's horizontal position and overall scale
  instead; the empty left wall stretches to take up the slack.

Earlier studies are kept in `experiments/paper-plane/` and
`experiments/room-flight/`. They are superseded by the root scene and are not
published.

## Publish to Wisp

The Wisp account is `huffsduster.bsky.social`. The public address is
<https://dcwahl.wisp.place/>, served by the Wisp site named **`dcwahl`**.

The account holds two sites; use the first one:

| Site | Domain |
| --- | --- |
| `dcwahl` | `dcwahl.wisp.place` (verified) — this site |
| `space_game` | `dcw.wisp.place` (verified) |

To re-check at any time:

```sh
npx wispctl@latest list sites huffsduster.bsky.social
npx wispctl@latest list domains huffsduster.bsky.social
```

The CLI opens a browser for OAuth authentication. Do not put a Bluesky app
password in this repository.

### Requires Node 22+

`wispctl` imports `node:sqlite`, which does not exist before Node 22. Under an
older Node it fails immediately with `Error: No such built-in module:
node:sqlite`. If the default `node` is older, put a new enough one on `PATH`
first:

```sh
export PATH="$HOME/.nvm/versions/node/v22.19.0/bin:$PATH"
```

### Publish an update

Two commands, from the repository root. Bump the asset version first, and
commit it:

```sh
node version.mjs
npx wispctl@latest deploy huffsduster.bsky.social --path . --site dcwahl
```

`version.mjs` stamps `?v=N` onto every URL the site loads — the tags in
`index.html` and every relative import between the modules — so a deploy can
never pair a stale `index.html` with fresh assets. See "The 10-minute cache
window" below for what that failure looks like without it. `node version.mjs 7`
sets a version explicitly and `node version.mjs --check` prints the current one;
running it twice is the same as running it once.

The `--site dcwahl` is what makes this update the existing site rather than
creating another one.

**`deploy` does not ask before uploading.** Older notes here said it prompts
with the file list; `wispctl` 1.3.2 does not — it prints the count and the URLs
only once the upload is already done. There is no chance to abort, so the check
has to happen afterwards. Expect **13 files**:

```text
index.html  styles.css  scene.js   room.js    door.js   camera.js
robot.js    walk.js     paper.js   about.js   flight.js trail.js
door.svg
```

If `deploy` reports any other count, something outside that list was published.
Find it and confirm from the origin rather than guessing — anything excluded
should 404:

```sh
for f in README.md TODO.md ROBOT.md version.mjs .gitignore test.png; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' \
    "https://dcwahl.wisp.place/$f?cb=$RANDOM")  $f"
done
```

Then add the offender to `.wispignore` and deploy again; the new manifest
replaces the old one, so the stray file stops being served.

Without a custom domain, Wisp serves the site at a URL shaped like:

```text
https://sites.wisp.place/huffsduster.bsky.social/personal-site
```

### Connect `dcwahl.wisp.place`

These are one-time commands. First claim the Wisp subdomain, then attach the
site to it:

Already done — `list sites` reports `dcwahl.wisp.place [wisp] verified`
against the `dcwahl` site, so no domain commands are needed. Kept for
reference only:

```sh
npx wispctl@latest domain claim-subdomain huffsduster.bsky.social \
  --subdomain dcwahl

npx wispctl@latest domain add-site huffsduster.bsky.social \
  --domain dcwahl.wisp.place \
  --site dcwahl
```

### After deploying: the 10-minute cache window

Wisp serves assets with `cache-control: public, max-age=600`, so for ten
minutes after a deploy a browser that visited recently may hold stale copies.

The dangerous version of this — **new HTML paired with old CSS**, which renders
as an unstyled page (visible `<h1>`, blue link, serif type, wrong background)
and looks far worse than merely being out of date — is fixed. `version.mjs`
stamps `?v=N` onto every asset URL, so a stale `index.html` always asks for the
assets that match it, and a fresh one asks for URLs no cache has seen. This is
why the version bump is not optional.

What remains is ordinary staleness: `index.html` itself keeps the same path, so
a recent visitor may see the whole previous version of the site for up to ten
minutes. Hard-reload (`Cmd-Shift-R`) or use a private window. To check the
origin rather than your cache:

```sh
curl -s "https://dcwahl.wisp.place/index.html?cb=$RANDOM" | grep -o '?v=[0-9]*' | sort -u
```

That should print the version `node version.mjs --check` reports locally.

## Publish boundary

Wisp publishes the directory supplied through `--path`, which is the repository
root — the same directory the site's source files live in. `.wispignore` is
therefore the only thing separating published from unpublished, and it is
deny-listed rather than allow-listed: **a new file at the root is public by
default.**

Add source art, notes, and studies to `.wispignore` as they are created, not at
deploy time. Currently excluded: `README.md`, `TODO.md`, `ROBOT.md`,
`version.mjs`, `.claude/`, `.gitignore`, `.DS_Store`, `experiments/`, and every
source mockup and door trace.

Public Wisp sites are stored through the AT Protocol account and indexed from
the firehose. A custom `wisp.place` subdomain is a nicer address, but it should
not be treated as hiding the association with the Bluesky/AT Protocol account.

## References

- [Wisp CLI documentation](https://docs.wisp.place/cli/)
- [Wisp file filtering and `.wispignore`](https://docs.wisp.place/file-filtering)
