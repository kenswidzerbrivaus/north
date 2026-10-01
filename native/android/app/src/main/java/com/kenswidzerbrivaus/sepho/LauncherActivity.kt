package com.kenswidzerbrivaus.sepho

import android.app.Activity
import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Process
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject

class LauncherActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val web = WebView(this)
    web.settings.javaScriptEnabled = true
    web.settings.domStorageEnabled = true
    web.addJavascriptInterface(Bridge(this), "SephoAndroid")
    web.webViewClient = object : WebViewClient() {
      override fun onPageFinished(view: WebView?, url: String?) {
        view?.evaluateJavascript(
          """
          window.SephoNative = {
            invoke(method, payload) {
              const raw = window.SephoAndroid.invoke(method, JSON.stringify(payload || {}));
              return Promise.resolve(JSON.parse(raw));
            }
          };
          """.trimIndent(),
          null
        )
      }
    }
    web.loadUrl("https://kenswidzerbrivaus.com/#/home")
    setContentView(web)
  }

  class Bridge(private val ctx: Context) {
    @JavascriptInterface
    fun invoke(method: String, payload: String): String {
      return when (method) {
        "openURL" -> {
          val url = JSONObject(payload).optString("url")
          val id = JSONObject(payload).optString("id")
          val intent = when (id) {
            "phone" -> Intent(Intent.ACTION_DIAL)
            "messages" -> Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_APP_MESSAGING)
            else -> Intent(Intent.ACTION_VIEW, Uri.parse(url))
          }
          intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          ctx.startActivity(intent)
          """{"ok":true}"""
        }
        "requestLauncher" -> {
          ctx.startActivity(Intent(Settings.ACTION_HOME_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
          """{"ok":true}"""
        }
        "usageStats" -> usageJson()
        "authorizeScreenTime" -> {
          ctx.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
          """{"ok":true,"authorized":true}"""
        }
        "applyAppShields", "clearAppShields", "unshieldTemporarily", "syncLauncher" -> """{"ok":true}"""
        else -> """{"ok":false}"""
      }
    }

    private fun usageJson(): String {
      val appOps = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
      if (mode != AppOpsManager.MODE_ALLOWED) return """{"ok":false,"essentialMin":0,"otherMin":0}"""
      val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val end = System.currentTimeMillis()
      val start = end - 24L * 60 * 60 * 1000
      val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end) ?: return """{"ok":true,"essentialMin":0,"otherMin":0}"""
      var other = 0L
      for (s in stats) other += s.totalTimeInForeground
      val otherMin = (other / 60000L).toInt()
      return """{"ok":true,"essentialMin":0,"otherMin":$otherMin}"""
    }
  }
}
