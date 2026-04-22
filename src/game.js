import { drawStickman } from './stickman.js';
import { getTilt, onShake, onJump } from './input.js';
import {
  updateLocalMotion, sameSpot,
  getLocalStickman, getPeerStickman,
} from './world.js';
import { createFSM } from './fsm.js';
import { send, on as onPeer } from './peer.js';
import { NET, DEBUG } from './config.js';
import { emitSparkle, emitFirework, updateParticles, renderParticles } from './particles.js';

let canvas, ctx;
let world, fsm;
let lastTs = 0;
let poseT = 0;
let pendingShake = null;
let pendingJump = false;
let running = false;
const prevStates = { A: 'idle', B: 'idle' };
const prevPhones = { A: 'A', B: 'B' };

export function startGame(worldRef) {
  world = worldRef;
  fsm = createFSM();
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  onShake(intensity => { pendingShake = intensity; });
  onJump(() => { pendingJump = true; });

  onPeer('data', msg => {
    if (!msg) return;
    if (msg.event === 'hello') {
      if (msg.color && msg.owner) world.stickmen[msg.owner].color = msg.color;
      return;
    }
    // Full state packet from peer
    if (msg.owner && msg.owner !== world.phoneId) {
      const s = world.stickmen[msg.owner];
      if (typeof msg.x === 'number') s.x = msg.x;
      if (typeof msg.facing === 'number') s.facing = msg.facing;
      if (msg.state && msg.state !== s.state) {
        s.state = msg.state;
        s.stateEnteredAt = performance.now();
      }
      if (msg.color) s.color = msg.color;
      if (msg.phone) s.phone = msg.phone;
    }
  });

  onPeer('peer', p => {
    world.peerConnected = !!p.connected;
    if (p.connected) {
      const me = getLocalStickman(world);
      send({ event: 'hello', owner: world.phoneId, color: me.color });
    }
  });

  // Networking send tick
  setInterval(() => {
    const me = getLocalStickman(world);
    send({
      t: Date.now(),
      owner: world.phoneId,
      x: me.x,
      facing: me.facing,
      state: me.state,
      color: me.color,
      phone: me.phone,
    });
  }, 1000 / NET.sendHz);

  running = true;
  requestAnimationFrame(frame);
}

function sparkleBurst(stickman, count, opts = {}) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const ground = Math.min(h - 40, h * 0.88);
  const stickH = Math.min(h * 0.62, Math.max(220, h * 0.55));
  const x = stickman.x * w;
  const y = opts.arrival ? ground - stickH * 0.3 : (opts.low ? ground - 10 : ground - stickH * 0.5);
  emitSparkle(x, y, count, opts);
}

function skyFireworks(n) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const x = 60 + Math.random() * (w - 120);
      const y = 40 + Math.random() * (h * 0.5);
      emitFirework(x, y, 30 + Math.floor(Math.random() * 20));
    }, i * 160);
  }
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width  = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function frame(ts) {
  if (!running) return;
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
  lastTs = ts;
  poseT += dt;

  const tilt = getTilt();
  const me = getLocalStickman(world);
  const peer = getPeerStickman(world);
  const prevPhone = me.phone;

  updateLocalMotion(world, tilt, dt);

  const nearPeer = sameSpot(world);
  fsm.tick({
    tilt,
    nearPeer,
    peerState: peer.state,
    shake: pendingShake,
    jump: pendingJump,
  });
  pendingShake = null;
  pendingJump = false;
  if (me.state !== fsm.state) {
    me.state = fsm.state;
    me.stateEnteredAt = performance.now();
  }

  // Particle triggers: fireworks only when stickmen meet (celebrating).
  // Other state changes get a small character-level sparkle, no sky fireworks.
  for (const key of ['A', 'B']) {
    const s = world.stickmen[key];
    if (s.state !== prevStates[key]) {
      if (s.phone === world.phoneId) {
        if (s.state === 'celebrating') { sparkleBurst(s, 30); skyFireworks(7); }
        else if (s.state === 'jumping') sparkleBurst(s, 8, { low: true });
        else if (s.state === 'high-five') sparkleBurst(s, 20);
        else if (s.state === 'dancing') sparkleBurst(s, 14);
      }
      prevStates[key] = s.state;
    }
    if (s.phone !== prevPhones[key]) {
      if (s.phone === world.phoneId) sparkleBurst(s, 22, { arrival: true });
      prevPhones[key] = s.phone;
    }
  }

  updateParticles(dt);

  render();
  requestAnimationFrame(frame);
}

function render() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  drawBackground(w, h);

  const ground = Math.min(h - 40, h * 0.88);
  const stickH = Math.min(h * 0.62, Math.max(220, h * 0.55));

  // Both edges are portals whenever peer is connected
  if (world.peerConnected) {
    drawEdgeGlow(w, h, 'left');
    drawEdgeGlow(w, h, 'right');
  }

  renderParticles(ctx);

  // Render only stickmen physically on THIS phone. Peer's stickman first
  // so local appears on top if they overlap.
  const me = world.phoneId;
  const here = Object.entries(world.stickmen)
    .filter(([, s]) => s.phone === me)
    .sort(([ka], [kb]) => (ka === me ? 1 : 0) - (kb === me ? 1 : 0));
  for (const [, s] of here) {
    drawStickman(ctx, {
      x: s.x * w,
      groundY: ground,
      h: stickH,
      facing: s.facing,
      color: s.color,
      poseT,
      state: s.state,
      stateAge: (performance.now() - (s.stateEnteredAt || 0)) / 1000,
    });
  }

  if (DEBUG) drawDebugReadout(w);
}

function drawDebugReadout(w) {
  const A = world.stickmen.A;
  const B = world.stickmen.B;
  const parts = [
    `peer: ${world.peerConnected ? 'Y' : 'N'}`,
    `me: ${world.phoneId}`,
    `A@${A.phone} ${A.x.toFixed(2)} ${A.state}`,
    `B@${B.phone} ${B.x.toFixed(2)} ${B.state}`,
  ];
  ctx.save();
  ctx.font = '12px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  const text = parts.join(' · ');
  const pad = 6;
  const m = ctx.measureText(text);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(6, 6, m.width + pad * 2, 22);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, 6 + pad, 6 + 4);
  ctx.restore();
}

function drawEdgeGlow(w, h, side) {
  const t = performance.now() * 0.004;
  const pulse = 0.5 + 0.5 * Math.sin(t);
  const arrowSize = Math.min(70, Math.max(48, h * 0.09));
  const arrowX = side === 'right' ? w - arrowSize * 1.2 : arrowSize * 1.2;
  ctx.save();
  ctx.fillStyle = `rgba(255, 220, 100, ${0.75 + 0.2 * pulse})`;
  ctx.strokeStyle = '#a88800';
  ctx.lineWidth = 4;
  const dir = side === 'right' ? 1 : -1;
  drawArrow(ctx, arrowX, h / 2, dir, arrowSize);
  ctx.restore();
}

function drawArrow(ctx, x, y, dir, size) {
  ctx.beginPath();
  ctx.moveTo(x + dir * size, y);
  ctx.lineTo(x - dir * size * 0.5, y - size * 0.7);
  ctx.lineTo(x - dir * size * 0.5, y + size * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

const FLOWERS = []; // populated once per canvas size
let flowersForWidth = 0;

function makeFlowers(w, ground, h) {
  FLOWERS.length = 0;
  const count = Math.floor(w / 80);
  for (let i = 0; i < count; i++) {
    FLOWERS.push({
      x: (i + 0.3 + Math.random() * 0.4) * (w / count),
      y: ground + 10 + Math.random() * Math.max(10, (h - ground) - 20),
      color: ['#ff5c8a', '#ffd94d', '#ffffff', '#c77dff'][i % 4],
      size: 6 + Math.random() * 4,
    });
  }
  flowersForWidth = w;
}

function drawBackground(w, h) {
  // sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#7ec8f0');
  sky.addColorStop(0.7, '#c5e8ff');
  sky.addColorStop(1, '#e6f4ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Sun with rays
  const sx = w * 0.88, sy = h * 0.2, sr = Math.min(50, h * 0.08);
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#fff6a8';
  ctx.lineWidth = 6;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + performance.now() * 0.0002;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(a) * (sr + 8), sy + Math.sin(a) * (sr + 8));
    ctx.lineTo(sx + Math.cos(a) * (sr + 22), sy + Math.sin(a) * (sr + 22));
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#fff6a8';
  ctx.strokeStyle = '#ffd94d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Sun smile
  ctx.strokeStyle = '#c08a00';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(sx - sr * 0.25, sy - sr * 0.1, sr * 0.08, 0, Math.PI * 2);
  ctx.arc(sx + sr * 0.25, sy - sr * 0.1, sr * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx, sy + sr * 0.1, sr * 0.35, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Clouds (drift slowly with time)
  const drift = (performance.now() * 0.01) % (w + 300);
  drawCloud(ctx, ((w * 0.15 + drift) % (w + 300)) - 150, h * 0.15, 60);
  drawCloud(ctx, ((w * 0.55 + drift * 0.7) % (w + 300)) - 150, h * 0.1, 45);
  drawCloud(ctx, ((w * 0.8 + drift * 0.9) % (w + 300)) - 150, h * 0.25, 70);

  // ground
  const ground = Math.min(h - 40, h * 0.88);
  const groundGrad = ctx.createLinearGradient(0, ground, 0, h);
  groundGrad.addColorStop(0, '#8ed77c');
  groundGrad.addColorStop(1, '#4a9a3f');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, ground, w, h - ground);
  // grass line
  ctx.strokeStyle = '#3f8036';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x < w; x += 12) {
    ctx.moveTo(x, ground);
    ctx.lineTo(x + 4, ground - 5);
    ctx.moveTo(x + 6, ground);
    ctx.lineTo(x + 10, ground - 4);
  }
  ctx.stroke();

  // flowers (regenerated on resize)
  if (flowersForWidth !== w) makeFlowers(w, ground, h);
  for (const f of FLOWERS) drawFlower(ctx, f);
}

function drawCloud(ctx, x, y, size) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(120, 160, 200, 0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.arc(x + size * 0.45, y - size * 0.15, size * 0.4, 0, Math.PI * 2);
  ctx.arc(x + size * 0.85, y, size * 0.5, 0, Math.PI * 2);
  ctx.arc(x + size * 0.4, y + size * 0.1, size * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFlower(ctx, f) {
  // stem
  ctx.strokeStyle = '#2f7a2a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(f.x, f.y + f.size);
  ctx.lineTo(f.x, f.y - f.size * 0.3);
  ctx.stroke();
  // petals
  ctx.fillStyle = f.color;
  ctx.strokeStyle = '#2a1b14';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(f.x + Math.cos(a) * f.size * 0.6, f.y + Math.sin(a) * f.size * 0.6,
            f.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // center
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.size * 0.35, 0, Math.PI * 2);
  ctx.fill();
}
