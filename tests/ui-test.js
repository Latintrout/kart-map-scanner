// Developer-only: headless test of the full page with fake server replies.
// Needs Node, playwright and leaflet (npm i playwright leaflet) next to this file.
// Run: node tests/ui-test.js index.html
// Headless test of the real scanner page, with fake map/server replies.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PAGE = process.argv[2];
const html = fs.readFileSync(PAGE, 'utf8');
const leafletJs = fs.readFileSync(path.join(__dirname, 'node_modules/leaflet/dist/leaflet.js'));
const leafletCss = fs.readFileSync(path.join(__dirname, 'node_modules/leaflet/dist/leaflet.css'));
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

  async function openPage(mode) {
    const ctx = await browser.newContext({ acceptDownloads: true });
    const page = await ctx.newPage();
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
        return route.fulfill({ body: JSON.stringify(overpass), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
      }
      if (u.includes('router.project-osrm.org')) return route.fulfill({ body: JSON.stringify({ code: 'NoRoute' }), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
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
  check('mode buttons: Pen, Points, Trees, Pan', (await page.$$eval('#modeRow button', b => b.map(x => x.dataset.mode).join(','))) === 'pen,points,trees,pan');
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
  check('stats show props 1 (picnic table, not the cafe)', /Props \(benches, lamps, signs…\)1/.test(stats), stats);
  check('stats show landmarks 2', /Landmarks2/.test(stats), stats);
  check('landmark list names Streets Beach and GOMA', /Streets Beach/.test(stats) && /Gallery of Modern Art/.test(stats));
  if (/Quality report/.test(stats) || /v8\.1/.test(html)) {
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
  check('export still version 1, generator v8.x', j.version === 1 && /^kart-map-scanner v8/.test(j.meta.generator));
  if (/v8\.1/.test(j.meta.generator)) {
    check('v8.1 export has smooth track line, corners and race layout', j.route.centerline && j.route.centerline.points.length > 10 && Array.isArray(j.route.corners) && j.race && j.race.checkpoints.length >= 8 && j.race.grid.length === 8);
    check('v8.1 export has quality report with notes', j.meta.quality && Array.isArray(j.meta.quality.notes));
    check('v8.1 export has railways/markings/parts arrays', Array.isArray(j.railways) && Array.isArray(j.markings) && Array.isArray(j.buildingParts));
    check('v8.1 every building has a roof shape and says if it is a guess', j.buildings.every(b => b.roofShape && /^(osm|guess)$/.test(b.roofShapeSource)));
  }
  // undo removes the tree
  await page.click('#undoBtn'); await page.waitForTimeout(100);
  check('Undo removes the placed tree', /Trees you placed0/.test(await page.textContent('#stats')));
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

  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
