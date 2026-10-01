import SwiftUI
import WebKit

@main
struct SephoApp: App {
  var body: some Scene {
    WindowGroup {
      WebHost()
        .ignoresSafeArea()
    }
  }
}

struct WebHost: UIViewRepresentable {
  func makeUIView(context: Context) -> WKWebView {
    let uc = WKUserContentController()
    uc.add(context.coordinator, name: "sepho")
    let inject = WKUserScript(
      source: """
      window.SephoNative = {
        invoke(method, payload) {
          return new Promise((resolve, reject) => {
            const id = Date.now() + '-' + Math.random().toString(16).slice(2);
            window.__sephoNativeCb = window.__sephoNativeCb || {};
            window.__sephoNativeCb[id] = { resolve, reject };
            window.webkit.messageHandlers.sepho.postMessage({ id, method, payload: payload || null });
          });
        }
      };
      """,
      injectionTime: .atDocumentStart,
      forMainFrameOnly: true
    )
    uc.addUserScript(inject)
    let conf = WKWebViewConfiguration()
    conf.userContentController = uc
    let view = WKWebView(frame: .zero, configuration: conf)
    view.scrollView.bounces = false
    view.load(URLRequest(url: URL(string: "https://kenswidzerbrivaus.com/#/home")!))
    context.coordinator.web = view
    return view
  }

  func updateUIView(_ uiView: WKWebView, context: Context) {}

  func makeCoordinator() -> NativeBridge { NativeBridge() }
}
