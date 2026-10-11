package com.fergusonconsultancy.fusiondial;

import android.opengl.GLSurfaceView;

/** A wallpaper scene. onVisible lets a scene start and stop things like sensors. */
public interface SceneRenderer extends GLSurfaceView.Renderer {
    void onVisible(boolean visible);
}
