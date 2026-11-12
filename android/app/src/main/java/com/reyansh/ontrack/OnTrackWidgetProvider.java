package com.reyansh.ontrack;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class OnTrackWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_OPEN_APP = "com.reyansh.ontrack.ACTION_OPEN_APP";
    public static final String ACTION_OPEN_TIMER = "com.reyansh.ontrack.ACTION_OPEN_TIMER";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_habit_tracker);

        // Intent to launch MainActivity (Dashboard)
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        views.setOnClickPendingIntent(R.id.widget_root_layout, pendingIntent);
        views.setOnClickPendingIntent(R.id.widget_btn_quick_check, pendingIntent);

        // Intent for Pomodoro Focus Timer directly
        Intent timerIntent = new Intent(context, MainActivity.class);
        timerIntent.setAction(ACTION_OPEN_TIMER);
        timerIntent.putExtra("target_screen", "timer");
        timerIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent timerPendingIntent = PendingIntent.getActivity(
                context, 1, timerIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_focus_timer, timerPendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void refreshAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(
                new ComponentName(context, OnTrackWidgetProvider.class)
        );
        for (int id : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }
}

