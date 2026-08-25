# Keep the JavaScript bridge methods that are invoked from the trusted WebView.
-keepclassmembers class ai.lokin.location.LokinLocationBridge {
    @android.webkit.JavascriptInterface <methods>;
}
