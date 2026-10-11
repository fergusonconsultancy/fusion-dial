package com.fergusonconsultancy.fusiondial;

/** The Fusion Dial wallpaper. */
public class DialWallpaperService extends GLWallpaperService {
    @Override
    protected SceneRenderer createRenderer() {
        return new DialRenderer(this);
    }
}
