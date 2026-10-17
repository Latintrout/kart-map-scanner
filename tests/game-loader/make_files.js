// Builds a made-up South-Bank-like scan with one or more scanner versions and writes a kartmap
// track folder for each, ready for the game's loader (see README.md).
//   node make_files.js <game>/game/tracks scan_ci=path/to/index.html [scan_old=older.html ...]
// Each scanner's extras (Overture, colours, reverse/start, drawn buildings, heights, minimap...)
// are used when that version has them, so one file exercises everything the version exports.
const fs = require('fs');
function lib(file) {
  const html = fs.readFileSync(file, 'utf8');
  const s = html.indexOf('// PURE-START'), e = html.indexOf('// PURE-END');
  const code = html.slice(html.lastIndexOf('\n', s), e);
  const names = [...code.matchAll(/^function\s+([A-Za-z0-9_]+)/gm)].map(m => m[1]);
  return new Function(code + '\nreturn {' + names.join(',') + '};')();
}
const la = -27.478, lo = 153.022;
const off = (dx, dy) => ({ lat: la + dy / 111320, lon: lo + dx / (111320 * Math.cos(la * Math.PI / 180)) });
const ll = (dx, dy) => { const o = off(dx, dy); return [o.lat, o.lon]; };
const rect = (x, y, w, h) => [off(x, y), off(x + w, y), off(x + w, y + h), off(x, y + h), off(x, y)];
let id = 1; const W = (tags, geometry) => ({ type: 'way', id: id++, tags, geometry }); const N = (dx, dy, tags) => ({ type: 'node', id: id++, lat: off(dx, dy).lat, lon: off(dx, dy).lon, tags });
const els = [];
// route: 300 x 200 m loop; the route roads
const route = [ll(0, 0), ll(300, 0), ll(300, 200), ll(0, 200), ll(0, 0)];
els.push(W({ highway: 'residential', name: 'Grey St' }, [off(0, 0), off(300, 0)]));
els.push(W({ highway: 'residential' }, [off(300, 0), off(300, 200)]));
els.push(W({ highway: 'footway', surface: 'paving_stones', lit: 'yes' }, [off(300, 200), off(0, 200)]));
els.push(W({ highway: 'footway', bridge: 'yes', layer: '1', name: 'Goodwill Bridge' }, [off(0, 200), off(0, 0)]));
// podium + tower (parts), near the track
els.push(W({ building: 'yes', 'building:levels': '3', name: 'Tower Podium' }, rect(40, 20, 50, 40)));
els.push(W({ 'building:part': 'yes', 'building:levels': '3' }, rect(40, 20, 50, 40)));
els.push(W({ 'building:part': 'yes', 'building:levels': '28', 'building:min_level': '3', 'building:colour': '#cfd8dc', 'roof:shape': 'flat' }, rect(55, 30, 20, 20)));
// a block of houses, some measured
for (let i = 0; i < 12; i++) els.push(W(i % 3 ? { building: 'house' } : { building: 'house', 'building:levels': '2', 'roof:material': 'metal', 'roof:colour': 'red' }, rect(120 + (i % 6) * 22, 30 + Math.floor(i / 6) * 25, 12, 12)));
// big commercial, far town
for (let i = 0; i < 20; i++) els.push(W({ building: i % 2 ? 'commercial' : 'yes' }, rect(-200 + (i % 5) * 40, -180 + Math.floor(i / 5) * 40, 25, 25)));
// a building on the track
els.push(W({ building: 'retail', name: 'Central Cafes' }, rect(296, 100, 8, 8)));
// pool with island (multipolygon), beach, park
const pool = rect(120, 110, 80, 50);
els.push({ type: 'relation', id: id++, tags: { leisure: 'swimming_pool', type: 'multipolygon' }, members: [{ type: 'way', role: 'outer', geometry: pool }, { type: 'way', role: 'inner', geometry: rect(150, 125, 15, 15) }] });
els.push(W({ natural: 'beach', surface: 'sand' }, rect(120, 160, 80, 15)));
els.push(W({ leisure: 'park', name: 'South Bank Parklands' }, rect(100, 90, 150, 100)));
// fences, wall, railway, pier, shortcut path
els.push(W({ barrier: 'fence', height: '1.5' }, [off(100, 85), off(250, 85)]));
els.push(W({ barrier: 'wall', colour: 'sandstone', material: 'stone' }, [off(260, 20), off(260, 180)]));
els.push(W({ railway: 'rail', electrified: 'contact_line', lit: 'yes' }, [off(-100, -40), off(400, -40)]));
els.push(W({ man_made: 'pier', name: 'Jetty' }, [off(150, 205), off(150, 260)]));
els.push(W({ highway: 'footway' }, [off(40, 0), off(150, 90), off(300, 140)]));
// landmarks and props
els.push(N(210, 70, { tourism: 'attraction', attraction: 'big_wheel', name: 'The Wheel of Brisbane' }));
els.push(N(20, 60, { tourism: 'artwork', artwork_type: 'statue', name: 'Mates' }));
els.push(N(20, 140, { tourism: 'artwork', artwork_type: 'sculpture', name: 'Offshoot' }));
for (let i = 0; i < 6; i++) els.push(N(20 + i * 40, 12, { amenity: i % 2 ? 'bench' : 'cafe', name: i % 2 ? undefined : 'Cafe ' + i }));
els.push(N(240, 12, { amenity: 'toilets' }), N(250, 12, { amenity: 'parking_meter' }), N(260, 12, { highway: 'street_lamp' }), N(270, 12, { amenity: 'drinking_water' }));
els.push(N(150, 0, { highway: 'crossing', crossing: 'zebra' }), N(300, 60, { highway: 'stop' }));
for (let i = 0; i < 15; i++) els.push(N(15 + i * 18, 190, { natural: 'tree', ...(i % 3 === 0 ? { genus: 'Archontophoenix' } : i % 3 === 1 ? { genus: 'Jacaranda', species: 'Jacaranda mimosifolia', leaf_type: 'broadleaved' } : {}) }));
els.push(N(150, 3, { natural: 'tree', genus: 'Ficus' }));   // a tree in the road
const data = { elements: els.map(e => { if (e.tags) for (const k of Object.keys(e.tags)) if (e.tags[k] === undefined) delete e.tags[k]; return e; }) };
const [tracksDir, ...jobs] = process.argv.slice(2);
if (!tracksDir || !jobs.length) { console.error('usage: node make_files.js <tracks dir> <folder>=<scanner.html> ...'); process.exit(2); }
for (const job of jobs) {
  const [folder, file] = job.split('=');
  const L = lib(file);
  let input = data, overture;
  if (L.mergeOverture) {
    // Overture: a height for an unmeasured house (OSM way 7), plus two buildings OSM doesn't have.
    const ring = (x, y, w, h) => rect(x, y, w, h).map(o => [o.lat, o.lon]);
    const m = L.mergeOverture(data, [
      { id: 'a', osmId: 'w7', height: 5.2, heightFrom: 'Microsoft ML Buildings', ring: ring(142, 30, 12, 12) },
      { id: 'b', osmId: null, height: 11, heightFrom: 'Microsoft ML Buildings', ring: ring(-60, 240, 18, 14) },
      { id: 'c', osmId: null, height: null, heightFrom: null, ring: ring(-90, 240, 10, 10) }]);
    input = m.data; overture = { release: '2026-09-23.1', ...m.stats };
  }
  let raceRoute = route, raceExtra = {};
  if (L.orientRoute) {   // reversed, start moved to the middle of the east side
    raceRoute = L.orientRoute(route, { loop: true, reverse: true, start: ll(303, 100) });
    raceExtra = { reverse: true, start: raceRoute[0] };
  }
  let { out } = L.buildOutput(input, { overture, ...raceExtra, route: raceRoute, waypoints: route.slice(0, 4), radius: 300, width: 8, loop: true, snapped: true, name: 'harness ' + folder, now: '2026-10-15T00:00:00Z' });
  if (L.withManualExtras)
    out = L.withManualExtras(out, [{ lat: ll(10, 100)[0], lon: ll(10, 100)[1], canopy: 8 }], [{ ring: [ll(-40, 60), ll(-20, 60), ll(-20, 80), ll(-40, 80)], height: 9, name: 'Drawn kiosk' }]);
  if (L.applyColourSamples) {
    // aerial colours from a fake all-terracotta photo covering everything, plus a landmark photo
    const W = 2048, H = 2048, px = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < px.length; i += 4) px.set([176, 58, 46, 255], i);
    L.applyColourSamples(out, [{ box: { south: la - 0.01, north: la + 0.01, west: lo - 0.01, east: lo + 0.01 }, image: { width: W, height: H, data: px } }], L.makeUnprojector, { metresPerPixel: 1 });
    if (out.landmarks[0]) { out.landmarks[0].photos = [{ file: 'File:x.jpg', thumb: 'https://upload.wikimedia.org/x.jpg', page: 'https://commons.wikimedia.org/wiki/File:x.jpg', licence: 'CC BY-SA 4.0', author: 'Someone' }]; out.landmarks[0].photosFrom = 'wikidata'; }
    out.meta.groundImage = { file: 'kartmap_harness_ground.png', ...L.groundImagePlan(out.meta.bbox, 1, 4096), colours: 'aerial (sampled)' };
  }
  let terrain = null;
  if (L.applyElevation) {
    // ground heights from a fake terrain: a 6 m rise to the east plus a 4 m dip (a "river") under the bridge on the west side
    const W = 400, H = 400, d = new Float32Array(W * H);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const x = (c - 200) * 2.5, y = (200 - r) * 2.5; d[r * W + c] = 5 + c * 0.04 - (Math.abs(x) < 15 && y > 40 && y < 160 ? 4 : 0); }
    const grids = [{ box: { south: la - 0.0045, north: la + 0.0045, west: lo - 0.0057, east: lo + 0.0057 }, width: W, height: H, data: d }];
    L.applyElevation(out, grids, L.makeUnprojector, { metresPerSample: 2 });
    if (L.terrainFile) { terrain = L.terrainFile(out, grids, L.makeUnprojector, 4); out.meta.elevation.terrainFile = 'kartmap_harness_terrain.json'; out.meta.elevation.terrainSpacing = 4; }
  }
  if (L.minimapPlan) out.meta.minimap = { file: 'kartmap_harness_minimap.png', size: 256, metresPerPixel: 2, minX: 0, maxY: 0 };
  const dir = tracksDir + '/' + folder;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + '/kartmap_harness_2026-10-15.json', L.prettyJSON(out));
  if (terrain) fs.writeFileSync(dir + '/kartmap_harness_terrain.json', JSON.stringify(terrain));
  const problems = L.loaderContractProblems ? L.loaderContractProblems(out) : [];
  console.log(folder, '|', out.meta.generator || 'scanner', '| version', out.version, '| buildings', out.buildings.length, '| landmarks', (out.landmarks || []).map(l => l.kind).join(','),
    '| heights', out.meta.elevation ? 'yes' : 'no', '| contract problems', JSON.stringify(problems));
  if (problems.length) process.exitCode = 1;
}
