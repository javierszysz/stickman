import { WALK } from './config.js';

// World state (held on each device):
// - phoneId: 'A' (host) or 'B' (guest), set at peer open
// - stickmen keyed by owner — each phone owns exactly one stickman and is
//   authoritative for its position + state + which phone it's currently ON.
// - When the peer is connected, BOTH edges of every phone act as a portal
//   ("gateway") to the other device: walk off any edge and the stickman
//   appears on the opposite edge of the peer's phone.
export function createWorld() {
  return {
    phoneId: 'A',
    peerPhoneId: 'B',
    stickmen: {
      A: { x: 0.5, facing: 1,  color: 'pink', state: 'idle', phone: 'A' },
      B: { x: 0.5, facing: -1, color: 'blue', state: 'idle', phone: 'B' },
    },
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

function otherPhone(p) { return p === 'A' ? 'B' : 'A'; }

// Move local stickman by tilt. When peer connected, walking off either edge
// crosses to peer's phone (appearing on the opposite edge). If not connected,
// clamp at edges.
export function updateLocalMotion(world, tilt, dt) {
  const me = getLocalStickman(world);
  if (['holding-hands', 'hug', 'high-five', 'waving', 'dancing'].includes(me.state)) return;

  const screenW = window.innerWidth || 1;
  const dx = (tilt * WALK.speedPxPerSec * dt) / screenW;
  me.x += dx;

  if (tilt < -0.05) me.facing = -1;
  else if (tilt > 0.05) me.facing = 1;

  if (world.peerConnected) {
    if (me.x >= 0.97 && tilt > 0) {
      me.x = 0.03;
      me.phone = otherPhone(me.phone);
      me.facing = 1;
      return;
    }
    if (me.x <= 0.03 && tilt < 0) {
      me.x = 0.97;
      me.phone = otherPhone(me.phone);
      me.facing = -1;
      return;
    }
  }

  me.x = Math.max(0.02, Math.min(0.98, me.x));
}
