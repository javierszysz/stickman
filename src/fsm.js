import { STATE_TIMEOUTS } from './config.js';
import { playSound } from './audio.js';

// Per-stickman state machine. Owns transitions + sound triggers.
// States: idle, walking, waving, celebrating, high-five, dancing
export function createFSM() {
  let celebrateCooldownUntil = 0;

  const fsm = {
    state: 'idle',
    enteredAt: performance.now(),
    setState(next, reason) {
      if (fsm.state === next) return;
      const prev = fsm.state;
      if (prev === 'celebrating') celebrateCooldownUntil = performance.now() + 2500;
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
      } else if (fsm.state === 'celebrating' && age > STATE_TIMEOUTS.celebrating) {
        fsm.setState(Math.abs(ctx.tilt) > 0 ? 'walking' : 'idle');
      } else if (fsm.state === 'high-five' && age > STATE_TIMEOUTS.highFive) {
        fsm.setState('idle');
      } else if (fsm.state === 'dancing' && age > STATE_TIMEOUTS.dancing) {
        fsm.setState('idle');
      }

      // Shake-triggered transitions
      if (ctx.shake) {
        if (ctx.nearPeer) {
          fsm.setState(ctx.shake === 'hard' ? 'high-five' : 'dancing');
        } else if (fsm.state !== 'high-five') {
          fsm.setState('waving');
        }
      }

      // Proximity transitions: when two stickmen stand still near each other,
      // both briefly celebrate, then return to idle. A cooldown prevents the
      // celebration from re-triggering instantly.
      const canCelebrate = ctx.nearPeer && now > celebrateCooldownUntil;
      const moving = Math.abs(ctx.tilt) > 0.05;
      if (fsm.state === 'idle' || fsm.state === 'walking') {
        if (canCelebrate && !moving) {
          fsm.setState('celebrating');
        } else {
          fsm.setState(moving ? 'walking' : 'idle');
        }
      } else if (fsm.state === 'celebrating') {
        if (moving) fsm.setState('walking');
      }
    },
  };
  return fsm;
}

function onEnter(next, prev, reason) {
  switch (next) {
    case 'waving': playSound('wheee'); break;
    case 'celebrating': playSound('giggle'); break;
    case 'dancing': playSound('giggle'); break;
    case 'high-five': playSound('highfive'); break;
  }
}
