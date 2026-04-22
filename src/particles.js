// Tiny particle system for sparkles on celebration / jump / arrival.
const particles = [];

const SPARKLE_COLORS = ['#ffd94d', '#ff5c8a', '#c77dff', '#ffffff', '#a8d8ff', '#b8f0b8'];

export function emitSparkle(x, y, count, opts = {}) {
  const upward = opts.upward !== false;
  const spread = opts.spread || Math.PI * 2;
  const baseAngle = opts.baseAngle != null ? opts.baseAngle : -Math.PI / 2;
  const vmin = opts.vmin || 80;
  const vmax = opts.vmax || 220;
  for (let i = 0; i < count; i++) {
    const a = baseAngle + (Math.random() - 0.5) * spread;
    const v = vmin + Math.random() * (vmax - vmin);
    particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - (upward ? 40 : 0),
      life: 0.9 + Math.random() * 0.5,
      maxLife: 1.4,
      color: opts.color || SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
      size: 4 + Math.random() * 4,
      spin: (Math.random() - 0.5) * 8,
      angle: Math.random() * Math.PI * 2,
    });
  }
}

export function emitFirework(x, y, count, color) {
  const c = color || SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 140 + Math.random() * 180;
    particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 1.4 + Math.random() * 0.9,
      maxLife: 2.3,
      color: c,
      size: 5 + Math.random() * 4,
      spin: (Math.random() - 0.5) * 8,
      angle: Math.random() * Math.PI * 2,
      firework: true,
    });
  }
}

export function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const g = p.firework ? 90 : 420;
    const drag = p.firework ? 0.965 : 0.985;
    p.vy += g * dt;
    p.vx *= drag;
    p.vy *= drag;
    p.angle += p.spin * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

export function renderParticles(ctx) {
  for (const p of particles) {
    const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.color;
    drawStar(ctx, p.size);
    ctx.fill();
    ctx.restore();
  }
}

function drawStar(ctx, r) {
  const spikes = 5;
  const inner = r * 0.45;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? r : inner;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function clearParticles() { particles.length = 0; }
