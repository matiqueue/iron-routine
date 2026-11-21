#!/bin/bash
set -euo pipefail

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

VERSION=$(node -p "require('./package.json').version")
ARCHIVE_PATH="/tmp/IronRoutine-${VERSION}.xcarchive"
EXPORT_PATH="/tmp/IronRoutine-AppStore-${VERSION}"

if [ "${1:-}" != "--upload-only" ] || [ ! -d "$ARCHIVE_PATH" ]; then
  echo "🏗️  Archiving Iron Routine v${VERSION} (Release, Team 3X24W8AX3N)..."
  rm -rf "$ARCHIVE_PATH"
  xcodebuild \
    -workspace ios/IronRoutine.xcworkspace \
    -scheme IronRoutine \
    -configuration Release \
    -destination "generic/platform=iOS" \
    -archivePath "$ARCHIVE_PATH" \
    -allowProvisioningUpdates \
    archive
fi

echo "🚀 Uploading Iron Routine v${VERSION} to App Store Connect / TestFlight..."
rm -rf "$EXPORT_PATH"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist scripts/ExportOptions-AppStore.plist \
  -exportPath "$EXPORT_PATH" \
  -allowProvisioningUpdates

echo "✅ Uploaded Iron Routine v${VERSION} to App Store Connect / TestFlight!"
