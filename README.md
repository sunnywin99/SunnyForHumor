# Sunny 表達訓練

用語音練習表達的網頁 App，分成三個獨立單元，進度各自記錄：

| 單元 | 內容 | 狀態 |
|---|---|---|
| 😄 幽默訓練 | 拆解段子、場景地圖、猜梗、搭檔對練、創作工坊、笑點收集本 | ✅ |
| 🗣️ 說話訓練 | 5 天 5 個說話公式、跟接練習、跟讀、睡前口述日記 | ✅ |
| 🎙️ 主持訓練 | 開場、串場、訪問、控場、收尾 | 🚧 規劃中 |
| 🔊 朗讀室 | 貼上文字或開啟 .txt（自動辨識 UTF-8／Big5／簡體），逐段朗讀；內建幽默原稿、說話公式、跟讀稿 | ✅ |

## 怎麼開啟

純前端網頁，不用安裝套件。可以部署到 GitHub Pages，用手機打開後「加入主畫面」。

本機測試：

```bash
python3 -m http.server 8000
```

然後打開 http://localhost:8000 。（語音辨識需要 `https` 或 `localhost` 才能使用麥克風。）

## 檔案結構

```
index.html
css/style.css
js/speech.js        語音合成、語音辨識、錄音、評分（所有單元共用）
js/core.js          儲存、模組註冊、路由、訓練中心首頁、設定
js/reader.js        朗讀器：▶❚❚■、連續播放、每句三遍、標出正在念的句子（移植自 wordstovoice）
js/humor/           😄 幽默單元（data.js 段子與場景、theory.js 原理、app.js 頁面）
js/speak/           🗣️ 說話單元（data.js 公式與練習題、app.js 頁面）
js/host/            🎙️ 主持單元（目前是課程規劃頁）
js/read/            🔊 朗讀室
js/main.js          啟動
```

網址格式是 `#/<單元>/<頁面>`，例如 `#/humor/scenes/typhoon`、`#/speak/day/1`。

設計說明：
- [docs/DESIGN.md](docs/DESIGN.md)：幽默單元
- [docs/DESIGN-speak.md](docs/DESIGN-speak.md)：說話單元
- [docs/READER.md](docs/READER.md)：朗讀器
- [docs/ADD-MODULE.md](docs/ADD-MODULE.md)：怎麼新增單元（例如主持訓練）
