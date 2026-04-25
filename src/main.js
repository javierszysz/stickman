import {
  initUI, showScreen, showStatus, hideStatus, lockLandscape,
  setSelectedAppearance,
} from './ui.js';
import { unlockAudio, setMuted, isMuted } from './audio.js';
import { initInput, sensorsOk } from './input.js';
import { connect, on as onPeer } from './peer.js';
import { createWorld, setPhoneIdentity, getLocalStickman } from './world.js';
import { startGame } from './game.js';
import { DEBUG, MOCK, FULL_ROOM, COLOR_KEYS, OUTFIT_KEYS } from './config.js';

const world = createWorld();
let started = false;

const STORE_COLOR  = 'stickman.color.v2';
const STORE_OUTFIT = 'stickman.outfit.v1';
const STORE_MUTED  = 'stickman.muted.v1';

// Apply persisted mute state on boot
setMuted(localStorage.getItem(STORE_MUTED) === '1');

async function onPlay() {
  unlockAudio();
  await initInput();
  await lockLandscape();

  const savedColor  = localStorage.getItem(STORE_COLOR);
  const savedOutfit = localStorage.getItem(STORE_OUTFIT) || 'plain';
  if (savedColor && COLOR_KEYS.includes(savedColor)) {
    onPickOutfit(savedOutfit);
    onPickColor(savedColor);
  } else {
    showScreen('color');
  }
}

function onPickColor(color) {
  if (!world.phoneId) setPhoneIdentity(world, 'host');
  getLocalStickman(world).color = color;
  localStorage.setItem(STORE_COLOR, color);
  setSelectedAppearance(color, getLocalStickman(world).outfit || 'plain');

  if (!started) {
    started = true;
    startGame(world);
    connect();

    onPeer('open', o => {
      setPhoneIdentity(world, o.role);
      getLocalStickman(world).color = color;
      const outfit = localStorage.getItem(STORE_OUTFIT) || 'plain';
      getLocalStickman(world).outfit = outfit;
    });

    onPeer('peer', p => {
      if (p.connected) {
        showScreen(null);
        showStatus(`connected · walk off either edge to visit` + (DEBUG ? ' · debug' : '') + (MOCK ? ' · mock' : ''));
        setTimeout(hideStatus, 3500);
      } else {
        showStatus('friend disconnected — waiting...');
      }
    });

    setTimeout(() => {
      showScreen(null);
      showStatus(sensorsOk()
        ? `room: ${FULL_ROOM} · tap sides to walk`
        : 'tap left/right sides to walk');
      setTimeout(hideStatus, 4000);
    }, 1500);
  }
  // Mid-game color change keeps the picker open so the user can also
  // change outfit. Close via the X button.
}

function onPickOutfit(outfit) {
  if (!OUTFIT_KEYS.includes(outfit)) outfit = 'plain';
  if (!world.phoneId) setPhoneIdentity(world, 'host');
  getLocalStickman(world).outfit = outfit;
  localStorage.setItem(STORE_OUTFIT, outfit);
  setSelectedAppearance(getLocalStickman(world).color, outfit);
}

function onClosePicker() {
  showScreen(null);
}

function onToggleMute() {
  const next = !isMuted();
  setMuted(next);
  localStorage.setItem(STORE_MUTED, next ? '1' : '0');
  return next;
}

initUI({
  onPlay,
  onPickColor,
  onPickOutfit,
  onClosePicker,
  onToggleMute,
  isMuted: isMuted(),
});

// Auto-start in debug+mock to speed iteration
if (DEBUG && MOCK) {
  setTimeout(() => onPlay(), 100);
}
