(() => {
  const wakeLock = navigator.wakeLock;
  if (!wakeLock) return;

  let lock;
  let requesting = false;

  async function keepScreenAwake() {
    if (document.visibilityState !== 'visible' || requesting || (lock && !lock.released)) {
      return;
    }

    requesting = true;
    try {
      lock = await wakeLock.request('screen');
    } catch {
      // The browser can deny a wake lock, for example in power-saving mode.
    } finally {
      requesting = false;
    }
  }

  document.addEventListener('visibilitychange', keepScreenAwake);
  window.addEventListener('pageshow', keepScreenAwake);
  keepScreenAwake();
})();
