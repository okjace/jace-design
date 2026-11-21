"""Where the desktop app keeps its data (sign-in, settings), and tiny JSON helpers."""
import json
import os
import sys
from pathlib import Path


def _default_data_dir() -> Path:
    override = os.environ.get("JACE_DESIGN_HOME")
    if override:
        return Path(override)
    if sys.platform == "win32":
        return Path(os.environ.get("APPDATA", Path.home())) / "JaceDesign"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "JaceDesign"
    return Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share") / "jace-design"


DATA_DIR = _default_data_dir()
WEB_DIR = DATA_DIR / "web"            # browser profile: keeps you signed in
SETTINGS_FILE = DATA_DIR / "settings.json"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def read_json(path: Path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, path)


def get_setting(key, default=None):
    return read_json(SETTINGS_FILE, {}).get(key, default)


def set_setting(key, value) -> None:
    data = read_json(SETTINGS_FILE, {})
    data[key] = value
    write_json(SETTINGS_FILE, data)
