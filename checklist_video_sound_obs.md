# Top Tendance — OBS & Video Original Sound Checklist

> **Goal**: Play the video's own original audio track automatically in **OBS Studio**, with a safe muted fallback for standard browsers (Chrome/Safari/Mobile), and remove any other sound effects.  
> **Status**: Planning Mode (No implementation yet).

---

## Action Items

- [x] **1. Remove Extra Synthesized Chime**
  - [x] Disable / remove `playLiveChime` Web Audio synthesis so **only** the video's original sound plays.

- [x] **2. OBS Auto-Unmute Engine + Browser Fallback**
  - [x] Attach a `ref` to the `<video src="/videos/countdown-bg.mp4" ...>` element in `src/app/live/page.tsx`.
  - [x] On page load, attempt unmuted autoplay first (`video.muted = false; await video.play()`):
    - **In OBS Studio**: Plays video + original sound immediately with zero clicks.
    - **In Chrome / Mobile (if blocked by browser policy)**: Catch the block, set `video.muted = true`, and immediately call `video.play()` so the video never freezes.

- [x] **3. Volume Button & First-Click Unmute Sync**
  - [x] Connect the bottom-right **Volume Toggle Button (🔊 / 🔇)** directly to `video.muted` (`!soundEnabled`).
  - [x] If the browser blocked initial audio on load, automatically unmute on the user's first click/tap anywhere on the screen.

- [ ] **4. OBS Studio & Browser Verification**
  - [ ] Test in **OBS Studio** Browser Source (`http://localhost:3000/live?clean=true`) with **"Control audio via OBS"** enabled and verify original audio plays automatically in the OBS Audio Mixer.
  - [ ] Test in Chrome / Mobile to verify video still autoplays smoothly and unmutes cleanly on tap or via the Volume button.
