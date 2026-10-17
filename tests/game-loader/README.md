# Game loader test (the game check)

The check that scanner files load in the real game now lives in the game's repo,
`Latintrout/brisbane-kart`, under `tools/scanner_check/` (test-file maker and Godot harness).
Its **Scanner check** workflow runs on every game push and pull request, once a day against
this repo's `main`, and by hand (brisbane-kart → Actions → Scanner check → Run workflow,
naming a scanner branch to test it before merging).

When the scanner exports something new, add it to `tools/scanner_check/make_files.js` in the
game repo so the check covers it. To run it by hand, see the README there.
