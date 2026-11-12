# 🏋️‍♂️ Iron Routine

> **Minimalist, Monochromatic iOS Workout & Strength Progress Tracker**  
> Built with Expo (React Native), TypeScript, and native iOS toolchains. Engineered for 100% offline, standalone execution without paid developer subscriptions.

---

## ✨ Features

- **🌓 Dual Monochromatic Theme**: Pure minimalist black & white palette (Light mode default + Dark mode) with an instant header toggle.
- **⏱️ Guided Active Workout Mode**: Step-by-step guided routines, sets logger, rest countdown timer with haptic alerts, and next-exercise previews.
- **🔒 Tactile Hold-to-Start Button**: Animated press-and-hold activation with smooth progress filling and haptic pulses.
- **📈 Personal Records & 1RM Tracker (Osiągi)**: Dedicated metrics dashboard with automatic 1-Rep Max estimation (Epley formula), search, muscle category filters, and chronological logs.
- **📅 Weekly Routine & Technique Guides**: Expandable exercises featuring high-definition demonstration photography, technical execution cues, and coaching tips.
- **👤 Multi-Profile Support**: Multi-user switching with completely independent PR histories and workout progression.
- **📱 100% Offline & Standalone**: Runs independently on physical iOS devices without Metro bundler, computer tethering, or Expo Go.

---

## 🛠️ Tech Stack

- **Framework**: [Expo SDK 58](https://expo.dev) / [React Native 0.88](https://reactnative.dev)
- **Language**: TypeScript 5+
- **Storage**: `@react-native-async-storage/async-storage`
- **Haptics**: `expo-haptics`
- **Native Platform**: iOS (Xcode 16 / iOS 17+)
- **Deployment**: Local sideloading pipeline via `devicectl` & `xcodebuild`

---

## 🚀 Getting Started

### Prerequisites

- macOS with [Xcode](https://developer.apple.com/xcode/) installed
- [Node.js](https://nodejs.org/) (v18+)
- CocoaPods (`brew install cocoapods`)
- An iPhone connected via USB (with Developer Mode enabled)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/matiqueue/iron-routine.git
   cd iron-routine
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```
   *(Running `npm install` will automatically generate a starter workout plan configuration in `src/data/myPlan.ts` from the provided template).*

3. **Configure Your Personal Routine**:
   Customize your weekly split and exercises in `src/data/myPlan.ts`:
   ```bash
   # src/data/myPlan.ts is automatically git-ignored to keep your routine private
   ```

4. **Deploy directly to your connected iPhone**:
   ```bash
   npm run deploy
   ```
   This will compile the native iOS Release build, sign it with your local Apple Development certificate, and install it to your iPhone.

---

## 📁 Project Structure

```
iron-routine/
├── assets/                  # App icons and splash screen assets
├── ios/                     # Native Xcode workspace and Pods
├── scripts/
│   └── deploy.sh            # Automated compilation, signing & installation script
├── src/
│   ├── components/
│   │   ├── ActiveWorkoutView.tsx    # Guided active workout mode
│   │   ├── ExerciseDetailModal.tsx  # Exercise photo & technique modal
│   │   ├── HoldToStartButton.tsx    # Tactile hold-to-start button
│   │   ├── PlanTab.tsx              # Weekly plan schedule
│   │   ├── ProfileSelectorModal.tsx # Multi-profile manager
│   │   ├── ProgressTab.tsx          # PRs, 1RM calculator & history
│   │   ├── RestTimerBar.tsx         # Floating rest countdown timer
│   │   ├── SplashScreen.tsx         # Monochromatic startup animation
│   │   └── WorkoutSummaryModal.tsx  # Workout completion celebration
│   ├── constants/
│   │   └── theme.ts                 # Monochromatic Light & Dark theme definitions
│   ├── context/
│   │   └── ThemeContext.tsx         # Persistent theme provider
│   ├── data/
│   │   ├── myPlan.template.ts       # Public template for workout splits
│   │   ├── myPlan.ts                # Private local workout configuration (gitignored)
│   │   └── planData.ts              # Plan loader & helper utilities
│   ├── services/
│   │   └── storage.ts               # Local persistence & 1RM Epley calculation
│   └── types/
│       └── workout.ts               # TypeScript data definitions
├── App.tsx                  # Root application entry
└── package.json
```

---

## 📜 License

MIT License. Designed and maintained by [Szymon Góral](https://github.com/matiqueue).
