#!/bin/bash
# Package Otzaria Plugin for macOS/Linux

set -e

echo "🔨 Building plugin..."
npm run build

echo "📦 Packaging plugin..."

# Get plugin info from manifest
PLUGIN_ID=$(node -p "require('./manifest.json').id")
PLUGIN_VERSION=$(node -p "require('./manifest.json').version")
OUTPUT_FILE="${PLUGIN_ID}-${PLUGIN_VERSION}.otzplugin"

# Create temporary directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Copy all necessary files
echo "📋 Copying files..."
cp -r dist "$TEMP_DIR/"
cp manifest.json "$TEMP_DIR/"
cp LICENSE "$TEMP_DIR/" 2>/dev/null || echo "⚠️  LICENSE file not found"
cp TERMS.md "$TEMP_DIR/" 2>/dev/null || echo "⚠️  TERMS.md file not found"

# Create zip archive with .otzplugin extension
echo "🗜️  Creating archive..."
cd "$TEMP_DIR"
zip -r "../$OUTPUT_FILE" . -x "*.DS_Store" "*/node_modules/*" "*/.git/*"
cd - > /dev/null

# Move to project root
mv "$TEMP_DIR/../$OUTPUT_FILE" "./$OUTPUT_FILE"

echo "✅ Plugin packaged successfully: $OUTPUT_FILE"
echo "📊 File size: $(du -h "$OUTPUT_FILE" | cut -f1)"
