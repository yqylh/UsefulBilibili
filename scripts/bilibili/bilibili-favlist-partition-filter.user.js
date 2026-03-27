// ==UserScript==
// @name         [Bilibili] 收藏页分区筛选恢复
// @namespace    https://github.com/yinyongqi/usefulbilibili
// @version      0.2.0
// @description  在收藏夹页面恢复“按分区筛选”能力，并支持筛选结果内批量取消收藏
// @match        https://space.bilibili.com/*/favlist*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const SCRIPT_KEY = 'tm-fav-partition-filter';
  const PANEL_ID = `${SCRIPT_KEY}-panel`;
  const ROOT_ID = `${SCRIPT_KEY}-root`;
  const STYLE_ID = `${SCRIPT_KEY}-style`;
  const TOAST_ID = `${SCRIPT_KEY}-toast`;
  const HOST_SELECTOR = '.favlist-main .fav-list-main';
  const MAIN_SELECTOR = '.favlist-main';
  const SIDEBAR_SELECTOR = '.favlist-aside .vui_sidebar';
  const BATCH_BTN_SELECTOR = '.favlist-main .favlist-info-batch';
  const PAGE_SIZE = 36;
  const CHANNELS = [
    { tid: 0, name: '全部分区' },
    { tid: 1, name: '动画' },
    { tid: 4, name: '游戏' },
    { tid: 119, name: '鬼畜' },
    { tid: 3, name: '音乐' },
    { tid: 129, name: '舞蹈' },
    { tid: 181, name: '影视' },
    { tid: 160, name: '生活' },
    { tid: 5, name: '娱乐' },
    { tid: 36, name: '知识' },
    { tid: 188, name: '科技数码' },
    { tid: 202, name: '资讯' },
    { tid: 211, name: '美食' },
    { tid: 223, name: '汽车' },
    { tid: 155, name: '时尚美妆' },
    { tid: 234, name: '体育运动' },
    { tid: 217, name: '动物' },
  ];

  const state = {
    mid: '',
    fid: '',
    mediaId: '',
    folderTitle: '',
    tid: 0,
    pn: 1,
    hasMore: false,
    host: null,
    panel: null,
    root: null,
    lastData: null,
    batchMode: false,
    deleting: false,
    selectedResources: new Set(),
    requestToken: 0,
    syncToken: 0,
  };

  let favListCache = null;
  let mountObserver = null;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{
        margin: 0 0 18px;
        padding: 14px 16px;
        border-radius: 14px;
        background: linear-gradient(135deg, rgba(255,255,255,.98), rgba(248,250,255,.98));
        border: 1px solid rgba(22, 119, 255, .10);
        box-shadow: 0 12px 32px rgba(11, 32, 78, .06);
      }
      #${PANEL_ID} .tm-fav-filter-bar{
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:10px 12px;
      }
      #${PANEL_ID} .tm-fav-filter-label{
        font-size:14px;
        font-weight:600;
        color:#18191c;
      }
      #${PANEL_ID} .tm-fav-filter-select{
        min-width:160px;
        height:36px;
        padding:0 36px 0 12px;
        border:1px solid rgba(97, 102, 109, .18);
        border-radius:10px;
        background:#fff;
        color:#18191c;
        font-size:14px;
        outline:none;
      }
      #${PANEL_ID} .tm-fav-filter-reset{
        height:36px;
        padding:0 12px;
        border:none;
        border-radius:10px;
        background:#00aeec;
        color:#fff;
        font-size:13px;
        cursor:pointer;
      }
      #${PANEL_ID} .tm-fav-filter-reset:hover{
        background:#0cb8f2;
      }
      #${PANEL_ID} .tm-fav-filter-hint{
        color:#61666d;
        font-size:12px;
      }
      #${ROOT_ID}{
        margin-top:16px;
      }
      #${ROOT_ID}[hidden]{
        display:none !important;
      }
      #${ROOT_ID} .tm-fav-filter-state,
      #${ROOT_ID} .tm-fav-filter-empty{
        padding:42px 18px;
        border-radius:16px;
        background:#fff;
        color:#61666d;
        text-align:center;
        box-shadow: 0 12px 32px rgba(11, 32, 78, .05);
      }
      #${ROOT_ID} .tm-fav-filter-header{
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin-bottom:16px;
      }
      #${ROOT_ID} .tm-fav-filter-title{
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:8px;
      }
      #${ROOT_ID} .tm-fav-filter-tag{
        display:inline-flex;
        align-items:center;
        height:28px;
        padding:0 10px;
        border-radius:999px;
        background:rgba(0, 174, 236, .12);
        color:#00aeec;
        font-size:13px;
        font-weight:600;
      }
      #${ROOT_ID} .tm-fav-filter-meta{
        color:#61666d;
        font-size:13px;
      }
      #${ROOT_ID} .tm-fav-filter-actions{
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        justify-content:flex-end;
        gap:8px;
      }
      #${ROOT_ID} .tm-fav-filter-page-btn{
        height:34px;
        padding:0 12px;
        border:1px solid rgba(97, 102, 109, .18);
        border-radius:10px;
        background:#fff;
        color:#18191c;
        cursor:pointer;
      }
      #${ROOT_ID} .tm-fav-filter-page-btn.tm-fav-filter-accent-btn{
        border-color:transparent;
        background:#00aeec;
        color:#fff;
      }
      #${ROOT_ID} .tm-fav-filter-page-btn.tm-fav-filter-accent-btn:hover{
        background:#0cb8f2;
      }
      #${ROOT_ID} .tm-fav-filter-page-btn.tm-fav-filter-danger-btn{
        border-color:transparent;
        background:#fb7299;
        color:#fff;
      }
      #${ROOT_ID} .tm-fav-filter-page-btn.tm-fav-filter-danger-btn:hover{
        background:#fc86a8;
      }
      #${ROOT_ID} .tm-fav-filter-page-btn[disabled]{
        opacity:.42;
        cursor:not-allowed;
      }
      #${ROOT_ID} .tm-fav-filter-page-info{
        min-width:66px;
        color:#61666d;
        font-size:13px;
        text-align:center;
      }
      #${ROOT_ID} .tm-fav-filter-grid{
        display:grid;
        grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));
        gap:18px;
        padding:0;
        margin:0;
        list-style:none;
      }
      #${ROOT_ID} .tm-fav-filter-card{
        position:relative;
        display:flex;
        flex-direction:column;
        min-width:0;
        overflow:hidden;
        border-radius:16px;
        background:#fff;
        box-shadow: 0 12px 28px rgba(11, 32, 78, .06);
      }
      #${ROOT_ID} .tm-fav-filter-card.tm-fav-filter-card--batch{
        cursor:pointer;
      }
      #${ROOT_ID} .tm-fav-filter-card.tm-fav-filter-card--selected{
        box-shadow: 0 0 0 2px rgba(0, 174, 236, .78), 0 12px 28px rgba(11, 32, 78, .10);
      }
      #${ROOT_ID} .tm-fav-filter-cover{
        position:relative;
        display:block;
        aspect-ratio:16 / 10;
        overflow:hidden;
        background:linear-gradient(135deg, #eef4ff, #f8fbff);
      }
      #${ROOT_ID} .tm-fav-filter-check{
        position:absolute;
        top:10px;
        left:10px;
        z-index:3;
        display:flex;
        align-items:center;
        justify-content:center;
        width:30px;
        height:30px;
        border:none;
        border-radius:999px;
        background:rgba(255,255,255,.94);
        color:#61666d;
        font-size:15px;
        font-weight:700;
        cursor:pointer;
        box-shadow:0 8px 18px rgba(11, 32, 78, .16);
      }
      #${ROOT_ID} .tm-fav-filter-check.tm-fav-filter-check--selected{
        background:#00aeec;
        color:#fff;
      }
      #${ROOT_ID} .tm-fav-filter-cover img{
        width:100%;
        height:100%;
        object-fit:cover;
        display:block;
      }
      #${ROOT_ID} .tm-fav-filter-duration{
        position:absolute;
        right:10px;
        bottom:10px;
        padding:2px 8px;
        border-radius:999px;
        background:rgba(0,0,0,.66);
        color:#fff;
        font-size:12px;
        line-height:18px;
      }
      #${ROOT_ID} .tm-fav-filter-body{
        display:flex;
        flex-direction:column;
        gap:10px;
        padding:14px;
      }
      #${ROOT_ID} .tm-fav-filter-card-title{
        display:-webkit-box;
        overflow:hidden;
        color:#18191c;
        font-size:15px;
        font-weight:600;
        line-height:1.45;
        -webkit-line-clamp:2;
        -webkit-box-orient:vertical;
        text-decoration:none;
      }
      #${ROOT_ID} .tm-fav-filter-card-title:hover{
        color:#00aeec;
      }
      #${ROOT_ID} .tm-fav-filter-up,
      #${ROOT_ID} .tm-fav-filter-stat{
        display:flex;
        justify-content:space-between;
        gap:12px;
        color:#61666d;
        font-size:12px;
      }
      #${ROOT_ID} .tm-fav-filter-up span,
      #${ROOT_ID} .tm-fav-filter-stat span{
        min-width:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      @media (max-width: 900px){
        #${ROOT_ID} .tm-fav-filter-grid{
          grid-template-columns:repeat(auto-fill, minmax(168px, 1fr));
          gap:14px;
        }
        #${PANEL_ID}{
          padding:12px;
        }
      }
      #${TOAST_ID}{
        position:fixed;
        top:18px;
        left:50%;
        z-index:999999;
        transform:translateX(-50%);
        max-width:min(72vw, 520px);
        padding:10px 14px;
        border-radius:12px;
        background:rgba(24, 25, 28, .88);
        color:#fff;
        font-size:13px;
        line-height:1.45;
        box-shadow:0 14px 34px rgba(0, 0, 0, .18);
        opacity:0;
        pointer-events:none;
        transition:opacity .18s ease;
      }
    `;

    document.head.appendChild(style);
  }

  function getMidFromPath() {
    const match = location.pathname.match(/^\/(\d+)\/favlist/);
    return match ? match[1] : '';
  }

  function getQuery(name) {
    return new URL(location.href).searchParams.get(name) || '';
  }

  function getCookie(name) {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : '';
  }

  function toast(text) {
    let el = document.getElementById(TOAST_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = TOAST_ID;
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.opacity = '1';
    clearTimeout(el.__timer);
    el.__timer = setTimeout(() => {
      el.style.opacity = '0';
    }, 1800);
  }

  function buildMediaId(mid, fid) {
    if (!mid || !fid) return '';
    const suffix = String(mid).slice(-2).padStart(2, '0');
    return `${fid}${suffix}`;
  }

  function normalizeUrl(url) {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('http://')) return url.replace(/^http:\/\//, 'https://');
    return url;
  }

  function formatDuration(seconds) {
    const total = Number(seconds) || 0;
    if (total <= 0) return '';
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function formatDate(ts) {
    const ms = Number(ts) * 1000;
    if (!ms) return '收藏时间未知';
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '收藏时间未知';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatCount(value) {
    const n = Number(value) || 0;
    if (n >= 1e8) return `${(n / 1e8).toFixed(1).replace(/\.0$/, '')}亿`;
    if (n >= 1e4) return `${(n / 1e4).toFixed(1).replace(/\.0$/, '')}万`;
    return String(n);
  }

  function getChannelName(tid) {
    return CHANNELS.find((item) => item.tid === Number(tid))?.name || '未知分区';
  }

  function fetchJSON(url, init) {
    return fetch(url, {
      credentials: 'include',
      ...init,
    }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.code !== 0) throw new Error(json.message || `接口错误(${json.code})`);
      return json.data;
    });
  }

  function postFormJSON(url, params) {
    const body = new URLSearchParams(params).toString();
    return fetchJSON(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body,
    });
  }

  async function batchDeleteResources(resourceList) {
    const csrf = getCookie('bili_jct');
    if (!csrf) throw new Error('未获取到 bili_jct，请确认已登录 B 站');
    if (!state.mediaId) throw new Error('未识别当前收藏夹 media_id');

    return postFormJSON('https://api.bilibili.com/x/v3/fav/resource/batch-del', {
      media_id: String(state.mediaId),
      resources: resourceList,
      platform: 'web',
      csrf,
    });
  }

  async function fetchCreatedFavList(mid) {
    if (!mid) return [];
    if (!favListCache || favListCache.mid !== mid) {
      favListCache = {
        mid,
        promise: fetchJSON(`https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${encodeURIComponent(mid)}&jsonp=jsonp`)
          .then((data) => data?.list || [])
          .catch((err) => {
            favListCache = null;
            throw err;
          }),
      };
    }

    return favListCache.promise;
  }

  function getActiveSidebarIndex() {
    const sidebar = document.querySelector(SIDEBAR_SELECTOR);
    if (!sidebar) return -1;

    const items = Array.from(sidebar.querySelectorAll('.fav-sidebar-item'));
    const active = sidebar.querySelector('.vui_sidebar-item--active')?.closest('.fav-sidebar-item');
    if (!active) return -1;
    return items.indexOf(active);
  }

  async function resolveCurrentFolder() {
    const mid = getMidFromPath();
    if (!mid) return null;

    let fid = getQuery('fid');
    let mediaId = '';
    let folderTitle = '';

    try {
      const favs = await fetchCreatedFavList(mid);
      if (favs.length) {
        const activeIndex = getActiveSidebarIndex();
        const activeFav = activeIndex >= 0 ? favs[activeIndex] : null;
        if (activeFav) {
          fid = String(activeFav.fid);
          mediaId = String(activeFav.id);
          folderTitle = activeFav.title || '';
        }
      }

      if (!mediaId && fid) {
        const matched = favs.find((item) =>
          String(item.fid) === String(fid) || String(item.id) === String(fid)
        );
        if (matched) {
          fid = String(matched.fid);
          mediaId = String(matched.id);
          folderTitle = matched.title || '';
        }
      }
    } catch (err) {
      console.warn(`[${SCRIPT_KEY}] 获取收藏夹列表失败`, err);
    }

    if (!mediaId) {
      mediaId = buildMediaId(mid, fid);
    }

    if (!mediaId) return null;
    return { mid, fid, mediaId, folderTitle };
  }

  function ensureMounted() {
    const main = document.querySelector(MAIN_SELECTOR);
    const host = document.querySelector(HOST_SELECTOR);
    if (!main || !host) return false;

    injectStyle();

    state.host = host;

    let panel = document.getElementById(PANEL_ID);
    if (!panel || !panel.isConnected) {
      panel = document.createElement('section');
      panel.id = PANEL_ID;
      panel.innerHTML = `
        <div class="tm-fav-filter-bar">
          <span class="tm-fav-filter-label">分区筛选</span>
          <select class="tm-fav-filter-select" aria-label="收藏夹分区筛选"></select>
          <button type="button" class="tm-fav-filter-reset">返回原列表</button>
          <span class="tm-fav-filter-hint">默认不接管页面，选中具体分区后才会显示脚本筛选结果。</span>
        </div>
      `;
      host.parentNode?.insertBefore(panel, host);
      const select = panel.querySelector('.tm-fav-filter-select');
      CHANNELS.forEach((item) => {
        const option = document.createElement('option');
        option.value = String(item.tid);
        option.textContent = item.name;
        select.appendChild(option);
      });
      select.value = String(state.tid);
      select.addEventListener('change', () => {
        state.tid = Number(select.value) || 0;
        state.pn = 1;
        state.lastData = null;
        resetSelectionState(true);
        syncMode();
        if (state.tid !== 0) renderFilteredList();
      });
      panel.querySelector('.tm-fav-filter-reset').addEventListener('click', () => {
        state.tid = 0;
        state.pn = 1;
        state.lastData = null;
        resetSelectionState(true);
        select.value = '0';
        syncMode();
      });
    }
    state.panel = panel;

    let root = document.getElementById(ROOT_ID);
    if (!root || !root.isConnected) {
      root = document.createElement('section');
      root.id = ROOT_ID;
      root.hidden = true;
      host.insertAdjacentElement('afterend', root);
    }
    state.root = root;

    const select = state.panel.querySelector('.tm-fav-filter-select');
    if (select && select.value !== String(state.tid)) {
      select.value = String(state.tid);
    }

    return true;
  }

  function syncMode() {
    if (!state.host || !state.root) return;

    const customActive = state.tid !== 0;
    state.host.style.display = customActive ? 'none' : '';
    state.root.hidden = !customActive;

    const resetBtn = state.panel?.querySelector('.tm-fav-filter-reset');
    if (resetBtn) resetBtn.style.display = customActive ? '' : 'none';

    const nativeBatchBtn = document.querySelector(BATCH_BTN_SELECTOR);
    if (nativeBatchBtn) {
      nativeBatchBtn.style.display = customActive ? 'none' : '';
    }
  }

  function showState(text) {
    if (!state.root) return;
    state.root.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'tm-fav-filter-state';
    box.textContent = text;
    state.root.appendChild(box);
  }

  function buildVideoLink(media) {
    if (media?.bvid || media?.bv_id) {
      return `https://www.bilibili.com/video/${media.bvid || media.bv_id}`;
    }
    return 'https://www.bilibili.com/';
  }

  function buildResourceKey(media) {
    return `${media.id}:${media.type}`;
  }

  function resetSelectionState(exitBatchMode = false) {
    state.selectedResources.clear();
    if (exitBatchMode) {
      state.batchMode = false;
    }
  }

  function rerenderCurrentView() {
    if (state.lastData) {
      renderList(state.lastData);
    }
  }

  function toggleResourceSelected(resourceKey) {
    if (state.deleting) return;
    if (!resourceKey) return;
    if (state.selectedResources.has(resourceKey)) {
      state.selectedResources.delete(resourceKey);
    } else {
      state.selectedResources.add(resourceKey);
    }
    rerenderCurrentView();
  }

  function selectAllCurrentPage() {
    const medias = Array.isArray(state.lastData?.medias) ? state.lastData.medias : [];
    medias.forEach((media) => state.selectedResources.add(buildResourceKey(media)));
    rerenderCurrentView();
  }

  function clearSelection() {
    state.selectedResources.clear();
    rerenderCurrentView();
  }

  async function handleBatchDelete() {
    const resources = Array.from(state.selectedResources);
    if (state.deleting || resources.length === 0) return;

    const ok = confirm(`确认取消收藏已选中的 ${resources.length} 个视频吗？`);
    if (!ok) return;

    state.deleting = true;
    rerenderCurrentView();

    try {
      await batchDeleteResources(resources.join(','));
      resources.forEach((item) => state.selectedResources.delete(item));
      toast(`已取消收藏 ${resources.length} 个视频`);
      state.deleting = false;
      await renderFilteredList();
    } catch (err) {
      state.deleting = false;
      rerenderCurrentView();
      toast(`批量取消收藏失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function createCard(media) {
    const li = document.createElement('li');
    li.className = 'tm-fav-filter-card';

    const resourceKey = buildResourceKey(media);
    const isSelected = state.selectedResources.has(resourceKey);
    if (state.batchMode) {
      li.classList.add('tm-fav-filter-card--batch');
    }
    if (isSelected) {
      li.classList.add('tm-fav-filter-card--selected');
    }

    const coverLink = document.createElement('a');
    coverLink.className = 'tm-fav-filter-cover';
    coverLink.href = buildVideoLink(media);
    coverLink.target = '_blank';
    coverLink.rel = 'noopener noreferrer';

    const img = document.createElement('img');
    img.src = normalizeUrl(media.cover);
    img.alt = media.title || '收藏内容封面';
    img.loading = 'lazy';
    coverLink.appendChild(img);

    const duration = formatDuration(media.duration);
    if (duration) {
      const badge = document.createElement('span');
      badge.className = 'tm-fav-filter-duration';
      badge.textContent = duration;
      coverLink.appendChild(badge);
    }

    const body = document.createElement('div');
    body.className = 'tm-fav-filter-body';

    const title = document.createElement('a');
    title.className = 'tm-fav-filter-card-title';
    title.href = coverLink.href;
    title.target = '_blank';
    title.rel = 'noopener noreferrer';
    title.textContent = media.title || '未命名内容';

    const upLine = document.createElement('div');
    upLine.className = 'tm-fav-filter-up';
    const upName = document.createElement('span');
    upName.textContent = media.upper?.name || '未知UP主';
    const favDate = document.createElement('span');
    favDate.textContent = formatDate(media.fav_time || media.ctime);
    upLine.appendChild(upName);
    upLine.appendChild(favDate);

    const statLine = document.createElement('div');
    statLine.className = 'tm-fav-filter-stat';
    const playText = media?.cnt_info?.view_text_1 || formatCount(media?.cnt_info?.play);
    const play = document.createElement('span');
    play.textContent = `播放 ${playText}`;
    const danmaku = document.createElement('span');
    danmaku.textContent = `弹幕 ${formatCount(media?.cnt_info?.danmaku)}`;
    statLine.appendChild(play);
    statLine.appendChild(danmaku);

    body.appendChild(title);
    body.appendChild(upLine);
    body.appendChild(statLine);

    if (state.batchMode) {
      const check = document.createElement('button');
      check.type = 'button';
      check.className = `tm-fav-filter-check${isSelected ? ' tm-fav-filter-check--selected' : ''}`;
      check.textContent = isSelected ? '✓' : '○';
      check.title = isSelected ? '取消选中' : '选中用于批量取消收藏';
      check.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleResourceSelected(resourceKey);
      });
      li.appendChild(check);

      li.addEventListener('click', (event) => {
        if (event.target.closest('a, button')) return;
        toggleResourceSelected(resourceKey);
      });
    }

    li.appendChild(coverLink);
    li.appendChild(body);
    return li;
  }

  function createHeader(tagName, metaText) {
    const header = document.createElement('div');
    header.className = 'tm-fav-filter-header';

    const titleBox = document.createElement('div');
    titleBox.className = 'tm-fav-filter-title';

    const tag = document.createElement('span');
    tag.className = 'tm-fav-filter-tag';
    tag.textContent = tagName;

    const meta = document.createElement('span');
    meta.className = 'tm-fav-filter-meta';
    meta.textContent = metaText;

    titleBox.appendChild(tag);
    titleBox.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'tm-fav-filter-actions';

    if (state.batchMode) {
      const selectAll = document.createElement('button');
      selectAll.type = 'button';
      selectAll.className = 'tm-fav-filter-page-btn';
      selectAll.textContent = '全选本页';
      selectAll.disabled = state.deleting;
      selectAll.addEventListener('click', selectAllCurrentPage);

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'tm-fav-filter-page-btn';
      clearBtn.textContent = '清空已选';
      clearBtn.disabled = state.deleting || state.selectedResources.size === 0;
      clearBtn.addEventListener('click', clearSelection);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'tm-fav-filter-page-btn tm-fav-filter-danger-btn';
      deleteBtn.textContent = state.deleting
        ? '取消收藏中...'
        : `取消收藏（${state.selectedResources.size}）`;
      deleteBtn.disabled = state.deleting || state.selectedResources.size === 0;
      deleteBtn.addEventListener('click', handleBatchDelete);

      const doneBtn = document.createElement('button');
      doneBtn.type = 'button';
      doneBtn.className = 'tm-fav-filter-page-btn';
      doneBtn.textContent = '完成';
      doneBtn.disabled = state.deleting;
      doneBtn.addEventListener('click', () => {
        resetSelectionState(true);
        rerenderCurrentView();
      });

      actions.appendChild(selectAll);
      actions.appendChild(clearBtn);
      actions.appendChild(deleteBtn);
      actions.appendChild(doneBtn);
    } else {
      const batchBtn = document.createElement('button');
      batchBtn.type = 'button';
      batchBtn.className = 'tm-fav-filter-page-btn tm-fav-filter-accent-btn';
      batchBtn.textContent = '批量取消收藏';
      batchBtn.addEventListener('click', () => {
        state.batchMode = true;
        state.selectedResources.clear();
        rerenderCurrentView();
      });
      actions.appendChild(batchBtn);
    }

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'tm-fav-filter-page-btn';
    prev.dataset.role = 'prev';
    prev.textContent = '上一页';
    prev.disabled = state.pn <= 1 || state.deleting;

    const pageInfo = document.createElement('span');
    pageInfo.className = 'tm-fav-filter-page-info';
    pageInfo.textContent = `第 ${state.pn} 页`;

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'tm-fav-filter-page-btn';
    next.dataset.role = 'next';
    next.textContent = '下一页';
    next.disabled = !state.hasMore || state.deleting;

    actions.appendChild(prev);
    actions.appendChild(pageInfo);
    actions.appendChild(next);

    header.appendChild(titleBox);
    header.appendChild(actions);
    return header;
  }

  function renderList(data) {
    if (!state.root) return;

    const medias = Array.isArray(data?.medias) ? data.medias : [];
    state.hasMore = Boolean(data?.has_more);
    const tagName = getChannelName(state.tid);
    const folderName = state.folderTitle || data?.info?.title || '当前收藏夹';

    if (medias.length === 0) {
      state.root.innerHTML = '';
      state.root.appendChild(createHeader(tagName, `${folderName} · 第 ${state.pn} 页`));
      const empty = document.createElement('div');
      empty.className = 'tm-fav-filter-empty';
      empty.textContent = '这个分区在当前收藏夹里没有可显示的视频。';
      state.root.appendChild(empty);
      bindPager();
      return;
    }

    state.root.innerHTML = '';
    const header = createHeader(tagName, `${folderName} · 第 ${state.pn} 页${state.hasMore ? ' · 还有更多结果' : ''}`);

    const grid = document.createElement('ul');
    grid.className = 'tm-fav-filter-grid';
    medias.forEach((media) => grid.appendChild(createCard(media)));

    state.root.appendChild(header);
    state.root.appendChild(grid);
    bindPager();
  }

  function bindPager() {
    if (!state.root) return;
    state.root.querySelector('[data-role="prev"]')?.addEventListener('click', () => {
      if (state.pn <= 1) return;
      state.pn -= 1;
      renderFilteredList();
    });
    state.root.querySelector('[data-role="next"]')?.addEventListener('click', () => {
      if (!state.hasMore) return;
      state.pn += 1;
      renderFilteredList();
    });
  }

  async function renderFilteredList() {
    if (!state.mediaId || state.tid === 0) return;
    if (!ensureMounted()) return;

    syncMode();
    const token = ++state.requestToken;
    showState('分区结果加载中...');

    try {
      const params = new URLSearchParams({
        media_id: String(state.mediaId),
        pn: String(state.pn),
        ps: String(PAGE_SIZE),
        tid: String(state.tid),
        type: '0',
        order: 'mtime',
        platform: 'web',
      });

      const data = await fetchJSON(`https://api.bilibili.com/x/v3/fav/resource/list?${params.toString()}`);
      if (token !== state.requestToken) return;

      if (Array.isArray(data?.medias) && data.medias.length === 0 && state.pn > 1) {
        state.pn -= 1;
        return renderFilteredList();
      }

      if (data?.info?.title && !state.folderTitle) {
        state.folderTitle = data.info.title;
      }

      state.lastData = data;
      renderList(data);
    } catch (err) {
      if (token !== state.requestToken) return;
      const text = err instanceof Error ? err.message : String(err);
      showState(`筛选失败：${text}`);
    }
  }

  async function syncFromPage() {
    if (!ensureMounted()) return;

    const token = ++state.syncToken;
    const folder = await resolveCurrentFolder();
    if (token !== state.syncToken || !folder) return;

    const folderChanged = folder.mediaId !== state.mediaId;
    state.mid = folder.mid;
    state.fid = folder.fid;
    state.mediaId = folder.mediaId;
    state.folderTitle = folder.folderTitle || '';

    if (folderChanged) {
      state.pn = 1;
      state.lastData = null;
      resetSelectionState(true);
    }

    if (state.tid !== 0) {
      if (folderChanged || !state.root || !state.root.hasChildNodes()) {
        renderFilteredList();
      } else {
        syncMode();
      }
    } else {
      syncMode();
    }
  }

  function installUrlWatcher() {
    const eventName = `${SCRIPT_KEY}:urlchange`;
    const wrap = (method) => {
      const original = history[method];
      history[method] = function patchedHistoryState() {
        const result = original.apply(this, arguments);
        window.dispatchEvent(new Event(eventName));
        return result;
      };
    };

    wrap('pushState');
    wrap('replaceState');
    window.addEventListener('popstate', () => window.dispatchEvent(new Event(eventName)));
    window.addEventListener(eventName, () => {
      setTimeout(() => {
        syncFromPage();
      }, 60);
    });
  }

  function boot() {
    installUrlWatcher();

    mountObserver = new MutationObserver(() => {
      if (!ensureMounted()) return;
      syncFromPage();
    });

    mountObserver.observe(document.body, { childList: true, subtree: true });
    syncFromPage();
  }

  boot();
})();
