# Stickman Duet

A tiny web game for two phones / tablets. Each device shows one stickman. Walk to the edge of your screen and your stickman hops across to the other device. When both stickmen stand near each other, they celebrate with sparkles and sky fireworks.

Built for my 5-year-old, Lara.

**Live demo:** [https://javierszysz.github.io/stickman/](https://javierszysz.github.io/stickman/)

## Play

Open the same URL on both devices — they auto-pair over WebRTC, no accounts, no typing.

1. Tap **Play!** (unlocks audio)
2. Pick a stickman color
3. Walk around on your screen
4. Walk off the left or right edge → your stickman appears on the other device's opposite edge
5. Two stickmen close together on the same screen → they celebrate with fireworks 🎆

## Controls

All input methods work simultaneously:

- **Touch** (phones, tablets): tap-and-hold the left or right side of the screen to walk in that direction; quick tap in the middle to wave; **double-tap anywhere to jump**.
- **Mouse** (desktop): same zones — click-and-hold or click-tap.
- **Keyboard** (desktop): `←` / `→` to walk, `Space` to wave.

Gyro/tilt is disabled for now (the Fire 7 tablet has no gyroscope). The touch model is consistent across every device.

## Interactions

- Walk near the other stickman and stand still → both **celebrate** (arms up, giggle, sparkle burst, three sky fireworks). Walk away and it auto-releases after 1.5s.
- Shake while near each other (tap middle) → **dance** (soft) or **high-five** (hard shake, if gyro available).
- **Jump** (double-tap) → arc up with a "boing" and a low sparkle.

## URL parameters

- `?debug=1` — show a small state readout at top-left (peer connection, phone identity, positions).
- `?mock=1` — spawn a fake remote peer that walks back and forth; useful for solo UI testing.
- `?room=xyz` — use a different room suffix, so multiple pairs can play in parallel without interfering.

## Local development

No build step, no `npm install`. Serve the directory over HTTP:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/?debug=1` in two browser tabs (one regular + one incognito) to simulate two devices. Arrow keys walk, Space waves. The two tabs auto-pair through PeerJS's public signaling service.

## Deploy

Live deploy uses **GitHub Actions → Pages** (see `.github/workflows/pages.yml`). Every push to `claude/stickman-gyro-ble-game-PumHd` rebuilds the Pages artifact from the repo root. Source setting: **Settings → Pages → Source: GitHub Actions**.

Because it's a static site, no Node is needed in CI — the workflow just uploads the entire repo root.

## Setup on Amazon Fire Kids tablet

Kids mode is sandboxed. The parent has to approve the URL once:

1. Parent Dashboard (amazon.com/parents) → child profile → **Web Browser → Add Website**
2. Paste the full `https://...` URL exactly
3. In Lara's profile, tap the approved site to launch it in Silk

Tips:
- Silk on Fire tablets supports touch + WebRTC fine; gyro often isn't available — that's why controls are touch-based.
- Turn off auto-lock in parental settings or the screen sleeps mid-play.
- The game forces landscape. If the device refuses to lock orientation (Silk sometimes does), a "please rotate" overlay prompts.

## Architecture

- `index.html` — entry; loads PeerJS (vendored + SRI-pinned) and `src/main.js`.
- `src/main.js` — boot: audio unlock, input init, landscape lock, color pick, game start, peer connect.
- `src/config.js` — tunables: room id, touch/tilt thresholds, walk speed, state timeouts, network rate.
- `src/ui.js` — DOM overlays (landing, color pick, waiting, rotate).
- `src/input.js` — touch / mouse / keyboard → tilt & shake & jump events. Includes double-tap detection.
- `src/peer.js` — PeerJS wrapper. First device to load becomes "host" (A), second becomes "guest" (B) and dials in. Hardcoded room id = `lara`.
- `src/world.js` — state for both stickmen. Each has an `x`, `facing`, `state`, and a `phone` (`A` or `B`) indicating which device they're currently on. `updateLocalMotion` handles the edge-crossing logic.
- `src/fsm.js` — per-stickman state machine: `idle`, `walking`, `waving`, `celebrating`, `dancing`, `high-five`, `jumping`. Timeouts, cooldowns, and sound triggers live here.
- `src/stickman.js` — pure canvas renderer; animated limbs, shoes, face, hair. Stateless given `{x, y, h, facing, color, poseT, state, stateAge}`.
- `src/particles.js` — tiny particle system for sparkles and sky fireworks.
- `src/audio.js` — procedural sounds via WebAudio (no binary assets).
- `src/game.js` — rAF loop at 60fps, network tick at 20Hz, background scenery, particle triggers.
- `vendor/peerjs.min.js` — PeerJS v1.5.4, self-hosted, integrity-pinned.

### Network protocol

Each device owns exactly one stickman and broadcasts its full state at 20Hz:

```js
{ t, owner: 'A'|'B', x: 0..1, facing: -1|1, state: 'idle'|'walking'|..., color, phone: 'A'|'B' }
```

The `phone` field is the authoritative source of which screen a stickman is currently on; each phone renders only the stickmen where `phone === myPhoneId`. Edge-crossing sets `phone = otherPhone` locally, which the peer sees on the next packet.

## Security

- One external dependency: PeerJS, **self-hosted** under `vendor/` and pinned to a SHA-384 SRI hash in `index.html`, so the browser refuses to run it if the file ever changes.
- One external network destination: `0.peerjs.com` — the PeerJS project's public signaling server. Used only for the brief WebRTC rendezvous (~a few KB of metadata). The actual game state flows peer-to-peer over DataChannel.
- No analytics. No third-party scripts. No cookies.

## Known issues / ideas

- If `0.peerjs.com` is blocked on a particular network, the pair won't connect. Mitigation: a tiny self-hosted signaling relay (~30 lines on Cloudflare Workers).
- The cross-phone handoff is instant; could be nicer with a brief fade-out/fade-in.
- No game goal yet — it's a sandbox. Candidate directions: flowers to collect, a pet that follows, throwing a ball between screens.
- Three+ players is not yet supported — see the [three-player notes](#three-player-notes-not-yet-implemented) below.

## Three-player notes (not yet implemented)

For when we want 3+ devices (e.g. Mom + Dad + Lara):

**Networking.** Current code is a two-peer mesh: one host, one guest. For 3+, either:
- **Full mesh**: each device opens a WebRTC DataChannel to every other device. N × (N-1) connections; fine up to ~6 players, costs some setup time. No central server, but PeerJS lobby discovery would need a list of peers in the room rather than a hardcoded single host/guest pair.
- **Star topology**: the first device is the "hub"; all others connect to it and the hub rebroadcasts. Simpler to implement but the hub's latency dominates.

**Identity.** Today each device is `A` or `B`. With N players we'd give each device a stable random peer id (e.g. `stickman-lara-<shortHash>`) and each stickman carries an `owner` string. The `phone` field stays as "which device am I currently visible on," but its values become peer ids rather than `A`/`B`.

**Crossing.** Still "walk off the edge of your screen, arrive at the opposite edge of another phone." The question is *which* other phone. Two reasonable rules:
- **Round-robin order**: all devices agree on a rotation (say, sorted by peer id). Left edge → previous phone in the ring; right edge → next phone.
- **Physical neighbor detection**: not really possible without a gyro everywhere. Could hack it with a "swap" tap to designate neighbors, but that's clunky.

I'd go with round-robin as the first implementation — no extra UI, works on any number of devices.

**Meeting / celebration.** The current rule "two stickmen on the same phone, close together" generalizes naturally: if N stickmen are on the same phone, any two within the proximity threshold trigger a celebrate for both.

**UI footprint.** Both edges are already marked with a portal arrow; nothing changes visually. A small "3 friends playing" status might help parents verify everyone's connected.

**Biggest open question.** Does a 5-year-old actually enjoy a 3-way chase where people appear and disappear from her screen? Worth testing with two adults + Lara on two phones + tablet before building.
