/*
 * The map page.
 *
 * Reads area files in the layout of the WiFiShare dump and draws them. The
 * source is set in /config.js; with no source configured it falls back to the
 * sample data in this repository.
 *
 * The map library is loaded from a CDN by map.html and is the only third-party
 * code on this site. If it fails to load, or WebGL is unavailable, this module
 * still fetches the data and renders the list of networks below the map.
 *
 * MIT licensed, like the rest of the code in this repository.
 */

import { areaPath, cellPolygon, cellsCovering, decodeCentre } from "./geohash.js";

const cfg = Object.assign(
  {
    DATA_BASE_URL: null,
    SAMPLE_BASE_URL: "sample",
    IS_SAMPLE: null,
    MIN_ZOOM_FOR_AREAS: 11,
    START: { lat: 44.4938, lon: 11.3426, zoom: 14 },
    TILES: {}
  },
  window.WIFISHARE_CONFIG || {}
);

const base = String(cfg.DATA_BASE_URL || cfg.SAMPLE_BASE_URL).replace(/\/+$/, "");
const isSample = cfg.IS_SAMPLE === null || cfg.IS_SAMPLE === undefined
  ? !cfg.DATA_BASE_URL
  : Boolean(cfg.IS_SAMPLE);

const els = {
  map: document.getElementById("map"),
  status: document.getElementById("map-status"),
  list: document.getElementById("network-list"),
  listHeading: document.getElementById("network-list-heading"),
  sampleBanner: document.getElementById("sample-banner"),
  source: document.getElementById("data-source")
};

/* Cells we have already asked about: cell -> "loading" | "empty" | "loaded" | "error" */
const seen = new Map();
/* Feature id -> feature, so a network is listed once however many times we load it. */
const networks = new Map();
let knownCells = null; /* Set of cells from index.json, or null if there is no index. */
let indexTried = false;
let map = null;
/* Things the reader needs to know that outlive one status update, such as the
   map library having failed to load. Appended to every status line. */
const standingNotes = [];

/* ---------- small helpers ---------- */

function say(text) {
  els.status.textContent = text;
}

function plural(n, one, many) {
  return n + " " + (n === 1 ? one : many || one + "s");
}

function text(tag, value, className) {
  const el = document.createElement(tag);
  el.textContent = value;
  if (className) el.className = className;
  return el;
}

function securityLabel(props) {
  if (props.security === "open") return "Open, no password";
  if (props.security === "owe") return "Open with encryption (OWE)";
  if (props.security === "shared") return "Password shared by the owner";
  return "Unknown";
}

function portalLabel(props) {
  if (props.captive_portal === "detected") return "A sign-in page was seen.";
  if (props.captive_portal === "none") return "No sign-in page was seen.";
  return "Unknown whether there is a sign-in page.";
}

function precisionLabel(props) {
  if (props.verification === "owner-verified") {
    return "Owner-verified. Exact position, about " + props.precision_m + " m.";
  }
  return (
    "Community-found. The point is the centre of cell " +
    props.cell +
    ", about " +
    props.precision_m +
    " m across. It is not the position of the access point."
  );
}

/* ---------- loading ---------- */

async function loadIndex() {
  if (indexTried) return;
  indexTried = true;
  try {
    const res = await fetch(base + "/index.json", { cache: "no-cache" });
    if (!res.ok) return;
    const doc = await res.json();
    if (doc && doc.areas && typeof doc.areas === "object") {
      /* Only the keys are read. The spec does not fix the shape of the values. */
      knownCells = new Set(Object.keys(doc.areas));
    }
  } catch (err) {
    /* No index is fine: we fall back to asking for each area file. */
  }
}

async function loadCell(cell) {
  if (seen.has(cell)) return false;
  if (knownCells && !knownCells.has(cell)) {
    seen.set(cell, "empty");
    return false;
  }
  seen.set(cell, "loading");
  try {
    const res = await fetch(base + "/" + areaPath(cell), { cache: "no-cache" });
    if (res.status === 404) {
      seen.set(cell, "empty");
      return false;
    }
    if (!res.ok) {
      seen.set(cell, "error");
      return false;
    }
    const doc = await res.json();
    const features = Array.isArray(doc.features) ? doc.features : [];
    let added = 0;
    for (const f of features) {
      const props = f && f.properties;
      if (!props || !props.id) continue;
      if (!networks.has(props.id)) {
        networks.set(props.id, f);
        added += 1;
      }
    }
    seen.set(cell, "loaded");
    return added > 0;
  } catch (err) {
    seen.set(cell, "error");
    return false;
  }
}

function countStates() {
  let empty = 0;
  let loaded = 0;
  let error = 0;
  for (const state of seen.values()) {
    if (state === "empty") empty += 1;
    else if (state === "loaded") loaded += 1;
    else if (state === "error") error += 1;
  }
  return { empty, loaded, error };
}

async function loadBounds(bounds, zoom) {
  if (zoom < cfg.MIN_ZOOM_FOR_AREAS) {
    say(
      "Zoom in to load areas. One area file covers about 4.9 km, so the map " +
        "asks for them only once the view is small enough."
    );
    return;
  }

  const cells = cellsCovering(bounds, 5, 64);
  if (!cells) {
    say("That view covers too many areas. Zoom in a little.");
    return;
  }

  await loadIndex();

  const fresh = cells.filter((c) => !seen.has(c));
  if (fresh.length > 0) say("Loading " + plural(fresh.length, "area file") + "…");

  await Promise.all(fresh.map(loadCell));

  render();
  report(cells);
}

function report(cells) {
  const states = countStates();
  const inView = cells.filter((c) => seen.get(c) === "loaded").length;
  const parts = [];

  if (networks.size === 0) {
    if (states.error > 0) {
      parts.push(
        "No networks loaded, and " +
          plural(states.error, "area file") +
          " could not be read. Check DATA_BASE_URL in config.js, and that the " +
          "source allows cross-origin requests."
      );
    } else {
      parts.push("No published networks in this area.");
    }
  } else {
    parts.push(
      plural(networks.size, "network") +
        " from " +
        plural(states.loaded, "area file") +
        (inView === 0 ? ", none of them in the current view" : "") +
        "."
    );
    if (states.empty > 0) {
      parts.push("Nothing is published in " + plural(states.empty, "nearby area") + ".");
    }
    if (states.error > 0) {
      parts.push(plural(states.error, "area file") + " could not be read.");
    }
  }

  if (isSample) parts.push("This is sample data. None of these networks exist.");
  say(parts.concat(standingNotes).join(" "));
}

/* ---------- rendering ---------- */

function geojson(filterFn, asPolygon) {
  const features = [];
  for (const f of networks.values()) {
    if (filterFn && !filterFn(f.properties)) continue;
    if (asPolygon) {
      features.push({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: cellPolygon(f.properties.cell) },
        properties: f.properties
      });
    } else {
      features.push(f);
    }
  }
  return { type: "FeatureCollection", features: features };
}

function renderList() {
  els.list.textContent = "";
  const sorted = Array.from(networks.values()).sort((a, b) =>
    String(a.properties.ssid).localeCompare(String(b.properties.ssid))
  );

  for (const f of sorted) {
    const p = f.properties;
    const li = document.createElement("li");

    const h = document.createElement("h3");
    h.appendChild(document.createTextNode(p.ssid + " "));
    h.appendChild(
      text("span", p.verification === "owner-verified" ? "owner-verified" : "community", "tag")
    );
    li.appendChild(h);

    li.appendChild(text("p", securityLabel(p) + " " + portalLabel(p)));
    li.appendChild(text("p", precisionLabel(p)));
    li.appendChild(
      text(
        "p",
        "Seen between " +
          p.first_seen +
          " and " +
          p.last_seen +
          ". " +
          plural(p.reports.works, "report says", "reports say") +
          " it works, " +
          plural(p.reports.fails, "says", "say") +
          " it does not."
      )
    );
    if (p.venue && p.venue.name) {
      li.appendChild(text("p", "Venue: " + p.venue.name + (p.venue.kind ? " (" + p.venue.kind + ")" : "")));
    }
    if (p.credential && p.credential.type) {
      const cred = p.credential.secret
        ? "Password published by the owner: " + p.credential.secret
        : "The owner listed the network without publishing a password.";
      li.appendChild(text("p", cred));
    }
    els.list.appendChild(li);
  }

  els.listHeading.textContent =
    sorted.length === 0
      ? "Networks loaded (none yet)"
      : "Networks loaded (" + sorted.length + ")";
}

function renderMap() {
  if (!map || !map.getSource("networks")) return;
  map.getSource("cells").setData(geojson((p) => p.verification !== "owner-verified", true));
  map.getSource("networks").setData(geojson(null, false));
}

function render() {
  renderList();
  renderMap();
}

/* ---------- popup ---------- */

function popupNode(props) {
  const div = document.createElement("div");
  div.appendChild(text("strong", props.ssid));
  div.appendChild(document.createElement("br"));
  div.appendChild(document.createTextNode(securityLabel(props)));
  div.appendChild(document.createElement("br"));
  div.appendChild(document.createTextNode(precisionLabel(props)));
  div.appendChild(document.createElement("br"));
  div.appendChild(
    document.createTextNode("Seen " + props.first_seen + " to " + props.last_seen + ".")
  );
  if (props.venue && props.venue.name) {
    div.appendChild(document.createElement("br"));
    div.appendChild(document.createTextNode("Venue: " + props.venue.name));
  }
  return div;
}

/* ---------- start ---------- */

function startMap() {
  const maplibregl = window.maplibregl;
  if (!maplibregl) {
    els.map.hidden = true;
    standingNotes.push(
      "The map library did not load, so there is no map. The list below is " +
        "built from the same data."
    );
    return false;
  }

  try {
    map = new maplibregl.Map({
      container: "map",
      style: cfg.TILES.style,
      center: [cfg.START.lon, cfg.START.lat],
      zoom: cfg.START.zoom,
      hash: true,
      attributionControl: false
    });
  } catch (err) {
    els.map.hidden = true;
    standingNotes.push(
      "The map could not start in this browser. The list below is built from " +
        "the same data."
    );
    return false;
  }

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }));
  map.addControl(
    new maplibregl.AttributionControl({ compact: true, customAttribution: cfg.TILES.attribution })
  );
  map.keyboard.enable();

  map.on("load", () => {
    map.addSource("cells", { type: "geojson", data: geojson(null, true) });
    map.addSource("networks", { type: "geojson", data: geojson(null, false) });

    map.addLayer({
      id: "cell-fill",
      type: "fill",
      source: "cells",
      paint: { "fill-color": "#1f6feb", "fill-opacity": 0.15 }
    });
    map.addLayer({
      id: "cell-outline",
      type: "line",
      source: "cells",
      paint: { "line-color": "#1f6feb", "line-width": 1.5, "line-dasharray": [2, 1.5] }
    });
    map.addLayer({
      id: "network-point",
      type: "circle",
      source: "networks",
      paint: {
        "circle-radius": ["case", ["==", ["get", "verification"], "owner-verified"], 8, 5],
        "circle-color": [
          "case",
          ["==", ["get", "verification"], "owner-verified"],
          "#8a3a00",
          "#1f4fa8"
        ],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2
      }
    });
    map.addLayer({
      id: "network-label",
      type: "symbol",
      source: "networks",
      layout: {
        "text-field": ["get", "ssid"],
        "text-size": 12,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-font": ["Noto Sans Regular"],
        "text-allow-overlap": false
      },
      paint: {
        "text-color": "#14181d",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.5
      }
    });

    map.on("click", "network-point", (e) => {
      const f = e.features && e.features[0];
      if (!f) return;
      const props = Object.assign({}, f.properties);
      /* MapLibre serialises nested properties to JSON strings. */
      for (const key of ["venue", "credential", "reports"]) {
        if (typeof props[key] === "string") {
          try {
            props[key] = JSON.parse(props[key]);
          } catch (err) {
            delete props[key];
          }
        }
      }
      new maplibregl.Popup({ closeButton: true })
        .setLngLat(f.geometry.coordinates.slice())
        .setDOMContent(popupNode(props))
        .addTo(map);
    });

    map.on("mouseenter", "network-point", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "network-point", () => {
      map.getCanvas().style.cursor = "";
    });

    refreshFromMap();
  });

  map.on("moveend", refreshFromMap);
  map.on("error", (e) => {
    if (e && e.error && /style|tile/i.test(String(e.error.message || ""))) {
      say("The background map could not be loaded. The networks below are unaffected.");
    }
  });

  return true;
}

function refreshFromMap() {
  const b = map.getBounds();
  loadBounds(
    { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() },
    map.getZoom()
  );
}

/*
 * No map: load the area around the configured starting point and list it, so
 * the page still says something true instead of sitting blank.
 */
async function startWithoutMap() {
  const start = cfg.START || decodeCentre("srbj4");
  const around = {
    south: start.lat - 0.02,
    west: start.lon - 0.03,
    north: start.lat + 0.02,
    east: start.lon + 0.03
  };

  await loadIndex();
  let cells = cellsCovering(around, 5, 16) || [];
  if (knownCells) {
    /* With an index, prefer the areas that exist; cap it, because a full dump
       has thousands and this path has no viewport to narrow them down. */
    const listed = Array.from(knownCells);
    cells = listed.length <= 16 ? listed : cells;
  }

  await Promise.all(cells.map(loadCell));
  render();
  report(cells);
}

function init() {
  if (!els.map || !els.status || !els.list) return;

  if (!isSample && els.sampleBanner) els.sampleBanner.remove();
  if (els.source) els.source.textContent = base + "/";

  say("Starting…");
  const ok = startMap();
  if (!ok) startWithoutMap();
}

init();
