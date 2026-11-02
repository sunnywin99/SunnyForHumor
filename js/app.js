// 幽默訓練器主程式：純前端、無框架、hash 路由
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const view = $('#view');
  const JOKES = window.JOKES;

  // ---------- 儲存 ----------
  const store = {
    get(key, def) {
      try { const v = localStorage.getItem('sfh-' + key); return v ? JSON.parse(v) : def; } catch (_) { return def; }
    },
    set(key, val) {
      try { localStorage.setItem('sfh-' + key, JSON.stringify(val)); } catch (_) {}
    }
  };
  const settings = Object.assign({ rate: 1, pause: 1000, voiceA: '', voiceB: '' }, store.get('settings', {}));
  const progress = store.get('progress', {}); // { [id]: { learned, quiz, perform } }
  const saveProgress = () => store.set('progress', progress);
  const mark = (id, key, val) => {
    progress[id] = progress[id] || {};
    if (key === 'perform') progress[id].perform = Math.max(progress[id].perform || 0, val);
    else progress[id][key] = val;
    saveProgress();
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const byId = (id) => JOKES.find((j) => j.id === id);

  // ---------- 語音播放輔助 ----------
  const A = () => ({ voice: settings.voiceA, rate: settings.rate, pitch: 1 });
  const B = () => ({ voice: settings.voiceB || settings.voiceA, rate: settings.rate * 1.05, pitch: settings.voiceB ? 1 : 1.35 });

  // 單人表演：鋪陳 → 停頓 → 反轉（稍慢）→ 加碼
  function performanceScript(j) {
    const items = [{ text: j.setup, ...A() }, { pause: settings.pause }, { text: j.punchline, ...A(), rate: settings.rate * 0.9 }];
    if (j.tag) items.push({ pause: 600 }, { text: j.tag, ...A() });
    return items;
  }
  // 雙人對話（原版重現）
  function dialogScript(j) {
    const items = [];
    j.dialog.forEach((line) => {
      if (line.pauseBefore) items.push({ pause: settings.pause });
      items.push({ text: line.t, ...(line.s === 'A' ? A() : B()) });
    });
    return items;
  }

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

  // ---------- 路由 ----------
  const routes = {
    '': home,
    learn: learn,
    quiz: quiz,
    perform: perform,
    create: create,
    collect: collect,
    theory: theory,
    settings: settingsPage
  };

  function router() {
    Speech.stop();
    Speech.stopListening();
    const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
    (routes[name] || home)(arg);
    document.querySelectorAll('.tabbar a').forEach((a) => {
      a.classList.toggle('active', a.dataset.tab === (name || 'home') || (name === 'learn' && a.dataset.tab === 'home'));
    });
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', router);

  // ---------- 首頁 ----------
  function home() {
    const learned = JOKES.filter((j) => progress[j.id] && progress[j.id].learned).length;
    view.innerHTML = `
      <section class="hero">
        <h1>幽默訓練器</h1>
        <p>拆解段子、跟搭檔對練、寫出你自己的梗。</p>
        <div class="meter"><div style="width:${(learned / JOKES.length) * 100}%"></div></div>
        <small>已學會 ${learned} / ${JOKES.length} 個段子</small>
      </section>

      <section class="card formula">
        <h2>這 5 個段子共用一個公式</h2>
        <ol class="steps">
          <li><b>鋪陳</b>：用一個有兩種意思的詞，讓觀眾往意思 A 想</li>
          <li><b>停頓</b>：讓觀眾的預測「落地」</li>
          <li><b>反轉</b>：一句話揭露意思 B</li>
          <li><b>加碼</b>：順著意思 B 再補一刀</li>
        </ol>
        <a class="link" href="#/theory">為什麼這樣會好笑？看幽默原理 →</a>
      </section>

      <h2 class="section-title">段子課程</h2>
      <div class="list">
        ${JOKES.map((j, i) => {
          const p = progress[j.id] || {};
          return `<a class="joke-item" href="#/learn/${j.id}">
            <span class="num">${i + 1}</span>
            <span class="body"><b>${esc(j.title)}</b><small>${esc(j.technique)}・${esc(j.word)}</small></span>
            <span class="badges">${p.learned ? '📖' : ''}${p.quiz ? '🎯' : ''}${p.perform >= 80 ? '🎤' : ''}</span>
          </a>`;
        }).join('')}
      </div>
      <p class="legend">📖 已拆解　🎯 猜對笑點　🎤 表演 80 分以上</p>`;
  }

  // ---------- 學習（拆解） ----------
  function learn(id) {
    const j = byId(id) || JOKES[0];
    const idx = JOKES.indexOf(j);
    const pat = PATTERNS[j.pattern];
    view.innerHTML = `
      <a class="back" href="#/">← 返回</a>
      <h1>${esc(j.title)}</h1>
      <div class="chips"><span class="chip">${esc(j.technique)}</span><span class="chip alt">公式${j.pattern}：${esc(pat.name)}</span></div>

      <section class="card stage">
        <div class="label">鋪陳</div>
        <p class="line setup">${esc(j.setup)}</p>
        <p class="line partner">搭檔：${esc(j.partner)}</p>
        <div id="guessBox">
          <div class="label">先猜猜看：為什麼？</div>
          <textarea id="guess" rows="2" placeholder="寫下你猜的答案（也可以按 🎤 用說的）"></textarea>
          <div class="row" id="guessBtns"></div>
        </div>
        <div id="reveal" hidden>
          <div class="label">反轉</div>
          <p class="line punch">${esc(j.punchline)}</p>
          ${j.tag ? `<div class="label">加碼</div><p class="line tag">${esc(j.tag)}</p>` : ''}
        </div>
      </section>

      <section class="card" id="breakdown" hidden>
        <h2>拆解</h2>
        <div class="kw">🔑 關鍵詞：<b>${esc(j.word)}</b></div>
        <div class="split">
          <div class="side a"><div class="label">觀眾以為（意思 A）</div>${esc(j.expect)}</div>
          <div class="side b"><div class="label">其實是（意思 B）</div>${esc(j.actual)}</div>
        </div>
        <p>${esc(j.explain)}</p>
        <div class="formula-box"><b>公式${j.pattern}「${esc(pat.name)}」</b><br>${esc(pat.desc)}<br><code>${esc(pat.formula)}</code></div>
        <div class="row" id="listenBtns"></div>
      </section>

      <nav class="pager">
        ${idx > 0 ? `<a class="btn ghost" href="#/learn/${JOKES[idx - 1].id}">← 上一個</a>` : '<span></span>'}
        <a class="btn" href="#/perform/${j.id}">去表演練習 🎤</a>
        ${idx < JOKES.length - 1 ? `<a class="btn ghost" href="#/learn/${JOKES[idx + 1].id}">下一個 →</a>` : '<span></span>'}
      </nav>`;

    const gb = $('#guessBtns');
    if (Speech.sttSupported) gb.append(micToField($('#guess')));
    gb.append(
      speakBtn('揭曉答案', () => {
        $('#guessBox').hidden = true;
        $('#reveal').hidden = false;
        $('#breakdown').hidden = false;
        mark(j.id, 'learned', true);
        if (Speech.ttsSupported) Speech.play([{ text: j.punchline, ...A(), rate: settings.rate * 0.9 }]);
      }, 'primary')
    );

    const lb = $('#listenBtns');
    if (Speech.ttsSupported) {
      lb.append(
        speakBtn('🔊 聽單人示範', () => Speech.play(performanceScript(j))),
        speakBtn('🎭 聽雙人原版', () => Speech.play(dialogScript(j))),
        speakBtn('⏹', () => Speech.stop(), 'ghost')
      );
    } else lb.innerHTML = noSupport('語音朗讀');
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

  // ---------- 猜梗測驗 ----------
  function quiz() {
    const order = shuffle(JOKES);
    let i = 0, correct = 0;

    function show() {
      if (i >= order.length) {
        view.innerHTML = `
          <h1>猜梗測驗</h1>
          <section class="card center">
            <div class="big">${correct} / ${order.length}</div>
            <p>${correct === order.length ? '全對！你已經抓到「雙關反轉」的感覺了 👏' : '提示：笑點通常不是「最合理」的答案，而是「把某個詞換成另一個意思」的答案。'}</p>
            <a class="btn primary" href="#/quiz" onclick="location.reload()">再玩一次</a>
          </section>`;
        return;
      }
      const j = order[i];
      const opts = shuffle([j.punchline, ...j.wrong]);
      view.innerHTML = `
        <h1>猜梗測驗 <small>${i + 1} / ${order.length}</small></h1>
        <p class="hint">哪一個才是「笑點」？（不是最合理的那個喔）</p>
        <section class="card">
          <p class="line setup">${esc(j.setup)}</p>
          <p class="line partner">搭檔：${esc(j.partner)}</p>
          <div class="row" id="qListen"></div>
        </section>
        <div class="options">${opts.map((o) => `<button class="option" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>
        <div id="qFeedback"></div>`;
      if (Speech.ttsSupported) $('#qListen').append(speakBtn('🔊 聽題目', () => Speech.play([{ text: j.setup, ...A() }, { pause: 300 }, { text: j.partner, ...B() }])));

      view.querySelectorAll('.option').forEach((btn) => {
        btn.onclick = () => {
          const ok = btn.dataset.v === j.punchline;
          if (ok) { correct++; mark(j.id, 'quiz', true); }
          view.querySelectorAll('.option').forEach((b) => {
            b.disabled = true;
            if (b.dataset.v === j.punchline) b.classList.add('right');
          });
          if (!ok) btn.classList.add('wrong');
          $('#qFeedback').innerHTML = `
            <section class="card">
              <b>${ok ? '✅ 答對了！' : '❌ 這個太「合理」了'}</b>
              <p>🔑 ${esc(j.word)}</p>
              <p class="small">${esc(j.actual)}</p>
              <button class="btn primary" id="next">下一題 →</button>
            </section>`;
          if (Speech.ttsSupported) Speech.play([{ text: j.punchline, ...A(), rate: settings.rate * 0.9 }]);
          $('#next').onclick = () => { i++; show(); };
        };
      });
    }
    show();
  }

  // ---------- 表演練習（搭檔對練） ----------
  function perform(id) {
    const j = byId(id) || JOKES[0];
    view.innerHTML = `
      <h1>表演練習</h1>
      <div class="select-row">
        <select id="pickJoke">${JOKES.map((x) => `<option value="${x.id}" ${x.id === j.id ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select>
      </div>

      <section class="card script">
        <div class="label">劇本</div>
        <p class="line setup"><span class="who">你</span>${esc(j.setup)}</p>
        <p class="line partner"><span class="who b">搭檔</span>${esc(j.partner)}</p>
        <p class="pause-mark">⏸ 停頓一下</p>
        <p class="line punch"><span class="who">你</span>${esc(j.punchline)}</p>
        <div class="row" id="demoBtns"></div>
      </section>

      <section class="card" id="duet">
        <h2>🎤 搭檔對練</h2>
        <p class="small">按「開始」後：① 你講鋪陳 → ② App 當搭檔問「為什麼？」→ ③ 你講出笑點。App 會幫你評分並量接話節奏。</p>
        <div id="duetBody"></div>
      </section>

      <section class="card">
        <h2>🎙️ 錄音自評</h2>
        <p class="small">錄下自己完整講一次，回放聽聽看：反轉前有沒有停頓？笑點那句有沒有放慢、加重？</p>
        <div id="recBody"></div>
      </section>`;

    $('#pickJoke').onchange = (e) => (location.hash = '#/perform/' + e.target.value);

    const demo = $('#demoBtns');
    if (Speech.ttsSupported) demo.append(speakBtn('🔊 聽示範', () => Speech.play(performanceScript(j))), speakBtn('⏹', () => Speech.stop(), 'ghost'));

    // 搭檔對練
    const body = $('#duetBody');
    if (!Speech.sttSupported) body.innerHTML = noSupport('語音辨識');
    else {
      body.innerHTML = `<div class="live" id="live">準備好就按開始</div><div id="duetResult"></div>`;
      const startBtn = speakBtn('▶️ 開始', () => runDuet(j, startBtn), 'primary');
      body.prepend(startBtn);
    }

    // 錄音
    const rb = $('#recBody');
    if (!Speech.recSupported) rb.innerHTML = noSupport('錄音');
    else {
      let stopFn = null;
      const btn = speakBtn('⏺ 開始錄音', async () => {
        if (!stopFn) {
          try { stopFn = await Speech.record(); } catch (e) { return alert('無法使用麥克風：' + e.message); }
          btn.textContent = '⏹ 停止錄音';
          btn.classList.add('recording');
        } else {
          const url = await stopFn();
          stopFn = null;
          btn.textContent = '⏺ 重新錄音';
          btn.classList.remove('recording');
          rb.querySelector('audio')?.remove();
          const audio = document.createElement('audio');
          audio.controls = true;
          audio.src = url;
          rb.append(audio);
        }
      });
      rb.append(btn);
    }
  }

  async function runDuet(j, startBtn) {
    const live = $('#live');
    const out = $('#duetResult');
    out.innerHTML = '';
    startBtn.disabled = true;
    try {
      live.innerHTML = '① 請講鋪陳：<b>' + esc(j.setup) + '</b>';
      const s1 = await Speech.listen({ onInterim: (t) => (live.innerHTML = '① 聽到：' + esc(t)) });
      const sc1 = Speech.score(s1.transcript, j.setup, []);

      live.innerHTML = '② 搭檔：' + esc(j.partner);
      await Speech.speak(j.partner, B());

      live.innerHTML = '③ 換你講笑點！';
      const s2 = await Speech.listen({ onInterim: (t) => (live.innerHTML = '③ 聽到：' + esc(t)) });
      const sc2 = Speech.score(s2.transcript, j.punchline, j.keywords);
      live.textContent = '完成！';

      const total = Math.round(sc1.total * 0.3 + sc2.total * 0.7);
      mark(j.id, 'perform', total);
      const delay = s2.startDelay;
      let rhythm = '沒有偵測到接話時間';
      if (delay != null) {
        const sec = (delay / 1000).toFixed(1);
        rhythm = delay < 400 ? `${sec} 秒：接太快了，試著讓搭檔的問句「落地」再開口。`
          : delay <= 1800 ? `${sec} 秒：節奏剛好 👍`
          : `${sec} 秒：停太久，觀眾會以為你忘詞了。`;
      }
      out.innerHTML = `
        <div class="result">
          <div class="big">${total}<small> 分</small></div>
          <table>
            <tr><th>鋪陳</th><td>${sc1.total} 分</td><td class="small">「${esc(s1.transcript || '（沒聽到）')}」</td></tr>
            <tr><th>笑點</th><td>${sc2.total} 分</td><td class="small">「${esc(s2.transcript || '（沒聽到）')}」</td></tr>
            <tr><th>接話</th><td colspan="2" class="small">${rhythm}</td></tr>
          </table>
          <p class="small">${sc2.hit ? '✅ 有講到關鍵詞，笑點成立。' : '⚠️ 笑點少了關鍵詞「' + esc(j.keywords[0]) + '」，雙關就不成立了。'}</p>
        </div>`;
    } catch (e) {
      live.textContent = e.message;
    }
    startBtn.disabled = false;
    startBtn.textContent = '🔁 再來一次';
  }

  // ---------- 創作工坊 ----------
  function create() {
    const myJokes = store.get('myjokes', []);
    view.innerHTML = `
      <h1>創作工坊</h1>
      <p class="hint">用同樣的公式，寫出你自己的雙關段子。</p>

      <section class="card">
        <h2>① 選一個雙關詞</h2>
        <div class="word-bank">${WORD_BANK.map((w, i) => `<button class="chip-btn" data-i="${i}">${esc(w.word)}</button>`).join('')}</div>
        <input id="fWord" placeholder="或自己輸入一個詞，例如：翻身">
        <div class="split">
          <label class="side a">意思 A（觀眾會想到的）<input id="fA"></label>
          <label class="side b">意思 B（你要偷換的）<input id="fB"></label>
        </div>
        <details id="exampleBox" hidden><summary>看範例</summary><p id="example"></p></details>
      </section>

      <section class="card">
        <h2>② 寫鋪陳與反轉</h2>
        <div class="pattern-pick">
          <label><input type="radio" name="pat" value="1"> 公式1：同詞雙解</label>
          <label><input type="radio" name="pat" value="2" checked> 公式2：怪規定＋成語理由</label>
        </div>
        <p class="small" id="patHint"></p>
        <label>鋪陳<textarea id="fSetup" rows="2"></textarea></label>
        <label>反轉（笑點）<textarea id="fPunch" rows="2" placeholder="因為……"></textarea></label>
        <label>加碼（可省略）<input id="fTag"></label>
        <div id="check" class="check"></div>
        <div class="row" id="createBtns"></div>
      </section>

      <h2 class="section-title">我的段子（${myJokes.length}）</h2>
      <div id="myList">${myJokes.length ? '' : '<p class="small">還沒有作品，寫一個吧！</p>'}</div>`;

    const f = (id) => $('#' + id);
    const patHint = () => {
      const p = document.querySelector('input[name=pat]:checked').value;
      f('patHint').textContent = PATTERNS[p].formula;
      f('fSetup').placeholder = p === '1' ? '例：從我認識他那天開始，我就覺得這輩子太短了。' : '例：他叫我颱風天一定要帶四千萬。';
    };
    document.querySelectorAll('input[name=pat]').forEach((r) => (r.onchange = patHint));
    patHint();

    view.querySelectorAll('.chip-btn').forEach((b) => {
      b.onclick = () => {
        const w = WORD_BANK[b.dataset.i];
        f('fWord').value = w.word; f('fA').value = w.a; f('fB').value = w.b;
        f('exampleBox').hidden = false; f('example').textContent = w.example;
        check();
      };
    });

    function check() {
      const word = f('fWord').value.trim();
      const setup = f('fSetup').value.trim();
      const punch = f('fPunch').value.trim();
      const items = [
        [!!word, '選好雙關詞'],
        [!!(f('fA').value.trim() && f('fB').value.trim()), '寫出兩種意思'],
        [!!setup, '有鋪陳'],
        [!!punch && (!word || punch.includes(word) || setup.includes(word)), '鋪陳或笑點裡有出現關鍵詞'],
        [!punch || punch.length <= 20, '笑點夠短（20 字內，越短越有力）']
      ];
      f('check').innerHTML = items.map(([ok, t]) => `<span class="${ok ? 'ok' : ''}">${ok ? '✅' : '⬜'} ${t}</span>`).join('');
    }
    ['fWord', 'fA', 'fB', 'fSetup', 'fPunch'].forEach((id) => (f(id).oninput = check));
    check();

    const btns = f('createBtns');
    if (Speech.sttSupported) {
      const m1 = micToField(f('fSetup')); m1.textContent = '🎤 說鋪陳';
      const m2 = micToField(f('fPunch')); m2.textContent = '🎤 說笑點';
      btns.append(m1, m2);
    }
    if (Speech.ttsSupported) {
      btns.append(speakBtn('🔊 聽聽看', () => Speech.play(performanceScript({ setup: f('fSetup').value, punchline: f('fPunch').value, tag: f('fTag').value }))));
    }
    btns.append(
      speakBtn('💾 儲存', () => {
        if (!f('fSetup').value.trim() || !f('fPunch').value.trim()) return alert('鋪陳和笑點都要寫喔');
        myJokes.unshift({
          word: f('fWord').value.trim(), a: f('fA').value.trim(), b: f('fB').value.trim(),
          setup: f('fSetup').value.trim(), punchline: f('fPunch').value.trim(), tag: f('fTag').value.trim(),
          date: new Date().toISOString().slice(0, 10)
        });
        store.set('myjokes', myJokes);
        create();
      }, 'primary')
    );

    renderMyList(myJokes);
  }

  function renderMyList(myJokes) {
    const list = $('#myList');
    myJokes.forEach((m, i) => {
      const el = document.createElement('div');
      el.className = 'card my-joke';
      el.innerHTML = `
        <div class="small">${esc(m.date)}${m.word ? '・🔑 ' + esc(m.word) : ''}</div>
        <p class="line setup">${esc(m.setup)}</p>
        <p class="line punch">${esc(m.punchline)}</p>
        ${m.tag ? `<p class="line tag">${esc(m.tag)}</p>` : ''}
        <div class="row"></div>`;
      const row = el.querySelector('.row');
      if (Speech.ttsSupported) row.append(speakBtn('🔊', () => Speech.play(performanceScript(m)), 'ghost'));
      row.append(speakBtn('🗑', () => {
        if (!confirm('刪除這個段子？')) return;
        myJokes.splice(i, 1);
        store.set('myjokes', myJokes);
        create();
      }, 'ghost'));
      list.append(el);
    });
  }

  // ---------- 笑點收集本 ----------
  const TYPE_OPTIONS = THEORY.types.map((t) => t.name);

  function collect() {
    const notes = store.get('notes', []);
    view.innerHTML = `
      <h1>笑點收集本</h1>
      <p class="hint">聽到好笑的話，當下就記下來。重點不是數量，是寫下「為什麼好笑」。</p>
      <section class="card">
        <label>好笑的那一句<textarea id="nText" rows="2" placeholder="例：壞事要中午做，因為早晚會有報應。"></textarea></label>
        <label>前情提要（可省略）<input id="nContext" placeholder="誰說的、在什麼情境"></label>
        <label>為什麼好笑？<textarea id="nWhy" rows="2" placeholder="例：「早晚」被照字面解讀成早上和晚上"></textarea></label>
        <div class="split">
          <label>技巧類型<select id="nType">${TYPE_OPTIONS.map((t) => `<option>${esc(t)}</option>`).join('')}<option>其他</option></select></label>
          <label>來源<input id="nSource" placeholder="節目 / Podcast / 朋友"></label>
        </div>
        <div class="row" id="nBtns"></div>
      </section>
      <div class="row filter">
        <select id="nFilter"><option value="">全部類型</option>${TYPE_OPTIONS.map((t) => `<option>${esc(t)}</option>`).join('')}<option>其他</option></select>
        <button class="btn ghost" id="nExport">⬇️ 匯出</button>
      </div>
      <div id="nList"></div>`;

    const btns = $('#nBtns');
    if (Speech.sttSupported) { const m = micToField($('#nText')); m.textContent = '🎤 語音記錄'; btns.append(m); }
    btns.append(speakBtn('💾 收進本子', () => {
      const text = $('#nText').value.trim();
      if (!text) return alert('先寫下那句好笑的話');
      notes.unshift({
        text, context: $('#nContext').value.trim(), why: $('#nWhy').value.trim(),
        type: $('#nType').value, source: $('#nSource').value.trim(), date: new Date().toISOString().slice(0, 10)
      });
      store.set('notes', notes);
      collect();
    }, 'primary'));

    const list = $('#nList');
    const render = () => {
      const ft = $('#nFilter').value;
      const shown = notes.map((n, i) => [n, i]).filter(([n]) => !ft || n.type === ft);
      list.innerHTML = shown.length ? '' : '<p class="small">還沒有收集，今天先找 3 句吧！</p>';
      shown.forEach(([n, i]) => {
        const el = document.createElement('div');
        el.className = 'card note';
        el.innerHTML = `
          <div class="small">${esc(n.date)}・<span class="chip">${esc(n.type)}</span>${n.source ? '・' + esc(n.source) : ''}</div>
          ${n.context ? `<p class="small">${esc(n.context)}</p>` : ''}
          <p class="line setup">${esc(n.text)}</p>
          ${n.why ? `<p class="why">💡 ${esc(n.why)}</p>` : '<p class="why warn">💡 還沒寫為什麼好笑</p>'}
          <div class="row"></div>`;
        const row = el.querySelector('.row');
        if (Speech.ttsSupported) row.append(speakBtn('🔊', () => Speech.play([{ text: n.text, ...A() }]), 'ghost'));
        row.append(speakBtn('✍️ 改寫成我的', () => {
          sessionStorage.setItem('sfh-draft', n.text);
          location.hash = '#/create';
        }, 'ghost'));
        row.append(speakBtn('🗑', () => {
          if (!confirm('刪除這則？')) return;
          notes.splice(i, 1); store.set('notes', notes); collect();
        }, 'ghost'));
        list.append(el);
      });
    };
    $('#nFilter').onchange = render;
    $('#nExport').onclick = () => {
      const txt = notes.map((n) => `[${n.date}] (${n.type}) ${n.text}\n  為什麼好笑：${n.why || '-'}\n  來源：${n.source || '-'} ${n.context || ''}`).join('\n\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
      a.download = '笑點收集本.txt';
      a.click();
    };
    render();
  }

  // ---------- 幽默原理 ----------
  function theory() {
    const T = THEORY;
    view.innerHTML = `
      <a class="back" href="#/">← 返回</a>
      <h1>幽默原理</h1>
      <section class="card">
        <h2>為什麼人會笑？四大理論</h2>
        ${T.why.map((w) => `<details><summary>${esc(w.name)}</summary><p>${esc(w.body)}</p></details>`).join('')}
      </section>
      <section class="card">
        <h2>常見幽默技巧</h2>
        <ul class="types">${T.types.map((t) => `<li><b>${esc(t.name)}</b><span>${esc(t.eg)}</span></li>`).join('')}</ul>
      </section>
      <section class="card">
        <h2>沒有幽默感？可以這樣練</h2>
        <ol class="steps">${T.train.map((t) => `<li><b>${esc(t.name)}</b>：${esc(t.body)}</li>`).join('')}</ol>
      </section>
      <section class="card">
        <h2>怎麼收集好笑的片段</h2>
        <ul class="steps">${T.collect.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
        <a class="btn primary" href="#/collect">打開笑點收集本 →</a>
      </section>`;
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
        <label>主角聲音（你）<select id="sA">${opts(settings.voiceA)}</select></label>
        <label>搭檔聲音<select id="sB">${opts(settings.voiceB)}</select></label>
        <label>語速 <output id="oRate">${settings.rate}</output><input type="range" id="sRate" min="0.6" max="1.4" step="0.05" value="${settings.rate}"></label>
        <label>笑點前停頓 <output id="oPause">${(settings.pause / 1000).toFixed(1)} 秒</output><input type="range" id="sPause" min="0" max="2500" step="100" value="${settings.pause}"></label>
        <div class="row" id="sTest"></div>
        <p class="small">語音辨識：${Speech.sttSupported ? '✅ 支援' : '❌ 不支援'}　錄音：${Speech.recSupported ? '✅ 支援' : '❌ 不支援'}</p>
      </section>
      <section class="card">
        <h2>資料</h2>
        <p class="small">所有進度、作品、收集本都只存在這台裝置的瀏覽器裡。</p>
        <button class="btn ghost" id="reset">重設學習進度</button>
      </section>`;
    const save = () => store.set('settings', settings);
    $('#sA').onchange = (e) => { settings.voiceA = e.target.value; save(); };
    $('#sB').onchange = (e) => { settings.voiceB = e.target.value; save(); };
    $('#sRate').oninput = (e) => { settings.rate = +e.target.value; $('#oRate').textContent = settings.rate; save(); };
    $('#sPause').oninput = (e) => { settings.pause = +e.target.value; $('#oPause').textContent = (settings.pause / 1000).toFixed(1) + ' 秒'; save(); };
    if (Speech.ttsSupported) $('#sTest').append(speakBtn('🔊 試聽', () => Speech.play(dialogScript(JOKES[0]))));
    $('#reset').onclick = () => {
      if (!confirm('確定要清除學習進度？（作品與收集本會保留）')) return;
      Object.keys(progress).forEach((k) => delete progress[k]);
      saveProgress();
      alert('已重設');
    };
  }

  // 從收集本「改寫成我的」帶入草稿
  const _create = create;
  routes.create = function () {
    _create();
    const draft = sessionStorage.getItem('sfh-draft');
    if (draft) {
      sessionStorage.removeItem('sfh-draft');
      const box = document.createElement('div');
      box.className = 'notice';
      box.textContent = '參考原句：' + draft + '　→ 找出裡面的關鍵詞，換一個情境寫成你的版本！';
      view.insertBefore(box, view.children[2]);
    }
  };

  // ---------- 啟動 ----------
  Speech.init(() => { if (location.hash.startsWith('#/settings')) settingsPage(); });
  router();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
