package com.fergusonconsultancy.fusiondial;

import android.content.Context;
import android.opengl.GLSurfaceView;
import android.service.wallpaper.WallpaperService;
import android.view.SurfaceHolder;

/**
 * Live wallpaper host. Android hands us a drawing surface; we point a
 * GLSurfaceView at it so DialRenderer can draw with the GPU.
 */
public class DialWallpaperService extends WallpaperService {

    @Override
    public Engine onCreateEngine() {
        return new DialEngine();
    }

    private class DialEngine extends Engine {

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

        @Override
        public void onCreate(SurfaceHolder surfaceHolder) {
            super.onCreate(surfaceHolder);
            setTouchEventsEnabled(false);
            view = new WallpaperGLView(DialWallpaperService.this);
            view.setEGLContextClientVersion(2);
            view.setPreserveEGLContextOnPause(true);
            view.setRenderer(new DialRenderer(DialWallpaperService.this));
            view.setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);
        }

        /** Stop drawing whenever the wallpaper is hidden. This is what protects the battery. */
        @Override
        public void onVisibilityChanged(boolean visible) {
            super.onVisibilityChanged(visible);
            if (view == null) return;
            if (visible) {
                view.onResume();
            } else {
                view.onPause();
            }
        }

        @Override
        public void onDestroy() {
            if (view != null) {
                view.destroy();
                view = null;
            }
            super.onDestroy();
        }
    }
}
