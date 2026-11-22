const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Configures Android Gradle `signingConfigs.release` during Expo CNG prebuild
 * using environment variables (`ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`,
 * `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`).
 *
 * When those env vars are absent (local debug builds), it falls back gracefully to
 * the standard debug keystore so local workflows never break.
 */
module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    if (!contents.includes('ANDROID_KEYSTORE_PATH')) {
      const releaseSigningBlock = `
        release {
            def ksPath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (ksPath != null && !ksPath.isEmpty() && new File(ksPath).exists()) {
                storeFile file(ksPath)
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
                if (ksPath.endsWith(".p12") || ksPath.endsWith(".pfx")) {
                    storeType "PKCS12"
                }
            }
        }`;

      // Insert `release { ... }` inside `signingConfigs { ... }` right after `debug { ... }`
      contents = contents.replace(
        /(signingConfigs\s*\{\s*debug\s*\{[\s\S]*?\})/,
        `$1${releaseSigningBlock}`
      );

      // Use signingConfigs.release in buildTypes.release when keystore is present
      contents = contents.replace(
        /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
        `$1signingConfig (System.getenv("ANDROID_KEYSTORE_PATH") ? signingConfigs.release : signingConfigs.debug)`
      );

      mod.modResults.contents = contents;
    }

    return mod;
  });
};
