#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js/npm не найден."
  echo "Установи Node.js, затем запусти файл снова."
  read -r -p "Enter для закрытия..."
  exit 1
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "Rust/Cargo не найден."
  echo "Установи Rust: https://rustup.rs"
  read -r -p "Enter для закрытия..."
  exit 1
fi

# Generate a real macOS .icns from the source PNG.
ICONSET="$DIR/src-tauri/icons/AppIcon.iconset"
rm -rf "$ICONSET"
mkdir -p "$ICONSET"
for spec in "16 icon_16x16.png" "32 icon_16x16@2x.png" "32 icon_32x32.png" "64 icon_32x32@2x.png" "128 icon_128x128.png" "256 icon_128x128@2x.png" "256 icon_256x256.png" "512 icon_256x256@2x.png" "512 icon_512x512.png" "1024 icon_512x512@2x.png"; do
  set -- $spec
  sips -z "$1" "$1" "$DIR/src-tauri/icons/icon.png" --out "$ICONSET/$2" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$DIR/src-tauri/icons/icon.icns"
rm -rf "$ICONSET"

[ -d node_modules ] || npm install
npm run tauri dev
