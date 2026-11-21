"""Build the Jace Design desktop app for the platform this runs on (same approach as Jace Launcher).

    python desktop/packaging/build.py

  Windows -> desktop/dist/JaceDesign-<ver>-windows-x64.exe          (self-installing, setup wizard)
  macOS   -> desktop/dist/JaceDesign-<ver>-macos-<arch>.app.zip     (unzips to Jace Design.app)
  Linux   -> use desktop/packaging/build_appimage.sh

PyInstaller can't cross-compile, so the builds run on GitHub Actions (.github/workflows/desktop.yml).
"""
import os
import platform
import plistlib
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # the desktop/ folder
sys.path.insert(0, str(ROOT))
from jdesign import APP_VERSION  # noqa: E402
from jdesign.desktop import APP_ID  # noqa: E402

BUILD = ROOT / "build" / sys.platform
DIST = ROOT / "dist"
ASSETS = ROOT / "jdesign" / "assets"


def run(cmd, **kw):
    print("+", " ".join(map(str, cmd)), flush=True)
    subprocess.run(list(map(str, cmd)), check=True, **kw)


def icons():
    if not (ASSETS / "icon.png").is_file() or not (ASSETS / "icon.ico").is_file() or not (ASSETS / "icon.icns").is_file():
        run([sys.executable, ROOT / "packaging" / "make_icons.py"])


def pyinstaller(name: str, icon: Path, extra=()):
    shutil.rmtree(BUILD, ignore_errors=True)
    run([sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--log-level", "WARN",
         "--name", name, "--windowed", "--icon", icon,
         "--distpath", BUILD / "dist", "--workpath", BUILD / "work", "--specpath", BUILD,
         "--paths", ROOT,
         "--add-data", f"{ASSETS}{os.pathsep}jdesign/assets",
         "--hidden-import", "PySide6.QtWebEngineWidgets", "--hidden-import", "PySide6.QtWebEngineCore",
         "--hidden-import", "PySide6.QtPrintSupport",
         "--exclude-module", "tkinter", "--exclude-module", "_tkinter",
         *extra, ROOT / "packaging" / "entry.py"])
    return BUILD / "dist"


# Microsoft Visual C++ runtime DLLs that Qt and Python need; fresh Windows installs and Wine often lack them.
VC_RUNTIME = ["vcruntime140.dll", "vcruntime140_1.dll", "msvcp140.dll", "msvcp140_1.dll", "msvcp140_2.dll", "concrt140.dll"]


def vc_runtime_args() -> list:
    system32 = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32"
    args = []
    for dll in VC_RUNTIME:
        src = system32 / dll
        if not src.is_file():
            sys.exit(f"Missing {src} - install the Visual C++ 2015-2022 redistributable (x64)")
        args += ["--add-binary", f"{src}{os.pathsep}."]
    return args


def build_windows():
    """One self-installing .exe: a onefile build that also carries a small onedir launcher,
    which the setup wizard installs next to the unpacked app files (starts fast once installed)."""
    vc = vc_runtime_args()
    onedir = pyinstaller("JaceDesign", ASSETS / "icon.ico", vc)
    launcher = onedir / "JaceDesign" / "JaceDesign.exe"
    keep = ROOT / "build" / "win-launcher"
    shutil.rmtree(keep, ignore_errors=True)
    keep.mkdir(parents=True)
    shutil.copy2(launcher, keep / "JaceDesign.exe")
    out = pyinstaller("JaceDesign", ASSETS / "icon.ico",
                      [*vc, "--onefile", "--add-data", f"{keep / 'JaceDesign.exe'}{os.pathsep}jace_setup"])
    DIST.mkdir(exist_ok=True)
    final = DIST / f"JaceDesign-{APP_VERSION}-windows-x64.exe"
    shutil.copy2(out / "JaceDesign.exe", final)
    print("Built", final)


def build_macos():
    arch = "arm64" if platform.machine() == "arm64" else "x86_64"
    out = pyinstaller("Jace Design", ASSETS / "icon.icns", ["--osx-bundle-identifier", APP_ID, "--target-arch", arch])
    app = out / "Jace Design.app"
    info = app / "Contents" / "Info.plist"
    with open(info, "rb") as f:
        plist = plistlib.load(f)
    plist.update({
        "CFBundleDisplayName": "Jace Design",
        "CFBundleShortVersionString": APP_VERSION,
        "CFBundleVersion": APP_VERSION,
        "LSApplicationCategoryType": "public.app-category.graphics-design",
        "NSHighResolutionCapable": True,
        "NSCameraUsageDescription": "Jace Design can use the camera if a design asks for it.",
        "NSMicrophoneUsageDescription": "Jace Design can use the microphone if a design asks for it.",
        "LSMinimumSystemVersion": "12.0",
    })
    with open(info, "wb") as f:
        plistlib.dump(plist, f)
    # Info.plist changed, so re-sign (ad-hoc: no Apple developer account needed, but required on Apple Silicon)
    run(["codesign", "--force", "--deep", "--sign", "-", app])
    DIST.mkdir(exist_ok=True)
    archive = DIST / f"JaceDesign-{APP_VERSION}-macos-{arch}.app.zip"
    archive.unlink(missing_ok=True)
    run(["ditto", "-c", "-k", "--sequesterRsrc", "--keepParent", app, archive])
    print("Built", archive)


if __name__ == "__main__":
    icons()
    if sys.platform == "win32":
        build_windows()
    elif sys.platform == "darwin":
        build_macos()
    else:
        sys.exit("On Linux, run desktop/packaging/build_appimage.sh")
