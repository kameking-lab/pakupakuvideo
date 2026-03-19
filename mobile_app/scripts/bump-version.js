#!/usr/bin/env node
/**
 * app.json のバージョン・ビルド番号をインクリメントする。
 * EAS ビルド・App Store / Play 提出前に実行し、重複提出エラーを防ぐ。
 *
 * - expo.version: パッチを +1（例: 1.1.0 → 1.1.1）
 * - expo.ios.buildNumber: +1（例: "2" → "3"）
 * - expo.android.versionCode: +1（例: 2 → 3）
 * - package.json の version を expo.version に合わせる
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const appJsonPath = path.join(root, 'app.json');
const packageJsonPath = path.join(root, 'package.json');

const app = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// semver パッチアップ (1.1.0 -> 1.1.1)
const [major, minor, patch] = (app.expo.version || '1.0.0').split('.').map(Number);
const newVersion = `${major}.${minor}.${patch + 1}`;
app.expo.version = newVersion;

// iOS buildNumber
if (app.expo.ios) {
  const current = app.expo.ios.buildNumber || '1';
  app.expo.ios.buildNumber = String(parseInt(current, 10) + 1);
} else {
  app.expo.ios = { buildNumber: '1' };
}

// Android versionCode
if (app.expo.android) {
  app.expo.android.versionCode = (app.expo.android.versionCode || 1) + 1;
} else {
  app.expo.android = { versionCode: 1 };
}

pkg.version = newVersion;

fs.writeFileSync(appJsonPath, JSON.stringify(app, null, 2) + '\n');
fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');

console.log('Bumped:', {
  version: newVersion,
  iosBuildNumber: app.expo.ios.buildNumber,
  androidVersionCode: app.expo.android.versionCode,
});
