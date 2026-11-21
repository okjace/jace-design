"""The Jace Design desktop window: the Jace Design website in its own app, with downloads, printing,
fullscreen presenting, a remembered sign-in, one-click updates and the same installer as Jace Launcher."""
import os
import subprocess
import sys
from pathlib import Path

from PySide6.QtCore import QStandardPaths, Qt, QTimer, QUrl
from PySide6.QtGui import QAction, QDesktopServices, QIcon, QKeySequence
from PySide6.QtWidgets import (QApplication, QDialog, QFileDialog, QLabel, QMainWindow, QMessageBox, QProgressBar,
                               QPushButton, QVBoxLayout)

from jdesign import APP_NAME, APP_VERSION, GITHUB_URL, SITE_URL, desktop, macinstall, updater, wininstall
from jdesign.config import WEB_DIR, get_setting, set_setting
from jdesign.ui.installer import SetupWizard, confirm_uninstall
from jdesign.ui.tasks import run_task, show_error

SITE_HOST = QUrl(SITE_URL).host()
# Sign in with Jace happens on Jace's own site; keep it inside the app so the sign-in comes back here.
INSIDE_HOSTS = {SITE_HOST, "jaceo.vercel.app"}

STYLE = """
QWidget { background: #111317; color: #e6e8eb; font-size: 14px; }
QLabel#muted { color: #8b919c; }
QPushButton { background: #1c1f26; border: 1px solid #2a2f38; border-radius: 8px; padding: 7px 14px; }
QPushButton:hover { border-color: #3ddc84; }
QPushButton#primary { background: #3ddc84; color: #0c1410; border: 0; font-weight: 600; }
QLineEdit, QPlainTextEdit { background: #1c1f26; border: 1px solid #2a2f38; border-radius: 8px; padding: 6px; }
QProgressBar { border: 1px solid #2a2f38; border-radius: 6px; text-align: center; }
QProgressBar::chunk { background: #3ddc84; border-radius: 5px; }
QMenuBar, QMenu { background: #1c1f26; }
QMenu::item:selected, QMenuBar::item:selected { background: #2a2f38; }
"""


def _web():
    # Imported lazily: QtWebEngine is big and the installer/update paths don't need it.
    from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineProfile, QWebEngineSettings
    from PySide6.QtWebEngineWidgets import QWebEngineView
    return QWebEnginePage, QWebEngineProfile, QWebEngineSettings, QWebEngineView


_profile = None


def profile():
    """One persistent browser profile, so your Jace sign-in and settings survive restarts."""
    global _profile
    if _profile is None:
        _, QWebEngineProfile, QWebEngineSettings, _ = _web()
        WEB_DIR.mkdir(parents=True, exist_ok=True)
        _profile = QWebEngineProfile("jace-design")
        _profile.setPersistentStoragePath(str(WEB_DIR / "storage"))
        _profile.setCachePath(str(WEB_DIR / "cache"))
        _profile.setPersistentCookiesPolicy(QWebEngineProfile.PersistentCookiesPolicy.ForcePersistentCookies)
        _profile.setHttpUserAgent(_profile.httpUserAgent() + f" JaceDesignDesktop/{APP_VERSION}")
        s = _profile.settings()
        for attr in ("JavascriptCanAccessClipboard", "JavascriptCanPaste", "FullScreenSupportEnabled",
                     "LocalStorageEnabled", "ScrollAnimatorEnabled"):
            if hasattr(QWebEngineSettings.WebAttribute, attr):
                s.setAttribute(getattr(QWebEngineSettings.WebAttribute, attr), True)
        _profile.downloadRequested.connect(_on_download)
    return _profile


def _on_download(item):
    """Ask where to save PNG / PDF / Word downloads, like a browser does."""
    folder = QStandardPaths.writableLocation(QStandardPaths.StandardLocation.DownloadLocation) or str(Path.home())
    name = item.downloadFileName() or "download"
    path, _ = QFileDialog.getSaveFileName(None, "Save", str(Path(folder) / name))
    if not path:
        item.cancel()
        return
    item.setDownloadDirectory(str(Path(path).parent))
    item.setDownloadFileName(Path(path).name)
    item.accept()


def make_page(window):
    QWebEnginePage, _, _, _ = _web()

    class Page(QWebEnginePage):
        def acceptNavigationRequest(self, url, nav_type, is_main_frame):
            # Links to other websites open in your normal browser; Jace Design and Jace sign-in stay here.
            if is_main_frame and url.scheme() in ("http", "https") and url.host() not in INSIDE_HOSTS \
                    and nav_type == QWebEnginePage.NavigationType.NavigationTypeLinkClicked:
                QDesktopServices.openUrl(url)
                return False
            if url.scheme() in ("mailto", "tel"):
                QDesktopServices.openUrl(url)
                return False
            return super().acceptNavigationRequest(url, nav_type, is_main_frame)

        def createWindow(self, _type):
            # target=_blank / window.open: Jace Design pages open in a new app window, everything else in the browser.
            return PopupCatcher(self.profile(), window)

    return Page(profile(), window)


class PopupCatcher:
    """Receives the URL of a new window, then opens it in the right place."""

    def __new__(cls, prof, window):
        QWebEnginePage, _, _, _ = _web()

        class Catcher(QWebEnginePage):
            def acceptNavigationRequest(self, url, nav_type, is_main_frame):
                if url.host() in INSIDE_HOSTS:
                    w = MainWindow(url.toString())
                    w.show()
                else:
                    QDesktopServices.openUrl(url)
                QTimer.singleShot(0, self.deleteLater)
                return False
        return Catcher(prof, window)


class MainWindow(QMainWindow):
    windows = []

    def __init__(self, start_url: str | None = None):
        super().__init__()
        MainWindow.windows.append(self)
        _, _, _, QWebEngineView = _web()
        self.setWindowTitle(APP_NAME)
        self.resize(*get_setting("window_size", [1360, 860]))
        self.view = QWebEngineView(self)
        self.view.setPage(make_page(self))
        self.setCentralWidget(self.view)
        page = self.view.page()
        page.titleChanged.connect(lambda t: self.setWindowTitle(f"{t} — {APP_NAME}" if t and APP_NAME not in t else (t or APP_NAME)))
        page.fullScreenRequested.connect(self._fullscreen)
        if hasattr(page, "printRequested"):
            page.printRequested.connect(self.print_page)
        self.view.load(QUrl(start_url or get_setting("last_url") or SITE_URL))
        self._menus()

    # ---- menus -------------------------------------------------------------------
    def _menus(self):
        bar = self.menuBar()
        m = bar.addMenu("&File")
        self._act(m, "New design", lambda: self.go("/new"), "Ctrl+N")
        self._act(m, "Home", lambda: self.go("/"), "Ctrl+Shift+H")
        self._act(m, "Inbox", lambda: self.go("/inbox"), "Ctrl+I")
        self._act(m, "Explore", lambda: self.go("/explore"))
        m.addSeparator()
        self._act(m, "New window", lambda: MainWindow().show(), "Ctrl+Shift+N")
        self._act(m, "Print…", self.print_page, QKeySequence.StandardKey.Print)
        m.addSeparator()
        self._act(m, "Quit", QApplication.quit, QKeySequence.StandardKey.Quit)
        v = bar.addMenu("&View")
        self._act(v, "Back", self.view.back, QKeySequence.StandardKey.Back)
        self._act(v, "Forward", self.view.forward, QKeySequence.StandardKey.Forward)
        self._act(v, "Reload", self.view.reload, QKeySequence.StandardKey.Refresh)
        v.addSeparator()
        self._act(v, "Zoom in", lambda: self.view.setZoomFactor(min(3, self.view.zoomFactor() + 0.1)), QKeySequence.StandardKey.ZoomIn)
        self._act(v, "Zoom out", lambda: self.view.setZoomFactor(max(0.3, self.view.zoomFactor() - 0.1)), QKeySequence.StandardKey.ZoomOut)
        self._act(v, "Actual size", lambda: self.view.setZoomFactor(1.0), "Ctrl+0")
        self._act(v, "Full screen", self._toggle_fullscreen, "F11")
        h = bar.addMenu("&Help")
        self._act(h, "Check for updates…", lambda: check_for_updates(self, quiet=False))
        self._act(h, "Open in your browser", lambda: QDesktopServices.openUrl(self.view.url()))
        self._act(h, "Source code on GitHub", lambda: QDesktopServices.openUrl(QUrl(GITHUB_URL)))
        h.addSeparator()
        if desktop.setup_available() or desktop.is_installed():
            self._act(h, "Delete Jace Design…", lambda: confirm_uninstall(self))
        self._act(h, f"About {APP_NAME}", self.about)

    def _act(self, menu, text, fn, shortcut=None):
        a = QAction(text, self)
        if shortcut:
            a.setShortcut(QKeySequence(shortcut))
        a.triggered.connect(fn)
        menu.addAction(a)
        return a

    def go(self, path: str):
        self.view.load(QUrl(SITE_URL + path))

    def about(self):
        QMessageBox.about(self, f"About {APP_NAME}",
                          f"<b>{APP_NAME} {APP_VERSION}</b><p>Design anything with your Jace account.</p>"
                          f"<p>Free and open source (MIT): <a href='{GITHUB_URL}'>{GITHUB_URL}</a></p>")

    # ---- fullscreen (Present) ---------------------------------------------------------
    def _fullscreen(self, request):
        request.accept()
        if request.toggleOn():
            self.menuBar().hide()
            self.showFullScreen()
        else:
            self.menuBar().show()
            self.showNormal()

    def _toggle_fullscreen(self):
        if self.isFullScreen():
            self.menuBar().show()
            self.showNormal()
        else:
            self.showFullScreen()

    # ---- printing -------------------------------------------------------------------------
    def print_page(self):
        from PySide6.QtPrintSupport import QPrintDialog, QPrinter
        printer = QPrinter(QPrinter.PrinterMode.HighResolution)
        if QPrintDialog(printer, self).exec() == QDialog.DialogCode.Accepted:
            if hasattr(self.view, "print"):
                self.view.print(printer)
            else:
                self.view.page().printToPdf(str(Path.home() / "Jace Design print.pdf"))

    def closeEvent(self, e):
        try:
            set_setting("window_size", [self.width(), self.height()])
            url = self.view.url().toString()
            if url.startswith(SITE_URL):
                set_setting("last_url", url)
        except Exception:  # noqa: BLE001
            pass
        if self in MainWindow.windows:
            MainWindow.windows.remove(self)
        super().closeEvent(e)


# ---- updates ------------------------------------------------------------------------------

def check_for_updates(parent, quiet=True):
    """Ask GitHub Releases for a newer version; offer to install it."""
    if quiet and updater.unsupported_reason():
        return

    def found(info):
        if not info:
            if not quiet:
                QMessageBox.information(parent, "Up to date", f"You have the latest version ({APP_VERSION}).")
            return
        reason = updater.unsupported_reason()
        if reason:
            if not quiet:
                QMessageBox.information(parent, "Update available", f"Jace Design {info['version']} is out. {reason}")
            return
        if QMessageBox.question(parent, "Update available",
                                f"Jace Design {info['version']} is available (you have {APP_VERSION}).\n\nUpdate now?") \
                == QMessageBox.StandardButton.Yes:
            apply_update(parent, info)

    run_task(updater.check, on_done=found, on_error=(lambda m: None) if quiet else (lambda m: show_error(parent, m, "Couldn't check for updates")))


def apply_update(parent, info):
    dlg = QDialog(parent)
    dlg.setWindowTitle("Updating Jace Design")
    dlg.setMinimumWidth(420)
    lay = QVBoxLayout(dlg)
    lay.addWidget(QLabel(f"<b>Updating to Jace Design {info['version']}</b>"))
    label = QLabel("Starting…")
    label.setObjectName("muted")
    bar = QProgressBar()
    bar.setRange(0, 0)
    lay.addWidget(label)
    lay.addWidget(bar)

    def progress(done, total):
        if total:
            bar.setRange(0, total)
            bar.setValue(done)

    def finished(_):
        dlg.accept()
        QApplication.quit()

    run_task(lambda cb: updater.apply(info, cb), use_callback=True, on_status=label.setText, on_progress=progress,
             on_done=finished, on_error=lambda m: (show_error(dlg, m, "Update failed"), dlg.reject()))
    dlg.exec()


def run_windows_update(argv) -> None:
    """Small progress window shown by the new setup .exe while it updates the app."""
    dlg = QDialog()
    dlg.setWindowTitle("Updating Jace Design")
    dlg.setMinimumWidth(420)
    lay = QVBoxLayout(dlg)
    lay.addWidget(QLabel(f"<b>Updating Jace Design to {APP_VERSION}</b>"))
    label = QLabel("Starting…")
    label.setObjectName("muted")
    bar = QProgressBar()
    bar.setRange(0, 0)
    lay.addWidget(label)
    lay.addWidget(bar)
    run_task(lambda callback: desktop.apply_windows_update(argv, callback["setStatus"]), use_callback=True,
             on_status=label.setText, on_done=lambda _: dlg.accept(),
             on_error=lambda m: (show_error(dlg, m, "Update failed"), dlg.reject()))
    dlg.exec()


# ---- start-up ------------------------------------------------------------------------------

def should_run_setup(argv) -> bool:
    if "--install" in argv:
        return True
    # The downloaded AppImage / .app / .exe must be installed before it can be used
    return bool(desktop.setup_available() and not desktop.running_installed_copy())


def start_installed(installed):
    """Start the freshly installed copy and remove the downloaded one."""
    if desktop.mac_app_bundle():
        macinstall.relaunch_installed(installed, desktop.mac_app_bundle())
    elif wininstall.running_exe():
        wininstall.relaunch(installed, delete_after=wininstall.running_exe())
    else:
        subprocess.Popen([str(installed)], start_new_session=True, env=updater._clean_env())
        downloaded = desktop.running_appimage()
        if downloaded and downloaded.resolve() != installed.resolve():
            downloaded.unlink(missing_ok=True)


def self_test(app) -> int:
    """Used by CI on packaged builds: prove the bundle starts (Qt, WebEngine, the window, bundled icon)."""
    lines = []
    try:
        assert desktop.ICON_SRC.is_file(), f"missing icon {desktop.ICON_SRC}"
        w = MainWindow("about:blank")
        w.show()
        for _ in range(20):
            app.processEvents()
        w.view.setHtml("<p>ok</p>")
        for _ in range(20):
            app.processEvents()
        w.close()
        lines.append(f"{APP_NAME} {APP_VERSION}")
        lines.append("SELF-TEST OK")
        code = 0
    except Exception as e:  # noqa: BLE001
        lines.append(f"SELF-TEST FAILED: {e!r}")
        code = 1
    out = os.environ.get("JACE_SELF_TEST_OUT")
    text = "\n".join(lines) + "\n"
    if out:
        Path(out).write_text(text)
    print(text, end="")
    return code


def main():
    if desktop.handle_cli(sys.argv[1:]):
        return
    QApplication.setApplicationName(APP_NAME)
    QApplication.setOrganizationName("Jace")
    QApplication.setDesktopFileName(desktop.APP_ID)
    # Sharper rendering and no flicker on HiDPI screens
    QApplication.setHighDpiScaleFactorRoundingPolicy(Qt.HighDpiScaleFactorRoundingPolicy.PassThrough)
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    app.setStyleSheet(STYLE)
    app.setWindowIcon(QIcon(str(desktop.ICON_SRC)))
    argv = sys.argv[1:]
    if "--self-test" in argv:
        sys.exit(self_test(app))
    if "--uninstall-gui" in argv:
        confirm_uninstall()
        return
    if "--apply-update" in argv:
        run_windows_update(argv)
        return
    if should_run_setup(argv):
        wiz = SetupWizard()
        app.setQuitOnLastWindowClosed(False)
        result = wiz.exec()
        app.setQuitOnLastWindowClosed(True)
        if result != QDialog.DialogCode.Accepted:
            return                       # setup cancelled: nothing runs uninstalled
        installed = desktop.installed_path()
        if installed and not desktop.running_installed_copy():
            if wiz.launch_after():
                start_installed(installed)
            elif desktop.running_appimage():
                desktop.running_appimage().unlink(missing_ok=True)
            return
        if not wiz.launch_after():
            return
    if desktop.running_installed_copy() and desktop.running_appimage():
        try:
            desktop.remove_duplicate_entries()
            desktop.refresh_integration()
        except OSError:
            pass
    start = next((a for a in argv if a.startswith(SITE_URL)), None)
    w = MainWindow(start)
    w.show()
    QTimer.singleShot(4000, lambda: check_for_updates(w, quiet=True))
    sys.exit(app.exec())
