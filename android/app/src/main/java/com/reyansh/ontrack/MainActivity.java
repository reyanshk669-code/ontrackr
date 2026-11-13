package com.reyansh.ontrack;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends AppCompatActivity {
    private static final String TAG = "HabitWallApp";
    private WebView webView;
    private SwipeRefreshLayout swipeRefreshLayout;
    private WebViewAssetLoader assetLoader;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Ensure system status bar and navigation bar have dark icons on light background
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            int flags = getWindow().getDecorView().getSystemUiVisibility();
            flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            getWindow().getDecorView().setSystemUiVisibility(flags);
            getWindow().setStatusBarColor(android.graphics.Color.parseColor("#FAF7FC"));
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                getWindow().setNavigationBarColor(android.graphics.Color.parseColor("#FAF7FC"));
            }
        }

        setContentView(R.layout.activity_main);

        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout);
        webView = findViewById(R.id.webView);

        // Ensure WebView receives and handles focus for HTML input elements & soft keyboard
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.requestFocus(android.view.View.FOCUS_DOWN);
        webView.setOnTouchListener((v, event) -> {
            switch (event.getAction()) {
                case android.view.MotionEvent.ACTION_DOWN:
                case android.view.MotionEvent.ACTION_UP:
                    if (!v.hasFocus()) {
                        v.requestFocus();
                    }
                    break;
            }
            return false;
        });

        // Configure WebViewAssetLoader for secure offline asset serving
        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        // WebSettings configuration
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        // Register Native JavaScript Interface
        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidNative");

        // Custom WebViewClient
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();

                // Keep local app assets and local server inside the WebView
                if ("appassets.androidplatform.net".equals(host) ||
                    "10.0.2.2".equals(host) ||
                    "localhost".equals(host) ||
                    "127.0.0.1".equals(host)) {
                    return false;
                }

                // External links open in system default browser (Chrome)
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    Log.e(TAG, "Error opening external url", e);
                    return false;
                }
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                swipeRefreshLayout.setRefreshing(false);
                handleIntentExtras(getIntent());
            }
        });

        // WebChromeClient: Pipe console.log into Android Studio Logcat
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d("HabitWallJS", consoleMessage.message() + " -- From line "
                        + consoleMessage.lineNumber() + " of "
                        + consoleMessage.sourceId());
                return true;
            }
        });

        // Swipe-to-refresh
        swipeRefreshLayout.setColorSchemeColors(0xFF4F46E5);
        swipeRefreshLayout.setOnRefreshListener(() -> {
            webView.evaluateJavascript(
                "if (window.HabitApp) { window.HabitApp.loadDashboardData(false); } else { window.location.reload(); }",
                null
            );
            swipeRefreshLayout.postDelayed(() -> swipeRefreshLayout.setRefreshing(false), 800);
        });

        // Modern Android Back Button Dispatcher
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });

        // Load the offline bundled student studio
        // Can also point to http://10.0.2.2:5000/ when testing against local Flask server
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntentExtras(intent);
    }

    private void handleIntentExtras(Intent intent) {
        if (intent == null || webView == null) return;
        String action = intent.getAction();
        String targetScreen = intent.getStringExtra("target_screen");
        if (OnTrackWidgetProvider.ACTION_OPEN_TIMER.equals(action) || "timer".equals(targetScreen)) {
            webView.postDelayed(() -> webView.evaluateJavascript(
                "try { const m = bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-focus-timer')); if(m) m.show(); } catch(e){ console.error(e); }",
                null
            ), 500);
        }
    }

    public void requestAppPermissions() {
        runOnUiThread(() -> {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{
                        android.Manifest.permission.POST_NOTIFICATIONS
                    }, 101);
                }
            }
        });
    }

    public void setKeepScreenOn(final boolean keepOn) {
        runOnUiThread(() -> {
            if (keepOn) {
                getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                Log.d(TAG, "Screen keep-on enabled (Focus Guard active)");
            } else {
                getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                Log.d(TAG, "Screen keep-on disabled");
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}

