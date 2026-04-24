import { FLOWERS } from './config.js';

// Shared flower world.
// Host (phoneId === 'A') is authoritative for spawn + counter.
// Guest receives the flower list via 'flowers' messages.
// Either side can detect a local pick and emit a 'pick' message.

const FLOWER_PALETTE = {
  pink:   '#ff5c8a',
  yellow: '#ffd94d',
  purple: '#c77dff',
  white:  '#ffffff',
  red:    '#ff6b6b',
  blue:   '#7cc6ff',
};

export function createFlowerStore() {
  return {
    flowers: new Map(),     // id -> {id, x, y, phone, color, born, big, picked}
    nextId: 1,
    count: 0,               // shared total flowers picked
    nextSpawnAt: 0,         // host-only timer
    pendingPicks: new Set(), // ids we've already locally claimed (avoid double)
  };
}

// Host-side: spawn + lifecycle. Returns true if state changed (broadcast hint).
export function tickHostFlowers(store, world, now) {
  let changed = false;
  // Count live flowers per phone
  const counts = { A: 0, B: 0 };
  for (const f of store.flowers.values()) {
    if (!f.picked) counts[f.phone] = (counts[f.phone] || 0) + 1;
  }
  if (now < store.nextSpawnAt) return false;
  store.nextSpawnAt = now + (FLOWERS.spawnEverySecMin
    + Math.random() * (FLOWERS.spawnEverySecMax - FLOWERS.spawnEverySecMin)) * 1000;
  // Spawn one flower on whichever phone is below its target count
  const target = FLOWERS.perPhone;
  const phone = (counts.A < counts.B) ? 'A' : (counts.B < counts.A ? 'B' : (Math.random() < 0.5 ? 'A' : 'B'));
  if (counts[phone] >= target) return false;
  const colors = Object.keys(FLOWER_PALETTE);
  const id = `f${store.nextId++}`;
  store.flowers.set(id, {
    id, phone,
    x: 0.1 + Math.random() * 0.8,
    y: 0,             // y is computed at render time from ground
    color: colors[Math.floor(Math.random() * colors.length)],
    born: now,
    big: false,
    picked: false,
  });
  changed = true;
  return changed;
}

// Sweep picked flowers older than 600ms so they don't accumulate forever.
export function sweepPicked(store, now) {
  let changed = false;
  for (const [id, f] of store.flowers) {
    if (f.picked && now - (f.pickedAt || now) > 600) {
      store.flowers.delete(id);
      changed = true;
    }
  }
  return changed;
}

// Try to detect a pick by my local stickman (or any visible stickman on my
// phone). Returns an array of pick events to broadcast.
export function detectLocalPicks(store, world, myPhoneId) {
  const events = [];
  const stickmenHere = Object.entries(world.stickmen)
    .filter(([, s]) => s.phone === myPhoneId);
  for (const f of store.flowers.values()) {
    if (f.picked || f.phone !== myPhoneId) continue;
    if (store.pendingPicks.has(f.id)) continue;
    // who's near?
    const closeOwners = [];
    for (const [owner, s] of stickmenHere) {
      if (Math.abs(s.x - f.x) < FLOWERS.pickProximity) closeOwners.push(owner);
    }
    if (closeOwners.length === 0) continue;
    // Big if BOTH stickmen on this phone are near
    const big = closeOwners.length >= 2;
    const value = big ? FLOWERS.bigBonus : FLOWERS.normalValue;
    // Pick attribution: the stickman owned by this phone's player if present,
    // otherwise the first close owner.
    const by = closeOwners.includes(myPhoneId) ? myPhoneId : closeOwners[0];
    store.pendingPicks.add(f.id);
    events.push({ event: 'pick', id: f.id, by, big, value, at: Date.now() });
  }
  return events;
}

// Apply a pick — both peers do this so visuals stay in sync.
// Returns the resolved pick (or null if already picked / unknown id).
export function applyPick(store, msg, isHost) {
  const f = store.flowers.get(msg.id);
  if (!f || f.picked) return null;
  f.picked = true;
  f.big = !!msg.big;
  f.pickedAt = performance.now();
  if (isHost) store.count += msg.value || 1;
  return f;
}

// Build a snapshot the host broadcasts to the guest.
export function buildSnapshot(store) {
  return {
    event: 'flowers',
    count: store.count,
    flowers: Array.from(store.flowers.values()).map(f => ({
      id: f.id, x: f.x, phone: f.phone, color: f.color,
      big: f.big, picked: f.picked,
    })),
  };
}

// Guest side: replace local flower set from a snapshot.
export function applySnapshot(store, msg) {
  const incoming = new Map();
  for (const f of msg.flowers || []) {
    const existing = store.flowers.get(f.id);
    incoming.set(f.id, {
      id: f.id,
      phone: f.phone,
      x: f.x,
      color: f.color,
      big: !!f.big,
      picked: !!f.picked,
      pickedAt: existing?.pickedAt || (f.picked ? performance.now() : null),
      born: existing?.born || performance.now(),
    });
  }
  store.flowers = incoming;
  if (typeof msg.count === 'number') store.count = msg.count;
}

// Render flowers on this phone.
export function drawFlowers(ctx, store, myPhoneId, w, ground, t) {
  for (const f of store.flowers.values()) {
    if (f.phone !== myPhoneId) continue;
    if (f.picked) continue;
    const x = f.x * w;
    const baseY = ground - 6;
    const bob = Math.sin(t * 3 + (f.x * 17)) * 3;
    const y = baseY + bob;
    drawFlowerSprite(ctx, x, y, FLOWER_PALETTE[f.color] || '#ffd94d', t, f.id);
  }
}

function drawFlowerSprite(ctx, x, y, color, t, seed) {
  const r = 14;
  // Faint pulsing glow ring
  const pulse = 0.5 + 0.5 * Math.sin(t * 3 + (seed.charCodeAt ? seed.charCodeAt(1) : 0));
  ctx.save();
  ctx.fillStyle = `rgba(255, 255, 200, ${0.18 + 0.18 * pulse})`;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.7, 0, Math.PI * 2);
  ctx.fill();
  // stem
  ctx.strokeStyle = '#2f7a2a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.lineTo(x, y - r * 0.2);
  ctx.stroke();
  // petals
  ctx.fillStyle = color;
  ctx.strokeStyle = '#2a1b14';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55,
            r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // center
  ctx.fillStyle = '#ffd94d';
  ctx.strokeStyle = '#a08000';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function flowerScreenPos(flower, w, ground, t) {
  const x = flower.x * w;
  const baseY = ground - 6;
  const bob = Math.sin(t * 3 + (flower.x * 17)) * 3;
  return { x, y: baseY + bob };
}
