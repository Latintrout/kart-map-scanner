extends SceneTree
# Throwaway test harness (not part of the game): builds every track folder whose name starts
# with "scan_" using the game's own TrackBuilder + KartmapScenery, and prints the loader's counters.
# Ends with "HARNESS PASSED" or "HARNESS FAILED"; any error line in the log is a failure too.

func _initialize() -> void:
	Kartmap.prepare_folders("res://tracks")
	_run.call_deferred()

func _run() -> void:
	var ok := true
	var built := 0
	var found := 0
	for d in DirAccess.get_directories_at("res://tracks"):
		if not d.begins_with("scan_"):
			continue
		found += 1
		var dir := "res://tracks".path_join(d)
		var tb := TrackBuilder.new()
		tb.track_dir = dir
		root.add_child(tb)
		await process_frame
		var sc = tb.get_node_or_null("Scenery")
		var lift := 0.0
		for p in tb.centreline:
			lift = maxf(lift, p.y)
		if sc == null or tb.centreline.size() < 10:
			print("HARNESS ", dir, " NO TRACK OR SCENERY BUILT")
			ok = false
		else:
			built += 1
			print("HARNESS ", dir, " length=", snappedf(tb.length, 1.0), " highest=", snappedf(lift, 0.1), " counts=", JSON.stringify(sc.get("_counts")), " wheel=", sc.get("_wheel") != null)
		tb.queue_free()
		await process_frame
	if found == 0:
		print("HARNESS no scan_ folders found")
		ok = false
	print("HARNESS PASSED" if ok else "HARNESS FAILED")
	quit(0 if ok else 1)
