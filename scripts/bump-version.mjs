#!/usr/bin/env node
/**
 * Atomic Semantic Versioning bumper for Iron Routine.
 * Usage:
 *   node scripts/bump-version.mjs patch   # 3.1.0 -> 3.1.1
 *   node scripts/bump-version.mjs minor   # 3.1.0 -> 3.2.0
 *   node scripts/bump-version.mjs major   # 3.1.0 -> 4.0.0
 *   node scripts/bump-version.mjs 3.1.0   # explicit SemVer
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const arg = process.argv[2];

if (!arg) {
  console.error('Usage: node scripts/bump-version.mjs <patch|minor|major|X.Y.Z>');
  process.exit(1);
}

const pkgPath = path.join(ROOT, 'package.json');
const appJsonPath = path.join(ROOT, 'app.json');
const plistPath = path.join(ROOT, 'ios/IronRoutine/Info.plist');
const pbxprojPath = path.join(ROOT, 'ios/IronRoutine.xcodeproj/project.pbxproj');
const webContentPath = path.join(ROOT, 'website/src/data/websiteContent.ts');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

const current = String(pkg.version || '3.0.0');
const match = current.match(/^(\d+)\.(\d+)\.(\d+)$/);
if (!match) {
  console.error(`Current package.json version "${current}" is not valid SemVer.`);
  process.exit(1);
}

let [major, minor, patch] = match.slice(1).map(Number);
let nextVersion = '';

if (arg === 'patch') {
  nextVersion = `${major}.${minor}.${patch + 1}`;
} else if (arg === 'minor') {
  nextVersion = `${major}.${minor + 1}.0`;
} else if (arg === 'major') {
  nextVersion = `${major + 1}.0.0`;
} else if (/^\d+\.\d+\.\d+$/.test(arg)) {
  nextVersion = arg;
} else {
  console.error(`Invalid argument "${arg}". Use patch, minor, major, or X.Y.Z.`);
  process.exit(1);
}

const currentBuildNum = Math.max(
  parseInt(appJson.expo?.ios?.buildNumber || '1', 10) || 1,
  1
);
const nextBuildNum = String(currentBuildNum + 1);
const currentAndroidCode = Number(appJson.expo?.android?.versionCode || 1) || 1;
const nextAndroidCode = currentAndroidCode + 1;

// 1. package.json
pkg.version = nextVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// 2. app.json
appJson.expo.version = nextVersion;
if (appJson.expo.ios) {
  appJson.expo.ios.buildNumber = nextBuildNum;
}
if (appJson.expo.android) {
  appJson.expo.android.versionCode = nextAndroidCode;
}
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');

// 3. ios/IronRoutine/Info.plist
if (fs.existsSync(plistPath)) {
  let plist = fs.readFileSync(plistPath, 'utf8');
  plist = plist.replace(
    /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]+(<\/string>)/,
    `$1${nextVersion}$2`
  );
  plist = plist.replace(
    /(<key>CFBundleVersion<\/key>\s*<string>)[^<]+(<\/string>)/,
    `$1${nextBuildNum}$2`
  );
  fs.writeFileSync(plistPath, plist);
}

// 4. ios/IronRoutine.xcodeproj/project.pbxproj
if (fs.existsSync(pbxprojPath)) {
  let pbx = fs.readFileSync(pbxprojPath, 'utf8');
  pbx = pbx.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${nextVersion};`);
  pbx = pbx.replace(
    /CURRENT_PROJECT_VERSION = [^;]+;/g,
    `CURRENT_PROJECT_VERSION = ${nextBuildNum};`
  );
  fs.writeFileSync(pbxprojPath, pbx);
}

// 5. website/src/data/websiteContent.ts
if (fs.existsSync(webContentPath)) {
  let web = fs.readFileSync(webContentPath, 'utf8');
  web = web.replace(
    /export const APP_VERSION = 'v[^']+';/,
    `export const APP_VERSION = 'v${nextVersion}';`
  );
  web = web.replace(
    /Iron Routine v\d+\.\d+\.\d+/g,
    `Iron Routine v${nextVersion}`
  );
  fs.writeFileSync(webContentPath, web);
}

console.log(
  `✅ Synced Iron Routine version: ${current} -> ${nextVersion} (iOS build ${nextBuildNum}, Android versionCode ${nextAndroidCode})`
);
