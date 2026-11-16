internal import Expo
import React
import ReactAppDependencyProvider
import UIKit
#if canImport(AppIntents)
import AppIntents
#endif

@main
class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    // The window is created and React Native is started by `SceneDelegate` under the
    // scene-based life cycle (required by the iOS 27 SDK).
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

#if canImport(AppIntents)
@available(iOS 16.0, *)
struct StartWorkoutIntent: AppIntent {
  static var title: LocalizedStringResource = "Start a workout"
  static var description = IntentDescription("Opens Iron Routine and starts today's workout session.")
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    if let url = URL(string: "ironroutine://start-workout") {
      await UIApplication.shared.open(url)
    }
    return .result()
  }
}

@available(iOS 16.0, *)
struct OpenWorkoutPlanIntent: AppIntent {
  static var title: LocalizedStringResource = "Open workout plan"
  static var description = IntentDescription("Opens the weekly training plan in Iron Routine.")
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    if let url = URL(string: "ironroutine://open-plan") {
      await UIApplication.shared.open(url)
    }
    return .result()
  }
}

@available(iOS 16.0, *)
struct OpenProgressIntent: AppIntent {
  static var title: LocalizedStringResource = "Show fitness progress"
  static var description = IntentDescription("Opens your physique rank and strength progress in Iron Routine.")
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    if let url = URL(string: "ironroutine://open-progress") {
      await UIApplication.shared.open(url)
    }
    return .result()
  }
}

@available(iOS 16.0, *)
struct LogBodyWeightIntent: AppIntent {
  static var title: LocalizedStringResource = "Log body weight"
  static var description = IntentDescription("Opens the body weight logger in Iron Routine.")
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    if let url = URL(string: "ironroutine://log-weight") {
      await UIApplication.shared.open(url)
    }
    return .result()
  }
}

@available(iOS 16.0, *)
struct SyncCalendarIntent: AppIntent {
  static var title: LocalizedStringResource = "Sync gym calendar"
  static var description = IntentDescription("Syncs your upcoming gym sessions to Apple Calendar and Reminders.")
  static var openAppWhenRun: Bool = true

  @MainActor
  func perform() async throws -> some IntentResult {
    if let url = URL(string: "ironroutine://sync-calendar") {
      await UIApplication.shared.open(url)
    }
    return .result()
  }
}

@available(iOS 16.0, *)
struct IronRoutineAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: StartWorkoutIntent(),
      phrases: [
        "Start a workout in \(.applicationName)",
        "Start workout in \(.applicationName)",
        "Begin training in \(.applicationName)",
        "Rozpocznij trening w \(.applicationName)"
      ],
      shortTitle: "Start a workout",
      systemImageName: "dumbbell.fill"
    )
    AppShortcut(
      intent: OpenWorkoutPlanIntent(),
      phrases: [
        "Open my plan in \(.applicationName)",
        "Show workout plan in \(.applicationName)",
        "Pokaz plan w \(.applicationName)"
      ],
      shortTitle: "Workout Plan",
      systemImageName: "calendar"
    )
    AppShortcut(
      intent: OpenProgressIntent(),
      phrases: [
        "Show my progress in \(.applicationName)",
        "Check my rank in \(.applicationName)",
        "Pokaz osiagi w \(.applicationName)"
      ],
      shortTitle: "Progress & Rank",
      systemImageName: "chart.line.uptrend.xyaxis"
    )
    AppShortcut(
      intent: LogBodyWeightIntent(),
      phrases: [
        "Log my weight in \(.applicationName)",
        "Zapisz wage w \(.applicationName)"
      ],
      shortTitle: "Log Weight",
      systemImageName: "scalemass.fill"
    )
    AppShortcut(
      intent: SyncCalendarIntent(),
      phrases: [
        "Sync workouts in \(.applicationName)",
        "Schedule gym in \(.applicationName)"
      ],
      shortTitle: "Sync Calendar",
      systemImageName: "calendar.badge.plus"
    )
  }
}
#endif
