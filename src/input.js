import { TILT, MOTION, DEBUG } from './config.js';

const state = {
  gamma: 0,
  neutral: 0,
  calibrated: false,
  calibrateSamples: [],
  calibrateStartTs: 0,
  keyboardTilt: 0,
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

// Returns tilt in -1..1 range (0 = neutral, -1 = full left, +1 = full right)
export function getTilt() {
  finishCalibrationIfReady();
  if (state.keyboardTilt !== 0) return state.keyboardTilt;
  if (!state.sensorsAvailable) return 0;
  const dev = state.gamma - state.neutral;
  const sign = Math.sign(dev);
  const mag = Math.max(0, Math.abs(dev) - TILT.deadzoneDeg)
            / (TILT.fullSpeedDeg - TILT.deadzoneDeg);
  return sign * Math.min(1, mag);
}

export function onShake(fn) { state.shakeListeners.push(fn); }

export function recalibrate() {
  beginCalibration();
}

export function sensorsOk() { return state.sensorsAvailable || DEBUG; }
