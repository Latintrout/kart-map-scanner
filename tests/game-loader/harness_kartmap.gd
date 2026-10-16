extends SceneTree
# Throwaway test harness (not part of the game): builds two scanner files with the game's
# own TrackBuilder + KartmapScenery and prints the loader's counters.

func _initialize() -> void:
	Kartmap.prepare_folders("res://tracks")
	_run.call_deferred()

func _run() -> void:
	for dir in ["res://tracks/scan_v8_1", "res://tracks/scan_v8_2", "res://tracks/scan_v8_3", "res://tracks/scan_v9a", "res://tracks/scan_v11", "res://tracks/scan_v12c"]:
		var tb := TrackBuilder.new()
		tb.track_dir = dir
		root.add_child(tb)
		await process_frame
		var sc = tb.get_node_or_null("Scenery")
		if sc == null:
			print("HARNESS ", dir, " NO SCENERY BUILT")
		else:
			print("HARNESS ", dir, " counts=", JSON.stringify(sc.get("_counts")), " wheel=", sc.get("_wheel") != null)
		tb.queue_free()
		await process_frame
	quit()
