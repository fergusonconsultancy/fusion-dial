package com.fergusonconsultancy.fusiondial;

import android.content.Context;
import android.opengl.GLES20;
import android.os.SystemClock;

import java.nio.FloatBuffer;
import java.util.TimeZone;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/** Draws the dial. All the artwork lives in res/raw/dial.frag; this class feeds it the time. */
public class DialRenderer implements SceneRenderer {

    /** Frames per second. 60 is smooth; 30 roughly halves the GPU work. */
    private static final int FPS = 60;
    /** Seconds-hand steps per second. 6 matches a 21,600 vph movement. Set to 0 for a perfectly smooth glide. */
    private static final int BEATS_PER_SECOND = 6;
    /** Length of the guilloche and light animation loop. */
    private static final long LOOP_MS = 10000L;

    private final Context context;
    private final FloatBuffer quad = GlUtil.fullScreenQuad();
    private int program;
    private int texture;
    private int width = 1, height = 1;
    private int uRes, uCenter, uR0, uLoop, uHour, uMin, uSec, uOv;
    private long lastFrame;

    public DialRenderer(Context context) {
        this.context = context.getApplicationContext();
    }

    @Override
    public void onVisible(boolean visible) {
    }

    @Override
    public void onSurfaceCreated(GL10 unused, EGLConfig config) {
        program = GlUtil.buildProgram(GlUtil.readRaw(context, R.raw.dial));
        uRes = GLES20.glGetUniformLocation(program, "uRes");
        uCenter = GLES20.glGetUniformLocation(program, "uCenter");
        uR0 = GLES20.glGetUniformLocation(program, "uR0");
        uLoop = GLES20.glGetUniformLocation(program, "uLoop");
        uHour = GLES20.glGetUniformLocation(program, "uHour");
        uMin = GLES20.glGetUniformLocation(program, "uMin");
        uSec = GLES20.glGetUniformLocation(program, "uSec");
        uOv = GLES20.glGetUniformLocation(program, "uOv");
        texture = GlUtil.loadTexture(context, R.drawable.overlay);
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glDisable(GLES20.GL_BLEND);
    }

    @Override
    public void onSurfaceChanged(GL10 unused, int w, int h) {
        width = Math.max(w, 1);
        height = Math.max(h, 1);
        GLES20.glViewport(0, 0, width, height);
    }

    @Override
    public void onDrawFrame(GL10 unused) {
        lastFrame = GlUtil.limitFrameRate(lastFrame, FPS);

        // Local time of day in milliseconds, including daylight saving.
        long now = System.currentTimeMillis();
        long local = now + TimeZone.getDefault().getOffset(now);
        long msOfDay = ((local % 86400000L) + 86400000L) % 86400000L;

        long secMs = msOfDay % 60000L;
        if (BEATS_PER_SECOND > 0) {
            long beat = 1000L / BEATS_PER_SECOND;
            secMs = (secMs / beat) * beat;
        }
        final float tau = (float) (Math.PI * 2.0);
        float hour = (msOfDay % 43200000L) / 43200000f * tau;
        float min = (msOfDay % 3600000L) / 3600000f * tau;
        float sec = secMs / 60000f * tau;
        float loop = (SystemClock.uptimeMillis() % LOOP_MS) / (float) LOOP_MS;

        // Tall cover screen: dial sits lower, clear of the clock. Unfolded: nearer the middle.
        boolean tall = height > width * 1.5f;
        float r0 = Math.min(0.421f * width, 0.337f * height);
        float cx = width * 0.5f;
        float cy = height * (tall ? 0.60f : 0.54f);

        GLES20.glViewport(0, 0, width, height);
        GLES20.glClearColor(0f, 0f, 0f, 1f);
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT);
        if (program == 0) return;

        GLES20.glUseProgram(program);
        GLES20.glUniform2f(uRes, width, height);
        GLES20.glUniform2f(uCenter, cx, cy);
        GLES20.glUniform1f(uR0, r0);
        GLES20.glUniform1f(uLoop, loop);
        GLES20.glUniform1f(uHour, hour);
        GLES20.glUniform1f(uMin, min);
        GLES20.glUniform1f(uSec, sec);
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, texture);
        GLES20.glUniform1i(uOv, 0);
        GlUtil.drawQuad(program, quad);
    }
}
