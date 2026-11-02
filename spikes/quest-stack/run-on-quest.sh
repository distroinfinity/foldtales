#!/bin/zsh
# Serves the spike to a USB-connected Quest over loopback, so nothing is exposed on the LAN.
set -e
cd "$(dirname "$0")"
serial=$(adb devices | awk 'NR>1 && $2=="device"{print $1; exit}')
if [ -z "$serial" ]; then
  echo "No authorized headset. Plug it in, put it on, and accept 'Allow USB debugging'."
  adb devices
  exit 1
fi
: > spike-telemetry.jsonl
npx iwsdk dev up --no-open >/dev/null
adb -s "$serial" reverse tcp:8081 tcp:8081
node open-on-quest.mjs
echo "On $serial with Quest Browser open: accept the certificate warning if shown, then tap the XR button."
echo "Live results: node report.mjs      Stop: npx iwsdk dev down && adb -s $serial reverse --remove-all"
