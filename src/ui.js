import { COLORS, OUTFITS, COLOR_KEYS, OUTFIT_KEYS, DEBUG } from './config.js';
import { drawPreview } from './stickman.js';

const $ = sel => document.querySelector(sel);

let pickerCallbacks = null;
let currentColor = 'pink';
let currentOutfit = 'plain';

export function initUI({ onPlay, onPickColor, onPickOutfit, onCalibrate, onClosePicker, onToggleMute, isMuted }) {
  pickerCallbacks = { onPickColor, onPickOutfit, onClosePicker };

  $('#btn-play').addEventListener('click', () => onPlay());

  buildColorRow();
  buildOutfitRow();

  $('#picker-close').addEventListener('click', () => onClosePicker && onClosePicker());

  // Gear: tap to open the color/outfit picker.
  $('#gear').addEventListener('click', () => openPicker());

  // Mute toggle
  const muteEl = $('#mute');
  const renderMute = (m) => { muteEl.innerHTML = m ? '&#128263;' : '&#128266;'; };
  renderMute(!!isMuted);
  muteEl.addEventListener('click', () => {
    const m = onToggleMute && onToggleMute();
    renderMute(!!m);
  });


  // Re-animate loader stickman
  const loader = $('#loader-canvas');
  setInterval(() => {
    if (!$('#screen-waiting').classList.contains('hidden')) {
      drawPreview(loader, 'yellow', currentOutfit);
    }
  }, 50);

  if (DEBUG) showStatus('debug · arrows walk, space wave, double-tap jump');
}

function buildColorRow() {
  const row = $('#color-row');
  row.innerHTML = '';
  for (const key of COLOR_KEYS) {
    const btn = document.createElement('button');
    btn.className = `color-btn ${key}`;
    btn.dataset.color = key;
    btn.innerHTML = `<canvas width="90" height="120"></canvas>`;
    btn.addEventListener('click', () => {
      currentColor = key;
      pickerCallbacks?.onPickColor?.(key);
      markSelected('#color-row', key);
    });
    row.appendChild(btn);
    drawPreview(btn.querySelector('canvas'), key, currentOutfit);
  }
}

function buildOutfitRow() {
  const row = $('#outfit-row');
  row.innerHTML = '';
  for (const key of OUTFIT_KEYS) {
    const btn = document.createElement('button');
    btn.className = `color-btn ${currentColor}`;
    btn.dataset.outfit = key;
    btn.innerHTML = `<canvas width="90" height="120"></canvas>`;
    btn.addEventListener('click', () => {
      currentOutfit = key;
      pickerCallbacks?.onPickOutfit?.(key);
      markSelected('#outfit-row', key, 'outfit');
      // Re-render color tiles with the new outfit so the preview updates
      refreshColorPreviews();
    });
    row.appendChild(btn);
    drawPreview(btn.querySelector('canvas'), currentColor, key);
  }
}

function refreshColorPreviews() {
  document.querySelectorAll('#color-row .color-btn').forEach(btn => {
    const c = btn.dataset.color;
    drawPreview(btn.querySelector('canvas'), c, currentOutfit);
  });
}

function refreshOutfitPreviews() {
  document.querySelectorAll('#outfit-row .color-btn').forEach(btn => {
    btn.classList.remove('pink','blue','green','yellow','purple','orange','teal','red');
    btn.classList.add(currentColor);
    const o = btn.dataset.outfit;
    drawPreview(btn.querySelector('canvas'), currentColor, o);
  });
}

function markSelected(rowSel, key, kind = 'color') {
  document.querySelectorAll(`${rowSel} .color-btn`).forEach(btn => {
    const v = kind === 'outfit' ? btn.dataset.outfit : btn.dataset.color;
    btn.classList.toggle('selected', v === key);
  });
  if (kind === 'color') refreshOutfitPreviews();
}

export function setSelectedAppearance(color, outfit) {
  currentColor = color;
  currentOutfit = outfit;
  markSelected('#color-row', color, 'color');
  markSelected('#outfit-row', outfit, 'outfit');
  refreshColorPreviews();
  refreshOutfitPreviews();
}

function openPicker() {
  showScreen('color');
  $('#picker-close').classList.remove('hidden');
}

export function showScreen(name) {
  ['landing', 'color', 'waiting'].forEach(s => {
    const el = document.getElementById(`screen-${s}`);
    if (el) el.classList.toggle('hidden', s !== name);
  });
  const playing = name === null;
  $('#gear').classList.toggle('hidden', !playing);
  $('#mute').classList.toggle('hidden', !playing);
  $('#flower-counter').classList.toggle('hidden', !playing);
  // Hide close button unless we're in the mid-game picker
  if (name !== 'color') $('#picker-close').classList.add('hidden');
}

export function showStatus(text) {
  const el = $('#status');
  el.textContent = text;
  el.classList.remove('hidden');
}

export function hideStatus() {
  $('#status').classList.add('hidden');
}

export function setFlowerCount(n) {
  const span = $('#flower-count');
  if (!span) return;
  if (span.textContent !== String(n)) {
    span.textContent = n;
    const el = $('#flower-counter');
    el.classList.remove('bump');
    // Force reflow to retrigger animation
    void el.offsetWidth;
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 200);
  }
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

// --- Long-press helper ---
function attachLongPress(el, onTap, onLongPress, durationMs = 500) {
  let timer = null;
  let firedLong = false;

  const start = (e) => {
    if (e.cancelable) e.preventDefault();
    firedLong = false;
    timer = setTimeout(() => {
      firedLong = true;
      timer = null;
      onLongPress();
    }, durationMs);
  };
  const cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
  };
  const end = (e) => {
    if (timer) {
      clearTimeout(timer); timer = null;
      onTap();
    }
  };

  el.addEventListener('touchstart', start, { passive: false });
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', cancel);
  el.addEventListener('touchmove', cancel);
  el.addEventListener('mousedown', start);
  el.addEventListener('mouseup', end);
  el.addEventListener('mouseleave', cancel);
}
