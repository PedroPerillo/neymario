const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'down', KeyS: 'down',
  ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump', Space: 'jump', KeyK: 'jump',
  KeyX: 'run', ShiftLeft: 'run', ShiftRight: 'run', KeyJ: 'run',
  KeyC: 'spin', KeyL: 'spin',
  Enter: 'start',
  KeyP: 'pause', Escape: 'pause',
};

const ACTIONS = ['left', 'right', 'down', 'jump', 'run', 'spin', 'start', 'pause'];

/**
 * Keyboard + on-screen touch buttons, merged into one action snapshot.
 * Tracks held keys by code so releasing one of two keys bound to the same
 * action doesn't drop the action, and latches presses until the next poll so
 * a tap shorter than one game tick still registers.
 */
export function createInput(target, touchRoot) {
  const heldKeys = new Set();
  const heldTouch = new Map(); // pointerId → action
  const tapped = new Set(); // actions pressed since the last state() poll
  const listeners = { gesture: [], mute: [] };
  const emit = (name) => listeners[name].forEach((fn) => fn());

  target.addEventListener('keydown', (e) => {
    emit('gesture');
    if (e.code === 'KeyM' && !e.repeat) {
      emit('mute');
      return;
    }
    if (KEYMAP[e.code]) {
      heldKeys.add(e.code);
      if (!e.repeat) tapped.add(KEYMAP[e.code]);
      e.preventDefault();
    }
  });
  target.addEventListener('keyup', (e) => heldKeys.delete(e.code));
  target.addEventListener('blur', () => {
    heldKeys.clear();
    heldTouch.clear();
  });

  if (touchRoot) {
    touchRoot.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      e.preventDefault();
      emit('gesture');
      if (btn.dataset.action === 'mute') {
        emit('mute');
        return;
      }
      heldTouch.set(e.pointerId, btn.dataset.action);
      tapped.add(btn.dataset.action);
      btn.setPointerCapture?.(e.pointerId);
    });
    const release = (e) => heldTouch.delete(e.pointerId);
    touchRoot.addEventListener('pointerup', release);
    touchRoot.addEventListener('pointercancel', release);
    touchRoot.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function state() {
    const s = {};
    for (const a of ACTIONS) s[a] = false;
    for (const code of heldKeys) s[KEYMAP[code]] = true;
    for (const action of heldTouch.values()) s[action] = true;
    for (const action of tapped) s[action] = true;
    tapped.clear();
    return s;
  }

  return {
    state,
    onGesture: (fn) => listeners.gesture.push(fn),
    onMute: (fn) => listeners.mute.push(fn),
  };
}
