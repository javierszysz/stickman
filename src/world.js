import { WALK } from './config.js';

// World state (held on each device):
// - phoneId: 'A' (host) or 'B' (guest), set at peer open
// - stickmen keyed by owner — each phone owns exactly one stickman and is
//   authoritative for its position + state + which phone it's currently ON.
// - meeting: 'left' | 'right' | null  — which edge the stickmen are meeting at
//   (relative to THIS phone). Computed each frame from positions.
export function createWorld() {
  return {
    phoneId: 'A',
    peerPhoneId: 'B',
    stickmen: {
      A: { x: 0.5, facing: 1,  color: 'pink', state: 'idle', phone: 'A' },
      B: { x: 0.5, facing: -1, color: 'blue', state: 'idle', phone: 'B' },
    },
    meeting: null,
    peerConnected: false,
  };
}

export function setPhoneIdentity(world, role) {
  world.phoneId = role === 'host' ? 'A' : 'B';
  world.peerPhoneId = role === 'host' ? 'B' : 'A';
  world.stickmen.A.phone = 'A';
  world.stickmen.B.phone = 'B';
}

export function getLocalStickman(world) {
  return world.stickmen[world.phoneId];
}

export function getPeerStickman(world) {
  return world.stickmen[world.peerPhoneId];
}

// Meeting happens when both stickmen are on their own phones at adjacent
// edges. Symmetric: either my-right/their-left or my-left/their-right.
// Returns 'left' | 'right' | null  (relative to THIS phone).
export function computeMeeting(world) {
  if (!world.peerConnected) return null;
  const me = getLocalStickman(world);
  const peer = getPeerStickman(world);
  if (me.phone !== world.phoneId || peer.phone !== world.peerPhoneId) return null;
  const EDGE = 0.06;
  if (me.x > 1 - EDGE && peer.x < EDGE) return 'right';
  if (me.x < EDGE && peer.x > 1 - EDGE) return 'left';
  return null;
}

// Stickmen currently rendered on THIS phone.
export function stickmenOnThisPhone(world) {
  return Object.values(world.stickmen).filter(s => s.phone === world.phoneId);
}

// Are the two stickmen on the same phone and close in x?
export function sameSpot(world) {
  const a = world.stickmen.A;
  const b = world.stickmen.B;
  if (a.phone !== b.phone) return false;
  return Math.abs(a.x - b.x) < 0.15;
}

// Move local stickman by tilt. Cross to peer when walking further past the
// meeting edge; otherwise clamp.
export function updateLocalMotion(world, tilt, dt) {
  const me = getLocalStickman(world);
  if (['holding-hands', 'hug', 'high-five', 'waving', 'dancing'].includes(me.state)) return;

  const screenW = window.innerWidth || 1;
  const dx = (tilt * WALK.speedPxPerSec * dt) / screenW;
  me.x += dx;

  if (tilt < -0.05) me.facing = -1;
  else if (tilt > 0.05) me.facing = 1;

  const meeting = world.meeting;

  // Crossing: only when meeting AND walking past the meeting edge.
  if (meeting === 'right' && me.x > 1 && tilt > 0) {
    me.x = 0.02;
    me.phone = world.peerPhoneId;
    me.facing = 1;
    return;
  }
  if (meeting === 'left' && me.x < 0 && tilt < 0) {
    me.x = 0.98;
    me.phone = world.peerPhoneId;
    me.facing = -1;
    return;
  }

  // If I'm on the peer's phone (visiting), I cross back by walking off the
  // opposite side from how I arrived.
  if (me.phone !== world.phoneId) {
    if (me.x < 0 && tilt < 0) {
      me.x = 0.98;
      me.phone = world.phoneId;
      me.facing = -1;
      return;
    }
    if (me.x > 1 && tilt > 0) {
      me.x = 0.02;
      me.phone = world.phoneId;
      me.facing = 1;
      return;
    }
  }

  me.x = Math.max(0.03, Math.min(0.97, me.x));
}

