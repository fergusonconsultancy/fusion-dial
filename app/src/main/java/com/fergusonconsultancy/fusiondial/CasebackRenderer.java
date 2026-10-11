package com.fergusonconsultancy.fusiondial;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.hardware.display.DisplayManager;
import android.opengl.GLES20;
import android.os.SystemClock;
import android.view.Display;
import android.view.Surface;

import java.nio.FloatBuffer;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/**
 * Draws the movement seen through the caseback (res/raw/caseback.frag).
 * The balance beats at 3 Hz and the winding rotor swings under real gravity,
 * read from the phone's accelerometer.
 */
public class CasebackRenderer implements SceneRenderer, SensorEventListener {

    private static final int FPS = 60;
    /** Balance frequency in Hz. 3 Hz is 21,600 vibrations per hour. */
    private static final float BALANCE_HZ = 3f;
    /** Balance swing either side of rest, in radians (about 270 degrees). */
    private static final float BALANCE_AMPLITUDE = 4.7f;
    /** How hard gravity pulls the rotor, and how quickly it settles. */
    private static final float ROTOR_PULL = 34f;
    private static final float ROTOR_DAMPING = 1.5f;

    private final Context context;
    private final FloatBuffer quad = GlUtil.fullScreenQuad();
    private final SensorManager sensors;
    private final Sensor accelerometer;
    private final DisplayManager displays;

    private int program;
    private int texture;
    private int width = 1, height = 1;
    private int uRes, uCenter, uR0, uBal, uRotor, uWind, uLight, uOv;
    private long lastFrame;
    private long lastPhysics;

    // Latest accelerometer reading in the device's own axes. Upright and still: (0, 9.81).
    private volatile float accelX = 0f, accelY = 9.81f;

    private float rotorAngle = (float) Math.PI;   // heavy side hanging down
    private float rotorSpeed = 0f;
    private float windAngle = 0f;
    private float lightX = 0f, lightY = 0.7f;

    public CasebackRenderer(Context context) {
        this.context = context.getApplicationContext();
        sensors = (SensorManager) this.context.getSystemService(Context.SENSOR_SERVICE);
        accelerometer = sensors != null ? sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) : null;
        displays = (DisplayManager) this.context.getSystemService(Context.DISPLAY_SERVICE);
    }

    /** Only listen to the accelerometer while the wallpaper is on screen. */
    @Override
    public void onVisible(boolean visible) {
        if (sensors == null || accelerometer == null) return;
        if (visible) {
            sensors.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME);
        } else {
            sensors.unregisterListener(this);
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        accelX = event.values[0];
        accelY = event.values[1];
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
    }

    @Override
    public void onSurfaceCreated(GL10 unused, EGLConfig config) {
        program = GlUtil.buildProgram(GlUtil.readRaw(context, R.raw.caseback));
        uRes = GLES20.glGetUniformLocation(program, "uRes");
        uCenter = GLES20.glGetUniformLocation(program, "uCenter");
        uR0 = GLES20.glGetUniformLocation(program, "uR0");
        uBal = GLES20.glGetUniformLocation(program, "uBal");
        uRotor = GLES20.glGetUniformLocation(program, "uRotor");
        uWind = GLES20.glGetUniformLocation(program, "uWind");
        uLight = GLES20.glGetUniformLocation(program, "uLight");
        uOv = GLES20.glGetUniformLocation(program, "uOv");
        texture = GlUtil.loadTexture(context, R.drawable.caseback_overlay);
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glDisable(GLES20.GL_BLEND);
    }

    @Override
    public void onSurfaceChanged(GL10 unused, int w, int h) {
        width = Math.max(w, 1);
        height = Math.max(h, 1);
        GLES20.glViewport(0, 0, width, height);
    }

    /** Gravity as it falls across the screen: x to the right, y down the screen, in m/s2. */
    private void screenGravity(float[] out) {
        float ax = accelX, ay = accelY;
        int rotation = Surface.ROTATION_0;
        try {
            Display d = displays != null ? displays.getDisplay(Display.DEFAULT_DISPLAY) : null;
            if (d != null) rotation = d.getRotation();
        } catch (Exception ignored) {
        }
        float sx, sy;   // reading turned into the screen's axes (y up)
        switch (rotation) {
            case Surface.ROTATION_90:  sx = -ay; sy = ax;  break;
            case Surface.ROTATION_180: sx = -ax; sy = -ay; break;
            case Surface.ROTATION_270: sx = ay;  sy = -ax; break;
            default:                   sx = ax;  sy = ay;  break;
        }
        out[0] = -sx;
        out[1] = sy;
    }

    private final float[] gravity = new float[2];

    @Override
    public void onDrawFrame(GL10 unused) {
        lastFrame = GlUtil.limitFrameRate(lastFrame, FPS);

        long now = SystemClock.elapsedRealtime();
        float dt = lastPhysics == 0 ? 0.016f : (now - lastPhysics) / 1000f;
        lastPhysics = now;
        if (dt > 0.05f) dt = 0.05f;

        // --- rotor: a damped pendulum pulled towards wherever "down" is on the screen
        screenGravity(gravity);
        float gx = gravity[0], gy = gravity[1];
        float pull = Math.min((float) Math.hypot(gx, gy) / 9.81f, 1f);   // fades out as the phone lies flat
        float downAngle = (float) Math.atan2(gx, -gy);                   // clockwise from 12
        float accel = -ROTOR_PULL * pull * (float) Math.sin(rotorAngle - downAngle) - ROTOR_DAMPING * rotorSpeed;
        rotorSpeed += accel * dt;
        float step = rotorSpeed * dt;
        rotorAngle += step;
        final float tau = (float) (Math.PI * 2.0);
        rotorAngle = ((rotorAngle % tau) + tau) % tau;
        // Bidirectional winding: the wheels advance whichever way the rotor turns.
        windAngle = (windAngle + Math.abs(step) * 0.18f) % tau;

        // --- balance wheel
        float phase = (now % 1000L) / 1000f;
        float balance = BALANCE_AMPLITUDE * (float) Math.sin(tau * BALANCE_HZ * phase);

        // --- light: follows the tilt of the phone, eased so it glides
        lightX += (gx / 9.81f - lightX) * Math.min(1f, dt * 4f);
        lightY += (gy / 9.81f - lightY) * Math.min(1f, dt * 4f);
        float light = -0.9f + 0.9f * lightX - 0.6f * (lightY - 0.7f)
                + 0.18f * (float) Math.sin((now % 20000L) / 20000f * tau);

        boolean tall = height > width * 1.5f;
        float r0 = Math.min(0.47f * width, 0.38f * height) / 1.30f;
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
        GLES20.glUniform1f(uBal, balance);
        GLES20.glUniform1f(uRotor, rotorAngle);
        GLES20.glUniform1f(uWind, windAngle);
        GLES20.glUniform1f(uLight, light);
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, texture);
        GLES20.glUniform1i(uOv, 0);
        GlUtil.drawQuad(program, quad);
    }
}
