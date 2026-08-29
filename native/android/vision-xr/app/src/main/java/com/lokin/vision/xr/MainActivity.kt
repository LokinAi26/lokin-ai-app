package com.lokin.vision.xr

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.xr.projected.ProjectedContext
import androidx.xr.projected.experimental.ExperimentalProjectedApi

@OptIn(ExperimentalProjectedApi::class)
class MainActivity : ComponentActivity() {
    companion object {
        private const val LOKIN_HOST = "lokin-ai-app-604c3139.base44.app"
        private const val VISION_BRIDGE_URL = "https://$LOKIN_HOST/vision-bridge?native=xr"
    }

    private lateinit var webView: WebView
    private var xrBridge: LokinVisionXrBridge? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.setSupportMultipleWindows(false)
            settings.userAgentString = "${settings.userAgentString} LOKINVisionXR/0.1"
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val uri = request?.url ?: return true
                    if (uri.scheme == "https" && uri.host.equals(LOKIN_HOST, ignoreCase = true)) return false
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                    return true
                }
            }
        }

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        xrBridge = LokinVisionXrBridge(
            webView = webView,
            allowedHost = LOKIN_HOST,
            launchProjectedActivity = ::launchProjectedActivity
        ).also { bridge ->
            webView.addJavascriptInterface(bridge, "LokinVisionXR")
        }

        setContentView(webView)
        if (savedInstanceState == null) webView.loadUrl(VISION_BRIDGE_URL)
        else webView.restoreState(savedInstanceState)
    }

    override fun onResume() {
        super.onResume()
        xrBridge?.emitCurrentState()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.removeJavascriptInterface("LokinVisionXR")
            webView.stopLoading()
            webView.destroy()
        }
        xrBridge?.destroy()
        xrBridge = null
        super.onDestroy()
    }

    private fun launchProjectedActivity() {
        runCatching {
            LokinVisionXrState.update(false, "launching")
            val options = ProjectedContext.createProjectedActivityOptions(this)
            val intent = Intent(this, ProjectedMainActivity::class.java)
            startActivity(intent, options.toBundle())
        }.onFailure { error ->
            val message = error.message ?: error.javaClass.simpleName
            LokinVisionXrState.update(false, "error", message)
            Toast.makeText(this, "Display Glasses not connected: $message", Toast.LENGTH_LONG).show()
        }
    }
}
