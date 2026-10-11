package com.fergusonconsultancy.fusiondial;

/** Dial when folded, caseback when unfolded. */
public class FlipWallpaperService extends GLWallpaperService {
    @Override
    protected SceneRenderer createRenderer() {
        return new FlipRenderer(this);
    }
}
