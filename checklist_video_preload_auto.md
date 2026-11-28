# Top Tendance — Video Preload Auto Checklist

> **Goal**: Eliminate the ~3-second buffering freeze by instructing the browser and OBS to preload `countdown-bg.mp4` into memory immediately.  
> **Status**: Planning Mode (No implementation yet).

---

## Action Items

- [x] **1. Enable `preload="auto"` on the Video Element**
  - [x] Add `preload="auto"` to `<video ref={videoRef} src="/videos/countdown-bg.mp4" ...>` in `src/app/live/page.tsx`.

- [x] **2. Verify Build & TypeScript**
  - [x] Run `npx tsc --noEmit` to confirm zero errors.

- [ ] **3. Playback & Loop Smoothness Check**
  - [ ] Test on `/live` (and in OBS Browser Source) to confirm the video buffers upfront and loops smoothly without a 3-second freeze.
