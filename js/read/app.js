// 🔊 朗讀室：貼上文字或開啟 .txt，逐段朗讀（移植自 wordstovoice）
(function () {
  const { $, view, store, esc, today, speakBtn } = App;

  // ---------- 文字切段（同 wordstovoice 的 notes_web/build.py） ----------
  const ENDINGS = '。！？!?：:」』）)…—';
  const isHeading = (t) => t.length <= 30 && !ENDINGS.includes(t[t.length - 1]);

  function splitBlocks(text) {
    const blocks = [];
    for (const chunk of text.split(/\n\s*\n/)) {
      const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) continue;
      // 每一行都是短句時（條列、目錄、標題），一行一個區塊
      if (lines.length > 1 && lines.every((l) => l.length <= 60)) blocks.push(...lines);
      else blocks.push(lines.join(''));
    }
    return blocks;
  }

  // 開啟 .txt：自動辨識 UTF-8 / Big5 / GB18030
  async function readTxt(file) {
    const buf = await file.arrayBuffer();
    for (const enc of ['utf-8', 'big5', 'gb18030']) {
      try { return new TextDecoder(enc, { fatal: true }).decode(buf); } catch (_) {}
    }
    return new TextDecoder('utf-8').decode(buf);
  }

  // ---------- 內建文稿：從其他單元的內容產生 ----------
  function builtins() {
    const humor = {
      id: 'b-humor', title: '😄 幽默段子原稿', builtin: true,
      items: window.JOKES.flatMap((j) => [{ t: 'h', x: j.title }].concat(
        j.dialog.map((l) => ({ t: 'p', x: l.t, label: l.s === 'A' ? '主角' : '搭檔' }))
      ))
    };
    const speak = {
      id: 'b-speak', title: '🗣️ 說話五公式', builtin: true,
      items: window.SPEAK_DAYS.flatMap((d) => [
        { t: 'h', x: `Day ${d.day} ${d.title}：${d.formula.join(' → ')}` },
        { t: 'p', x: d.why, label: '為什麼' },
        { t: 'p', x: d.demo.map((s) => s.text).join(''), label: '示範' }
      ].concat(d.examples.map((e) => ({ t: 'p', x: e.good, label: '範例' }))))
    };
    const shadow = {
      id: 'b-shadow', title: '🔁 跟讀稿', builtin: true,
      items: window.SHADOW_PASSAGES.flatMap((p) => [{ t: 'h', x: p.title }, { t: 'p', x: p.text }])
    };
    return [humor, speak, shadow];
  }
  const userDocs = () => store.get('read-docs', []);
  const toItems = (text) => splitBlocks(text).map((b) => ({ t: isHeading(b) ? 'h' : 'p', x: b }));
  const findDoc = (id) => builtins().find((d) => d.id === id) || userDocs().find((d) => d.id === id);

  // ---------- 文稿列表 ----------
  function home() {
    const docs = userDocs();
    view.innerHTML = `
      <section class="hero">
        <h1>朗讀室</h1>
        <p>貼上任何文字或開啟 .txt 檔，逐段朗讀。可連續播放、每句念三遍、標出正在念的句子。</p>
      </section>
      <a class="btn primary" href="#/read/new">＋ 新增文稿</a>
      <h2 class="section-title">內建文稿</h2>
      <div class="list">${builtins().map(docItem).join('')}</div>
      <h2 class="section-title">我的文稿（${docs.length}）</h2>
      <div class="list">${docs.length ? docs.map(docItem).join('') : '<p class="small">還沒有文稿。可以貼上逐字稿、講稿、文章。</p>'}</div>`;
  }
  function docItem(d) {
    const items = d.items || toItems(d.text);
    const n = items.filter((i) => i.t === 'p').length;
    const chars = items.reduce((a, i) => a + i.x.length, 0);
    return `<a class="day-item" href="#/read/doc/${esc(d.id)}"><span class="num">📄</span>
      <span class="body"><b>${esc(d.title)}</b><small>${n} 段・約 ${chars} 字・約 ${Math.max(1, Math.round(chars / 270))} 分鐘${d.at ? '・' + esc(d.at) : ''}</small></span></a>`;
  }

  // ---------- 新增／編輯 ----------
  function edit(id) {
    const docs = userDocs();
    const doc = id ? docs.find((d) => d.id === id) : null;
    view.innerHTML = `
      <a class="back" href="#/read">← 朗讀室</a>
      <h1>${doc ? '編輯文稿' : '新增文稿'}</h1>
      <section class="card">
        <label>標題<input id="dTitle" value="${esc(doc ? doc.title : '')}" placeholder="例：主持稿、課本第三課"></label>
        <label class="file-pick">開啟 .txt 檔（自動辨識 UTF-8／Big5／簡體）<input type="file" id="dFile" accept=".txt,text/plain"></label>
        <label>內容<textarea id="dText" rows="12" placeholder="貼上文字。空一行代表分段；30 字以內、沒有句號結尾的短行會當成標題。">${esc(doc ? doc.text : '')}</textarea></label>
        <p class="small" id="dInfo"></p>
        <div class="row" id="dBtns"></div>
      </section>`;
    const info = () => {
      const t = $('#dText').value;
      const items = toItems(t);
      $('#dInfo').textContent = t.trim() ? `${items.filter((i) => i.t === 'p').length} 段、${items.filter((i) => i.t === 'h').length} 個標題、${t.length} 字` : '';
    };
    $('#dText').oninput = info;
    info();
    $('#dFile').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      $('#dText').value = await readTxt(f);
      if (!$('#dTitle').value) $('#dTitle').value = f.name.replace(/\.txt$/i, '');
      info();
    };
    $('#dBtns').append(speakBtn('💾 儲存', () => {
      const text = $('#dText').value.trim();
      if (!text) return alert('請貼上內容');
      const title = $('#dTitle').value.trim() || text.slice(0, 15);
      if (doc) Object.assign(doc, { title, text, at: today() });
      else docs.unshift({ id: 'd' + Date.now(), title, text, at: today() });
      store.set('read-docs', docs);
      location.hash = '#/read/doc/' + (doc ? doc.id : docs[0].id);
    }, 'primary'));
    if (doc) {
      $('#dBtns').append(speakBtn('🗑 刪除', () => {
        if (!confirm('刪除這份文稿？')) return;
        store.set('read-docs', docs.filter((d) => d.id !== doc.id));
        location.hash = '#/read';
      }, 'ghost'));
    }
  }

  // ---------- 閱讀 ----------
  function doc(id) {
    const d = findDoc(id);
    if (!d) return (location.hash = '#/read');
    const items = d.items || toItems(d.text);
    const posKey = 'read-pos-' + d.id;
    view.innerHTML = `
      <a class="back" href="#/read">← 朗讀室</a>
      <h1>${esc(d.title)}</h1>
      <div class="row" id="docBtns"></div>
      <div id="docBody" class="doc-body"></div>`;
    view.insertBefore(Reader.playerBar(), $('#docBtns'));

    const body = $('#docBody');
    let p = 0;
    for (const it of items) {
      if (it.t === 'h') {
        const h = document.createElement('h2');
        h.className = 'doc-h';
        h.textContent = it.x;
        body.append(h);
      } else {
        const b = Reader.block(it.x, { label: it.label, html: markHtml });
        b.dataset.idx = p++;
        body.append(b);
      }
    }
    // 記住最後念到哪一段
    body.addEventListener('reader:play', (e) => store.set(posKey, +e.target.dataset.idx));

    const btns = $('#docBtns');
    const pos = store.get(posKey, null);
    if (pos != null && pos > 0) {
      btns.append(speakBtn('↓ 跳到上次位置', () => {
        const el = body.querySelector(`[data-idx="${pos}"]`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 1800);
      }));
    }
    if (!d.builtin) btns.append(speakBtn('✏️ 編輯', () => (location.hash = '#/read/edit/' + d.id), 'ghost'));
  }

  // 跟讀記號：【】加重顯示成粗體、｜停頓顯示淡色（記號字元保留但隱藏，畫線位置才對得上）
  function markHtml(s) {
    return esc(s)
      .replace(/【(.+?)】/g, '<span class="mk">【</span><strong>$1</strong><span class="mk">】</span>')
      .replace(/｜/g, '<span class="pause">｜</span>');
  }
  window.Reader.markHtml = markHtml;

  App.register({
    id: 'read',
    name: '朗讀室',
    short: '朗讀',
    emoji: '🔊',
    tagline: '貼上文字或開啟 .txt，逐段朗讀：連續播放、每句三遍、跟著畫線。',
    summary: () => `我的文稿 ${userDocs().length} 份`,
    tabs: [
      { page: '', icon: '📚', label: '文稿', match: ['', 'doc', 'edit'] },
      { page: 'new', icon: '＋', label: '新增' }
    ],
    pages: { '': home, new: () => edit(), edit, doc }
  });
})();
