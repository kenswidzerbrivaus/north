import SwiftUI
import WidgetKit

struct SephoEntry: TimelineEntry {
  let date: Date
  let items: [[String: String]]
}

struct SephoProvider: TimelineProvider {
  func placeholder(in context: Context) -> SephoEntry {
    SephoEntry(date: Date(), items: WidgetStore.items())
  }
  func getSnapshot(in context: Context, completion: @escaping (SephoEntry) -> Void) {
    completion(SephoEntry(date: Date(), items: WidgetStore.items()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<SephoEntry>) -> Void) {
    let entry = SephoEntry(date: Date(), items: WidgetStore.items())
    completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60))))
  }
}

struct SephoLauncherView: View {
  var entry: SephoEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    VStack(alignment: .center, spacing: 6) {
      if family != .systemSmall {
        Text(entry.date, style: .time)
          .font(.footnote)
          .foregroundStyle(.secondary)
        Text(entry.date, format: .dateTime.weekday(.wide).month(.wide).day())
          .font(.headline)
      }
      ForEach(Array(entry.items.prefix(family == .systemLarge ? 10 : 5).enumerated()), id: \.offset) { _, row in
        if let raw = row["scheme"], let url = URL(string: raw), let label = row["label"] {
          Link(destination: url) {
            Text(label)
              .font(.system(size: 22, weight: .medium, design: .default))
              .foregroundStyle(.primary)
              .frame(maxWidth: .infinity)
          }
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .containerBackground(for: .widget) {
      Color.black
    }
  }
}

@main
struct SephoWidgets: WidgetBundle {
  var body: some Widget {
    SephoLauncher()
  }
}

struct SephoLauncher: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SephoLauncher", provider: SephoProvider()) { entry in
      SephoLauncherView(entry: entry)
    }
    .configurationDisplayName("Sepho")
    .description("Text list of Phone, Messages, and the tools you chose.")
    .supportedFamilies([.systemMedium, .systemLarge, .systemExtraLarge])
  }
}
