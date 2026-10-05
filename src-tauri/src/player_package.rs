//! Signed, compressed game content. No editor data or editor runtime is included.
use ring::{
    rand::SystemRandom,
    signature::{self, Ed25519KeyPair, KeyPair},
};
use std::io::{Cursor, Read, Write};

const FOOTER_MAGIC: &[u8; 16] = b"GW-PLAYER-KEY-V1";
const DATA_MAGIC: &[u8; 8] = b"GWDATA01";
pub const FOOTER_SIZE: usize = 48;

pub fn seal(runtime: &[u8], content: &[u8]) -> Result<(Vec<u8>, Vec<u8>), String> {
    // Refuse invalid input before writing a package.
    let mut archive = zip::ZipArchive::new(Cursor::new(content)).map_err(|e| e.to_string())?;
    archive
        .by_name("index.html")
        .map_err(|_| "Game index.html is missing".to_string())?;
    archive
        .by_name("content.js")
        .map_err(|_| "Game content.js is missing".to_string())?;
    let secret = Ed25519KeyPair::generate_pkcs8(&SystemRandom::new())
        .map_err(|_| "Cannot create package signing key")?;
    let signing_key = Ed25519KeyPair::from_pkcs8(secret.as_ref())
        .map_err(|_| "Cannot load package signing key")?;
    let mut message = Vec::with_capacity(DATA_MAGIC.len() + content.len());
    message.extend_from_slice(DATA_MAGIC);
    message.extend_from_slice(content);
    let signature = signing_key.sign(&message);
    let mut data = Vec::with_capacity(message.len() + 64);
    data.extend_from_slice(signature.as_ref());
    data.extend_from_slice(&message);
    let mut executable = runtime.to_vec();
    executable.extend_from_slice(FOOTER_MAGIC);
    executable.extend_from_slice(signing_key.public_key().as_ref());
    // The private key is never shipped; edits cannot be signed with the public key.
    Ok((executable, data))
}

pub fn verify<'a>(footer: &[u8], data: &'a [u8]) -> Result<&'a [u8], String> {
    if footer.len() != FOOTER_SIZE || &footer[..16] != FOOTER_MAGIC {
        return Err("This player has no valid game identity. Please export it again.".into());
    }
    if data.len() < 72 || &data[64..72] != DATA_MAGIC {
        return Err("The game package is missing or damaged.".into());
    }
    signature::UnparsedPublicKey::new(&signature::ED25519, &footer[16..])
        .verify(&data[64..], &data[..64])
        .map_err(|_| {
            "Game content was modified or damaged. Please use the original package.".to_string()
        })?;
    Ok(&data[72..])
}

pub fn distribution(
    runtime: &[u8],
    content: &[u8],
    stem: &str,
    loader: Option<&[u8]>,
) -> Result<Vec<u8>, String> {
    let (executable, data) = seal(runtime, content)?;
    let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
    let compressed = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .compression_level(Some(9));
    zip.start_file(format!("{stem}.exe"), compressed)
        .map_err(|e| e.to_string())?;
    zip.write_all(&executable).map_err(|e| e.to_string())?;
    // The content ZIP is already compressed. Avoid wasting time recompressing it.
    zip.start_file("game.dat", zip::write::FileOptions::default())
        .map_err(|e| e.to_string())?;
    zip.write_all(&data).map_err(|e| e.to_string())?;
    if let Some(loader) = loader {
        zip.start_file("WebView2Loader.dll", compressed)
            .map_err(|e| e.to_string())?;
        zip.write_all(loader).map_err(|e| e.to_string())?;
    }
    zip.start_file("README.txt", compressed)
        .map_err(|e| e.to_string())?;
    zip.write_all("解压后双击 EXE 即可进入游戏，无需安装。请将 EXE 和 game.dat 保留在同一文件夹。游戏内容有完整性校验，修改后无法启动。需要系统已安装 Microsoft Edge WebView2 Runtime。\r\n\r\nExtract all files, then double-click the EXE to play. Keep game.dat next to the EXE. Modified content is rejected. Microsoft Edge WebView2 Runtime is required.\r\n".as_bytes()).map_err(|e| e.to_string())?;
    Ok(zip.finish().map_err(|e| e.to_string())?.into_inner())
}

pub fn read_asset(archive: &mut zip::ZipArchive<Cursor<Vec<u8>>>, path: &str) -> Option<Vec<u8>> {
    if path.split('/').any(|part| part == "..") || path.contains('\\') {
        return None;
    }
    let mut file = archive.by_name(path).ok()?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).ok()?;
    Some(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn content() -> Vec<u8> {
        let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
        for name in ["index.html", "content.js"] {
            zip.start_file(name, zip::write::FileOptions::default())
                .unwrap();
            zip.write_all(b"game content").unwrap();
        }
        zip.finish().unwrap().into_inner()
    }
    #[test]
    fn original_launches_but_edits_and_other_games_are_rejected() {
        let content = content();
        let (exe, data) = seal(b"MZruntime", &content).unwrap();
        let footer = &exe[exe.len() - FOOTER_SIZE..];
        assert_eq!(verify(footer, &data).unwrap(), content);
        let mut edited = data.clone();
        *edited.last_mut().unwrap() ^= 1;
        assert!(verify(footer, &edited).is_err());
        assert!(verify(footer, &data[..70]).is_err());
        let (_, other) = seal(b"MZruntime", &content).unwrap();
        assert!(verify(footer, &other).is_err());
    }
    #[test]
    fn distribution_has_only_player_game_and_instructions() {
        let bytes = distribution(b"MZruntime", &content(), "作品", None).unwrap();
        let mut zip = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
        assert_eq!(zip.len(), 3);
        assert!(zip.by_name("作品.exe").is_ok());
        assert!(zip.by_name("game.dat").is_ok());
        assert!(zip.by_name("README.txt").is_ok());
        assert!(zip.by_name("content/index.html").is_err());
    }
}
