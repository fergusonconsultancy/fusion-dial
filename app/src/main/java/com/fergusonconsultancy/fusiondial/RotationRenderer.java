package com.fergusonconsultancy.fusiondial;

import android.content.Context;

import java.util.TimeZone;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/**
 * Shows one dial from the collection per day, changing at local midnight.
 *
 * To add a watch: write its shader (res/raw/dial_NAME.frag), generate its furniture
 * texture (tools/overlay_rotation.py), then add one line to the list in the constructor.
 * The order of that list is the order of the rotation.
 */
public class RotationRenderer implements SceneRenderer {

    private final DialRenderer[] dials;
    private final boolean[] ready;
    private int width = 1, height = 1;

    public RotationRenderer(Context context) {
        dials = new DialRenderer[]{
                new DialRenderer(context, new int[]{R.raw.dial_common, R.raw.dial_petrol}, R.drawable.overlay_petrol, 0.87f),
                new DialRenderer(context, new int[]{R.raw.dial_common, R.raw.dial_scales}, R.drawable.overlay_scales, 0.87f),
        };
        ready = new boolean[dials.length];
    }

    /** Which dial is on today: whole days since 1 January 1970, local time, cycling through the list. */
    private int today() {
        long now = System.currentTimeMillis();
        long local = now + TimeZone.getDefault().getOffset(now);
        long day = Math.floorDiv(local, 86400000L);
        return (int) Math.floorMod(day, (long) dials.length);
    }

    @Override
    public void onVisible(boolean visible) {
    }

    @Override
    public void onSurfaceCreated(GL10 gl, EGLConfig config) {
        // A new graphics context: every dial must be rebuilt before it is next drawn.
        for (int i = 0; i < ready.length; i++) ready[i] = false;
    }

    @Override
    public void onSurfaceChanged(GL10 gl, int w, int h) {
        width = w;
        height = h;
        for (int i = 0; i < dials.length; i++) {
            if (ready[i]) dials[i].onSurfaceChanged(gl, w, h);
        }
    }

    @Override
    public void onDrawFrame(GL10 gl) {
        int i = today();
        if (!ready[i]) {
            // Built on first use, so the phone only pays for the dial it is showing.
            dials[i].onSurfaceCreated(gl, null);
            dials[i].onSurfaceChanged(gl, width, height);
            ready[i] = true;
        }
        dials[i].onDrawFrame(gl);
    }
}
