import { FULL_ROOM, MOCK } from './config.js';

// PeerJS lobby-less pattern: one device tries to be host ("stickman-<room>-host"),
// if that ID is taken, become guest ("stickman-<room>-guest") and dial the host.

let peer = null;
let conn = null;
const listeners = { open: [], peer: [], data: [], close: [] };

export function connect() {
  if (MOCK) { startMock(); return; }

  const hostId  = `stickman-${FULL_ROOM}-host`;
  const guestId = `stickman-${FULL_ROOM}-guest`;

  tryBecomeHost(hostId, guestId);
}

function tryBecomeHost(hostId, guestId) {
  if (!window.Peer) {
    console.warn('PeerJS not loaded; retrying');
    setTimeout(() => tryBecomeHost(hostId, guestId), 500);
    return;
  }
  peer = new window.Peer(hostId, { debug: 1 });
  let resolved = false;

  peer.on('open', id => {
    resolved = true;
    emit('open', { role: 'host', id });
    peer.on('connection', c => bindConn(c));
  });
  peer.on('error', err => {
    if (resolved) {
      console.warn('peer error:', err.type, err.message);
      return;
    }
    // Most likely "unavailable-id" — become guest
    if (err.type === 'unavailable-id' || /taken|unavailable/i.test(err.message || '')) {
      try { peer.destroy(); } catch {}
      becomeGuest(hostId, guestId);
    } else {
      console.warn('peer init error, retrying as guest:', err.type, err.message);
      try { peer.destroy(); } catch {}
      setTimeout(() => becomeGuest(hostId, guestId), 1000);
    }
  });
}

function becomeGuest(hostId, guestId) {
  peer = new window.Peer(guestId, { debug: 1 });
  peer.on('open', () => {
    emit('open', { role: 'guest', id: guestId });
    const c = peer.connect(hostId, { reliable: false, serialization: 'json' });
    bindConn(c);
  });
  peer.on('error', err => {
    console.warn('guest peer error:', err.type, err.message);
    // If guest ID also taken (>2 devices), try a random suffix
    if (err.type === 'unavailable-id') {
      try { peer.destroy(); } catch {}
      const rand = Math.random().toString(36).slice(2, 6);
      peer = new window.Peer(`stickman-${FULL_ROOM}-${rand}`, { debug: 1 });
      peer.on('open', () => {
        emit('open', { role: 'guest', id: `stickman-${FULL_ROOM}-${rand}` });
        const c = peer.connect(hostId, { reliable: false, serialization: 'json' });
        bindConn(c);
      });
    }
  });
}

function bindConn(c) {
  conn = c;
  c.on('open', () => emit('peer', { connected: true }));
  c.on('data', d => emit('data', d));
  c.on('close', () => { emit('peer', { connected: false }); emit('close', {}); });
  c.on('error', e => console.warn('conn error:', e));
}

export function send(obj) {
  if (conn && conn.open) {
    try { conn.send(obj); } catch (e) { /* ignore */ }
  }
}

export function on(event, fn) { listeners[event]?.push(fn); }
function emit(event, payload) { (listeners[event] || []).forEach(fn => fn(payload)); }

export function isConnected() { return conn && conn.open; }

// Mock peer for solo dev: fake remote walks back and forth
function startMock() {
  setTimeout(() => emit('open', { role: 'mock', id: 'mock' }), 100);
  setTimeout(() => emit('peer', { connected: true }), 300);
  setTimeout(() => emit('data', { event: 'hello', color: 'blue' }), 350);
  let x = 0.2, dir = 1;
  setInterval(() => {
    x += 0.01 * dir;
    if (x > 0.9) dir = -1;
    if (x < 0.05) dir = 1;
    emit('data', {
      t: Date.now(), x, facing: dir,
      state: 'walking', color: 'blue',
    });
  }, 50);
}
