package com.fergusonconsultancy.fusiondial;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.opengl.GLES20;
import android.opengl.GLUtils;
import android.os.SystemClock;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;

/** Shared OpenGL plumbing: shaders, textures, the full-screen quad and the frame limiter. */
final class GlUtil {
    static final String TAG = "FusionDial";
    static final String VERTEX_SHADER =
            "attribute vec2 a;\nvoid main() { gl_Position = vec4(a, 0.0, 1.0); }\n";

    private GlUtil() {
    }

    static FloatBuffer fullScreenQuad() {
        float[] corners = {-1f, -1f, 1f, -1f, -1f, 1f, 1f, 1f};
        FloatBuffer quad = ByteBuffer.allocateDirect(corners.length * 4)
                .order(ByteOrder.nativeOrder()).asFloatBuffer();
        quad.put(corners).position(0);
        return quad;
    }

    static void drawQuad(int program, FloatBuffer quad) {
        int a = GLES20.glGetAttribLocation(program, "a");
        GLES20.glEnableVertexAttribArray(a);
        GLES20.glVertexAttribPointer(a, 2, GLES20.GL_FLOAT, false, 0, quad);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        GLES20.glDisableVertexAttribArray(a);
    }

    /** Sleeps just long enough to hold the given frame rate. Returns the new "last frame" time. */
    static long limitFrameRate(long lastFrame, int fps) {
        long frame = 1000L / fps;
        long elapsed = SystemClock.uptimeMillis() - lastFrame;
        if (elapsed >= 0 && elapsed < frame) {
            try {
                Thread.sleep(frame - elapsed);
            } catch (InterruptedException ignored) {
            }
        }
        return SystemClock.uptimeMillis();
    }

    static String readRaw(Context context, int id) {
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

    static int loadTexture(Context context, int id) {
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
            Log.e(TAG, "Could not decode texture");
        }
        return ids[0];
    }

    static int buildProgram(String fragmentSrc) {
        int vs = compile(GLES20.GL_VERTEX_SHADER, VERTEX_SHADER);
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
        Log.i(TAG, "Shader program ready");
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
