import { initUI, showScreen, showStatus, hideStatus, lockLandscape } from './ui.js';
import { unlockAudio } from './audio.js';
import { initInput, recalibrate, sensorsOk } from './input.js';
import { connect, on as onPeer } from './peer.js';
import { createWorld, setPhoneIdentity, getLocalStickman } from './world.js';
import { startGame } from './game.js';
import { DEBUG, MOCK, FULL_ROOM } from './config.js';

const world = createWorld();
let started = false;

async function onPlay() {
  unlockAudio();
  await initInput();
  await lockLandscape();

  const saved = localStorage.getItem('stickman.color');
  if (saved && ['pink', 'blue', 'green', 'yellow'].includes(saved)) {
    onPickColor(saved);
  } else {
    showScreen('color');
  }
}

function onPickColor(color) {
  // Apply color to my stickman regardless of phoneId — we'll know A vs B on peer open.
  // Default to 'A' for solo mode so getLocalStickman works.
  if (!world.phoneId) setPhoneIdentity(world, 'host');
  getLocalStickman(world).color = color;
  localStorage.setItem('stickman.color', color);
  showScreen('waiting');

  if (!started) {
    started = true;
    startGame(world);
    connect();
  }

  onPeer('open', o => {
    setPhoneIdentity(world, o.role);
    // Re-apply color after identity is set (A vs B may have swapped)
    getLocalStickman(world).color = color;
  });

  onPeer('peer', p => {
    if (p.connected) {
      showScreen(null);
      const msg = world.docked ? 'docked!' : `room: ${FULL_ROOM}`;
      showStatus(msg + (DEBUG ? ' · debug' : '') + (MOCK ? ' · mock' : ''));
      setTimeout(hideStatus, 3000);
    } else {
      showStatus('friend disconnected — waiting...');
    }
  });

  // Show play screen even before peer connects (solo mode works too)
  setTimeout(() => {
    showScreen(null);
    showStatus(sensorsOk()
      ? `room: ${FULL_ROOM} · tap sides to walk`
      : 'tap left/right sides to walk');
    setTimeout(hideStatus, 4000);
  }, 1500);
}

function onCalibrate() {
  recalibrate();
  showStatus('hold still — calibrating...');
  setTimeout(() => showStatus('ready!'), 600);
  setTimeout(hideStatus, 1500);
}

initUI({ onPlay, onPickColor, onCalibrate });

// Auto-start in debug+mock to speed iteration
if (DEBUG && MOCK) {
  setTimeout(() => onPlay(), 100);
}
