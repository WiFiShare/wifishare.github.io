# Sample data

Invented data, used by `map.html` so the map has something to draw while the
real dump is empty. **None of these networks exist.** Every name starts with
`SAMPLE`, and the two BSSIDs on the verified record are from
`00:00:5e:00:53:00/24`, the range RFC 7042 reserves for documentation.

## Layout

It copies the layout of the [data](https://github.com/WiFiShare/data) dump, so
the same code reads both:

```
index.json
areas/<gh2>/<gh3>/<gh5>.geojson
```

There is one area file, `areas/sr/srb/srbj4.geojson`. Cell `srbj4` is the
geohash-5 cell over the centre of Bologna, which is the worked example in
`data/README.md` and in `spec/docs/geohash.md`.

## What it demonstrates

Four community-found networks and one owner-verified one, so the map has to
render both cases:

| | Community-found | Owner-verified |
| --- | --- | --- |
| Position | Centre of a geohash-7 cell | Exact, 5 decimal places |
| `precision_m` | 150 | 10 |
| `bssids`, `venue`, `credential` | Absent | Present |

The community positions are the real centres of the geohash-7 cells named in
each record's `cell` field, so a cell drawn around a point lines up with it.

## Validating it

The file validates against `schemas/area.schema.json` in the
[spec](https://github.com/WiFiShare/spec) repository, which in turn `$ref`s
`network.schema.json`:

```sh
env -u PYTHONPATH uv run --python 3.12 --with jsonschema --with referencing python - <<'PY'
import json, pathlib
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

spec = pathlib.Path("../spec/schemas")          # a checkout of WiFiShare/spec
res = {}
for p in spec.glob("*.json"):
    doc = json.loads(p.read_text())
    r = Resource.from_contents(doc)
    res[p.name] = r
    res[doc["$id"]] = r
schema = json.loads((spec / "area.schema.json").read_text())
v = Draft202012Validator(schema, registry=Registry().with_resources(res.items()))
doc = json.loads(pathlib.Path("areas/sr/srb/srbj4.geojson").read_text())
errors = list(v.iter_errors(doc))
print("valid" if not errors else errors)
PY
```

## One caveat about `index.json`

`spec` fixes the area file format but does not yet fix the shape of the values
in `index.json`'s `areas` object. `assets/js/map.js` reads only the keys, which
are cell names. Do not rely on `network_count` here.

## Ids

The `id` values are invented and typed by hand. In the real dump they are random
and carry no derivation from a BSSID, SSID or position (rule P8).
