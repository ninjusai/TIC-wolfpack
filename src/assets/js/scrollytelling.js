/**
 * Scrollytelling — Scroll-scrubbed image sequence engine
 * =======================================================
 *
 * Architecture:
 * - Two image sequences (chapters) are loaded into memory as Image objects
 * - A single <canvas> renders the current frame based on scroll position
 * - The section is pinned (position: sticky) for the duration of the scroll
 * - Overlay text blocks fade in/out at defined progress ranges
 * - requestAnimationFrame throttles canvas draws for performance
 * - Reduced-motion users see a static poster with text
 *
 * Scroll mapping:
 * - The scrollytelling container has a tall inner spacer (400vh)
 * - scrollProgress 0.0–1.0 maps to the full scrub range
 * - Chapter 1: progress 0.0–0.55 (first 55%)
 * - Chapter 2: progress 0.55–1.0 (remaining 45%)
 * - Crossfade zone: progress 0.50–0.60 (smooth blend between chapters)
 *
 * Text overlay ranges (progress-based):
 * - Block 1: 0.00–0.22
 * - Block 2: 0.20–0.45
 * - Block 3: 0.50–0.75
 * - Block 4: 0.73–0.95
 */

(function () {
  'use strict';

  // ── Configuration ──────────────────────────────────────────────────────
  const CHAPTER_1_FRAMES = 91;
  const CHAPTER_2_FRAMES = 91;
  const FRAME_PATH_1 = '/assets/images/scroll-sequence/chapter-1/frame-';
  const FRAME_PATH_2 = '/assets/images/scroll-sequence/chapter-2/frame-';
  const FRAME_EXT = '.jpg';

  // Chapter progress boundaries
  const CH1_START = 0.0;
  const CH1_END = 0.55;
  const CH2_START = 0.50;  // Overlap creates crossfade zone
  const CH2_END = 1.0;

  // Text overlay progress ranges [enter, full-visible-start, full-visible-end, exit]
  // Wider hold ranges = text persists longer; overlapping enter/exit = smoother transitions
  const TEXT_RANGES = [
    { id: 'block-1', enter: 0.00, peak: 0.03, hold: 0.20, exit: 0.26 },
    { id: 'block-2', enter: 0.22, peak: 0.26, hold: 0.44, exit: 0.50 },
    { id: 'block-3', enter: 0.46, peak: 0.50, hold: 0.70, exit: 0.76 },
    { id: 'block-4', enter: 0.72, peak: 0.76, hold: 0.93, exit: 0.98 },
  ];

  // ── DOM references ─────────────────────────────────────────────────────
  const container = document.getElementById('scrollytelling');
  if (!container) return;

  const canvas = container.querySelector('.scrollytelling__canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const stickyWrap = container.querySelector('.scrollytelling__sticky');
  const textBlocks = container.querySelectorAll('.scrollytelling__text-block');
  const progressBar = container.querySelector('.scrollytelling__progress');

  // ── Reduced motion check ───────────────────────────────────────────────
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    container.classList.add('scrollytelling--reduced-motion');
    return; // Static poster shown via CSS
  }

  // ── Mobile check — simplified experience on small screens ──────────────
  const isMobile = window.innerWidth < 768;

  // ── Frame loading ──────────────────────────────────────────────────────
  const chapter1Frames = [];
  const chapter2Frames = [];
  let loadedCount = 0;
  const totalFrames = CHAPTER_1_FRAMES + CHAPTER_2_FRAMES;
  let allLoaded = false;

  /**
   * Pad a number to 3 digits: 0 → "000", 42 → "042"
   */
  function pad3(n) {
    return String(n).padStart(3, '0');
  }

  /**
   * Load a single frame image, returning a Promise
   */
  function loadFrame(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        resolve(img);
      };
      img.onerror = () => {
        loadedCount++;
        resolve(null); // Don't break the sequence for one bad frame
      };
      img.src = src;
    });
  }

  /**
   * Load all frames for both chapters
   * Uses a chunked approach: loads first few frames immediately for fast start,
   * then loads the rest in the background
   */
  async function loadAllFrames() {
    // Priority: load first frame of each chapter immediately
    const firstFrames = await Promise.all([
      loadFrame(FRAME_PATH_1 + pad3(0) + FRAME_EXT),
      loadFrame(FRAME_PATH_2 + pad3(0) + FRAME_EXT),
    ]);
    chapter1Frames[0] = firstFrames[0];
    chapter2Frames[0] = firstFrames[1];

    // Draw first frame immediately
    if (chapter1Frames[0]) {
      drawFrame(chapter1Frames[0]);
      container.classList.add('scrollytelling--ready');
    }

    // Load remaining frames in batches
    const batchSize = isMobile ? 5 : 10;

    // Chapter 1 remaining
    for (let i = 1; i < CHAPTER_1_FRAMES; i += batchSize) {
      const batch = [];
      for (let j = i; j < Math.min(i + batchSize, CHAPTER_1_FRAMES); j++) {
        batch.push(
          loadFrame(FRAME_PATH_1 + pad3(j) + FRAME_EXT).then(img => {
            chapter1Frames[j] = img;
          })
        );
      }
      await Promise.all(batch);
    }

    // Chapter 2
    for (let i = 1; i < CHAPTER_2_FRAMES; i += batchSize) {
      const batch = [];
      for (let j = i; j < Math.min(i + batchSize, CHAPTER_2_FRAMES); j++) {
        batch.push(
          loadFrame(FRAME_PATH_2 + pad3(j) + FRAME_EXT).then(img => {
            chapter2Frames[j] = img;
          })
        );
      }
      await Promise.all(batch);
    }

    allLoaded = true;
    container.classList.add('scrollytelling--loaded');
  }

  // ── Canvas rendering ───────────────────────────────────────────────────

  /**
   * Size the canvas to fill the viewport while maintaining aspect ratio
   */
  function sizeCanvas() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);
  }

  /**
   * Draw a single frame image to the canvas, covering the viewport
   */
  function drawFrame(img, alpha) {
    if (!img || !ctx) return;
    const cw = canvas.width / (Math.min(window.devicePixelRatio || 1, 2));
    const ch = canvas.height / (Math.min(window.devicePixelRatio || 1, 2));

    // Cover-fit: scale image to fill canvas
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = cw / ch;
    let drawW, drawH, drawX, drawY;

    if (canvasRatio > imgRatio) {
      drawW = cw;
      drawH = cw / imgRatio;
      drawX = 0;
      drawY = (ch - drawH) / 2;
    } else {
      drawH = ch;
      drawW = ch * imgRatio;
      drawX = (cw - drawW) / 2;
      drawY = 0;
    }

    if (alpha !== undefined && alpha < 1) {
      ctx.globalAlpha = alpha;
    } else {
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.globalAlpha = 1;
  }

  // ── Scroll logic ───────────────────────────────────────────────────────
  let currentProgress = 0;
  let targetProgress = 0;
  let rafId = null;
  let lastFrameIndex1 = -1;
  let lastFrameIndex2 = -1;

  /**
   * Calculate scroll progress (0–1) within the scrollytelling container
   */
  function getScrollProgress() {
    const rect = container.getBoundingClientRect();
    const containerHeight = container.offsetHeight;
    const viewportHeight = window.innerHeight;
    const scrollableDistance = containerHeight - viewportHeight;

    if (scrollableDistance <= 0) return 0;

    const scrolled = -rect.top;
    return Math.max(0, Math.min(1, scrolled / scrollableDistance));
  }

  /**
   * Map overall progress to a frame index within a chapter
   */
  function progressToFrame(progress, chapterStart, chapterEnd, frameCount) {
    const chapterProgress = Math.max(0, Math.min(1,
      (progress - chapterStart) / (chapterEnd - chapterStart)
    ));
    return Math.min(frameCount - 1, Math.floor(chapterProgress * frameCount));
  }

  /**
   * Update text block visibility based on progress
   */
  function updateTextBlocks(progress) {
    TEXT_RANGES.forEach((range, i) => {
      const block = textBlocks[i];
      if (!block) return;

      let opacity = 0;
      let translateY = 20;

      if (progress >= range.enter && progress <= range.exit) {
        if (progress < range.peak) {
          // Fading in
          const t = (progress - range.enter) / (range.peak - range.enter);
          opacity = t;
          translateY = 20 * (1 - t);
        } else if (progress <= range.hold) {
          // Fully visible
          opacity = 1;
          translateY = 0;
        } else {
          // Fading out
          const t = (progress - range.hold) / (range.exit - range.hold);
          opacity = 1 - t;
          translateY = -10 * t;
        }
      }

      block.style.opacity = opacity;
      block.style.transform = `translateY(${translateY}px)`;
    });
  }

  /**
   * Main render tick — called via rAF
   */
  function render() {
    // Smooth interpolation toward target
    currentProgress += (targetProgress - currentProgress) * 0.15;

    // Snap when close enough to avoid endless micro-updates
    if (Math.abs(currentProgress - targetProgress) < 0.0005) {
      currentProgress = targetProgress;
    }

    const p = currentProgress;

    // Determine which frames to draw
    const frameIdx1 = progressToFrame(p, CH1_START, CH1_END, CHAPTER_1_FRAMES);
    const frameIdx2 = progressToFrame(p, CH2_START, CH2_END, CHAPTER_2_FRAMES);

    // Crossfade zone: 0.50–0.60
    const crossfadeStart = 0.50;
    const crossfadeEnd = 0.60;
    let ch1Alpha = 1;
    let ch2Alpha = 0;

    if (p >= crossfadeStart && p <= crossfadeEnd) {
      const blend = (p - crossfadeStart) / (crossfadeEnd - crossfadeStart);
      ch1Alpha = 1 - blend;
      ch2Alpha = blend;
    } else if (p > crossfadeEnd) {
      ch1Alpha = 0;
      ch2Alpha = 1;
    }

    // Only redraw if frame changed
    const needsRedraw =
      frameIdx1 !== lastFrameIndex1 ||
      frameIdx2 !== lastFrameIndex2 ||
      Math.abs(currentProgress - targetProgress) > 0.001;

    if (needsRedraw && ctx) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      // Draw chapter 1
      if (ch1Alpha > 0 && chapter1Frames[frameIdx1]) {
        drawFrame(chapter1Frames[frameIdx1], ch1Alpha);
      }

      // Draw chapter 2 on top
      if (ch2Alpha > 0 && chapter2Frames[frameIdx2]) {
        drawFrame(chapter2Frames[frameIdx2], ch2Alpha);
      }

      lastFrameIndex1 = frameIdx1;
      lastFrameIndex2 = frameIdx2;
    }

    // Update text overlays
    updateTextBlocks(p);

    // Update progress indicator
    if (progressBar) {
      progressBar.style.transform = `scaleX(${p})`;
    }

    // Continue animation loop while section is in view
    if (currentProgress !== targetProgress || isInView()) {
      rafId = requestAnimationFrame(render);
    } else {
      rafId = null;
    }
  }

  /**
   * Check if the scrollytelling section is in or near the viewport
   */
  function isInView() {
    const rect = container.getBoundingClientRect();
    const buffer = window.innerHeight;
    return rect.bottom > -buffer && rect.top < window.innerHeight + buffer;
  }

  /**
   * Scroll handler — sets target progress and kicks off render loop
   */
  function onScroll() {
    if (!isInView()) return;
    targetProgress = getScrollProgress();
    if (!rafId) {
      rafId = requestAnimationFrame(render);
    }
  }

  // ── Initialization ─────────────────────────────────────────────────────

  function init() {
    sizeCanvas();

    // Event listeners
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => {
      sizeCanvas();
      // Force redraw on resize
      lastFrameIndex1 = -1;
      lastFrameIndex2 = -1;
      if (!rafId) rafId = requestAnimationFrame(render);
    });

    // Start loading frames
    loadAllFrames();

    // Initial render
    onScroll();
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
