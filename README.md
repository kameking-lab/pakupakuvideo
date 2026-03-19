# 動画保存アプリ

動画の載ったサイトのURLから、動画ファイル（.mp4 / .webm / .mov など）を保存するアプリです。

- **スマートフォン**: ぱくぱくビデオ — Expo (React Native) アプリ（`mobile_app/`）。iOS/Android のビルド・配信は **EAS** で実施。
- **デスクトップ**: Windows/macOS/Linux 用の Python アプリ（`app.py`）

## 機能

- URL入力から動画をダウンロードして保存
- **Content-Type** が `video/*` のものだけを保存対象とする（HEAD/GETで確認）
- ストリーミング保存でメモリ消費を抑える
- 進捗バー・ファイルサイズ表示・ログ表示
- キャンセル対応
- 保存ファイル名の不正文字を自動補正
- 権利確認のチェックボックスに同意しないと開始できない

---

## スマートフォンアプリ「ぱくぱくビデオ」（Expo）

- **技術**: Expo (React Native)。ビルド・配信は **EAS (Expo Application Services)**。
- **アプリ名**: ぱくぱくビデオ
- **iOS bundle ID / Android パッケージ名**: com.kamekinglab.pakupakuvideo

### 重要: EAS Update と runtimeVersion

- このプロジェクトは **EAS Update 利用** かつ **version source が remote** です。
- **`app.json` の `runtimeVersion` に `nativeVersion` は使わず、`{"policy": "appVersion"}` のみを使用してください。

### セットアップ

```bash
cd mobile_app
npm install
```

### 実行（開発）

```bash
npm start
```

**注意**: 本アプリは **ffmpeg-kit-react-native** を使用しているため **Expo Go では HLS(m3u8) の結合・保存は動作しません**。通常の mp4 ダウンロードのみ Expo Go で試せます。HLS 結合を含む全機能を試す場合は **EAS Build で development build または production build を作成**して実機で実行してください。

### ビルド・配信（EAS）

```bash
# EAS CLI をグローバルにインストール
npm install -g eas-cli

# 重要: ビルド・提出前に必ずバージョン・ビルド番号を上げる（重複提出エラー防止）
cd mobile_app && npm run version:bump

# ビルド（本番用）
eas build --platform all --profile production

# ストア提出
eas submit --platform ios --profile production
eas submit --platform android --profile production

# OTA 更新（EAS Update）
eas update --branch production --message "修正内容"
```

詳細なセットアップ手順・プロジェクト構成・実装機能は **`mobile_app/README.md`** を参照してください。

### スマホアプリの使い方

1. **動画URL** に保存したい動画の URL（http/https）を入力する
2. **ファイル名** を指定する（例: `video.mp4`）
3. **権利確認のチェックボックス** にチェックを入れる
4. **開始** をタップしてダウンロード
5. ダウンロード後、**カメラロール（写真ライブラリ）** に自動で保存される
6. 必要に応じて **キャンセル** で中断できる

---

## デスクトップアプリ（Python）

### セットアップ

- Python 3.8 以上（3.10 以上推奨）
- 仮想環境を有効化したうえで:

```powershell
cd c:\Users\kanet\Downloads\movie
pip install -r requirements.txt
```

### 実行方法

```powershell
python app.py
```

- **動画URL** に入力 → **保存先** で「参照...」から指定 → 権利確認にチェック → **開始**

---

## 注意事項

- 動画の配布元の利用規約や著作権を守って利用してください。
- 本アプリは `Content-Type` が `video/*` の URL のみを保存対象としています。ストリーミングサイトなどで `video/*` を返さない URL は保存できません。
- ネットワークエラー・タイムアウト・権限エラー時は、ログとメッセージで表示されます。
