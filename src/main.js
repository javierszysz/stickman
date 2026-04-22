import { initUI, showScreen, showStatus, hideStatus, lockLandscape } from './ui.js';
import { unlockAudio } from './audio.js';
import { initInput, recalibrate, sensorsOk } from './input.js';
import { connect, on as onPeer } from './peer.js';
import { createWorld } from './world.js';
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
  world.local.color = color;
  localStorage.setItem('stickman.color', color);
  showScreen('waiting');

  if (!started) {
    started = true;
    startGame(world);
    connect();
  }

  onPeer('peer', p => {
    if (p.connected) {
      showScreen(null);
      showStatus(`room: ${FULL_ROOM}${DEBUG ? ' · debug' : ''}${MOCK ? ' · mock' : ''}`);
      setTimeout(hideStatus, 3000);
    } else {
      showStatus('friend disconnected — waiting...');
    }
  });

  // Show play screen even before peer connects (solo mode works too)
  setTimeout(() => {
    showScreen(null);
    showStatus(sensorsOk()
      ? `room: ${FULL_ROOM}${DEBUG ? ' · debug' : ''}${MOCK ? ' · mock' : ''}`
      : 'no gyro — use arrow keys (?debug=1)');
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
