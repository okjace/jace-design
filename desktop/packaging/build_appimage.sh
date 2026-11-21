#!/usr/bin/env bash
# Build desktop/dist/JaceDesign-<version>-x86_64.AppImage (same approach as Jace Launcher)
#   1. PyInstaller bundles Python + PySide6 + the app into a folder
#   2. we lay out an AppDir (desktop file, icon, AppStream metadata)
#   3. appimagetool turns that into a single AppImage file
set -euo pipefail
cd "$(dirname "$0")/.."            # the desktop/ folder
ROOT="$PWD"
APP_ID="io.github.okjace.JaceDesign"
PY="${PYTHON:-.venv/bin/python}"
VERSION="$("$PY" -c 'import jdesign; print(jdesign.APP_VERSION)')"
BUILD="$ROOT/build/appimage"
APPDIR="$BUILD/AppDir"
TOOL="$ROOT/packaging/tools/appimagetool"

"$PY" -m pip install -q pyinstaller pillow
[ -f jdesign/assets/icon.png ] || "$PY" packaging/make_icons.py
if [ ! -x "$TOOL" ]; then
  mkdir -p "$(dirname "$TOOL")"
  curl -sSL -o "$TOOL" https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
  chmod +x "$TOOL"
fi

echo "==> PyInstaller"
rm -rf "$BUILD"
"$PY" -m PyInstaller --noconfirm --clean --log-level WARN \
  --name jace-design --windowed \
  --distpath "$BUILD/dist" --workpath "$BUILD/work" --specpath "$BUILD" \
  --paths "$ROOT" \
  --add-data "$ROOT/jdesign/assets:jdesign/assets" \
  --hidden-import PySide6.QtWebEngineWidgets --hidden-import PySide6.QtWebEngineCore \
  --hidden-import PySide6.QtPrintSupport \
  "$ROOT/packaging/entry.py"

# Qt >= 6.5 needs libxcb-cursor on X11 but many distros don't install it: ship it next to Qt's libs.
QTLIB="$(find "$BUILD/dist/jace-design" -type d -path '*PySide6/Qt/lib' | head -1)"
XCBC="$(ldconfig -p | awk '/libxcb-cursor.so.0 /{p=$NF} END{print p}')"
if [ -n "$XCBC" ]; then cp -L "$XCBC" "$QTLIB/libxcb-cursor.so.0"; else echo "warning: libxcb-cursor0 not bundled"; fi

# Don't ship system libraries that must match the user's graphics drivers or system config
# (a bundled old libstdc++ broke EGL / the web view on newer distros).
for lib in libstdc++.so.6 libgcc_s.so.1 libgbm.so.1 libfontconfig.so.1 libfreetype.so.6 libexpat.so.1 \
           libglib-2.0.so.0 libgio-2.0.so.0 libgobject-2.0.so.0 libgmodule-2.0.so.0 libdbus-1.so.3; do
  find "$BUILD/dist/jace-design" -name "$lib" -delete
done

echo "==> AppDir"
mkdir -p "$APPDIR/usr/bin" "$APPDIR/usr/share/applications" "$APPDIR/usr/share/metainfo" \
         "$APPDIR/usr/share/icons/hicolor/256x256/apps"
cp -a "$BUILD/dist/jace-design" "$APPDIR/usr/bin/"
cp packaging/AppRun "$APPDIR/AppRun"
chmod +x "$APPDIR/AppRun"
cp jdesign/assets/icon.png "$APPDIR/$APP_ID.png"
cp jdesign/assets/icon.png "$APPDIR/usr/share/icons/hicolor/256x256/apps/$APP_ID.png"
ln -sf "$APP_ID.png" "$APPDIR/.DirIcon"
cat > "$APPDIR/$APP_ID.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Jace Design
GenericName=Design App
Comment=Design posts, slides, posters, documents and videos
Exec=jace-design %U
Icon=$APP_ID
Terminal=false
Categories=Graphics;Office;
Keywords=design;canva;poster;slides;presentation;document;graphics;jace;
X-AppImage-Integrate=false
DESKTOP
cp "$APPDIR/$APP_ID.desktop" "$APPDIR/usr/share/applications/"
PYTHONPATH="$ROOT" "$PY" -c "from jdesign.desktop import _metainfo; print(_metainfo(), end='')" \
  > "$APPDIR/usr/share/metainfo/$APP_ID.metainfo.xml"

echo "==> appimagetool"
mkdir -p dist
OUT="$ROOT/dist/JaceDesign-$VERSION-x86_64.AppImage"
ARCH=x86_64 APPIMAGE_EXTRACT_AND_RUN=1 "$TOOL" --no-appstream "$APPDIR" "$OUT"
echo
echo "Built $OUT ($(du -h "$OUT" | cut -f1))"
echo "Run it once to open the setup wizard, or:  $OUT --install --yes"
