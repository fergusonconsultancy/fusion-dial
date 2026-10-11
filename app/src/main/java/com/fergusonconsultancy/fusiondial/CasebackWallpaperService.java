package com.fergusonconsultancy.fusiondial;

/** The Caseback wallpaper. */
public class CasebackWallpaperService extends GLWallpaperService {
    @Override
    protected SceneRenderer createRenderer() {
        return new CasebackRenderer(this);
    }
}
