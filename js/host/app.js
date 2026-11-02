// 🎙️ 主持訓練單元（規劃中）
// 之後加入內容時：在 js/host/data.js 放課程資料，在這裡把 status 改成 'ready' 並加上頁面與分頁。
(function () {
  const { view, esc } = App;

  const PLAN = [
    { icon: '👋', title: '開場白', desc: '30 秒抓住全場：自我介紹、點出主題、帶動氣氛。' },
    { icon: '🔗', title: '串場與過場', desc: '把上一段接到下一段，不冷場、不生硬。' },
    { icon: '🎤', title: '介紹來賓', desc: '用三句話讓台下對來賓產生期待。' },
    { icon: '❓', title: '訪問提問', desc: '開放式問題、追問、把話題拉回主軸。' },
    { icon: '🧯', title: '控場與冷場救援', desc: '設備出錯、來賓卡住、時間超過時怎麼救。' },
    { icon: '😄', title: '幽默互動', desc: '把幽默單元學到的梗，用在主持現場。' },
    { icon: '🎬', title: '結尾收場', desc: '總結重點、感謝、留下記憶點（會用到說話單元 Day 5）。' }
  ];

  function home() {
    view.innerHTML = `
      <section class="hero">
        <h1>主持訓練 <span class="chip">即將推出</span></h1>
        <p>這個單元還在規劃中。下面是預計的課程，內容準備好後就會開放。</p>
      </section>
      <div class="list">
        ${PLAN.map((p) => `<div class="day-item soon"><span class="num">${p.icon}</span>
          <span class="body"><b>${esc(p.title)}</b><small>${esc(p.desc)}</small></span></div>`).join('')}
      </div>
      <section class="card">
        <h2>會用到的語音功能</h2>
        <ul class="steps">
          <li>計時口說：開場 30 秒、串場 15 秒倒數</li>
          <li>模擬現場：App 扮演來賓回答，你接著追問</li>
          <li>突發狀況卡：隨機抽一張狀況，立刻口頭救場</li>
        </ul>
      </section>`;
  }

  App.register({
    id: 'host',
    name: '主持訓練',
    short: '主持',
    emoji: '🎙️',
    status: 'soon',
    tagline: '開場、串場、訪問、控場、收尾。',
    tabs: [{ page: '', icon: '📋', label: '課程規劃' }],
    pages: { '': home }
  });
})();
