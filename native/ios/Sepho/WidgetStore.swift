import Foundation
import WidgetKit

enum WidgetStore {
  static let suite = "group.com.kenswidzerbrivaus.sepho"
  static let key = "launcher"

  static func save(_ payload: [String: Any]) {
    let defaults = UserDefaults(suiteName: suite)
    if let data = try? JSONSerialization.data(withJSONObject: payload) {
      defaults?.set(data, forKey: key)
    }
    WidgetCenter.shared.reloadAllTimelines()
  }

  static func items() -> [[String: String]] {
    let defaults = UserDefaults(suiteName: suite)
    guard let data = defaults?.data(forKey: key),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let items = obj["items"] as? [[String: Any]]
    else {
      return [
        ["label": "Phone", "scheme": "mobilephone://"],
        ["label": "Messages", "scheme": "messages://"],
        ["label": "Today", "scheme": "https://kenswidzerbrivaus.com/#/today"],
      ]
    }
    return items.map { row in
      [
        "label": row["label"] as? String ?? "",
        "scheme": row["scheme"] as? String ?? "",
      ]
    }
  }
}
