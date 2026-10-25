#!/bin/bash
# Emulator test for the turnable bezel: sets the Rotation wallpaper for real,
# then swipes anticlockwise across the top of the Tudor's bezel on the home screen.
# Usage: tools/emulator_bezel_test.sh API_LEVEL   (run from the folder holding the APK)
API=$1
adb shell "date 101210102026.00"            # 12 Oct: the Tudor's day
adb shell input keyevent KEYCODE_HOME; sleep 2
adb shell am start -f 0x10008000 -a android.service.wallpaper.CHANGE_LIVE_WALLPAPER \
  --ecn android.service.wallpaper.extra.LIVE_WALLPAPER_COMPONENT \
  com.fergusonconsultancy.fusiondial/.RotationWallpaperService
sleep 10

tap_text() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  local b
  b=$(adb shell cat /sdcard/ui.xml | tr '>' '\n' | grep -i "text=\"$1" | head -1 \
      | sed -E 's/.*bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]".*/\1 \2 \3 \4/')
  echo "found '$1' at: $b"
  set -- $b
  if [ -n "$4" ]; then adb shell input tap $(( ($1 + $3) / 2 )) $(( ($2 + $4) / 2 )); fi
}
tap_text "Set wallpaper"; sleep 3
adb exec-out screencap -p > set-dialog-$API.png
tap_text "Home screen"; sleep 3
adb shell input keyevent KEYCODE_HOME; sleep 4
adb exec-out screencap -p > home-before-$API.png

SIZE=$(adb shell wm size | grep -i physical | sed 's/.*: //' | tr -d '\r')
W=${SIZE%x*}; H=${SIZE#*x}
R=$(( W * 421 * 76 / 100000 )); CY=$(( H * 60 / 100 )); YT=$(( CY - R * 125 / 100 ))
Y=$(( YT + R * 12 / 100 ))
echo "screen ${W}x${H}, dial radius $R, centre y $CY, swipe at y $Y"
adb shell input swipe $(( W / 2 + R * 55 / 100 )) $Y $(( W / 2 - R * 55 / 100 )) $Y 900
sleep 2
adb exec-out screencap -p > preview-bezel-$API.png
{ echo "screen ${W}x${H}, swipe at y $Y"; adb logcat -d | grep FusionDial; } > bezel-log-$API.txt
exit 0
