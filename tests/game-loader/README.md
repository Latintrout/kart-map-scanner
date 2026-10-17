# Game loader test

Checks scanner output against the real game: the Godot loader in `Latintrout/brisbane-kart`
(`game/scripts/kartmap.gd`, `kartmap_scenery.gd`).

## Automatic (the game check)
The game repo runs this on every push and pull request, once a day, and by hand
(GitHub → brisbane-kart → Actions → **Scanner check** → Run workflow, optionally naming a
scanner branch to test before merging it). It uses the scanner's `main` by default, builds
a made-up South-Bank-like scan with every extra that scanner version has (Overture,
colours, reverse/start, drawn buildings, heights, terrain file, minimap), loads it with the
game's own loader and then runs the game's smoke test with that track in it. Red = the
scanner and the game disagree.

## By hand
1. Check out the game and install Godot 4.7.2.
2. `node make_files.js <game>/game/tracks scan_ci=../../index.html [scan_old=<older-scanner.html> ...]`
   (each `folder=file` pair writes one track folder; the folder name must start with `scan_`).
3. Copy `harness_kartmap.gd` into `<game>/game/` and run:
   `godot --headless --path <game>/game --import` then
   `godot --headless --path <game>/game --script res://harness_kartmap.gd`
4. It prints one `HARNESS` line per folder (length, highest point, counters) and ends with
   `HARNESS PASSED` or `HARNESS FAILED`. Any ERROR or WARNING line is a failure too. The
   game's `.gitignore` already ignores the `scan_*` folders and the harness.
