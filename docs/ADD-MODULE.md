# 新增一個訓練單元

每個單元都是獨立的模組，彼此不共用進度。以主持訓練為例：

1. 在 `js/host/data.js` 放課程內容（例如開場白範例、串場句型、突發狀況卡）。
2. 在 `js/host/app.js` 寫頁面函式，最後註冊：

```js
App.register({
  id: 'host',            // 網址會是 #/host/...
  name: '主持訓練',
  short: '主持',          // 首頁分頁列的短名稱
  emoji: '🎙️',
  tagline: '開場、串場、訪問、控場、收尾。',
  summary: () => '已完成 0 / 7 課',  // 訓練中心卡片上的進度（可省略）
  reset: () => {},        // 設定頁的「重設進度」（可省略）
  tabs: [{ page: '', icon: '📋', label: '課程' }, { page: 'drill', icon: '🎤', label: '模擬' }],
  pages: { '': home, drill }
});
```

拿掉 `status: 'soon'`，訓練中心就不會再顯示「即將推出」。

3. 在 `index.html` 加上 `<script src="js/host/data.js"></script>`（放在 `js/host/app.js` 前面）。
4. 在 `sw.js` 的 `FILES` 加上新檔案，並把 `CACHE` 版本號加 1。
5. 主色在 `css/style.css` 的 `body[data-module="host"]`。

可以直接使用的共用工具（`App.*`）：`store`（儲存）、`speakBtn`、`micToField`（語音輸入）、`A()`／`B()`（兩種聲音設定）、`esc`、`shuffle`、`today`、`fmt`；語音則用 `Speech.play / speak / listen / record / score`。
