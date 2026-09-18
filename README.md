# FlyBand V2

Browser-based autonomous five-fly music house.

## Flies
- Tom — Piano
- Paul — Electric Guitar
- Stuart — Bass Guitar
- Ringo — Drums
- John — Violin

## V2 Alpha features
- One continuous 3D house with Practice, Stage, Dining, Chill Garden, Brain Lab and Dark Room
- Autonomous needs and room selection
- Individual / multi-select commands, visible room-to-room flight, timed tasks
- Custom camera: wheel zoom, drag pan, Ctrl+drag or right-drag orbit, F focus, Home whole house
- More realistic procedural flies distinguished only by compound-eye color
- Persistent Dark Room wasp AI that patrols/perches and chases flies actually present there
- Visible fly swatter punishment and visible food rewards
- Live stats including dopamine, stress drive, octopamine, energy, hunger, mood, fear, fatigue, social need, curiosity and focus
- Solo practice, group rehearsal, stage performance and synthesized instrument audio
- Skill-dependent wrong notes/timing that improve through practice
- MP3/WAV browser analysis for rough tempo + pitch/style fingerprint curriculum
- Manual written-note curriculum + MusicXML import
- Persistent corner neural activity monitor with expanded view
- Browser local save, JSON export/import, optional Supabase cloud sync

## Scientific honesty
The V2 Alpha neural monitor is a **region activity proxy**, not yet the full MaleCNS connectome simulation. The app architecture is intended to accept connectome-derived telemetry later. Do not describe the proxy as a recording of a biological fly brain.

The music learner is also currently a reinforcement-learning proxy. It produces audible actions, receives target similarity/timing reward, and improves persistent skills. Connecting those actions to a large MaleCNS spiking simulation is the next neural-engine layer, not something silently faked in this alpha.

## Deploy
Upload `index.html`, `styles.css`, `app.js` and optionally `supabase.sql` to your GitHub repository root, replacing the V1 files. GitHub Pages can serve the three web files directly.
