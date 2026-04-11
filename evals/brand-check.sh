#!/bin/bash
# Brand Directory Check — SC-6
# Verifies brand count matches between source and rendered output

BRANDS_DIR="src/brands"
SITE_DIR="_site"
ERRORS=0

echo "=== Brand Directory Check ==="

# Count published source brands (status: published in frontmatter)
SOURCE_COUNT=$(grep -l 'status:.*"published"' "$BRANDS_DIR"/*.md 2>/dev/null | wc -l)
# Also check without quotes
SOURCE_COUNT2=$(grep -l "status:.*published" "$BRANDS_DIR"/*.md 2>/dev/null | wc -l)
# Use the higher count (handles both quote styles)
if [ "$SOURCE_COUNT2" -gt "$SOURCE_COUNT" ]; then
  SOURCE_COUNT=$SOURCE_COUNT2
fi

echo "Published source brands: $SOURCE_COUNT"

# Count rendered brand detail pages
RENDERED_COUNT=$(find "$SITE_DIR/our-group" -name "index.html" -not -path "$SITE_DIR/our-group/index.html" 2>/dev/null | wc -l)
echo "Rendered brand pages: $RENDERED_COUNT"

# Check counts match
if [ "$SOURCE_COUNT" -ne "$RENDERED_COUNT" ]; then
  echo "FAIL: Source count ($SOURCE_COUNT) != rendered count ($RENDERED_COUNT)"
  ERRORS=$((ERRORS + 1))
else
  echo "PASS: Brand counts match ($SOURCE_COUNT)"
fi

# Verify each published brand has a detail page
echo ""
echo "Checking individual brand pages..."
for file in "$BRANDS_DIR"/*.md; do
  [ -f "$file" ] || continue

  # Check if published
  if ! grep -q "status:.*published" "$file"; then
    slug=$(basename "$file" .md)
    # Verify draft is NOT rendered
    if [ -f "$SITE_DIR/our-group/$slug/index.html" ]; then
      echo "FAIL: Draft brand '$slug' was rendered (should be excluded)"
      ERRORS=$((ERRORS + 1))
    else
      echo "SKIP: '$slug' is draft (correctly excluded)"
    fi
    continue
  fi

  slug=$(basename "$file" .md)
  if [ -f "$SITE_DIR/our-group/$slug/index.html" ]; then
    echo "PASS: $slug rendered"
  else
    echo "FAIL: $slug NOT rendered"
    ERRORS=$((ERRORS + 1))
  fi
done

# Check our-group index page exists
echo ""
if [ -f "$SITE_DIR/our-group/index.html" ]; then
  echo "PASS: /our-group/ index page exists"
else
  echo "FAIL: /our-group/ index page missing"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo "=== Summary ==="
if [ "$ERRORS" -eq 0 ]; then
  echo "PASS: All brand checks passed."
  exit 0
else
  echo "FAIL: $ERRORS error(s) found."
  exit 1
fi
