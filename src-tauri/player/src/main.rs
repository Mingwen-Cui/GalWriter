#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[path = "../../src/player_package.rs"]
#[allow(dead_code)] // Packaging functions are shared with the editor and its tests.
mod player_package;
mod response;

use std::{
    fs,
    io::{Cursor, Read, Seek, SeekFrom},
    sync::{Arc, Mutex},
};

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let executable = std::env::current_exe()?;
    let mut file = fs::File::open(&executable)?;
    file.seek(SeekFrom::End(-(player_package::FOOTER_SIZE as i64)))?;
    let mut footer = [0; player_package::FOOTER_SIZE];
    file.read_exact(&mut footer)?;
    let data = fs::read(executable.with_file_name("game.dat"))?;
    let content = player_package::verify(&footer, &data)?;
    let archive = Arc::new(Mutex::new(zip::ZipArchive::new(Cursor::new(
        content.to_vec(),
    ))?));
    // Separate storage origins for separately exported games. Saves remain writable.
    let identity = footer[16..32]
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    let scheme = format!("gw{identity}");
    let url = tauri::Url::parse(&format!("http://{scheme}.localhost/index.html"))?;
    let allowed_host = format!("{scheme}.localhost");
    tauri::Builder::default()
        .register_uri_scheme_protocol(scheme, move |_context, request| {
            let path = response::decode_path(request.uri().path());
            let bytes = path.as_deref().and_then(|path| {
                archive
                    .lock()
                    .ok()
                    .and_then(|mut zip| player_package::read_asset(&mut zip, path))
            });
            response::asset_response(
                path.as_deref().unwrap_or(""),
                bytes,
                request
                    .headers()
                    .get("range")
                    .and_then(|value| value.to_str().ok()),
                request.method() == "HEAD",
            )
        })
        .setup(move |app| {
            tauri::WebviewWindowBuilder::new(app, "game", tauri::WebviewUrl::External(url))
                .title(
                    executable
                        .file_stem()
                        .and_then(|name| name.to_str())
                        .unwrap_or("Game"),
                )
                .inner_size(1280.0, 720.0)
                .center()
                .devtools(false)
                .on_navigation(move |url| url.host_str() == Some(allowed_host.as_str()))
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())?;
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        // Always fail closed. Never open an editor or unverified HTML on failure.
        let message = format!("游戏无法启动 / Cannot start game\n\n{error}");
        let html = format!("<!doctype html><meta charset=utf-8><title>Game error</title><body style='font:18px system-ui;padding:40px;white-space:pre-wrap'>{}</body>", message.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;"));
        let _ = tauri::Builder::default()
            .register_uri_scheme_protocol("gameerror", move |_, _| {
                tauri::http::Response::builder()
                    .header("Content-Type", "text/html; charset=utf-8")
                    .body(html.clone().into_bytes())
                    .unwrap()
            })
            .setup(|app| {
                tauri::WebviewWindowBuilder::new(
                    app,
                    "error",
                    tauri::WebviewUrl::External("http://gameerror.localhost/".parse()?),
                )
                .title("Game error")
                .inner_size(640.0, 320.0)
                .devtools(false)
                .build()?;
                Ok(())
            })
            .run(tauri::generate_context!());
    }
}
