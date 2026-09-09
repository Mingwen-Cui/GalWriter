// A self-contained Godot 4 runtime. All story text is JSON data, never GDScript.
export const godotRuntime = String.raw`extends Control

const STORY_PATH = "res://game/story.json"
const MEDIA_PATH = "res://game/media.json"
const SCREEN = Vector2(1280, 720)
var story: Dictionary = {}
var media: Dictionary = {}
var blocks: Dictionary = {}
var variables: Dictionary = {}
var current_id: String = ""
var cursor: int = 0
var waiting: String = ""
var busy: bool = false
var generation: int = 0
var history: Array = []
var stage_data: Dictionary = {}
var visuals: Dictionary = {}
var texture_cache: Dictionary = {}
var tweens: Array = []
var voice_queue: Array = []
var bgm_path: String = ""
var bgm_loop: bool = true
var movie: Dictionary = {}
var movie_time: float = 0.0
var movie_frame: int = -1
var auto_play: bool = false
var auto_wait: float = 0.0
var revealed: float = 0.0
var text_speed: float = 45.0
var stage: Control
var dialogue_panel: PanelContainer
var name_label: Label
var text_label: RichTextLabel
var choices: VBoxContainer
var title_panel: PanelContainer
var title_label: Label
var toolbar: HBoxContainer
var notice: Label
var popup: AcceptDialog
var bgm: AudioStreamPlayer
var voice: AudioStreamPlayer
var sound: AudioStreamPlayer
var movie_sound: AudioStreamPlayer

func _read_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
	return parsed if parsed is Dictionary else {}

func _ready() -> void:
	story = _read_json(STORY_PATH)
	media = _read_json(MEDIA_PATH)
	for block in story.get("blocks", []):
		blocks[str(block.get("nodeId", ""))] = block
	_build_ui()
	if blocks.is_empty() or not blocks.has(str(story.get("entryId", ""))):
		popup.dialog_text = "剧情数据或起点缺失。请在 GalWriter 中重新导出完整工程。"
		popup.popup_centered(Vector2i(640, 240))
		return
	_show_title()

func _panel(color: Color) -> StyleBoxFlat:
	var style = StyleBoxFlat.new()
	style.bg_color = color
	style.set_corner_radius_all(14)
	style.content_margin_left = 24
	style.content_margin_right = 24
	style.content_margin_top = 16
	style.content_margin_bottom = 16
	return style

func _button(caption: String, callback: Callable, parent: Node) -> Button:
	var button = Button.new()
	button.text = caption
	button.custom_minimum_size = Vector2(100, 44)
	button.add_theme_font_size_override("font_size", 20)
	button.pressed.connect(callback)
	parent.add_child(button)
	return button

func _build_ui() -> void:
	var font = SystemFont.new()
	font.font_names = PackedStringArray(["Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "WenQuanYi Zen Hei", "Arial"])
	theme = Theme.new()
	theme.default_font = font
	theme.default_font_size = 24
	var fill = ColorRect.new()
	fill.color = Color("111827")
	fill.size = SCREEN
	fill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(fill)
	stage = Control.new()
	stage.size = SCREEN
	stage.clip_contents = true
	stage.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(stage)
	dialogue_panel = PanelContainer.new()
	dialogue_panel.position = Vector2(48, 480)
	dialogue_panel.size = Vector2(1184, 216)
	dialogue_panel.z_index = 100
	dialogue_panel.add_theme_stylebox_override("panel", _panel(Color(0.035, 0.055, 0.10, 0.94)))
	add_child(dialogue_panel)
	var column = VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	dialogue_panel.add_child(column)
	name_label = Label.new()
	name_label.add_theme_color_override("font_color", Color("9bdcff"))
	column.add_child(name_label)
	text_label = RichTextLabel.new()
	text_label.bbcode_enabled = false
	text_label.custom_minimum_size = Vector2(0, 130)
	text_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	text_label.gui_input.connect(_dialogue_input)
	column.add_child(text_label)
	var choice_scroll = ScrollContainer.new()
	choice_scroll.position = Vector2(300, 100)
	choice_scroll.size = Vector2(680, 365)
	choice_scroll.z_index = 101
	choice_scroll.mouse_filter = Control.MOUSE_FILTER_PASS
	add_child(choice_scroll)
	choices = VBoxContainer.new()
	choices.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	choices.add_theme_constant_override("separation", 10)
	choice_scroll.add_child(choices)
	toolbar = HBoxContainer.new()
	toolbar.position = Vector2(32, 16)
	toolbar.z_index = 102
	toolbar.add_theme_constant_override("separation", 8)
	add_child(toolbar)
	_button("存档", _save_game, toolbar)
	_button("读档", _load_game, toolbar)
	_button("自动", _toggle_auto, toolbar)
	_button("历史", _show_history, toolbar)
	_button("全屏", _toggle_fullscreen, toolbar)
	_button("标题", _show_title, toolbar)
	var volume = HSlider.new()
	volume.min_value = 0
	volume.max_value = 1
	volume.step = 0.05
	volume.value = 0.8
	volume.custom_minimum_size = Vector2(130, 40)
	volume.tooltip_text = "音量"
	volume.value_changed.connect(func(value: float): AudioServer.set_bus_volume_db(0, linear_to_db(maxf(value, 0.0001))))
	toolbar.add_child(volume)
	AudioServer.set_bus_volume_db(0, linear_to_db(0.8))
	notice = Label.new()
	notice.position = Vector2(48, 70)
	notice.z_index = 103
	notice.add_theme_font_size_override("font_size", 18)
	add_child(notice)
	title_panel = PanelContainer.new()
	title_panel.position = Vector2(360, 150)
	title_panel.size = Vector2(560, 420)
	title_panel.z_index = 110
	title_panel.add_theme_stylebox_override("panel", _panel(Color("18243a")))
	add_child(title_panel)
	var title_column = VBoxContainer.new()
	title_column.add_theme_constant_override("separation", 20)
	title_panel.add_child(title_column)
	title_label = Label.new()
	title_label.text = str(story.get("title", "GalWriter"))
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	title_label.custom_minimum_size.y = 100
	title_label.add_theme_font_size_override("font_size", 34)
	title_column.add_child(title_label)
	_button("开始游戏", _new_game, title_column)
	_button("继续游戏", _load_game, title_column)
	_button("退出游戏", func(): get_tree().quit(), title_column)
	popup = AcceptDialog.new()
	popup.title = "提示"
	popup.dialog_autowrap = true
	add_child(popup)
	bgm = AudioStreamPlayer.new()
	voice = AudioStreamPlayer.new()
	sound = AudioStreamPlayer.new()
	movie_sound = AudioStreamPlayer.new()
	for player in [bgm, voice, sound, movie_sound]:
		add_child(player)
	bgm.finished.connect(func():
		if bgm_loop and not bgm_path.is_empty(): bgm.play()
	)
	voice.finished.connect(_next_voice)

func _cancel() -> void:
	generation += 1
	busy = false
	for tween in tweens:
		if tween.is_valid(): tween.kill()
	tweens.clear()
	voice_queue.clear()
	for player in [bgm, voice, sound, movie_sound]: player.stop()
	bgm_path = ""
	movie = {}

func _clear_choices() -> void:
	for child in choices.get_children():
		choices.remove_child(child)
		child.queue_free()

func _show_title() -> void:
	_cancel()
	waiting = ""
	_clear_choices()
	title_panel.show()
	dialogue_panel.hide()
	toolbar.hide()
	notice.text = ""

func _new_game() -> void:
	_cancel()
	variables.clear()
	for variable in story.get("variables", []):
		variables[str(variable.get("id", ""))] = variable.get("initialValue", 0)
	history.clear()
	stage_data = {}
	title_panel.hide()
	dialogue_panel.show()
	toolbar.show()
	notice.text = "空格 / 回车 / 点击文字继续；F11 全屏"
	current_id = str(story.get("entryId", ""))
	cursor = 0
	waiting = ""
	_start_node()
	_advance()

func _texture(asset_path: String) -> Texture2D:
	if texture_cache.has(asset_path): return texture_cache[asset_path]
	var info: Dictionary = media.get(asset_path, {})
	var path = str(info.get("path", ""))
	if path.is_empty(): return null
	var image = Image.new()
	if image.load_png_from_buffer(FileAccess.get_file_as_bytes(path)) != OK: return null
	var texture = ImageTexture.create_from_image(image)
	# Bound retained image memory in long projects.
	if texture_cache.size() >= 16: texture_cache.clear()
	texture_cache[asset_path] = texture
	return texture

func _audio(info: Dictionary) -> AudioStreamWAV:
	var path = str(info.get("path", ""))
	if path.is_empty(): return null
	var stream = AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = int(info.get("rate", 48000))
	stream.stereo = int(info.get("channels", 2)) == 2
	stream.data = FileAccess.get_file_as_bytes(path)
	return stream

func _play_audio(player: AudioStreamPlayer, asset_path: String, offset: float = 0.0) -> void:
	player.stop()
	player.stream = _audio(media.get(asset_path, {}).get("audio", {}))
	if player.stream != null: player.play(offset)

func _next_voice() -> void:
	if voice_queue.is_empty(): return
	_play_audio(voice, str(voice_queue.pop_front()))

func _rect(config: Dictionary, background: bool) -> TextureRect:
	var rect = TextureRect.new()
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	rect.texture = _texture(str(config.get("assetPath", "")))
	if background:
		rect.size = SCREEN
		rect.position = Vector2(float(config.get("offsetX", 0)), float(config.get("offsetY", 0)))
		rect.pivot_offset = SCREEN / 2
		var crop = str(config.get("cropMode", "contain"))
		rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED if crop == "cover" else (TextureRect.STRETCH_SCALE if crop == "stretch" else TextureRect.STRETCH_KEEP_ASPECT_CENTERED)
	else:
		rect.size = SCREEN * Vector2(0.72, 0.92)
		var fraction = 0.24 if config.get("position") == "left" else (0.76 if config.get("position") == "right" else 0.5)
		rect.position = Vector2(SCREEN.x * (fraction + float(config.get("offsetX", 0)) / 1000.0) - rect.size.x / 2, SCREEN.y - rect.size.y - SCREEN.y * float(config.get("offsetY", 0)) / 1000.0)
		rect.pivot_offset = Vector2(rect.size.x / 2, rect.size.y)
		rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		rect.flip_h = bool(config.get("flipX", false))
		rect.z_index = clampi(int(config.get("layer", 1)), 1, 20)
	rect.scale = Vector2.ONE * float(config.get("scale", 1))
	stage.add_child(rect)
	return rect

func _scene_wipe(outgoing: TextureRect, asset_path: String, duration: float, video_path: String) -> void:
	var mask := Control.new()
	mask.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mask.position = Vector2.ZERO
	mask.size = Vector2(0, SCREEN.y)
	mask.clip_contents = true
	stage.add_child(mask)
	stage.move_child(mask, 1)
	var incoming := TextureRect.new()
	incoming.mouse_filter = Control.MOUSE_FILTER_IGNORE
	incoming.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	incoming.texture = _texture(asset_path)
	incoming.size = SCREEN
	incoming.stretch_mode = outgoing.stretch_mode
	mask.add_child(incoming)
	var flash := ColorRect.new()
	flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	flash.color = Color(1, 1, 1, 0.86)
	flash.position = Vector2(-72, 0)
	flash.size = Vector2(72, SCREEN.y)
	flash.z_index = 30
	stage.add_child(flash)
	var tween := create_tween().set_parallel(true)
	tweens.append(tween)
	tween.tween_property(mask, "size:x", SCREEN.x, duration).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tween.tween_property(flash, "position:x", SCREEN.x, duration).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tween.tween_property(flash, "modulate:a", 0.0, duration)
	await tween.finished
	outgoing.texture = incoming.texture
	stage_data["background"]["assetPath"] = asset_path
	stage_data["background"]["videoPath"] = video_path
	mask.queue_free()
	flash.queue_free()
	_start_movie(stage_data["background"])

func _motion(rect: Control, config: Dictionary, leaving: bool = false) -> float:
	var kind = str(config.get("type", "none"))
	var duration = float(config.get("duration", 0))
	if kind == "none" or duration <= 0: return 0.0
	var tween = create_tween().set_parallel(true)
	tweens.append(tween)
	var target_position = rect.position
	var target_scale = rect.scale
	var shift = Vector2.ZERO
	match kind:
		"slide-left": shift = Vector2(-160, 0)
		"slide-right": shift = Vector2(160, 0)
		"slide-up": shift = Vector2(0, -120)
		"slide-down": shift = Vector2(0, 120)
	if not leaving:
		rect.modulate.a = 0
		rect.position += shift
		if kind == "zoom": rect.scale *= 0.8
	tween.tween_property(rect, "modulate:a", 0.0 if leaving else 1.0, duration)
	tween.tween_property(rect, "position", target_position + shift if leaving else target_position, duration)
	tween.tween_property(rect, "scale", target_scale * 0.8 if leaving and kind == "zoom" else target_scale, duration)
	return duration

func _build_stage(animate: bool = true) -> float:
	for child in stage.get_children():
		stage.remove_child(child)
		child.queue_free()
	visuals.clear()
	var background: Dictionary = stage_data.get("background", {})
	visuals["scene"] = _rect(background, true)
	var duration = 0.0
	if animate: duration = _motion(visuals["scene"], background.get("enter", {}))
	for character in stage_data.get("characters", []):
		var rect = _rect(character, false)
		visuals[str(character.get("sourceNodeId", ""))] = rect
		if animate: duration = maxf(duration, _motion(rect, character.get("enter", {})))
	_start_movie(background)
	return duration

func _leave_stage() -> float:
	var duration = 0.0
	if visuals.has("scene"):
		duration = _motion(visuals["scene"], stage_data.get("background", {}).get("exit", {}), true)
	for character in stage_data.get("characters", []):
		var id = str(character.get("sourceNodeId", ""))
		if visuals.has(id): duration = maxf(duration, _motion(visuals[id], character.get("exit", {}), true))
	return duration

func _start_movie(config: Dictionary, offset: float = -1.0) -> void:
	movie_sound.stop()
	movie = {}
	movie_frame = -1
	var info: Dictionary = media.get(str(config.get("videoPath", "")), {})
	if info.get("kind", "") != "video": return
	movie = info.duplicate()
	movie["start"] = maxf(0.0, float(config.get("videoStartTime", 0)))
	var end = float(config.get("videoEndTime", 0))
	movie["end"] = minf(end, float(info.get("duration", 0))) if end > float(movie["start"]) else float(info.get("duration", 0))
	var maximum = float(config.get("videoMaxDuration", 0))
	if maximum > 0: movie["end"] = minf(float(movie["end"]), float(movie["start"]) + maximum)
	movie["loop"] = bool(config.get("videoLoop", false))
	movie_time = float(movie["start"]) if offset < 0 else offset
	movie_sound.stream = _audio(info.get("audio", {}))
	if movie_sound.stream != null: movie_sound.play(movie_time)
	_update_movie(0)

func _update_movie(delta: float) -> void:
	if movie.is_empty() or not visuals.has("scene"): return
	movie_time += delta
	if movie_sound.playing:
		movie_time = movie_sound.get_playback_position() + AudioServer.get_time_since_last_mix()
	if movie_time >= float(movie["end"]):
		if bool(movie.get("loop", false)):
			movie_time = float(movie["start"])
			if movie_sound.stream != null: movie_sound.play(movie_time)
		else:
			movie_time = maxf(float(movie["start"]), float(movie["end"]) - 1.0 / float(movie.get("fps", 24)))
			movie_sound.stop()
	var frames: Array = movie.get("frames", [])
	if frames.is_empty(): return
	var index = clampi(int(movie_time * float(movie.get("fps", 24))), 0, frames.size() - 1)
	if index == movie_frame: return
	movie_frame = index
	var image = Image.new()
	if image.load_jpg_from_buffer(FileAccess.get_file_as_bytes(str(frames[index]))) == OK:
		visuals["scene"].texture = ImageTexture.create_from_image(image)

func _start_node() -> float:
	cursor = 0
	waiting = ""
	_clear_choices()
	if not blocks.has(current_id): return 0.0
	var block: Dictionary = blocks[current_id]
	if bool(block.get("passive", false)): return 0.0
	voice_queue.clear()
	voice.stop()
	stage_data = block.get("stage", {}).duplicate(true)
	var has_bgm = false
	for event in block.get("statements", []):
		if event.get("kind") == "audio" and event.get("channel") == "bgm": has_bgm = true
	if not has_bgm:
		bgm.stop()
		bgm_path = ""
	return _build_stage()

func _advance() -> void:
	if busy or title_panel.visible or popup.visible: return
	busy = true
	var token = generation
	waiting = ""
	var iterations = 0
	while blocks.has(current_id):
		if token != generation: return
		iterations += 1
		if iterations > 4096:
			busy = false
			popup.dialog_text = "剧情存在没有对白或选项的连续循环，请检查节点连接。"
			popup.popup_centered(Vector2i(600, 220))
			return
		if iterations % 64 == 0:
			await get_tree().process_frame
			if token != generation: return
		var block: Dictionary = blocks[current_id]
		var events: Array = block.get("statements", [])
		if cursor < events.size():
			var event: Dictionary = events[cursor]
			cursor += 1
			match str(event.get("kind", "")):
				"dialogue":
					name_label.text = str(event.get("speakerName", ""))
					text_label.text = str(event.get("text", ""))
					text_label.visible_characters = 0
					revealed = 0
					auto_wait = 0
					text_label.scroll_to_line(0)
					history.append((name_label.text + "：" if not name_label.text.is_empty() else "") + text_label.text)
					waiting = "dialogue"
					busy = false
					return
				"variable":
					var id = str(event.get("variableId", ""))
					var value = event.get("value", 0)
					match str(event.get("operation", "set")):
						"add": variables[id] = float(variables.get(id, 0)) + float(value)
						"subtract": variables[id] = float(variables.get(id, 0)) - float(value)
						_: variables[id] = value
				"audio":
					var path = str(event.get("assetPath", ""))
					match str(event.get("channel", "voice")):
						"bgm":
							if bgm_path != path:
								bgm_path = path
								_play_audio(bgm, path)
							bgm_loop = bool(event.get("loop", true))
						"sound": _play_audio(sound, path)
						_:
							voice_queue = event.get("queue", [path]).duplicate()
							_next_voice()
				"action":
					var duration = _action(event)
					if duration > 0:
						await get_tree().create_timer(duration).timeout
						if token != generation: return
			continue
		var control: Dictionary = block.get("control", {})
		var target = ""
		match str(control.get("kind", "return")):
			"jump": target = str(control.get("targetNodeId", ""))
			"condition":
				for branch in control.get("branches", []):
					var condition: Dictionary = branch.get("condition", {})
					var value = float(variables.get(str(condition.get("variableId", "")), 0))
					var kind = str(condition.get("kind", "else"))
					if kind == "else" or (kind == "gte" and value >= float(condition.get("value", 0))) or (kind == "range" and value >= float(condition.get("min", 0)) and value <= float(condition.get("max", 0))):
						target = str(branch.get("targetNodeId", ""))
						break
			"choice":
				busy = false
				waiting = "choice"
				_show_choices(control)
				return
		if target.is_empty():
			busy = false
			waiting = "end"
			name_label.text = ""
			text_label.text = "故事结束"
			text_label.visible_characters = -1
			_clear_choices()
			_button("重新开始", _new_game, choices)
			_button("返回标题", _show_title, choices)
			return
		var delay = _leave_stage() if not bool(blocks.get(target, {}).get("passive", false)) else 0.0
		if delay > 0:
			await get_tree().create_timer(delay).timeout
			if token != generation: return
		current_id = target
		delay = _start_node()
		if delay > 0:
			await get_tree().create_timer(delay).timeout
			if token != generation: return
	busy = false

func _show_choices(control: Dictionary) -> void:
	_clear_choices()
	for option in control.get("options", []):
		var target = str(option.get("targetNodeId", ""))
		var caption = str(option.get("text", "继续"))
		var button = _button(caption, _choose.bind(target, caption), choices)
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.custom_minimum_size.y = 52

func _choose(target: String, caption: String) -> void:
	if busy or waiting != "choice": return
	history.append("→ " + caption)
	_clear_choices()
	busy = true
	var token = generation
	var delay = _leave_stage() if not bool(blocks.get(target, {}).get("passive", false)) else 0.0
	if delay > 0:
		await get_tree().create_timer(delay).timeout
		if token != generation: return
	current_id = target
	delay = _start_node()
	if delay > 0:
		await get_tree().create_timer(delay).timeout
		if token != generation: return
	busy = false
	_advance()

func _action(event: Dictionary) -> float:
	var id = "scene" if event.get("targetKind") == "scene" else str(event.get("sourceNodeId", ""))
	if not visuals.has(id): return 0.0
	var rect: TextureRect = visuals[id]
	var kind = str(event.get("action", "none"))
	var duration = maxf(0.0, float(event.get("duration", 0)))
	if kind == "switch":
		if id == "scene":
			var wipe_duration = maxf(0.18, duration)
			_scene_wipe(rect, str(event.get("assetPath", "")), wipe_duration, str(event.get("videoPath", "")))
			return wipe_duration
		else:
			rect.texture = _texture(str(event.get("assetPath", "")))
			for config in stage_data.get("characters", []):
				if str(config.get("sourceNodeId", "")) == id: config["assetPath"] = event.get("assetPath", "")
		return duration
	if kind == "none": return 0.0
	var tween = create_tween()
	tweens.append(tween)
	var strength = float(event.get("strength", 10))
	match kind:
		"translate", "translate-x", "translate-y":
			var offset = Vector2(float(event.get("offsetX", strength)), float(event.get("offsetY", strength)))
			if kind == "translate-x": offset.y = 0
			if kind == "translate-y": offset.x = 0
			tween.tween_property(rect, "position", rect.position + offset, duration)
		"scale": tween.tween_property(rect, "scale", rect.scale * float(event.get("scale", 1.08)), duration)
		"rotate": tween.tween_property(rect, "rotation", rect.rotation + deg_to_rad(strength), duration)
		"opacity": tween.tween_property(rect, "modulate:a", clampf(strength / 100.0, 0, 1), duration)
		"brightness": tween.tween_property(rect, "modulate", Color(1 + strength / 100.0, 1 + strength / 100.0, 1 + strength / 100.0, rect.modulate.a), duration)
		"pulse":
			var repeats = maxi(1, int(event.get("repeats", 1)))
			for index in range(repeats):
				tween.tween_property(rect, "modulate:a", 0.2, duration / repeats / 2)
				tween.tween_property(rect, "modulate:a", 1.0, duration / repeats / 2)
		"shake-x", "shake-y":
			var origin = rect.position
			var repeats = maxi(1, int(event.get("repeats", 1)))
			var offset = Vector2(strength, 0) if kind == "shake-x" else Vector2(0, strength)
			for index in range(repeats):
				tween.tween_property(rect, "position", origin + offset, duration / repeats / 4)
				tween.tween_property(rect, "position", origin - offset, duration / repeats / 2)
				tween.tween_property(rect, "position", origin, duration / repeats / 4)
	return duration

func _process(delta: float) -> void:
	if title_panel == null or title_panel.visible or popup.visible: return
	_update_movie(delta)
	if waiting == "dialogue" and not busy:
		if text_label.visible_characters >= 0 and text_label.visible_characters < text_label.get_total_character_count():
			revealed += delta * text_speed
			text_label.visible_characters = int(revealed)
		elif auto_play and not voice.playing and voice_queue.is_empty():
			auto_wait += delta
			if auto_wait > 1.2: _advance()

func _continue() -> void:
	if busy or waiting != "dialogue": return
	if text_label.visible_characters >= 0 and text_label.visible_characters < text_label.get_total_character_count():
		text_label.visible_characters = -1
	else: _advance()

func _dialogue_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_continue()
		accept_event()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F11: _toggle_fullscreen()
		elif event.keycode in [KEY_SPACE, KEY_ENTER] and not title_panel.visible and not popup.visible: _continue()

func _toggle_auto() -> void:
	auto_play = not auto_play
	notice.text = "自动播放已开启" if auto_play else "自动播放已关闭"

func _toggle_fullscreen() -> void:
	var full = DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if full else DisplayServer.WINDOW_MODE_FULLSCREEN)

func _show_history() -> void:
	popup.title = "历史文本"
	popup.dialog_text = "\n\n".join(PackedStringArray(history.slice(maxi(0, history.size() - 30))))
	popup.popup_centered(Vector2i(900, 560))

func _save_path() -> String:
	return "user://galwriter_save_" + str(story.get("projectId", "game")) + ".json"

func _save_game() -> void:
	if busy or not waiting in ["dialogue", "choice"]:
		notice.text = "请在对白或选项出现后存档"
		return
	var poses: Dictionary = {}
	for id in visuals:
		var rect: TextureRect = visuals[id]
		poses[id] = {"position": [rect.position.x, rect.position.y], "scale": [rect.scale.x, rect.scale.y], "rotation": rect.rotation, "color": [rect.modulate.r, rect.modulate.g, rect.modulate.b, rect.modulate.a]}
	var data = {"version": 1, "projectId": story.get("projectId"), "revision": story.get("revision"), "node": current_id, "cursor": cursor, "variables": variables, "waiting": waiting, "text": text_label.text, "speaker": name_label.text, "history": history, "stage": stage_data, "poses": poses, "bgm": bgm_path, "bgm_loop": bgm_loop, "bgm_position": bgm.get_playback_position(), "movie_time": movie_time}
	var file = FileAccess.open(_save_path() + ".tmp", FileAccess.WRITE)
	if file == null:
		notice.text = "存档失败：无法写入用户目录"
		return
	file.store_string(JSON.stringify(data))
	file.close()
	var error = DirAccess.rename_absolute(_save_path() + ".tmp", _save_path())
	notice.text = "存档完成" if error == OK else "存档写入失败"

func _load_game() -> void:
	var data = _read_json(_save_path())
	if data.is_empty():
		notice.text = "尚无存档"
		popup.dialog_text = "尚无存档，请先开始游戏。"
		popup.popup_centered(Vector2i(500, 180))
		return
	if data.get("version") != 1 or data.get("revision") != story.get("revision") or not blocks.has(str(data.get("node", ""))):
		popup.dialog_text = "存档属于其他版本的剧情，请开始新游戏。"
		popup.popup_centered(Vector2i(500, 180))
		return
	_cancel()
	current_id = str(data["node"])
	cursor = int(data.get("cursor", 0))
	variables = data.get("variables", {}).duplicate(true)
	history = data.get("history", []).duplicate()
	stage_data = data.get("stage", {}).duplicate(true)
	_build_stage(false)
	for id in data.get("poses", {}):
		if not visuals.has(id): continue
		var pose: Dictionary = data["poses"][id]
		visuals[id].position = Vector2(pose["position"][0], pose["position"][1])
		visuals[id].scale = Vector2(pose["scale"][0], pose["scale"][1])
		visuals[id].rotation = float(pose["rotation"])
		visuals[id].modulate = Color(pose["color"][0], pose["color"][1], pose["color"][2], pose["color"][3])
	_start_movie(stage_data.get("background", {}), float(data.get("movie_time", 0)))
	bgm_path = str(data.get("bgm", ""))
	bgm_loop = bool(data.get("bgm_loop", true))
	if not bgm_path.is_empty(): _play_audio(bgm, bgm_path, float(data.get("bgm_position", 0)))
	name_label.text = str(data.get("speaker", ""))
	text_label.text = str(data.get("text", ""))
	text_label.visible_characters = -1
	waiting = str(data.get("waiting", "dialogue"))
	_clear_choices()
	if waiting == "choice": _show_choices(blocks[current_id].get("control", {}))
	title_panel.hide()
	dialogue_panel.show()
	toolbar.show()
	auto_wait = 0
	notice.text = "读档完成"
`;
