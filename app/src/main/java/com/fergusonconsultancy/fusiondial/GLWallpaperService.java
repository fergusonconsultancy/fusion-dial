package com.fergusonconsultancy.fusiondial;

import android.content.Context;
import android.opengl.GLSurfaceView;
import android.service.wallpaper.WallpaperService;
import android.view.SurfaceHolder;

/**
 * Live wallpaper host. Android hands us a drawing surface; we point a
 * GLSurfaceView at it so a SceneRenderer can draw with the GPU.
 * Each wallpaper is a tiny subclass that says which scene to draw.
 */
public abstract class GLWallpaperService extends WallpaperService {

    protected abstract SceneRenderer createRenderer();

    @Override
    public Engine onCreateEngine() {
        return new GLEngine();
    }

    private class GLEngine extends Engine {

        /** A GLSurfaceView that draws into the wallpaper's surface instead of its own. */
        private class WallpaperGLView extends GLSurfaceView {
            WallpaperGLView(Context context) {
                super(context);
            }

            @Override
            public SurfaceHolder getHolder() {
                return getSurfaceHolder();
            }

            void destroy() {
                super.onDetachedFromWindow();
            }
        }

        private WallpaperGLView view;
        private SceneRenderer renderer;

        @Override
        public void onCreate(SurfaceHolder surfaceHolder) {
            super.onCreate(surfaceHolder);
            setTouchEventsEnabled(true);   // for the turnable bezels
            renderer = createRenderer();
            view = new WallpaperGLView(GLWallpaperService.this);
            view.setEGLContextClientVersion(2);
            view.setPreserveEGLContextOnPause(true);
            view.setRenderer(renderer);
            view.setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);
        }

        /** Stop drawing and sensing whenever the wallpaper is hidden. This is what protects the battery. */
        @Override
        public void onVisibilityChanged(boolean visible) {
            super.onVisibilityChanged(visible);
            if (view == null) return;
            if (visible) {
                view.onResume();
            } else {
                view.onPause();
            }
            if (renderer != null) renderer.onVisible(visible);
        }

        @Override
        public void onTouchEvent(android.view.MotionEvent event) {
            if (event.getActionMasked() == android.view.MotionEvent.ACTION_DOWN) {
                android.util.Log.d("FusionDial", "wallpaper touch down at " + event.getX() + "," + event.getY());
            }
            if (renderer != null) renderer.onTouch(event);
            super.onTouchEvent(event);
        }

        @Override
        public void onDestroy() {
            if (renderer != null) renderer.onVisible(false);
            if (view != null) {
                view.destroy();
                view = null;
            }
            super.onDestroy();
        }
    }
}
