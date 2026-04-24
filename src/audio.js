// Procedural WebAudio sound effects. No binary assets.

let ctx = null;
let unlocked = false;
let muted = false;

export function setMuted(m) { muted = !!m; }
export function isMuted() { return muted; }

export function unlockAudio() {
  if (unlocked) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Play a silent blip to unlock on mobile
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.01);
    unlocked = true;
  } catch (e) { /* ignore */ }
}

function now() { return ctx ? ctx.currentTime : 0; }

function tone({ freq, dur = 0.3, type = 'sine', vol = 0.3, attack = 0.01, release = 0.1, slideTo = null }) {
  if (!ctx) return;
  const t = now();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo != null) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.15, vol = 0.2, freq = 1000 }) {
  if (!ctx) return;
  const t = now();
  const bufSize = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = freq;
  filt.Q.value = 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filt).connect(g).connect(ctx.destination);
  src.start(t);
  src.stop(t + dur);
}

const SOUNDS = {
  wheee: () => {
    tone({ freq: 440, slideTo: 880, dur: 0.35, type: 'triangle', vol: 0.25 });
    setTimeout(() => tone({ freq: 660, slideTo: 1100, dur: 0.25, type: 'triangle', vol: 0.2 }), 120);
  },
  giggle: () => {
    const notes = [700, 900, 750, 950, 800];
    notes.forEach((f, i) =>
      setTimeout(() => tone({ freq: f, dur: 0.1, type: 'sine', vol: 0.22 }), i * 90));
  },
  boing: () => {
    tone({ freq: 200, slideTo: 500, dur: 0.2, type: 'square', vol: 0.2 });
    setTimeout(() => tone({ freq: 500, slideTo: 200, dur: 0.2, type: 'square', vol: 0.15 }), 120);
  },
  highfive: () => {
    noise({ dur: 0.08, vol: 0.35, freq: 3000 });
    setTimeout(() => tone({ freq: 1200, dur: 0.12, type: 'triangle', vol: 0.25 }), 40);
  },
  hug: () => {
    tone({ freq: 520, slideTo: 660, dur: 0.5, type: 'sine', vol: 0.22 });
    setTimeout(() => tone({ freq: 660, slideTo: 520, dur: 0.5, type: 'sine', vol: 0.18 }), 200);
  },
  join: () => {
    tone({ freq: 600, slideTo: 1000, dur: 0.18, type: 'triangle', vol: 0.25 });
  },
  chime: () => {
    tone({ freq: 1200, dur: 0.1, type: 'sine', vol: 0.2 });
    setTimeout(() => tone({ freq: 1800, dur: 0.18, type: 'sine', vol: 0.18 }), 50);
  },
  bigchime: () => {
    [1000, 1400, 1900, 2400].forEach((f, i) =>
      setTimeout(() => tone({ freq: f, dur: 0.16, type: 'sine', vol: 0.22 }), i * 60));
  },
};

const lastPlayed = {};
export function playSound(name, minGapMs = 150) {
  if (!unlocked || muted) return;
  const t = performance.now();
  if (lastPlayed[name] && t - lastPlayed[name] < minGapMs) return;
  lastPlayed[name] = t;
  const fn = SOUNDS[name];
  if (fn) fn();
}
