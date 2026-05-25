use std::{
  env,
  fs,
  io::Write,
  path::{Path, PathBuf},
  process::Command,
  time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, WindowEvent};

#[derive(serde::Serialize)]
struct RenderSaveResult {
  path: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RenderSessionResult {
  work_dir: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenderedFrame {
  bytes: Vec<u8>,
  duration_secs: f64,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct HighPerfSegment {
  title: Option<String>,
  text: Option<String>,
  image_path: Option<String>,
  video_path: Option<String>,
  audio_path: Option<String>,
  duration_secs: Option<f64>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenderTextStyle {
  title_font_size: u32,
  body_font_size: u32,
  title_color: String,
  body_color: String,
}

fn sanitize_file_name(file_name: &str) -> String {
  let sanitized: String = file_name
    .chars()
    .map(|ch| match ch {
      '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
      _ => ch,
    })
    .collect();

  let trimmed = sanitized.trim().trim_matches('.').to_string();
  if trimmed.is_empty() {
    "galwriter-render".to_string()
  } else {
    trimmed
  }
}

fn downloads_dir() -> PathBuf {
  if cfg!(target_os = "windows") {
    if let Ok(user_profile) = env::var("USERPROFILE") {
      return PathBuf::from(user_profile).join("Downloads");
    }
  }

  if let Ok(home) = env::var("HOME") {
    return PathBuf::from(home).join("Downloads");
  }

  env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn unique_path(dir: &Path, stem: &str, extension: &str) -> PathBuf {
  let mut candidate = dir.join(format!("{stem}.{extension}"));
  let mut index = 1;

  while candidate.exists() {
    candidate = dir.join(format!("{stem}-{index}.{extension}"));
    index += 1;
  }

  candidate
}

fn powershell_encoded_command(script: &str) -> String {
  let bytes: Vec<u8> = script
    .encode_utf16()
    .flat_map(|unit| unit.to_le_bytes())
    .collect();
  const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let mut encoded = String::new();

  for chunk in bytes.chunks(3) {
    let b0 = chunk[0];
    let b1 = *chunk.get(1).unwrap_or(&0);
    let b2 = *chunk.get(2).unwrap_or(&0);
    encoded.push(TABLE[(b0 >> 2) as usize] as char);
    encoded.push(TABLE[(((b0 & 0b0000_0011) << 4) | (b1 >> 4)) as usize] as char);
    if chunk.len() > 1 {
      encoded.push(TABLE[(((b1 & 0b0000_1111) << 2) | (b2 >> 6)) as usize] as char);
    } else {
      encoded.push('=');
    }
    if chunk.len() > 2 {
      encoded.push(TABLE[(b2 & 0b0011_1111) as usize] as char);
    } else {
      encoded.push('=');
    }
  }

  encoded
}

fn powershell_single_quoted(value: &str) -> String {
  format!("'{}'", value.replace('\'', "''"))
}

fn escape_concat_path(path: &Path) -> String {
  path
    .to_string_lossy()
    .replace('\\', "/")
    .replace('\'', "'\\''")
}

fn escape_filter_path(path: &Path) -> String {
  path
    .to_string_lossy()
    .replace('\\', "/")
    .replace(':', "\\:")
    .replace('\'', "\\'")
}

fn safe_join(base: &Path, relative: &str) -> Result<PathBuf, String> {
  let relative = relative.replace('\\', "/");
  if relative.starts_with('/') || relative.contains("..") {
    return Err("Unsafe asset path.".to_string());
  }
  Ok(base.join(relative))
}

fn ass_time(seconds: f64) -> String {
  let total_cs = (seconds.max(0.0) * 100.0).round() as u64;
  let cs = total_cs % 100;
  let total_seconds = total_cs / 100;
  let s = total_seconds % 60;
  let total_minutes = total_seconds / 60;
  let m = total_minutes % 60;
  let h = total_minutes / 60;
  format!("{h}:{m:02}:{s:02}.{cs:02}")
}

fn escape_ass(text: &str) -> String {
  text
    .replace('\\', "\\\\")
    .replace('{', "\\{")
    .replace('}', "\\}")
    .replace('\r', "")
    .replace('\n', "\\N")
}

fn atempo_filter(speed: f64) -> String {
  let mut remaining = speed.clamp(0.25, 4.0);
  let mut parts = Vec::new();
  while remaining > 2.0 {
    parts.push("atempo=2.0".to_string());
    remaining /= 2.0;
  }
  while remaining < 0.5 {
    parts.push("atempo=0.5".to_string());
    remaining /= 0.5;
  }
  parts.push(format!("atempo={remaining:.3}"));
  parts.join(",")
}

fn encoder_args(encoder: &str) -> Vec<String> {
  match encoder {
    "h264_nvenc" => vec!["-c:v", "h264_nvenc", "-preset", "p4", "-cq", "21"],
    "h264_qsv" => vec!["-c:v", "h264_qsv", "-preset", "veryfast", "-global_quality", "23"],
    "h264_amf" => vec!["-c:v", "h264_amf", "-quality", "speed", "-qp_i", "22", "-qp_p", "22"],
    _ => vec!["-c:v", "libx264", "-preset", "veryfast", "-crf", "20"],
  }
  .into_iter()
  .map(String::from)
  .collect()
}

fn ffmpeg_duration(app: &AppHandle, path: &Path) -> Option<f64> {
  let output = Command::new(find_ffmpeg(app))
    .arg("-hide_banner")
    .arg("-i")
    .arg(path)
    .output()
    .ok()?;
  let stderr = String::from_utf8_lossy(&output.stderr);
  let marker = "Duration: ";
  let start = stderr.find(marker)? + marker.len();
  let duration = stderr.get(start..start + 11)?;
  let mut parts = duration.split(':');
  let hours: f64 = parts.next()?.parse().ok()?;
  let minutes: f64 = parts.next()?.parse().ok()?;
  let seconds: f64 = parts.next()?.parse().ok()?;
  Some(hours * 3600.0 + minutes * 60.0 + seconds)
}

fn write_ass_file(
  path: &Path,
  title: &str,
  body: &str,
  duration: f64,
  width: u32,
  height: u32,
  style: &RenderTextStyle,
  typewriter: bool,
) -> Result<(), String> {
  let font_name = "Microsoft YaHei";
  let margin_v = (height as f64 * 0.10).round() as u32;
  let title_color = ass_color(&style.title_color);
  let body_color = ass_color(&style.body_color);
  let mut ass = format!(
    "[Script Info]\nScriptType: v4.00+\nPlayResX: {width}\nPlayResY: {height}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Title,{font_name},{},{title_color},&H000000FF,&HAA000000,&H99000000,1,0,0,0,100,100,0,0,1,2,1,2,80,80,{},1\nStyle: Body,{font_name},{},{body_color},&H000000FF,&HAA000000,&H99000000,0,0,0,0,100,100,0,0,1,2,1,2,80,80,{},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n",
    style.title_font_size,
    margin_v + style.body_font_size + 20,
    style.body_font_size,
    margin_v
  );

  if !title.trim().is_empty() {
    ass.push_str(&format!(
      "Dialogue: 0,{},{},Title,,0,0,0,,{}\n",
      ass_time(0.0),
      ass_time(duration),
      escape_ass(title)
    ));
  }

  let body_text = body.trim();
  if !body_text.is_empty() {
    if typewriter {
      let chars: Vec<char> = body_text.chars().collect();
      let step = (duration / chars.len().max(1) as f64).clamp(0.035, 0.12);
      for index in 1..=chars.len() {
        let shown: String = chars.iter().take(index).collect();
        ass.push_str(&format!(
          "Dialogue: 1,{},{},Body,,0,0,0,,{}\n",
          ass_time((index - 1) as f64 * step),
          ass_time(duration),
          escape_ass(&shown)
        ));
      }
    } else {
      ass.push_str(&format!(
        "Dialogue: 1,{},{},Body,,0,0,0,,{}\n",
        ass_time(0.0),
        ass_time(duration),
        escape_ass(body_text)
      ));
    }
  }

  fs::write(path, ass).map_err(|err| format!("Failed to write subtitle file: {err}"))
}

fn ass_color(hex: &str) -> String {
  let cleaned = hex.trim().trim_start_matches('#');
  if cleaned.len() == 6 {
    let r = &cleaned[0..2];
    let g = &cleaned[2..4];
    let b = &cleaned[4..6];
    format!("&H00{b}{g}{r}")
  } else {
    "&H00FFFFFF".to_string()
  }
}

fn validate_bitrate(bitrate: &str) -> Result<String, String> {
  let trimmed = bitrate.trim();
  if trimmed.is_empty() {
    return Ok("6000k".to_string());
  }

  let valid = trimmed.len() <= 12
    && trimmed
      .chars()
      .all(|ch| ch.is_ascii_digit() || matches!(ch, 'k' | 'K' | 'm' | 'M'));

  if !valid {
    return Err("Invalid bitrate. Use values like 4000k, 6000k, or 8M.".to_string());
  }

  Ok(trimmed.to_string())
}

fn find_ffmpeg(app: &AppHandle) -> PathBuf {
  if let Ok(resource_dir) = app.path().resource_dir() {
    let bundled = resource_dir
      .join("binaries")
      .join(if cfg!(target_os = "windows") { "ffmpeg.exe" } else { "ffmpeg" });
    if bundled.exists() {
      return bundled;
    }
  }

  if let Ok(exe) = env::current_exe() {
    if let Some(dir) = exe.parent() {
      let local = dir.join(if cfg!(target_os = "windows") { "ffmpeg.exe" } else { "ffmpeg" });
      if local.exists() {
        return local;
      }
    }
  }

  PathBuf::from("ffmpeg")
}

#[tauri::command]
fn default_render_dir() -> Result<RenderSaveResult, String> {
  let dir = downloads_dir();
  fs::create_dir_all(&dir).map_err(|err| format!("Failed to create Downloads directory: {err}"))?;
  Ok(RenderSaveResult {
    path: dir.to_string_lossy().to_string(),
  })
}

#[tauri::command]
fn synthesize_system_speech(text: String) -> Result<Vec<u8>, String> {
  let input = text.trim();
  if input.is_empty() {
    return Err("No text to synthesize.".to_string());
  }

  let mut output_path = env::temp_dir();
  let timestamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map_err(|err| format!("System clock error: {err}"))?
    .as_millis();
  output_path.push(format!("galwriter-system-tts-{timestamp}.wav"));

  let text_json = serde_json::to_string(input).map_err(|err| format!("Failed to encode speech text: {err}"))?;
  let path_json = serde_json::to_string(&output_path.to_string_lossy().to_string())
    .map_err(|err| format!("Failed to encode speech path: {err}"))?;
  let text_json_literal = powershell_single_quoted(&text_json);
  let path_json_literal = powershell_single_quoted(&path_json);
  let script = format!(
    r#"
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$text = ConvertFrom-Json -InputObject {text_json_literal}
$path = ConvertFrom-Json -InputObject {path_json_literal}
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {{
  $synth.SetOutputToWaveFile($path)
  $synth.Speak($text)
}} finally {{
  $synth.Dispose()
}}
"#
  );

  let output = Command::new("powershell")
    .arg("-NoProfile")
    .arg("-NonInteractive")
    .arg("-ExecutionPolicy")
    .arg("Bypass")
    .arg("-EncodedCommand")
    .arg(powershell_encoded_command(&script))
    .output()
    .map_err(|err| format!("Failed to start Windows speech synthesizer: {err}"))?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    let _ = fs::remove_file(&output_path);
    return Err(format!("System speech synthesis failed: {stderr}"));
  }

  let bytes = fs::read(&output_path).map_err(|err| format!("Failed to read synthesized audio: {err}"))?;
  let _ = fs::remove_file(&output_path);
  Ok(bytes)
}

#[tauri::command]
fn force_quit_app(app: AppHandle) {
  app.exit(0);
}

#[tauri::command]
fn save_rendered_video(
  app: AppHandle,
  file_name: String,
  format: String,
  bytes: Vec<u8>,
  output_dir: Option<String>,
  video_bitrate: Option<String>,
) -> Result<RenderSaveResult, String> {
  let format = format.to_lowercase();
  if !["webm", "mp4", "mkv"].contains(&format.as_str()) {
    return Err("Unsupported video format.".to_string());
  }

  let output_dir = output_dir
    .filter(|dir| !dir.trim().is_empty())
    .map(PathBuf::from)
    .unwrap_or_else(downloads_dir);
  fs::create_dir_all(&output_dir).map_err(|err| format!("Failed to create Downloads directory: {err}"))?;

  let stem = sanitize_file_name(&file_name);
  let video_bitrate = validate_bitrate(video_bitrate.as_deref().unwrap_or(""))?;

  if format == "webm" {
    let output_path = unique_path(&output_dir, &stem, "webm");
    fs::write(&output_path, bytes).map_err(|err| format!("Failed to save WebM file: {err}"))?;
    return Ok(RenderSaveResult {
      path: output_path.to_string_lossy().to_string(),
    });
  }

  let temp_input = unique_path(&output_dir, &format!("{stem}-source"), "webm");
  fs::write(&temp_input, bytes).map_err(|err| format!("Failed to write temporary WebM file: {err}"))?;

  let output_path = unique_path(&output_dir, &stem, &format);
  let ffmpeg = find_ffmpeg(&app);

  let mut command = Command::new(ffmpeg);
  command
    .arg("-y")
    .arg("-i")
    .arg(&temp_input)
    .arg("-map")
    .arg("0:v:0")
    .arg("-map")
    .arg("0:a?")
    .arg("-r")
    .arg("30")
    .arg("-c:v")
    .arg("libx264")
    .arg("-preset")
    .arg("veryfast")
    .arg("-b:v")
    .arg(&video_bitrate)
    .arg("-pix_fmt")
    .arg("yuv420p")
    .arg("-c:a")
    .arg("aac")
    .arg("-b:a")
    .arg("160k")
    .arg("-shortest")
    .arg("-max_muxing_queue_size")
    .arg("1024");

  if format == "mp4" {
    command
      .arg("-movflags")
      .arg("+faststart")
      .arg("-f")
      .arg("mp4");
  } else {
    command
      .arg("-f")
      .arg("matroska");
  }

  let output = command
    .arg(&output_path)
    .output()
    .map_err(|err| format!("Failed to start FFmpeg. The bundled ffmpeg.exe may be missing or blocked: {err}"))?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    return Err(format!(
      "FFmpeg conversion failed. Source WebM kept at {}. Details: {stderr}",
      temp_input.to_string_lossy()
    ));
  }

  let _ = fs::remove_file(&temp_input);

  Ok(RenderSaveResult {
    path: output_path.to_string_lossy().to_string(),
  })
}

#[tauri::command]
fn create_render_session(
  file_name: String,
  output_dir: Option<String>,
) -> Result<RenderSessionResult, String> {
  let output_dir = output_dir
    .filter(|dir| !dir.trim().is_empty())
    .map(PathBuf::from)
    .unwrap_or_else(downloads_dir);
  fs::create_dir_all(&output_dir).map_err(|err| format!("Failed to create output directory: {err}"))?;

  let stem = sanitize_file_name(&file_name);
  let work_dir = unique_path(&output_dir, &format!("{stem}-render-work"), "tmp");
  fs::create_dir_all(&work_dir).map_err(|err| format!("Failed to create render work directory: {err}"))?;

  Ok(RenderSessionResult {
    work_dir: work_dir.to_string_lossy().to_string(),
  })
}

#[tauri::command]
fn write_render_frame(
  work_dir: String,
  index: usize,
  bytes: Vec<u8>,
) -> Result<(), String> {
  let work_dir = PathBuf::from(work_dir);
  fs::create_dir_all(&work_dir).map_err(|err| format!("Failed to create render work directory: {err}"))?;
  let frame_path = work_dir.join(format!("frame_{index:05}.png"));
  fs::write(&frame_path, bytes).map_err(|err| format!("Failed to write frame {index}: {err}"))
}

#[tauri::command]
fn write_render_audio_chunk(
  work_dir: String,
  bytes: Vec<u8>,
  append: bool,
) -> Result<(), String> {
  let work_dir = PathBuf::from(work_dir);
  fs::create_dir_all(&work_dir).map_err(|err| format!("Failed to create render work directory: {err}"))?;
  let audio_path = work_dir.join("audio.wav");
  let mut options = fs::OpenOptions::new();
  options.create(true).write(true);
  if append {
    options.append(true);
  } else {
    options.truncate(true);
  }
  let mut file = options.open(&audio_path).map_err(|err| format!("Failed to open audio track: {err}"))?;
  file.write_all(&bytes).map_err(|err| format!("Failed to write audio track: {err}"))
}

#[tauri::command]
fn write_render_asset_chunk(
  work_dir: String,
  asset_path: String,
  bytes: Vec<u8>,
  append: bool,
) -> Result<(), String> {
  let work_dir = PathBuf::from(work_dir);
  let target = safe_join(&work_dir, &asset_path)?;
  if let Some(parent) = target.parent() {
    fs::create_dir_all(parent).map_err(|err| format!("Failed to create asset directory: {err}"))?;
  }
  let mut options = fs::OpenOptions::new();
  options.create(true).write(true);
  if append {
    options.append(true);
  } else {
    options.truncate(true);
  }
  let mut file = options.open(&target).map_err(|err| format!("Failed to open asset: {err}"))?;
  file.write_all(&bytes).map_err(|err| format!("Failed to write asset: {err}"))
}

#[tauri::command]
fn finish_render_session(
  app: AppHandle,
  file_name: String,
  format: String,
  work_dir: String,
  frame_durations: Vec<f64>,
  output_dir: Option<String>,
  video_bitrate: Option<String>,
  frame_rate: Option<u32>,
) -> Result<RenderSaveResult, String> {
  let format = format.to_lowercase();
  if !["mp4", "mkv"].contains(&format.as_str()) {
    return Err("Frame rendering supports MP4 and MKV only.".to_string());
  }

  if frame_durations.is_empty() {
    return Err("No frames were rendered.".to_string());
  }

  let output_dir = output_dir
    .filter(|dir| !dir.trim().is_empty())
    .map(PathBuf::from)
    .unwrap_or_else(downloads_dir);
  fs::create_dir_all(&output_dir).map_err(|err| format!("Failed to create output directory: {err}"))?;

  let stem = sanitize_file_name(&file_name);
  let video_bitrate = validate_bitrate(video_bitrate.as_deref().unwrap_or(""))?;
  let output_path = unique_path(&output_dir, &stem, &format);
  let work_dir = PathBuf::from(work_dir);
  let frame_rate = frame_rate.unwrap_or(30).clamp(1, 120).to_string();

  let mut concat = String::new();
  for (index, duration_secs) in frame_durations.iter().enumerate() {
    let frame_path = work_dir.join(format!("frame_{index:05}.png"));
    if !frame_path.exists() {
      return Err(format!("Rendered frame {index} is missing."));
    }
    concat.push_str(&format!("file '{}'\n", escape_concat_path(&frame_path)));
    concat.push_str(&format!("duration {:.3}\n", duration_secs.max(0.01)));
  }

  let last_path = work_dir.join(format!("frame_{:05}.png", frame_durations.len() - 1));
  concat.push_str(&format!("file '{}'\n", escape_concat_path(&last_path)));

  let concat_path = work_dir.join("frames.txt");
  fs::write(&concat_path, concat).map_err(|err| format!("Failed to write frame list: {err}"))?;

  let audio_path = work_dir.join("audio.wav");
  let has_audio = audio_path.exists();

  let ffmpeg = find_ffmpeg(&app);
  let mut command = Command::new(ffmpeg);
  command
    .arg("-y")
    .arg("-f")
    .arg("concat")
    .arg("-safe")
    .arg("0")
    .arg("-i")
    .arg(&concat_path);

  if has_audio {
    command.arg("-i").arg(&audio_path);
  } else {
    command
      .arg("-f")
      .arg("lavfi")
      .arg("-i")
      .arg("anullsrc=channel_layout=stereo:sample_rate=48000");
  }

  command
    .arg("-map")
    .arg("0:v:0")
    .arg("-map")
    .arg("1:a:0")
    .arg("-r")
    .arg(&frame_rate)
    .arg("-c:v")
    .arg("libx264")
    .arg("-preset")
    .arg("veryfast")
    .arg("-b:v")
    .arg(&video_bitrate)
    .arg("-pix_fmt")
    .arg("yuv420p")
    .arg("-c:a")
    .arg("aac")
    .arg("-b:a")
    .arg("128k")
    .arg("-shortest");

  if format == "mp4" {
    command
      .arg("-movflags")
      .arg("+faststart")
      .arg("-f")
      .arg("mp4");
  } else {
    command
      .arg("-f")
      .arg("matroska");
  }

  let output = command
    .arg(&output_path)
    .output()
    .map_err(|err| format!("Failed to start bundled FFmpeg: {err}"))?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    return Err(format!(
      "FFmpeg frame rendering failed. Work files kept at {}. Details: {stderr}",
      work_dir.to_string_lossy()
    ));
  }

  let _ = fs::remove_dir_all(&work_dir);

  Ok(RenderSaveResult {
    path: output_path.to_string_lossy().to_string(),
  })
}

#[tauri::command]
fn finish_high_perf_render(
  app: AppHandle,
  file_name: String,
  format: String,
  work_dir: String,
  segments: Vec<HighPerfSegment>,
  width: u32,
  height: u32,
  frame_rate: u32,
  speed: f64,
  default_seconds: f64,
  output_dir: Option<String>,
  encoder: Option<String>,
  typewriter: bool,
  text_style: RenderTextStyle,
) -> Result<RenderSaveResult, String> {
  let format = format.to_lowercase();
  if !["mp4", "mkv"].contains(&format.as_str()) {
    return Err("High performance rendering supports MP4 and MKV only.".to_string());
  }
  if segments.is_empty() {
    return Err("No segments selected.".to_string());
  }

  let output_dir = output_dir
    .filter(|dir| !dir.trim().is_empty())
    .map(PathBuf::from)
    .unwrap_or_else(downloads_dir);
  fs::create_dir_all(&output_dir).map_err(|err| format!("Failed to create output directory: {err}"))?;

  let work_dir = PathBuf::from(work_dir);
  let segment_dir = work_dir.join("segments");
  fs::create_dir_all(&segment_dir).map_err(|err| format!("Failed to create segment directory: {err}"))?;
  let encoder = encoder.unwrap_or_else(|| "libx264".to_string());
  let speed = speed.clamp(0.25, 4.0);
  let mut rendered_segments = Vec::new();

  for (index, segment) in segments.iter().enumerate() {
    let image_path = segment.image_path.as_deref().and_then(|path| safe_join(&work_dir, path).ok()).filter(|path| path.exists());
    let video_path = segment.video_path.as_deref().and_then(|path| safe_join(&work_dir, path).ok()).filter(|path| path.exists());
    let audio_path = segment.audio_path.as_deref().and_then(|path| safe_join(&work_dir, path).ok()).filter(|path| path.exists());

    let source_duration = segment.duration_secs
      .or_else(|| video_path.as_ref().and_then(|path| ffmpeg_duration(&app, path)))
      .or_else(|| audio_path.as_ref().and_then(|path| ffmpeg_duration(&app, path)))
      .unwrap_or(default_seconds)
      .max(0.5);
    let duration = (source_duration / speed).max(0.5);
    let mut audio_for_segment = audio_path.clone();
    if audio_for_segment.is_none() {
      if let Some(video) = &video_path {
        let extracted_audio = segment_dir.join(format!("segment_{index:04}_video_audio.wav"));
        let extract_output = Command::new(find_ffmpeg(&app))
          .arg("-y")
          .arg("-i")
          .arg(video)
          .arg("-vn")
          .arg("-t")
          .arg(format!("{source_duration:.3}"))
          .arg("-ac")
          .arg("2")
          .arg("-ar")
          .arg("48000")
          .arg(&extracted_audio)
          .output();
        if extract_output.as_ref().map(|output| output.status.success()).unwrap_or(false) {
          audio_for_segment = Some(extracted_audio);
        }
      }
    }
    let ass_path = segment_dir.join(format!("segment_{index:04}.ass"));
    write_ass_file(
      &ass_path,
      segment.title.as_deref().unwrap_or(""),
      segment.text.as_deref().unwrap_or(""),
      duration,
      width,
      height,
      &text_style,
      typewriter,
    )?;

    let segment_output = segment_dir.join(format!("segment_{index:04}.mp4"));
    let mut command = Command::new(find_ffmpeg(&app));
    command.current_dir(&work_dir).arg("-y");

    let vf = format!(
      "scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},subtitles={}",
      escape_filter_path(&ass_path)
    );

    if let Some(video) = &video_path {
      command.arg("-i").arg(video);
      if let Some(audio) = &audio_for_segment {
        command.arg("-i").arg(audio);
      }
      command
        .arg("-t")
        .arg(format!("{source_duration:.3}"))
        .arg("-filter:v")
        .arg(format!("setpts=PTS/{speed:.3},{vf}"))
        .arg("-r")
        .arg(frame_rate.to_string())
        .arg("-map")
        .arg("0:v:0");
      if audio_for_segment.is_some() {
        command
          .arg("-map")
          .arg("1:a:0")
          .arg("-filter:a")
          .arg(atempo_filter(speed));
      } else {
        command.arg("-an");
      }
    } else if let Some(image) = &image_path {
      command
        .arg("-loop")
        .arg("1")
        .arg("-t")
        .arg(format!("{duration:.3}"))
        .arg("-i")
        .arg(image);
      if let Some(audio) = &audio_for_segment {
        command.arg("-i").arg(audio);
      } else {
        command
          .arg("-f")
          .arg("lavfi")
          .arg("-t")
          .arg(format!("{duration:.3}"))
          .arg("-i")
          .arg("anullsrc=channel_layout=stereo:sample_rate=48000");
      }
      command
        .arg("-filter:v")
        .arg(&vf)
        .arg("-r")
        .arg(frame_rate.to_string())
        .arg("-map")
        .arg("0:v:0")
        .arg("-map")
        .arg("1:a:0");
      if audio_for_segment.is_some() {
        command.arg("-filter:a").arg(atempo_filter(speed));
      }
    } else {
      command
        .arg("-f")
        .arg("lavfi")
        .arg("-t")
        .arg(format!("{duration:.3}"))
        .arg("-i")
        .arg(format!("color=c=0x111827:s={}x{}:r={}", width, height, frame_rate))
        .arg("-f")
        .arg("lavfi")
        .arg("-t")
        .arg(format!("{duration:.3}"))
        .arg("-i")
        .arg("anullsrc=channel_layout=stereo:sample_rate=48000")
        .arg("-filter:v")
        .arg(format!("subtitles={}", escape_filter_path(&ass_path)))
        .arg("-map")
        .arg("0:v:0")
        .arg("-map")
        .arg("1:a:0");
    }

    for arg in encoder_args(&encoder) {
      command.arg(arg);
    }
    command
      .arg("-pix_fmt")
      .arg("yuv420p")
      .arg("-c:a")
      .arg("aac")
      .arg("-b:a")
      .arg("160k")
      .arg("-shortest")
      .arg(&segment_output);

    let output = command
      .output()
      .map_err(|err| format!("Failed to start FFmpeg for segment {}: {err}", index + 1))?;
    if !output.status.success() {
      let stderr = String::from_utf8_lossy(&output.stderr);
      return Err(format!(
        "FFmpeg failed on segment {}. Work files kept at {}. Details: {stderr}",
        index + 1,
        work_dir.to_string_lossy()
      ));
    }

    rendered_segments.push(segment_output);
  }

  let concat_path = segment_dir.join("segments.txt");
  let mut concat = String::new();
  for segment in &rendered_segments {
    concat.push_str(&format!("file '{}'\n", escape_concat_path(segment)));
  }
  fs::write(&concat_path, concat).map_err(|err| format!("Failed to write segment list: {err}"))?;

  let stem = sanitize_file_name(&file_name);
  let output_path = unique_path(&output_dir, &stem, &format);
  let mut concat_command = Command::new(find_ffmpeg(&app));
  concat_command
    .arg("-y")
    .arg("-f")
    .arg("concat")
    .arg("-safe")
    .arg("0")
    .arg("-i")
    .arg(&concat_path)
    .arg("-c")
    .arg("copy");
  if format == "mp4" {
    concat_command.arg("-movflags").arg("+faststart").arg("-f").arg("mp4");
  } else {
    concat_command.arg("-f").arg("matroska");
  }
  let output = concat_command
    .arg(&output_path)
    .output()
    .map_err(|err| format!("Failed to start FFmpeg concat: {err}"))?;
  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    return Err(format!(
      "FFmpeg concat failed. Work files kept at {}. Details: {stderr}",
      work_dir.to_string_lossy()
    ));
  }

  let _ = fs::remove_dir_all(&work_dir);
  Ok(RenderSaveResult {
    path: output_path.to_string_lossy().to_string(),
  })
}

#[tauri::command]
fn save_rendered_frames(
  app: AppHandle,
  file_name: String,
  format: String,
  frames: Vec<RenderedFrame>,
  audio_bytes: Option<Vec<u8>>,
  output_dir: Option<String>,
  video_bitrate: Option<String>,
) -> Result<RenderSaveResult, String> {
  let format = format.to_lowercase();
  if !["mp4", "mkv"].contains(&format.as_str()) {
    return Err("Frame rendering supports MP4 and MKV only.".to_string());
  }

  if frames.is_empty() {
    return Err("No frames were rendered.".to_string());
  }

  let output_dir = output_dir
    .filter(|dir| !dir.trim().is_empty())
    .map(PathBuf::from)
    .unwrap_or_else(downloads_dir);
  fs::create_dir_all(&output_dir).map_err(|err| format!("Failed to create output directory: {err}"))?;

  let stem = sanitize_file_name(&file_name);
  let video_bitrate = validate_bitrate(video_bitrate.as_deref().unwrap_or(""))?;
  let output_path = unique_path(&output_dir, &stem, &format);
  let work_dir = unique_path(&output_dir, &format!("{stem}-frames"), "tmp");
  fs::create_dir_all(&work_dir).map_err(|err| format!("Failed to create frame work directory: {err}"))?;

  let mut concat = String::new();
  for (index, frame) in frames.iter().enumerate() {
    let frame_path = work_dir.join(format!("frame_{index:05}.png"));
    fs::write(&frame_path, &frame.bytes).map_err(|err| format!("Failed to write frame {index}: {err}"))?;
    let duration = frame.duration_secs.max(0.25);
    concat.push_str(&format!("file '{}'\n", escape_concat_path(&frame_path)));
    concat.push_str(&format!("duration {:.3}\n", duration));
  }

  if let Some(last_index) = frames.len().checked_sub(1) {
    let last_path = work_dir.join(format!("frame_{last_index:05}.png"));
    concat.push_str(&format!("file '{}'\n", escape_concat_path(&last_path)));
  }

  let concat_path = work_dir.join("frames.txt");
  fs::write(&concat_path, concat).map_err(|err| format!("Failed to write frame list: {err}"))?;

  let audio_path = match audio_bytes {
    Some(bytes) if !bytes.is_empty() => {
      let path = work_dir.join("audio.wav");
      fs::write(&path, bytes).map_err(|err| format!("Failed to write audio track: {err}"))?;
      Some(path)
    }
    _ => None,
  };

  let ffmpeg = find_ffmpeg(&app);
  let mut command = Command::new(ffmpeg);
  command
    .arg("-y")
    .arg("-f")
    .arg("concat")
    .arg("-safe")
    .arg("0")
    .arg("-i")
    .arg(&concat_path);

  if let Some(path) = &audio_path {
    command
      .arg("-i")
      .arg(path);
  } else {
    command
      .arg("-f")
      .arg("lavfi")
      .arg("-i")
      .arg("anullsrc=channel_layout=stereo:sample_rate=48000");
  }

  command
    .arg("-map")
    .arg("0:v:0")
    .arg("-map")
    .arg("1:a:0")
    .arg("-r")
    .arg("30")
    .arg("-c:v")
    .arg("libx264")
    .arg("-preset")
    .arg("veryfast")
    .arg("-b:v")
    .arg(&video_bitrate)
    .arg("-pix_fmt")
    .arg("yuv420p")
    .arg("-c:a")
    .arg("aac")
    .arg("-b:a")
    .arg("128k")
    .arg("-shortest");

  if format == "mp4" {
    command
      .arg("-movflags")
      .arg("+faststart")
      .arg("-f")
      .arg("mp4");
  } else {
    command
      .arg("-f")
      .arg("matroska");
  }

  let output = command
    .arg(&output_path)
    .output()
    .map_err(|err| format!("Failed to start bundled FFmpeg: {err}"))?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    return Err(format!(
      "FFmpeg frame rendering failed. Frames kept at {}. Details: {stderr}",
      work_dir.to_string_lossy()
    ));
  }

  let _ = fs::remove_dir_all(&work_dir);

  Ok(RenderSaveResult {
    path: output_path.to_string_lossy().to_string(),
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .on_window_event(|window, event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.minimize();
      }
    })
    .invoke_handler(tauri::generate_handler![
      default_render_dir,
      synthesize_system_speech,
      force_quit_app,
      save_rendered_video,
      save_rendered_frames,
      create_render_session,
      write_render_frame,
      write_render_audio_chunk,
      write_render_asset_chunk,
      finish_high_perf_render,
      finish_render_session
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
