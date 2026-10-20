package com.fergusonconsultancy.fusiondial;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.opengl.GLES20;
import android.os.SystemClock;

import java.nio.FloatBuffer;
import java.util.TimeZone;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/** Draws a dial. All the artwork lives in a shader under res/raw; this class feeds it the time. */
public class DialRenderer implements SceneRenderer, SensorEventListener {

    /** Frames per second. 60 is smooth; 30 roughly halves the GPU work. */
    private static final int FPS = 60;
    /** Seconds-hand steps per second. 6 matches a 21,600 vph movement. Set to 0 for a perfectly smooth glide. */
    private static final int BEATS_PER_SECOND = 6;
    /** Length of the guilloche and light animation loop. */
    private static final long LOOP_MS = 10000L;

    // --- lume, for dials that have it
    /** Below this ambient light, in lux, the lume shows. A dim bedroom is around 5 to 10. */
    private static final float DARK_LUX = 8f;
    /** Lume fades after the lights go out: seconds for the glow to fall most of the way. */
    private static final float LUME_FADE_S = 900f;
    /** Never fades below this share of its full glow. */
    private static final float LUME_FLOOR = 0.45f;
    /** Seconds of light to recharge it most of the way. */
    private static final float LUME_CHARGE_S = 20f;

    private final Context context;
    private final FloatBuffer quad = GlUtil.fullScreenQuad();
    private int program;
    private int texture;
    private int width = 1, height = 1;
    private int uRes, uCenter, uR0, uLoop, uHour, uMin, uSec, uOv, uDate, uAux, uGlow;
    private int auxTexture;
    private long lastFrame;

    private final int[] shaderParts;
    private final int overlayId;
    private final float radiusScale;
    private final int auxId;
    private final boolean hasLume;

    private final SensorManager sensors;
    private final Sensor lightSensor;
    private volatile float lux = -1f;          // -1 until the light sensor reports
    private float darkness = 0f;
    private float charge = 1f;
    private long lastLumeTick;

    /** The Fusion Dial. */
    public DialRenderer(Context context) {
        this(context, new int[]{R.raw.dial}, R.drawable.overlay, 1f);
    }

    /**
     * Any dial. shaderParts are raw shader files joined in order, overlayId is the dial's
     * static furniture, and radiusScale shrinks the dial to leave room for a bezel.
     */
    public DialRenderer(Context context, int[] shaderParts, int overlayId, float radiusScale) {
        this(context, shaderParts, overlayId, radiusScale, R.drawable.dates, false);
    }

    /**
     * As above, plus a second texture (auxId). With hasLume true, that texture is a lume mask
     * and the dial glows when the room goes dark.
     */
    public DialRenderer(Context context, int[] shaderParts, int overlayId, float radiusScale, int auxId, boolean hasLume) {
        this.context = context.getApplicationContext();
        this.shaderParts = shaderParts;
        this.overlayId = overlayId;
        this.radiusScale = radiusScale;
        this.auxId = auxId;
        this.hasLume = hasLume;
        sensors = hasLume ? (SensorManager) this.context.getSystemService(Context.SENSOR_SERVICE) : null;
        lightSensor = sensors != null ? sensors.getDefaultSensor(Sensor.TYPE_LIGHT) : null;
    }

    /** Only listen to the light sensor while this dial is on screen. */
    @Override
    public void onVisible(boolean visible) {
        if (sensors == null || lightSensor == null) return;
        if (visible) {
            sensors.registerListener(this, lightSensor, SensorManager.SENSOR_DELAY_NORMAL);
        } else {
            sensors.unregisterListener(this);
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        lux = event.values[0];
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
    }

    /** How brightly the lume shows right now, 0 to 1. */
    private float lumeGlow(long msOfDay) {
        long now = SystemClock.elapsedRealtime();
        float dt = lastLumeTick == 0 ? 0f : Math.min((now - lastLumeTick) / 1000f, 5f);
        lastLumeTick = now;
        boolean dark;
        if (lux >= 0f) {
            dark = lux < DARK_LUX;
        } else {
            // No light sensor: treat 20:00 to 07:00 as dark.
            long h = msOfDay / 3600000L;
            dark = h >= 20 || h < 7;
        }
        darkness += ((dark ? 1f : 0f) - darkness) * Math.min(1f, dt / 1.2f);
        if (darkness > 0.5f) {
            charge = LUME_FLOOR + (charge - LUME_FLOOR) * (float) Math.exp(-dt / LUME_FADE_S);
        } else {
            charge += (1f - charge) * Math.min(1f, dt / LUME_CHARGE_S);
        }
        return darkness * charge;
    }

    @Override
    public void onSurfaceCreated(GL10 unused, EGLConfig config) {
        StringBuilder src = new StringBuilder();
        for (int part : shaderParts) src.append(GlUtil.readRaw(context, part)).append('\n');
        program = GlUtil.buildProgram(src.toString());
        uRes = GLES20.glGetUniformLocation(program, "uRes");
        uCenter = GLES20.glGetUniformLocation(program, "uCenter");
        uR0 = GLES20.glGetUniformLocation(program, "uR0");
        uLoop = GLES20.glGetUniformLocation(program, "uLoop");
        uHour = GLES20.glGetUniformLocation(program, "uHour");
        uMin = GLES20.glGetUniformLocation(program, "uMin");
        uSec = GLES20.glGetUniformLocation(program, "uSec");
        uOv = GLES20.glGetUniformLocation(program, "uOv");
        uDate = GLES20.glGetUniformLocation(program, "uDate");
        uAux = GLES20.glGetUniformLocation(program, "uAux");
        uGlow = GLES20.glGetUniformLocation(program, "uGlow");
        texture = GlUtil.loadTexture(context, overlayId);
        // Only dials that sample a second texture (date atlas or lume mask) load one.
        auxTexture = uAux >= 0 ? GlUtil.loadTexture(context, auxId) : 0;
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
        float r0 = Math.min(0.421f * width, 0.337f * height) * radiusScale;
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
        if (uAux >= 0) {
            GLES20.glActiveTexture(GLES20.GL_TEXTURE1);
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, auxTexture);
            GLES20.glUniform1i(uAux, 1);
            GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
        }
        if (uDate >= 0) {
            GLES20.glUniform1f(uDate, java.util.Calendar.getInstance().get(java.util.Calendar.DAY_OF_MONTH));
        }
        if (uGlow >= 0) {
            GLES20.glUniform1f(uGlow, hasLume ? lumeGlow(msOfDay) : 0f);
        }
        GlUtil.drawQuad(program, quad);
    }
}
