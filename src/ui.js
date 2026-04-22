import { COLORS, DEBUG } from './config.js';
import { drawPreview } from './stickman.js';

const $ = sel => document.querySelector(sel);

export function initUI({ onPlay, onPickColor, onCalibrate }) {
  $('#btn-play').addEventListener('click', () => onPlay());

  const row = $('#color-row');
  row.innerHTML = '';
  for (const key of Object.keys(COLORS)) {
    const btn = document.createElement('button');
    btn.className = `color-btn ${key}`;
    btn.innerHTML = `<canvas width="120" height="160"></canvas>`;
    btn.addEventListener('click', () => onPickColor(key));
    row.appendChild(btn);
    const canv = btn.querySelector('canvas');
    drawPreview(canv, key);
  }

  $('#gear').addEventListener('click', () => onCalibrate());

  // Rotate overlay toggle
  const check = () => {
    const portrait = window.innerHeight > window.innerWidth;
    $('#rotate-overlay').classList.toggle('visible', portrait);
  };
  window.addEventListener('resize', check);
  window.addEventListener('orientationchange', check);
  check();

  // Re-animate loader stickman
  const loader = $('#loader-canvas');
  setInterval(() => {
    if (!$('#screen-waiting').classList.contains('hidden')) {
      drawPreview(loader, 'yellow');
    }
  }, 50);

  if (DEBUG) showStatus('debug mode · arrows to walk, space to shake');
}

export function showScreen(name) {
  ['landing', 'color', 'waiting'].forEach(s => {
    const el = document.getElementById(`screen-${s}`);
    if (el) el.classList.toggle('hidden', s !== name);
  });
  if (name === null) {
    $('#gear').classList.remove('hidden');
  } else {
    $('#gear').classList.add('hidden');
  }
}

export function showStatus(text) {
  const el = $('#status');
  el.textContent = text;
  el.classList.remove('hidden');
}

export function hideStatus() {
  $('#status').classList.add('hidden');
}

export async function lockLandscape() {
  try {
    const el = document.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen().catch(() => {});
    if (screen.orientation?.lock) {
      await screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (e) { /* ignore */ }
}
