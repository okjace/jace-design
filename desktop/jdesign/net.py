"""Small HTTP helpers (used by the updater)."""
import os
from pathlib import Path

import requests

from jdesign import USER_AGENT

session = requests.Session()
session.headers["User-Agent"] = USER_AGENT


def get_json(url, **kwargs):
    r = session.get(url, timeout=30, **kwargs)
    r.raise_for_status()
    return r.json()


def download(url: str, dest: Path, progress=None) -> Path:
    """Download url to dest (atomically). progress(done_bytes, total_bytes) is called while downloading."""
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".part")
    with session.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length") or 0)
        done = 0
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(65536):
                f.write(chunk)
                done += len(chunk)
                if progress:
                    progress(done, total)
    os.replace(tmp, dest)
    return dest
