import ActivityKit
import SwiftUI
import WidgetKit

struct LiveActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var title: String
    var subtitle: String?
    var timerEndDateInMilliseconds: Double?
    var progress: Double?
    var imageName: String?
    var dynamicIslandImageName: String?
  }

  var name: String
  var backgroundColor: String?
  var titleColor: String?
  var subtitleColor: String?
  var progressViewTint: String?
  var progressViewLabelColor: String?
  var deepLinkUrl: String?
  var timerType: DynamicIslandTimerType?
  var padding: Int?
  var paddingDetails: PaddingDetails?
  var imagePosition: String?
  var imageWidth: Int?
  var imageHeight: Int?
  var imageWidthPercent: Double?
  var imageHeightPercent: Double?
  var imageAlign: String?
  var contentFit: String?

  enum DynamicIslandTimerType: String, Codable {
    case circular
    case digital
  }

  struct PaddingDetails: Codable, Hashable {
    var top: Int?
    var bottom: Int?
    var left: Int?
    var right: Int?
    var vertical: Int?
    var horizontal: Int?
  }
}

struct LiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LiveActivityAttributes.self) { context in
      LiveActivityView(contentState: context.state, attributes: context.attributes)
        .activityBackgroundTint(
          context.attributes.backgroundColor.map { Color(hex: $0) }
        )
        .activitySystemActionForegroundColor(Color.black)
        .applyWidgetURL(from: context.attributes.deepLinkUrl)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading, priority: 1) {
          dynamicIslandExpandedLeading(title: context.state.title, subtitle: context.state.subtitle)
            .dynamicIsland(verticalPlacement: .belowIfTooWide)
            .padding(.leading, 6)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
        DynamicIslandExpandedRegion(.trailing) {
          if let imageName = context.state.imageName {
            dynamicIslandExpandedTrailing(imageName: imageName)
              .padding(.trailing, 6)
              .applyWidgetURL(from: context.attributes.deepLinkUrl)
          } else {
            VStack {
              Spacer()
              Image(systemName: context.state.timerEndDateInMilliseconds != nil ? "timer" : "dumbbell.fill")
                .font(.system(size: 20, weight: .semibold))
                .foregroundColor(.white)
              Spacer()
            }
            .padding(.trailing, 8)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          if let date = context.state.timerEndDateInMilliseconds {
            dynamicIslandExpandedBottom(
              endDate: date, progressViewTint: context.attributes.progressViewTint ?? "#FFFFFF"
            )
            .padding(.horizontal, 6)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
          } else if let progress = context.state.progress {
            VStack(spacing: 3) {
              ProgressView(value: progress, total: 1.0)
                .progressViewStyle(LinearProgressViewStyle(tint: Color.white))
              HStack {
                Text("\(Int(progress * 100))% ukończono")
                  .font(.system(size: 10, weight: .medium))
                  .foregroundColor(.white.opacity(0.6))
                Spacer()
                Text("IRON ROUTINE")
                  .font(.system(size: 9, weight: .bold))
                  .foregroundColor(.white.opacity(0.4))
              }
            }
            .padding(.horizontal, 6)
            .padding(.top, 4)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
          }
        }
      } compactLeading: {
        if let dynamicIslandImageName = context.state.dynamicIslandImageName {
          resizableImage(imageName: dynamicIslandImageName)
            .frame(maxWidth: 23, maxHeight: 23)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else {
          Image(systemName: context.state.timerEndDateInMilliseconds != nil ? "timer" : "dumbbell.fill")
            .font(.system(size: 12, weight: .bold))
            .foregroundColor(.white)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
      } compactTrailing: {
        if let date = context.state.timerEndDateInMilliseconds {
          compactTimer(
            endDate: date,
            timerType: context.attributes.timerType ?? .digital,
            progressViewTint: context.attributes.progressViewTint
          ).applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else if let progress = context.state.progress {
          Text("\(Int(progress * 100))%")
            .font(.system(size: 12, weight: .bold))
            .foregroundColor(.white)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else {
          Image(systemName: "figure.strengthtraining.traditional")
            .font(.system(size: 12))
            .foregroundColor(.white)
        }
      } minimal: {
        if let date = context.state.timerEndDateInMilliseconds {
          compactTimer(
            endDate: date,
            timerType: context.attributes.timerType ?? .circular,
            progressViewTint: context.attributes.progressViewTint
          ).applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else {
          Image(systemName: "dumbbell.fill")
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(.white)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
      }
    }
  }

  @ViewBuilder
  private func compactTimer(
    endDate: Double,
    timerType: LiveActivityAttributes.DynamicIslandTimerType,
    progressViewTint: String?
  ) -> some View {
    if timerType == .digital {
      let targetDate = Date(timeIntervalSince1970: endDate / 1000)
      if targetDate > Date.now {
        Text(
          timerInterval: Date.toTimerInterval(miliseconds: endDate),
          countsDown: true
        )
        .font(.system(size: 13, weight: .bold))
        .monospacedDigit()
        .minimumScaleFactor(0.8)
        .frame(minWidth: 38, maxWidth: 64, alignment: .trailing)
        .multilineTextAlignment(.trailing)
      } else {
        Text("GOTÓW")
          .font(.system(size: 11, weight: .heavy))
          .minimumScaleFactor(0.8)
          .frame(maxWidth: 60)
          .multilineTextAlignment(.trailing)
      }
    } else {
      circularTimer(endDate: endDate)
        .tint(progressViewTint.map { Color(hex: $0) })
    }
  }

  private func dynamicIslandExpandedLeading(title: String, subtitle: String?) -> some View {
    VStack(alignment: .leading) {
      Spacer()
      Text(title)
        .font(.title2)
        .foregroundStyle(.white)
        .fontWeight(.semibold)
      if let subtitle {
        Text(subtitle)
          .font(.title3)
          .minimumScaleFactor(0.8)
          .foregroundStyle(.white.opacity(0.75))
      }
      Spacer()
    }
  }

  private func dynamicIslandExpandedTrailing(imageName: String) -> some View {
    VStack {
      Spacer()
      resizableImage(imageName: imageName)
      Spacer()
    }
  }

  private func dynamicIslandExpandedBottom(endDate: Double, progressViewTint: String?) -> some View {
    let targetDate = Date(timeIntervalSince1970: endDate / 1000)
    let isTimerActive = targetDate > Date.now
    return VStack(spacing: 6) {
      HStack {
        HStack(spacing: 5) {
          Image(systemName: isTimerActive ? "timer" : "bell.badge.fill")
            .font(.system(size: 12, weight: .bold))
          Text(isTimerActive ? "Pozostała przerwa" : "Koniec przerwy!")
            .font(.system(size: 12, weight: .bold))
        }
        .foregroundStyle(.white.opacity(0.8))
        Spacer()
        if isTimerActive {
          Text(
            timerInterval: Date.toTimerInterval(miliseconds: endDate),
            countsDown: true
          )
          .font(.system(size: 14, weight: .heavy))
          .monospacedDigit()
          .frame(minWidth: 48, alignment: .trailing)
          .foregroundStyle(.white)
        } else {
          Text("SERIA!")
            .font(.system(size: 12, weight: .heavy))
            .foregroundStyle(.orange)
        }
      }

      ProgressView(
        timerInterval: Date.toTimerInterval(miliseconds: endDate),
        countsDown: true,
        label: { EmptyView() },
        currentValueLabel: { EmptyView() }
      )
      .foregroundStyle(.white)
      .tint(progressViewTint.map { Color(hex: $0) })
    }
    .padding(.top, 5)
  }

  private func circularTimer(endDate: Double) -> some View {
    ProgressView(
      timerInterval: Date.toTimerInterval(miliseconds: endDate),
      countsDown: true,
      label: { EmptyView() },
      currentValueLabel: {
        EmptyView()
      }
    )
    .progressViewStyle(.circular)
  }
}
