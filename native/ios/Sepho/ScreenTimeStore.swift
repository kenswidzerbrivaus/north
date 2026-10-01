import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings
import SwiftUI
import UIKit

@MainActor
final class ScreenTimeStore: ObservableObject {
  static let shared = ScreenTimeStore()
  let center = AuthorizationCenter.shared
  let settings = ManagedSettingsStore(named: .init("sepho"))
  @Published var selection = FamilyActivitySelection()
  private var restoreTask: Task<Void, Never>?

  func authorize() async throws {
    try await center.requestAuthorization(for: .individual)
  }

  /// Presents FamilyActivityPicker from the key window.
  func pick() async -> Int {
    await withCheckedContinuation { cont in
      var resumed = false
      weak var hostRef: UIViewController?
      let finish: () -> Void = {
        guard !resumed else { return }
        resumed = true
        hostRef?.dismiss(animated: true)
        cont.resume(returning: self.selection.applicationTokens.count + self.selection.categoryTokens.count)
      }
      let picker = FamilyActivityPickerHost(selection: Binding(
        get: { self.selection },
        set: { self.selection = $0 }
      ), onDone: finish)
      let host = UIHostingController(rootView: picker)
      host.modalPresentationStyle = .formSheet
      hostRef = host
      let root = UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .flatMap { $0.windows }
        .first { $0.isKeyWindow }?
        .rootViewController
      if let root {
        root.present(host, animated: true)
      } else {
        finish()
      }
    }
  }

  func encodedSelection() -> String {
    (try? JSONEncoder().encode(selection)).map { $0.base64EncodedString() } ?? ""
  }

  func apply(detox: Bool) {
    if detox {
      settings.shield.applicationCategories = .all()
    } else {
      settings.shield.applications = selection.applicationTokens
      settings.shield.applicationCategories = .specific(selection.categoryTokens)
    }
  }

  func clear() {
    settings.clearAllSettings()
  }

  func unshield(for seconds: TimeInterval) {
    settings.clearAllSettings()
    restoreTask?.cancel()
    restoreTask = Task { [weak self] in
      try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
      guard !Task.isCancelled else { return }
      self?.apply(detox: false)
    }
  }

  func usage() -> [String: Any] {
    ["ok": true, "essentialMin": 0, "otherMin": 0]
  }
}

private struct FamilyActivityPickerHost: View {
  @Binding var selection: FamilyActivitySelection
  var onDone: () -> Void
  var body: some View {
    NavigationStack {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle("Apps to lock")
        .toolbar {
          ToolbarItem(placement: .confirmationAction) {
            Button("Done") { onDone() }
          }
        }
    }
  }
}
