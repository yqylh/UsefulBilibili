// ==UserScript==
// @name         [Bilibili] 收藏页卡片一键取消收藏
// @namespace    https://github.com/yinyongqi/usefulbilibili
// @version      0.3.1
// @description  在收藏列表每个视频卡片上加“取消收藏”快捷按钮，自动点击…->取消收藏->确定
// @match        https://space.bilibili.com/*/favlist*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const BTN_CLASS = 'tm-quick-unfav-btn';

  // 注入样式
  const style = document.createElement('style');
  style.textContent = `
    .${BTN_CLASS}{
      position:absolute;
      top:8px;
      right:8px;
      z-index:9999;
      padding:6px 10px;
      font-size:12px;
      line-height:1;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.65);
      background:rgba(0,0,0,.55);
      color:#fff;
      cursor:pointer;
      user-select:none;
      backdrop-filter: blur(6px);
    }
    .${BTN_CLASS}:hover{ background:rgba(0,0,0,.72); }
    .${BTN_CLASS}[data-busy="1"]{ opacity:.6; cursor:wait; }
  `;
  document.head.appendChild(style);

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function textIncludes(el, s) {
    return (el?.textContent || '').replace(/\s+/g, '').includes(s);
  }

  // 在页面里找“取消收藏”菜单项并点击
  async function clickUnfavMenuItem() {
    // 可能出现的菜单项容器/条目：尽量宽松匹配
    const candidates = Array.from(document.querySelectorAll(
      'li, .bili-dropdown__item, .bili-context-menu-item, .option, .menu-item, button, a'
    ));

    const item = candidates.find(el => textIncludes(el, '取消收藏'));
    if (!item) return false;

    item.click();
    return true;
  }

  // 找弹窗里的“确定/确认”并点击
  async function clickConfirmIfAny() {
    const candidates = Array.from(document.querySelectorAll('button, .btn, .bili-button'));
    const ok = candidates.find(el =>
      textIncludes(el, '确定') || textIncludes(el, '确认') || textIncludes(el, 'OK')
    );
    if (ok) ok.click();
  }

  // 尝试在卡片内找到“…”按钮并点击
  function clickMoreBtnWithin(card) {
    const btns = Array.from(card.querySelectorAll('button, .more, .three, .dots, .operation, .opt'));
    // 优先：看起来像操作菜单的按钮
    let more = btns.find(b =>
      textIncludes(b, '...') || textIncludes(b, '…') ||
      (b.className && /more|dots|three|opt|operation/i.test(String(b.className)))
    );

    // 兜底：卡片里最后一个 button（很多站点菜单按钮在末尾）
    if (!more) {
      const realBtns = Array.from(card.querySelectorAll('button'));
      more = realBtns[realBtns.length - 1];
    }
    if (!more) return false;

    more.click();
    return true;
  }

  function getLikelyCardRoot(a) {
    // 尽量找一个可定位的“卡片根节点”
    return a.closest('li')
      || a.closest('.fav-video-item')
      || a.closest('.video-card')
      || a.closest('.bili-video-card')
      || a.parentElement;
  }

  async function onQuickUnfavClick(btn, card) {
    if (btn.dataset.busy === '1') return;
    btn.dataset.busy = '1';

    try {
      // 1) 点“…”打开菜单
      const ok = clickMoreBtnWithin(card);
      if (!ok) throw new Error('没找到“…”菜单按钮（DOM结构可能变了）');

      // 2) 等菜单渲染并点“取消收藏”
      let clicked = false;
      for (let i = 0; i < 12; i++) { // ~1.2s
        await sleep(100);
        clicked = await clickUnfavMenuItem();
        if (clicked) break;
      }
      if (!clicked) throw new Error('没找到“取消收藏”菜单项（可能文案不同/菜单未打开）');

      // 3) 如果有确认弹窗，点“确定”
      for (let i = 0; i < 10; i++) { // ~1s
        await sleep(100);
        await clickConfirmIfAny();
      }
    } catch (e) {
      console.warn('[QuickUnfav] 失败：', e);
      // 失败时给一个轻提示：把按钮文字改一下方便你发现
      btn.textContent = '没点到…/取消';
      await sleep(900);
      btn.textContent = '🚫取消收藏';
    } finally {
      btn.dataset.busy = '0';
    }
  }

  function addButtons() {
    // 找到每个视频链接，再定位卡片根
    const links = Array.from(document.querySelectorAll('a[href*="/video/BV"], a[href*="/video/av"]'));
    for (const a of links) {
      const card = getLikelyCardRoot(a);
      if (!card) continue;

      // 卡片需要相对定位，方便放按钮
      const cs = window.getComputedStyle(card);
      if (cs.position === 'static') card.style.position = 'relative';

      if (card.querySelector(`.${BTN_CLASS}`)) continue;

      const btn = document.createElement('div');
      btn.className = BTN_CLASS;
      btn.textContent = '🚫取消收藏';
      btn.title = '一键取消收藏（自动点…里的取消收藏）';
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        onQuickUnfavClick(btn, card);
      });

      card.appendChild(btn);
    }
  }

  // 初次执行 + 监听翻页/懒加载
  addButtons();
  const mo = new MutationObserver(() => addButtons());
  mo.observe(document.body, { childList: true, subtree: true });
})();
