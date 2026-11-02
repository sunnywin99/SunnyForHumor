// 🗣️ 說話訓練單元：5 天 5 個公式、跟接練習、跟讀、睡前口述日記
(function () {
  const { $, view, store, settings, esc, shuffle, today, fmt, A, B, speakBtn, noSupport, micToField } = App;
  const DAYS = window.SPEAK_DAYS;

  // ---------- 進度 ----------
  const progress = store.get('speak-progress', {}); // { [day]: 完成次數 }
  const done = (d) => progress[d] || 0;
  const addDone = (d) => { progress[d] = done(d) + 1; store.set('speak-progress', progress); };
  const finished = (day) => done(day.day) >= day.task.rounds;

  // ---------- 小元件 ----------
  const chain = (formula) =>
    `<div class="chain">${formula.map((f, i) => `<span class="f-step s${i}">${esc(f)}</span>`).join('<span class="arrow">→</span>')}</div>`;

  const detectHtml = (text, rules = []) =>
    rules.map((r) => {
      const ok = new RegExp(r.re).test(text);
      return `<span class="det ${ok ? 'ok' : ''}">${ok ? '✅' : '⬜'} ${esc(r.label)}</span>`;
    }).join('');

  const checklist = (items) =>
    `<div class="checklist">${items.map((c) => `<label><input type="checkbox"> ${esc(c)}</label>`).join('')}</div>`;

  // 把示範句依段落上色
  const demoHtml = (demo) =>
    `<p class="demo">${demo.map((d, i) => `<span class="seg s${i}" title="${esc(d.part)}">${esc(d.text)}</span>`).join('')}</p>
     <div class="legend-row">${demo.map((d, i) => `<span class="seg-dot s${i}">${esc(d.part)}</span>`).join('')}</div>`;

  // 計時口說：開始後倒數，語音辨識全程轉文字；或改用錄音回放
  function timedSpeak({ seconds, detect = [], onDone }) {
    const el = document.createElement('div');
    el.className = 'timed';
    el.innerHTML = `
      <div class="timer"><div class="bar"></div><span class="time">${fmt(seconds)}</span></div>
      <div class="row btns"></div>
      <div class="live small" hidden></div>
      <div class="out"></div>`;
    const bar = el.querySelector('.bar');
    const time = el.querySelector('.time');
    const live = el.querySelector('.live');
    const out = el.querySelector('.out');
    const btns = el.querySelector('.btns');
    let tick = null;

    const startClock = (onEnd) => {
      const t0 = Date.now();
      bar.style.width = '0%';
      tick = setInterval(() => {
        const used = (Date.now() - t0) / 1000;
        bar.style.width = Math.min(100, (used / seconds) * 100) + '%';
        time.textContent = fmt(seconds - used);
        if (used >= seconds) { stopClock(); onEnd && onEnd(); }
      }, 200);
    };
    const stopClock = () => { clearInterval(tick); tick = null; };
    const setBusy = (busy) => btns.querySelectorAll('button').forEach((b) => (b.disabled = busy && !b.classList.contains('stop')));

    let endRec = null;
    const stopBtn = speakBtn('⏹ 說完了', () => { Speech.stopListening(); endRec && endRec(); }, 'ghost stop');
    stopBtn.hidden = true;

    if (Speech.sttSupported) {
      btns.append(speakBtn('🎤 開始說（轉文字）', async () => {
        out.innerHTML = '';
        live.hidden = false;
        live.textContent = '開始說吧…';
        setBusy(true); stopBtn.hidden = false;
        startClock();
        try {
          const r = await Speech.listen({ continuous: true, maxMs: seconds * 1000, onInterim: (t) => (live.textContent = t) });
          stopClock();
          live.hidden = true;
          const text = r.transcript;
          out.innerHTML = text
            ? `<div class="transcript">${esc(text)}</div><div class="dets">${detectHtml(text, detect)}</div>`
            : '<p class="small">沒有聽到聲音，再試一次。</p>';
          if (text) onDone && onDone(text);
        } catch (e) {
          stopClock();
          live.textContent = e.message;
        }
        setBusy(false); stopBtn.hidden = true;
      }, 'primary'));
    }

    if (Speech.recSupported) {
      btns.append(speakBtn('⏺ 錄音（可回放）', async () => {
        out.innerHTML = '';
        let stopRec;
        try { stopRec = await Speech.record(); } catch (e) { return alert('無法使用麥克風：' + e.message); }
        setBusy(true); stopBtn.hidden = false;
        const end = async () => {
          if (!stopRec) return;
          const fn = stopRec; stopRec = null; endRec = null;
          stopClock();
          const url = await fn();
          out.innerHTML = `<audio controls src="${url}"></audio><p class="small">回放聽聽看：有沒有按順序說？</p>`;
          setBusy(false); stopBtn.hidden = true;
          onDone && onDone('');
        };
        endRec = end;
        startClock(end);
      }));
    }
    btns.append(stopBtn);
    if (!Speech.sttSupported && !Speech.recSupported) btns.innerHTML = noSupport('語音辨識與錄音');
    return el;
  }

  // ---------- 首頁 ----------
  function home() {
    const total = DAYS.filter(finished).length;
    view.innerHTML = `
      <section class="hero">
        <h1>說話訓練</h1>
        <p>表達不是靠天賦，是靠<b>固定的出口順序</b>。5 天、每天 10 分鐘，練順 5 個最常用的說話公式。</p>
        <div class="meter"><div style="width:${(total / DAYS.length) * 100}%"></div></div>
        <small>已完成 ${total} / ${DAYS.length} 天</small>
      </section>

      <div class="list">
        ${DAYS.map((d) => `
          <a class="day-item ${finished(d) ? 'done' : ''}" href="#/speak/day/${d.day}">
            <span class="num">D${d.day}</span>
            <span class="body"><b>${esc(d.title)}</b><small>${esc(d.goal)}・${d.formula.map(esc).join(' → ')}</small></span>
            <span class="count">${Math.min(done(d.day), d.task.rounds)}/${d.task.rounds}</span>
          </a>`).join('')}
      </div>

      <section class="card">
        <h2>公式小抄</h2>
        <table class="cheat">
          ${DAYS.map((d) => `<tr><th>${esc(d.title)}</th><td>${d.formula.map(esc).join(' → ')}</td></tr>`).join('')}
        </table>
      </section>

      <h2 class="section-title">每天的延伸練習</h2>
      <div class="list">
        <a class="day-item" href="#/speak/reply"><span class="num">💬</span><span class="body"><b>跟接練習</b><small>App 說一句，你接一句（回應 → 感受 → 追問）</small></span></a>
        <a class="day-item" href="#/speak/shadow"><span class="num">🔁</span><span class="body"><b>跟讀 1 分鐘</b><small>模仿停頓與加重，也可以貼上訪問稿</small></span></a>
        <a class="day-item" href="#/speak/diary"><span class="num">🌙</span><span class="body"><b>睡前口述日記</b><small>3 題 × 30 秒，連續練最重要</small></span></a>
      </div>`;
  }

  // ---------- 每日課程 ----------
  function dayPage(n) {
    const d = DAYS.find((x) => x.day === +n) || DAYS[0];
    const idx = DAYS.indexOf(d);
    view.innerHTML = `
      <a class="back" href="#/speak">← 5 天課程</a>
      <h1>Day ${d.day}　${esc(d.title)} <small>${esc(d.goal)}</small></h1>
      ${chain(d.formula)}
      <p>${esc(d.why)}</p>

      <section class="card">
        <h2>示範</h2>
        ${demoHtml(d.demo)}
        <div class="row" id="demoBtns"></div>
      </section>

      <section class="card">
        <h2>改之前 vs 改之後</h2>
        <div id="examples"></div>
      </section>

      <div id="special"></div>

      <section class="card">
        <h2>今日任務 <small>${Math.min(done(d.day), d.task.rounds)} / ${d.task.rounds}</small></h2>
        <p>${esc(d.task.text)}</p>
        <div id="topicBox"></div>
        <div id="timed"></div>
        <h3 class="label">說完自我檢查</h3>
        ${checklist(d.check)}
      </section>

      <p class="takeaway">💡 ${esc(d.takeaway)}</p>
      <nav class="pager">
        ${idx > 0 ? `<a class="btn ghost" href="#/speak/day/${DAYS[idx - 1].day}">← Day ${DAYS[idx - 1].day}</a>` : '<span></span>'}
        ${idx < DAYS.length - 1 ? `<a class="btn ghost" href="#/speak/day/${DAYS[idx + 1].day}">Day ${DAYS[idx + 1].day} →</a>` : '<span></span>'}
      </nav>`;

    if (Speech.ttsSupported) {
      $('#demoBtns').append(
        speakBtn('🔊 聽示範', () => Speech.play(d.demo.flatMap((s, i) => (i ? [{ pause: 350 }] : []).concat([{ text: s.text, ...A() }])))),
        speakBtn('⏹', () => Speech.stop(), 'ghost')
      );
    }

    // 範例
    const ex = $('#examples');
    d.examples.forEach((e) => {
      const el = document.createElement('div');
      el.className = 'compare';
      el.innerHTML = `
        ${e.said ? `<p class="small">對方：「${esc(e.said)}」</p>` : ''}
        ${e.bad ? `<div class="side a"><div class="label">❌ 改之前</div>${esc(e.bad)}</div>` : ''}
        <div class="side b"><div class="label">✅ ${e.bad ? '改之後' : '範例'}</div>${esc(e.good)}</div>
        <div class="row"></div>`;
      if (Speech.ttsSupported) {
        const row = el.querySelector('.row');
        if (e.bad) row.append(speakBtn('🔊 改之前', () => Speech.play([{ text: e.bad, ...A(), rate: settings.rate * 0.95 }]), 'ghost'));
        row.append(speakBtn('🔊 ' + (e.bad ? '改之後' : '聽範例'), () => Speech.play([{ text: e.good, ...A() }]), 'ghost'));
      }
      ex.append(el);
    });

    // 各天專屬練習
    const sp = $('#special');
    if (d.day === 1) sp.append(rewriteCard(d));
    if (d.day === 2) sp.innerHTML = `<section class="card"><h2>💬 跟接練習</h2><p class="small">今天的任務在「跟接練習」完成：App 說一句，你接一句，自動計次。</p><a class="btn primary" href="#/speak/reply">開始跟接 →</a></section>`;
    if (d.day === 4) sp.append(persuadeCard());
    if (d.day === 5) sp.append(slowFastCard(d));

    // 題目 + 計時口說（Day 2 改在跟接頁）
    if (d.day !== 2) {
      const topics = d.day === 4 ? (store.get('speak-persuade', []).filter(Boolean).concat(d.topics)) : d.topics;
      let i = Math.floor(Math.random() * topics.length);
      const tb = $('#topicBox');
      const renderTopic = () => {
        tb.innerHTML = `<div class="topic"><span>題目</span><b>${esc(topics[i])}</b></div>`;
        tb.firstChild.append(speakBtn('🔀 換一題', () => { i = (i + 1) % topics.length; renderTopic(); }, 'ghost'));
      };
      renderTopic();
      $('#timed').append(timedSpeak({ seconds: d.task.seconds, detect: d.detect, onDone: () => { addDone(d.day); updateCount(d); } }));
    } else {
      $('#timed').innerHTML = '<a class="btn primary" href="#/speak/reply">去跟接練習 →</a>';
    }
  }

  function updateCount(d) {
    view.querySelectorAll('section.card h2').forEach((h2) => {
      if (h2.textContent.startsWith('今日任務')) h2.querySelector('small').textContent = `${Math.min(done(d.day), d.task.rounds)} / ${d.task.rounds}`;
    });
    if (done(d.day) === d.task.rounds) setTimeout(() => alert(`🎉 Day ${d.day} 完成！`), 100);
  }

  // Day 1：改寫繞圈子的句子
  function rewriteCard(d) {
    const el = document.createElement('section');
    el.className = 'card';
    el.innerHTML = '<h2>✏️ 改寫練習</h2><p class="small">把繞圈子的話改成「結論 → 原因 → 行動」。</p>';
    d.rewrite.forEach((r) => {
      const box = document.createElement('div');
      box.className = 'rewrite';
      box.innerHTML = `
        <div class="side a">${esc(r.bad)}</div>
        <textarea rows="2" placeholder="你的改寫（先說結論）"></textarea>
        <div class="row"></div>
        <div class="model" hidden>參考：${esc(r.model)}</div>`;
      const ta = box.querySelector('textarea');
      const row = box.querySelector('.row');
      if (Speech.sttSupported) row.append(micToField(ta));
      row.append(speakBtn('看參考答案', () => {
        box.querySelector('.model').hidden = false;
        if (Speech.ttsSupported) Speech.play([{ text: r.model, ...A() }]);
      }, 'ghost'));
      el.append(box);
    });
    return el;
  }

  // Day 4：寫下最想說服的 3 件事
  function persuadeCard() {
    const saved = store.get('speak-persuade', ['', '', '']);
    const el = document.createElement('section');
    el.className = 'card';
    el.innerHTML = `<h2>📝 我最想說服的 3 件事</h2>
      <p class="small">寫下來後，會出現在今日任務的題目裡。</p>
      ${[0, 1, 2].map((i) => `<input class="pz" data-i="${i}" value="${esc(saved[i] || '')}" placeholder="例：說服孩子每天練琴 15 分鐘">`).join('')}`;
    el.querySelectorAll('.pz').forEach((inp) => {
      inp.onchange = () => {
        saved[inp.dataset.i] = inp.value.trim();
        store.set('speak-persuade', saved);
      };
    });
    return el;
  }

  // Day 5：慢速／正常速度唸自己的句子
  function slowFastCard(d) {
    const el = document.createElement('section');
    el.className = 'card';
    el.innerHTML = `<h2>🐢 慢速 → 正常速度</h2>
      <p class="small">把你的句子改成「判斷 → 對比 → 短句收尾」，先聽 App 用慢速唸，再用正常語速唸，然後換你。</p>
      <ul class="tips">${d.readTips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <textarea id="myLine" rows="3" placeholder="例：真正讓你累的不是工作多，是你一直在分心。專心是充電，分心是漏電。先關通知。"></textarea>
      <div class="dets" id="myLineDet"></div>
      <div class="row" id="slowBtns"></div>`;
    const ta = el.querySelector('#myLine');
    const det = el.querySelector('#myLineDet');
    ta.oninput = () => (det.innerHTML = detectHtml(ta.value, d.detect));
    const btns = el.querySelector('#slowBtns');
    if (Speech.sttSupported) btns.append(micToField(ta));
    if (Speech.ttsSupported) {
      const parts = () => ta.value.split(/(?<=[。！？!?])/).map((s) => s.trim()).filter(Boolean);
      btns.append(
        speakBtn('🐢 慢速', () => Speech.play(parts().flatMap((p) => [{ text: p, ...A(), rate: settings.rate * 0.7 }, { pause: 500 }]))),
        speakBtn('▶️ 正常', () => Speech.play(parts().flatMap((p) => [{ text: p, ...A() }, { pause: 250 }])))
      );
    }
    return el;
  }

  // ---------- 跟接練習 ----------
  function reply() {
    const day2 = DAYS[1];
    const lines = shuffle(window.REPLY_LINES);
    let i = 0;
    const todayKey = 'speak-reply-' + today();
    let count = store.get(todayKey, 0);

    view.innerHTML = `
      <a class="back" href="#/speak/day/2">← Day 2 把話接住</a>
      <h1>跟接練習</h1>
      ${chain(day2.formula)}
      <div class="meter"><div id="rMeter" style="width:${Math.min(100, (count / 30) * 100)}%"></div></div>
      <small id="rCount">今天 ${count} / 30 次</small>
      <section class="card">
        <div class="label">對方說</div>
        <p class="line big-line" id="rSaid"></p>
        <div class="row" id="rBtns"></div>
        <div class="live small" id="rLive" hidden></div>
        <div id="rOut"></div>
      </section>
      <section class="card">
        <h2>也可以用影片練</h2>
        <p class="small">打開一段訪問或聊天影片，聽到一句就暫停，自己接一句。接完按下面的按鈕計次。</p>
        <button class="btn" id="rManual">＋1 我接了一句</button>
      </section>`;

    const bump = () => {
      count++;
      store.set(todayKey, count);
      addDone(2);
      $('#rCount').textContent = `今天 ${count} / 30 次`;
      $('#rMeter').style.width = Math.min(100, (count / 30) * 100) + '%';
      if (count === 30) setTimeout(() => alert('🎉 今天 30 次跟接完成！'), 100);
    };
    $('#rManual').onclick = bump;

    const show = () => {
      const l = lines[i % lines.length];
      $('#rSaid').textContent = l.said;
      $('#rOut').innerHTML = '';
      const btns = $('#rBtns');
      btns.innerHTML = '';
      const play = () => Speech.ttsSupported ? Speech.speak(l.said, B()) : Promise.resolve();

      if (Speech.sttSupported) {
        const go = speakBtn('🎤 聽完立刻接', async () => {
          go.disabled = true;
          await play();
          const live = $('#rLive');
          live.hidden = false;
          live.textContent = '換你接…';
          try {
            const r = await Speech.listen({ maxMs: day2.task.seconds * 1000, onInterim: (t) => (live.textContent = t) });
            live.hidden = true;
            const t = r.transcript;
            const delay = r.startDelay != null ? (r.startDelay / 1000).toFixed(1) + ' 秒開口' : '';
            $('#rOut').innerHTML = t
              ? `<div class="transcript">${esc(t)}</div><div class="dets">${detectHtml(t, day2.detect)}</div>
                 <p class="small">${delay}</p><p class="model">參考接法：${esc(l.sample)}</p>`
              : '<p class="small">沒聽到，再試一次。</p>';
            if (t) bump();
          } catch (e) { live.textContent = e.message; }
          go.disabled = false;
        }, 'primary');
        btns.append(go);
      } else if (Speech.ttsSupported) {
        btns.append(speakBtn('🔊 再聽一次', play));
      }
      btns.append(
        speakBtn('看參考接法', () => {
          $('#rOut').insertAdjacentHTML('beforeend', `<p class="model">參考接法：${esc(l.sample)}</p>`);
          if (Speech.ttsSupported) Speech.speak(l.sample, A());
        }, 'ghost'),
        speakBtn('下一句 →', () => { i++; show(); }, 'ghost')
      );
    };
    show();
  }

  // ---------- 跟讀 ----------
  function shadow() {
    const custom = store.get('speak-shadow-custom', '');
    const passages = window.SHADOW_PASSAGES.concat(custom ? [{ title: '我貼上的稿子', text: custom }] : []);
    view.innerHTML = `
      <a class="back" href="#/speak">← 說話訓練</a>
      <h1>跟讀練習</h1>
      <p class="hint">重點模仿怎麼<b>停頓</b>（｜）、怎麼<b>加重</b>（粗體）。一句一句跟，再整段跟。</p>
      <div class="select-row"><select id="pSel">${passages.map((p, i) => `<option value="${i}">${esc(p.title)}</option>`).join('')}</select></div>
      <section class="card"><div id="pText" class="passage"></div><div class="row" id="pBtns"></div></section>
      <div id="pSentences"></div>
      <section class="card">
        <h2>貼上自己的稿子</h2>
        <p class="small">可以貼訪問、演講的逐字稿。用「｜」標停頓、用【】標要加重的字。</p>
        <textarea id="pCustom" rows="4" placeholder="例：我覺得｜【堅持】比天分重要。">${esc(custom)}</textarea>
        <button class="btn" id="pSave">儲存</button>
      </section>`;

    const render = () => {
      const p = passages[$('#pSel').value];
      const html = esc(p.text).replace(/【(.+?)】/g, '<strong>$1</strong>').replace(/｜/g, '<span class="pause">｜</span>');
      $('#pText').innerHTML = html;
      const sentences = p.text.split(/(?<=[。！？!?])/).map((s) => s.trim()).filter(Boolean);
      const segs = (s) => s.split('｜').filter((x) => x.trim()).map((x) => ({ text: x.replace(/[【】]/g, ''), ...A(), rate: settings.rate * (/【/.test(x) ? 0.85 : 1) }));
      const withPauses = (s) => segs(s).flatMap((x, i) => (i ? [{ pause: 350 }] : []).concat([x]));

      const btns = $('#pBtns');
      btns.innerHTML = '';
      if (Speech.ttsSupported) {
        btns.append(
          speakBtn('🔊 整段示範', () => Speech.play(sentences.flatMap((s) => withPauses(s).concat([{ pause: 600 }])))),
          speakBtn('⏹', () => Speech.stop(), 'ghost')
        );
      } else btns.innerHTML = noSupport('語音朗讀');

      const list = $('#pSentences');
      list.innerHTML = '';
      sentences.forEach((s) => {
        const plain = s.replace(/[｜【】]/g, '');
        const el = document.createElement('div');
        el.className = 'card sentence';
        el.innerHTML = `<p>${esc(s).replace(/【(.+?)】/g, '<strong>$1</strong>').replace(/｜/g, '<span class="pause">｜</span>')}</p><div class="row"></div><div class="out small"></div>`;
        const row = el.querySelector('.row');
        if (Speech.ttsSupported) row.append(speakBtn('🔊', () => Speech.play(withPauses(s)), 'ghost'));
        if (Speech.sttSupported) {
          const mic = speakBtn('🎤 跟讀', async () => {
            mic.disabled = true;
            const out = el.querySelector('.out');
            out.textContent = '聆聽中…';
            try {
              const r = await Speech.listen({ onInterim: (t) => (out.textContent = t) });
              const sc = Speech.score(r.transcript, plain, []);
              out.innerHTML = `<b>${Math.round(sc.sim * 100)}%</b> 相似　「${esc(r.transcript || '（沒聽到）')}」`;
            } catch (e) { out.textContent = e.message; }
            mic.disabled = false;
          });
          row.append(mic);
        }
        list.append(el);
      });
    };
    $('#pSel').onchange = render;
    $('#pSave').onclick = () => { store.set('speak-shadow-custom', $('#pCustom').value.trim()); shadow(); };
    render();
  }

  // ---------- 睡前口述日記 ----------
  function streak(entries) {
    const dates = new Set(entries.map((e) => e.date));
    let n = 0;
    const d = new Date();
    if (!dates.has(today())) d.setDate(d.getDate() - 1); // 今天還沒練也不中斷
    while (dates.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function diary() {
    const entries = store.get('speak-diary', []);
    const answers = ['', '', ''];
    view.innerHTML = `
      <a class="back" href="#/speak">← 說話訓練</a>
      <h1>睡前口述日記</h1>
      <p class="hint">每晚 3 題、每題 30 秒。時間不用長，但一定要<b>連續</b>練。</p>
      <div class="streak">🔥 連續 <b>${streak(entries)}</b> 天</div>
      <div id="prompts"></div>
      <button class="btn primary" id="dSave">💾 存成今天的日記</button>
      <h2 class="section-title">過去的日記</h2>
      <div id="dList">${entries.length ? '' : '<p class="small">還沒有日記。</p>'}</div>`;

    const box = $('#prompts');
    window.DIARY_PROMPTS.forEach((p, i) => {
      const el = document.createElement('section');
      el.className = 'card';
      el.innerHTML = `<h2>${i + 1}. ${esc(p.q)}</h2><p class="small">${esc(p.hint)}</p><textarea rows="3" placeholder="說完會自動填入，也可以直接打字"></textarea>`;
      const ta = el.querySelector('textarea');
      ta.oninput = () => (answers[i] = ta.value);
      el.append(timedSpeak({ seconds: 30, onDone: (t) => { if (t) { ta.value = t; answers[i] = t; } } }));
      box.append(el);
    });

    $('#dSave').onclick = () => {
      if (!answers.some((a) => a.trim())) return alert('至少說一題喔');
      entries.unshift({ date: today(), answers: answers.map((a) => a.trim()) });
      store.set('speak-diary', entries);
      diary();
    };

    const list = $('#dList');
    entries.forEach((e, idx) => {
      const el = document.createElement('details');
      el.className = 'card';
      el.innerHTML = `<summary>${esc(e.date)}</summary>
        ${e.answers.map((a, i) => (a ? `<p><b>${esc(window.DIARY_PROMPTS[i].q)}</b><br>${esc(a)}</p>` : '')).join('')}`;
      el.append(speakBtn('🗑', () => {
        if (!confirm('刪除這篇日記？')) return;
        entries.splice(idx, 1); store.set('speak-diary', entries); diary();
      }, 'ghost'));
      list.append(el);
    });
  }

  App.register({
    id: 'speak',
    name: '說話訓練',
    short: '說話',
    emoji: '🗣️',
    tagline: '5 天 5 個說話公式：先說結論、把話接住、觀點清楚、說服別人、讓人記住。',
    summary: () => `已完成 ${DAYS.filter(finished).length} / ${DAYS.length} 天・日記連續 ${streak(store.get('speak-diary', []))} 天`,
    reset: () => { Object.keys(progress).forEach((k) => delete progress[k]); store.set('speak-progress', progress); },
    tabs: [
      { page: '', icon: '📅', label: '課程', match: ['', 'day'] },
      { page: 'reply', icon: '💬', label: '跟接' },
      { page: 'shadow', icon: '🔁', label: '跟讀' },
      { page: 'diary', icon: '🌙', label: '日記' }
    ],
    pages: { '': home, day: dayPage, reply, shadow, diary }
  });
})();
