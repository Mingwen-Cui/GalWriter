# Optional local rembg runtime

The Windows installer intentionally does not include this runtime or its model.

For a release asset, run:

```powershell
npm run rembg:prepare
```

Upload `src-tauri/binaries/rembg-sidecar.exe` to the corresponding GalWriter GitHub Release with that exact filename. It is approximately 139 MB.

End users download that file and place it at:

```text
%APPDATA%\com.galwriter.ai\rembg\rembg-sidecar.exe
```

They also download the official `u2netp.onnx` model and place it at:

```text
%APPDATA%\com.galwriter.ai\rembg-models\u2netp.onnx
```

The app's AI settings exposes both paths and download links.
