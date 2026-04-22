import { TILT, MOTION, DEBUG } from './config.js';

const state = {
  gamma: 0,
  beta: 0,
  neutral: 0,
  calibrated: false,
  calibrateSamples: [],
  calibrateStartTs: 0,
  keyboardTilt: 0,
  touchTilt: 0,
  touchPressedAt: 0,
  touchMoved: false,
  activeTouchId: null,
  shakeListeners: [],
  lastShakeTs: 0,
  sensorsAvailable: false,
};

export async function initInput() {
  // iOS: requestPermission on a user gesture. Android/Silk: just add listeners.
  try {
    if (typeof DeviceOrientationEvent !== 'undefined'
        && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') console.warn('orientation perm:', res);
    }
    if (typeof DeviceMotionEvent !== 'undefined'
        && typeof DeviceMotionEvent.requestPermission === 'function') {
      await DeviceMotionEvent.requestPermission();
    }
  } catch (e) { /* ignore */ }

  window.addEventListener('deviceorientation', onOrientation);
  window.addEventListener('devicemotion', onMotion);

  // Touch controls always on (tablet gyro may be locked down in Kids mode).
  // Start listeners on canvas (so UI overlays get their clicks first); end
  // listeners on window (so they always fire even if finger lifts off-canvas).
  const canvas = document.getElementById('game');
  const startTarget = canvas || window;
  startTarget.addEventListener('touchstart', onTouchStart, { passive: false });
  startTarget.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd, { passive: false });
  window.addEventListener('touchcancel', onTouchEnd, { passive: false });
  // Mouse fallback (desktop testing)
  startTarget.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  // Safety nets: if the tab loses focus or the user switches apps, clear held
  // inputs so the stickman doesn't walk on its own when they come back.
  window.addEventListener('blur', resetHeld);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetHeld();
  });

  if (DEBUG) {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  beginCalibration();
}

function onOrientation(e) {
  if (e.gamma == null) return;
  state.sensorsAvailable = true;
  state.gamma = e.gamma;
  state.beta = e.beta || 0;
  if (!state.calibrated) {
    state.calibrateSamples.push(e.gamma);
  }
}

function onMotion(e) {
  const a = e.accelerationIncludingGravity || e.acceleration;
  if (!a) return;
  const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
  // Subtract gravity (~9.8) if using accelerationIncludingGravity
  const shake = Math.abs(mag - 9.8);
  const t = performance.now();
  if (shake > MOTION.shakeAccel && t - state.lastShakeTs > MOTION.shakeCooldownMs) {
    state.lastShakeTs = t;
    const intensity = shake > MOTION.highFiveAccel ? 'hard' : 'soft';
    state.shakeListeners.forEach(fn => fn(intensity));
  }
}

// --- Touch controls ---
// Split screen into thirds: left third -> walk left, right third -> walk right,
// middle third -> tap to shake.
function computeTouchTilt(clientX) {
  const w = window.innerWidth;
  const x = clientX / w;
  if (x < 0.38) return -1;
  if (x > 0.62) return 1;
  return 0;
}

function onTouchStart(e) {
  // Don't swallow taps on the gear button, etc. (they have their own handlers)
  if (isUIElement(e.target)) return;
  e.preventDefault();
  const t = e.changedTouches[0];
  if (!t) return;
  state.activeTouchId = t.identifier;
  state.touchPressedAt = performance.now();
  state.touchMoved = false;
  state.touchTilt = computeTouchTilt(t.clientX);
}

function onTouchMove(e) {
  if (state.activeTouchId == null) return;
  const t = findTouch(e, state.activeTouchId);
  if (!t) return;
  e.preventDefault();
  state.touchMoved = true;
  state.touchTilt = computeTouchTilt(t.clientX);
}

function onTouchEnd(e) {
  // If no touches remain on the screen at all, hard-reset the held state.
  // This catches cases where the browser drops the specific touchend for our
  // active touch (common at screen edges on some devices).
  if (e.touches.length === 0) {
    const held = performance.now() - state.touchPressedAt;
    const wasTilt = state.touchTilt !== 0;
    const wasActive = state.activeTouchId != null;
    state.touchTilt = 0;
    state.activeTouchId = null;
    if (wasActive && !state.touchMoved && held < 300 && !wasTilt) {
      const now = performance.now();
      if (now - state.lastShakeTs > MOTION.shakeCooldownMs) {
        state.lastShakeTs = now;
        state.shakeListeners.forEach(fn => fn('soft'));
      }
    }
    return;
  }
  // Otherwise, only react if OUR specific active touch ended.
  if (state.activeTouchId == null) return;
  const t = findTouch(e.changedTouches, state.activeTouchId);
  if (!t) return;
  state.touchTilt = 0;
  state.activeTouchId = null;
}

function resetHeld() {
  state.touchTilt = 0;
  state.activeTouchId = null;
  state.keyboardTilt = 0;
  mouseDown = false;
}

function findTouch(list, id) {
  for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
  return null;
}

function isUIElement(el) {
  if (!el || !el.closest) return false;
  return !!el.closest('#gear, .big-btn, .color-btn, #status, .screen, .rotate-overlay');
}

// Mouse fallback for desktop testing
let mouseDown = false;
function onMouseDown(e) {
  if (isUIElement(e.target)) return;
  e.preventDefault();
  mouseDown = true;
  state.touchPressedAt = performance.now();
  state.touchMoved = false;
  state.touchTilt = computeTouchTilt(e.clientX);
}
function onMouseMove(e) {
  if (!mouseDown) return;
  state.touchMoved = true;
  state.touchTilt = computeTouchTilt(e.clientX);
}
function onMouseUp(e) {
  if (!mouseDown) return;
  mouseDown = false;
  const held = performance.now() - state.touchPressedAt;
  const wasTilt = state.touchTilt !== 0;
  state.touchTilt = 0;
  if (!state.touchMoved && held < 300 && !wasTilt) {
    const now = performance.now();
    if (now - state.lastShakeTs > MOTION.shakeCooldownMs) {
      state.lastShakeTs = now;
      state.shakeListeners.forEach(fn => fn('soft'));
    }
  }
}

function onKeyDown(e) {
  if (e.key === 'ArrowLeft') state.keyboardTilt = -1;
  else if (e.key === 'ArrowRight') state.keyboardTilt = 1;
  else if (e.key === ' ' || e.code === 'Space') {
    const t = performance.now();
    if (t - state.lastShakeTs > MOTION.shakeCooldownMs) {
      state.lastShakeTs = t;
      const hard = e.shiftKey ? 'hard' : 'soft';
      state.shakeListeners.forEach(fn => fn(hard));
    }
  }
}

function onKeyUp(e) {
  if ((e.key === 'ArrowLeft' && state.keyboardTilt === -1)
   || (e.key === 'ArrowRight' && state.keyboardTilt === 1)) {
    state.keyboardTilt = 0;
  }
}

export function beginCalibration() {
  state.calibrated = false;
  state.calibrateSamples = [];
  state.calibrateStartTs = performance.now();
}

function finishCalibrationIfReady() {
  if (state.calibrated) return;
  if (performance.now() - state.calibrateStartTs < TILT.calibrateMs) return;
  if (state.calibrateSamples.length === 0) {
    state.calibrated = true;
    state.neutral = 0;
    return;
  }
  const sum = state.calibrateSamples.reduce((a, b) => a + b, 0);
  state.neutral = sum / state.calibrateSamples.length;
  state.calibrated = true;
  state.calibrateSamples = [];
}

// Returns tilt in -1..1 range (0 = neutral, -1 = full left, +1 = full right).
// Gyro-based tilt is disabled for now — touch and keyboard only.
export function getTilt() {
  if (state.keyboardTilt !== 0) return state.keyboardTilt;
  if (state.touchTilt !== 0) return state.touchTilt;
  return 0;
}

export function getOrientation() {
  if (!state.sensorsAvailable) return null;
  return { beta: state.beta, gamma: state.gamma };
}

export function onShake(fn) { state.shakeListeners.push(fn); }

export function recalibrate() {
  beginCalibration();
}

export function sensorsOk() { return state.sensorsAvailable || DEBUG; }

