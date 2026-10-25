package com.fergusonconsultancy.fusiondial;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.view.MotionEvent;

/**
 * A unidirectional diver's bezel you can turn with a finger.
 *
 * Like the real thing it only turns anticlockwise, in fixed detents, each with a click.
 * Push it clockwise and it gives a fraction of a degree, then springs back.
 * Its position is kept, so each watch's bezel stays where you left it.
 *
 * To time something: turn the bezel until the pip sits over the minute hand,
 * then read elapsed minutes off the bezel against the minute hand.
 * Double-tap the bezel and it ratchets round to the minute hand for you.
 *
 * Angles are clock angles: radians clockwise from 12. The pip sits at angle().
 */
final class Bezel {
    private static final float TAU = (float) (Math.PI * 2);

    private final float step;          // one detent
    private final float hitInner, hitOuter;   // touch zone, in dial radii
    private final float clickStrength;
    private final Haptics haptics;
    private final SharedPreferences prefs;
    private final String key;

    // Geometry and time, written by the drawing thread.
    private volatile float cx, cy, r0 = 1;
    private volatile float minuteAngle;

    // Bezel state. Guarded by this.
    private float angle;          // committed position, a whole number of detents
    private float pending;        // finger travel since the last detent; negative = anticlockwise
    private boolean dragging;
    private float lastFinger;
    private float downX, downY;
    private long downTime;
    private boolean moved;
    private long lastTapTime;
    private float lastTapX, lastTapY;
    private float snapLeft;       // anticlockwise travel still to go on a double-tap set
    private float snapPartial;
    private long lastUpdate;

    /**
     * clicks: detents per full turn. inner, outer: the bezel ring in dial radii.
     * clickStrength: how firm each click feels, 0 to 1.
     */
    Bezel(Context context, int clicks, float inner, float outer, float clickStrength, String key) {
        this.step = TAU / clicks;
        this.hitInner = inner - 0.10f;
        this.hitOuter = outer + 0.22f;
        this.clickStrength = clickStrength;
        this.haptics = new Haptics(context);
        this.prefs = context.getSharedPreferences("bezels", Context.MODE_PRIVATE);
        this.key = key;
        this.angle = prefs.getFloat(key, 0f);
    }

    void setGeometry(float cx, float cy, float r0, float minuteAngle) {
        this.cx = cx;
        this.cy = cy;
        this.r0 = r0;
        this.minuteAngle = minuteAngle;
    }

    private float clockAngle(float x, float y) {
        return (float) Math.atan2(x - cx, -(y - cy));
    }

    private static float wrap(float a) {
        a %= TAU;
        if (a > Math.PI) a -= TAU;
        if (a < -Math.PI) a += TAU;
        return a;
    }

    private static float norm(float a) {
        a %= TAU;
        return a < 0 ? a + TAU : a;
    }

    /** Returns true if the touch landed on the bezel. */
    synchronized boolean onTouch(MotionEvent e) {
        float x = e.getX(), y = e.getY();
        switch (e.getActionMasked()) {
            case MotionEvent.ACTION_DOWN: {
                float k = (float) Math.hypot(x - cx, y - cy) / r0;
                android.util.Log.d("FusionDial", "bezel touch at radius " + k + (k < hitInner || k > hitOuter ? " (missed)" : " (grabbed)"));
                if (k < hitInner || k > hitOuter) return false;
                dragging = true;
                moved = false;
                snapLeft = 0f;            // a finger on the bezel stops a ratchet in progress
                snapPartial = 0f;
                lastFinger = clockAngle(x, y);
                downX = x;
                downY = y;
                downTime = SystemClock.uptimeMillis();
                return true;
            }
            case MotionEvent.ACTION_MOVE: {
                if (!dragging) return false;
                if (Math.hypot(x - downX, y - downY) > 10f * r0 / 455f) moved = true;
                float a = clockAngle(x, y);
                float d = wrap(a - lastFinger);
                lastFinger = a;
                pending += d;
                float give = 0.35f * step;            // the slight play in a real bezel
                if (pending > give) pending = give;
                int passed = 0;
                while (pending <= -step) {
                    pending += step;
                    angle = norm(angle - step);
                    passed++;
                }
                if (passed > 0) {
                    detent();
                    android.util.Log.d("FusionDial", "bezel turned " + passed + " detent(s), now at " + norm(angle));
                }
                return true;
            }
            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL: {
                if (!dragging) return false;
                dragging = false;
                long now = SystemClock.uptimeMillis();
                if (!moved && now - downTime < 250 && e.getActionMasked() == MotionEvent.ACTION_UP) {
                    boolean second = now - lastTapTime < 350
                            && Math.hypot(x - lastTapX, y - lastTapY) < 60f * r0 / 455f;
                    if (second) {
                        startSet();
                        lastTapTime = 0;
                    } else {
                        lastTapTime = now;
                        lastTapX = x;
                        lastTapY = y;
                    }
                }
                save();
                return true;
            }
            default:
                return dragging;
        }
    }

    /** Double-tap: ratchet anticlockwise until the pip meets the minute hand. */
    private void startSet() {
        float target = Math.round(minuteAngle / step) * step;
        float distance = norm(angle - target);
        if (distance < step * 0.5f || distance > TAU - step * 0.5f) return;
        snapLeft = Math.round(distance / step) * step;
        snapPartial = 0f;
    }

    private void detent() {
        // The pip landing on 12 gets a firmer click.
        float fromTwelve = Math.min(norm(angle), TAU - norm(angle));
        haptics.click(fromTwelve < step * 0.5f ? 1f : clickStrength);
    }

    private void save() {
        prefs.edit().putFloat(key, norm(angle)).apply();
    }

    /** Advances springs and the double-tap ratchet. Returns the angle to draw. Drawing thread. */
    synchronized float update() {
        long now = SystemClock.elapsedRealtime();
        float dt = lastUpdate == 0 ? 0.016f : Math.min((now - lastUpdate) / 1000f, 0.05f);
        lastUpdate = now;

        if (!dragging && pending != 0f) {
            pending *= (float) Math.exp(-dt * 22f);   // released mid-detent: settles back
            if (Math.abs(pending) < 1e-4f) pending = 0f;
        }
        if (snapLeft > 0f) {
            // Quick at first, easing as it closes on the hand, like a thumb spinning a bezel.
            float speed = 1.6f + 7.0f * snapLeft;
            snapPartial += Math.min(snapLeft - snapPartial, speed * dt);
            while (snapPartial >= step - 1e-5f && snapLeft > 0f) {
                snapPartial -= step;
                snapLeft -= step;
                angle = norm(angle - step);
                detent();
            }
            if (snapLeft <= 1e-4f) {
                snapLeft = 0f;
                snapPartial = 0f;
                save();
            }
        }
        // Between detents the bezel lags the finger, then drops into the next notch.
        float shown = pending > 0f ? pending * 0.6f : pending * 0.3f;
        return angle + shown - snapPartial;
    }
}
