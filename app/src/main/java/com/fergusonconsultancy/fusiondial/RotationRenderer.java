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
                // shader, furniture texture, size, then (for lume dials) the lume mask
                new DialRenderer(context, new int[]{R.raw.dial_common, R.raw.dial_petrol}, R.drawable.overlay_petrol, 0.87f, R.drawable.lume_petrol, true),
                new DialRenderer(context, new int[]{R.raw.dial_common, R.raw.dial_scales}, R.drawable.overlay_scales, 0.87f, R.drawable.lume_scales, true),
                new DialRenderer(context, new int[]{R.raw.dial_common, R.raw.dial_neo}, R.drawable.overlay_neo, 0.92f),
                new DialRenderer(context, new int[]{R.raw.dial_common, R.raw.dial_diver2}, R.drawable.overlay_diver2, 0.74f, R.drawable.lume_diver2, true)
                        .withBezel(120, 1.065f, 1.47f, 0.55f, "serica"),
                new DialRenderer(context, new int[]{R.raw.dial_common, R.raw.dial_diver3}, R.drawable.overlay_diver3, 0.76f, R.drawable.lume_diver3, true)
                        .withBezel(60, 1.07f, 1.43f, 0.80f, "tudor"),
                new DialRenderer(context, new int[]{R.raw.dial_common, R.raw.dial_chrono}, R.drawable.overlay_chrono, 0.72f),
                new DialRenderer(context, new int[]{R.raw.dial_common, R.raw.dial_underdog}, R.drawable.overlay_underdog, 0.88f, R.drawable.dates, true),
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

    private boolean visible;
    private int current = -1;

    @Override
    public void onTouch(android.view.MotionEvent event) {
        int i = current;
        if (i >= 0) dials[i].onTouch(event);
    }

    /** Passes visibility to today's dial, so only it listens to sensors. */
    @Override
    public void onVisible(boolean visible) {
        this.visible = visible;
        if (current >= 0) dials[current].onVisible(visible);
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
        if (i != current) {
            // Midnight changeover: hand the sensors from yesterday's dial to today's.
            if (current >= 0) dials[current].onVisible(false);
            current = i;
            if (visible) dials[i].onVisible(true);
        }
        if (!ready[i]) {
            // Built on first use, so the phone only pays for the dial it is showing.
            dials[i].onSurfaceCreated(gl, null);
            dials[i].onSurfaceChanged(gl, width, height);
            ready[i] = true;
        }
        dials[i].onDrawFrame(gl);
    }
}
