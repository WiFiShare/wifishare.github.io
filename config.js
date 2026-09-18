/*
 * WiFiShare website configuration.
 *
 * Edit this file to point the map at a different source of area files. It is
 * plain JavaScript and is loaded before the map module; there is no build step
 * and nothing to recompile.
 *
 * DATA_BASE_URL
 *   The base URL that area files are read from. The map appends the dump's own
 *   layout to it:
 *
 *       <DATA_BASE_URL>/index.json
 *       <DATA_BASE_URL>/areas/<gh2>/<gh3>/<gh5>.geojson
 *
 *   Leave it as null (the default) and the map falls back to the `sample/`
 *   directory in this repository, and shows a banner saying the data is a
 *   sample. That fallback exists because no real data has been published yet:
 *   the dump repository is empty and the API is not live.
 *
 *   Set it to a string to read real data once there is some, for example:
 *
 *       DATA_BASE_URL: "https://raw.githubusercontent.com/WiFiShare/data/main"
 *       DATA_BASE_URL: "https://api.wifishare.example/v1"   // once /v1/areas is live
 *       DATA_BASE_URL: "/data"                              // a local copy
 *
 *   A cross-origin source must send `Access-Control-Allow-Origin`, or the
 *   browser will refuse the request and the map will report the area as
 *   unavailable.
 *
 * IS_SAMPLE
 *   Normally left as null, which means "true when DATA_BASE_URL is null". Set
 *   it to true to keep the sample banner while pointing at a copy of the sample
 *   data somewhere else, or to false only when the source really is the
 *   published dump.
 *
 * MIN_ZOOM_FOR_AREAS
 *   Below this zoom the map does not fetch anything and asks the reader to zoom
 *   in. An area file covers about 4.9 km, so a world view would mean thousands
 *   of requests.
 *
 * TILES
 *   The background map. `style` is a MapLibre style URL; `attribution` is shown
 *   under the map and is not optional. The tile provider is still an open
 *   decision for this project: see README.md.
 */

window.WIFISHARE_CONFIG = {
  DATA_BASE_URL: null,
  SAMPLE_BASE_URL: "sample",
  IS_SAMPLE: null,
  MIN_ZOOM_FOR_AREAS: 11,
  START: { lat: 44.4938, lon: 11.3426, zoom: 14 },
  TILES: {
    style: "https://tiles.openfreemap.org/styles/liberty",
    attribution:
      '<a href="https://openfreemap.org/">OpenFreeMap</a> · ' +
      '<a href="https://www.openmaptiles.org/">&copy; OpenMapTiles</a> · ' +
      'Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }
};
