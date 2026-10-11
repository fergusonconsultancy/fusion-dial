package com.fergusonconsultancy.fusiondial;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.GLUtils;
import android.os.SystemClock;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.TimeZone;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/** Draws the dial. All the artwork lives in res/raw/dial.frag; this class feeds it the time. */
public class DialRenderer implements GLSurfaceView.Renderer {

    private static final String TAG = "FusionDial";

    /** Frames per second. 60 is smooth; 30 roughly halves the GPU work. */
    private static final int FPS = 60;
    /** Seconds-hand steps per second. 6 matches a 21,600 vph movement. Set to 0 for a perfectly smooth glide. */
    private static final int BEATS_PER_SECOND = 6;
    /** Length of the guilloche and light animation loop. */
    private static final long LOOP_MS = 10000L;

    private static final String VERTEX_SHADER =
            "attribute vec2 a;\nvoid main() { gl_Position = vec4(a, 0.0, 1.0); }\n";

    private final Context context;
    private final FloatBuffer quad;
    private int program;
    private int texture;
    private int width = 1, height = 1;
    private int uRes, uCenter, uR0, uLoop, uHour, uMin, uSec, uOv;
    private long lastFrame;

    public DialRenderer(Context context) {
        this.context = context.getApplicationContext();
        float[] corners = {-1f, -1f, 1f, -1f, -1f, 1f, 1f, 1f};
        quad = ByteBuffer.allocateDirect(corners.length * 4).order(ByteOrder.nativeOrder()).asFloatBuffer();
        quad.put(corners).position(0);
    }

    @Override
    public void onSurfaceCreated(GL10 unused, EGLConfig config) {
        program = buildProgram(VERTEX_SHADER, readRaw(R.raw.dial));
        uRes = GLES20.glGetUniformLocation(program, "uRes");
        uCenter = GLES20.glGetUniformLocation(program, "uCenter");
        uR0 = GLES20.glGetUniformLocation(program, "uR0");
        uLoop = GLES20.glGetUniformLocation(program, "uLoop");
        uHour = GLES20.glGetUniformLocation(program, "uHour");
        uMin = GLES20.glGetUniformLocation(program, "uMin");
        uSec = GLES20.glGetUniformLocation(program, "uSec");
        uOv = GLES20.glGetUniformLocation(program, "uOv");
        texture = loadTexture(R.drawable.overlay);
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
        limitFrameRate();

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

        int a = GLES20.glGetAttribLocation(program, "a");
        GLES20.glEnableVertexAttribArray(a);
        GLES20.glVertexAttribPointer(a, 2, GLES20.GL_FLOAT, false, 0, quad);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        GLES20.glDisableVertexAttribArray(a);
    }

    private void limitFrameRate() {
        long frame = 1000L / FPS;
        long elapsed = SystemClock.uptimeMillis() - lastFrame;
        if (elapsed >= 0 && elapsed < frame) {
            try {
                Thread.sleep(frame - elapsed);
            } catch (InterruptedException ignored) {
            }
        }
        lastFrame = SystemClock.uptimeMillis();
    }

    private String readRaw(int id) {
        try {
            InputStream in = context.getResources().openRawResource(id);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            in.close();
            return out.toString("UTF-8");
        } catch (Exception e) {
            Log.e(TAG, "Could not read shader", e);
            return "";
        }
    }

    private int loadTexture(int id) {
        int[] ids = new int[1];
        GLES20.glGenTextures(1, ids, 0);
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inScaled = false;
        Bitmap bmp = BitmapFactory.decodeResource(context.getResources(), id, opts);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, ids[0]);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR_MIPMAP_LINEAR);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE);
        if (bmp != null) {
            GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bmp, 0);
            GLES20.glGenerateMipmap(GLES20.GL_TEXTURE_2D);
            bmp.recycle();
        } else {
            Log.e(TAG, "Could not decode overlay texture");
        }
        return ids[0];
    }

    private static int buildProgram(String vertexSrc, String fragmentSrc) {
        int vs = compile(GLES20.GL_VERTEX_SHADER, vertexSrc);
        int fs = compile(GLES20.GL_FRAGMENT_SHADER, fragmentSrc);
        if (vs == 0 || fs == 0) return 0;
        int p = GLES20.glCreateProgram();
        GLES20.glAttachShader(p, vs);
        GLES20.glAttachShader(p, fs);
        GLES20.glLinkProgram(p);
        int[] ok = new int[1];
        GLES20.glGetProgramiv(p, GLES20.GL_LINK_STATUS, ok, 0);
        if (ok[0] == 0) {
            Log.e(TAG, "Link failed: " + GLES20.glGetProgramInfoLog(p));
            GLES20.glDeleteProgram(p);
            return 0;
        }
        return p;
    }

    private static int compile(int type, String src) {
        int s = GLES20.glCreateShader(type);
        GLES20.glShaderSource(s, src);
        GLES20.glCompileShader(s);
        int[] ok = new int[1];
        GLES20.glGetShaderiv(s, GLES20.GL_COMPILE_STATUS, ok, 0);
        if (ok[0] == 0) {
            Log.e(TAG, "Shader compile failed: " + GLES20.glGetShaderInfoLog(s));
            GLES20.glDeleteShader(s);
            return 0;
        }
        return s;
    }
}
