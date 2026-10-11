package com.fergusonconsultancy.fusiondial;

/** A different dial each day. */
public class RotationWallpaperService extends GLWallpaperService {
    @Override
    protected SceneRenderer createRenderer() {
        return new RotationRenderer(this);
    }
}
