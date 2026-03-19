"""
動画URLから動画ファイルを保存するデスクトップアプリケーション

対応拡張子の例: .mp4 .webm .mov
HEAD/GETでContent-Typeがvideo/*の場合のみ保存対象とする。
ストリーミング保存でメモリ消費を抑える。
"""

from __future__ import annotations

import os
import re
import threading
from typing import Callable, Optional
from urllib.parse import urlparse

import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext, ttk

# requests はストリーミング・タイムアウト・HEADが扱いやすいため使用
import requests
from requests.exceptions import RequestException, Timeout

# --- 定数 ---
SUPPORTED_VIDEO_EXTENSIONS = (".mp4", ".webm", ".mov")
VIDEO_CONTENT_TYPE_PREFIX = "video/"
REQUEST_TIMEOUT_SEC = 30
CHUNK_SIZE = 8192
# ファイル名に使えない文字（Windows / 汎用）
INVALID_FILENAME_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def validate_url(url: str) -> bool:
    """
    入力された文字列が有効なURL形式かどうかを判定する。

    Args:
        url: 検証するURL文字列

    Returns:
        True なら有効なURL形式
    """
    if not url or not url.strip():
        return False
    try:
        result = urlparse(url.strip())
        return bool(result.scheme in ("http", "https") and result.netloc)
    except Exception:
        return False


def sanitize_filename(name: str) -> str:
    """
    ファイル名として不正な文字を除去・置換する。
    空になった場合は 'video' のようなデフォルト名を返す。

    Args:
        name: 元のファイル名（パス含む場合は basename を渡す想定）

    Returns:
        安全なファイル名
    """
    if not name or not name.strip():
        return "video"
    # パス区切りが含まれている場合は最後の部分だけ使う
    base = os.path.basename(name.strip())
    # 不正な文字をアンダースコアに置換
    safe = INVALID_FILENAME_CHARS.sub("_", base)
    # 連続するアンダースコアや前後の空白を整理
    safe = re.sub(r"_+", "_", safe).strip("_ .")
    return safe if safe else "video"


def get_content_info(url: str) -> tuple[Optional[str], Optional[int], Optional[str]]:
    """
    HEADリクエストでContent-TypeとContent-Lengthを取得する。
    HEADが使えない場合はGETで先頭だけ取得して判定する。

    Args:
        url: 動画URL

    Returns:
        (content_type, content_length, final_url) のタプル。
        取得できない項目は None。
        通信エラー時は (None, None, None) を返す。
    """
    headers = {"User-Agent": "VideoDownloader/1.0"}
    try:
        # まずHEADを試す
        resp = requests.head(url, headers=headers, timeout=REQUEST_TIMEOUT_SEC, allow_redirects=True)
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type")
        if content_type:
            content_type = content_type.split(";")[0].strip().lower()
        content_length = resp.headers.get("Content-Length")
        length = int(content_length) if content_length is not None and content_length.isdigit() else None
        return (content_type, length, resp.url)
    except (RequestException, Timeout, ValueError) as e:
        # HEADが405等で失敗する場合、GETで先頭だけ取得
        try:
            resp = requests.get(
                url,
                headers=headers,
                timeout=REQUEST_TIMEOUT_SEC,
                stream=True,
                allow_redirects=True,
            )
            resp.raise_for_status()
            content_type = resp.headers.get("Content-Type")
            if content_type:
                content_type = content_type.split(";")[0].strip().lower()
            content_length = resp.headers.get("Content-Length")
            length = int(content_length) if content_length is not None and content_length.isdigit() else None
            return (content_type, length, resp.url)
        except (RequestException, Timeout, ValueError):
            return (None, None, None)


def is_video_content_type(content_type: Optional[str]) -> bool:
    """Content-Typeが video/* かどうかを判定する。"""
    return bool(content_type and content_type.lower().startswith(VIDEO_CONTENT_TYPE_PREFIX))


def format_size(size_bytes: Optional[int]) -> str:
    """バイト数を人間が読みやすいサイズ表記に変換する。"""
    if size_bytes is None:
        return "不明"
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    if size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"


def download_video_stream(
    url: str,
    save_path: str,
    progress_callback: Optional[Callable[[int, Optional[int]], None]],
    cancel_event: threading.Event,
) -> tuple[bool, str]:
    """
    ストリーミングで動画をダウンロードし、指定パスに保存する。

    Args:
        url: 動画URL
        save_path: 保存先フルパス
        progress_callback: (current_bytes, total_bytes or None) で進捗を通知するコールバック
        cancel_event: このEventがsetされるとダウンロードを中断する

    Returns:
        (成功したか, メッセージ)
    """
    try:
        headers = {"User-Agent": "VideoDownloader/1.0"}
        resp = requests.get(
            url,
            headers=headers,
            timeout=REQUEST_TIMEOUT_SEC,
            stream=True,
            allow_redirects=True,
        )
        resp.raise_for_status()
    except Timeout:
        return (False, "接続がタイムアウトしました。")
    except RequestException as e:
        return (False, f"通信エラー: {e!s}")
    except Exception as e:
        return (False, f"予期しないエラー: {e!s}")

    total = resp.headers.get("Content-Length")
    total_bytes = int(total) if total is not None and total.isdigit() else None

    try:
        downloaded = 0
        with open(save_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=CHUNK_SIZE):
                if cancel_event.is_set():
                    f.flush()
                    if os.path.exists(save_path):
                        try:
                            os.remove(save_path)
                        except OSError:
                            pass
                    return (False, "ユーザーによりキャンセルされました。")
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if progress_callback:
                        progress_callback(downloaded, total_bytes)
        return (True, "保存が完了しました。")
    except PermissionError:
        if os.path.exists(save_path):
            try:
                os.remove(save_path)
            except OSError:
                pass
        return (False, "保存先への書き込み権限がありません。")
    except OSError as e:
        if os.path.exists(save_path):
            try:
                os.remove(save_path)
            except OSError:
                pass
        return (False, f"ファイル保存エラー: {e!s}")
    except Exception as e:
        if os.path.exists(save_path):
            try:
                os.remove(save_path)
            except OSError:
                pass
        return (False, f"予期しないエラー: {e!s}")


class VideoDownloaderApp:
    """メインのGUIアプリケーションクラス。"""

    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title("動画保存アプリ")
        self.root.geometry("700x520")
        self.root.minsize(500, 400)

        # キャンセル用イベント（スレッド間で共有）
        self.cancel_event: Optional[threading.Event] = None
        self.download_thread: Optional[threading.Thread] = None

        self._build_ui()

    def _build_ui(self) -> None:
        """GUIのウィジェットを配置する。"""
        main = ttk.Frame(self.root, padding=10)
        main.pack(fill=tk.BOTH, expand=True)

        # --- URL入力 ---
        ttk.Label(main, text="動画URL:").pack(anchor=tk.W)
        self.url_var = tk.StringVar()
        self.url_entry = ttk.Entry(main, textvariable=self.url_var, width=70)
        self.url_entry.pack(fill=tk.X, pady=(0, 8))

        # --- 保存先 ---
        path_frame = ttk.Frame(main)
        path_frame.pack(fill=tk.X, pady=(0, 8))
        ttk.Label(path_frame, text="保存先:").pack(anchor=tk.W)
        self.save_path_var = tk.StringVar()
        self.path_entry = ttk.Entry(path_frame, textvariable=self.save_path_var, width=55)
        self.path_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 4))
        self.browse_btn = ttk.Button(path_frame, text="参照...", command=self._on_browse)
        self.browse_btn.pack(side=tk.RIGHT)

        # --- ファイルサイズ表示 ---
        self.size_label = ttk.Label(main, text="ファイルサイズ: ---")
        self.size_label.pack(anchor=tk.W, pady=(0, 4))

        # --- 同意チェックボックス ---
        self.agree_var = tk.BooleanVar(value=False)
        self.agree_cb = ttk.Checkbutton(
            main,
            text="私はこの動画を保存する権利を有している、または配布元が保存を明示的に許可していることを確認しました",
            variable=self.agree_var,
            command=self._update_start_button_state,
        )
        self.agree_cb.pack(anchor=tk.W, pady=(0, 8))

        # --- ボタン ---
        btn_frame = ttk.Frame(main)
        btn_frame.pack(fill=tk.X, pady=(0, 8))
        self.start_btn = ttk.Button(btn_frame, text="開始", command=self._on_start)
        self.start_btn.pack(side=tk.LEFT, padx=(0, 8))
        self.cancel_btn = ttk.Button(btn_frame, text="キャンセル", command=self._on_cancel, state=tk.DISABLED)
        self.cancel_btn.pack(side=tk.LEFT)

        # --- 進捗バー ---
        ttk.Label(main, text="進捗:").pack(anchor=tk.W)
        self.progress_var = tk.DoubleVar(value=0.0)
        self.progress_bar = ttk.Progressbar(
            main, variable=self.progress_var, maximum=100.0, mode="determinate"
        )
        self.progress_bar.pack(fill=tk.X, pady=(0, 8))

        # --- ログ ---
        ttk.Label(main, text="ログ:").pack(anchor=tk.W)
        self.log_text = scrolledtext.ScrolledText(main, height=12, state=tk.DISABLED, wrap=tk.WORD)
        self.log_text.pack(fill=tk.BOTH, expand=True, pady=(0, 4))

        self._update_start_button_state()

    def _log(self, message: str) -> None:
        """ログ欄にメッセージを追加する（メインスレッドから呼ぶこと）。"""
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def _update_start_button_state(self) -> None:
        """同意チェックに応じて開始ボタンの有効/無効を切り替える。"""
        if self.agree_var.get():
            self.start_btn.configure(state=tk.NORMAL)
        else:
            self.start_btn.configure(state=tk.DISABLED)

    def _on_browse(self) -> None:
        """保存先をファイルダイアログで選択する。"""
        path = filedialog.asksaveasfilename(
            title="保存先を選択",
            defaultextension=".mp4",
            filetypes=[
                ("動画ファイル", "*.mp4 *.webm *.mov"),
                ("MP4", "*.mp4"),
                ("WebM", "*.webm"),
                ("MOV", "*.mov"),
                ("すべて", "*.*"),
            ],
        )
        if path:
            self.save_path_var.set(path)

    def _progress_callback(self, current: int, total: Optional[int]) -> None:
        """ダウンロードスレッドから進捗を受け取り、プログレスバーを更新する。"""
        def update():
            if total is not None and total > 0:
                pct = min(100.0, (current / total) * 100.0)
                self.progress_var.set(pct)
            else:
                # サイズ不明の場合は indeterminate のように見せる（0〜100をループはしないので、とりあえず50で止める等も可）
                self.progress_var.set(50.0)
        self.root.after(0, update)

    def _on_start(self) -> None:
        """開始ボタン: バリデーション → Content-Type確認 → ダウンロード開始。"""
        url = self.url_var.get().strip()
        if not validate_url(url):
            messagebox.showerror("エラー", "有効なURLを入力してください。（http または https）")
            self._log("エラー: 無効なURLです。")
            return

        save_path = self.save_path_var.get().strip()
        if not save_path:
            messagebox.showerror("エラー", "保存先を選択してください。")
            self._log("エラー: 保存先が指定されていません。")
            return

        if not self.agree_var.get():
            messagebox.showwarning("確認", "保存の権利確認にチェックを入れてください。")
            return

        # 保存先ディレクトリの存在確認
        save_dir = os.path.dirname(save_path)
        if save_dir and not os.path.isdir(save_dir):
            messagebox.showerror("エラー", f"保存先のフォルダが存在しません: {save_dir}")
            self._log(f"エラー: フォルダが存在しません: {save_dir}")
            return

        self._log("URLの情報を取得しています...")
        self.start_btn.configure(state=tk.DISABLED)
        self.cancel_btn.configure(state=tk.NORMAL)
        self.progress_var.set(0.0)
        self.size_label.configure(text="ファイルサイズ: ---")

        # Content-Type確認は別スレッドで行い、結果をメインスレッドで処理
        def do_check_and_download():
            content_type, content_length, final_url = get_content_info(url)
            # メインスレッドでログ・サイズ表示・エラーダイアログ
            def on_result():
                if content_type is None and content_length is None and final_url is None:
                    self._log("エラー: サーバーに接続できません。（タイムアウトまたは通信エラー）")
                    messagebox.showerror(
                        "エラー",
                        "サーバーに接続できません。\nタイムアウト、通信失敗、またはURLが間違っている可能性があります。",
                    )
                    self.start_btn.configure(state=tk.NORMAL)
                    self.cancel_btn.configure(state=tk.DISABLED)
                    return

                if not is_video_content_type(content_type):
                    self._log(f"エラー: 動画ではありません。Content-Type: {content_type or '不明'}")
                    messagebox.showerror(
                        "エラー",
                        f"このURLは動画（video/*）ではありません。\nContent-Type: {content_type or '不明'}",
                    )
                    self.start_btn.configure(state=tk.NORMAL)
                    self.cancel_btn.configure(state=tk.DISABLED)
                    return

                self.size_label.configure(text=f"ファイルサイズ: {format_size(content_length)}")
                self._log(f"Content-Type: {content_type}, サイズ: {format_size(content_length)}")
                self._log("ダウンロードを開始します...")

                # ファイル名を補正
                base = os.path.basename(save_path)
                safe_base = sanitize_filename(base)
                dirname = os.path.dirname(save_path)
                if dirname:
                    final_save_path = os.path.join(dirname, safe_base)
                else:
                    final_save_path = safe_base

                self.cancel_event = threading.Event()
                self.download_thread = threading.Thread(
                    target=self._run_download,
                    args=(final_url or url, final_save_path),
                    daemon=True,
                )
                self.download_thread.start()

            self.root.after(0, on_result)

        thread = threading.Thread(target=do_check_and_download, daemon=True)
        thread.start()

    def _run_download(self, url: str, save_path: str) -> None:
        """ダウンロードを実行し、完了後にメインスレッドでUIを更新する。"""
        success, message = download_video_stream(
            url,
            save_path,
            progress_callback=self._progress_callback,
            cancel_event=self.cancel_event,
        )

        def on_done():
            self._log(message)
            self.start_btn.configure(state=tk.NORMAL)
            self.cancel_btn.configure(state=tk.DISABLED)
            if success:
                self.progress_var.set(100.0)
                messagebox.showinfo("完了", message)
            else:
                messagebox.showerror("エラー", message)

        self.root.after(0, on_done)

    def _on_cancel(self) -> None:
        """キャンセルボタン: ダウンロードスレッドに中断を通知する。"""
        if self.cancel_event:
            self.cancel_event.set()
            self._log("キャンセルを要求しました...")

    def run(self) -> None:
        """アプリケーションのメインループを開始する。"""
        self.root.mainloop()


def main() -> None:
    """エントリポイント。"""
    app = VideoDownloaderApp()
    app.run()


if __name__ == "__main__":
    main()
