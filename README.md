# Fusion Dial

An Android live wallpaper: a working watch dial that tells the real time.

- Spiral scale guilloché centre and fret chapter ring
- Petrol sunburst with cream numerals and batons
- Blued leaf hands and a small seconds at 6 that beats six times a second
- Drawing stops whenever the wallpaper is hidden

## Install

1. Open **Releases** on this repo and download `FusionDial.apk` on the phone.
2. Open the file and allow the install.
3. Tap the **Fusion Dial** app icon, then **Set wallpaper**.

Every push to `main` builds a fresh APK and publishes it as a new release.

## Where things live

| File | What it does |
|---|---|
| `app/src/main/res/raw/dial.frag` | The artwork. A GPU shader that draws the dial and hands. |
| `app/src/main/java/.../DialRenderer.java` | Reads the clock and feeds the shader. Frame rate and beat rate are constants at the top. |
| `app/src/main/java/.../DialWallpaperService.java` | Registers the wallpaper with Android and pauses it when hidden. |
| `tools/overlay.py` | Regenerates the numerals, batons and fret ring texture. |
| `tools/preview.html` | Runs the same shader in a desktop browser. |
