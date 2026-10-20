# Fusion Dial

Three Android live wallpapers in one app.

**Fusion Dial**: a working watch dial that tells the real time.
- Spiral scale guilloché centre and fret chapter ring
- Petrol sunburst with cream numerals and batons
- Blued leaf hands and a small seconds at 6 that beats six times a second

**Caseback**: an automatic movement seen through a sapphire back.
- Balance wheel beating at 3 Hz with a breathing blued hairspring
- Winding rotor that swings under real gravity as you tilt the phone
- Ribbed three-quarter plate, perlage, rubies and blued screws

**Dial and Caseback**: for folding phones. Dial when closed, caseback when open.

**Rotation**: a different dial from the collection each day, changing at midnight, each with working hands. Seven dials: petrol sunburst sports dial, scale guilloché, black single-hand with a live date, dual-scale diver, taupe diver with snowflake hands, gold cushion chronograph, and a fully lumed white field dial.

Dials with lume glow when the room goes dark (read from the light sensor), in each watch's own colour: aqua on the petrol, scale and field dials, green on the two divers. The glow fades over 15 minutes and recharges in the light.

Drawing and sensing stop whenever the wallpaper is hidden.

## Install

1. Open **Releases** on this repo and download `FusionDial.apk` on the phone.
2. Open the file and allow the install.
3. Tap the **Fusion Dial** app icon, pick a wallpaper, then **Set wallpaper**.

Every push to `main` builds a fresh APK and publishes it as a new release.

## Where things live

| File | What it does |
|---|---|
| `app/src/main/res/raw/dial.frag` | The dial artwork. A GPU shader that draws the dial and hands. |
| `app/src/main/res/raw/caseback.frag` | The movement artwork: plates, balance, rotor. |
| `app/src/main/java/.../CasebackRenderer.java` | Balance timing and rotor physics from the accelerometer. |
| `app/src/main/java/.../DialRenderer.java` | Reads the clock and feeds the shader. Frame rate and beat rate are constants at the top. |
| `app/src/main/java/.../GLWallpaperService.java` | Registers a wallpaper with Android and pauses it when hidden. |
| `tools/overlay.py` | Regenerates the numerals, batons and fret ring texture. |
| `app/src/main/res/raw/dial_common.glsl` + `dial_*.frag` | The Rotation dials: shared hands and metals, then one file per watch. |
| `app/src/main/java/.../RotationRenderer.java` | Picks today's dial. The list at the top is the rotation order. |
| `tools/overlay_rotation.py`, `tools/overlay_rotation2.py`, `tools/overlay_underdog.py` | Regenerate the Rotation dials' numerals, tracks and markers. |
| `tools/caseback_overlay.py` | Regenerates the caseback engraving texture. |
| `tools/preview.html`, `tools/preview_caseback.html` | Run the same shaders in a desktop browser. |
