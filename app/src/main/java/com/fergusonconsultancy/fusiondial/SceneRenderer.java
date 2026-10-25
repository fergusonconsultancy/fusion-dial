package com.fergusonconsultancy.fusiondial;

import android.opengl.GLSurfaceView;
import android.view.MotionEvent;

/** A wallpaper scene. onVisible lets a scene start and stop things like sensors. */
public interface SceneRenderer extends GLSurfaceView.Renderer {
    void onVisible(boolean visible);

    /** Touches on the home screen, in surface pixels. Called on the main thread. */
    default void onTouch(MotionEvent event) {
    }
}
