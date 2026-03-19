/**
 * Ultimate 動画検知スクリプト（WebView 注入用）
 * - HTMLMediaElement.src setter / play / load ハイジャック
 * - document.createElement('video'|'source') 監視
 * - MediaSource / SourceBuffer.appendBuffer (MSE) 監視
 * - Fetch / XHR の拡張子 + Content-Type 検知
 * - Blob createObjectURL
 * - DOM スキャン + MutationObserver
 * source でどのフックで検知したか区別可能
 */

export const injectedVideoDetectionScript = `
(function() {
  var VIDEO_EXT = /\\.(mp4|m3u8|webm|mov|m4v|ogg|ts)([?#]|$)/i;
  var TRACKING = /google-analytics\\.com|doubleclick\\.net|googlesyndication|googleadservices|analytics\\.|facebook\\.com\\/tr|tracking|pixel|beacon|collect\\?|stats?\\./i;
  function isTracking(u) { return !u || typeof u !== 'string' || TRACKING.test(u); }
  function isVideoExt(u) {
    if (!u || typeof u !== 'string') return false;
    if (isTracking(u)) return false;
    try { return VIDEO_EXT.test(u.split('?')[0].split('#')[0]); } catch (e) { return false; }
  }
  function isVideoContentType(ct) {
    if (!ct || typeof ct !== 'string') return false;
    var c = ct.split(';')[0].trim().toLowerCase();
    return c.indexOf('video/') === 0 || c === 'application/vnd.apple.mpegurl' || c === 'application/x-mpegurl';
  }
  function send(urls, source) {
    if (!urls || !urls.length || !window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) return;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'videos', urls: urls, source: source }));
  }
  function sendOne(url, source) { if (url) send([url], source); }

  var seen = {};
  function addAndSend(url, source) {
    if (!url || seen[url]) return;
    try {
      var p = (url.indexOf('?') >= 0 ? url.split('?')[0] : url);
      if (VIDEO_EXT.test(p) || url.indexOf('blob:') === 0) { seen[url] = true; send([url], source); }
    } catch (e) {}
  }

  if (typeof HTMLMediaElement !== 'undefined') {
    var desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    if (desc && desc.set) {
      var origSet = desc.set;
      Object.defineProperty(HTMLMediaElement.prototype, 'src', {
        set: function(v) {
          addAndSend(v, 'setter');
          return origSet.call(this, v);
        },
        get: desc.get,
        configurable: true,
        enumerable: desc.enumerable
      });
    }
  }

  if (typeof HTMLVideoElement !== 'undefined') {
    function collectFromEl(el) {
      var urls = [];
      try {
        if (el.src) urls.push(el.src);
        el.querySelectorAll && el.querySelectorAll('source').forEach(function(s) { if (s.src) urls.push(s.src); });
      } catch (e) {}
      return urls;
    }
    if (HTMLVideoElement.prototype.play) {
      var origPlay = HTMLVideoElement.prototype.play;
      HTMLVideoElement.prototype.play = function() {
        var urls = collectFromEl(this);
        urls.forEach(function(u) { addAndSend(u, 'play'); });
        return origPlay.apply(this, arguments);
      };
    }
    if (HTMLMediaElement && HTMLMediaElement.prototype.load) {
      var origLoad = HTMLMediaElement.prototype.load;
      HTMLMediaElement.prototype.load = function() {
        var urls = collectFromEl(this);
        urls.forEach(function(u) { addAndSend(u, 'load'); });
        return origLoad.apply(this, arguments);
      };
    }
  }

  if (typeof document !== 'undefined' && document.createElement) {
    var origCreateElement = document.createElement.bind(document);
    document.createElement = function(tagName) {
      var el = origCreateElement(tagName);
      var tag = (tagName || '').toLowerCase();
      if (tag === 'video' || tag === 'source') {
        if (typeof MutationObserver !== 'undefined') {
          var obs = new MutationObserver(function() {
            var u = el.src || el.getAttribute('src');
            if (u) addAndSend(u, 'createelement');
          });
          try { obs.observe(el, { attributes: true, attributeFilter: ['src'] }); } catch (e) {}
        }
      }
      return el;
    };
  }

  if (typeof window.MediaSource !== 'undefined') {
    var OrigMediaSource = window.MediaSource;
    window.MediaSource = function() {
      send([document.location.href || 'mse://stream'], 'mse');
      return new OrigMediaSource();
    };
    window.MediaSource.isTypeSupported = OrigMediaSource.isTypeSupported;
  }
  if (typeof window.SourceBuffer !== 'undefined' && window.SourceBuffer.prototype.appendBuffer) {
    var origAppend = window.SourceBuffer.prototype.appendBuffer;
    window.SourceBuffer.prototype.appendBuffer = function(data) {
      send([document.location.href || 'mse://segment'], 'mse');
      return origAppend.apply(this, arguments);
    };
  }

  if (typeof window.fetch === 'function') {
    var origFetch = window.fetch;
    window.fetch = function(input, init) {
      var url = typeof input === 'string' ? input : (input && input.url);
      if (url && isVideoExt(url)) send([url], 'network');
      return origFetch.apply(this, arguments).then(function(res) {
        if (url && !isTracking(url) && res && res.headers) {
          try {
            var ct = res.headers.get && res.headers.get('content-type');
            if (ct && isVideoContentType(ct)) send([url], 'network-content-type');
          } catch (e) {}
        }
        return res;
      }).catch(function(e) { return Promise.reject(e); });
    };
  }

  if (typeof XMLHttpRequest !== 'undefined') {
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
      this._pkVideoUrl = url;
      if (url && isVideoExt(url)) send([url], 'network');
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
      var xhr = this;
      var url = xhr._pkVideoUrl;
      if (url) {
        xhr.addEventListener('load', function() {
          try {
            if (isTracking(url)) return;
            var ct = xhr.getResponseHeader && xhr.getResponseHeader('Content-Type');
            if (ct && isVideoContentType(ct)) send([url], 'network-content-type');
          } catch (e) {}
        });
      }
      return origSend.apply(this, arguments);
    };
  }

  if (typeof URL !== 'undefined' && URL.createObjectURL) {
    var origBlob = URL.createObjectURL;
    URL.createObjectURL = function(blob) {
      var url = origBlob.apply(this, arguments);
      if (blob && blob.type && blob.type.indexOf('video') === 0) send([url], 'blob');
      return url;
    };
  }

  function collectDom() {
    var urls = [];
    try {
      document.querySelectorAll('video').forEach(function(v) {
        if (v.src) urls.push(v.src);
        v.querySelectorAll && v.querySelectorAll('source').forEach(function(s) { if (s.src) urls.push(s.src); });
      });
      document.querySelectorAll('source[src]').forEach(function(s) { if (s.src) urls.push(s.src); });
      document.querySelectorAll('a[href]').forEach(function(a) {
        var h = a.getAttribute('href');
        if (h && VIDEO_EXT.test(h)) urls.push(h);
      });
    } catch (e) {}
    return urls;
  }
  function sendDom() {
    var raw = collectDom();
    var toSend = [];
    raw.forEach(function(u) {
      if (!u || seen[u]) return;
      try {
        var p = (u.indexOf('?') >= 0 ? u.split('?')[0] : u);
        if (VIDEO_EXT.test(p) || u.indexOf('blob:') === 0) { seen[u] = true; toSend.push(u); }
      } catch (e) {}
    });
    if (toSend.length && window.ReactNativeWebView) send(toSend, 'dom');
  }
  sendDom();
  if (typeof MutationObserver !== 'undefined') {
    var target = document.body || document.documentElement || document;
    if (target) {
      var mo = new MutationObserver(sendDom);
      mo.observe(target, { childList: true, subtree: true });
    }
  }
  if (document.readyState !== 'complete') window.addEventListener('load', sendDom);
})();
true;
`;
