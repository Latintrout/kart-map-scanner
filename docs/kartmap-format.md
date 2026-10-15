# kartmap file format (version 2)

_Last updated for scanner v12a (2026-10-16). v9b, v11 and v12b made no format changes (v11's `.glb` is a separate preview model). **(v12a)** adds ground heights._ Fields marked **(v8)**, **(v8.1)**, **(v8.2)**, **(v8.3)** or **(v9a)** are newer than version 1. All are optional, so readers of version 1 files still work. Files say `"version": 2` from scanner v8.2 on, matching the "kartmap v2" the game's loader (brisbane-kart, `kartmap.gd`) was written for. That loader accepts versions 1 and 2 and **rejects anything higher**, so a future version 3 needs a loader update first._

**Guesses are always marked.** Any field ending in `Source` (`heightSource`, `widthSource`, `roofShapeSource`) says where a value came from. The values `default`, `estimated`, `guess` and **(v8.3)** `ml-estimate` mean it's a guess: later data (LiDAR, hand edits) may replace guesses freely, but must never replace real values (`osm`, `levels`, `lanes`, `lidar`, **(v8.3)** `overture`, **(v9a)** `manual`).

Files ending in `.json` named `kartmap_<name>_<date>.json` come from Brandon's Kart Map Scanner
(https://latintrout.github.io/kart-map-scanner/). The scanner reads free OpenStreetMap (OSM) data
along a hand-drawn route. Each file describes one track and its surroundings, ready to be built
into a level in the Godot kart game.

## Units and axes

- All positions are **metres** from the route's first point (the origin, `[0, 0]`).
- Every point is `[x, y]`: **x = east, y = north**.
- In Godot (Y up, -Z forward): `Vector3(x, 0, -y)`.
- The ground is flat unless the scan has ground heights: `meta.elevation` is `null` without them. **(v12a)** With them ("Get ground heights"), heights are metres above `meta.elevation.base`, kept in separate fields so every point stays `[x, y]`: `route.elevation`, `route.centerline.elevation`, and `ground` on buildings, points and landmarks. In Godot: `Vector3(x, height, -y)`.

## Top level

| Key | What it is |
|---|---|
| `format` | Always `"kartmap"` |
| `version` | `2` (scanner v8.2+), `1` (older files) |
| `meta` | Info about the scan (below) |
| `route` | The track itself |
| `roads` | Nearby roads and paths (scenery, not the track) |
| `buildings` | Building footprints with heights |
| `areas` | Ground polygons: parks, water, pools, beaches, car parks, land use |
| `waterways` | Creeks and drains as lines |
| `barriers` | **(v8)** Fences, walls, hedges, kerbs as lines |
| `points` | Small objects ("props"): trees, lamps, signs, benches, bins, picnic tables, statues… |
| `landmarks` | **(v8)** Named places worth modelling by hand (attractions, galleries, fountains, monuments) |
| `railways` | **(v8.1)** Railway, light rail and tram lines |
| `markings` | **(v8.1)** Road markings: crossings, stop lines, give-way lines |
| `race` | **(v8.1)** Suggested start line, start grid, checkpoints and shortcuts |
| `manualTrees` | Copy of hand-placed trees in lat/lon (only used by the scanner to reload a file; the game can ignore it) |
| `manualBuildings` | **(v9a)** Copy of hand-drawn buildings in lat/lon, `[{ ring, height, name? }]` (for reloading; the game uses the copies in `buildings`) |

## meta

| Key | Meaning |
|---|---|
| `name` | Track name |
| `origin` | `{lat, lon}` of point `[0, 0]` |
| `scanRadius` | Metres scanned on each side of the route (e.g. 300) |
| `bbox` | Extent of everything in the file, in metres |
| `areasTrimmedTo` | Box that large areas (like the river) were cut to |
| `counts` | Number of each feature type (v8 adds `barriers`, `landmarks`, `bridges`, `tunnels`) |
| `elevation` | **(v12a)** `null`, or ground heights from the Queensland LiDAR terrain model: `{ source, service, licence: "CC BY-SA", attribution, base, units, groundOnly, metresPerSample, trackLowest, trackHighest, climb, descent, steepest: { grade, at }, bridgedPoints, counts, terrainFile?, terrainSpacing? }`. `base` = metres above sea level (AHD) of the track's lowest point; every other height is metres above `base`. `grade` is % over 20 m (+ uphill in race direction), `at` = metres along the centerline |
| `generator` | **(v8)** Which scanner version made the file, e.g. `"kart-map-scanner v8.1"` |
| `quality` | **(v8.1)** Report card: `heights` (% measured / estimated / default), `roofShapes` (% mapped / guessed), `buildingsOnTrack` (ids), `barriersOnTrack`, `propsOnTrack`, `treesTyped` (%), and `notes` (plain-English warnings) |
| `attribution` | "© OpenStreetMap contributors, ODbL", plus **(v8.3)** Overture and Queensland imagery credits when those were used. Must appear in the game's credits |
| `overture` | **(v8.3)** `{ release, heightsFilled, added }` when Overture Maps filled gaps (ODbL, same as OSM) |
| `imagery` | **(v8.3)** Set after "Sample colours": `{ source, service, licence: "CC BY-SA", attribution, vintage, noWarranty, metresPerPixel, sampled: {buildings, areas} }`. The photos are 2022 or older |
| `groundImage` | **(v8.3)** Set after "Export ground image": `{ file, minX, minY, maxX, maxY, width, height, metresPerPixel, colours }`. **(v11)** `width × metresPerPixel` now always covers the area exactly (rounding fix). A top-down PNG for the ground texture. Top-left pixel = (`minX`, `maxY`), north is up |

## route

| Key | Meaning |
|---|---|
| `points` | Track centreline, **in race order** (from v9a it is already reversed and/or starts at the chosen start; the first point is the start/finish). If `closed` is true, the last point equals the first |
| `width` | Track width in metres |
| `length` | Track length in metres |
| `closed` | `true` = lap track (loop) |
| `snappedToRoads` | `true` if snapped to car roads; `false` if drawn by hand (e.g. along footpaths) |
| `waypoints` | The scanner's editing points in lat/lon, in the order they were drawn. The game should ignore these |
| `elevation` | **(v12a)** Height (m above `meta.elevation.base`) of each of `points`, same length. Smoothed over ±8 m; on bridges and in tunnels a straight line between the two ends (the terrain model is bare ground, so it would put a bridge deck down in the river) |
| `reversed` | **(v9a)** `true` if the race runs against the drawing direction (already applied to `points`) |
| `startPoint` | **(v9a)** `[lat, lon]` of the start picked by hand on a loop (already applied to `points`; `meta.origin` sits there too) |
| `centerline` | **(v8.1)** `{ spacing, points, length, elevation? }` (**v12a** `elevation`: one height per point, as for `route.elevation`): the track line smoothed (corners rounded about 5 m) with points exactly `spacing` (2 m) apart. **Use this for the track surface**; `points` is the raw line |
| `corners` | **(v8.1)** `[{ at, pos, angle }]`: turns of more than 35°. `at` = metres along the centerline, `angle` in degrees (+ left, − right) |

## roads

Each: `{ id, kind, name?, width, widthSource, points, bridge?, tunnel?, layer?, surface?, lanes? }`

- `kind` is the OSM road type: `residential`, `primary`, `footway`, `cycleway`, `steps`, `service`, and so on.
- `width` is in metres. `widthSource` is `osm` (mapped), `lanes` (lanes × 3.2 m) or `default` (a guess by kind).
- `points` is a line, not a polygon.
- **(v8)** `bridge: true` means it's raised over what's below (e.g. the Goodwill Bridge). `tunnel: true` means it goes underneath. Both are absent on normal roads.
- **(v8)** `layer`: stacking order where things cross. `1` is one level up, `-1` is one level down; absent means ground level (0). A bridge with no `layer` should still be treated as 1.
- **(v8)** `surface`: `asphalt`, `concrete`, `paving_stones`, `grass`, `gravel`, `sand`… Good for picking track textures and grip.
- **(v8)** `lanes`: number of lanes, when mapped.
- **(v8.1)** `oneway`: `true`, or `"reverse"` (one-way against the line's drawing direction). One-way minor roads without a mapped width get a narrower default.
- **(v8.1)** `sidewalk`: `both`, `left`, `right`, `no` or `separate`.
- **(v8.1)** `crossing`: on crossing paths, how it's painted: `zebra`, `marked`, `signals`, `unmarked` or `crossing`.
- **(v8.2)** `lit: true`: street lighting. Piers and breakwaters mapped as lines also come in as roads (`kind: "pier"`, 4 m wide unless mapped).
- **(v8.1)** `incline`: `up` / `down` (relative to the drawing direction; common on `steps`, good ramp/jump candidates), or a slope in percent.

## buildings

Each: `{ id, kind, name?, height, heightSource, footprint, holes?, roofShape?, roofColour?, colour?, material?, levels?, minHeight? }`

- `footprint` is a polygon outline. The first point is **not** repeated at the end.
- `height` is in metres. `heightSource` is `osm` (mapped height), `levels` (floors × 3 m), **(v8.1)** `estimated` (typical height of 3+ measured buildings of the same type within 150 m) or `default` (a guess by building type). **(v8.3)** `overture` (a measured height Overture Maps took from OSM history) or `ml-estimate` (Microsoft's machine-learning guess, via Overture: treat as a guess). OSM's own `height` and `building:levels` always win over Overture. The Kart LiDAR Tool may later add `lidar` (measured).
- **(v8.1)** `roofShape` is always filled in; `roofShapeSource` is `osm` (mapped) or `guess` (small homes hipped, small sheds gabled, everything else flat).
- **(v8.1)** `hasParts: true`: this building is split into parts. **Don't draw this outline**; draw its parts instead (the buildings with `part: true` and `parent` = this id).
- **(v8.2) Building parts** are in this same list with `part: true`, their own `height`, `minHeight` (where they start) and `parent`. E.g. a 28-floor tower starting above a 3-floor podium. (v8.1 files had them in a separate `buildingParts` list instead.)
- **(v8.2)** `roofMaterial` (`metal`, `tile`, `concrete`…) and `roofHeight` (metres) when mapped.
- **(v8.1)** `trackDist`: metres from the track; `onTrack: true` if it overlaps the track corridor (`width / 2`).
- **(v8.3)** `source: "overture"`: a building OSM doesn't have, added from Overture Maps (id starts with `ov-`). Only added when it doesn't overlap an OSM building and isn't underground.
- **(v8.3)** `sampledRoofColour`: hex colour read from the aerial photo (median of the roof). Only present after "Sample colours". A mapped `roofColour` always wins; use this when there is none.
- **(v9a)** `source: "manual"`, `heightSource: "manual"`: a building drawn by hand in the scanner (id `mb1`, `mb2`…), with the height typed in. Treat the height as real. Roof is `flat` (`roofShapeSource: "guess"`). No `trackDist` / `onTrack` on these.
- **(v12a)** `ground`: height of the lowest ground under the outline (m above `meta.elevation.base`), so the building starts there and doesn't float on a slope. `height` and `minHeight` are still measured from the building's own ground.
- `holes` (optional) lists courtyards to cut out, each its own polygon.
- **(v8) Looks, when OSM has them (all optional):**
  - `roofShape`: `flat`, `gabled`, `hipped`, `pyramidal`, `skillion`, `dome`…
  - `roofColour` and `colour` (walls): a colour name (`red`) or hex (`#ffffff`).
  - `material`: `brick`, `concrete`, `glass`, `wood`, `metal`…
  - `levels`: number of floors.
  - `minHeight`: metres above ground where the building starts (e.g. a raised walkway). The shape spans `minHeight` to `height`.

## areas

Each: `{ id, kind, name?, polygon, holes?, surface? }`

- `kind` is the OSM type. Common ones: `water`, `swimming_pool`, `beach`, `park`, `garden`, `grass`, `wood`, `scrub`, `parking`, `pedestrian` (paved plaza), `playground`, `residential` / `commercial` / `industrial` (whole-district zoning: use as faint ground tint at most).
- `holes` (optional) are cut-outs, e.g. the island in the Streets Beach lagoon.
- **(v8.3)** `sampledColour`: hex colour read from the aerial photo, after "Sample colours". Never set on zoning areas (a whole suburb has no single colour).
- Areas can overlap: a pool sits inside a park, which sits inside a residential zone. Draw large or zoning areas first, then smaller specific ones on top.
- Very large areas were trimmed to `meta.areasTrimmedTo`, so a trimmed edge may run in a straight line along that box.

## waterways

Each: `{ id, kind, name?, points }`. Lines (`stream`, `drain`, `canal`...). Not polygons.

## railways (v8.1)

Each: `{ id, kind, name?, points, bridge?, tunnel?, layer?, electrified?, trackDist, onTrack? }`. `kind`: `rail`, `light_rail`, `tram`, `subway`… Abandoned and disused lines are left out. Platforms are `areas` with kind `platform`.

## markings (v8.1)

Each: `{ id, kind, style?, pos }`. `kind`: `crossing` (with `style`: `zebra`, `marked`, `signals`, `unmarked`), `stop_line`, `give_way_line`. Paint them on the nearest road.

## barriers (v8)

Each: `{ id, kind, name?, points, height?, material?, colour? }`

- `kind`: `fence`, `wall`, `retaining_wall`, `hedge`, `kerb`, `guard_rail`, `handrail`…
- `points` is a line. A barrier that goes all the way round (a hedge around a garden) has its first point repeated at the end.
- `height` in metres and `material` when mapped. Otherwise pick a default by kind (about 1.2 m for a fence, 1.5 m for a hedge).
- These make natural track edges and collision walls near the track.

## points

Each: `{ id, kind, group, source, pos, name?, canopy? }`

- `kind` is what the object is. Since v8 there are many more kinds: `tree`, `street_lamp`, `traffic_signals`, `bus_stop`, `crossing`, `bench`, `waste_basket`, `picnic_table`, `fountain`, `drinking_water`, `bicycle_parking`, `shelter`, `bollard`, `gate`, `artwork`, `memorial`, `flagpole`, `fire_hydrant`, `power_pole`, playground equipment (`swing`, `slide`…), billboards and more. Treat any kind you don't recognise as a generic small prop.
- **(v8)** `group` is the OSM category the kind comes from: `natural`, `highway`, `amenity`, `leisure`, `playground`, `tourism`, `historic`, `man_made`, `barrier`, `power`, `emergency` or `advertising`. Useful for picking a fallback model.
- `name` (optional, v8): e.g. the name of a statue.
- **(v8.1) Trees:** `treeType` (`palm`, `eucalypt`, `fig`, `conifer`, `broadleaf`; absent = unknown, use a default), and `height` / `canopy` in metres when mapped. **(v8.2)** `genus`, `species`, `leafType` (`broadleaved` / `needleleaved`) and `leafCycle` (`evergreen` / `deciduous`) as separate fields.
- **(v8.1)** `trackDist` and `onTrack` as for buildings. Crossings moved from props to `markings`.
- Shops and offices are **not** props. **(v8.2)** Cafés, restaurants, bars, ice-cream places, toilets, parking meters and playgrounds **are** (the game draws outdoor tables, toilet blocks and so on). They're never landmarks.
- **(v8.2)** `artworkType` on artworks (`statue`, `sculpture`, `mural`…).
- `source`: `osm` (mapped individually), `osm-tree_row` (generated every 8 m along a mapped row of trees) or `manual` (placed by hand in the scanner).
- `canopy`: tree crown diameter in metres, only on `manual` trees. For others, pick a default (about 6 m).

## landmarks (v8)

Each: `{ id, name, kind, pos, ref?, wikidata?, wikipedia? }`

- Named places worth modelling by hand, e.g. Streets Beach, the Gallery of Modern Art, a named fountain.
- `kind` is why it counts, most specific first **(v8.2)**: the attraction type (`big_wheel` = the Wheel of Brisbane, the game builds a Ferris wheel), the artwork type (`statue`, `sculpture`…), then `attraction`, `gallery`, `museum`, `fountain`, `memorial`, `theatre`, `building` (a notable named building)…
- `pos` is `[x, y]` in metres (for shapes, roughly their centre).
- `ref` points to the building, area or prop in this file that it belongs to, so the game can swap that generic piece for a hand-made model. No `ref` means it's only a named spot.
- `wikidata` and `wikipedia` (when present) help find reference photos.
- **(v8.3)** `photos`: up to 3 reference photos from Wikimedia Commons, `[{ file, thumb, page, licence, author }]`, after "Find landmark photos". `photosFrom` is `wikidata` (the landmark's own photo) or `nearby` (Commons photos geotagged within 100 m, ones naming the landmark first: may show a neighbour). For modelling reference only; if a photo is used in the game itself, credit the author and follow its licence (`page` has the details).
- Unnamed things are never landmarks.

## race (v8.1)

Suggestions only (`suggested: true`). The game or a later editor may move them.

- `startLine`: `{ at, pos, dir, width }`. On a loop it's at the route's start.
- `checkpoints`: `[{ i, at, pos, dir, width }]`. About every 100 m, at least 8; checkpoint 0 is the start/finish. `dir` is the direction of travel (unit vector).
- `grid`: 8 start slots, `[{ slot, behind, pos, dir }]`, 2 per row, 6 m apart, behind the start line.
- `shortcuts`: `[{ from, to, skips, length, saving, via, points }]`. Paths that rejoin the track at least 30 m sooner than driving it. `from`/`to` = metres along the centerline, `via` = road ids used, `points` = the path. Never more than half a lap (that would be driving backwards). Sorted best first, at most 10.

## IDs

`w123` = OSM way, `n123` = OSM node, `r123` = OSM multipolygon (`r123-2` = its second piece), `m1` = manual tree, `w123-4` = 4th tree generated from tree row `w123`, `L1` = landmark, **(v8.3)** `ov-<overture id>` = building added from Overture, **(v9a)** `mb1` = building drawn by hand. IDs are unique within a file.

## Level-building rules (agreed decisions)

1. **Near vs far.** Within about 50 m of the track: full detail and collision. From 50 m to the scan radius: plain flat-coloured boxes, **no collision**, merged into **one mesh**. Fog at the far edge.
2. **Keep the track clear.** Skip any building whose footprint overlaps the track corridor (route centreline ± `width / 2`).
3. **Order of work.** Make the track drivable first (flat ground, track surface, box buildings). Restyling (N64/PS1 look, textures, palette) comes after.
4. **Missing heights are guesses.** Many buildings have `heightSource: "default"`. The game may adjust them freely.
5. **Credits.** Include `meta.attribution` as written (OSM, plus Overture and Queensland imagery when used).
6. **(v8) Bridges and tunnels.** Raise `bridge` roads above the ground (by `layer`, about 5 m per level). Draw `tunnel` roads below or skip them, so they don't cut across the surface.
7. **(v8) Landmarks** with a `ref` replace that generic building, area or prop with a hand-made model once one exists.
8. **(v8.1) Track surface** from `route.centerline`. Skip or move anything with `onTrack: true` (the quality report lists them).
9. **(v8.1/v8.2) Building parts:** when a building has `hasParts`, skip it and build the `part: true` buildings that name it as `parent`.
10. **(v8.2) Loader contract:** the scanner checks every scan against what the game's loader reads (valid footprints, heights, parts present for `hasParts`, positions on landmarks and props) and warns before export if anything would break in the game.
11. **(v8.3) Colours:** mapped colours (`roofColour`, `colour`) first, then `sampledRoofColour` / area `sampledColour` from the aerial photo, then the game's own palette.
12. **(v12a) Hills:** with `meta.elevation`, raise the track by `route.elevation` (or `centerline.elevation`), and each building/prop/tree by its `ground`. The full height grid is in the terrain file:

### Terrain file (v12a), `kartmap_<name>_terrain.json`

`{ format: "kartmap-terrain", version: 1, name, origin, minX, maxY, spacing, width, height, base, encoding, source, licence, attribution, missing, data }`. `data` is base64 of `width × height` 16-bit little-endian integers: centimetres above `base`, row by row starting at the north-west corner (`minX`, `maxY`), going east along a row and then south (row `r`, column `c` is at x = `minX + c × spacing`, y = `maxY − r × spacing`). `-32768` = no data. Bare ground only (bridges and buildings are not in it).
