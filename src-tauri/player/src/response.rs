use tauri::http::{Response, StatusCode};

pub fn decode_path(path: &str) -> Option<String> {
    let path = percent_encoding::percent_decode_str(path)
        .decode_utf8()
        .ok()?;
    let path = path.trim_start_matches('/');
    if path.split('/').any(|part| part == "..") || path.contains('\\') {
        return None;
    }
    Some(if path.is_empty() { "index.html" } else { path }.to_string())
}

pub fn asset_response(
    path: &str,
    bytes: Option<Vec<u8>>,
    range: Option<&str>,
    head: bool,
) -> Response<Vec<u8>> {
    let Some(bytes) = bytes else {
        return Response::builder().status(404).body(Vec::new()).unwrap();
    };
    let mime = match path
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "html" => "text/html; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "css" => "text/css",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "gif" => "image/gif",
        "avif" => "image/avif",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mp3" => "audio/mpeg",
        "ogg" | "ogv" => "application/ogg",
        "wav" => "audio/wav",
        "m4a" => "audio/mp4",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        _ => "application/octet-stream",
    };
    let length = bytes.len();
    let mut builder = Response::builder()
        .header("Content-Type", mime)
        .header("Accept-Ranges", "bytes")
        .header("Cache-Control", "no-store");
    if let Some(range) = range {
        let parsed = range
            .strip_prefix("bytes=")
            .and_then(|value| value.split_once('-'))
            .and_then(|(start, end)| {
                if length == 0 {
                    return None;
                }
                if start.is_empty() {
                    let suffix = end.parse::<usize>().ok()?;
                    return (suffix > 0).then_some((length.saturating_sub(suffix), length - 1));
                }
                let start = start.parse::<usize>().ok()?;
                let end = if end.is_empty() {
                    length - 1
                } else {
                    end.parse::<usize>().ok()?.min(length - 1)
                };
                (start <= end && start < length).then_some((start, end))
            });
        if let Some((start, end)) = parsed {
            return builder
                .status(StatusCode::PARTIAL_CONTENT)
                .header("Content-Range", format!("bytes {start}-{end}/{length}"))
                .header("Content-Length", end - start + 1)
                .body(if head {
                    Vec::new()
                } else {
                    bytes[start..=end].to_vec()
                })
                .unwrap();
        }
        return builder
            .status(StatusCode::RANGE_NOT_SATISFIABLE)
            .header("Content-Range", format!("bytes */{length}"))
            .body(Vec::new())
            .unwrap();
    }
    builder = builder.header("Content-Length", length);
    builder.body(if head { Vec::new() } else { bytes }).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn unicode_assets_and_encoded_traversal() {
        assert_eq!(
            decode_path("/images/%E7%AB%8B%E7%BB%98.png").as_deref(),
            Some("images/立绘.png")
        );
        assert!(decode_path("/%2e%2e/content.js").is_none());
        assert!(decode_path("/%ff").is_none());
        assert_eq!(decode_path("/").as_deref(), Some("index.html"));
    }
    #[test]
    fn media_seeking_and_missing_assets() {
        let response = asset_response(
            "clip.mp4",
            Some(vec![0, 1, 2, 3, 4]),
            Some("bytes=2-"),
            false,
        );
        assert_eq!(response.status(), 206);
        assert_eq!(response.headers()["Content-Range"], "bytes 2-4/5");
        assert_eq!(response.body(), &[2, 3, 4]);
        assert_eq!(
            asset_response("x", Some(vec![1]), Some("bytes=8-"), false).status(),
            416
        );
        assert_eq!(asset_response("x", None, None, false).status(), 404);
    }
}
