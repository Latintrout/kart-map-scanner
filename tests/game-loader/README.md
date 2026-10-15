# Game loader test (developer-only)

Checks scanner output against the real game: the Godot loader in `Latintrout/brisbane-kart`
(`game/scripts/kartmap.gd`, `kartmap_scenery.gd`).

1. Check out the game (the branch with the kartmap importer) and install Godot 4.7.2.
2. Edit the last lines of `make_files.js` so the two output folders point at `<game>/game/tracks/`,
   then: `node make_files.js <older-scanner.html> <newer-scanner.html>`.
3. Copy `harness_kartmap.gd` into `<game>/game/` and run:
   `godot --headless --path <game>/game --import` then
   `godot --headless --path <game>/game --script res://harness_kartmap.gd`
4. Compare the printed counters (buildings near/far, wheel, props, landmarks). Any error or
   warning in the log is a failure. Delete the harness and test track folders afterwards.

Result on 2026-10-15 (made-up South-Bank-like scan): v8.1 near 7, wheel false, props 5;
v8.2 near 9 (tower drawn), wheel true, props 10. No errors.
