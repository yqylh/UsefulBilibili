// ==UserScript==
// @name         [Bilibili] 动态页封面一键收藏
// @namespace    https://github.com/yinyongqi/usefulbilibili
// @version      0.2.1
// @description  在 t.bilibili.com 动态视频流的封面上增加“★收藏”悬浮按钮，一键加入收藏夹（无需点进视频页）。Shift+点击可切换目标收藏夹。
// @author       you
// @match        https://t.bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      api.bilibili.com
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------
  // Utils
  // ---------------------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  function toast(msg) {
    const id = '__tm_fav_toast__';
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.style.cssText = [
        'position:fixed',
        'left:50%',
        'top:18px',
        'transform:translateX(-50%)',
        'z-index:999999',
        'padding:8px 12px',
        'border-radius:10px',
        'background:rgba(0,0,0,.72)',
        'color:#fff',
        'font-size:13px',
        'max-width:70vw',
        'white-space:nowrap',
        'overflow:hidden',
        'text-overflow:ellipsis',
        'opacity:0',
        'transition:opacity .15s ease',
        'pointer-events:none',
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el.__t);
    el.__t = setTimeout(() => (el.style.opacity = '0'), 1200);
  }

  function gmPost(url, formObj) {
    const form = new URLSearchParams(formObj).toString();
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url,
        data: form,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        onload: (res) => {
          try {
            resolve(JSON.parse(res.responseText));
          } catch (e) {
            reject(e);
          }
        },
        onerror: reject,
      });
    });
  }

  function gmGet(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        onload: (res) => {
          try {
            resolve(JSON.parse(res.responseText));
          } catch (e) {
            reject(e);
          }
        },
        onerror: reject,
      });
    });
  }

  // ---------------------------
  // API
  // ---------------------------
  async function fetchAidByBvid(bvid) {
    const url = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`;
    const j = await gmGet(url);
    if (j && j.code === 0 && j.data && j.data.aid) return j.data.aid;
    throw new Error(j?.message || '获取aid失败');
  }

  async function fetchMyFavFolders(mid) {
    // created/list-all: 返回你创建的收藏夹列表
    const url = `https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${encodeURIComponent(mid)}&jsonp=jsonp`;
    const j = await gmGet(url);
    if (j && j.code === 0 && j.data && Array.isArray(j.data.list)) return j.data.list;
    throw new Error(j?.message || '获取收藏夹列表失败');
  }

  async function addToFavFolder(aid, mediaId, csrf) {
    // 收藏稿件(视频): rid=aid, type=2, add_media_ids=收藏夹id, csrf=bili_jct
    const url = `https://api.bilibili.com/x/v3/fav/resource/deal`;
    const j = await gmPost(url, {
      rid: String(aid),
      type: '2',
      add_media_ids: String(mediaId),
      csrf: String(csrf),
    });
    return j;
  }

  // ---------------------------
  // Config (target folder)
  // ---------------------------
  const STORE_KEY = 'tm_quick_fav_media_id';
  const STORE_KEY_TITLE = 'tm_quick_fav_media_title';

  async function ensureTargetFolder() {
    let mediaId = GM_getValue(STORE_KEY, '');
    let title = GM_getValue(STORE_KEY_TITLE, '');

    const csrf = getCookie('bili_jct');
    const mid = getCookie('DedeUserID');
    if (!csrf || !mid) {
      toast('未登录或缺少Cookie（bili_jct / DedeUserID）');
      return { ok: false };
    }

    // 无设置则自动取第一个收藏夹作为默认目标
    if (!mediaId) {
      try {
        const list = await fetchMyFavFolders(mid);
        if (list.length) {
          mediaId = String(list[0].id);
          title = String(list[0].title || '默认收藏夹');
          GM_setValue(STORE_KEY, mediaId);
          GM_setValue(STORE_KEY_TITLE, title);
          toast(`快速收藏目标：${title}`);
        } else {
          toast('未找到任何收藏夹（请先创建收藏夹）');
          return { ok: false };
        }
      } catch (e) {
        toast(`获取收藏夹失败：${e.message || e}`);
        return { ok: false };
      }
    }

    return { ok: true, csrf, mid, mediaId, title };
  }

  async function pickFolderByPrompt() {
    const csrf = getCookie('bili_jct');
    const mid = getCookie('DedeUserID');
    if (!csrf || !mid) {
      toast('未登录或缺少Cookie');
      return null;
    }

    const list = await fetchMyFavFolders(mid);
    if (!list.length) {
      toast('没有收藏夹可选');
      return null;
    }

    const lines = list.map((f, i) => `${i + 1}. ${f.title}（id=${f.id}）`).join('\n');
    const ans = prompt(`选择“快速收藏”目标收藏夹：\n${lines}\n\n输入序号(1-${list.length})：`, '1');
    if (!ans) return null;

    const idx = Number(ans) - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx >= list.length) {
      toast('输入无效');
      return null;
    }

    const chosen = list[idx];
    GM_setValue(STORE_KEY, String(chosen.id));
    GM_setValue(STORE_KEY_TITLE, String(chosen.title || '收藏夹'));
    toast(`已切换目标：${chosen.title}`);
    return chosen;
  }

  // ---------------------------
  // UI injection
  // ---------------------------
  GM_addStyle(`
    .tm-qfav-btn{
      position:absolute;
      top:8px;
      right:8px;
      z-index:10;
      display:flex;
      align-items:center;
      justify-content:center;
      width:30px;
      height:30px;
      border-radius:999px;
      background:rgba(0,0,0,.55);
      color:#fff;
      font-size:16px;
      cursor:pointer;
      user-select:none;
      backdrop-filter:saturate(120%) blur(4px);
      transition:transform .12s ease, background .12s ease, opacity .12s ease;
      opacity:.95;
    }
    .tm-qfav-btn:hover{
      transform:scale(1.06);
      background:rgba(0,0,0,.70);
    }
    .tm-qfav-btn.tm-qfav-loading{
      cursor:wait;
      opacity:.75;
    }
    .tm-qfav-tip{
      position:absolute;
      top:42px;
      right:8px;
      z-index:10;
      padding:6px 8px;
      border-radius:8px;
      background:rgba(0,0,0,.72);
      color:#fff;
      font-size:12px;
      white-space:nowrap;
      pointer-events:none;
      opacity:0;
      transform:translateY(-4px);
      transition:opacity .12s ease, transform .12s ease;
    }
    .tm-qfav-wrap:hover .tm-qfav-tip{
      opacity:1;
      transform:translateY(0);
    }
  `);

  function extractBvidFromHref(href) {
    // e.g. https://www.bilibili.com/video/BV1DrZjBrEvm/
    const m = href.match(/\/video\/(BV[0-9A-Za-z]+)\b/);
    return m ? m[1] : '';
  }

  function findThumbHost(a) {
    // 尽量把按钮塞到封面图容器里（a 自己或其父元素）
    // 目标：能 position:relative 覆盖在封面上
    let host = a;
    // 如果 a 里面有 img，把 host 定位到 img 的最近可定位容器
    const img = a.querySelector('img');
    if (img) {
      host = img.parentElement || a;
    }
    // 逐层上探一两层，找一个尺寸更贴近封面的盒子
    for (let i = 0; i < 2; i++) {
      if (!host) break;
      const r = host.getBoundingClientRect();
      if (r.width >= 120 && r.height >= 60) break;
      host = host.parentElement;
    }
    return host || a;
  }

  function alreadyInjected(host) {
    return host.querySelector(':scope > .tm-qfav-wrap') != null;
  }

  async function handleFavClick(bvid, btn, tip) {
    const cfg = await ensureTargetFolder();
    if (!cfg.ok) return;

    btn.classList.add('tm-qfav-loading');
    tip.textContent = '收藏中...';

    try {
      const aid = await fetchAidByBvid(bvid);
      const j = await addToFavFolder(aid, cfg.mediaId, cfg.csrf);

      if (j.code === 0) {
        tip.textContent = `已收藏到：${cfg.title}`;
        toast(`★ 已收藏：${bvid}`);
      } else {
        tip.textContent = `失败：${j.message || j.code}`;
        toast(`收藏失败：${j.message || j.code}`);
      }
    } catch (e) {
      tip.textContent = `异常：${e.message || e}`;
      toast(`异常：${e.message || e}`);
    } finally {
      btn.classList.remove('tm-qfav-loading');
      setTimeout(() => (tip.textContent = '★ 一键收藏'), 1200);
    }
  }

  function injectOne(anchor) {
    const href = anchor.getAttribute('href') || '';
    const bvid = extractBvidFromHref(href);
    if (!bvid) return;

    const host = findThumbHost(anchor);
    if (!host || alreadyInjected(host)) return;

    // host 必须可定位
    const style = window.getComputedStyle(host);
    if (style.position === 'static') host.style.position = 'relative';

    const wrap = document.createElement('div');
    wrap.className = 'tm-qfav-wrap';
    wrap.style.position = 'absolute';
    wrap.style.inset = '0';
    wrap.style.pointerEvents = 'none'; // 不挡点击（按钮自己再开 pointerEvents）
    wrap.style.zIndex = '9';

    const btn = document.createElement('div');
    btn.className = 'tm-qfav-btn';
    btn.textContent = '★';
    btn.title = '一键收藏（Shift+点击：切换收藏夹）';
    btn.style.pointerEvents = 'auto';

    const tip = document.createElement('div');
    tip.className = 'tm-qfav-tip';
    tip.textContent = '★ 一键收藏';
    tip.style.pointerEvents = 'none';

    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      if (ev.shiftKey) {
        try {
          await pickFolderByPrompt();
        } catch (e) {
          toast(`切换失败：${e.message || e}`);
        }
        return;
      }

      await handleFavClick(bvid, btn, tip);
    }, true);

    wrap.appendChild(btn);
    wrap.appendChild(tip);
    host.appendChild(wrap);
  }

  function scanAndInject(root = document) {
    // 动态页里：视频封面一般是 <a href="https://www.bilibili.com/video/BV...">
    const anchors = root.querySelectorAll('a[href*="/video/BV"]');
    anchors.forEach(injectOne);
  }

  // ---------------------------
  // Boot
  // ---------------------------
  (async function main() {
    await sleep(600); // 等页面初始渲染
    scanAndInject(document);

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          // 只对新增的子树扫描，避免全量扫太重
          scanAndInject(node);
        }
      }
    });

    mo.observe(document.documentElement, { childList: true, subtree: true });

    // 首次提示目标收藏夹
    await ensureTargetFolder();
  })();
})();
