// Builds the same made-up South-Bank-like scan with v8.1 and v8.2 and writes both kartmap files.
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
for (const [ver, file] of [['v8.1', '/home/claude/kart-map-scanner-v8.1.html'], ['v8.2', '/home/claude/kart-map-scanner-v8.2.html'], ['v8.3', '/home/claude/kart-map-scanner-v8.3.html'], ['v9a', '/home/claude/kart-map-scanner-v9a.html']]) {
  const L = lib(file);
  let input = data, overture;
  if (ver === 'v8.3') {
    // Overture: a height for an unmeasured house (OSM way 7), plus two buildings OSM doesn't have.
    const ring = (x, y, w, h) => rect(x, y, w, h).map(o => [o.lat, o.lon]);
    const m = L.mergeOverture(data, [
      { id: 'a', osmId: 'w7', height: 5.2, heightFrom: 'Microsoft ML Buildings', ring: ring(142, 30, 12, 12) },
      { id: 'b', osmId: null, height: 11, heightFrom: 'Microsoft ML Buildings', ring: ring(-60, 240, 18, 14) },
      { id: 'c', osmId: null, height: null, heightFrom: null, ring: ring(-90, 240, 10, 10) }]);
    input = m.data; overture = { release: '2026-09-23.1', ...m.stats };
    console.log('overture stats', JSON.stringify(m.stats));
  }
  let raceRoute = route, raceExtra = {};
  if (ver === 'v9a') {   // reversed, start moved to the middle of the east side
    raceRoute = L.orientRoute(route, { loop: true, reverse: true, start: ll(303, 100) });
    raceExtra = { reverse: true, start: raceRoute[0] };
  }
  let { out } = L.buildOutput(input, { overture, ...raceExtra, route: raceRoute, waypoints: route.slice(0, 4), radius: 300, width: 8, loop: true, snapped: true, name: 'harness ' + ver, now: '2026-10-15T00:00:00Z' });
  if (ver === 'v9a') {
    out = L.withManualExtras(out, [{ lat: ll(10, 100)[0], lon: ll(10, 100)[1], canopy: 8 }], [{ ring: [ll(-40, 60), ll(-20, 60), ll(-20, 80), ll(-40, 80)], height: 9, name: 'Drawn kiosk' }]);
    console.log('v9a start line', JSON.stringify(out.race.startLine.pos), 'dir', JSON.stringify(out.race.startLine.dir), 'contract', JSON.stringify(L.loaderContractProblems(out)));
  }
  if (ver === 'v8.3') {
    // aerial colours from a fake all-terracotta photo covering everything, plus a landmark photo
    const W = 2048, H = 2048, px = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < px.length; i += 4) px.set([176, 58, 46, 255], i);
    const n = L.applyColourSamples(out, [{ box: { south: la - 0.01, north: la + 0.01, west: lo - 0.01, east: lo + 0.01 }, image: { width: W, height: H, data: px } }], L.makeUnprojector, { metresPerPixel: 1 });
    out.landmarks[0].photos = [{ file: 'File:x.jpg', thumb: 'https://upload.wikimedia.org/x.jpg', page: 'https://commons.wikimedia.org/wiki/File:x.jpg', licence: 'CC BY-SA 4.0', author: 'Someone' }];
    out.landmarks[0].photosFrom = 'wikidata';
    out.meta.groundImage = { file: 'kartmap_harness_ground.png', ...L.groundImagePlan(out.meta.bbox, 1, 4096), colours: 'aerial (sampled)' };
    console.log('sampled', JSON.stringify(n), 'contract problems', JSON.stringify(L.loaderContractProblems(out)));
  }
  const dir = '/tmp/game/game/tracks/scan_' + ver.replace('.', '_');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + '/kartmap_harness_2026-10-15.json', L.prettyJSON(out));
  console.log(ver, 'version', out.version, '| buildings', out.buildings.length, '| parts in buildings list', out.buildings.filter(b => b.part).length, '| separate buildingParts', (out.buildingParts || []).length, '| landmarks', out.landmarks.map(l => l.kind).join(','));
}
