# ぱくぱくビデオ（Expo）

アプリ内ブラウザ（WebView）でウェブを閲覧し、ページ内の動画を検知してカメラロールに保存するアプリです。  
iOS / Android のビルド・配信は **EAS (Expo Application Services)** で行います。

## 重要: EAS Update と runtimeVersion

- このプロジェクトは **EAS Update 利用** かつ **version source が remote** です。
- **`app.json` の `runtimeVersion` に `nativeVersion` は絶対に使わないでください。**
- コード修正・アップデート設定を含め、**`{"policy": "appVersion"}` のみ**を前提に設定してください。

## Expo SDK バージョン

このプロジェクトは **Expo SDK 54** を使用しており、**Expo Go（SDK 54）** で起動できます。

## パッケージのインストール

```bash
cd mobile_app
npm install
```

### 依存関係をクリーンにして再インストールする手順

`node_modules` や `package-lock.json` を捨てて、SDK 54 互換の依存関係で一から入れ直す場合:

```bash
cd mobile_app

# 1. 既存の node_modules と lock ファイルを削除
rm -rf node_modules package-lock.json
# Windows (PowerShell) の場合:
# Remove-Item -Recurse -Force node_modules; Remove-Item -Force package-lock.json

# 2. 依存関係を再インストール
npm install

# 3. Expo が推奨するバージョンに揃える（SDK 54 互換）
npx expo install --fix
```

その後、`npm start` で起動してください。

追加で必要なパッケージ（上記で一括インストールされます）:

- `@react-navigation/native` / `@react-navigation/bottom-tabs` … ボトムタブナビゲーション
- `react-native-screens` / `react-native-safe-area-context` … ナビゲーション依存
- `react-native-webview` … アプリ内ブラウザ
- `@react-native-async-storage/async-storage` … 履歴・お気に入りの永続化

## セットアップ手順

### 1. 必要環境

- Node.js 18+
- npm または yarn
- [EAS CLI](https://docs.expo.dev/build/setup/#install-eas-cli): `npm install -g eas-cli`
- Expo アカウント（[expo.dev](https://expo.dev) で作成）

### 2. インストールと起動

```bash
cd mobile_app
npm install
npm start
```

### 3. EAS プロジェクトのリンク（初回のみ）

```bash
eas login
eas build:configure
```

## 実行方法

```bash
npm start
```

Expo Go で QR コードを読み取り動作確認できます。

### よくあるエラー

- **「Project is incompatible with this version of Expo Go」**  
  このプロジェクトは Expo SDK 55 を使用しています。スマホの **Expo Go を最新版に更新**してください（App Store / Google Play で「Expo Go」を検索し、更新）。

- **「ENOENT: no such file or directory, scandir '...assets/images'」**  
  `assets/images` フォルダが存在しない場合のエラーです。本リポジトリには `assets/images` と `.gitkeep` を含めています。別途クローンした場合は空の `assets/images` を作成してください。  
`react-native-webview` 等のネイティブモジュールは Expo Go で利用可能です。本番に近い動作は **development build** で確認してください。

## 全体のコード構成

```
mobile_app/
├── App.js                         # エントリ: NavigationContainer + AppTabs
├── app.json
├── eas.json
├── package.json
├── src/
│   ├── navigation/
│   │   └── AppTabs.js              # ボトムタブ（ブラウザ / お気に入り / 履歴）
│   ├── screens/
│   │   ├── BrowserScreen.js        # WebView + URLバー + 戻る/進む/リロード/お気に入り + 動画DL FAB
│   │   ├── FavoritesScreen.js      # お気に入り一覧（AsyncStorage）
│   │   └── HistoryScreen.js        # 履歴一覧（AsyncStorage）
│   ├── services/
│   │   ├── downloadService.js      # getContentInfo, createVideoDownload, saveVideoToLibrary
│   │   └── storageService.js       # 履歴・お気に入りの保存/読み込み/削除（AsyncStorage）
│   └── utils/
│       ├── validators.js           # sanitizeFilename 等
│       └── videoDetection.js      # injectedJavaScript でページ内動画URLを検出
└── assets/
```

## 実装している機能

| 項目 | 内容 |
|------|------|
| **画面構成** | ボトムタブ 3 本：ブラウザ / お気に入り / 履歴 |
| **アプリ内ブラウザ** | react-native-webview。URLバー、戻る/進む/リロード、お気に入り追加ボタン |
| **動画の自動検知** | injectedJavaScript で &lt;video&gt;・&lt;source&gt;・&lt;a href="*.mp4"&gt; 等を検出し postMessage で送信 |
| **ダウンロード** | 検知時に表示する FAB からダウンロード。expo-file-system（createDownloadResumable）＋ expo-media-library でカメラロールに保存 |
| **履歴** | 閲覧したページのタイトル・URLを AsyncStorage に保存。一覧表示・削除・すべて削除 |
| **お気に入り** | ブックマーク（タイトル・URL）を AsyncStorage に保存。一覧表示・削除。タップでブラウザで開く |

## EAS ビルド・配信

```bash
eas build --platform all --profile production
eas submit --platform ios --profile production   # または android
eas update --branch production --message "修正内容"
```

## アプリ設定（app.json 抜粋）

- **アプリ名**: ぱくぱくビデオ
- **iOS bundleIdentifier**: com.kamekinglab.pakupakuvideo
- **Android package**: com.kamekinglab.pakupakuvideo
- **runtimeVersion**: `{"policy": "appVersion"}` のみ（nativeVersion は使用しない）
