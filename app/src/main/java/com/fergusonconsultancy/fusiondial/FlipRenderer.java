package com.fergusonconsultancy.fusiondial;

import android.content.Context;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/**
 * For folding phones: the dial on the tall cover screen, the caseback once unfolded.
 * Opening the phone turns the watch over.
 */
public class FlipRenderer implements SceneRenderer {

    private final DialRenderer dial;
    private final CasebackRenderer caseback;
    private boolean tall = true;

    public FlipRenderer(Context context) {
        dial = new DialRenderer(context);
        caseback = new CasebackRenderer(context);
    }

    @Override
    public void onVisible(boolean visible) {
        dial.onVisible(visible);
        caseback.onVisible(visible);
    }

    @Override
    public void onSurfaceCreated(GL10 gl, EGLConfig config) {
        dial.onSurfaceCreated(gl, config);
        caseback.onSurfaceCreated(gl, config);
    }

    @Override
    public void onSurfaceChanged(GL10 gl, int w, int h) {
        tall = h > w * 1.5f;
        dial.onSurfaceChanged(gl, w, h);
        caseback.onSurfaceChanged(gl, w, h);
    }

    @Override
    public void onDrawFrame(GL10 gl) {
        if (tall) {
            dial.onDrawFrame(gl);
        } else {
            caseback.onDrawFrame(gl);
        }
    }
}
