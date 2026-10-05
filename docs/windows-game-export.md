# Windows game ZIP export

The Windows export option produces `<title>-windows.zip`. Extract every file and
double-click `<title>.exe` to open the game in its own window. Installation, a
browser launcher, PowerShell, Node.js, and the GalWriter editor are not needed.
The machine must already have Microsoft Edge WebView2 Runtime installed.

The package contains a dedicated player, `game.dat`, instructions, and the
WebView2 loader if the build emits a separate loader DLL. The player embeds no
editor frontend, default character art, preset packs, or MCP service. Content is
served from memory through a private WebView protocol; no HTTP server or loose
HTML/script/material folders are created.

Content collection follows all branches reachable from the export entry node.
Hidden and unreachable story cards are excluded. Skipped routing cards retain
their progression data but carry no media. Scene/character art, costume switches,
region music, enabled interface backgrounds, and other selected interface assets
continue to be included when used. ZIP content uses DEFLATE compression.

`game.dat` contains an Ed25519 signature and the compressed game content. Each
export uses a fresh signing key; the verification key is appended to that game's
EXE and the private key is never distributed. The player validates the whole
package before creating the game window and refuses edited, damaged, or swapped
content. Save files and player preferences remain writable. This verifies game
content against the original EXE; it is not protection against patching the EXE
itself and does not attempt to prevent reverse engineering.

Build the runtime with `npm run build:player`. Windows Tauri production builds
run this automatically before building the editor frontend and bundle the result
under `player-runtime/`. Desktop development starts with the same runtime build.
Android and browser distributions do not include the Windows runtime.

Validation:

```sh
node --import tsx --test tests/web-export-scope.test.ts
cargo test --manifest-path src-tauri/player/Cargo.toml --locked
cargo check --manifest-path src-tauri/Cargo.toml --locked
```

The Rust tests exercise signature verification, tamper rejection, package
membership, missing files, and media byte ranges. Actual Windows playback must
also be checked with a freshly exported game, including branches, save/load,
fonts, image/character switches, audio, and video seeking.
