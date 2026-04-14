# PeakProtocol Icon Generation

## Required Icons

The PWA manifest references the following icon files that need to be generated:

| File | Size | Purpose |
|------|------|---------|
| `icon-192.png` | 192x192 | Standard icon |
| `icon-512.png` | 512x512 | Standard icon |
| `icon-maskable-192.png` | 192x192 | Maskable (safe zone padding) |
| `icon-maskable-512.png` | 512x512 | Maskable (safe zone padding) |

## How to Generate

### From the placeholder SVG

Use any of these approaches:

**Using sharp (Node.js):**
```bash
npx sharp-cli -i icon-placeholder.svg -o icon-192.png resize 192 192
npx sharp-cli -i icon-placeholder.svg -o icon-512.png resize 512 512
```

**Using Inkscape CLI:**
```bash
inkscape icon-placeholder.svg --export-filename=icon-192.png -w 192 -h 192
inkscape icon-placeholder.svg --export-filename=icon-512.png -w 512 -h 512
```

**Using ImageMagick:**
```bash
magick icon-placeholder.svg -resize 192x192 icon-192.png
magick icon-placeholder.svg -resize 512x512 icon-512.png
```

### Maskable Icons

Maskable icons need extra padding (safe zone is the inner 80% circle).
Either add padding to the SVG before exporting, or use https://maskable.app/editor
to create properly padded versions.

## Apple Touch Icon

The `icon-192.png` is also referenced as the Apple touch icon in `index.html`.
