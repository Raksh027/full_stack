#!/usr/bin/env bash
# Fix Fabric RCTThirdPartyComponentsProvider nil crash, then run iOS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Cleaning iOS build artifacts"
rm -rf ios/Pods ios/Podfile.lock ios/build
rm -rf "$HOME/Library/Developer/Xcode/DerivedData"/*BoomBoom* 2>/dev/null || true

if [[ ! -d node_modules/react-native ]]; then
  echo "==> npm install"
  npm install
fi

echo "==> pod install"
cd ios
bundle exec pod install
cd ..

PROVIDER="ios/build/generated/ios/ReactCodegen/RCTThirdPartyComponentsProvider.mm"
if [[ -f "$PROVIDER" ]]; then
  if grep -q "BoomBoom nil-safe thirdPartyFabricComponents" "$PROVIDER"; then
    echo "==> Provider already nil-safe"
  else
    echo "==> Warning: nil-safe patch marker not found; check Podfile post_install"
  fi
  if grep -q "RNDateTimePicker" "$PROVIDER"; then
    echo "==> Warning: RNDateTimePicker still registered but package may be missing"
  fi
fi

echo "==> Starting Metro + iOS"
npx react-native start --reset-cache &
METRO_PID=$!
trap 'kill $METRO_PID 2>/dev/null || true' EXIT
sleep 5
npx react-native run-ios
