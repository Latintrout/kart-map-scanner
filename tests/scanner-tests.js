// Kart Map Scanner: automated tests.
// Every feature gets checked here, so a new version can't quietly break an old one.
// Runs in the browser (open tests/index.html on the site) and in Node.
//
// runScannerTests(lib) -> [{ name, pass, detail }]
// `lib` holds the scanner's data functions (the code between PURE-START and PURE-END in index.html).

function runScannerTests(lib) {
  const results = [];
  const check = (name, pass, detail) => results.push({ name, pass: !!pass, detail: detail === undefined ? '' : String(detail) });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const has = k => typeof lib[k] === 'function';
  const lat0 = -27.6, lon0 = 153.13;

  // ---------- v1: projection, building heights, road widths, export ----------
  const P = lib.makeProjector(lat0, lon0);
  check('v1 projection: 0.001° north ≈ 111.32 m', same(P(lat0 + 0.001, lon0), [0, 111.32]), JSON.stringify(P(lat0 + 0.001, lon0)));
  check('v1 projection: 0.001° east ≈ 98.65 m', same(P(lat0, lon0 + 0.001), [98.65, 0]), JSON.stringify(P(lat0, lon0 + 0.001)));
  check('v1 projection matches real distance within 0.2%', Math.abs(lib.dist([lat0, lon0], [lat0 + 0.001, lon0]) - 111.32) < 0.25);

  const sq = (la, lo, d) => [[la, lo], [la, lo + d], [la + d, lo + d], [la + d, lo], [la, lo]].map(([lat, lon]) => ({ lat, lon }));
  const fake = { elements: [
    { type: 'way', id: 1, tags: { building: 'house' }, geometry: sq(lat0 + 0.0002, lon0 + 0.0002, 0.0001) },
    { type: 'way', id: 2, tags: { building: 'yes', 'building:levels': '3' }, geometry: sq(lat0 + 0.0005, lon0, 0.0001) },
    { type: 'way', id: 3, tags: { building: 'retail', height: '9.5 m' }, geometry: sq(lat0, lon0 + 0.0005, 0.0001) },
    { type: 'way', id: 4, tags: { highway: 'residential', name: 'Test St' }, geometry: [{ lat: lat0, lon: lon0 }, { lat: lat0 + 0.001, lon: lon0 }] },
    { type: 'way', id: 5, tags: { highway: 'primary', lanes: '4' }, geometry: [{ lat: lat0, lon: lon0 }, { lat: lat0, lon: lon0 + 0.001 }] },
    { type: 'way', id: 6, tags: { leisure: 'park' }, geometry: sq(lat0 - 0.001, lon0, 0.0005) },
    { type: 'way', id: 7, tags: { waterway: 'stream' }, geometry: [{ lat: lat0, lon: lon0 }, { lat: lat0 - 0.001, lon: lon0 }] },
    { type: 'way', id: 8, tags: { building: 'house' }, geometry: [{ lat: lat0, lon: lon0 }, { lat: lat0 + 0.0001, lon: lon0 }] },
    { type: 'node', id: 9, lat: lat0 + 0.0003, lon: lon0 + 0.0003, tags: { natural: 'tree' } },
    { type: 'node', id: 10, lat: lat0, lon: lon0, tags: { highway: 'traffic_signals' } }
  ] };
  const route = [[lat0, lon0], [lat0 + 0.001, lon0], [lat0 + 0.001, lon0 + 0.001], [lat0, lon0]];
  const r1 = lib.buildOutput(fake, { route, waypoints: route.slice(0, 3), radius: 100, width: 8, loop: true, snapped: false, name: 'test', now: 'X' }).out;
  const c1 = r1.meta.counts;
  check('v1 counts: 2 roads, 3 buildings, 1 area, 1 waterway, 2 points',
    c1.roads === 2 && c1.buildings === 3 && c1.areas === 1 && c1.waterways === 1 && c1.points === 2, JSON.stringify(c1));
  check('v1 building heights: default 5, levels 9, osm 9.5',
    same(r1.buildings.map(b => [b.height, b.heightSource]), [[5, 'default'], [9, 'levels'], [9.5, 'osm']]), JSON.stringify(r1.buildings.map(b => [b.height, b.heightSource])));
  check('v1 broken (unclosed) building is skipped, not crashed on', !r1.buildings.some(b => b.id === 'w8'));
  check('v1 road widths: residential 6 default, primary 4 lanes = 12.8',
    same(r1.roads.map(r => [r.kind, r.width, r.widthSource]), [['residential', 6, 'default'], ['primary', 12.8, 'lanes']]));
  check('v1 route length 358.31 m', r1.route.length === 358.31, r1.route.length);
  check('v1 route points in metres', same(r1.route.points, [[0, 0], [0, 111.32], [98.65, 111.32], [0, 0]]), JSON.stringify(r1.route.points));
  check('v1 export is valid JSON', (() => { try { JSON.parse(lib.prettyJSON(r1)); return true; } catch (e) { return false; } })());
  check('format marker (version 2 since v8.2, matching the published kartmap v2)', r1.format === 'kartmap' && r1.version === 2);

  // ---------- v4/v5: query ----------
  const q = lib.buildQuery(route, 100);
  check('v4 query never uses slow "nwr(around)"', !/nwr\(around/.test(q));
  check('v5 query asks for a small server reservation on short routes', /\[timeout:25\]\[maxsize:67108864\]/.test(q), q.split('\n')[0]);

  // ---------- v3: pen tool ----------
  const stroke = []; for (let x = 0; x <= 300; x += 2) stroke.push([x, x % 6 === 0 ? 2 : -2]); for (let y = 0; y <= 200; y += 2) stroke.push([300 + (y % 4 ? 1 : -1), y]);
  const simp = lib.simplify(stroke, 4);
  check('v3 pen stroke: 252 wobbly points simplify to start, corner, end', same(simp, [[0, 2], [298, -2], [299, 200]]), JSON.stringify(simp));
  const capped = lib.capPoints([...Array(250).keys()], 100);
  check('v3 capPoints keeps first and last', capped.length === 100 && capped[0] === 0 && capped[99] === 249);
  const dense = [...Array(20).keys()].map(i => [-27.6, 153.13 + i * 0.0003]);
  const sparse = [[-27.6, 153.13], [-27.6, 153.135], [-27.605, 153.135]];
  check('v3 snap method: pen strokes use match, clicks use route',
    lib.chooseSnapMethod(dense) === 'match' && lib.chooseSnapMethod(sparse) === 'route' && lib.chooseSnapMethod(dense.slice(0, 2)) === 'route');

  // ---------- v6: 10-point pieces for the match server ----------
  for (const n of [5, 10, 11, 19, 27, 91]) {
    const p = [...Array(n).keys()], ch = lib.chunkPoints(p, 10);
    const ok = ch.every(c => c.length <= 10 && c.length >= 2) && ch.every((c, i) => i === 0 || c[0] === ch[i - 1][ch[i - 1].length - 1]) && ch[0][0] === 0 && ch.at(-1).at(-1) === n - 1;
    check(`v6 ${n} points split into joined pieces of ≤10`, ok, ch.map(c => c.length).join(','));
  }

  // ---------- v7: multipolygons, trimming, tree rows, manual trees ----------
  const ring = lib.assembleRings([[[0, 0], [0, 1]], [[1, 1], [0, 1]], [[1, 1], [1, 0], [0, 0]]]);
  check('v7 joins 3 pieces (one reversed) into 1 closed shape', ring.length === 1 && same(ring[0][0], ring[0].at(-1)));
  check('v7 never-closing pieces are dropped', lib.assembleRings([[[0, 0], [0, 1]], [[5, 5], [6, 6]]]).length === 0);
  const box = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  check('v7 trims a huge shape to the box', same(lib.clipRect([[-500, -500], [500, -500], [500, 500], [-500, 500]], box), [[0, 100], [0, 0], [100, 0], [100, 100]]));
  check('v7 shape fully outside the box is removed', lib.clipRect([[200, 200], [300, 200], [300, 300]], box).length === 0);
  check('v7 shape inside the box is unchanged', same(lib.clipRect([[10, 10], [20, 10], [20, 20]], box), [[10, 10], [20, 10], [20, 20]]));
  check('v7 tree row: 40 m line gives a tree every 8 m', lib.pointsAlong([[0, 0], [20, 0], [40, 0]], 8).length === 6);

  const la = -27.48, lo = 153.02, P2 = lib.makeProjector(la, lo);
  const off = (dx, dy) => ({ lat: la + dy / 111320, lon: lo + dx / (111320 * Math.cos(la * Math.PI / 180)) });
  const sqm = (x, y, s) => [off(x, y), off(x + s, y), off(x + s, y + s), off(x, y + s), off(x, y)];
  const outer = sqm(20, 20, 60);
  const rel = { elements: [
    { type: 'relation', id: 8494, tags: { leisure: 'swimming_pool', type: 'multipolygon' }, members: [
      { type: 'way', role: 'outer', geometry: outer.slice(0, 3) }, { type: 'way', role: 'outer', geometry: outer.slice(2) },
      { type: 'way', role: 'inner', geometry: sqm(40, 40, 10) }] },
    { type: 'relation', id: 7642164, tags: { natural: 'water', name: 'Brisbane River', type: 'multipolygon' }, members: [{ type: 'way', role: 'outer', geometry: sqm(-3000, -200, 6000) }] },
    { type: 'relation', id: 999, tags: { landuse: 'grass', type: 'multipolygon' }, members: [{ type: 'way', role: 'outer', geometry: [off(0, 0), off(5, 5)] }] },
    { type: 'way', id: 27951887, tags: { natural: 'beach' }, geometry: sqm(-30, 0, 20) },
    { type: 'way', id: 5, tags: { natural: 'tree_row' }, geometry: [off(0, -10), off(24, -10)] }
  ] };
  const route2 = [[la, lo], [la + 0.0009, lo], [la + 0.0009, lo + 0.001], [la, lo]];
  const r7 = lib.buildOutput(rel, { route: route2, waypoints: route2.slice(0, 3), radius: 100, width: 8, loop: true, snapped: false, name: 't', now: 'X' }).out;
  const pool = r7.areas.find(a => a.id === 'r8494');
  check('v7 lagoon (multipolygon pool) comes through with its island hole', pool && pool.kind === 'swimming_pool' && pool.holes && pool.holes.length === 1);
  const river = r7.areas.find(a => a.id === 'r7642164'), T = r7.meta.areasTrimmedTo;
  check('v7 river is trimmed to the scan area', river && river.polygon.every(p => p[0] >= T.minX - 0.5 && p[0] <= T.maxX + 0.5 && p[1] >= T.minY - 0.5 && p[1] <= T.maxY + 0.5));
  check('v7 incomplete multipolygon is skipped and counted', r7.meta.counts.skippedIncompleteShapes === 1);
  check('v7 tree row becomes 4 trees (24 m at 8 m spacing)', r7.points.filter(p => p.source === 'osm-tree_row').length === 4);
  const fin = lib.withManualTrees(r7, [{ lat: la + 0.0003, lon: lo + 0.0003, canopy: 12 }]);
  check('v7 manual trees are added at export', fin.meta.counts.manualTrees === 1 && fin.points.at(-1).source === 'manual' && fin.points.at(-1).canopy === 12);
  check('v7 adding manual trees leaves the scan result untouched', fin.points.length === r7.points.length + 1);
  check('v7 manual trees kept for reloading', same(fin.manualTrees, [{ lat: la + 0.0003, lon: lo + 0.0003, canopy: 12 }]));
  const U = lib.makeUnprojector(la, lo), back = U(P2(la + 0.0012, lo + 0.0021));
  check('v7 metres → lat/lon round trip within 5 cm', lib.dist(back, [la + 0.0012, lo + 0.0021]) < 0.05);

  // ---------- v8 ----------
  if (typeof lib.v8Tests === 'function') lib.v8Tests(check, same);   // placeholder hook, unused
  if (has('extractLandmark')) runV8(lib, check, same);
  else check('v8 functions present', false, 'extractLandmark not found (running against v7?)');
  if (has('smoothLine')) runV81(lib, check, same);
  else check('v8.1 functions present', false, 'smoothLine not found (running against v8?)');
  if (has('loaderContractProblems')) runV82(lib, check, same);
  else check('v8.2 functions present', false, 'loaderContractProblems not found (running against v8.1?)');
  if (has('mergeOverture', 'rankNearbyPhotos')) runV83(lib, check, same);
  else check('v8.3 functions present', false, 'mergeOverture not found (running against v8.2?)');
  if (has('orientRoute')) runV9a(lib, check, same);
  else check('v9a functions present', false, 'orientRoute not found (running against v8.3?)');
  if (has('problemSpots')) runV9b(lib, check, same);
  else check('v9b functions present', false, 'problemSpots not found (running against v9a?)');

  return results;
}

function runV8(lib, check, same) {
  const la = -27.48, lo = 153.02;
  const off = (dx, dy) => ({ lat: la + dy / 111320, lon: lo + dx / (111320 * Math.cos(la * Math.PI / 180)) });
  const sqm = (x, y, s) => [off(x, y), off(x + s, y), off(x + s, y + s), off(x, y + s), off(x, y)];
  const route = [[la, lo], [la + 0.0009, lo], [la + 0.0009, lo + 0.001], [la, lo]];
  const data = { elements: [
    { type: 'way', id: 101, tags: { highway: 'footway', bridge: 'yes', layer: '1', name: 'Goodwill Bridge', surface: 'concrete' }, geometry: [off(0, 0), off(0, 50)] },
    { type: 'way', id: 102, tags: { highway: 'busway', tunnel: 'yes', layer: '-1' }, geometry: [off(10, 0), off(10, 50)] },
    { type: 'way', id: 103, tags: { highway: 'residential', surface: 'asphalt', lanes: '2' }, geometry: [off(20, 0), off(20, 50)] },
    { type: 'way', id: 104, tags: { building: 'house', 'roof:shape': 'gabled', 'roof:colour': 'red', 'building:colour': '#ffffff', 'building:material': 'wood', 'building:levels': '1' }, geometry: sqm(30, 30, 10) },
    { type: 'way', id: 105, tags: { barrier: 'fence', height: '1.8', material: 'metal' }, geometry: [off(0, 60), off(30, 60)] },
    { type: 'way', id: 106, tags: { barrier: 'hedge' }, geometry: sqm(50, 50, 10) },
    { type: 'way', id: 107, tags: { building: 'yes', name: 'Gallery of Modern Art', tourism: 'gallery', wikidata: 'Q5517975' }, geometry: sqm(60, 0, 20) },
    { type: 'node', id: 201, lat: off(5, 5).lat, lon: off(5, 5).lon, tags: { leisure: 'picnic_table', covered: 'yes' } },
    { type: 'node', id: 202, lat: off(6, 6).lat, lon: off(6, 6).lon, tags: { amenity: 'fountain', name: 'Big Fountain' } },
    { type: 'node', id: 203, lat: off(7, 7).lat, lon: off(7, 7).lon, tags: { tourism: 'attraction', name: 'Streets Beach' } },
    { type: 'node', id: 204, lat: off(8, 8).lat, lon: off(8, 8).lon, tags: { barrier: 'bollard' } },
    { type: 'node', id: 205, lat: off(9, 9).lat, lon: off(9, 9).lon, tags: { natural: 'tree' } },
    { type: 'node', id: 206, lat: off(9, 2).lat, lon: off(9, 2).lon, tags: { shop: 'cafe', name: 'Some Cafe' } }
  ] };
  const out = lib.buildOutput(data, { route, waypoints: route.slice(0, 3), radius: 100, width: 8, loop: true, snapped: false, name: 't', now: 'X' }).out;
  const road = id => out.roads.find(r => r.id === id);
  check('v8 bridges marked (bridge, layer 1, surface kept)', road('w101') && road('w101').bridge === true && road('w101').layer === 1 && road('w101').surface === 'concrete', JSON.stringify(road('w101')));
  check('v8 tunnels marked (tunnel, layer -1)', road('w102') && road('w102').tunnel === true && road('w102').layer === -1);
  check('v8 normal roads get no bridge/tunnel fields', road('w103') && !('bridge' in road('w103')) && !('tunnel' in road('w103')) && road('w103').surface === 'asphalt');
  const b = out.buildings.find(x => x.id === 'w104');
  check('v8 building looks kept (roof shape, colours, material)', b && b.roofShape === 'gabled' && b.roofColour === 'red' && b.colour === '#ffffff' && b.material === 'wood', JSON.stringify(b));
  const fence = (out.barriers || []).find(x => x.id === 'w105');
  check('v8 fences exported as barriers with height and material', fence && fence.kind === 'fence' && fence.height === 1.8 && fence.material === 'metal' && fence.points.length === 2);
  check('v8 closed hedge is a barrier, not an area', (out.barriers || []).some(x => x.id === 'w106') && !out.areas.some(a => a.id === 'w106'));
  const props = out.points;
  check('v8 picnic tables kept as props', props.some(p => p.kind === 'picnic_table' && p.group === 'leisure'));
  check('v8 bollards kept as props', props.some(p => p.kind === 'bollard' && p.group === 'barrier'));
  check('v8 trees still kept', props.some(p => p.kind === 'tree' && p.source === 'osm'));
  check('v8 shops are not props', !props.some(p => p.kind === 'cafe'));
  const lm = out.landmarks || [];
  check('v8 landmarks list: attraction, named fountain, named gallery building',
    lm.some(l => l.name === 'Streets Beach') && lm.some(l => l.name === 'Big Fountain') && lm.some(l => l.name === 'Gallery of Modern Art' && l.ref === 'w107' && l.wikidata === 'Q5517975'), JSON.stringify(lm.map(l => l.name)));
  check('v8 unnamed things are never landmarks', lm.every(l => l.name));
  check('v8 fix: a café with a brand Wikidata link is not a landmark',
    lib.extractLandmark({ name: 'Max Brenner Chocolate Bar', amenity: 'cafe', wikidata: 'Q1' }) === null &&
    lib.extractLandmark({ name: 'Some Shop', shop: 'clothes', 'brand:wikidata': 'Q2', wikidata: 'Q2' }) === null);
  check('v8 fix: a park or building with a Wikidata link still is',
    lib.extractLandmark({ name: 'South Bank Parklands', leisure: 'park', wikidata: 'Q3' }) === 'park' &&
    lib.extractLandmark({ name: 'State Library', building: 'yes', wikidata: 'Q4' }) === 'building');
  check('v8 public artworks are landmarks', lib.extractLandmark({ name: 'Sisters', tourism: 'artwork' }) === 'artwork');
  check('v8 landmark positions are in metres', lm.every(l => Array.isArray(l.pos) && l.pos.length === 2 && isFinite(l.pos[0])));
  check('v8 new counts present', out.meta.counts.barriers === 2 && out.meta.counts.landmarks === lm.length && out.meta.counts.bridges === 1 && out.meta.counts.tunnels === 1, JSON.stringify(out.meta.counts));
  check('v8 fields stay optional (format kartmap)', out.format === 'kartmap');

  // Long-route reservation scaling
  const r0 = lib.serverBudget(2000, 100), r1 = lib.serverBudget(2100, 300), r2 = lib.serverBudget(10000, 300), r3 = lib.serverBudget(200000, 300);
  check('v8 short routes keep the small 25 s / 64 MB reservation', r0.timeout === 25 && r0.maxsize === 67108864, JSON.stringify(r0));
  check('v8 South Bank size (2.1 km at 300 m) stays small', r1.maxsize === 67108864, JSON.stringify(r1));
  check('v8 a 10 km route at 300 m asks for more', r2.maxsize > 67108864 && r2.timeout > 25, JSON.stringify(r2));
  check('v8 reservation is capped (never asks for the moon)', r3.maxsize <= 536870912 && r3.timeout <= 120, JSON.stringify(r3));
  const longRoute = [[la, lo], [la + 0.09, lo]];   // ~10 km
  check('v8 query uses the scaled reservation', /\[maxsize:(\d+)\]/.exec(lib.buildQuery(longRoute, 300))[1] > 67108864);

  // Outage message
  const down = lib.explainScanFailure([{ host: 'overpass-api.de', status: 502 }, { host: 'b', kind: 'unreadable', seconds: 0.8 }]);
  check('v8 outage: 502 is explained as the server being down (their side)', /down/i.test(down) && /overpass-api\.de\/api\/status/.test(down), down);
  const busy = lib.explainScanFailure([{ host: 'a', status: 504 }, { host: 'b', kind: 'timeout', seconds: 40 }]);
  check('v8 busy: timeouts are explained as busy, with shorten-route advice', /busy/i.test(busy) && /shorten|smaller/i.test(busy), busy);
}

function runV81(lib, check, same) {
  const la = -27.48, lo = 153.02;
  const off = (dx, dy) => ({ lat: la + dy / 111320, lon: lo + dx / (111320 * Math.cos(la * Math.PI / 180)) });
  const llOff = (dx, dy) => { const o = off(dx, dy); return [o.lat, o.lon]; };
  const rect = (x, y, w, h) => [off(x, y), off(x + w, y), off(x + w, y + h), off(x, y + h), off(x, y)];
  const node = (id, dx, dy, tags) => ({ type: 'node', id, lat: off(dx, dy).lat, lon: off(dx, dy).lon, tags });
  // A 200 x 200 m square loop starting at (0,0), going east, north, west, south.
  const loop = [llOff(0, 0), llOff(200, 0), llOff(200, 200), llOff(0, 200), llOff(0, 0)];
  const els = [
    // building with a part (tower on a podium)
    { type: 'way', id: 1, tags: { building: 'yes', 'building:levels': '2', name: 'Podium Tower' }, geometry: rect(60, 30, 40, 40) },
    { type: 'way', id: 2, tags: { 'building:part': 'yes', 'building:levels': '30', 'building:min_level': '2' }, geometry: rect(70, 40, 20, 20) },
    // three measured houses + one unmeasured house nearby; one unmeasured house far away
    { type: 'way', id: 11, tags: { building: 'house', 'building:levels': '2' }, geometry: rect(20, 120, 10, 10) },
    { type: 'way', id: 12, tags: { building: 'house', height: '7' }, geometry: rect(35, 120, 10, 10) },
    { type: 'way', id: 13, tags: { building: 'house', 'building:levels': '2' }, geometry: rect(50, 120, 10, 10) },
    { type: 'way', id: 14, tags: { building: 'house' }, geometry: rect(65, 120, 10, 10) },
    { type: 'way', id: 15, tags: { building: 'house' }, geometry: rect(-250, -250, 10, 10) },
    // big unmapped building, and a mapped roof
    { type: 'way', id: 16, tags: { building: 'commercial' }, geometry: rect(120, 120, 40, 40) },
    { type: 'way', id: 17, tags: { building: 'house', 'roof:shape': 'gabled' }, geometry: rect(20, 140, 10, 10) },
    // building sitting on the track (east edge x=200)
    { type: 'way', id: 18, tags: { building: 'retail', name: 'Central Cafes' }, geometry: rect(197, 80, 8, 8) },
    // railways
    { type: 'way', id: 21, tags: { railway: 'rail', bridge: 'yes', layer: '1', name: 'Main Line' }, geometry: [off(-50, -30), off(250, -30)] },
    { type: 'way', id: 22, tags: { railway: 'abandoned' }, geometry: [off(-50, -40), off(250, -40)] },
    { type: 'way', id: 23, tags: { railway: 'platform' }, geometry: rect(0, -35, 100, 3) },
    // roads: steps with incline, one-way street, a zebra crossing way
    { type: 'way', id: 31, tags: { highway: 'steps', incline: 'up' }, geometry: [off(100, 0), off(100, -10)] },
    { type: 'way', id: 32, tags: { highway: 'residential', oneway: 'yes', sidewalk: 'both' }, geometry: [off(0, 0), off(200, 0)] },
    { type: 'way', id: 33, tags: { highway: 'footway', footway: 'crossing', crossing: 'marked', 'crossing:markings': 'zebra' }, geometry: [off(50, -4), off(50, 4)] },
    // shortcut path cutting the south-east corner: from (120,0) on the south side to (200,80) on the east
    // side. Track distance 160 m, path 113 m: saves ~47 m.
    { type: 'way', id: 41, tags: { highway: 'footway' }, geometry: [off(120, 0), off(160, 40), off(200, 80)] },
    // a long diagonal that skips 320 m of an ~790 m lap (40%): that's cheating the lap, not a shortcut
    // (live test 2026-10-15 found paths like this "saving" 900 m at South Bank).
    { type: 'way', id: 43, tags: { highway: 'footway' }, geometry: [off(30, 0), off(115, 85), off(200, 170)] },
    // a path that just runs along the track (not a shortcut)
    { type: 'way', id: 42, tags: { highway: 'footway' }, geometry: [off(0, 205), off(100, 205), off(200, 205)] },
    // fence crossing the track, fence far away
    { type: 'way', id: 51, tags: { barrier: 'fence' }, geometry: [off(195, 150), off(205, 150)] },
    // trees of each type
    node(61, 10, 50, { natural: 'tree', genus: 'Archontophoenix' }),
    node(62, 12, 50, { natural: 'tree', species: 'Corymbia citriodora' }),
    node(63, 14, 50, { natural: 'tree', species: 'Ficus macrophylla', height: '18', diameter_crown: '20' }),
    node(64, 16, 50, { natural: 'tree', genus: 'Araucaria' }),
    node(65, 18, 50, { natural: 'tree', leaf_type: 'broadleaved' }),
    node(66, 20, 50, { natural: 'tree' }),
    // markings
    node(71, 150, 0, { highway: 'crossing', crossing: 'zebra' }),
    node(72, 150, 200, { highway: 'stop' }),
    // a bench on the track and one far away
    node(81, 200, 50, { amenity: 'bench' }),
    node(82, 100, 150, { amenity: 'bench' })
  ];
  const r = lib.buildOutput({ elements: els }, { route: loop, waypoints: loop.slice(0, 4), radius: 300, width: 8, loop: true, snapped: false, name: 't', now: 'X' });
  const out = r.out;
  const B = id => out.buildings.find(b => b.id === id);

  // --- building parts ---
  // Changed in v8.2: parts live in the buildings list with part: true (the layout the game's loader reads).
  const part = out.buildings.find(p => p.id === 'w2');
  check('v8.1 building parts exported (30 levels, starts at level 2)', part && part.part === true && part.height === 90 && part.minHeight === 6, JSON.stringify(part));
  check('v8.1 part knows its parent building, parent knows it has parts', part && part.parent === 'w1' && B('w1').hasParts === true);

  // --- smarter heights ---
  check('v8.1 unmeasured house next to measured ones gets their typical height (estimated)', B('w14').heightSource === 'estimated' && B('w14').height === 6, JSON.stringify([B('w14').height, B('w14').heightSource]));
  check('v8.1 isolated unmeasured house keeps the default guess', B('w15').heightSource === 'default');
  check('v8.1 measured heights are never changed', B('w12').height === 7 && B('w12').heightSource === 'osm');

  // --- roof guesses ---
  check('v8.1 small house gets a guessed hipped roof', B('w14').roofShape === 'hipped' && B('w14').roofShapeSource === 'guess');
  check('v8.1 big building gets a guessed flat roof', B('w16').roofShape === 'flat' && B('w16').roofShapeSource === 'guess');
  check('v8.1 mapped roof shape is kept and marked as mapped', B('w17').roofShape === 'gabled' && B('w17').roofShapeSource === 'osm');

  // --- railways ---
  const rail = out.railways || [];
  check('v8.1 railway lines exported with bridge/layer', rail.length === 1 && rail[0].kind === 'rail' && rail[0].bridge === true && rail[0].layer === 1, JSON.stringify(rail.map(x => x.kind)));
  check('v8.1 abandoned railways are left out', !rail.some(x => x.kind === 'abandoned'));
  check('v8.1 platforms become areas', out.areas.some(a => a.id === 'w23' && a.kind === 'platform'));

  // --- roads: steps, one-way, sidewalks, crossings ---
  const road = id => out.roads.find(x => x.id === id);
  check('v8.1 steps keep their up/down direction', road('w31').incline === 'up');
  check('v8.1 one-way and sidewalks kept', road('w32').oneway === true && road('w32').sidewalk === 'both');
  check('v8.1 crossing path is marked as a zebra', road('w33').crossing === 'zebra');

  // --- trees ---
  const tree = id => out.points.find(p => p.id === id);
  check('v8.1 tree types: palm, eucalypt, fig, conifer, broadleaf',
    tree('n61').treeType === 'palm' && tree('n62').treeType === 'eucalypt' && tree('n63').treeType === 'fig' && tree('n64').treeType === 'conifer' && tree('n65').treeType === 'broadleaf',
    JSON.stringify([61, 62, 63, 64, 65].map(i => tree('n' + i) && tree('n' + i).treeType)));
  check('v8.1 untagged tree has no type (game picks a default)', tree('n66') && !tree('n66').treeType);
  check('v8.1 tree species, height and crown kept', tree('n63').species === 'Ficus macrophylla' && tree('n63').height === 18 && tree('n63').canopy === 20);

  // --- markings ---
  const mk = out.markings || [];
  check('v8.1 zebra crossing node becomes a road marking', mk.some(m => m.kind === 'crossing' && m.style === 'zebra'));
  check('v8.1 crossings are no longer duplicated as props', !out.points.some(p => p.kind === 'crossing'));
  check('v8.1 stop sign gives a stop line marking (sign stays a prop)', mk.some(m => m.kind === 'stop_line') && out.points.some(p => p.kind === 'stop'));

  // --- track flags ---
  check('v8.1 building on the track is flagged', B('w18').onTrack === true && B('w18').trackDist === 0);
  check('v8.1 building away from the track is not flagged, distance correct', !B('w16').onTrack && Math.abs(B('w16').trackDist - 40) < 0.5, B('w16').trackDist);
  check('v8.1 bench on the track flagged, far bench not', tree('n81').onTrack === true && !tree('n82').onTrack && Math.abs(tree('n82').trackDist - 50) < 0.5);
  check('v8.1 fence crossing the track is flagged', out.barriers.find(b => b.id === 'w51').onTrack === true);

  // --- quality report ---
  const q = out.meta.quality;
  const h = q && q.heights;
  check('v8.1 quality report: height shares add up to 100%', h && Math.abs(h.measured + h.estimated + h.default - 100) < 0.6, JSON.stringify(h));
  check('v8.1 quality report names buildings blocking the track', q && q.notes.some(n => /Central Cafes/.test(n)) && q.buildingsOnTrack.includes('w18'), JSON.stringify(q && q.notes));

  // --- smooth track line ---
  const cl = out.route.centerline;
  const gaps = cl.points.slice(1).map((p, i) => Math.hypot(p[0] - cl.points[i][0], p[1] - cl.points[i][1]));
  check('v8.1 smooth track line evenly spaced (2 m)', gaps.every(g => Math.abs(g - cl.spacing) < 0.15), Math.min(...gaps).toFixed(2) + '..' + Math.max(...gaps).toFixed(2));
  check('v8.1 smooth track line closes the loop', Math.hypot(cl.points[0][0] - cl.points.at(-1)[0], cl.points[0][1] - cl.points.at(-1)[1]) <= cl.spacing + 0.15);
  check('v8.1 smoothing rounds corners only slightly (length within 3% of 800 m)', Math.abs(cl.length - 800) / 800 < 0.03, cl.length);
  const corners = out.route.corners || [];
  check('v8.1 square loop has 4 corners of about 90°', corners.length === 4 && corners.every(c => Math.abs(Math.abs(c.angle) - 90) < 15), JSON.stringify(corners.map(c => c.angle)));

  // --- race layout ---
  const race = out.race;
  check('v8.1 checkpoints: 8 evenly spaced, first at the start', race && race.checkpoints.length === 8 && race.checkpoints[0].at === 0 && Math.abs(race.checkpoints[1].at - cl.length / 8) < 1, race && race.checkpoints.map(c => c.at).join(','));
  check('v8.1 start grid: 8 slots behind the start line, inside the track', race && race.grid.length === 8 && race.grid.every(s => s.trackDist <= 4.01 && s.behind > 0), JSON.stringify(race && race.grid.map(s => [s.behind, s.trackDist])));
  const sc = (race && race.shortcuts) || [];
  check('v8.1 shortcut finder finds the corner-cutting path (saves ~45 m)', sc.length >= 1 && sc.some(s => s.via.includes('w41') && s.saving > 30 && s.saving < 60), JSON.stringify(sc.map(s => [s.via, s.saving])));
  check('v8.1 a path that only runs alongside the track is not a shortcut (either direction)', !sc.some(s => s.via.includes('w42')));
  check('v8.2 shortcuts never skip more than a quarter of the lap (max 400 m, min limit 150 m)', sc.every(s => s.skips <= Math.max(150, Math.min(400, cl.length / 4)) + 1), JSON.stringify(sc.map(s => s.skips)));
  check('v8.2 a path skipping 40% of the lap is not offered as a shortcut', !sc.some(s => s.via.includes('w43')));

  // --- guesses are marked ---
  check('v8.1 every building height says where it came from', out.buildings.every(b => ['osm', 'levels', 'estimated', 'default'].includes(b.heightSource)));
  check('v8.1+ generator tag present', /^kart-map-scanner v(8\.\d+|9[a-z]|\d\d+)$/.test(out.meta.generator), out.meta.generator);

  // --- speed: a South-Bank-sized scan must stay quick ---
  const big = [];
  for (let i = 0; i < 1500; i++) { const x = (i % 40) * 12 - 200, y = Math.floor(i / 40) * 12 - 200; big.push({ type: 'way', id: 1000 + i, tags: { building: i % 3 ? 'house' : 'yes', ...(i % 2 ? { 'building:levels': '2' } : {}) }, geometry: rect(x, y, 8, 8) }); }
  for (let i = 0; i < 300; i++) big.push({ type: 'way', id: 5000 + i, tags: { highway: 'footway' }, geometry: [off(i * 3 - 400, -300), off(i * 3 - 400, 500)] });
  for (let i = 0; i < 1200; i++) big.push(node(9000 + i, (i % 60) * 8 - 200, Math.floor(i / 60) * 8 - 50, { amenity: 'bench' }));
  const t0 = Date.now();
  lib.buildOutput({ elements: big }, { route: loop, waypoints: loop.slice(0, 4), radius: 300, width: 8, loop: true, snapped: false, name: 'big', now: 'X' });
  const ms = Date.now() - t0;
  check('v8.1 big scan (1,500 buildings, 300 paths, 1,200 props) processes in under 3 s', ms < 3000, ms + ' ms');
}

// v8.2: the extras from the other session's "kartmap v2", and what the game's Godot loader
// (brisbane-kart, game/scripts/kartmap_scenery.gd) reads.
function runV82(lib, check, same) {
  const la = -27.48, lo = 153.02;
  const off = (dx, dy) => ({ lat: la + dy / 111320, lon: lo + dx / (111320 * Math.cos(la * Math.PI / 180)) });
  const llOff = (dx, dy) => { const o = off(dx, dy); return [o.lat, o.lon]; };
  const rect = (x, y, w, h) => [off(x, y), off(x + w, y), off(x + w, y + h), off(x, y + h), off(x, y)];
  const node = (id, dx, dy, tags) => ({ type: 'node', id, lat: off(dx, dy).lat, lon: off(dx, dy).lon, tags });
  const loop = [llOff(0, 0), llOff(200, 0), llOff(200, 200), llOff(0, 200), llOff(0, 0)];
  const els = [
    { type: 'way', id: 1, tags: { building: 'yes', 'roof:material': 'metal', 'roof:height': '2.5', 'roof:shape': 'gabled' }, geometry: rect(30, 30, 20, 20) },
    { type: 'way', id: 2, tags: { building: 'yes' }, geometry: rect(100, 30, 40, 40) },
    { type: 'way', id: 3, tags: { 'building:part': 'yes', 'building:levels': '20' }, geometry: rect(110, 40, 15, 15) },
    { type: 'way', id: 4, tags: { highway: 'footway', lit: 'yes' }, geometry: [off(0, 50), off(50, 50)] },
    { type: 'way', id: 5, tags: { man_made: 'pier', name: 'Jetty' }, geometry: [off(-20, 100), off(-60, 100)] },
    { type: 'way', id: 6, tags: { barrier: 'wall', colour: 'sandstone', material: 'stone' }, geometry: [off(0, 150), off(30, 150)] },
    { type: 'way', id: 7, tags: { railway: 'light_rail', lit: 'yes' }, geometry: [off(-50, -20), off(250, -20)] },
    node(10, 60, 100, { tourism: 'attraction', attraction: 'big_wheel', name: 'The Wheel of Brisbane' }),
    node(11, 70, 100, { tourism: 'artwork', artwork_type: 'statue', name: 'Mates' }),
    node(12, 80, 100, { amenity: 'cafe', name: 'Some Cafe', wikidata: 'Q1' }),
    node(13, 90, 100, { amenity: 'toilets' }),
    node(14, 95, 100, { amenity: 'parking_meter' }),
    node(15, 99, 100, { leisure: 'playground' }),
    node(16, 10, 60, { natural: 'tree', genus: 'Jacaranda', species: 'Jacaranda mimosifolia', leaf_type: 'broadleaved', leaf_cycle: 'deciduous' }),
    node(17, 12, 60, { natural: 'tree', genus: 'Archontophoenix' })
  ];
  const out = lib.buildOutput({ elements: els }, { route: loop, waypoints: loop.slice(0, 4), radius: 300, width: 8, loop: true, snapped: false, name: 't', now: 'X' }).out;
  const B = id => out.buildings.find(b => b.id === id);
  check('v8.2 roof material and roof height kept', B('w1').roofMaterial === 'metal' && B('w1').roofHeight === 2.5);
  check('v8.2 street lighting kept on paths and railways', out.roads.find(r => r.id === 'w4').lit === true && out.railways.find(r => r.id === 'w7').lit === true);
  const pier = out.roads.find(r => r.id === 'w5');
  check('v8.2 piers come in as walkable paths (4 m default width)', pier && pier.kind === 'pier' && pier.width === 4 && pier.widthSource === 'default');
  check('v8.2 fence/wall colour kept', out.barriers.find(b => b.id === 'w6').colour === 'sandstone');
  const tree = id => out.points.find(p => p.id === id);
  check('v8.2 tree genus, species, leaf type and leaf cycle kept separately',
    tree('n16').genus === 'Jacaranda' && tree('n16').species === 'Jacaranda mimosifolia' && tree('n16').leafType === 'broadleaved' && tree('n16').leafCycle === 'deciduous', JSON.stringify(tree('n16')));
  check('v8.2 genus-only tree still typed (palm)', tree('n17').genus === 'Archontophoenix' && tree('n17').treeType === 'palm' && !tree('n17').species);
  check('v8.2 artwork props say what kind of artwork', tree('n11').kind === 'artwork' && tree('n11').artworkType === 'statue');
  const lm = name => out.landmarks.find(l => l.name === name);
  check('v8.2 Wheel of Brisbane landmark kind is big_wheel (the loader builds a Ferris wheel for it)', lm('The Wheel of Brisbane') && lm('The Wheel of Brisbane').kind === 'big_wheel');
  check('v8.2 artwork landmark kind is its artwork type (statue)', lm('Mates') && lm('Mates').kind === 'statue');
  check('v8.2 cafés, toilets, parking meters, playgrounds are props again (the loader draws them)',
    ['cafe', 'toilets', 'parking_meter', 'playground'].every(k => out.points.some(p => p.kind === k)));
  check('v8.2 a café is still never a landmark', !lm('Some Cafe'));
  // live test 2026-10-15: a huge venue came through twice (as a building and as an area ~100+ m apart)
  const dup = lib.buildOutput({ elements: [
    { type: 'way', id: 901, tags: { building: 'yes', name: 'Big Venue', amenity: 'conference_centre' }, geometry: rect(0, 300, 120, 80) },
    { type: 'way', id: 902, tags: { amenity: 'conference_centre', name: 'Big Venue' }, geometry: rect(150, 300, 200, 150) }
  ] }, { route: loop, waypoints: loop.slice(0, 4), radius: 300, width: 8, loop: true, snapped: false, name: 't', now: 'X' }).out;
  check('v8.2 the same landmark name within 300 m counts once (building version kept)', dup.landmarks.filter(l => l.name === 'Big Venue').length === 1 && dup.landmarks.find(l => l.name === 'Big Venue').ref === 'w901', JSON.stringify(dup.landmarks.map(l => [l.name, l.ref])));
  const part = B('w3');
  check('v8.2 building parts sit in the buildings list with part: true', part && part.part === true && part.parent === 'w2' && B('w2').hasParts === true && !('buildingParts' in out));
  check('v8.2 parts are left out of the quality height percentages', out.meta.quality.heights.measured + out.meta.quality.heights.estimated + out.meta.quality.heights.default > 99.4);
  check('v8.2 file says format version 2', out.version === 2);
  const problems = lib.loaderContractProblems(out);
  check('v8.2 file meets everything the game loader reads (contract check)', problems.length === 0, problems.join('; '));
  // the contract check must actually catch problems
  const broken = JSON.parse(JSON.stringify(out));
  broken.buildings.find(b => b.id === 'w2').hasParts = true; broken.buildings = broken.buildings.filter(b => !b.part);
  broken.landmarks[0].pos = undefined;
  check('v8.2 contract check catches a building whose parts are missing, and a landmark with no position', lib.loaderContractProblems(broken).length >= 2);
}

// v8.3: Overture fill-in, aerial colours, ground image, landmark photos.
function runV83(lib, check, same) {
  const la = -27.61, lo = 153.13;
  const off = (dx, dy) => ({ lat: la + dy / 111320, lon: lo + dx / (111320 * Math.cos(la * Math.PI / 180)) });
  const llOff = (dx, dy) => { const o = off(dx, dy); return [o.lat, o.lon]; };
  const rect = (x, y, w, h) => [off(x, y), off(x + w, y), off(x + w, y + h), off(x, y + h), off(x, y)];
  const ringLL = (x, y, w, h) => rect(x, y, w, h).map(g => [g.lat, g.lon]);
  const loop = [llOff(0, 0), llOff(200, 0), llOff(200, 200), llOff(0, 200), llOff(0, 0)];
  const osm = { elements: [
    { type: 'way', id: 101, tags: { building: 'house' }, geometry: rect(20, 20, 10, 10) },                       // no height in OSM
    { type: 'way', id: 102, tags: { building: 'house', 'building:levels': '2' }, geometry: rect(40, 20, 10, 10) }, // has levels
    { type: 'way', id: 103, tags: { building: 'house' }, geometry: rect(60, 20, 10, 10) }                          // no height, no Overture match
  ] };
  const ov = [
    { id: 'o1', osmId: 'w101', height: 4.4, heightFrom: 'Microsoft ML Buildings', ring: ringLL(20, 20, 10, 10) },   // fills w101
    { id: 'o2', osmId: 'w102', height: 9.9, heightFrom: 'OpenStreetMap', ring: ringLL(40, 20, 10, 10) },            // must NOT override levels
    { id: 'o3', osmId: null, height: 3.9, heightFrom: 'Microsoft ML Buildings', cls: 'house', ring: ringLL(100, 100, 12, 9) }, // new building
    { id: 'o4', osmId: null, height: 5, heightFrom: 'Microsoft ML Buildings', ring: ringLL(61, 21, 8, 8) },         // overlaps w103: skip
    { id: 'o5', osmId: null, height: 3, heightFrom: 'Microsoft ML Buildings', isUnderground: true, ring: ringLL(150, 150, 10, 10) } // underground: skip
  ];
  const m = lib.mergeOverture(osm, ov);
  check('v8.3 Overture merge reports what it did (1 height filled, 1 building added, 2 skipped)', m.stats.heightsFilled === 1 && m.stats.added === 1 && m.stats.skipped === 2, JSON.stringify(m.stats));
  check('v8.3 Overture merge never changes the original scan data', !osm.elements[0].tags['overture:height'] && osm.elements.length === 3);
  const out = lib.buildOutput(m.data, { route: loop, waypoints: loop.slice(0, 4), radius: 300, width: 8, loop: true, snapped: false, name: 't', now: 'X' }).out;
  const B = id => out.buildings.find(b => b.id === id);
  check('v8.3 missing OSM height filled from Overture, labelled as a machine estimate', B('w101').height === 4.4 && B('w101').heightSource === 'ml-estimate', JSON.stringify(B('w101')));
  check('v8.3 mapped floors are never replaced by Overture', B('w102').height === 6 && B('w102').heightSource === 'levels');
  const added = out.buildings.find(b => b.id === 'ov-o3');
  check('v8.3 building missing from OSM added from Overture, with its estimated height', added && added.height === 3.9 && added.heightSource === 'ml-estimate' && added.kind === 'house' && added.source === 'overture', JSON.stringify(added));
  check('v8.3 overlapping and underground Overture buildings are not added', !out.buildings.some(b => b.id === 'ov-o4' || b.id === 'ov-o5'));
  check('v8.3 Overture heights from OSM are labelled overture, counted as measured',
    lib.buildOutput(lib.mergeOverture({ elements: [osm.elements[0]] }, [{ id: 'x', osmId: 'w101', height: 7, heightFrom: 'OpenStreetMap', ring: ringLL(20, 20, 10, 10) }]).data,
      { route: loop, waypoints: [], radius: 300, width: 8, loop: true, snapped: false, name: 't', now: 'X' }).out.buildings[0].heightSource === 'overture');
  check('v8.3 quality report counts machine estimates as estimated, not measured', out.meta.quality.heights.estimated > 0);
  check('v8.3 Overture credit added when used', /Overture/.test(lib.attributionFor({ overture: true, imagery: false })) && /OpenStreetMap/.test(lib.attributionFor({})));
  const f = lib.overtureFeature({ id: 'abc', height: 4.2, '@height_source': 'Microsoft ML Buildings', sources: '[{"dataset":"OpenStreetMap","record_id":"w584365517@2"}]', class: 'house' }, [[[153.1, -27.6], [153.1001, -27.6], [153.1001, -27.6001], [153.1, -27.6]]]);
  check('v8.3 Overture tile feature read correctly (OSM id from record_id, ring in lat/lon)', f.osmId === 'w584365517' && f.height === 4.2 && f.heightFrom === 'Microsoft ML Buildings' && f.ring[0][0] === -27.6 && f.ring[0][1] === 153.1 && f.cls === 'house', JSON.stringify(f));
  // Real South Bank tile shape: "@height_source" says OpenStreetMap, but the height entry in sources is Microsoft's ML model.
  const f2 = lib.overtureFeature({ id: 'd', height: 4.343635559082031, '@height_source': 'OpenStreetMap', '@geometry_source': 'OpenStreetMap',
    sources: '[{"dataset":"OpenStreetMap","record_id":"w103130220@3","property":""},{"dataset":"Microsoft ML Buildings","property":"/properties/height"}]' }, [[[153.1, -27.6], [153.1001, -27.6], [153.1001, -27.6001], [153.1, -27.6]]]);
  const f3 = lib.overtureFeature({ id: 'e', height: 60, '@height_source': 'OpenStreetMap', sources: '[{"dataset":"OpenStreetMap","record_id":"w26253751@6","property":""}]' }, [[[153.1, -27.6], [153.1001, -27.6], [153.1001, -27.6001], [153.1, -27.6]]]);
  check('v8.3 live-test fix: an ML height is labelled ML even when @height_source says OpenStreetMap', f2.heightFrom === 'Microsoft ML Buildings' && f2.osmId === 'w103130220' && f3.heightFrom === 'OpenStreetMap', f2.heightFrom + ' / ' + f3.heightFrom);

  const ranked = lib.rankNearbyPhotos('Streets Beach', [{ title: 'File:Brisbane river.jpg', dist: 10 }, { title: 'File:Map.svg', dist: 5 }, { title: 'File:Streets Beach lagoon.jpg', dist: 80 }, { title: 'File:Ferry.JPG', dist: 40 }]);
  check('v8.3 live-test fix: nearby photos naming the landmark come first, then nearest; no maps/svg', JSON.stringify(ranked) === JSON.stringify(['File:Streets Beach lagoon.jpg', 'File:Brisbane river.jpg', 'File:Ferry.JPG']), JSON.stringify(ranked));

  // --- aerial colours ---
  const tiles = lib.planImageTiles({ south: -27.49, west: 153.01, north: -27.47, east: 153.04 }, 1.0, 4096, 2048);
  const cover = tiles.every(t => t.width <= 4096 && t.height <= 2048) &&
    Math.min(...tiles.map(t => t.west)) <= 153.01 && Math.max(...tiles.map(t => t.east)) >= 153.04 && Math.min(...tiles.map(t => t.south)) <= -27.49 && Math.max(...tiles.map(t => t.north)) >= -27.47;
  check('v8.3 aerial image requests stay within the server limit and cover the whole area', cover && tiles.length >= 1 && tiles.length <= 4, JSON.stringify(tiles.map(t => [t.width, t.height])));
  // Live-test fix: the server keeps pixels square in degrees, so each tile's box must match its size exactly.
  const sq = tiles.every(t => Math.abs((t.east - t.west) / t.width - (t.north - t.south) / t.height) < 1e-12);
  check('v8.3 live-test fix: every aerial tile has square pixels in degrees (server would stretch it otherwise)', sq, JSON.stringify(tiles[0]));
  // a fake 100x100 aerial image: left half red roof colour, right half green; a building on the left half
  const W = 100, H = 100, data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (x < 50) { data[i] = 180 + (x % 3); data[i + 1] = 60; data[i + 2] = 50; } else { data[i] = 70; data[i + 1] = 140; data[i + 2] = 60; } data[i + 3] = 255; }
  const tile = { south: -27.611, west: 153.129, north: -27.609, east: 153.131 };
  const midLon = (tile.west + tile.east) / 2;
  const leftPoly = [[-27.6105, 153.1292], [-27.6105, midLon - 0.0002], [-27.6095, midLon - 0.0002], [-27.6095, 153.1292]];
  const c = lib.medianColourInPolygon({ width: W, height: H, data }, tile, leftPoly);
  check('v8.3 roof colour sampled from inside the building outline (median of the pixels)', c && c.hex === '#b53c32' && c.n >= 4, JSON.stringify(c));
  check('v8.3 no colour when the outline is outside the image', lib.medianColourInPolygon({ width: W, height: H, data }, tile, [[-27.0, 153.0], [-27.0, 153.001], [-27.001, 153.001]]) === null);
  const outC = JSON.parse(JSON.stringify(out));
  const n = lib.applyColourSamples(outC, [{ box: tile, image: { width: W, height: H, data } }], (lat0, lon0) => lib.makeUnprojector(lat0, lon0));
  check('v8.3 sampled colours stored separately from mapped ones (sampledRoofColour), with credit', typeof n.buildings === 'number' && outC.meta.imagery && /State of Queensland/.test(outC.meta.imagery.attribution) && /CC BY-SA/.test(outC.meta.imagery.licence));

  // --- ground image ---
  const plan = lib.groundImagePlan(out.meta.bbox, 1.0, 4096);
  check('v8.3 ground image plan: size from the area, capped at 4096 px, south-west corner recorded', plan.width <= 4096 && plan.height <= 4096 && plan.width >= 1 && plan.metresPerPixel >= 1 && plan.minX === out.meta.bbox.minX, JSON.stringify(plan));
  check('v8.3 ground colours: water blue, grass green, unknown falls back to ground', lib.groundColour('water') !== lib.groundColour('grass') && lib.groundColour('nothing-like-this') === lib.groundColour('ground'));
  const order = ['residential', 'park', 'grass', 'swimming_pool'].sort((a, b) => lib.groundDrawOrder(a) - lib.groundDrawOrder(b));
  check('v8.3 ground image draws zoning first, then parks/grass, then water on top', order[0] === 'residential' && order.at(-1) === 'swimming_pool', order.join(','));

  // --- landmark photos ---
  const ph = lib.parseCommonsImageInfo({ query: { pages: { 1: { title: 'File:Wheel.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/thumb/w.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Wheel.jpg', extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<a href="x">Jane Doe</a>' } } }] } } } });
  check('v8.3 landmark photo info read with licence and author (HTML stripped)', ph.length === 1 && ph[0].licence === 'CC BY-SA 4.0' && ph[0].author === 'Jane Doe' && /^https:/.test(ph[0].thumb), JSON.stringify(ph));
  check('v8.3 file stays loader-compatible after all v8.3 additions', lib.loaderContractProblems(outC).length === 0, lib.loaderContractProblems(outC).join('; '));
}

if (typeof module !== 'undefined') module.exports = { runScannerTests };

function runV9a(lib, check, same) {
  const la = -27.52, lo = 153.05;
  const off = (dx, dy) => ({ lat: la + dy / 111320, lon: lo + dx / (111320 * Math.cos(la * Math.PI / 180)) });
  const llOff = (dx, dy) => { const o = off(dx, dy); return [o.lat, o.lon]; };
  const rect = (x, y, w, h) => [off(x, y), off(x + w, y), off(x + w, y + h), off(x, y + h), off(x, y)];
  const loop = [llOff(0, 0), llOff(200, 0), llOff(200, 200), llOff(0, 200), llOff(0, 0)];
  const near = (a, b, m) => lib.dist(a, b) < m;

  // --- direction and start ---
  const rev = lib.orientRoute(loop, { reverse: true, loop: true });
  check('v9a reverse flips the route order', near(rev[1], llOff(0, 200), 0.01) && near(rev[3], llOff(200, 0), 0.01));
  const L0 = lib.routeLength(loop);
  const rot = lib.orientRoute(loop, { loop: true, start: llOff(203, 120) });   // 3 m off the east side, 120 m up
  check('v9a start moves to the nearest point on the loop (snapped onto the line)', near(rot[0], llOff(200, 120), 0.05), JSON.stringify(rot[0]));
  check('v9a moved-start loop is closed and the same length', near(rot[0], rot.at(-1), 0.01) && Math.abs(lib.routeLength(rot) - L0) < 0.05, lib.routeLength(rot) + ' vs ' + L0);
  check('v9a moved start keeps the drawing direction (next corner is the NE one)', near(rot[1], llOff(200, 200), 0.01));
  const both = lib.orientRoute(loop, { loop: true, reverse: true, start: llOff(203, 120) });
  check('v9a reverse + start: same start, other way round (next corner is the SE one)', near(both[0], llOff(200, 120), 0.05) && near(both[1], llOff(200, 0), 0.01));
  const line = [llOff(0, 0), llOff(100, 0), llOff(100, 100)];
  check('v9a not a loop: start is ignored, reverse still works', same(lib.orientRoute(line, { loop: false, start: llOff(100, 50) }), line) && near(lib.orientRoute(line, { reverse: true })[0], llOff(100, 100), 0.01));
  check('v9a orientRoute leaves its input alone', near(loop[0], llOff(0, 0), 0.001) && loop.length === 5);
  const arrows = lib.arrowsAlong(loop, 100);
  check('v9a direction arrows every 100 m with the right heading (east = 90°, north = 0°)', arrows.length === 8 && Math.abs(arrows[0].bearing - 90) <= 1 && Math.abs(arrows[2].bearing - 0) <= 1 && Math.abs(arrows[4].bearing - 270) <= 1, JSON.stringify(arrows.map(a => a.bearing)));

  // the race layout follows the oriented route
  const data = { elements: [{ type: 'way', id: 1, tags: { highway: 'residential' }, geometry: loop.map(p => ({ lat: p[0], lon: p[1] })) }] };
  const base = { waypoints: loop.slice(0, 4), radius: 100, width: 8, loop: true, snapped: false, name: 't', now: 'X' };
  const a = lib.buildOutput(data, { ...base, route: loop }).out;
  const b = lib.buildOutput(data, { ...base, route: lib.orientRoute(loop, { loop: true, reverse: true, start: llOff(203, 120) }), reverse: true, start: llOff(200, 120) }).out;
  const P = lib.makeProjector(b.meta.origin.lat, b.meta.origin.lon);
  check('v9a export records the race settings', b.route.reversed === true && Array.isArray(b.route.startPoint) && a.route.reversed === false && !('startPoint' in JSON.parse(JSON.stringify(a.route))));
  check('v9a start line sits at the picked start', b.race && Math.hypot(b.race.startLine.pos[0], b.race.startLine.pos[1]) < 3, b.race && JSON.stringify(b.race.startLine.pos));
  check('v9a reversed race heads the other way (south along the east side)', b.race && b.race.startLine.dir[1] < -0.9, b.race && JSON.stringify(b.race.startLine.dir));
  check('v9a waypoints stay as drawn (so the route reloads unchanged)', same(b.route.waypoints, loop.slice(0, 4)));

  // --- hand-drawn buildings ---
  const ring = rect(50, 50, 20, 10).slice(0, 4).map(g => [g.lat, g.lon]);
  const fin = lib.withManualExtras(a, [], [{ ring, height: 7.5, name: 'Kiosk' }, { ring: ring.slice(0, 2), height: 5 }, { ring, height: 0 }]);
  const mb = fin.buildings.filter(x => x.source === 'manual');
  const Pa = lib.makeProjector(a.meta.origin.lat, a.meta.origin.lon);
  check('v9a drawn building exported (bad ones skipped), labelled manual', mb.length === 1 && mb[0].id === 'mb1' && mb[0].heightSource === 'manual' && mb[0].height === 7.5 && mb[0].name === 'Kiosk' && fin.meta.counts.manualBuildings === 1);
  check('v9a drawn building footprint in metres, open ring', mb[0].footprint.length === 4 && Math.abs(mb[0].footprint[0][0] - Pa(ring[0][0], ring[0][1])[0]) < 0.01);
  check('v9a drawn buildings kept for reloading; scan result untouched', fin.manualBuildings.length === 3 && a.buildings.every(x => x.source !== 'manual') && !('manualBuildings' in a));
  check('v9a file with drawn buildings passes the game-loader check', lib.loaderContractProblems(fin).length === 0, JSON.stringify(lib.loaderContractProblems(fin)));
  check('v9a manual trees still work alongside', lib.withManualExtras(a, [{ lat: la, lon: lo, canopy: 9 }], []).meta.counts.manualTrees === 1);

  // --- library ---
  let lib1 = lib.libraryUpsert([], { name: 'a', waypoints: [] });
  lib1 = lib.libraryUpsert(lib1, { name: 'b', waypoints: [] });
  lib1 = lib.libraryUpsert(lib1, { name: 'a', waypoints: [[1, 2]] });
  check('v9a library: same name replaces, newest first', lib1.length === 2 && lib1[0].name === 'a' && lib1[0].waypoints.length === 1);
  check('v9a library: delete by name', same(lib.libraryRemove(lib1, 'a').map(x => x.name), ['b']));
  let err = ''; try { lib.readLibraryBackup({ format: 'kartmap' }); } catch (e) { err = e.message; }
  let err2 = ''; try { lib.readLibraryBackup({ format: 'kartmap-library', version: 99, tracks: [] }); } catch (e) { err2 = e.message; }
  check('v9a library backup: wrong file and newer version give plain errors', /not a track library/.test(err) && /newer scanner/.test(err2));
  const merged = lib.libraryMerge([{ name: 'a', waypoints: [] }, { name: 'c', waypoints: [] }], lib.readLibraryBackup({ format: 'kartmap-library', version: 1, tracks: [{ name: 'a', waypoints: [[9, 9]] }, { name: 'x', waypoints: [] }, { bad: 1 }] }).tracks);
  check('v9a library restore: merges, backup wins on same name, junk skipped', merged.length === 3 && merged.find(x => x.name === 'a').waypoints.length === 1 && merged.some(x => x.name === 'x'));
}

function runV9b(lib, check, same) {
  const la = -27.5, lo = 153.0;
  const off = (dx, dy) => ({ lat: la + dy / 111320, lon: lo + dx / (111320 * Math.cos(la * Math.PI / 180)) });
  const llOff = (dx, dy) => { const o = off(dx, dy); return [o.lat, o.lon]; };
  const rect = (x, y, w, h) => [off(x, y), off(x + w, y), off(x + w, y + h), off(x, y + h), off(x, y)];
  const route = [llOff(0, 0), llOff(300, 0)];
  const data = { elements: [
    { type: 'way', id: 1, tags: { building: 'yes' }, geometry: rect(200, -5, 10, 10) },          // across the track, 205 m out
    { type: 'way', id: 2, tags: { barrier: 'fence' }, geometry: [off(100, -10), off(100, 10)] },   // crosses at 100 m
    { type: 'node', id: 3, lat: off(50, 1).lat, lon: off(50, 1).lon, tags: { amenity: 'bench' } }, // on the track at 50 m
    { type: 'way', id: 4, tags: { building: 'yes' }, geometry: rect(150, 40, 10, 10) }            // well clear
  ] };
  const { preview } = lib.buildOutput(data, { route, waypoints: route, radius: 100, width: 8, loop: false, snapped: false, name: 't', now: 'X' });
  const ps = lib.problemSpots(preview);
  check('v9b problem list: building, fence and bench on the track, nothing else', ps.length === 3, JSON.stringify(ps));
  check('v9b problems are ordered nearest the start first, with plain labels', ps.length === 3 && /bench on the track/.test(ps[0].label) && /Fence or wall/.test(ps[1].label) && /Building blocking/.test(ps[2].label));
  check('v9b problem spots sit where the things are', ps.length === 3 && Math.abs(ps[0].xy[0] - 50) < 1 && Math.abs(ps[2].xy[0] - 205) < 1, JSON.stringify(ps.map(p => p.xy)));
  check('v9b no problems = empty list', lib.problemSpots([]).length === 0 && lib.problemSpots(null).length === 0);
}

