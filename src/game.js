import { drawStickman } from './stickman.js';
import { getTilt, onShake } from './input.js';
import { updateLocalMotion, computeNearPeer, snapLocalToEdge } from './world.js';
import { createFSM } from './fsm.js';
import { send, on as onPeer } from './peer.js';
import { NET } from './config.js';

let canvas, ctx;
let world, fsm;
let lastTs = 0;
let poseT = 0;
let pendingShake = null;
let running = false;

export function startGame(worldRef) {
  world = worldRef;
  fsm = createFSM();
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  onShake(intensity => { pendingShake = intensity; });

  onPeer('data', msg => {
    if (!msg) return;
    if (msg.event === 'hello') {
      if (msg.color) world.remote.color = msg.color;
      return;
    }
    if (msg.event === 'shake') {
      // peer shook; could mirror, but we mostly react locally
      return;
    }
    if (typeof msg.x === 'number') {
      world.remote.x = msg.x;
      world.remote.facing = msg.facing ?? world.remote.facing;
      world.remote.state = msg.state || 'idle';
      if (msg.color) world.remote.color = msg.color;
      world.remote.lastSeenTs = performance.now();
    }
  });

  onPeer('peer', p => {
    world.remote.connected = !!p.connected;
    if (p.connected) {
      send({ event: 'hello', color: world.local.color });
    }
  });

  // Networking send tick
  setInterval(() => {
    send({
      t: Date.now(),
      x: world.local.x,
      facing: world.local.facing,
      state: world.local.state,
      color: world.local.color,
    });
  }, 1000 / NET.sendHz);

  running = true;
  requestAnimationFrame(frame);
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
  updateLocalMotion(world, tilt, dt);

  const nearPeer = computeNearPeer(world);
  const prevState = world.local.state;
  fsm.tick({
    tilt,
    nearPeer,
    peerState: world.remote.state,
    shake: pendingShake,
  });
  pendingShake = null;
  world.local.state = fsm.state;

  // Snap to edge when just entered holding-hands
  if (prevState !== 'holding-hands' && world.local.state === 'holding-hands') {
    snapLocalToEdge(world);
  }

  render();
  requestAnimationFrame(frame);
}

function render() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  drawBackground(w, h);

  const ground = Math.min(h - 40, h * 0.88);
  const stickH = Math.min(h * 0.62, Math.max(220, h * 0.55));

  // Remote first (so local is on top if they overlap at edge)
  if (world.remote.connected && world.remote.x != null) {
    drawStickman(ctx, {
      x: world.remote.x * w,
      groundY: ground,
      h: stickH,
      facing: world.remote.facing,
      color: world.remote.color,
      poseT,
      state: mirrorStateForRemote(world.remote.state),
    });
  }
  drawStickman(ctx, {
    x: world.local.x * w,
    groundY: ground,
    h: stickH,
    facing: world.local.facing,
    color: world.local.color,
    poseT,
    state: world.local.state,
  });
}

function mirrorStateForRemote(s) {
  return s;
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
  ctx.strokeStyle = '#d0e4f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.arc(x + size * 0.45, y - size * 0.15, size * 0.4, 0, Math.PI * 2);
  ctx.arc(x + size * 0.85, y, size * 0.5, 0, Math.PI * 2);
  ctx.arc(x + size * 0.4, y + size * 0.1, size * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
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
