# Kart Map Scanner

Draw a route on a real map, scan the area along it from free OpenStreetMap data, and export a level file (`kartmap` JSON) for a Godot kart game.

**Use it:** https://latintrout.github.io/kart-map-scanner/

## What it does

- **Draw a route** with the Pen (hold and drag) or click Points. It snaps to roads or paths and can close into a lap.
- **Scan** up to 300 m either side of the route. It picks up:
  - buildings with heights and looks (roof shape, colours, material)
  - roads, with bridges and tunnels marked
  - parks, water, pools and beaches, including shapes with holes
  - fences and walls
  - trees and small props (benches, lamps, picnic tables, statues…)
  - a list of named landmarks to model by hand
  - extra buildings and heights from Overture Maps where OSM has gaps (on by default; heights from Microsoft's machine-learning model are marked as guesses)
- **Extras after a scan (optional, no login or key):**
  - *Sample colours*: reads each roof's and area's real colour from Queensland aerial photos.
  - *Find landmark photos*: links up to 3 Wikimedia Commons reference photos per landmark.
  - *Export ground image*: a top-down PNG (1 m per pixel) for the game's ground texture.
- **Place trees by hand** on the satellite view where the map data has none.
- **Draw missing buildings** (Building mode): click the corners, type a height.
- **Race direction and start**: reverse the lap or click where the start line goes. Arrows and a 🏁 show the way round.
- **Saved tracks**: keep several tracks in the browser, and back them all up to one file.
- **Share link**: one link opens your exact track on another device (PC → phone). Also Redo (Ctrl+Y), a 📏 measuring tape on the map, and a short "How it works" card (the ? button).
- **Works on a phone**: map on top, panel below (the ▲/▼ button gives either more room). Draw with one finger, pinch with two, long-press to delete. "Show problem" jumps to anything sitting on the track.
- **Ground heights** from Queensland's free LiDAR terrain model: hills along the track and under every building, total climb and steepest slope, and a terrain file for the game.
- **3D preview** after a scan: orbit around the level, "Fly the lap" at kart height, switch on retro pixels, or save a rough `.glb` model.
- **Export / Load** the level file. The format is documented in `docs/kartmap-format.md`.

## Tests

Open https://latintrout.github.io/kart-map-scanner/tests/ to run every check from v1 onward in your browser. Developers can also run `node tests/run-node.js`.

## Run it without the internet host

Use the local launcher package (`start-kart-scanner.bat`). It serves the page at `http://localhost:8765`. The map data still needs an internet connection.

## Credits

Map data © OpenStreetMap contributors (ODbL). Map tiles © Esri / OpenTopoMap / OpenStreetMap. Road snapping by the OSRM demo server. Search by Nominatim. Building gaps from Overture Maps (ODbL). Colours from Queensland aerial imagery: Includes material © State of Queensland (DNRMMRRD); © Planet Labs Netherlands (CC BY-SA). Landmark photos from Wikimedia Commons (each photo's own licence). 3D preview by three.js (MIT). Ground heights: Queensland DEM, © State of Queensland and others (CC BY-SA).
