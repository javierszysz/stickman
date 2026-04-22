export const ROOM_ID = 'lara';

export const COLORS = {
  pink:   { skin: '#ffb0d0', accent: '#d63384', name: 'Pink' },
  blue:   { skin: '#a8d8ff', accent: '#1e6fbd', name: 'Blue' },
  green:  { skin: '#b8f0b8', accent: '#2e8b2e', name: 'Green' },
  yellow: { skin: '#ffe88a', accent: '#c08a00', name: 'Yellow' },
};

export const TILT = {
  deadzoneDeg: 5,
  fullSpeedDeg: 25,
  calibrateMs: 500,
};

export const MOTION = {
  shakeAccel: 18,
  highFiveAccel: 28,
  shakeCooldownMs: 400,
};

export const WALK = {
  speedPxPerSec: 260,
  edgeBufferFrac: 0.08,
};

export const NET = {
  sendHz: 20,
};

export const STATE_TIMEOUTS = {
  waving: 1200,
  celebrating: 1500,
  highFive: 1500,
  dancing: 2500,
};

export const qs = new URLSearchParams(location.search);
export const DEBUG = qs.has('debug');
export const MOCK = qs.has('mock');
export const ROOM_SUFFIX = qs.get('room') || '';
export const FULL_ROOM = ROOM_SUFFIX ? `${ROOM_ID}-${ROOM_SUFFIX}` : ROOM_ID;
