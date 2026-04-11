#!/bin/bash
# =============================================================================
# Frame extraction script for scroll-scrubbed video sequences
# Extracts JPEG frames from source videos at a target FPS and resolution.
#
# Usage:
#   bash scripts/extract-frames.sh [video1_path] [video2_path]
#
# Defaults to ./video_1.mp4 and ./video_2.mp4 if no arguments provided.
#
# To swap in new videos:
#   1. Replace the source files or pass new paths as arguments
#   2. Run this script
#   3. Rebuild the site (npx eleventy)
#   4. Update CHAPTER_1_FRAMES and CHAPTER_2_FRAMES in scrollytelling.js
# =============================================================================

set -e

VIDEO_1="${1:-./video_1.mp4}"
VIDEO_2="${2:-./video_2.mp4}"
OUTPUT_DIR="src/assets/images/scroll-sequence"
FRAME_WIDTH=1280
FRAME_HEIGHT=712
TARGET_FPS=18
QUALITY=3  # JPEG quality (2-5, lower = better)

echo "=== Frame Extraction ==="
echo "Video 1: $VIDEO_1"
echo "Video 2: $VIDEO_2"
echo "Output:  $OUTPUT_DIR"
echo "Size:    ${FRAME_WIDTH}x${FRAME_HEIGHT}"
echo "FPS:     $TARGET_FPS"
echo ""

# Check dependencies
if ! command -v ffmpeg &> /dev/null; then
  echo "ERROR: ffmpeg not found. Install it first."
  exit 1
fi

# Check source files
for f in "$VIDEO_1" "$VIDEO_2"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: Source video not found: $f"
    exit 1
  fi
done

# Clean and create output directories
rm -rf "$OUTPUT_DIR/chapter-1" "$OUTPUT_DIR/chapter-2"
mkdir -p "$OUTPUT_DIR/chapter-1" "$OUTPUT_DIR/chapter-2"

# Extract Chapter 1 frames
echo "Extracting Chapter 1 frames..."
ffmpeg -i "$VIDEO_1" \
  -vf "fps=$TARGET_FPS,scale=${FRAME_WIDTH}:${FRAME_HEIGHT}:flags=lanczos" \
  -q:v $QUALITY \
  -start_number 0 \
  "$OUTPUT_DIR/chapter-1/frame-%03d.jpg" \
  -loglevel warning -stats

CH1_COUNT=$(ls "$OUTPUT_DIR/chapter-1"/*.jpg 2>/dev/null | wc -l)
echo "  → $CH1_COUNT frames extracted"

# Extract Chapter 2 frames
echo "Extracting Chapter 2 frames..."
ffmpeg -i "$VIDEO_2" \
  -vf "fps=$TARGET_FPS,scale=${FRAME_WIDTH}:${FRAME_HEIGHT}:flags=lanczos" \
  -q:v $QUALITY \
  -start_number 0 \
  "$OUTPUT_DIR/chapter-2/frame-%03d.jpg" \
  -loglevel warning -stats

CH2_COUNT=$(ls "$OUTPUT_DIR/chapter-2"/*.jpg 2>/dev/null | wc -l)
echo "  → $CH2_COUNT frames extracted"

# Total size
TOTAL_SIZE=$(du -sh "$OUTPUT_DIR" | cut -f1)
echo ""
echo "=== Done ==="
echo "Chapter 1: $CH1_COUNT frames"
echo "Chapter 2: $CH2_COUNT frames"
echo "Total size: $TOTAL_SIZE"
echo ""
echo "Update scrollytelling.js constants if frame counts changed:"
echo "  CHAPTER_1_FRAMES = $CH1_COUNT"
echo "  CHAPTER_2_FRAMES = $CH2_COUNT"
