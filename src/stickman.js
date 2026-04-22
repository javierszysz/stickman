import { COLORS } from './config.js';

// Shared palette fragments
const SKIN = '#ffd7b0';
const SKIN_DARK = '#d49670';
const OUTLINE = '#2a1b14';

// Draw a cute little person at (x, groundY) with total pixel height h.
// s: { x, groundY, h, facing: -1|1, color: key, poseT, state }
// Feet always touch s.groundY (except for bob).
export function drawStickman(ctx, s) {
  const palette = COLORS[s.color] || COLORS.blue;
  const outfit = palette.accent;
  const h = s.h;

  // ---- Proportions (fractions of total height h) ----
  const headR = h * 0.12;
  const footY = s.groundY;
  const hipY  = s.groundY - h * 0.44;
  const shoulderY = s.groundY - h * 0.76;
  const neckY = shoulderY - h * 0.02;
  const headCY = neckY - headR;
  const cx = s.x;

  const armLen = h * 0.30;
  const legLen = h * 0.42;

  // Shoulder + hip attachment points (so limbs don't all emit from center)
  const shirtTopW = h * 0.26;
  const shirtBotW = h * 0.18;
  const shoulderInset = h * 0.018;
  const hipInset = h * 0.015;
  const shoulderL = cx - shirtTopW / 2 + shoulderInset;
  const shoulderR = cx + shirtTopW / 2 - shoulderInset;
  const hipL = cx - shirtBotW / 2 + hipInset;
  const hipR = cx + shirtBotW / 2 - hipInset;

  // ---- Animation phases ----
  const t = s.poseT;
  const walking = s.state === 'walking';
  const dancing = s.state === 'dancing';
  const celebrating = s.state === 'celebrating';
  const walkFreq = 9;
  const walkPhase = walking ? Math.sin(t * walkFreq) : 0;
  const walkBob = walking ? (1 - Math.abs(Math.cos(t * walkFreq))) * h * 0.02 : 0;
  const dancePhase = dancing ? Math.sin(t * 6) : 0;
  const danceBob = dancing ? Math.abs(Math.sin(t * 6)) * h * 0.04 : 0;
  const celebrateBob = celebrating ? Math.abs(Math.sin(t * 8)) * h * 0.05 : 0;
  const bob = -(walkBob + danceBob + celebrateBob);

  // ---- Per-state limb swings ----
  // Convention:
  //   swing = 0 -> straight down from joint
  //   swing > 0 -> rotates forward (in facing direction)
  //   swing = PI -> straight up
  //   bend is the elbow/knee angle added on for the lower segment
  let frontArm, backArm, frontLeg, backLeg;

  switch (s.state) {
    case 'walking': {
      const p = walkPhase;
      frontLeg = { swing:  p * 0.5, bend: Math.max(0, -p) * 0.55 };
      backLeg  = { swing: -p * 0.5, bend: Math.max(0,  p) * 0.55 };
      frontArm = { swing: -p * 0.4, bend: 0.08 };
      backArm  = { swing:  p * 0.4, bend: 0.08 };
      break;
    }
    case 'waving': {
      const w = Math.sin(t * 16);
      frontArm = { swing: Math.PI * 0.95 + w * 0.12, bend: -0.35 + w * 0.15 };
      backArm  = { swing: -0.04, bend: 0.08 };
      frontLeg = { swing: 0, bend: 0 };
      backLeg  = { swing: 0, bend: 0 };
      break;
    }
    case 'holding-hands': {
      frontArm = { swing: Math.PI * 0.5, bend: 0 };
      backArm  = { swing: 0.05, bend: 0.08 };
      frontLeg = { swing: 0, bend: 0 };
      backLeg  = { swing: 0, bend: 0 };
      break;
    }
    case 'high-five': {
      const w = Math.sin(t * 22) * 0.12;
      frontArm = { swing: Math.PI * 0.7 + w, bend: -0.2 };
      backArm  = { swing: 0.05, bend: 0.08 };
      frontLeg = { swing: 0, bend: 0 };
      backLeg  = { swing: 0, bend: 0 };
      break;
    }
    case 'hug': {
      frontArm = { swing: Math.PI * 0.52, bend: 0.55 };
      backArm  = { swing: Math.PI * 0.48, bend: 0.55 };
      frontLeg = { swing: 0, bend: 0 };
      backLeg  = { swing: 0, bend: 0 };
      break;
    }
    case 'celebrating': {
      // Both arms raised high, wiggling happily, with a little bounce.
      const w = Math.sin(t * 14);
      frontArm = { swing: Math.PI * 0.92 + w * 0.18, bend: -0.25 + w * 0.1 };
      backArm  = { swing: Math.PI * 1.08 - w * 0.18, bend: -0.25 - w * 0.1 };
      frontLeg = { swing: 0.02, bend: 0 };
      backLeg  = { swing: -0.02, bend: 0 };
      break;
    }
    case 'dancing': {
      const d = dancePhase;
      frontArm = { swing: Math.PI * 0.88 + d * 0.22, bend: -0.08 };
      backArm  = { swing: Math.PI * 1.12 - d * 0.22, bend: -0.08 };
      frontLeg = { swing:  d * 0.22, bend: Math.max(0, -d) * 0.25 };
      backLeg  = { swing: -d * 0.22, bend: Math.max(0,  d) * 0.25 };
      break;
    }
    default: { // idle
      const breathe = Math.sin(t * 2.2) * 0.02;
      frontArm = { swing: 0.02 + breathe, bend: 0.05 };
      backArm  = { swing: -0.02 - breathe, bend: 0.05 };
      frontLeg = { swing: 0, bend: 0 };
      backLeg  = { swing: 0, bend: 0 };
      break;
    }
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, footY + 2, h * 0.16, h * 0.025, 0, 0, Math.PI * 2);
  ctx.fill();

  const limbW = Math.max(6, h * 0.055);
  const armW  = Math.max(5, h * 0.045);

  // Which side is "front" depends on facing (facing=1 => front is right)
  const frontShoulder = s.facing === 1 ? shoulderR : shoulderL;
  const backShoulder  = s.facing === 1 ? shoulderL : shoulderR;
  const frontHip = s.facing === 1 ? hipR : hipL;
  const backHip  = s.facing === 1 ? hipL : hipR;

  // Back leg (behind torso)
  drawLimb(ctx, backHip, hipY + bob, legLen, backLeg.swing, backLeg.bend, s.facing,
           outfit, limbW, 'foot');
  // Back arm (behind torso)
  drawLimb(ctx, backShoulder, shoulderY + bob, armLen,
           backArm.swing, backArm.bend, s.facing, SKIN, armW, 'hand');

  // Torso (shirt)
  drawTorso(ctx, cx, shoulderY + bob, hipY + bob, shirtTopW, shirtBotW, h, outfit);

  // Front leg (in front of torso)
  drawLimb(ctx, frontHip, hipY + bob, legLen, frontLeg.swing, frontLeg.bend, s.facing,
           outfit, limbW, 'foot');
  // Front arm
  drawLimb(ctx, frontShoulder, shoulderY + bob, armLen,
           frontArm.swing, frontArm.bend, s.facing, SKIN, armW, 'hand');

  // Head + face
  drawHead(ctx, cx, headCY + bob, headR, outfit, s.facing, s.state, t);

  ctx.restore();
}

function drawLimb(ctx, x, y, len, swing, bend, facing, color, width, endMark) {
  const segU = len * 0.5;
  const segL = len * 0.5;
  const dir1X = Math.sin(swing) * facing;
  const dir1Y = Math.cos(swing);
  const midX = x + segU * dir1X;
  const midY = y + segU * dir1Y;
  const dir2X = Math.sin(swing + bend) * facing;
  const dir2Y = Math.cos(swing + bend);
  const endX = midX + segL * dir2X;
  const endY = midY + segL * dir2Y;

  // outline stroke
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = width + 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(midX, midY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  // fill stroke
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(midX, midY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  if (endMark === 'foot') {
    ctx.fillStyle = '#3a2a1f';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    const fw = len * 0.18, fh = len * 0.08;
    // foot points in facing direction
    ctx.save();
    ctx.translate(endX, endY);
    ctx.rotate(Math.atan2(dir2Y, dir2X) - Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, fw, fh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (endMark === 'hand') {
    ctx.fillStyle = SKIN;
    ctx.strokeStyle = SKIN_DARK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(endX, endY, len * 0.085, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawTorso(ctx, cx, shoulderY, hipY, shirtW, hipW, h, color) {
  const r = h * 0.04;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(3, h * 0.022);
  ctx.beginPath();
  // Rounded trapezoid: shoulders wider than hips
  ctx.moveTo(cx - shirtW / 2 + r, shoulderY);
  ctx.lineTo(cx + shirtW / 2 - r, shoulderY);
  ctx.quadraticCurveTo(cx + shirtW / 2, shoulderY, cx + shirtW / 2 - 1, shoulderY + r);
  ctx.lineTo(cx + hipW / 2, hipY - r);
  ctx.quadraticCurveTo(cx + hipW / 2, hipY, cx + hipW / 2 - r, hipY);
  ctx.lineTo(cx - hipW / 2 + r, hipY);
  ctx.quadraticCurveTo(cx - hipW / 2, hipY, cx - hipW / 2, hipY - r);
  ctx.lineTo(cx - shirtW / 2 + 1, shoulderY + r);
  ctx.quadraticCurveTo(cx - shirtW / 2, shoulderY, cx - shirtW / 2 + r, shoulderY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Neck hint
  ctx.fillStyle = SKIN;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(2, h * 0.016);
  const nw = h * 0.07, nh = h * 0.05;
  ctx.beginPath();
  ctx.rect(cx - nw / 2, shoulderY - nh, nw, nh + 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawHead(ctx, cx, cy, r, hairColor, facing, state, t) {
  ctx.save();
  // Face (skin) fill + outline
  ctx.fillStyle = SKIN;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(3, r * 0.18);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hair: clipped rounded cap with a gentle bangs dip, plus a small forehead swoop
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.97, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = hairColor;

  // Main cap: top half of head + a symmetric bangs dip
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1, Math.PI, 2 * Math.PI, false);
  ctx.quadraticCurveTo(cx, cy + r * 0.18, cx - r - 1, cy);
  ctx.closePath();
  ctx.fill();

  // Side swoop toward facing direction (tuft of bangs on forehead)
  ctx.beginPath();
  ctx.arc(cx + r * 0.3 * facing, cy - r * 0.1, r * 0.38, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Re-stroke face outline on top of hair
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(3, r * 0.18);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Cheeks
  ctx.fillStyle = 'rgba(255,120,140,0.45)';
  const cheekOff = r * 0.48;
  const cheekY = cy + r * 0.32;
  ctx.beginPath();
  ctx.arc(cx - cheekOff, cheekY, r * 0.16, 0, Math.PI * 2);
  ctx.arc(cx + cheekOff, cheekY, r * 0.16, 0, Math.PI * 2);
  ctx.fill();

  // Eyes — subtle facing bias, but both eyes clearly on the face
  const blink = Math.max(0, Math.sin(t * 0.6 + (cx * 0.01)) - 0.95) * 20;
  const eyeOpen = blink > 0 ? 0.3 : 1;
  const eyeDX = r * 0.1 * facing;
  const eyeSpacing = r * 0.26;
  const eyeY = cy + r * 0.05;
  drawEye(ctx, cx + eyeDX - eyeSpacing, eyeY, r * 0.15, r * 0.15 * eyeOpen, facing);
  drawEye(ctx, cx + eyeDX + eyeSpacing, eyeY, r * 0.15, r * 0.15 * eyeOpen, facing);

  // Mouth
  ctx.strokeStyle = OUTLINE;
  ctx.fillStyle = '#c0546a';
  ctx.lineWidth = Math.max(2, r * 0.12);
  const mouthY = cy + r * 0.38;
  const mouthW = r * 0.5;
  const isOpen = state === 'dancing' || state === 'waving' || state === 'high-five' || state === 'celebrating';
  if (isOpen) {
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.1 * facing, mouthY, mouthW * 0.6, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.1 * facing - mouthW / 2, mouthY);
    ctx.quadraticCurveTo(cx + r * 0.1 * facing, mouthY + r * 0.3, cx + r * 0.1 * facing + mouthW / 2, mouthY);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEye(ctx, x, y, rOuter, rInner, facing) {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, rOuter, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // pupil
  if (rInner > rOuter * 0.2) {
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(x + rOuter * 0.2 * facing, y + rOuter * 0.1, rInner * 0.55, 0, Math.PI * 2);
    ctx.fill();
    // highlight
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + rOuter * 0.3 * facing, y - rOuter * 0.15, rInner * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Small helper used by the color-picker preview and loader.
export function drawPreview(canvas, color) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 120;
  const h = canvas.clientHeight || 160;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  drawStickman(ctx, {
    x: w / 2, groundY: h - 10, h: h - 20, facing: 1,
    color, poseT: performance.now() / 1000, state: 'idle',
  });
}
