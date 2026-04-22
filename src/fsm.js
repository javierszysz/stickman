import { STATE_TIMEOUTS } from './config.js';
import { playSound } from './audio.js';

// Per-stickman state machine. Owns transitions + sound triggers.
// States: idle, walking, waving, holding-hands, high-five, dancing, hug
export function createFSM() {
  const fsm = {
    state: 'idle',
    enteredAt: performance.now(),
    setState(next, reason) {
      if (fsm.state === next) return;
      const prev = fsm.state;
      fsm.state = next;
      fsm.enteredAt = performance.now();
      onEnter(next, prev, reason);
    },
    tick(ctx) {
      // ctx: { tilt: -1..1, nearPeer: bool, peerState: string|null, shake: 'soft'|'hard'|null }
      const now = performance.now();
      const age = now - fsm.enteredAt;

      // Timed transitions out of transient states
      if (fsm.state === 'waving' && age > STATE_TIMEOUTS.waving) {
        fsm.setState(Math.abs(ctx.tilt) > 0 ? 'walking' : 'idle');
      } else if (fsm.state === 'high-five' && age > STATE_TIMEOUTS.highFive) {
        fsm.setState('idle');
      } else if (fsm.state === 'dancing' && age > STATE_TIMEOUTS.dancing) {
        fsm.setState(ctx.nearPeer ? 'holding-hands' : 'idle');
      } else if (fsm.state === 'hug' && age > STATE_TIMEOUTS.hug) {
        fsm.setState('idle');
      }

      // Shake-triggered transitions
      if (ctx.shake) {
        if (fsm.state === 'holding-hands') {
          fsm.setState(ctx.shake === 'hard' ? 'high-five' : 'dancing');
        } else if (fsm.state !== 'high-five' && fsm.state !== 'hug') {
          fsm.setState('waving');
        }
      }

      // Proximity transitions
      if (fsm.state === 'idle' || fsm.state === 'walking') {
        if (ctx.nearPeer) {
          fsm.setState('holding-hands');
        } else {
          fsm.setState(Math.abs(ctx.tilt) > 0 ? 'walking' : 'idle');
        }
      } else if (fsm.state === 'holding-hands' && !ctx.nearPeer) {
        fsm.setState(Math.abs(ctx.tilt) > 0 ? 'walking' : 'idle');
      }
    },
  };
  return fsm;
}

function onEnter(next, prev, reason) {
  switch (next) {
    case 'waving': playSound('wheee'); break;
    case 'holding-hands':
      if (prev !== 'dancing') playSound('join'); break;
    case 'dancing': playSound('giggle'); break;
    case 'high-five': playSound('highfive'); break;
    case 'hug': playSound('hug'); break;
  }
}
