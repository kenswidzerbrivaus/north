import DeviceActivity
import Foundation
import ManagedSettings

class SephoMonitor: DeviceActivityMonitor {
  let store = ManagedSettingsStore(named: .init("sepho"))

  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    // Schedules from Sepho Focus profiles apply the stored shield selection.
  }

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    store.clearAllSettings()
  }
}
