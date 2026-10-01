import FamilyControls
import Foundation
import ManagedSettings
import UIKit
import WebKit

final class NativeBridge: NSObject, WKScriptMessageHandler {
  weak var web: WKWebView?
  private let screen = ScreenTimeStore.shared

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    guard
      let body = message.body as? [String: Any],
      let id = body["id"] as? String,
      let method = body["method"] as? String
    else { return }
    Task { @MainActor in
      let result = await handle(method, body["payload"])
      reply(id: id, value: result)
    }
  }

  @MainActor
  private func handle(_ method: String, _ payload: Any?) async -> [String: Any] {
    switch method {
    case "authorizeScreenTime":
      do {
        try await screen.authorize()
        return ["ok": true, "authorized": true]
      } catch {
        return ["ok": false, "error": String(describing: error)]
      }
    case "pickLockedApps":
      let count = await screen.pick()
      return ["ok": true, "selection": screen.encodedSelection(), "count": count]
    case "applyAppShields":
      let dict = payload as? [String: Any]
      screen.apply(detox: dict?["detox"] as? Bool ?? false)
      return ["ok": true]
    case "clearAppShields":
      screen.clear()
      return ["ok": true]
    case "unshieldTemporarily":
      let seconds = (payload as? [String: Any])?["seconds"] as? Double ?? 1200
      screen.unshield(for: seconds)
      return ["ok": true]
    case "openURL":
      let dict = payload as? [String: Any]
      let id = dict?["id"] as? String ?? ""
      let fallback = dict?["url"] as? String ?? ""
      let candidates: [String]
      switch id {
      case "phone":
        candidates = ["mobilephone://", "tel://"]
      case "messages":
        candidates = ["messages://", "sms://"]
      default:
        candidates = [fallback]
      }
      for raw in candidates where !raw.isEmpty {
        if let url = URL(string: raw) {
          let opened = await UIApplication.shared.open(url)
          if opened { return ["ok": true] }
        }
      }
      return ["ok": false]
    case "syncLauncher":
      if let dict = payload as? [String: Any] {
        WidgetStore.save(dict)
      }
      return ["ok": true]
    case "usageStats":
      return screen.usage()
    default:
      return ["ok": false, "error": "unknown"]
    }
  }

  private func reply(id: String, value: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: value),
          let json = String(data: data, encoding: .utf8)
    else { return }
    let js = "window.__sephoNativeCb && window.__sephoNativeCb['\(id)'] && window.__sephoNativeCb['\(id)'].resolve(\(json));"
    web?.evaluateJavaScript(js, completionHandler: nil)
  }
}
