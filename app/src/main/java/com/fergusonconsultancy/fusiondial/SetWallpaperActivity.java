package com.fergusonconsultancy.fusiondial;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.WallpaperManager;
import android.content.ComponentName;
import android.content.DialogInterface;
import android.content.Intent;
import android.os.Bundle;

/** Tapping the app icon asks which wallpaper you want, then opens the system preview for it. */
public class SetWallpaperActivity extends Activity {

    private static final Class<?>[] SERVICES = {
            DialWallpaperService.class,
            CasebackWallpaperService.class,
            FlipWallpaperService.class,
            RotationWallpaperService.class,
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String[] names = {
                getString(R.string.app_name),
                getString(R.string.caseback_name),
                getString(R.string.flip_name),
                getString(R.string.rotation_name),
        };
        new AlertDialog.Builder(this)
                .setTitle(R.string.choose)
                .setItems(names, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        open(SERVICES[which]);
                    }
                })
                .setOnCancelListener(new DialogInterface.OnCancelListener() {
                    @Override
                    public void onCancel(DialogInterface dialog) {
                        finish();
                    }
                })
                .show();
    }

    private void open(Class<?> service) {
        try {
            Intent i = new Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER);
            i.putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT, new ComponentName(this, service));
            startActivity(i);
        } catch (Exception e) {
            // Fall back to the generic live wallpaper list.
            try {
                startActivity(new Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER));
            } catch (Exception ignored) {
            }
        }
        finish();
    }
}
