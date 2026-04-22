# Stickman Duet

A tiny web game for two phones / tablets. Tilt your device to walk a stickman. Place two devices edge-to-edge and the stickmen meet in the middle to hold hands, dance, and high-five.

Built for my 5-year-old, Lara.

## Play

Once deployed (see below), just open the same URL on both devices. They auto-pair over the internet via WebRTC — no typing, no accounts.

Flow on each device:
1. Tap **Play!** (unlocks audio + requests sensors)
2. Pick a stickman color
3. Wait a moment while it finds the other device
4. Tilt to walk. Shake to wave. Walk to the edge while the other stickman walks to *their* edge and they hold hands. Shake while holding hands for a dance (soft shake) or high-five (hard shake).

Tap the little gear (top-right) to re-calibrate the "neutral" tilt.

## URL parameters

- `?debug=1` — keyboard controls: `←`/`→` walk, `Space` wave, `Shift+Space` high-five
- `?mock=1` — simulate a fake remote peer for solo testing
- `?room=xyz` — use a different room suffix (for multiple simultaneous pairs)

## Local development

No build step. Serve the directory over HTTP (file:// won't work for ES modules):

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/?debug=1` in Chrome. Two browser tabs on localhost will pair via PeerJS cloud.

## Deploy to GitHub Pages

1. Push `main` (or whichever branch is current) to GitHub.
2. Repo **Settings → Pages → Source**: *Deploy from a branch*, Branch: `main`, Folder: `/ (root)`.
3. Wait ~1 minute. Your URL: `https://<user>.github.io/stickman/`.

No CI, no Actions — GitHub Pages serves the static files directly.

## Setup on Amazon Fire Kids tablet

Kids profiles are sandboxed. The parent has to whitelist the URL once:

1. On the tablet, open the **Parent Dashboard** (or the Parent Dashboard web app).
2. Pick the child profile.
3. **Web Browser → Add Website** → paste the full `https://...` URL.
4. The kid profile now has a "Web" section that can launch that URL in Silk.

Tips:
- After placing the tablet in the kid's hands, tap the gear to re-calibrate neutral — kids hold devices at random angles.
- If the screen keeps sleeping, turn off auto-lock in parental settings (or keep the kid engaged).
- Rotate to landscape; if the device refuses to lock, the "please rotate" overlay nudges it.

## Architecture (short)

- `index.html` — entry; loads PeerJS from CDN and `src/main.js`.
- `src/config.js` — tunables: room id, tilt thresholds, walk speed, network rate.
- `src/main.js` — boots the UI, audio, input, peer, and game loop.
- `src/ui.js` — landing / color pick / waiting / status overlays.
- `src/input.js` — reads `deviceorientation` (tilt) and `devicemotion` (shake); keyboard fallback in debug.
- `src/peer.js` — PeerJS wrapper. First device to load becomes "host"; second becomes "guest" and dials in. Hardcoded room id = `lara`.
- `src/world.js` — holds local + remote stickman positions; edge-adjacency math.
- `src/fsm.js` — per-stickman state machine (idle / walking / waving / holding-hands / high-five / dancing / hug).
- `src/stickman.js` — pure canvas renderer; animated limbs via `sin(poseT)`.
- `src/audio.js` — procedural sounds via WebAudio (no binary assets).
- `src/game.js` — rAF loop at 60fps, network tick at 20Hz.

Network packet:
```js
{ t, x: 0..1, facing: -1|1, state: "walking"|"idle"|..., color: "pink"|"blue"|... }
```

## Known issues / ideas

- PeerJS public signaling could, in theory, be blocked by some networks. If it breaks, the fix is a tiny self-hosted signaling server.
- Silk may ignore `screen.orientation.lock` — the rotate overlay handles that case.
- Later: nicer art, backgrounds, more colors, confetti on high-five, more sounds.
