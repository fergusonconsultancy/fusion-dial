package com.fergusonconsultancy.fusiondial;

import android.content.Context;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.SystemClock;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

/**
 * Short, crisp clicks. Uses the phone's tuned click primitive where it has one,
 * which feels like a detent rather than a buzz, and falls back gracefully.
 * Respects the phone's touch-feedback setting.
 */
final class Haptics {
    /** Clicks closer together than this are merged, so a fast spin stays crisp instead of a smear. */
    private static final long MIN_GAP_MS = 14;

    private final Vibrator vibrator;
    private final boolean primitives;
    private long last;

    Haptics(Context context) {
        Vibrator v = null;
        try {
            if (Build.VERSION.SDK_INT >= 31) {
                VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) v = vm.getDefaultVibrator();
            } else {
                v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            }
        } catch (Exception ignored) {
        }
        vibrator = v != null && v.hasVibrator() ? v : null;
        primitives = vibrator != null && Build.VERSION.SDK_INT >= 30
                && vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_CLICK);
    }

    /** One detent. strength runs 0 to 1. */
    void click(float strength) {
        if (vibrator == null) return;
        long now = SystemClock.uptimeMillis();
        if (now - last < MIN_GAP_MS) return;
        last = now;
        try {
            VibrationEffect effect;
            if (primitives) {
                effect = VibrationEffect.startComposition()
                        .addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, Math.max(0.05f, Math.min(1f, strength)))
                        .compose();
            } else if (Build.VERSION.SDK_INT >= 29) {
                effect = VibrationEffect.createPredefined(strength > 0.75f ? VibrationEffect.EFFECT_CLICK : VibrationEffect.EFFECT_TICK);
            } else {
                effect = VibrationEffect.createOneShot(8, Math.max(1, Math.min(255, (int) (strength * 200))));
            }
            if (Build.VERSION.SDK_INT >= 33) {
                vibrator.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_TOUCH));
            } else {
                vibrator.vibrate(effect, new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION).build());
            }
        } catch (Exception ignored) {
        }
    }
}
