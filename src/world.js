import { WALK } from './config.js';

// World state (held on each device):
// - phoneId: 'A' (host) or 'B' (guest), set at peer open
// - stickmen keyed by owner — each phone owns exactly one stickman and is
//   authoritative for its position + state + which phone it's currently ON.
// - docked: true when both phones report similar orientation for a moment.
// - each phone also tracks the peer's orientation to compute docking.
export function createWorld() {
  return {
    phoneId: 'A',
    peerPhoneId: 'B',
    stickmen: {
      A: { x: 0.5, facing: 1,  color: 'pink', state: 'idle', phone: 'A' },
      B: { x: 0.5, facing: -1, color: 'blue', state: 'idle', phone: 'B' },
    },
    docked: false,
    dockTimer: 0,
    undockTimer: 0,
    myOrientation: null,
    peerOrientation: null,
    peerConnected: false,
  };
}

export function setPhoneIdentity(world, role) {
  world.phoneId = role === 'host' ? 'A' : 'B';
  world.peerPhoneId = role === 'host' ? 'B' : 'A';
  // Each stickman starts on its owner's phone.
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

// Move local stickman by tilt. If docked, walking off an edge crosses to the
// peer's phone (appearing on the opposite edge). If not docked, clamp.
export function updateLocalMotion(world, tilt, dt) {
  const me = getLocalStickman(world);
  // Locked poses don't move
  if (['holding-hands', 'hug', 'high-five', 'waving', 'dancing'].includes(me.state)) return;

  const screenW = window.innerWidth || 1;
  const dx = (tilt * WALK.speedPxPerSec * dt) / screenW;
  me.x += dx;

  if (tilt < -0.05) me.facing = -1;
  else if (tilt > 0.05) me.facing = 1;

  if (world.docked) {
    // Cross to peer's phone when walking off either edge.
    if (me.x > 1) {
      me.x = 0.02;
      me.phone = otherPhone(me.phone);
    } else if (me.x < 0) {
      me.x = 0.98;
      me.phone = otherPhone(me.phone);
    }
  } else {
    me.x = Math.max(0.03, Math.min(0.97, me.x));
  }
}

function otherPhone(p) { return p === 'A' ? 'B' : 'A'; }

// Docking detection: orientation match for 800ms -> docked; mismatch for 400ms -> undocked.
export function updateDocking(world, dt) {
  if (!world.myOrientation || !world.peerOrientation || !world.peerConnected) {
    world.docked = false;
    world.dockTimer = 0;
    world.undockTimer = 0;
    return;
  }
  const m = world.myOrientation;
  const p = world.peerOrientation;
  const dBeta  = Math.abs((m.beta  || 0) - (p.beta  || 0));
  const dGamma = Math.abs((m.gamma || 0) - (p.gamma || 0));

  const similar    = dBeta < 15 && dGamma < 15;
  const dissimilar = dBeta > 25 || dGamma > 25;
  const dtMs = dt * 1000;

  if (!world.docked) {
    if (similar) world.dockTimer += dtMs; else world.dockTimer = 0;
    if (world.dockTimer > 800) { world.docked = true; world.undockTimer = 0; }
  } else {
    if (dissimilar) world.undockTimer += dtMs; else world.undockTimer = 0;
    if (world.undockTimer > 400) { world.docked = false; world.dockTimer = 0; }
  }
}
