#!/bin/bash
set -e
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

UDID=$(xcrun devicectl list devices 2>/dev/null | grep -E "connected|physical" | grep -oE "[0-9A-Fa-f]{8}-[0-9A-Fa-f]{16}" | head -n 1)
if [ -z "$UDID" ]; then
    echo "❌ Nie znaleziono podłączonego iPhone'a!"
    exit 1
fi

echo "📱 Wykryty iPhone: $UDID"
echo "🚀 Budowanie aplikacji Release w Xcode..."
xcodebuild -workspace ios/IronRoutine.xcworkspace \
           -scheme IronRoutine \
           -configuration Release \
           -destination "id=$UDID" \
           build -quiet

APP_DIR=$(ls -td "$HOME/Library/Developer/Xcode/DerivedData/IronRoutine-"*"/Build/Products/Release-iphoneos/IronRoutine.app" 2>/dev/null | head -n 1)

if [ ! -d "$APP_DIR" ]; then
    echo "❌ Nie znaleziono zbudowanej aplikacji w $APP_DIR"
    exit 1
fi

PROVISION=$(ls -t "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles/"*.mobileprovision 2>/dev/null | head -n 1)
echo "📲 Weryfikacja profilu provisioning..."
xcrun devicectl device profile install --device "$UDID" "$PROVISION" 2>/dev/null || true

# Copy provisioning profile into app bundle as embedded.mobileprovision
cp "$PROVISION" "$APP_DIR/embedded.mobileprovision"

# Extract exact entitlements directly from provisioning profile
security cms -D -i "$PROVISION" | plutil -extract Entitlements xml1 -o /tmp/iron_entitlements.plist -

CERT="901CBB46BC4EC94F5D6ADDE75E14CAA4B03E6386"
echo "🔐 Podpisywanie aplikacji certyfikatem Szymona ($CERT) wraz z Entitlements..."

for f in "$APP_DIR"/Frameworks/*.framework; do
    if [ -d "$f" ]; then
        codesign --force --sign "$CERT" --preserve-metadata=identifier,flags,runtime "$f" 2>/dev/null || true
    fi
done

codesign --force --sign "$CERT" --entitlements /tmp/iron_entitlements.plist --timestamp=none "$APP_DIR"

echo "📦 Wgrywanie na fizycznego iPhone'a ($UDID)..."
xcrun devicectl device install app --device "$UDID" "$APP_DIR"

echo "✨ Próba startu aplikacji na telefonie..."
xcrun devicectl device process launch --device "$UDID" com.matique.ironroutine 2>/dev/null || true

echo "✅ GOTOWE! Aplikacja 'Iron Routine' została pomyślnie zaktualizowana i wgrana na Twój telefon!"
