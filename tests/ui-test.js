// Headless test of the real scanner page, with fake map/server replies.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PAGE = process.argv[2];
const html = fs.readFileSync(PAGE, 'utf8');
// Scanner version as a number: v8 = 8, v8.3 = 8.3, v9a = 9.1, v9b = 9.2, v11 = 11 (so later versions run the older checks too).
const verOf = g => { const m = /kart-map-scanner v(\d+)(?:\.(\d+)|([a-z]))?/.exec(g || ''); if (!m) return 0; return +m[1] + (m[2] ? +m[2] / 10 : m[3] ? (m[3].charCodeAt(0) - 96) / 10 : 0); };
const V = verOf(html);
const leafletJs = fs.readFileSync(path.join(__dirname, 'node_modules/leaflet/dist/leaflet.js'));
const leafletCss = fs.readFileSync(path.join(__dirname, 'node_modules/leaflet/dist/leaflet.css'));
const aerial = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGPcYKXHQApgIkn1qIZRDUNKAwCMDwE42muDSwAAAABJRU5ErkJggg==', 'base64');   // solid #b03a2e
const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

// fake Overpass reply around South Bank (metres -> lat/lon near -27.4800, 153.0230)
const la = -27.4700, lo = 153.0200;   // the map's starting centre, so fake data sits under the drawn route
const off = (dx, dy) => ({ lat: la + dy / 111320, lon: lo + dx / (111320 * Math.cos(la * Math.PI / 180)) });
const sqm = (x, y, s) => [off(x, y), off(x + s, y), off(x + s, y + s), off(x, y + s), off(x, y)];
const overpass = { elements: [
  { type: 'way', id: 1, tags: { highway: 'footway', bridge: 'yes', layer: '1', name: 'Goodwill Bridge' }, geometry: [off(0, 0), off(0, 80)] },
  { type: 'way', id: 2, tags: { highway: 'busway', tunnel: 'yes', layer: '-1' }, geometry: [off(30, 0), off(30, 80)] },
  { type: 'way', id: 3, tags: { highway: 'residential' }, geometry: [off(-40, 0), off(-40, 80)] },
  { type: 'way', id: 4, tags: { building: 'yes', name: 'Gallery of Modern Art', tourism: 'gallery', 'roof:shape': 'flat', 'building:levels': '3' }, geometry: sqm(50, 10, 30) },
  { type: 'way', id: 5, tags: { barrier: 'fence' }, geometry: [off(-30, 90), off(30, 90)] },
  { type: 'relation', id: 8494, tags: { leisure: 'swimming_pool', type: 'multipolygon' }, members: [
    { type: 'way', role: 'outer', geometry: sqm(-120, 20, 60) }, { type: 'way', role: 'inner', geometry: sqm(-100, 40, 10) }] },
  { type: 'node', id: 10, lat: off(5, 5).lat, lon: off(5, 5).lon, tags: { leisure: 'picnic_table' } },
  { type: 'node', id: 11, lat: off(6, 6).lat, lon: off(6, 6).lon, tags: { tourism: 'attraction', name: 'Streets Beach' } },
  { type: 'node', id: 12, lat: off(7, 7).lat, lon: off(7, 7).lon, tags: { natural: 'tree' } },
  { type: 'node', id: 13, lat: off(8, 8).lat, lon: off(8, 8).lon, tags: { amenity: 'cafe', name: 'Not a prop' } }
] };

(async () => {
  const browser = await chromium.launch();
  const results = [];
  const check = (n, ok, d) => { results.push({ n, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && d ? '  -> ' + d : ''}`); };

  let benchAt = null;   // v9b: where the 'problem' mock puts a bench (on the drawn route)
  async function openPage(mode, ctxOpts) {
    const ctx = await browser.newContext({ acceptDownloads: true, ...(ctxOpts || {}) });
    const page = await ctx.newPage();
    // v8.3: fake Overture reply (one height for GOMA's OSM way, one building OSM doesn't have)
    await page.addInitScript(({ la, lo }) => {
      const off = (dx, dy) => [la + dy / 111320, lo + dx / (111320 * Math.cos(la * Math.PI / 180))];
      const sq = (x, y, s) => [off(x, y), off(x + s, y), off(x + s, y + s), off(x, y + s), off(x, y)];
      window.__overtureCalls = 0;
      window.__overtureFetch = async () => { window.__overtureCalls++; return [
        { id: 'ovGoma', osmId: 'w4', height: 20, heightFrom: 'OpenStreetMap', cls: null, isUnderground: false, ring: sq(50, 10, 30) },
        { id: 'ovNew', osmId: null, height: 7.5, heightFrom: 'Microsoft ML Buildings', cls: null, isUnderground: false, ring: sq(10, 40, 12) }]; };
    }, { la, lo });
    if (mode === 'ovfail') await page.addInitScript(() => { window.__overtureFetch = async () => { throw new Error('test failure'); }; });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept());
    await page.route('**/*', async route => {
      const u = route.request().url();
      if (u.startsWith('http://scanner.test/')) return route.fulfill({ body: html, contentType: 'text/html' });
      if (u.includes('leaflet.js')) return route.fulfill({ body: leafletJs, contentType: 'text/javascript' });
      if (u.includes('leaflet.css')) return route.fulfill({ body: leafletCss, contentType: 'text/css' });
      if (u.includes('/interpreter')) {
        if (mode === 'down') return route.fulfill({ status: 502, body: 'Bad Gateway', headers: { 'access-control-allow-origin': '*' } });
        const at = benchAt || off(2, 0);
        const body = mode === 'problem' ? { elements: overpass.elements.concat([{ type: 'node', id: 99, lat: at.lat, lon: at.lon, tags: { amenity: 'bench' } }]) } : overpass;
        return route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
      }
      if (u.includes('router.project-osrm.org')) return route.fulfill({ body: JSON.stringify({ code: 'NoRoute' }), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
      if (u.includes('spatial-img.information.qld.gov.au')) return route.fulfill({ body: aerial, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } });
      if (u.includes('commons.wikimedia.org/w/api.php')) {
        const q = new URL(u).searchParams, cors = { 'access-control-allow-origin': '*' };
        if (q.get('list') === 'geosearch') {
          // only Streets Beach (6 m east, 6 m north of the map centre) has a photo within 100 m... GOMA sits 65 m away, so give it a far-off result list
          const [glat, glon] = q.get('gscoord').split('|').map(Number);
          const near = Math.abs(glat - (la + 6 / 111320)) < 2e-5 && Math.abs(glon - (lo + 6 / (111320 * Math.cos(la * Math.PI / 180)))) < 2e-5;
          return route.fulfill({ body: JSON.stringify({ query: { geosearch: near ? [{ title: 'File:Riverside.svg', dist: 3 }, { title: 'File:Streets Beach test.jpg', dist: 20 }] : [] } }), contentType: 'application/json', headers: cors });
        }
        return route.fulfill({ body: JSON.stringify({ query: { pages: { 1: { title: 'File:Streets Beach test.jpg', imageinfo: [{ url: 'http://img.test/full.jpg', thumburl: 'http://img.test/thumb.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Streets_Beach_test.jpg', extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<a href="x">Tester</a>' } } }] } } } }), contentType: 'application/json', headers: cors });
      }
      if (u.includes('img.test')) return route.fulfill({ body: aerial, contentType: 'image/png' });
      if (/arcgisonline|tile|opentopomap/.test(u)) return route.fulfill({ body: tile, contentType: 'image/png' });
      return route.fulfill({ status: 404, body: '' });
    });
    await page.goto('http://scanner.test/');
    await page.waitForFunction(() => window.L && document.querySelector('.leaflet-container'));
    return { page, ctx, errors };
  }

  // ---------- normal scan ----------
  const { page, ctx, errors } = await openPage('ok');
  check('page loads with no script errors', errors.length === 0, errors.join('; '));
  check('mode buttons: Pen, Points, Trees, (v9a: Building,) Pan', (await page.$$eval('#modeRow button', b => b.map(x => x.dataset.mode).join(','))) === (V >= 9.1 ? 'pen,points,trees,build,pan' : 'pen,points,trees,pan'));
  // draw 3 points in Points mode with snapping off (straight lines)
  await page.click('[data-mode="points"]');
  await page.uncheck('#snap');
  await page.evaluate(() => { window.__map = document.querySelector('.leaflet-container'); });
  const box = await page.locator('#map').boundingBox();
  for (const [dx, dy] of [[0, 0], [60, 0], [60, -60]]) await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
  await page.waitForTimeout(300);
  check('3 clicked points make a route', /3 points/.test(await page.textContent('#routeInfo')), await page.textContent('#routeInfo'));
  await page.fill('#name', 'ui-test');
  await page.click('#scanBtn');
  await page.waitForFunction(() => !document.getElementById('exportBtn').disabled, null, { timeout: 15000 });
  const status = await page.textContent('#status');
  check('scan succeeds with fake server', /Scan done/.test(status), status);
  const stats = await page.textContent('#stats');
  check('stats show bridges / tunnels 1 / 1', /Bridges \/ tunnels1 \/ 1/.test(stats), stats);
  check('stats show fences 1', /Fences, walls, hedges1/.test(stats));
  // v8.2: cafés count as props again (the game draws outdoor tables for them), so v8.2+ shows 2.
  const v82 = V >= 8.2;
  check(v82 ? 'stats show props 2 (picnic table + cafe tables)' : 'stats show props 1 (picnic table, not the cafe)', new RegExp('Props \\(benches, lamps, signs…\\)' + (v82 ? 2 : 1)).test(stats), stats);
  check('stats show landmarks 2', /Landmarks2/.test(stats), stats);
  check('landmark list names Streets Beach and GOMA', /Streets Beach/.test(stats) && /Gallery of Modern Art/.test(stats));
  if (/Quality report/.test(stats) || V >= 8.1) {
    check('v8.1 stats show the quality report and race layout rows', /Quality report/.test(stats) && /Corners \/ checkpoints/.test(stats) && /Shortcuts found/.test(stats), stats.slice(0, 400));
    // The map draws in canvas mode (one bitmap), so count white-ish pixels: the smooth line and
    // start grid are the only white things drawn.
    const white = await page.evaluate(() => { let n = 0; for (const c of document.querySelectorAll('.leaflet-overlay-pane canvas')) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 4) if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240 && d[i + 3] > 200) n++; } return n; });
    check('v8.1 smooth track line and start grid drawn on the map (white pixels present)', white > 50, white);
  }
  const drawn = await page.evaluate(() => document.querySelectorAll('.leaflet-overlay-pane path, .leaflet-overlay-pane canvas').length);
  check('preview drew shapes on the map', drawn > 0, drawn);
  // trees mode still works (v7 feature)
  await page.click('[data-mode="trees"]');
  check('Trees mode shows canopy slider', await page.isVisible('#canopy'));
  await page.mouse.click(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50);
  await page.waitForTimeout(200);
  check('placing a tree updates the count without a re-scan', /Trees you placed1/.test(await page.textContent('#stats')) && !(await page.isDisabled('#exportBtn')));
  // export
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
  const file = path.join(__dirname, 'export.json'); await dl.saveAs(file);
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('export file name', /^kartmap_ui-test_\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  check('export has v8 fields (barriers, landmarks, bridge flag, roof shape)',
    j.barriers.length === 1 && j.landmarks.length === 2 && j.roads.some(r => r.bridge) && j.buildings[0].roofShape === 'flat');
  check('export keeps the pool hole and the manual tree', j.areas.some(a => a.kind === 'swimming_pool' && a.holes) && j.points.some(p => p.source === 'manual'));
  check('export format version (1 up to v8.1, 2 from v8.2), generator tag', j.version === (verOf(j.meta.generator) < 8.2 ? 1 : 2) && verOf(j.meta.generator) === V, j.version + ' ' + j.meta.generator);
  if (V >= 8.1) {
    check('v8.1 export has smooth track line, corners and race layout', j.route.centerline && j.route.centerline.points.length > 10 && Array.isArray(j.route.corners) && j.race && j.race.checkpoints.length >= 8 && j.race.grid.length === 8);
    check('v8.1 export has quality report with notes', j.meta.quality && Array.isArray(j.meta.quality.notes));
    // v8.2 moved parts into the buildings list (part: true), so buildingParts only exists in v8.1 files.
    check('v8.1+ export has railways/markings arrays, and parts in the right place for its version', Array.isArray(j.railways) && Array.isArray(j.markings) && (V === 8.1 ? Array.isArray(j.buildingParts) : !('buildingParts' in j)));
    check('v8.1 every building has a roof shape and says if it is a guess', j.buildings.every(b => b.roofShape && /^(osm|guess)$/.test(b.roofShapeSource)));
  }
  // undo removes the tree
  await page.click('#undoBtn'); await page.waitForTimeout(100);
  check('Undo removes the placed tree', /Trees you placed0/.test(await page.textContent('#stats')));
  if (V >= 8.3) {
    // ---------- v8.3 extras ----------
    check('v8.3 Overture was asked once during the scan', (await page.evaluate(() => window.__overtureCalls)) === 1);
    check('v8.3 scan status reports what Overture added', /Overture added 1 buildings/.test(status), status);
    const ov = j.buildings.find(b => b.id === 'ov-ovNew'), goma = j.buildings.find(b => /Gallery/.test(b.name || ''));
    check('v8.3 export has the Overture-only building, labelled', ov && ov.source === 'overture' && ov.heightSource === 'ml-estimate' && ov.height === 7.5, JSON.stringify(ov));
    check('v8.3 OSM levels still beat Overture (GOMA keeps 3 levels)', goma && goma.heightSource === 'levels', goma && goma.heightSource);
    check('v8.3 meta.overture and attribution', j.meta.overture && j.meta.overture.added === 1 && /Overture/.test(j.meta.attribution), JSON.stringify(j.meta.overture));
    check('v8.3 Extras buttons enabled after scan', !(await page.isDisabled('#sampleBtn')) && !(await page.isDisabled('#groundBtn')) && !(await page.isDisabled('#photosBtn')));
    await page.click('#sampleBtn');
    await page.waitForFunction(() => /Colours sampled|Colour sampling failed/.test(document.getElementById('status').textContent), null, { timeout: 15000 });
    const st2 = await page.textContent('#status');
    check('v8.3 colour sampling succeeds', /Colours sampled/.test(st2), st2);
    await page.click('#photosBtn');
    await page.waitForFunction(() => /Found reference photos/.test(document.getElementById('status').textContent), null, { timeout: 15000 });
    check('v8.3 landmark photos: 1 of 2 found', /for 1 of 2/.test(await page.textContent('#status')), await page.textContent('#status'));
    check('v8.3 photo thumbnail shown in the landmark list', (await page.$$('#stats .lm-photos img')).length === 1);
    const [gdl] = await Promise.all([page.waitForEvent('download'), page.click('#groundBtn')]);
    const gfile = path.join(__dirname, 'ground.png'); await gdl.saveAs(gfile);
    const png = fs.readFileSync(gfile);
    check('v8.3 ground image is a PNG named after the track', gdl.suggestedFilename() === 'kartmap_ui-test_ground.png' && png.slice(1, 4).toString() === 'PNG', gdl.suggestedFilename());
    const [dl3] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
    const f3 = path.join(__dirname, 'export3.json'); await dl3.saveAs(f3);
    const j3 = JSON.parse(fs.readFileSync(f3, 'utf8'));
    check('v8.3 export: sampled colours (#b03a2e), imagery licence, ground image info',
      j3.buildings.some(b => b.sampledRoofColour === '#b03a2e') && j3.meta.imagery && j3.meta.imagery.licence === 'CC BY-SA' && /Queensland/.test(j3.meta.attribution) &&
      j3.meta.groundImage && j3.meta.groundImage.file === 'kartmap_ui-test_ground.png' && png.readUInt32BE(16) === j3.meta.groundImage.width, JSON.stringify(j3.meta.groundImage));
    const sb = j3.landmarks.find(l => l.name === 'Streets Beach');
    check('v8.3 export: landmark photo with licence, author and "nearby" warning', sb.photos && sb.photos[0].licence === 'CC BY-SA 4.0' && sb.photos[0].author === 'Tester' && sb.photosFrom === 'nearby', JSON.stringify(sb));
    check('v8.3 file still version 2 (loader-compatible)', j3.version === 2);
  }
  if (V >= 9.1) {
    // ---------- v9a: draw a building, race direction/start, track library ----------
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const scanAgain = async () => { await page.click('#scanBtn'); await page.waitForFunction(() => !document.getElementById('exportBtn').disabled, null, { timeout: 15000 }); };
    const exportNow = async name => { const [d] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]); const f = path.join(__dirname, name); await d.saveAs(f); return JSON.parse(fs.readFileSync(f, 'utf8')); };
    await page.click('[data-mode="build"]');
    check('v9a Building mode shows its options', await page.isVisible('#bHeight'));
    await page.fill('#bHeight', '7.5'); await page.fill('#bName', 'Kiosk');
    for (const [dx, dy] of [[-150, 80], [-110, 80], [-110, 110], [-150, 110]]) { await page.mouse.click(cx + dx, cy + dy); await page.waitForTimeout(80); }
    check('v9a 4 corners make Finish available', !(await page.isDisabled('#bFinishBtn')));
    await page.mouse.click(cx - 150, cy + 80);   // first corner again = finish
    await page.waitForTimeout(200);
    check('v9a clicking the first corner finishes the building', /Building added \(7\.5 m\)/.test(await page.textContent('#status')) && /Buildings you drew1/.test(await page.textContent('#stats')), await page.textContent('#status'));
    const j9 = await exportNow('export9a.json');
    const mb = j9.buildings.find(b => b.id === 'mb1');
    check('v9a export has the drawn building (no re-scan needed)', mb && mb.height === 7.5 && mb.name === 'Kiosk' && mb.heightSource === 'manual' && mb.footprint.length === 4 && j9.manualBuildings.length === 1);
    await page.click('#undoBtn'); await page.waitForTimeout(100);
    check('v9a Undo removes the drawn building', /Buildings you drew0/.test(await page.textContent('#stats')));
    await page.click('[data-mode="pan"]');
    // direction
    await page.click('#reverseBtn');
    check('v9a Reverse: info says reversed and the scan must be redone', /reversed/.test(await page.textContent('#raceInfo')) && await page.isDisabled('#exportBtn'));
    await scanAgain();
    const jr = await exportNow('export9a-rev.json');
    check('v9a export says reversed; route runs the other way', jr.route.reversed === true && Math.hypot(jr.route.points[1][0] - j.route.points.at(-2)[0], jr.route.points[1][1] - j.route.points.at(-2)[1]) < 1, JSON.stringify([jr.route.points.slice(0, 2), j.route.points.slice(-2)]));
    // start
    await page.click('#startBtn');
    await page.mouse.click(cx + 30, cy);   // middle of the first leg
    await page.waitForTimeout(150);
    check('v9a Pick start: clicking the route moves the start', /Start moved/.test(await page.textContent('#status')), await page.textContent('#status'));
    await page.click('#startBtn'); await page.mouse.click(cx + 300, cy + 200); await page.waitForTimeout(150);
    check('v9a Pick start: clicking far from the route is refused with a reason', /from the route/.test(await page.textContent('#status')), await page.textContent('#status'));
    await scanAgain();
    const js = await exportNow('export9a-start.json');
    const sp = js.route.startPoint;
    check('v9a export has the start point, and the start line is there', Array.isArray(sp) && js.race && Math.hypot(js.race.startLine.pos[0] - js.route.points[0][0], js.race.startLine.pos[1] - js.route.points[0][1]) < 5 && Math.abs(js.route.length - j.route.length) < 1, JSON.stringify({ sp, len: [js.route.length, j.route.length] }));
    // library
    await page.fill('#name', 'ui-lib'); await page.dispatchEvent('#name', 'change');
    await page.click('#libSaveBtn');
    check('v9a library: save adds the track', (await page.$$eval('#libSelect option', o => o.map(x => x.value))).includes('ui-lib') && /Saved "ui-lib"/.test(await page.textContent('#status')));
    await page.click('#clearBtn'); await page.waitForTimeout(100);
    check('v9a (route cleared)', /No route yet/.test(await page.textContent('#routeInfo')));
    await page.selectOption('#libSelect', 'ui-lib'); await page.click('#libLoadBtn'); await page.waitForTimeout(300);
    check('v9a library: open brings the route and race settings back', /3 points/.test(await page.textContent('#routeInfo')) && /reversed/.test(await page.textContent('#raceInfo')) && /start moved/.test(await page.textContent('#raceInfo')), await page.textContent('#raceInfo'));
    const [bd] = await Promise.all([page.waitForEvent('download'), page.click('#libBackupBtn')]);
    const bf = path.join(__dirname, 'library.json'); await bd.saveAs(bf);
    const bj = JSON.parse(fs.readFileSync(bf, 'utf8'));
    check('v9a library backup file', bj.format === 'kartmap-library' && bj.tracks.length === 1 && bj.tracks[0].name === 'ui-lib' && bj.tracks[0].race.reverse === true);
    await page.click('#libDeleteBtn');
    check('v9a library: delete, with a way back', (await page.$$eval('#libSelect option', o => o.map(x => x.value).join(','))) === '' && await page.isVisible('#status button'));
    await page.click('#status button');
    check('v9a library: Bring it back works', (await page.$$eval('#libSelect option', o => o.map(x => x.value))).includes('ui-lib'));
    await page.click('#libDeleteBtn');
    await page.setInputFiles('#libFile', bf); await page.waitForTimeout(200);
    check('v9a library: restore from backup', (await page.$$eval('#libSelect option', o => o.map(x => x.value))).includes('ui-lib') && /Restored 1 track/.test(await page.textContent('#status')));
    await page.setInputFiles('#libFile', path.join(__dirname, 'export.json')); await page.waitForTimeout(200);
    if (process.env.SHOT) { await page.click('[data-mode="build"]'); for (const [dx, dy] of [[-150, 80], [-110, 80], [-110, 110]]) await page.mouse.click(cx + dx, cy + dy); await page.screenshot({ path: process.env.SHOT }); await page.click('#bCancelBtn'); await page.click('[data-mode="pan"]'); }
    check('v9a library: restoring a non-library file explains why', /not a track library backup/.test(await page.textContent('#status')));
  }
  check('no script errors during the whole run', errors.length === 0, errors.join('; '));
  await ctx.close();

  // ---------- server down ----------
  const d = await openPage('down');
  await d.page.click('[data-mode="points"]');
  await d.page.uncheck('#snap');
  const b2 = await d.page.locator('#map').boundingBox();
  for (const [dx, dy] of [[0, 0], [60, 0]]) await d.page.mouse.click(b2.x + b2.width / 2 + dx, b2.y + b2.height / 2 + dy);
  await d.page.click('#scanBtn');
  await d.page.waitForFunction(() => /Scan failed/.test(document.getElementById('status').textContent), null, { timeout: 30000 });
  const msg = await d.page.textContent('#status');
  check('server down (502): plain "down, their side" message with status link', /server is down/.test(msg) && /their side/.test(msg) && /api\/status/.test(msg), msg);
  await d.ctx.close();

  if (V >= 8.3) {
    const o = await openPage('ovfail');
    await o.page.click('[data-mode="points"]'); await o.page.uncheck('#snap');
    const b3 = await o.page.locator('#map').boundingBox();
    for (const [dx, dy] of [[0, 0], [60, 0]]) await o.page.mouse.click(b3.x + b3.width / 2 + dx, b3.y + b3.height / 2 + dy);
    await o.page.click('#scanBtn');
    await o.page.waitForFunction(() => !document.getElementById('exportBtn').disabled, null, { timeout: 15000 });
    const m3 = await o.page.textContent('#status');
    check('v8.3 Overture failing still gives a scan (OSM only) with a plain warning', /Scan done/.test(m3) && /Overture skipped: test failure/.test(m3), m3);
    await o.ctx.close();
  }
  if (V >= 9.2) {
    // ---------- v9b: phone layout (Pixel-sized screen, real touch) ----------
    const ph = await openPage('problem', { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const pg = ph.page;
    const cdp = await pg.context().newCDPSession(pg);
    const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
    const lay = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, map: document.getElementById('map').getBoundingClientRect().toJSON(), panel: document.getElementById('panel').getBoundingClientRect().toJSON(), btn: getComputedStyle(document.getElementById('sheetBtn')).display }));
    check('v9b phone: no sideways scrolling, map on top, panel below', lay.sw <= 412 && lay.map.top === 0 && lay.map.width === 412 && lay.map.height > 450 && lay.panel.top >= lay.map.bottom - 1 && lay.btn === 'block', JSON.stringify(lay));
    await pg.tap('#sheetBtn'); await pg.waitForTimeout(150);
    const up = await pg.evaluate(() => ({ h: document.getElementById('map').getBoundingClientRect().height, leaf: document.querySelector('.leaflet-container').clientHeight, label: document.getElementById('sheetBtn').textContent }));
    await pg.tap('#sheetBtn'); await pg.waitForTimeout(150);
    const big = await pg.evaluate(() => document.getElementById('map').getBoundingClientRect().height);
    await pg.tap('#sheetBtn'); await pg.waitForTimeout(150);
    check('v9b phone: the ▲/▼ button cycles panel-up, map-big, normal', up.h < 300 && /Map/.test(up.label) && big > 700, JSON.stringify({ up, big }));
    const mb = await pg.locator('#map').boundingBox();
    const mx = mb.x + mb.width / 2, my = mb.y + mb.height / 2;
    await pg.tap('[data-mode="pen"]');
    await pg.uncheck('#snap');
    await touch('touchStart', [[mx - 80, my]]);
    for (let i = 1; i <= 16; i++) { await touch('touchMove', [[mx - 80 + i * 10, my - (i > 8 ? (i - 8) * 10 : 0)]]); await pg.waitForTimeout(16); }
    await touch('touchEnd', []);
    await pg.waitForTimeout(400);
    const ri = await pg.textContent('#routeInfo');
    check('v9b phone: one-finger drag in Pen mode draws the route', /^\d+ points/.test(ri) && +ri.match(/^(\d+)/)[1] >= 2, ri);
    const before = +ri.match(/^(\d+)/)[1];
    await touch('touchStart', [[mx - 60, my + 60]]);
    await touch('touchStart', [[mx - 60, my + 60], [mx + 60, my + 100]]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [[mx - 60 - i * 8, my + 60 - i * 8], [mx + 60 + i * 8, my + 100 + i * 8]]);
    await touch('touchEnd', []);
    await pg.waitForTimeout(400);
    const after = +(await pg.textContent('#routeInfo')).match(/^(\d+)/)[1];
    check('v9b phone: two-finger pinch does not draw', after === before, before + ' -> ' + after);
    // long-press the last route point to delete it (phones have no right-click)
    // a route point that isn't hidden under a map button
    const last = await pg.evaluate(() => { for (const el of [...document.querySelectorAll('.leaflet-marker-icon.wp')].reverse()) { const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2; if (document.elementFromPoint(x, y) === el) return [x, y]; } return null; });
    await pg.evaluate(() => { window.__ev = []; for (const t of ['touchstart', 'pointerdown', 'contextmenu', 'touchend', 'click']) document.addEventListener(t, e => window.__ev.push(t + ':' + (e.target.className && e.target.className.baseVal === undefined ? e.target.className : e.target.tagName) + (e._simulated ? ':sim' : '')), true); });
    await touch('touchStart', [last]); await pg.waitForTimeout(900); await touch('touchEnd', []);
    if (process.env.DEBUG) console.log('events', JSON.stringify(await pg.evaluate(() => window.__ev)), JSON.stringify(last));
    await pg.waitForTimeout(400);
    const afterHold = +(await pg.textContent('#routeInfo')).match(/^(\d+)/)[1];
    check('v9b phone: long-press a point deletes it', afterHold === after - 1, after + ' -> ' + afterHold);
    const wp = (await pg.evaluate(() => JSON.parse(localStorage.getItem('kartmap-v1')).waypoints))[0];
    benchAt = { lat: wp[0], lon: wp[1] };
    if (process.env.DEBUG) await pg.evaluate(() => { window.__ev = []; });
    await pg.tap('#scanBtn');
    if (process.env.DEBUG) { await pg.waitForTimeout(300); console.log('tap events', JSON.stringify(await pg.evaluate(() => window.__ev))); }
    await pg.waitForFunction(() => !document.getElementById('exportBtn').disabled, null, { timeout: 15000 }).catch(async () => console.log('scan status:', await pg.textContent('#status'), await pg.textContent('#routeInfo')));
    check('v9b phone: scan works', /Scan done/.test(await pg.textContent('#status')), await pg.textContent('#status'));
    const pb = await pg.$('#nextProblemBtn');
    check('v9b "Show problem" button appears when something is on the track', !!pb);
    if (pb) {
      await pb.tap(); await pg.waitForTimeout(300);
      check('v9b "Show problem" zooms to it and says what it is', /Problem 1 of \d+: bench on the track/.test(await pg.textContent('#status')), await pg.textContent('#status'));
    }
    if (process.env.SHOT2) { await pg.screenshot({ path: process.env.SHOT2 }); await pg.tap('#sheetBtn'); await pg.waitForTimeout(200); await pg.screenshot({ path: process.env.SHOT2.replace('.png', '-up.png') }); }
    check('v9b phone: status also shows over the map (toast), tap hides it', await pg.isVisible('#toast') && /Problem 1/.test(await pg.textContent('#toast')));
    await pg.tap('#toast'); await pg.waitForTimeout(100);
    check('v9b phone: toast hides on tap', !(await pg.isVisible('#toast')));
    check('v9b phone: no script errors', ph.errors.length === 0, ph.errors.join('; '));
    await ph.ctx.close();
  }
  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
