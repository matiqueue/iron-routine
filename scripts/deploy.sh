#!/bin/bash
set -e
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

UDID=$(xcrun devicectl list devices 2>/dev/null | grep -E "physical" | grep -v "unavailable" | grep -E "available|connected" | grep -oE "[0-9A-Fa-f]{8}-[0-9A-Fa-f]{16}" | head -n 1)
if [ -z "$UDID" ]; then
    echo "❌ Nie znaleziono podłączonego/dostępnego iPhone'a!"
    exit 1
fi

echo "📱 Wykryty iPhone: $UDID"
echo "🚀 Budowanie aplikacji Release w Xcode..."
xcodebuild -workspace ios/IronRoutine.xcworkspace \
           -scheme IronRoutine \
           -configuration Release \
           -destination "id=$UDID" \
           -allowProvisioningUpdates \
           build -quiet

APP_DIR=$(ls -td "$HOME/Library/Developer/Xcode/DerivedData/IronRoutine-"*"/Build/Products/Release-iphoneos/IronRoutine.app" 2>/dev/null | head -n 1)

if [ ! -d "$APP_DIR" ]; then
    echo "❌ Nie znaleziono zbudowanej aplikacji w $APP_DIR"
    exit 1
fi

# Detect main app and widget provisioning profiles
PROFILES=$(python3 -c "
import os, glob, subprocess, plistlib
main_p = ''
widget_p = ''
for p in glob.glob(os.path.expanduser('~/Library/Developer/Xcode/UserData/Provisioning Profiles/*.mobileprovision')):
    try:
        out = subprocess.check_output(['security', 'cms', '-D', '-i', p], stderr=subprocess.DEVNULL)
        data = plistlib.loads(out)
        aid = data.get('Entitlements', {}).get('application-identifier', '')
        if aid.endswith('.com.matique.ironroutine.LiveActivity'):
            widget_p = p
        elif aid.endswith('.com.matique.ironroutine'):
            main_p = p
    except:
        pass
print(main_p + '|' + widget_p)
")

MAIN_PROVISION=$(echo "$PROFILES" | cut -d '|' -f 1)
WIDGET_PROVISION=$(echo "$PROFILES" | cut -d '|' -f 2)

echo "📲 Weryfikacja profili provisioning..."
if [ -n "$MAIN_PROVISION" ]; then
    xcrun devicectl device profile install --device "$UDID" "$MAIN_PROVISION" 2>/dev/null || true
    cp "$MAIN_PROVISION" "$APP_DIR/embedded.mobileprovision"
    security cms -D -i "$MAIN_PROVISION" | plutil -extract Entitlements xml1 -o /tmp/iron_entitlements.plist -
fi

if [ -n "$WIDGET_PROVISION" ] && [ -d "$APP_DIR/PlugIns/LiveActivity.appex" ]; then
    xcrun devicectl device profile install --device "$UDID" "$WIDGET_PROVISION" 2>/dev/null || true
    cp "$WIDGET_PROVISION" "$APP_DIR/PlugIns/LiveActivity.appex/embedded.mobileprovision"
    security cms -D -i "$WIDGET_PROVISION" | plutil -extract Entitlements xml1 -o /tmp/widget_entitlements.plist -
fi

CERT="901CBB46BC4EC94F5D6ADDE75E14CAA4B03E6386"
echo "🔐 Podpisywanie aplikacji certyfikatem Szymona ($CERT)..."

for f in "$APP_DIR"/Frameworks/*.framework; do
    if [ -d "$f" ]; then
        codesign --force --sign "$CERT" --preserve-metadata=identifier,flags,runtime "$f" 2>/dev/null || true
    fi
done

if [ -d "$APP_DIR/PlugIns/LiveActivity.appex" ] && [ -f /tmp/widget_entitlements.plist ]; then
    echo "🔐 Podpisywanie rozszerzenia LiveActivity.appex..."
    codesign --force --sign "$CERT" --entitlements /tmp/widget_entitlements.plist --timestamp=none "$APP_DIR/PlugIns/LiveActivity.appex"
fi

if [ -f /tmp/iron_entitlements.plist ]; then
    codesign --force --sign "$CERT" --entitlements /tmp/iron_entitlements.plist --timestamp=none "$APP_DIR"
fi

echo "📦 Wgrywanie na fizycznego iPhone'a ($UDID)..."
xcrun devicectl device install app --device "$UDID" "$APP_DIR"

echo "✨ Próba startu aplikacji na telefonie..."
xcrun devicectl device process launch --device "$UDID" com.matique.ironroutine 2>/dev/null || true

echo "✅ GOTOWE! Aplikacja 'Iron Routine' została pomyślnie zaktualizowana i wgrana na Twój telefon!"
