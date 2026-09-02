#!/usr/bin/env bash
set -euo pipefail

# Generate a placeholder app icon: indigo rounded square with white "A"
# Outputs: build/icon.icns (macOS icon format)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/../build"
ICONSET_DIR="${BUILD_DIR}/icon.iconset"

mkdir -p "${BUILD_DIR}" "${ICONSET_DIR}"

# Step 1: Generate base 1024x1024 PNG
# Create a simple SVG with indigo background + white "A"
BASE_SVG="${BUILD_DIR}/icon-base.svg"
cat > "${BASE_SVG}" <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <rect id="bg" x="0" y="0" width="1024" height="1024" rx="225" ry="225" fill="#4F46E5"/>
  </defs>
  <use href="#bg"/>
  <text x="512" y="760" font-family="system-ui, -apple-system, sans-serif" font-size="700" font-weight="700" fill="white" text-anchor="middle">A</text>
</svg>
EOF

BASE_PNG="${BUILD_DIR}/icon-1024.png"

# Rasterize: try qlmanage (macOS built-in), fall back to a tiny Node script
if command -v qlmanage &>/dev/null; then
  # qlmanage can render SVG to PNG via Quick Look
  qlmanage -t -s 1024 -o "${BUILD_DIR}" "${BASE_SVG}" &>/dev/null || true
  # qlmanage outputs as icon-base.svg.png
  if [[ -f "${BUILD_DIR}/icon-base.svg.png" ]]; then
    mv "${BUILD_DIR}/icon-base.svg.png" "${BASE_PNG}"
  fi
fi

# Fallback: use sips to convert a solid-color background + overlay text via a temp image
# (sips can't render SVG directly, but we'll use a workaround: create via screencapture or pre-made asset)
if [[ ! -f "${BASE_PNG}" ]]; then
  # Create a simple PNG with sips from a temp solid image
  # Generate a base using sips' built-in capabilities (create from a tiny source)
  # As a last resort, we'll use a tiny inline base64 PNG and decode it
  echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > "${BUILD_DIR}/tiny.png"
  # Scale up and pad to 1024x1024 indigo
  sips -z 1024 1024 "${BUILD_DIR}/tiny.png" --out "${BUILD_DIR}/base.png" &>/dev/null || true

  # Fallback to manual: use printf + binary PNG header (skip for simplicity - use Node)
  # Actually, let's use a tiny Node one-liner if sips rasterization didn't work
  if [[ ! -f "${BASE_PNG}" ]] && command -v node &>/dev/null; then
    node -e "
      const fs = require('fs');
      const w=1024, h=1024;
      // Generate a simple SVG-to-PNG using Quartz via node (not practical)
      // Instead, for build determinism, just copy the SVG and document manual step
      // OR use ImageMagick if available
      process.exit(1);
    " 2>/dev/null || true
  fi

  # Try ImageMagick as fallback
  if [[ ! -f "${BASE_PNG}" ]] && command -v convert &>/dev/null; then
    convert -size 1024x1024 xc:none -draw "roundrectangle 0,0 1024,1024 225,225" \
      -fill "#4F46E5" -draw "roundrectangle 0,0 1024,1024 225,225" \
      -fill white -font Helvetica-Bold -pointsize 700 -gravity center -annotate +0+50 "A" \
      "${BASE_PNG}"
  fi
fi

# If still no PNG, rasterize SVG using qlmanage with explicit size
if [[ ! -f "${BASE_PNG}" ]]; then
  # Force qlmanage with direct PNG conversion
  qlmanage -t -s 1024 -o "${BUILD_DIR}" "${BASE_SVG}" 2>&1 | grep -v "^Testing" || true
  [[ -f "${BUILD_DIR}/icon-base.svg.png" ]] && mv "${BUILD_DIR}/icon-base.svg.png" "${BASE_PNG}"
fi

if [[ ! -f "${BASE_PNG}" ]]; then
  echo "Error: Could not generate base PNG. Install ImageMagick (brew install imagemagick) or ensure qlmanage works." >&2
  exit 1
fi

echo "Generated base icon: ${BASE_PNG}"

# Step 2: Generate .iconset (all required macOS icon sizes)
# macOS iconset requires: 16,32,64,128,256,512,1024 (+ @2x for each up to 512)
declare -a SIZES=(16 32 64 128 256 512)

for size in "${SIZES[@]}"; do
  sips -z ${size} ${size} "${BASE_PNG}" --out "${ICONSET_DIR}/icon_${size}x${size}.png" &>/dev/null
  size2x=$((size * 2))
  sips -z ${size2x} ${size2x} "${BASE_PNG}" --out "${ICONSET_DIR}/icon_${size}x${size}@2x.png" &>/dev/null
done

# 1024x1024 doesn't have a @2x variant in iconset
sips -z 1024 1024 "${BASE_PNG}" --out "${ICONSET_DIR}/icon_512x512@2x.png" &>/dev/null

# Step 3: Convert iconset to .icns
iconutil -c icns -o "${BUILD_DIR}/icon.icns" "${ICONSET_DIR}"

# Cleanup temp files
rm -rf "${ICONSET_DIR}" "${BASE_SVG}" "${BUILD_DIR}/tiny.png" "${BUILD_DIR}/base.png" 2>/dev/null || true

echo "Generated icon: ${BUILD_DIR}/icon.icns"
file "${BUILD_DIR}/icon.icns"
