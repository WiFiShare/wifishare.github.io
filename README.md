# wifishare.github.io

The WiFiShare website, served by GitHub Pages at
<https://wifishare.github.io>.

WiFiShare is an open platform for sharing Wi-Fi access: people and venues share
free or open Wi-Fi so others can find and join it. The project started in
September 2026. **No data is being collected, no app has been released and the
API is not live.** The site says so on every page, and it must keep saying so
until that changes.

## What this repository is

Hand-written static files. There is no build step, no framework, no package
manager and no Jekyll: GitHub Pages serves the repository exactly as it is, and
`.nojekyll` keeps it that way.

```
.nojekyll              tells GitHub Pages to serve the files untouched
index.html             what WiFiShare is, the three privacy rules, status
how-it-works.html      the pipeline, what is never collected, why 150 m
map.html               the map (the only page that needs JavaScript)
apps.html              Android and iOS, and what iOS cannot do
venues.html            for cafés, libraries and councils
developers.html        API, dump format, licences, running your own
privacy.html           privacy policy, marked draft
optout.html            how to keep a network out; the form is disabled
contribute.html        which repository needs what, and the code of conduct
404.html               served by GitHub Pages for unknown paths
config.js              the map's data source and tile settings
assets/css/site.css    the only stylesheet
assets/js/geohash.js   geohash encode, decode and cell maths
assets/js/map.js       the map page
sample/                invented data so the map has something to draw
LICENSE                MIT, for the code
```

Every page shares the same header, footer and styling, written into each file.
There is no templating step, so a change to the header is a change to ten files.
That is the cost of having no build, and it was judged the cheaper cost.

## Previewing locally

```sh
git clone https://github.com/WiFiShare/wifishare.github.io.git
cd wifishare.github.io
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Nothing to install, nothing to compile.

Opening the files straight from disk with `file://` will not work for the map:
browsers refuse ES modules and `fetch` from that scheme. Everything else on the
site works fine that way.

`python3 -m http.server` does not serve `404.html` for a missing path. To check
that page, open <http://localhost:8000/404.html> directly.

## Editing

- **Content.** Edit the HTML. Keep the header, the footer and the nav in step
  across all ten pages, including `aria-current="page"` on the current page.
- **Styling.** One file, `assets/css/site.css`, with the palette as custom
  properties at the top and a dark variant under `prefers-color-scheme`. Change
  a colour in one place, not ten.
- **Facts.** Every factual claim on the site has to match the
  [spec](https://github.com/WiFiShare/spec) repository, which is normative, and
  the [data](https://github.com/WiFiShare/data) repository's README. If the site
  and the spec disagree, the spec is right and the site is a bug.

### Constraints worth keeping

These are deliberate, and a change that breaks one should be argued for rather
than slipped in:

- **No build step, no framework, no npm.** What is in the repository is what is
  served.
- **Works without JavaScript**, everywhere except the map. The map explains
  itself in a `<noscript>` block and links to the raw data file.
- **One third-party runtime dependency**, the map library, on `map.html` alone.
  Background map tiles are the only other third-party request, also only there.
- **System fonts.** No web fonts.
- **No cookies, no analytics, no third-party embeds, nothing that phones home.**
  The site stores nothing in the browser.
- **Mobile first**, down to 360 px, dark mode via `prefers-color-scheme`,
  semantic HTML, a skip link, visible focus styles, and contrast at WCAG AA.

## The map and its data source

`map.html` reads area files in the layout of the published dump:

```
<DATA_BASE_URL>/index.json
<DATA_BASE_URL>/areas/<gh2>/<gh3>/<gh5>.geojson
```

`DATA_BASE_URL` is set in [`config.js`](config.js), which is commented. It is
`null` by default, and the map then falls back to `sample/` in this repository
and shows a banner saying the data is a sample. That fallback exists because
there is no real data yet.

`sample/areas/sr/srb/srbj4.geojson` holds five invented networks in the geohash-5
cell over the centre of Bologna, four community-found and one owner-verified, so
both cases can be seen. Every name starts with `SAMPLE`. The file validates
against `schemas/area.schema.json` in the spec repository; `sample/README.md` has
the command.

Point the map at real data by setting `DATA_BASE_URL` to a base URL that serves
that layout and allows cross-origin requests.

One caveat: the spec fixes the area file format but not the shape of the values
inside `index.json`'s `areas` object, so `assets/js/map.js` reads only its keys.

## Map tiles: an open decision

**The tile provider is not settled.** It is a dependency on somebody else's
infrastructure and somebody else's terms, and it deserves a decision rather than
a default. It is configured in one place, `TILES` in `config.js`, so it can be
changed without touching the map code.

What the site uses today: [OpenFreeMap](https://openfreemap.org/), keyless
vector tiles with the `liberty` style, rendered by MapLibre GL JS 5.6.0 from
cdnjs.

What was verified on 18 September 2026, by request rather than by reading a
marketing page:

| Checked | Result |
| --- | --- |
| `curl -sI https://tiles.openfreemap.org/styles/liberty` | `200`, `application/json`, `access-control-allow-origin: *`, cached a day |
| `curl -sI https://tiles.openfreemap.org/planet/.../14/8577/5860.pbf` | `200`, `application/vnd.mapbox-vector-tile`, `access-control-allow-origin: *` |
| Style contents | Sprites and glyphs are served from the same host; the vector source is a TileJSON at `tiles.openfreemap.org/planet` |
| `curl -sI https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/0-255.pbf` | `200`, so the label font the map asks for exists |
| `curl -sI https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/5.6.0/maplibre-gl.js` and `.css` | `200` |
| `curl -sI https://tile.openstreetmap.org/13/4288/2930.png` | `200`, kept as the fallback option below |

No API key is needed for any of it. Attribution is shown under the map and in
the map's own attribution control:

> OpenFreeMap · © OpenMapTiles · Data from OpenStreetMap

Things to weigh before this becomes a decision:

- OpenFreeMap is run by one person and asks for no key, no sign-up and no
  attribution beyond OpenStreetMap's own. Understand what it promises about
  availability before depending on it for a site that people are told to rely
  on.
- The alternative already verified is OpenStreetMap's own raster tiles with
  Leaflet, which is a much smaller library and no WebGL requirement, but the
  [OSMF tile usage
  policy](https://operations.osmfoundation.org/policies/tiles/) rules out heavy
  use and asks for a real user agent. Keeping usage trivial would be a
  condition, not a hope.
- Self-hosting tiles removes the third-party request entirely, and costs
  bandwidth and a build pipeline.

Whatever is decided, the requirement does not change: OpenStreetMap data has to
be attributed, and the map page has to keep working when the tile server does
not answer. It currently says so in the status line rather than showing a blank
square.

## Licence split

- **Code** in this repository — the HTML structure, `assets/css/site.css`,
  `assets/js/*.js`, `config.js` — is [MIT](LICENSE).
- **Text** on the site — the prose in the pages — is
  [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/). Quote it, translate
  it, build on it, with credit.
- **The published data**, once there is any, is
  [ODbL-1.0](https://opendatacommons.org/licenses/odbl/1-0/) and lives in the
  [data](https://github.com/WiFiShare/data) repository, not here.

The invented file under `sample/` describes nothing real and is covered by the
MIT licence with the rest of the repository.

There is no contributor licence agreement and no DCO sign-off. By opening a pull
request you agree your contribution is licensed this way.

## Contributing

Issues and pull requests for the site go on this repository. Anything about what
the site *says* — a claim that overstates what exists, a rule described wrongly —
is worth an issue even if you do not want to write the fix. See
[contribute.html](contribute.html) and the organisation's
[CONTRIBUTING.md](https://github.com/WiFiShare/.github/blob/main/CONTRIBUTING.md).

Do not report a security problem in a public issue: use GitHub private
vulnerability reporting, as the
[security policy](https://github.com/WiFiShare/.github/blob/main/SECURITY.md)
describes.
