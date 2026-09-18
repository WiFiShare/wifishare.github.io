/*
 * Geohash encoding and decoding, enough for the map page.
 *
 * WiFiShare uses geohash prefixes for two jobs: a 5-character prefix names one
 * downloadable area (about 4.9 km), and a 7-character prefix is the published
 * position of a community-found network (about 150 m). See
 * https://github.com/WiFiShare/spec/blob/main/docs/geohash.md
 *
 * MIT licensed, like the rest of the code in this repository.
 */

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
const BITS = [16, 8, 4, 2, 1];

/** Encode a coordinate as a geohash of `precision` characters. */
export function encode(lat, lon, precision) {
  const latRange = [-90, 90];
  const lonRange = [-180, 180];
  let hash = "";
  let even = true;
  let bit = 0;
  let ch = 0;

  while (hash.length < precision) {
    if (even) {
      const mid = (lonRange[0] + lonRange[1]) / 2;
      if (lon > mid) {
        ch |= BITS[bit];
        lonRange[0] = mid;
      } else {
        lonRange[1] = mid;
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat > mid) {
        ch |= BITS[bit];
        latRange[0] = mid;
      } else {
        latRange[1] = mid;
      }
    }
    even = !even;
    if (bit < 4) {
      bit += 1;
    } else {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

/** Bounding box of a cell, as [south, west, north, east]. */
export function decodeBbox(hash) {
  const latRange = [-90, 90];
  const lonRange = [-180, 180];
  let even = true;

  for (const c of hash.toLowerCase()) {
    const cd = BASE32.indexOf(c);
    if (cd < 0) throw new Error("not a geohash character: " + c);
    for (const mask of BITS) {
      const range = even ? lonRange : latRange;
      const mid = (range[0] + range[1]) / 2;
      if (cd & mask) range[0] = mid;
      else range[1] = mid;
      even = !even;
    }
  }
  return [latRange[0], lonRange[0], latRange[1], lonRange[1]];
}

/** Centre of a cell, as { lat, lon }. */
export function decodeCentre(hash) {
  const [s, w, n, e] = decodeBbox(hash);
  return { lat: (s + n) / 2, lon: (w + e) / 2 };
}

/** A cell as a GeoJSON Polygon ring, longitude first. */
export function cellPolygon(hash) {
  const [s, w, n, e] = decodeBbox(hash);
  return [[[w, s], [e, s], [e, n], [w, n], [w, s]]];
}

/**
 * Every cell of the same length that covers the given bounds, including the
 * partly covered ones at the edges. Returns at most `limit` cells; when there
 * would be more it returns null, which the caller reads as "ask the reader to
 * zoom in".
 */
export function cellsCovering(bounds, precision, limit) {
  if (bounds.east < bounds.west || bounds.north < bounds.south) return null;
  const first = encode(bounds.south, bounds.west, precision);
  const [s, w, n, e] = decodeBbox(first);
  const dLat = n - s;
  const dLon = e - w;

  const rows = Math.floor((bounds.north - s) / dLat) + 1;
  const cols = Math.floor((bounds.east - w) / dLon) + 1;
  if (rows * cols > limit) return null;

  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lat = s + dLat * (r + 0.5);
      const lon = w + dLon * (c + 0.5);
      cells.push(encode(lat, lon, precision));
    }
  }
  return Array.from(new Set(cells));
}

/** The path of an area file inside a dump, relative to its base URL. */
export function areaPath(cell) {
  return "areas/" + cell.slice(0, 2) + "/" + cell.slice(0, 3) + "/" + cell + ".geojson";
}
