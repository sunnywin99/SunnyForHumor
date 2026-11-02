// 朗讀器：逐段朗讀、暫停／繼續、連續播放、每句三遍、標出正在念的句子並畫線
// 移植自 wordstovoice 的讀書筆記網頁（notes_web/template.html），改成所有單元都能用的元件。
//
// 用法：
//   const bar = Reader.playerBar();            // 語速、聲音、播放方式、每句次數
//   const block = Reader.block('一段文字。第二句。');  // 有 ▶ ❚❚ ■ 的段落
//   Reader.stop();
(function () {
  const TTS = 'speechSynthesis' in window ? window.speechSynthesis : null;
  const S = () => App.settings;
  const save = () => App.store.set('settings', S());

  let speaking = null; // { block, parts, i, c, r, token, paused, announced }
  let speakToken = 0;
  let readingEl = null;
  let quietUntil = 0;
  const alive = new Set(); // 保留 utterance 參考，避免 onend 不觸發

  // ---------- 切句 ----------
  // 長句在逗號、分號等處切小段（不在括號裡切），避免某些瀏覽器唸到一半停住
  function chunkOutsideParens(p) {
    const out = [];
    let buf = '', depth = 0;
    for (let k = 0; k < p.length; k++) {
      const ch = p[k];
      buf += ch;
      if ('（(【'.includes(ch)) depth++;
      else if ('）)】'.includes(ch)) depth = Math.max(0, depth - 1);
      else if (depth === 0 && '，、,；;'.includes(ch) && !'」』）)'.includes(p[k + 1] || '')) { out.push(buf); buf = ''; }
    }
    if (buf) out.push(buf);
    return out;
  }
  // 以句號、問號、驚嘆號為一句（後面的引號、括號算同一句）；每句再視長度切小段
  function splitSentences(t) {
    const parts = t.match(/[^。！？!?]+[。！？!?」』）)]*|[。！？!?]+/g) || [t];
    return parts.filter((p) => p.trim()).map((p) => (p.length > 120 ? chunkOutsideParens(p) : [p]));
  }

  // 朗讀時略過：文獻出處（Norcross, 2019）、（p. 19），以及跟讀用的停頓記號｜和加重記號【】
  const SKIP = /[（(][^（）()]*?(?:(?:19|20)\d{2}[a-z]?|p\.\s*\d+|\b[A-Z]\.\d+\.[a-z]\b)[^（）()]*[）)]|[｜【】]/g;
  function speakable(text) {
    let say = '', last = 0;
    const map = [];
    const keep = (from, to) => { for (let k = from; k < to; k++) { say += text[k]; map.push(k); } };
    for (const m of text.matchAll(SKIP)) { keep(last, m.index); last = m.index + m[0].length; }
    keep(last, text.length);
    map.push(text.length);
    return { say, map };
  }

  // ---------- 聲音 ----------
  function pickVoice() {
    const list = Speech.voices;
    return list.find((v) => v.name === S().voiceA) || list[0] || null;
  }

  // ---------- 標出正在念的句子 ----------
  // 念過的字畫紅線，還沒念的畫主色線
  function setProgress(n) {
    const el = readingEl;
    if (!el || !el.classList.contains('sent')) return;
    if (el._html == null) el._html = el.innerHTML; // 念完要還原原本的格式（粗體等）
    const full = el.dataset.full ?? (el.dataset.full = el.textContent);
    n = Math.max(0, Math.min(full.length, n));
    if (el._n === n) return;
    el._n = n;
    const done = document.createElement('span'), rest = document.createElement('span');
    done.className = 'done'; done.textContent = full.slice(0, n);
    rest.className = 'rest'; rest.textContent = full.slice(n);
    el.replaceChildren(done, rest);
  }
  function releaseSentence(el) {
    el.classList.remove('reading');
    if (el._html != null) { el.innerHTML = el._html; el._html = null; }
    delete el.dataset.full;
    el._n = undefined;
  }
  function headerBottom() {
    const h = document.querySelector('.topbar');
    const p = document.querySelector('.player-bar');
    return Math.max(h ? h.getBoundingClientRect().bottom : 0, p ? p.getBoundingClientRect().bottom : 0);
  }
  function followSentence(st) {
    const el = st.block.querySelectorAll('.sent')[st.i] || st.block.querySelector('.rd-text');
    if (el !== readingEl) {
      if (readingEl) releaseSentence(readingEl);
      readingEl = el;
      el.classList.add('reading');
      setProgress(0);
    }
    const r = el.getBoundingClientRect(), top = headerBottom();
    const bottom = window.innerHeight - (document.querySelector('.tabbar')?.offsetHeight || 0);
    if (r.top < top + 8 || r.bottom > bottom - 16) {
      quietUntil = Date.now() + 1200;
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const target = r.top + window.scrollY - top - Math.max(16, (bottom - top) * 0.25);
      window.scrollTo({ top: Math.max(0, target), behavior: smooth ? 'smooth' : 'auto' });
    }
  }
  function clearReading() { if (readingEl) releaseSentence(readingEl); readingEl = null; }

  // ---------- 播放控制 ----------
  function setIcons(block) {
    const mine = speaking && speaking.block === block;
    const paused = mine && speaking.paused;
    const [play, pause, stop] = block.querySelectorAll('.speak');
    if (!play) return;
    play.classList.toggle('on', mine && !paused);
    play.setAttribute('aria-label', paused ? '繼續朗讀' : '朗讀這一段');
    pause.disabled = !mine || paused;
    pause.classList.toggle('on', !!paused);
    stop.disabled = !mine;
  }
  function stop() {
    clearReading();
    speakToken++;
    if (TTS) TTS.cancel();
    const b = speaking && speaking.block;
    speaking = null;
    if (b) { b.classList.remove('speaking'); setIcons(b); }
  }
  function pause() {
    if (!speaking || speaking.paused) return;
    speaking.paused = true;
    speakToken++; // 讓正在念的這句結束時不要接下去
    if (TTS) TTS.cancel();
    setIcons(speaking.block);
  }
  function resume() {
    if (!speaking || !speaking.paused) return;
    speaking.paused = false;
    speaking.token = ++speakToken;
    setIcons(speaking.block);
    next(); // 從暫停的那一句重新念
  }
  function play(block) {
    Speech.stop();
    stop();
    speaking = { block, parts: splitSentences(block.dataset.say), i: 0, c: 0, r: 0, token: speakToken };
    block.classList.add('speaking');
    setIcons(block);
    block.dispatchEvent(new CustomEvent('reader:play', { bubbles: true }));
    next();
  }
  function advance(st) {
    st.c++;
    if (st.c >= st.parts[st.i].length) { // 這一句念完
      st.c = 0; st.r++; st.announced = false;
      if (st.r >= (parseInt(S().repeat, 10) || 1)) { st.r = 0; st.i++; }
    }
  }
  function nextBlock(block) {
    const all = [...document.querySelectorAll('#view .rd-block')];
    return all[all.indexOf(block) + 1] || null;
  }
  function next() {
    const st = speaking;
    if (!st || st.token !== speakToken) return;
    if (st.i >= st.parts.length) {
      const n = S().playMode === 'continuous' ? nextBlock(st.block) : null;
      if (n) play(n); else stop();
      return;
    }
    // 重複時先說「第二遍」「第三遍」
    const announce = st.r > 0 && st.c === 0 && !st.announced;
    followSentence(st);
    const sp = announce ? null : speakable(st.parts[st.i][st.c]);
    if (sp && !/[\p{L}\p{N}]/u.test(sp.say)) { // 整段都是要略過的內容
      setProgress(st.parts[st.i].slice(0, st.c + 1).join('').length);
      advance(st); next(); return;
    }
    const u = new SpeechSynthesisUtterance(announce ? '第' + '一二三四五'[st.r] + '遍' : sp.say);
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'zh-TW';
    u.rate = +S().rate || 1;
    if (!announce) {
      const offset = st.parts[st.i].slice(0, st.c).join('').length;
      const len = st.parts[st.i][st.c].length;
      if (st.c === 0) setProgress(0); // 每一遍從頭開始畫紅線
      // 有些裝置會回報念到第幾個字；沒有回報的，念完這一小段才一起變紅
      u.onboundary = (e) => {
        if (st.token !== speakToken || typeof e.charIndex !== 'number') return;
        const k = Math.min(sp.map.length - 1, e.charIndex + (e.charLength || 1));
        setProgress(offset + (k >= sp.say.length ? len : sp.map[k - 1] + 1));
      };
      u._end = () => setProgress(offset + len);
    }
    alive.add(u);
    u.onend = () => {
      alive.delete(u);
      if (st.token !== speakToken) return;
      if (u._end) u._end();
      if (announce) { st.announced = true; next(); return; }
      advance(st);
      next();
    };
    u.onerror = (e) => {
      alive.delete(u);
      if (st.token !== speakToken || e.error === 'interrupted' || e.error === 'canceled') return;
      stop();
      const s = document.querySelector('.player-bar .pb-status');
      if (s) s.textContent = '這台裝置目前無法朗讀（' + (e.error || '未知原因') + '），可換個聲音再試';
    };
    TTS.speak(u);
  }

  // ---------- 元件 ----------
  // 一個可朗讀的段落。text 裡可以有｜【】或文獻出處，畫面照樣顯示，朗讀時略過。
  //  html：把一句文字轉成要顯示的 HTML（例如把【】變粗體），不給就顯示純文字
  function block(text, { label, html } = {}) {
    const el = document.createElement('div');
    el.className = 'rd-block';
    el.dataset.say = text;
    const body = document.createElement('div');
    body.className = 'rd-text';
    for (const g of splitSentences(text)) {
      const sp = document.createElement('span');
      sp.className = 'sent';
      if (html) sp.innerHTML = html(g.join('')); else sp.textContent = g.join('');
      body.append(sp);
    }
    if (TTS) {
      const bar = document.createElement('div');
      bar.className = 'controls';
      const mk = (aria, txt, fn) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'speak'; b.textContent = txt;
        b.setAttribute('aria-label', aria); b.title = aria;
        b.addEventListener('click', fn);
        bar.append(b);
      };
      mk('朗讀這一段', '▶', () => {
        if (speaking && speaking.block === el) { if (speaking.paused) resume(); }
        else play(el);
      });
      mk('暫停', '❚❚', () => { if (speaking && speaking.block === el) pause(); });
      mk('停止', '■', () => { if (speaking && speaking.block === el) stop(); });
      if (label) { const l = document.createElement('span'); l.className = 'rd-label'; l.textContent = label; bar.append(l); }
      el.append(bar);
    }
    el.append(body);
    if (TTS) setIcons(el);
    return el;
  }

  // 播放設定列：語速、聲音、單一／連續、每句一遍／三遍（存在設定裡，所有頁面共用）
  function playerBar() {
    const el = document.createElement('div');
    el.className = 'player-bar';
    if (!TTS) { el.innerHTML = App.noSupport('語音朗讀'); return el; }
    const esc = App.esc;
    const voiceOpts = () => ['<option value="">自動選擇聲音</option>']
      .concat(Speech.voices.map((v) => `<option value="${esc(v.name)}" ${v.name === S().voiceA ? 'selected' : ''}>${esc(v.name.replace(/^Microsoft |^Google /, ''))}（${esc(v.lang)}）</option>`))
      .join('');
    el.innerHTML = `
      <label class="pb-rate">語速 <input type="range" min="0.5" max="2" step="0.1" value="${S().rate}"> <output>${(+S().rate).toFixed(1)}×</output></label>
      <select class="pb-voice" aria-label="朗讀聲音">${voiceOpts()}</select>
      <select class="pb-mode" aria-label="播放方式">
        <option value="single">單一播放</option>
        <option value="continuous">連續播放</option>
      </select>
      <select class="pb-repeat" aria-label="每句播放次數">
        <option value="1">每句一遍</option>
        <option value="3">每句連續三遍</option>
      </select>
      <span class="pb-status small"></span>`;
    const q = (s) => el.querySelector(s);
    q('.pb-mode').value = S().playMode;
    q('.pb-repeat').value = String(S().repeat);
    q('.pb-rate input').oninput = (e) => { S().rate = +e.target.value; q('.pb-rate output').textContent = S().rate.toFixed(1) + '×'; save(); };
    q('.pb-voice').onchange = (e) => { S().voiceA = e.target.value; save(); };
    q('.pb-mode').onchange = (e) => { S().playMode = e.target.value; save(); };
    q('.pb-repeat').onchange = (e) => { S().repeat = e.target.value; save(); };
    // 聲音清單晚一點才載入時補上
    if (!Speech.voices.length) setTimeout(() => { if (el.isConnected) q('.pb-voice').innerHTML = voiceOpts(); }, 1200);
    return el;
  }

  window.Reader = {
    supported: !!TTS,
    block, playerBar, stop, splitSentences,
    isQuiet: () => Date.now() < quietUntil,
    current: () => speaking && speaking.block
  };
})();
