import { WALK } from './config.js';

// Positions are normalized 0..1 along screen X. y is fixed (ground level).
export function createWorld() {
  return {
    local: {
      x: 0.5, facing: 1, color: 'pink',
      state: 'idle',
    },
    remote: {
      x: null, facing: -1, color: 'blue',
      state: 'idle',
      connected: false,
      lastSeenTs: 0,
    },
  };
}

export function updateLocalMotion(world, tilt, dt) {
  if (world.local.state === 'holding-hands' || world.local.state === 'hug'
   || world.local.state === 'high-five') {
    // lock near right edge if in joint state
    return;
  }
  if (world.local.state === 'waving' || world.local.state === 'dancing') return;

  const screenW = window.innerWidth || 1;
  const dx = (tilt * WALK.speedPxPerSec * dt) / screenW;
  world.local.x = Math.max(0.03, Math.min(0.97, world.local.x + dx));
  if (tilt < -0.05) world.local.facing = -1;
  else if (tilt > 0.05) world.local.facing = 1;
}

// "Near peer" means we are near the shared edge and peer is near their shared edge too.
// By convention: local stickman meets peer at local's *right* edge (and peer's *left*).
// We don't know which physical side the other phone is on — so accept either: our right +
// their left, OR our left + their right (mirror).
export function computeNearPeer(world) {
  if (!world.remote.connected || world.remote.x == null) return false;
  const edge = WALK.edgeBufferFrac;
  const meRight  = world.local.x  > 1 - edge;
  const meLeft   = world.local.x  < edge;
  const themLeft  = world.remote.x < edge;
  const themRight = world.remote.x > 1 - edge;
  return (meRight && themLeft) || (meLeft && themRight);
}

// When entering holding-hands, snap local to the edge that matches.
export function snapLocalToEdge(world) {
  const edge = WALK.edgeBufferFrac;
  if (world.remote.x != null && world.remote.x < 0.5) {
    world.local.x = 1 - edge * 0.5;
    world.local.facing = 1;
  } else {
    world.local.x = edge * 0.5;
    world.local.facing = -1;
  }
}
