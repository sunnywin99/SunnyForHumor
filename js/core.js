// 共用核心：儲存、語音按鈕、模組註冊與路由
// 每個訓練單元（幽默、說話、主持…）是一個「模組」，用 App.register() 註冊自己的頁面與分頁。
// 網址格式：#/<模組>/<頁面>/<參數>，例如 #/humor/learn/beizi、#/speak/day/1
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const view = $('#view');

  // ---------- 儲存 ----------
  const store = {
    get(key, def) {
      try { const v = localStorage.getItem('sfh-' + key); return v ? JSON.parse(v) : def; } catch (_) { return def; }
    },
    set(key, val) {
      try { localStorage.setItem('sfh-' + key, JSON.stringify(val)); } catch (_) {}
    }
  };
  const settings = Object.assign({ rate: 1, pause: 1000, voiceA: '', voiceB: '', playMode: 'continuous', repeat: '1' }, store.get('settings', {}));

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

  // ---------- 語音播放輔助 ----------
  const A = () => ({ voice: settings.voiceA, rate: settings.rate, pitch: 1 });
  const B = () => ({ voice: settings.voiceB || settings.voiceA, rate: settings.rate * 1.05, pitch: settings.voiceB ? 1 : 1.35 });

  function speakBtn(label, onClick, cls = '') {
    const b = document.createElement('button');
    b.className = 'btn ' + cls;
    b.textContent = label;
    b.onclick = onClick;
    return b;
  }

  function noSupport(kind) {
    return `<div class="notice">⚠️ 這個瀏覽器不支援${kind}。建議使用電腦或 Android 的 Chrome / Edge，或 iPhone 的 Safari。</div>`;
  }



  // 一個按鈕：按下後聽寫到指定輸入框
  function micToField(field) {
    const b = speakBtn('🎤 用說的', async () => {
      b.disabled = true;
      b.textContent = '聆聽中…';
      try {
        const { transcript } = await Speech.listen({ onInterim: (t) => (field.value = t) });
        if (transcript) field.value = transcript;
      } catch (e) { alert(e.message); }
      b.disabled = false;
      b.textContent = '🎤 用說的';
    });
    return b;
  }
  const today = () => new Date().toISOString().slice(0, 10);

  // 計時器顯示：mm:ss
  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.max(0, Math.floor(sec % 60))).padStart(2, '0')}`;

  // ---------- 模組註冊 ----------
  const modules = {};
  const order = [];
  function register(m) {
    modules[m.id] = m;
    order.push(m.id);
  }

  // 舊網址（幽默單元還沒分模組時）自動轉址
  const LEGACY = ['learn', 'quiz', 'perform', 'create', 'collect', 'theory', 'scenes'];

  function router() {
    Speech.stop();
    Speech.stopListening();
    if (window.Reader) Reader.stop();
    const [mod = '', page = '', arg] = location.hash.replace(/^#\/?/, '').split('/');
    if (LEGACY.includes(mod)) return location.replace('#/humor/' + [mod, page].filter(Boolean).join('/'));
    const m = modules[mod];
    document.body.dataset.module = m ? m.id : 'hub';
    if (mod === 'settings') settingsPage();
    else if (!m) hub();
    else (m.pages[page] || m.pages[''])(arg);
    renderChrome(m, page);
    window.scrollTo(0, 0);
  }

  function renderChrome(m, page) {
    $('#brand').innerHTML = m ? `<span class="crumb">🏠</span> ${esc(m.emoji)} ${esc(m.name)}` : '🌞 Sunny 表達訓練';
    $('#brand').href = m ? '#/' : '#/';
    const tabs = m
      ? [{ href: '#/', icon: '🏠', label: '首頁', active: false }].concat(
          m.tabs.map((t) => ({ href: `#/${m.id}${t.page ? '/' + t.page : ''}`, icon: t.icon, label: t.label, active: (t.match || [t.page]).includes(page) }))
        )
      : order.map((id) => ({ href: '#/' + id, icon: modules[id].emoji, label: modules[id].short || modules[id].name, active: false }))
          .concat([{ href: '#/settings', icon: '⚙️', label: '設定', active: location.hash.startsWith('#/settings') }]);
    $('#tabbar').innerHTML = tabs
      .map((t) => `<a href="${t.href}" class="${t.active ? 'active' : ''}"><span>${t.icon}</span>${esc(t.label)}</a>`)
      .join('');
  }

  // ---------- 訓練中心首頁 ----------
  function hub() {
    view.innerHTML = `
      <section class="hero">
        <h1>Sunny 表達訓練</h1>
        <p>選一個單元開始今天的練習。每個單元各自獨立，進度分開記錄。</p>
      </section>
      <div class="module-list">
        ${order.map((id) => {
          const m = modules[id];
          const soon = m.status === 'soon';
          return `<a class="module-card m-${id} ${soon ? 'soon' : ''}" href="#/${id}">
            <span class="emoji">${m.emoji}</span>
            <span class="body">
              <b>${esc(m.name)} ${soon ? '<span class="chip">即將推出</span>' : ''}</b>
              <small>${esc(m.tagline)}</small>
              ${m.summary ? `<small class="summary">${esc(m.summary())}</small>` : ''}
            </span>
          </a>`;
        }).join('')}
      </div>`;
  }

  // ---------- 設定 ----------
  function settingsPage() {
    const opts = (sel) => ['<option value="">（自動）</option>']
      .concat(Speech.voices.map((v) => `<option value="${esc(v.name)}" ${v.name === sel ? 'selected' : ''}>${esc(v.name)}（${esc(v.lang)}）</option>`)).join('');
    view.innerHTML = `
      <h1>設定</h1>
      <section class="card">
        <h2>語音</h2>
        ${Speech.ttsSupported ? '' : noSupport('語音朗讀')}
        ${Speech.ttsSupported && !Speech.voices.length ? '<div class="notice">找不到中文語音。Windows 請到「設定 → 時間與語言 → 語音」安裝中文（台灣）語音；手機請在系統的文字轉語音設定中下載中文語音。</div>' : ''}
        <label>主要聲音（示範、你）<select id="sA">${opts(settings.voiceA)}</select></label>
        <label>對話聲音（搭檔、對方）<select id="sB">${opts(settings.voiceB)}</select></label>
        <label>語速 <output id="oRate">${settings.rate}</output><input type="range" id="sRate" min="0.5" max="2" step="0.05" value="${settings.rate}"></label>
        <label>笑點前停頓（幽默單元） <output id="oPause">${(settings.pause / 1000).toFixed(1)} 秒</output><input type="range" id="sPause" min="0" max="2500" step="100" value="${settings.pause}"></label>
        <label>朗讀播放方式<select id="sMode"><option value="single">單一播放（念完這段就停）</option><option value="continuous">連續播放（自動念下一段）</option></select></label>
        <label>每句次數<select id="sRepeat"><option value="1">每句一遍</option><option value="3">每句連續三遍（跟讀用）</option></select></label>
        <div class="row" id="sTest"></div>
        <p class="small">💡 想要更自然的聲音：用 <b>Microsoft Edge</b> 瀏覽器打開，聲音清單會出現「HsiaoChen／YunJhe Online (Natural)」等台灣神經語音（和 wordstovoice 用的同一組）。</p>
        <p class="small">語音辨識：${Speech.sttSupported ? '✅ 支援' : '❌ 不支援'}　錄音：${Speech.recSupported ? '✅ 支援' : '❌ 不支援'}</p>
      </section>
      <section class="card">
        <h2>資料</h2>
        <p class="small">所有進度、作品、日記都只存在這台裝置的瀏覽器裡。</p>
        <div class="row" id="resets"></div>
      </section>`;
    const save = () => store.set('settings', settings);
    $('#sA').onchange = (e) => { settings.voiceA = e.target.value; save(); };
    $('#sB').onchange = (e) => { settings.voiceB = e.target.value; save(); };
    $('#sRate').oninput = (e) => { settings.rate = +e.target.value; $('#oRate').textContent = settings.rate; save(); };
    $('#sMode').value = settings.playMode;
    $('#sRepeat').value = String(settings.repeat);
    $('#sMode').onchange = (e) => { settings.playMode = e.target.value; save(); };
    $('#sRepeat').onchange = (e) => { settings.repeat = e.target.value; save(); };
    $('#sPause').oninput = (e) => { settings.pause = +e.target.value; $('#oPause').textContent = (settings.pause / 1000).toFixed(1) + ' 秒'; save(); };
    if (Speech.ttsSupported) {
      $('#sTest').append(speakBtn('🔊 試聽', () => Speech.play([{ text: '你好，我是主要聲音。', ...A() }, { pause: 300 }, { text: '我是對話聲音。', ...B() }])));
    }
    order.forEach((id) => {
      const m = modules[id];
      if (!m.reset) return;
      $('#resets').append(speakBtn(`重設${m.name}進度`, () => {
        if (!confirm(`確定要清除「${m.name}」的學習進度？（作品、收集、日記會保留）`)) return;
        m.reset();
        alert('已重設');
      }, 'ghost'));
    });
  }

  window.addEventListener('hashchange', router);

  window.App = {
    $, view, store, settings, esc, shuffle, today, fmt, A, B, speakBtn, noSupport, micToField,
    register, modules,
    start() {
      Speech.init(() => { if (location.hash.startsWith('#/settings')) settingsPage(); });
      router();
      if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      }
    }
  };
})();
