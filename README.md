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
- **Place trees by hand** on the satellite view where the map data has none.
- **Export / Load** the level file. The format is documented in `kartmap-format.md` (kept with the game project).

## Tests

Open https://latintrout.github.io/kart-map-scanner/tests/ to run every check from v1 onward in your browser. Developers can also run `node tests/run-node.js`.

## Run it without the internet host

Use the local launcher package (`start-kart-scanner.bat`). It serves the page at `http://localhost:8765`. The map data still needs an internet connection.

## Credits

Map data © OpenStreetMap contributors (ODbL). Map tiles © Esri / OpenTopoMap / OpenStreetMap. Road snapping by the OSRM demo server. Search by Nominatim.
