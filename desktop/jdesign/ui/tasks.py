"""Run slow work (installing, downloading updates) off the UI thread."""
import traceback

from PySide6.QtCore import QObject, QRunnable, QThreadPool, Signal
from PySide6.QtWidgets import QMessageBox

_live = set()


class _Signals(QObject):
    done = Signal(object)
    failed = Signal(str)
    status = Signal(str)
    progress = Signal(int, int)


class Task(QRunnable):
    def __init__(self, fn, *args, use_callback=False, **kwargs):
        super().__init__()
        self.fn, self.args, self.kwargs, self.use_callback = fn, args, kwargs, use_callback
        self.signals = _Signals()
        self._max = 0

    def run(self):
        try:
            if self.use_callback:
                cb = {
                    "setStatus": lambda s: self.signals.status.emit(str(s)),
                    "setMax": self._set_max,
                    "setProgress": lambda v: self.signals.progress.emit(int(v), int(self._max)),
                }
                result = self.fn(cb, *self.args, **self.kwargs)
            else:
                result = self.fn(*self.args, **self.kwargs)
            self.signals.done.emit(result)
        except Exception as e:  # noqa: BLE001 - shown to the user
            traceback.print_exc()
            self.signals.failed.emit(str(e) or e.__class__.__name__)

    def _set_max(self, m):
        self._max = int(m or 0)


def run_task(fn, *args, on_done=None, on_error=None, on_status=None, on_progress=None, use_callback=False, **kwargs):
    t = Task(fn, *args, use_callback=use_callback, **kwargs)
    if on_done:
        t.signals.done.connect(on_done)
    t.signals.failed.connect(on_error or (lambda msg: show_error(None, msg)))
    if on_status:
        t.signals.status.connect(on_status)
    if on_progress:
        t.signals.progress.connect(on_progress)
    t.setAutoDelete(False)          # keep it alive until results reach the UI thread
    _live.add(t)
    t.signals.done.connect(lambda *_: _live.discard(t))
    t.signals.failed.connect(lambda *_: _live.discard(t))
    QThreadPool.globalInstance().start(t)
    return t


def show_error(parent, msg: str, title="Something went wrong"):
    QMessageBox.critical(parent, title, msg)
