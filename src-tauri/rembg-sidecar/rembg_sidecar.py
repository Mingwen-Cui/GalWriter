"""A persistent JSON-lines worker for GalWriter's local rembg integration.

The Tauri process owns this worker and sends one request per line. Keeping it
alive lets rembg retain model sessions between images, so the default u2netp
model is not reloaded on every click.
"""

from __future__ import annotations

import argparse
import base64
import contextlib
import json
import os
import sys
from typing import Any

# PyInstaller does not give Numba a source-file locator for its cache. rembg's
# normal transparent-PNG path does not need JIT compilation, so disable it
# before importing pymatting through rembg.
os.environ.setdefault("NUMBA_DISABLE_JIT", "1")

from rembg import new_session, remove


SUPPORTED_MODELS = {
    "u2netp",
    "silueta",
    "u2net",
    "isnet-general-use",
    "isnet-anime",
    "birefnet-general-lite",
}


def decode_image(value: str) -> bytes:
    if value.startswith("data:"):
        prefix, separator, payload = value.partition(",")
        if not separator or ";base64" not in prefix.lower():
            raise ValueError("The local rembg worker accepts only base64 image data URLs.")
        return base64.b64decode(payload, validate=True)
    return base64.b64decode(value, validate=True)


def emit(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--models-dir", required=True)
    args = parser.parse_args()

    os.environ["U2NET_HOME"] = args.models_dir
    sessions: dict[str, Any] = {}

    for raw_line in sys.stdin:
        try:
            request = json.loads(raw_line)
            model = str(request.get("model") or "u2netp").strip()
            if model not in SUPPORTED_MODELS:
                raise ValueError(f"Unsupported local rembg model: {model}")

            session = sessions.get(model)
            if session is None:
                # Model-download progress must never corrupt our JSON-lines stdout protocol.
                with contextlib.redirect_stdout(sys.stderr):
                    session = new_session(model)
                sessions[model] = session

            with contextlib.redirect_stdout(sys.stderr):
                output = remove(decode_image(str(request.get("image") or "")), session=session)
            emit({"image": "data:image/png;base64," + base64.b64encode(output).decode("ascii")})
        except Exception as error:  # Return errors through the stable IPC protocol.
            emit({"error": str(error)})

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
