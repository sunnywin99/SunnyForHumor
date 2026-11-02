// 語音模組：包裝瀏覽器內建的 Web Speech API
//  - 語音合成（TTS）：speechSynthesis，用來「示範表演」與扮演搭檔
//  - 語音辨識（STT）：SpeechRecognition，用來聽使用者講段子並評分
//  - 錄音回放：MediaRecorder，讓使用者聽自己的語氣與節奏

(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  const alive = new Set(); // 保留 utterance 參考，避免被 GC 後 onend 不觸發（Chrome 的老問題）

  const Speech = {
    ttsSupported: !!synth,
    sttSupported: !!SR,
    recSupported: !!(navigator.mediaDevices && window.MediaRecorder),
    voices: [],
    _cancelled: false,

    init(onReady) {
      if (!synth) return onReady && onReady([]);
      const load = () => {
        const all = synth.getVoices();
        // 中文語音優先：zh-TW > zh-HK > zh-CN > 其他 zh
        const rank = (v) => {
          const l = v.lang.toLowerCase().replace('_', '-');
          if (l.startsWith('zh-tw') || /taiwan|台灣|臺灣/i.test(v.name)) return 0;
          if (l.startsWith('zh-hk')) return 2;
          if (l.startsWith('zh')) return 1;
          return 9;
        };
        this.voices = all.filter((v) => rank(v) < 9).sort((a, b) => rank(a) - rank(b));
        onReady && onReady(this.voices);
      };
      load();
      synth.onvoiceschanged = load;
    },

    voiceByName(name) {
      return this.voices.find((v) => v.name === name) || this.voices[0] || null;
    },

    speak(text, opts = {}) {
      return new Promise((resolve) => {
        if (!synth || !text) return resolve();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-TW';
        const v = opts.voice ? this.voiceByName(opts.voice) : this.voices[0];
        if (v) { u.voice = v; u.lang = v.lang; }
        u.rate = opts.rate || 1;
        u.pitch = opts.pitch || 1;
        alive.add(u);
        const done = () => { alive.delete(u); resolve(); };
        u.onend = done;
        u.onerror = done;
        synth.speak(u);
      });
    },

    wait(ms) {
      return new Promise((r) => setTimeout(r, ms));
    },

    // 依序播放一串台詞；item = { text, voice, rate, pitch } 或 { pause: 毫秒 }
    async play(items, onStep) {
      this.stop();
      this._cancelled = false;
      for (let i = 0; i < items.length; i++) {
        if (this._cancelled) break;
        onStep && onStep(i);
        const it = items[i];
        if (it.pause) await this.wait(it.pause);
        else await this.speak(it.text, it);
      }
      onStep && onStep(-1);
    },

    stop() {
      this._cancelled = true;
      if (synth) synth.cancel();
    },

    // 聽一句話。回傳 { transcript, startDelay }
    //  startDelay：從開始聆聽到偵測到聲音的毫秒數（用來估算接話節奏）
    listen({ onInterim, maxMs = 12000 } = {}) {
      return new Promise((resolve, reject) => {
        if (!SR) return reject(new Error('此瀏覽器不支援語音辨識'));
        const rec = new SR();
        rec.lang = 'zh-TW';
        rec.interimResults = true;
        rec.continuous = false;
        rec.maxAlternatives = 1;
        const t0 = performance.now();
        let startDelay = null;
        let finalText = '';
        let interimText = '';
        const timer = setTimeout(() => rec.stop(), maxMs);

        rec.onspeechstart = () => { if (startDelay === null) startDelay = performance.now() - t0; };
        rec.onresult = (e) => {
          interimText = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) finalText += r[0].transcript;
            else interimText += r[0].transcript;
          }
          if (startDelay === null) startDelay = performance.now() - t0;
          onInterim && onInterim(finalText + interimText);
        };
        rec.onerror = (e) => {
          clearTimeout(timer);
          if (e.error === 'no-speech') resolve({ transcript: '', startDelay: null });
          else reject(new Error(errorText(e.error)));
        };
        rec.onend = () => {
          clearTimeout(timer);
          resolve({ transcript: finalText || interimText, startDelay });
        };
        Speech._rec = rec;
        rec.start();
      });
    },

    stopListening() {
      if (Speech._rec) try { Speech._rec.stop(); } catch (_) {}
    },

    // 錄音：start() 後回傳一個 stop()，stop() 會 resolve 一個音檔 URL
    async record() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.start();
      return () =>
        new Promise((resolve) => {
          mr.onstop = () => {
            stream.getTracks().forEach((t) => t.stop());
            resolve(URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || 'audio/webm' })));
          };
          mr.stop();
        });
    }
  };

  function errorText(code) {
    return (
      {
        'not-allowed': '麥克風權限被拒絕，請在瀏覽器設定中允許使用麥克風。',
        'service-not-allowed': '語音辨識服務無法使用（請改用 Chrome / Edge / Safari）。',
        network: '語音辨識需要網路連線。',
        'audio-capture': '找不到麥克風。'
      }[code] || '語音辨識發生錯誤：' + code
    );
  }

  // ---------- 文字比對工具 ----------
  const CN_DIGIT = { 0: '零', 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九' };

  function normalize(s) {
    return (s || '')
      .replace(/(\d),(\d)/g, '$1$2')
      .replace(/(\d+)萬/g, (_, n) => numToCn(+n) + '萬')
      .replace(/\d/g, (d) => CN_DIGIT[d])
      .replace(/[臺]/g, '台')
      .replace(/[^一-鿿A-Za-z]/g, '');
  }

  function numToCn(n) {
    // 只處理語音辨識常見的 4000 → 四千 這類情況
    if (n >= 1000 && n % 1000 === 0 && n < 10000) return CN_DIGIT[n / 1000] + '千';
    if (n >= 100 && n % 100 === 0 && n < 1000) return CN_DIGIT[n / 100] + '百';
    return String(n);
  }

  function lcs(a, b) {
    const dp = new Array(b.length + 1).fill(0);
    for (let i = 1; i <= a.length; i++) {
      let prev = 0;
      for (let j = 1; j <= b.length; j++) {
        const tmp = dp[j];
        dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
        prev = tmp;
      }
    }
    return dp[b.length];
  }

  // 回傳 0~100：字句相似度 60% + 關鍵詞命中 40%
  Speech.score = function (said, expected, keywords = []) {
    const s = normalize(said);
    const e = normalize(expected);
    if (!s) return { total: 0, sim: 0, hit: false };
    const sim = e.length ? lcs(s, e) / e.length : 0;
    const hit = keywords.length === 0 || keywords.some((k) => s.includes(normalize(k)));
    const total = Math.round(Math.min(1, sim) * 60 + (hit ? 40 : 0));
    return { total, sim, hit };
  };

  Speech.normalize = normalize;
  window.Speech = Speech;
})();
