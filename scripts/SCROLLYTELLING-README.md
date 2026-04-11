# Scrollytelling — Scroll-Scrubbed Video Sequences

## Overview

The homepage features a cinematic scrollytelling section that scrubs through two video sequences as the user scrolls. The videos are pre-extracted into JPEG frame sequences and rendered to a `<canvas>` element for smooth, performant playback.

## Architecture

```
User scrolls
  → scroll position mapped to progress (0–1)
  → progress mapped to frame index (per chapter)
  → frame drawn to <canvas> with cover-fit
  → text overlays fade in/out at defined progress ranges
  → crossfade blends chapter 1 → chapter 2
```

## Files

| File | Purpose |
|------|---------|
| `scripts/extract-frames.sh` | FFmpeg script to extract frames from source videos |
| `src/assets/js/scrollytelling.js` | Scroll engine, canvas rendering, text overlay logic |
| `src/assets/css/scrollytelling.css` | Styling, layout, responsive, reduced-motion fallback |
| `src/_includes/components/scrollytelling.njk` | Nunjucks template component |
| `src/assets/images/scroll-sequence/chapter-1/` | Chapter 1 frames (91 JPEGs, 1280x712) |
| `src/assets/images/scroll-sequence/chapter-2/` | Chapter 2 frames (91 JPEGs, 1280x712) |

## How to Run Locally

```bash
# Build the site
npx eleventy --serve

# Open http://localhost:8080 and scroll
```

## How to Swap in New Videos

1. Place your new video files somewhere accessible
2. Run the extraction script:
   ```bash
   bash scripts/extract-frames.sh path/to/new_video_1.mp4 path/to/new_video_2.mp4
   ```
3. Note the frame counts printed at the end
4. Update `CHAPTER_1_FRAMES` and `CHAPTER_2_FRAMES` in `src/assets/js/scrollytelling.js`
5. Rebuild: `npx eleventy`

## Configuration

### Frame extraction (in `scripts/extract-frames.sh`)
- `FRAME_WIDTH` / `FRAME_HEIGHT`: Output dimensions (default 1280x712)
- `TARGET_FPS`: Frames per second to extract (default 18)
- `QUALITY`: JPEG quality 2-5, lower = better (default 3)

### Scroll behavior (in `src/assets/js/scrollytelling.js`)
- `CH1_START` / `CH1_END`: Progress range for chapter 1 (default 0.0–0.55)
- `CH2_START` / `CH2_END`: Progress range for chapter 2 (default 0.50–1.0)
- `TEXT_RANGES`: Progress ranges for each text overlay block
- Crossfade zone: hardcoded at progress 0.50–0.60

### Scroll distance (in `src/assets/css/scrollytelling.css`)
- `.scrollytelling { height: 420vh; }` — total scroll distance
- Increase for slower, more cinematic pacing
- Decrease for faster scrubbing

## Fallbacks

- **Reduced motion**: Users with `prefers-reduced-motion: reduce` see a static layout with all text visible and no scroll pinning
- **No JavaScript**: Static poster image shown with CSS-only layout
- **Mobile**: Shorter scroll distance (350vh), bottom-aligned text, simplified gradient
