import { COLORS } from './config.js';

// Draw a stickman at (x, groundY) with height h.
// s: { x, groundY, h, facing: -1|1, color: key, poseT, state, linkX? }
// states: idle, walking, waving, holding-hands (linkX=where the held hand reaches),
//         high-five, dancing, hug
export function drawStickman(ctx, s) {
  const c = COLORS[s.color] || COLORS.blue;
  const h = s.h;
  const headR = h * 0.12;
  const neckY = s.groundY - h * 0.82;
  const hipY  = s.groundY - h * 0.45;
  const footBase = s.groundY;
  const shoulderY = neckY + h * 0.06;

  const walkPhase = (s.state === 'walking' || s.state === 'dancing')
    ? Math.sin(s.poseT * 10) : 0;
  const bob = s.state === 'walking' ? Math.abs(Math.sin(s.poseT * 10)) * h * 0.03 : 0;
  const dancePhase = s.state === 'dancing' ? Math.sin(s.poseT * 8) : 0;

  const cx = s.x;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#222';
  ctx.fillStyle = c.skin;
  ctx.lineWidth = Math.max(4, h * 0.04);

  // head
  ctx.beginPath();
  ctx.arc(cx, neckY - headR - bob, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // face
  ctx.fillStyle = '#222';
  const eyeOff = headR * 0.35;
  const eyeY = neckY - headR - bob - headR * 0.1;
  ctx.beginPath();
  ctx.arc(cx - eyeOff * s.facing, eyeY, headR * 0.12, 0, Math.PI * 2);
  ctx.arc(cx + eyeOff * 0.3 * s.facing, eyeY, headR * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // smile
  ctx.beginPath();
  ctx.lineWidth = Math.max(2, h * 0.015);
  ctx.arc(cx + headR * 0.1 * s.facing, neckY - headR - bob + headR * 0.2,
    headR * 0.35, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.lineWidth = Math.max(4, h * 0.04);
  ctx.strokeStyle = c.accent;

  // body
  ctx.beginPath();
  ctx.moveTo(cx, neckY - bob);
  ctx.lineTo(cx, hipY - bob);
  ctx.stroke();

  // arms
  const armLen = h * 0.32;
  let leftArm, rightArm;
  if (s.state === 'waving') {
    const w = Math.sin(s.poseT * 14) * 0.5;
    leftArm  = { a: Math.PI * 0.6, b: Math.PI * 0.6 };
    rightArm = { a: -Math.PI * 0.45 + w * 0.3, b: -Math.PI * 0.85 + w * 0.3 };
  } else if (s.state === 'holding-hands' || s.state === 'hug') {
    leftArm  = { a: Math.PI * 0.55, b: Math.PI * 0.55 };
    rightArm = { a: -Math.PI * 0.05, b: 0 };
    if (s.facing === -1) [leftArm, rightArm] = [rightArm, leftArm];
  } else if (s.state === 'high-five') {
    const w = Math.sin(s.poseT * 20) * 0.15;
    leftArm  = { a: Math.PI * 0.55, b: Math.PI * 0.55 };
    rightArm = { a: -Math.PI * 0.5 + w, b: -Math.PI * 0.7 + w };
    if (s.facing === -1) [leftArm, rightArm] = [rightArm, leftArm];
  } else if (s.state === 'dancing') {
    const d = dancePhase;
    leftArm  = { a: Math.PI * 0.3 + d * 0.6, b: Math.PI * 0.3 + d * 0.6 };
    rightArm = { a: -Math.PI * 0.3 - d * 0.6, b: -Math.PI * 0.3 - d * 0.6 };
  } else {
    // idle / walking
    leftArm  = { a: Math.PI * 0.55 + walkPhase * 0.4, b: Math.PI * 0.55 + walkPhase * 0.6 };
    rightArm = { a: -Math.PI * 0.55 - walkPhase * 0.4, b: -Math.PI * 0.55 - walkPhase * 0.6 };
  }
  drawLimb(ctx, cx, shoulderY - bob, leftArm.a, leftArm.b, armLen);
  drawLimb(ctx, cx, shoulderY - bob, rightArm.a, rightArm.b, armLen);

  // legs
  const legLen = h * 0.42;
  let leftLeg, rightLeg;
  if (s.state === 'dancing') {
    const d = dancePhase;
    leftLeg  = { a: Math.PI * 0.08 + d * 0.3, b: d * 0.2 };
    rightLeg = { a: -Math.PI * 0.08 - d * 0.3, b: -d * 0.2 };
  } else if (s.state === 'walking') {
    const p = walkPhase;
    leftLeg  = { a: p * 0.6, b: p * 0.4 };
    rightLeg = { a: -p * 0.6, b: -p * 0.4 };
  } else {
    leftLeg  = { a: 0.08, b: 0 };
    rightLeg = { a: -0.08, b: 0 };
  }
  drawLimb(ctx, cx, hipY - bob, Math.PI + leftLeg.a,  Math.PI + leftLeg.b,  legLen, true);
  drawLimb(ctx, cx, hipY - bob, Math.PI + rightLeg.a, Math.PI + rightLeg.b, legLen, true);

  ctx.restore();
}

// drawLimb draws a two-segment limb from (x,y) with angles a (shoulder/hip) and b (elbow/knee).
function drawLimb(ctx, x, y, a, b, len, isLeg=false) {
  const seg = len * 0.55;
  // a is measured with 0 = right, PI/2 = down? Keep simple: angle from +x axis.
  const x1 = x + Math.cos(a) * seg;
  const y1 = y + Math.sin(a) * seg;
  const x2 = x1 + Math.cos(b) * seg;
  const y2 = y1 + Math.sin(b) * seg;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  // small foot/hand dot
  ctx.save();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(x2, y2, isLeg ? 6 : 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Standalone helper for loader / picker preview canvas
export function drawPreview(canvas, color) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 120;
  const h = canvas.clientHeight || 160;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  drawStickman(ctx, {
    x: w / 2, groundY: h - 8, h: h - 16, facing: 1,
    color, poseT: performance.now() / 1000, state: 'idle',
  });
}
