const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const POD_LINE = "  pod 'ffmpeg-kit-ios-full', :podspec => 'https://raw.githubusercontent.com/luthviar/ffmpeg-kit-ios-full/main/ffmpeg-kit-ios-full.podspec'";

/**
 * iOS Podfile に ffmpeg-kit-ios-full のコミュニティバックアップ pod を注入する。
 * use_react_native! の直前に1行追加する。
 */
function withFFmpegFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const podfilePath = path.join(projectRoot, 'ios', 'Podfile');

      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      let contents = fs.readFileSync(podfilePath, 'utf-8');

      if (contents.includes("ffmpeg-kit-ios-full") && contents.includes("luthviar")) {
        return config;
      }

      // 既存の ffmpeg-kit-ios-full 行（公式削除で 404 になるもの）を削除
      contents = contents.replace(/^\s*pod\s+['"]ffmpeg-kit-ios-full['"][^\n]*\n?/gm, '');

      const marker = 'use_react_native!';
      const idx = contents.indexOf(marker);
      if (idx === -1) {
        return config;
      }

      const insert = POD_LINE + '\n';
      contents = contents.slice(0, idx) + insert + contents.slice(idx);
      fs.writeFileSync(podfilePath, contents);

      return config;
    },
  ]);
}

module.exports = withFFmpegFix;
