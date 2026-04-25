export const ROOM_ID = 'lara';

export const COLORS = {
  pink:   { skin: '#ffb0d0', accent: '#d63384', name: 'Pink' },
  blue:   { skin: '#a8d8ff', accent: '#1e6fbd', name: 'Blue' },
  green:  { skin: '#b8f0b8', accent: '#2e8b2e', name: 'Green' },
  yellow: { skin: '#ffe88a', accent: '#c08a00', name: 'Yellow' },
  purple: { skin: '#dcb0ff', accent: '#7d2eb0', name: 'Purple' },
  orange: { skin: '#ffc89a', accent: '#d8590f', name: 'Orange' },
  teal:   { skin: '#a8efe0', accent: '#1f8a8a', name: 'Teal' },
  red:    { skin: '#ffb0b0', accent: '#c92a2a', name: 'Red' },
};

export const OUTFITS = {
  plain:  { name: 'Plain' },
  bow:    { name: 'Bow' },
  crown:  { name: 'Crown' },
  hat:    { name: 'Top hat' },
  beanie: { name: 'Beanie' },
  flower: { name: 'Flower' },
};

export const COLOR_KEYS = Object.keys(COLORS);
export const OUTFIT_KEYS = Object.keys(OUTFITS);

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
  jumping: 600,
};

// Flower system tunables
export const FLOWERS = {
  perPhone: 4,           // target live flowers on each phone
  spawnEverySecMin: 2.5,
  spawnEverySecMax: 5.5,
  pickProximity: 0.06,   // |stickman.x - flower.x| < this -> pick
  bigBonus: 3,           // big flower value
  normalValue: 1,
  hostBroadcastSec: 1.5, // periodic full sync
  paletteIdx: ['pink', 'yellow', 'purple', 'white', 'red', 'blue'],
};

export const qs = new URLSearchParams(location.search);
export const DEBUG = qs.has('debug');
export const MOCK = qs.has('mock');
export const ROOM_SUFFIX = qs.get('room') || '';
export const FULL_ROOM = ROOM_SUFFIX ? `${ROOM_ID}-${ROOM_SUFFIX}` : ROOM_ID;
