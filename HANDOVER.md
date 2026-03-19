# HANDOVER（開発引き継ぎ書）

## 1) プロジェクト概要

このリポジトリは 2 つのアプリで構成されています。

- `mobile_app/`: Expo SDK 54 + React Native の「ぱくぱくビデオ」
- `app.py`: Python/Tkinter のデスクトップ版動画保存ツール

主な開発対象は `mobile_app/` です。

## 2) 主要機能（モバイル）

- **WebView ブラウザ**でサイト閲覧（`react-native-webview`）
- **動画検知（Ultimate）**
  - DOM スキャン + MutationObserver
  - `HTMLMediaElement.src` setter フック
  - `play` / `load` フック
  - `document.createElement('video'|'source')` フック
  - Fetch / XHR フック（拡張子 + Content-Type）
  - MSE (`MediaSource`, `SourceBuffer.appendBuffer`) フック
- **ダウンロード**
  - 通常動画: `expo-file-system/legacy` の `createDownloadResumable`
  - HLS (`.m3u8`): `ffmpeg-kit-react-native` で結合して mp4 保存
- **UI**
  - 検知一覧モーダル（MP4/HLS バッジ）
  - ダウンロード進捗オーバーレイ（％表示）
- **状態管理**
  - 履歴 / お気に入り: AsyncStorage

## 3) 必要環境

- Node.js 18+（推奨 20 LTS）
- npm 9+
- Expo SDK 54（`expo: ~54.0.0`）
- EAS CLI（`npm install -g eas-cli`）
- iOS ビルド時は Apple Developer / App Store Connect 権限

補足:
- `mobile_app/.npmrc` に `legacy-peer-deps=true` を設定済み（EAS の `npm ci` でも依存競合を回避）
- FFmpeg の iOS 404 問題は `mobile_app/withFFmpegFix.js` で回避（コミュニティ podspec を注入）

## 4) 開発再開セットアップ

### 4-1. 初回セットアップ

```bash
cd mobile_app
npm install
```

### 4-2. ローカル起動

```bash
cd mobile_app
npm start
```

### 4-3. 開発用ビルド（Dev Client）

```bash
cd mobile_app
npm run version:bump
eas build --platform ios --profile development
eas build --platform android --profile development
```

## 5) EAS Build / TestFlight 提出手順（重要）

**必ず先にバージョンを上げること。**
同じ buildNumber で提出すると App Store Connect で拒否されます。

```bash
cd mobile_app
npm run version:bump
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

Android も同様に `versionCode` が上がるため、そのまま提出可能です。

## 6) バージョン運用ルール（再発防止）

- 自動スクリプト: `npm run version:bump`
  - `expo.version` をパッチ +1
  - `expo.ios.buildNumber` を +1
  - `expo.android.versionCode` を +1
  - `package.json` version も同期
- ルールファイル: `.cursor/rules/eas-build-version.mdc`
  - `eas build` 提案前に `version:bump` を必須化

## 7) 現在の実装状況

- WebView 動画検知ロジックは実装済み（DOM / Network / MSE / Hook 群）
- HLS 結合保存は実装済み（`downloadService.js` の FFmpeg 経路）
- iOS の FFmpeg pod 404 回避は実装済み（`withFFmpegFix.js` + `app.json` plugin）
- App Store 審査向けの用途説明文は追加済み
  - `NSCameraUsageDescription`
  - `NSMicrophoneUsageDescription`
- 現在のバージョン（2026-03 時点）
  - `expo.version`: `1.1.1`
  - `ios.buildNumber`: `3`
  - `android.versionCode`: `3`

## 8) 注意点（Expo Go / ネイティブ差分）

- **Expo Go では FFmpeg は動きません。**
  - `.m3u8` の結合保存は Dev Client / 本番ビルドでのみ動作します。
- Expo Go では通常の mp4 ダウンロード確認が中心になります。

## 9) 重要ファイル

- `mobile_app/src/utils/videoDetection.js`: WebView 注入の動画検知本体
- `mobile_app/src/screens/BrowserScreen.js`: ブラウザ UI / 検知受信 / DL 操作
- `mobile_app/src/services/downloadService.js`: 通常DL + FFmpeg HLS 結合
- `mobile_app/withFFmpegFix.js`: iOS Podfile への FFmpeg 修正注入
- `mobile_app/app.json`: Expo 設定（version/buildNumber/versionCode/plugins）
- `mobile_app/scripts/bump-version.js`: バージョン自動更新

## 10) GitHub リポジトリ

- 公開 URL: [kameking-lab/pakupakuvideo](https://github.com/kameking-lab/pakupakuvideo)
- 現時点でリモートは空リポジトリ（初回 push が必要）

