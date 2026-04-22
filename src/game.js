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

  const ground = Math.min(h - 40, h * 0.9);
  const stickH = Math.min(h * 0.65, 360);

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

function drawBackground(w, h) {
  // sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#87ceeb');
  sky.addColorStop(1, '#d9f0ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // sun
  ctx.fillStyle = '#fff6a8';
  ctx.beginPath();
  ctx.arc(w * 0.85, h * 0.2, 50, 0, Math.PI * 2);
  ctx.fill();

  // ground
  const ground = Math.min(h - 40, h * 0.9);
  ctx.fillStyle = '#7ec96f';
  ctx.fillRect(0, ground, w, h - ground);
  ctx.fillStyle = '#5aa84e';
  ctx.fillRect(0, ground, w, 6);
}
