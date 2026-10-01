# Sepho native phone layer

The website cannot replace SpringBoard. This folder is the native Sepho app: iOS Screen Time + home widgets, Android default launcher + Usage Stats.

Phone.app and Messages.app are opened as those apps. Locks and detox apply `ManagedSettings` shields (iOS) or overlay/usage blocking (Android). Weather on the widget uses WeatherKit when signed in; the web home still uses Open-Meteo.

## iOS (Xcode)

Apple does not allow a third-party process to become SpringBoard. Sepho matches the working iPhone pattern:

1. WidgetKit text launcher on page 1
2. Hide other home pages and the icon grid
3. Family Controls / Managed Settings to shield apps (same Screen Time API)
4. Shield button opens Sepho for the ritual, then unshields for a short window

Needs **Xcode** (this Mac currently has only Command Line Tools) and an Apple Developer team.

1. Install Xcode from the App Store, then `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
2. Open `native/ios/Sepho.xcodeproj` (or create an app target named Sepho, bundle `com.kenswidzerbrivaus.sepho`, and add every Swift file in `native/ios/`)
3. Capabilities: App Groups `group.com.kenswidzerbrivaus.sepho`, Family Controls (request at https://developer.apple.com/contact/request/family-controls-distribution)
4. Add extensions: SephoWidget (WidgetKit), SephoShield (ShieldConfiguration), SephoMonitor (DeviceActivityMonitor)
5. Run on the iPhone. Grant Screen Time. Add the widgets. Hide extra pages.

`SephoApp.swift` loads https://kenswidzerbrivaus.com in a WKWebView and exposes `webkit.messageHandlers.sepho`.

## Android

1. Open `native/android` in Android Studio
2. Build the debug APK
3. On the phone: set Sepho as Home app, grant Usage access

`MAIN`/`HOME`/`DEFAULT` in the manifest makes Sepho a real launcher. `UsageStatsManager` fills essential vs other minutes.
