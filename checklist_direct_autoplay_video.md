# Direct Autoplay Video Background Checklist

> **Goal**: Replace complex conditional settings and heavy filters with a direct, zero-friction HTML5 background video tag that autoplays smoothly on load.  
> **Status**: Planning Mode (No implementation yet).

---

## Plan & Action Items

- [x] **1. Clean Reset of `src/app/live/page.tsx` Video Layer**
  - [x] Remove the complex conditional checks (`videoEnabled`, `videoMode`, multiple dark overlay div stacks).
  - [x] Clean up redundant video state variables and drawer controls that complicate playback.

- [x] **2. Insert Direct Autoplay Video Element**
  - [x] Place standard HTML5 video tag directly behind countdown content:
    ```html
    <video
      src="/videos/countdown-bg.mp4"
      autoPlay
      loop
      muted
      playsInline
      className="absolute inset-0 w-full h-full object-cover -z-10"
    />
    ```
  - [x] Ensure `src` attribute is set directly on `<video>` (fixes React autoplay parsing issue).
  - [x] Ensure `muted` and `playsInline` are present (satisfies Chrome, Safari, iOS, Android autoplay policies).

- [ ] **3. Verification & Visual Check**
  - [ ] Open `http://localhost:3000/live` and confirm video starts moving immediately upon page load without clicking.
  - [ ] Confirm Top Tendance logo, countdown timer, and text remain layered clearly over the moving video.
  - [ ] Test in regular desktop view and mobile/portrait (Instagram / Facebook 9:16) view.
