"""PyInstaller entry point (and `python desktop/packaging/entry.py` to run from source)."""
import os
import sys

if getattr(sys, "frozen", False):
    # PyInstaller points LD_LIBRARY_PATH at the bundle. Only this process needs that, and it breaks
    # programs we start (xdg-open, the browser), so give children the user's original environment.
    orig = os.environ.pop("LD_LIBRARY_PATH_ORIG", None)
    if orig is not None:
        os.environ["LD_LIBRARY_PATH"] = orig
    else:
        os.environ.pop("LD_LIBRARY_PATH", None)
else:
    # running from source: make the jdesign package importable
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from jdesign.ui.app import main  # noqa: E402

main()
