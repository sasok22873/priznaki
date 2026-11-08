/* =========================================================================
   Банк: старые вкладки с карточками (Тексты / Фото / Аудио / Документы) +
   облако Яндекс.Диска с папками и файлами.
   Токен и секрет приложения живут только на сервере (Edge Function).
   ========================================================================= */
(function () {
  const FN = 'yandex-disk';
  const ROOT = 'disk:/ПБ24';
  const FOLDERS = {
    lyrics: '01_Тексты',
    photos: '02_Фото',
    audio: '03_Аудио',
    docs: '04_Документы',
    video: '05_Видео'
  };
  const TAB_TITLES = {
    lyrics: 'Тексты',
    photos: 'Фото',
    audio: 'Аудио',
    docs: 'Документы',
    cloud: 'Облако'
  };

  const state = {
    connected: false,
    isOwner: false,
    canWrite: false,
    notice: '',
    folders: [],
    cache: {},
    albumCache: {},
    busy: false,
    started: false,
    folder: '',
    album: null,
    albumName: '',
    page: {},
    folderMeta: {},
    busyTab: '',
    warmed: false,
    inflight: {}
  };

  const css = document.createElement('style');
  css.id = 'pbBankStyle';
  css.textContent = [
    '#bankApp{display:grid;gap:14px;margin-bottom:16px}',
    '.pb-bank-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 14px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:rgba(255,255,255,.02)}',
    '.pb-bank-status{display:flex;align-items:center;gap:8px;font-size:13px;color:#a8a3b3}',
    '.pb-bank-dot{width:8px;height:8px;border-radius:50%;background:#f59e0b}',
    '.pb-bank-dot.on{background:#34d399}',
    '.pb-bank-spacer{flex:1 1 auto}',
    '.pb-bank-cloud{margin-top:18px;display:grid;gap:12px}',
    '.pb-bank-cloud-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
    '.pb-bank-cloud-head h2{margin:0;font-size:17px;letter-spacing:-.01em}',
    '.pb-bank-cloud-head .pb-bank-hint{flex:1 1 auto}',
    '.pb-bank-folders{display:flex;flex-wrap:wrap;gap:8px}',
    '.pb-bank-folder{display:flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:rgba(255,255,255,.03);color:#d9d4e4;font-size:13px;cursor:pointer;transition:background .15s,border-color .15s,color .15s}',
    '.pb-bank-folder:hover{border-color:rgba(167,139,250,.4);background:rgba(167,139,250,.08)}',
    '.pb-bank-folder.active{border-color:rgba(167,139,250,.65);background:rgba(167,139,250,.16);color:#f1ecff}',
    '.pb-bank-folder .pb-icon{width:16px;height:16px;color:#c4b5fd}',
    '.pb-bank-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}',
    '.pb-bank-card{border:1px solid rgba(255,255,255,.07);border-radius:15px;background:#15151a;overflow:hidden;display:flex;flex-direction:column;transition:border-color .16s,transform .16s}',
    '.pb-bank-card:hover{border-color:rgba(167,139,250,.35);transform:translateY(-2px)}',
    '.pb-bank-thumb{height:124px;display:grid;place-items:center;background:#101014;color:#8f8a9c;overflow:hidden;position:relative}',
    '.pb-bank-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;z-index:1}',
    '.pb-bank-thumb .pb-icon{z-index:0}',
    '.pb-bank-thumb .pb-icon{width:32px;height:32px;color:#a78bfa}',
    '.pb-bank-body{padding:11px 13px 13px;display:grid;gap:6px;flex:1}',
    '.pb-bank-name{font-size:14px;font-weight:600;color:#eee9f7;line-height:1.35;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.pb-bank-sub{font-size:12px;color:#8f8a9c;display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
    '.pb-bank-actions{display:flex;gap:6px;margin-top:2px;flex-wrap:wrap}',
    '.pb-bank-empty{border:1px dashed rgba(255,255,255,.12);border-radius:15px;padding:26px 18px;text-align:center;color:#a8a3b3;display:grid;gap:8px;justify-items:center}',
    '.pb-bank-empty .pb-icon{width:28px;height:28px;color:#a78bfa}',
    '.pb-bank-connect{border:1px solid rgba(167,139,250,.25);background:linear-gradient(180deg,rgba(167,139,250,.09),rgba(167,139,250,.02));border-radius:18px;padding:22px;display:grid;gap:14px}',
    '.pb-bank-connect h3{margin:0;font-size:17px}',
    '.pb-bank-connect p{margin:0;font-size:13.5px;color:#a8a3b3;line-height:1.55}',
    '.pb-bank-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
    '.pb-bank-row .field{flex:1 1 260px}',
    '.pb-bank-hint{font-size:12px;color:#8f8a9c;line-height:1.5}',
    '.pb-bank-notice{border-radius:12px;padding:10px 13px;font-size:13px;border:1px solid rgba(248,113,113,.35);background:rgba(248,113,113,.08);color:#ffc9c9}',
    '.pb-bank-drop{border:1px dashed rgba(167,139,250,.3);border-radius:15px;padding:14px;text-align:center;font-size:13px;color:#a8a3b3;cursor:pointer}',
    '.pb-bank-drop.over{border-color:rgba(167,139,250,.8);background:rgba(167,139,250,.08);color:#efe9ff}',
    '.pb-bank-more{display:flex;justify-content:center;margin-top:12px}',
    '.pb-album-badge{position:absolute;top:8px;left:8px;z-index:2;display:grid;place-items:center;width:26px;height:26px;border-radius:9px;background:rgba(11,11,15,.72);color:#c4b5fd;border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(6px)}',
    '.pb-album-badge .pb-icon{width:15px;height:15px}',
    '.pb-song-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:end;margin:0 0 14px}',
    '.pb-song-name{display:grid;gap:6px;min-width:0;font-size:12px;color:#8f8a9c}',
    '.pb-song-name input{width:100%}',
    '.pb-song-icon{display:grid;gap:6px;font-size:12px;color:#8f8a9c}',
    '.pb-song-icon .pb-icon-btn{width:54px;min-height:46px;justify-content:center;padding:6px}',
    '.pb-song-icon .pb-icon-name{display:none}',
    '.pb-song-sections{display:grid;gap:10px;margin:0 0 14px}',
    '.pb-sec-list{display:grid;gap:10px}',
    '.pb-sec-item{border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.02);padding:10px 12px;position:relative;transition:border-color .15s,box-shadow .15s}',
    '.pb-sec-item:hover{border-color:rgba(167,139,250,.35)}',
    '.pb-sec-item.dragging{border-color:rgba(167,139,250,.85);box-shadow:0 16px 34px rgba(0,0,0,.55);background:rgba(167,139,250,.06);z-index:5}',
    '.pb-sec-item-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
    '.pb-sec-handle{display:grid;place-items:center;width:24px;height:24px;border-radius:7px;color:#6f6a7d;cursor:grab;touch-action:none;flex:0 0 auto;font-size:15px;line-height:1}',
    '.pb-sec-handle:hover{color:#c4b5fd;background:rgba(167,139,250,.14)}',
    '.pb-sec-handle:active{cursor:grabbing}',
    '.pb-sec-item-head input{flex:1 1 auto;min-width:0;background:transparent;border:0;border-bottom:1px dashed rgba(255,255,255,.16);color:#e6e2ee;font:600 13.5px inherit;padding:2px 0}',
    '.pb-sec-item-head input:focus{outline:none;border-bottom-color:rgba(167,139,250,.85)}',
    '.pb-sec-del{width:24px;height:24px;border-radius:7px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:#a8a3b3;cursor:pointer;line-height:1;flex:0 0 auto}',
    '.pb-sec-del:hover{color:#fff;border-color:rgba(248,113,113,.7);background:rgba(248,113,113,.14)}',
    '.pb-sec-item textarea{width:100%;min-height:62px;resize:vertical;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#e7e2f2;font:13px/1.5 inherit;padding:8px 10px}',
    '.pb-sec-add-wrap{position:relative;display:flex}',
    '.pb-sec-add{width:100%;justify-content:center;border-style:dashed}',
    '.pb-sec-menu{left:0;right:0;top:calc(100% + 6px);z-index:70;display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:8px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#17151d;box-shadow:0 18px 38px rgba(0,0,0,.6)}',
    '.pb-sec-menu[hidden]{display:none}',
    '.pb-sec-menu button{text-align:left;padding:7px 9px;border-radius:8px;border:0;background:transparent;color:#e6e2ee;font:13px inherit;cursor:pointer}',
    '.pb-sec-menu button:hover{background:rgba(167,139,250,.16)}',
    '.pb-song-note{display:grid;gap:6px;margin:0 0 14px;font-size:12px;color:#8f8a9c}',
    '.pb-sec-raw{display:flex;align-items:center;gap:8px;font-size:12px;color:#8f8a9c;margin-top:6px}',
    '.pb-card-preview{margin:0 0 14px;border-radius:12px;overflow:hidden;background:#101014;display:grid;place-items:center;max-height:260px}',
    '.pb-card-preview img{width:100%;max-height:260px;object-fit:contain;display:block}',
    '.pb-viewer-modal{max-width:920px!important;width:min(920px,96vw)!important}',
    '.pb-viewer-body{display:grid;place-items:center;min-height:200px;max-height:70vh;overflow:hidden;border-radius:14px;background:#0d0d11}',
    '.pb-viewer-img{max-width:100%;max-height:70vh;object-fit:contain;display:block}',
    '.pb-viewer-video{max-width:100%;max-height:70vh;display:block;background:#000;border-radius:12px}',
    '.pb-viewer-audio{width:min(560px,90%);margin:40px 0}',
    '.pb-viewer-loading{color:#8f8a9c;font-size:13px;padding:40px}',
    '.pb-viewer-foot{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}',
    '@media (max-width:700px){.pb-bank-grid{grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:10px}.pb-bank-thumb{height:104px}}'
  ].join('');
  document.head.appendChild(css);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function icon(name, cls) { return (typeof window.pbIcon === 'function') ? window.pbIcon(name, cls) : ''; }
  function toast(msg) { if (typeof window.toast === 'function') window.toast(msg); }
  function fmtSize(bytes) {
    const n = Number(bytes || 0);
    if (!n) return '';
    if (n < 1024) return n + ' Б';
    if (n < 1048576) return (n / 1024).toFixed(0) + ' КБ';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' МБ';
    return (n / 1073741824).toFixed(2) + ' ГБ';
  }
  function fmtDate(v) {
    if (!v) return '';
    try { return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(v)); }
    catch (e) { return ''; }
  }
  function kindOfFile(name, mime) {
    const m = String(mime || '').toLowerCase();
    const n = String(name || '').toLowerCase();
    if (m.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|bmp|svg|tiff?)$/.test(n)) return 'photos';
    if (m.startsWith('audio/') || /\.(mp3|wav|flac|m4a|aac|ogg|opus)$/.test(n)) return 'audio';
    if (m.startsWith('video/') || /\.(mp4|mov|mkv|avi|webm)$/.test(n)) return 'video';
    return 'docs';
  }
  function iconForKind(kind) {
    return ({ photos: 'image', audio: 'audio-lines', docs: 'file-text', video: 'video', lyrics: 'file-text' })[kind] || 'file';
  }
  function currentTab() {
    try { if (typeof bankTab !== 'undefined') return bankTab; } catch (e) { }
    return 'lyrics';
  }
  function tabFolder(tab) {
    return FOLDERS[tab] ? ROOT + '/' + FOLDERS[tab] : ROOT;
  }

  // Превью идут через Edge Function yandex-thumb: токен Диска в браузер не попадает.
  function supaBase() {
    const u = window.SUPABASE_URL || '';
    return (u || 'https://mbbetmtxawduvcsttiis.supabase.co').replace(/\/+$/, '');
  }
  async function accessToken() {
    try {
      if (state.tok && state.tokExp && Date.now() < state.tokExp - 30000) return state.tok;
      const { data } = await window.supabaseClient.auth.getSession();
      const s = data && data.session;
      if (!s) return '';
      state.tok = s.access_token;
      state.tokExp = (s.expires_at || 0) * 1000;
      return state.tok;
    } catch (e) { return ''; }
  }
  async function thumbUrlFor(path) {
    const t = await accessToken();
    if (!t) return '';
    return supaBase() + '/functions/v1/yandex-thumb?p=' + encodeURIComponent(path) + '&t=' + encodeURIComponent(t);
  }

  // Ссылка на файл через прокси: открывается в браузере без токена Диска.
  async function fileProxyUrl(path) {
    const t = await accessToken();
    if (!t) return '';
    return supaBase() + '/functions/v1/yandex-thumb?p=' + encodeURIComponent(path) + '&t=' + encodeURIComponent(t) + '&dl=1';
  }

  async function loadFolderMeta(dirs) {
    state.folderMeta = {};
    try {
      if (!dirs || !dirs.length || !window.supabaseClient) return;
      const paths = dirs.map(function (d) { return d.path; });
      const { data } = await window.supabaseClient.from('bank_folders').select('yandex_path, icon, name, created_by').in('yandex_path', paths);
      (data || []).forEach(function (r) { state.folderMeta[r.yandex_path] = r; });
    } catch (e) { }
  }
  function folderIconOf(path) {
    const m = state.folderMeta && state.folderMeta[path];
    return m && m.icon ? m.icon : '';
  }

  // Скрываем устаревшие блоки старого Банка на облачных вкладках.
  function syncLegacy(tab) {
    // Старый Банк больше не показываем: карточки и файлы — только наши.
    const box = document.getElementById('bankContent');
    if (!box) return;
    Array.prototype.forEach.call(box.children, function (el) {
      if (el.id === 'pbBankCloudSection' || el.getAttribute('data-bank-mode') === 'cloud') return;
      el.style.display = 'none';
    });
    const actions = document.querySelector('#bank > .bank-actions');
    if (actions) actions.style.display = 'none';
  }

  function pageLimit(key) { return state.page[key] || 24; }
  function pagedItems(items, key) { return items.slice(0, pageLimit(key)); }
  function moreButton(items, key) {
    const shown = pageLimit(key);
    if (items.length <= shown) return '';
    return '<div class="pb-bank-more"><button class="btn ghost tiny" type="button" data-bank-more="' + esc(key) + '">Показать ещё (' + (items.length - shown) + ')</button></div>';
  }
  // Сжатые превью держим только в памяти браузера: в базе полноразмерные картинки не нужны,
  // оригиналы остаются в облаке в исходном качестве.
  const thumbCache = {};
  function cacheDownscaled(img, path) {
    try {
      if (!path || !img.naturalWidth || !img.naturalHeight) return;
      const max = 640;
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      if (scale >= 1) return;
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * scale));
      c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL('image/jpeg', 0.82);
      thumbCache[path] = data;
      img.src = data;
    } catch (e) { /* чужие картинки без CORS не трогаем */ }
  }

  async function hydrateThumbs(root) {
    const imgs = (root || document).querySelectorAll('img[data-thumb]');
    for (const img of Array.from(imgs)) {
      if (img.dataset.hydrated === '1') continue;
      img.dataset.hydrated = '1';
      const path = img.getAttribute('data-thumb');
      if (path && thumbCache[path]) { img.src = thumbCache[path]; continue; }
      const applyProxy = async function (retry) {
        const u = await thumbUrlFor(path);
        if (!u) { img.remove(); return; }
        img.crossOrigin = 'anonymous';
        img.addEventListener('load', function once() {
          img.removeEventListener('load', once);
          cacheDownscaled(img, path);
        }, { once: true });
        img.addEventListener('error', function retryOnce() {
          img.removeEventListener('error', retryOnce);
          if (retry) {
            setTimeout(function () { img.src = u + '&r=' + Date.now(); }, 900);
          } else {
            img.remove();
          }
        }, { once: true });
        img.src = u;
      };
      img.addEventListener('error', function handler() {
        img.removeEventListener('error', handler);
        if (!path) { img.remove(); return; }
        applyProxy(true);
      });
      if (img.dataset.preview && !img.getAttribute('src')) img.src = img.dataset.preview;
    }
  }

  async function callFn(body) {
    if (!window.__CURRENT_PROFILE__) return { error: { message: 'Нет активной сессии' } };
    const c = window.supabaseClient;
    if (!c || !c.functions) return { error: { message: 'Нет подключения к Supabase' } };
    const res = await c.functions.invoke(FN, { body: body });
    if (res.error) {
      let msg = res.error.message || 'Ошибка Edge Function';
      try {
        if (res.error.context && typeof res.error.context.json === 'function') {
          const j = await res.error.context.json();
          if (j && j.error) msg = j.error;
        }
      } catch (e) { }
      return { error: { message: msg } };
    }
    return { data: res.data || {} };
  }

  function ensureRoot() {
    const bank = document.getElementById('bank');
    if (!bank) return null;
    let host = document.getElementById('bankApp');
    if (!host) {
      host = document.createElement('div');
      host.id = 'bankApp';
      const tabs = bank.querySelector('.tabs');
      if (tabs && tabs.parentNode === bank) bank.insertBefore(host, tabs);
      else bank.appendChild(host);
    }
    return host;
  }

  // ---------- подключение ----------
  async function loadStatus() {
    const st = await callFn({ action: 'status' });
    if (st.error) { state.notice = st.error.message; state.connected = false; return; }
    state.connected = !!st.data.connected;
    state.isOwner = !!st.data.is_owner;
    state.canWrite = !!st.data.can_write;
  }

  async function ensureFolders() {
    if (!state.connected || !state.canWrite) return;
    const res = await callFn({ action: 'folders' });
    const existing = ((res.data && res.data.folders) || []).map(function (f) { return f.name; });
    state.folders = existing;
    const missing = Object.keys(FOLDERS).map(function (k) { return FOLDERS[k]; }).filter(function (n) { return existing.indexOf(n) === -1; });
    for (const name of missing) await callFn({ action: 'mkdir', name: name });
    if (missing.length) {
      const again = await callFn({ action: 'folders' });
      state.folders = ((again.data && again.data.folders) || []).map(function (f) { return f.name; });
    }
  }

  async function listFolder(path) {
    if (state.cache[path]) return state.cache[path];
    if (!state.inflight) state.inflight = {};
    if (state.inflight[path]) return state.inflight[path];
    const job = (async function () {
      const res = await callFn({ action: 'list', path: path });
      const all = (res.error ? [] : (res.data.items || []));
      const entry = {
        files: all.filter(function (it) { return it.type === 'file'; }),
        dirs: all.filter(function (it) { return it.type === 'dir'; })
      };
      state.cache[path] = entry;
      delete state.inflight[path];
      return entry;
    })();
    state.inflight[path] = job;
    return job;
  }

  async function albumInfo(dir) {
    if (state.albumCache[dir.path]) return state.albumCache[dir.path];
    if (!state.cache[dir.path]) await listFolderMany([dir.path]);
    return albumInfoFromCache(dir);
  }

  function albumInfoFromCache(dir) {
    if (state.albumCache[dir.path]) return state.albumCache[dir.path];
    const res = state.cache[dir.path] || { files: [], dirs: [] };
    const photos = res.files.filter(function (f) { return kindOfFile(f.name, f.mime) === 'photos'; });
    const coverItem = photos.find(function (f) { return !!f.preview; }) || res.files.find(function (f) { return !!f.preview; }) || null;
    const info = { dir: dir, files: res.files, photos: photos, cover: coverItem ? coverItem.preview : '', coverPath: coverItem ? coverItem.path : '', count: photos.length || res.files.length };
    state.albumCache[dir.path] = info;
    return info;
  }

  // Один запрос на много папок: сильно ускоряет альбомы и «Все файлы».
  async function listFolderMany(paths) {
    const need = (paths || []).filter(function (p) { return p && !state.cache[p]; });
    if (!need.length) return;
    if (!state.inflight) state.inflight = {};
    const key = 'browse:' + need.slice().sort().join('|');
    if (state.inflight[key]) return state.inflight[key];
    const job = (async function () {
      const r = await callFn({ action: 'browse', paths: need });
      const lists = (r.data && r.data.lists) || {};
      need.forEach(function (p) {
        const v = lists[p];
        if (v && !v.error) state.cache[p] = { files: v.files || [], dirs: v.dirs || [] };
        else state.cache[p] = { files: [], dirs: [] };
      });
      delete state.inflight[key];
    })();
    state.inflight[key] = job;
    return job;
  }

  // ---------- загрузка ----------
  async function uploadFiles(files, tab, targetPath) {
    if (!files || !files.length) return;
    if (!state.canWrite) { toast('Загружать файлы может владелец или участник'); return; }
    const folder = targetPath ? String(targetPath).replace(/\/+$/, '') : tabFolder(tab);
    const folderName = targetPath ? String(targetPath).split('/').pop() : (FOLDERS[tab] || '');
    const me = window.__CURRENT_PROFILE__ || {};
    let ok = 0;
    for (const file of Array.from(files)) {
      try {
        const safe = String(file.name).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
        const path = folder + '/' + safe;
        const link = await callFn({ action: 'upload-link', path: path });
        if (link.error) { toast('«' + file.name + '»: ' + link.error.message); continue; }
        const put = await fetch(link.data.href, { method: (link.data.method || 'PUT'), body: file });
        if (!put.ok) { toast('«' + file.name + '»: Яндекс не принял файл'); continue; }
        const st = await callFn({ action: 'stat', path: path });
        const item = (st.data && st.data.item) ? st.data.item : {};
        if (window.supabaseClient) {
          await window.supabaseClient.from('bank_files').upsert({
            yandex_path: path,
            name: safe,
            mime: item.mime || file.type || '',
            kind: kindOfFile(safe, item.mime || file.type),
            size: Number(item.size || file.size || 0),
            folder: folderName || '',
            uploaded_by: me.id || null,
            owner_name: me.full_name || '',
            note: '',
            icon: '',
            preview_url: ''
          }, { onConflict: 'yandex_path' });
        }
        ok++;
      } catch (e) {
        toast('«' + file.name + '»: ' + ((e && e.message) || e));
      }
    }
    state.cache = {};
    state.albumCache = {};
    if (ok) { toast(ok === 1 ? 'Файл загружен в облако' : 'Загружено файлов: ' + ok); await render(true); }
  }

  async function openFile(item) {
    const kind = kindOfFile(item.name, item.mime);
    const isText = /\.(txt|md|csv|json)$/i.test(item.name) || String(item.mime || '').indexOf('text/') === 0;
    if (isText) { openFileCard(item); return; }
    if (kind === 'photos') { openViewer(item, 'image'); return; }
    if (kind === 'audio') { openViewer(item, 'audio'); return; }
    if (kind === 'video') { openViewer(item, 'video'); return; }
    const u = await fileProxyUrl(item.path);
    if (!u) { toast('Нет доступа к файлу'); return; }
    window.open(u, '_blank', 'noopener');
  }

  // ---------- просмотр файла прямо из облака (без страниц Supabase) ----------
  let viewerItem = null;
  function ensureViewer() {
    if (document.getElementById('pbViewer')) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.id = 'pbViewer';
    wrap.innerHTML = [
      '<div class="modal pb-viewer-modal" role="dialog" aria-modal="true">',
      '<div class="modal-head"><h2 id="pbViewerTitle">Файл</h2><button class="close" type="button" id="pbViewerClose">×</button></div>',
      '<div class="pb-viewer-body" id="pbViewerBody"></div>',
      '<div class="pb-viewer-foot">',
      '<button class="btn ghost tiny" type="button" id="pbViewerCard">Карточка</button>',
      '<button class="btn ghost tiny" type="button" id="pbViewerCloud">Открыть в Яндекс.Диске</button>',
      '<button class="btn ghost tiny" type="button" id="pbViewerDownload">Скачать</button>',
      '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeViewer(); });
    document.getElementById('pbViewerClose').onclick = closeViewer;
    document.getElementById('pbViewerCard').onclick = function () { const it = viewerItem; closeViewer(); if (it) openFileCard(it); };
    document.getElementById('pbViewerCloud').onclick = openInCloud;
    document.getElementById('pbViewerDownload').onclick = async function () {
      if (!viewerItem) return;
      const u = await fileProxyUrl(viewerItem.path);
      if (u) window.open(u, '_blank', 'noopener');
    };
  }
  async function openViewer(item, type) {
    ensureViewer();
    viewerItem = item;
    const body = document.getElementById('pbViewerBody');
    document.getElementById('pbViewerTitle').textContent = item.name || 'Файл';
    body.innerHTML = '<div class="pb-viewer-loading">Загружаем из облака…</div>';
    document.getElementById('pbViewer').classList.add('open');
    const u = await fileProxyUrl(item.path);
    if (!u) { body.innerHTML = '<div class="pb-viewer-loading">Нет доступа к файлу</div>'; return; }
    if (type === 'image') {
      body.innerHTML = '<img class="pb-viewer-img" src="' + esc(u) + '" alt="">';
    } else if (type === 'audio') {
      body.innerHTML = '<audio class="pb-viewer-audio" controls preload="metadata" src="' + esc(u) + '"></audio>';
    } else {
      body.innerHTML = '<video class="pb-viewer-video" controls preload="metadata" playsinline src="' + esc(u) + '"></video>';
    }
  }
  function closeViewer() {
    const el = document.getElementById('pbViewer');
    if (el) el.classList.remove('open');
    const body = document.getElementById('pbViewerBody');
    if (body) body.innerHTML = '';
    viewerItem = null;
  }
  async function openInCloud() {
    if (!viewerItem) return;
    const r = await callFn({ action: 'public-url', path: viewerItem.path });
    if (r.error || !r.data || !r.data.url) { toast('Не удалось получить ссылку на облако'); return; }
    window.open(r.data.url, '_blank', 'noopener');
  }

  async function deleteFile(item) {
    if (!confirm('Удалить «' + item.name + '» из облака? Файл удалится навсегда.')) return;
    const r = await callFn({ action: 'delete', path: item.path });
    if (r.error) { toast(r.error.message); return; }
    state.cache = {};
    state.albumCache = {};
    toast('Файл удалён');
    await render(true);
  }

  // ---------- карточка файла: название, заметка, иконка, текст, удаление ----------
  let cardCtx = null;
  let cardIcon = '';
  // ---------- разделы песни (Куплет / Припев / ...) ----------
  const SEC_TYPES = ['Куплет', 'Припев', 'Пре-хор', 'Бридж', 'Интро', 'Проигрыш', 'Соло', 'Аутро', 'Речитатив', 'Кода', 'Финал'];
  function isLyricsPath(path) {
    return String(path || '').indexOf('/' + FOLDERS.lyrics + '/') !== -1 || /\/01_/.test(String(path || ''));
  }
  function parseSongSections(text) {
    const lines = String(text || '').split(/\r?\n/);
    const list = [];
    let cur = null;
    lines.forEach(function (line) {
      const m = line.match(/^\s*\[([^\]]{1,40})\]\s*$/);
      if (m) { cur = { title: m[1].trim(), text: [] }; list.push(cur); }
      else {
        if (!cur) { cur = { title: 'Куплет 1', text: [] }; list.push(cur); }
        cur.text.push(line);
      }
    });
    if (!list.length) list.push({ title: 'Куплет 1', text: [] });
    list.forEach(function (sec) { sec.text = sec.text.join('\n').replace(/\n{3,}/g, '\n\n').trim(); });
    return list;
  }
  function sectionsToText(list) {
    if (!list || !list.length) return '';
    return list.map(function (sec) {
      return '[' + (sec.title || 'Куплет') + ']\n' + String(sec.text || '').trim();
    }).join('\n\n') + '\n';
  }
  function secNextTitle(type) {
    const list = collectSections();
    if (['Интро', 'Аутро', 'Кода', 'Финал', 'Соло', 'Проигрыш'].indexOf(type) !== -1) return type;
    let n = 0;
    list.forEach(function (sec) { if (String(sec.title).indexOf(type) === 0) n++; });
    return type + ' ' + (n + 1);
  }
  function renderSections(list) {
    const box = document.getElementById('pbCardSections');
    if (!box) return;
    box.innerHTML = '';
    if (!list || !list.length) {
      box.innerHTML = '<div class="pb-bank-hint">Разделов пока нет — нажмите «＋ Создать раздел».</div>';
      return;
    }
    (list || []).forEach(function (sec, i) {
      const item = document.createElement('div');
      item.className = 'pb-sec-item';
      item.dataset.i = String(i);
      item.innerHTML = '<div class="pb-sec-item-head">' +
        '<span class="pb-sec-handle" title="Перетащить раздел">⠿</span>' +
        '<input class="pb-sec-title" value="' + esc(sec.title || '') + '" maxlength="40" aria-label="Название раздела">' +
        '<button type="button" class="pb-sec-del" data-sec-del="1" title="Удалить раздел">✕</button>' +
        '</div>' +
        '<textarea class="pb-sec-text" rows="3" placeholder="Текст раздела">' + esc(sec.text || '') + '</textarea>';
      box.appendChild(item);
    });
    wireSectionDrag();
  }
  function collectSections() {
    const box = document.getElementById('pbCardSections');
    if (!box) return [];
    return Array.prototype.map.call(box.querySelectorAll('.pb-sec-item'), function (item) {
      return {
        title: (item.querySelector('.pb-sec-title') || {}).value || 'Куплет',
        text: (item.querySelector('.pb-sec-text') || {}).value || ''
      };
    });
  }
  function addSection(type) {
    const list = collectSections();
    list.push({ title: secNextTitle(type), text: '' });
    renderSections(list);
    const box = document.getElementById('pbCardSections');
    const items = box ? box.querySelectorAll('.pb-sec-item') : [];
    const lastEl = items.length ? items[items.length - 1] : null;
    const ta = lastEl ? lastEl.querySelector('.pb-sec-text') : null;
    if (ta) ta.focus();
  }
  let secMenuWired = false;
  function ensureSecMenu() {
    const menu = document.getElementById('pbCardSecMenu');
    if (!menu || menu.dataset.ready === '1') return;
    menu.dataset.ready = '1';
    menu.innerHTML = SEC_TYPES.map(function (t) {
      return '<button type="button" data-sec-pick="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
    menu.addEventListener('click', function (e) {
      const b = e.target.closest('[data-sec-pick]');
      if (!b) return;
      addSection(b.getAttribute('data-sec-pick'));
      closeSecMenu();
    });
    if (!secMenuWired) {
      secMenuWired = true;
      document.addEventListener('click', function (e) {
        if (!e.target.closest('.pb-sec-add-wrap')) closeSecMenu();
      });
    }
  }
  function toggleSecMenu() {
    const m = document.getElementById('pbCardSecMenu');
    const btn = document.getElementById('pbCardSecAdd');
    if (!m || !btn) return;
    if (!m.hidden) { m.hidden = true; return; }
    const r = btn.getBoundingClientRect();
    m.style.position = 'fixed';
    m.style.left = Math.round(r.left) + 'px';
    m.style.width = Math.round(r.width) + 'px';
    const below = window.innerHeight - r.bottom - 14;
    if (below < 220 && r.top > 240) {
      m.style.top = 'auto';
      m.style.bottom = Math.round(window.innerHeight - r.top + 6) + 'px';
      m.style.maxHeight = Math.min(260, r.top - 20) + 'px';
    } else {
      m.style.bottom = 'auto';
      m.style.top = Math.round(r.bottom + 6) + 'px';
      m.style.maxHeight = Math.min(260, below) + 'px';
    }
    m.style.overflowY = 'auto';
    m.hidden = false;
  }
  function closeSecMenu() {
    const m = document.getElementById('pbCardSecMenu');
    if (m) m.hidden = true;
  }
  let secDrag = null;
  function wireSectionDrag() {
    const list = document.getElementById('pbCardSections');
    if (!list || list.dataset.dragWired === '1') return;
    list.dataset.dragWired = '1';
    list.addEventListener('pointerdown', function (e) {
      const handle = e.target.closest('.pb-sec-handle');
      if (!handle) return;
      const item = handle.closest('.pb-sec-item');
      if (!item) return;
      e.preventDefault();
      secDrag = { item: item, list: list };
      item.classList.add('dragging');
      try { handle.setPointerCapture(e.pointerId); } catch (_e) { }
    });
    list.addEventListener('pointermove', function (e) {
      if (!secDrag) return;
      const item = secDrag.item;
      const siblings = Array.prototype.filter.call(list.querySelectorAll('.pb-sec-item'), function (el) { return el !== item; });
      let target = null;
      for (let k = 0; k < siblings.length; k++) {
        const r = siblings[k].getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { target = siblings[k]; break; }
      }
      if (target) {
        if (item.nextElementSibling !== target) list.insertBefore(item, target);
      } else if (list.lastElementChild !== item) {
        list.appendChild(item);
      }
    });
    function endDrag() {
      if (!secDrag) return;
      secDrag.item.classList.remove('dragging');
      secDrag = null;
      Array.prototype.forEach.call(list.querySelectorAll('.pb-sec-item'), function (el, i) { el.dataset.i = String(i); });
    }
    list.addEventListener('pointerup', endDrag);
    list.addEventListener('pointercancel', endDrag);
  }
  function wireSections() {
    ensureSecMenu();
    const addBtn = document.getElementById('pbCardSecAdd');
    if (addBtn && addBtn.dataset.wired !== '1') {
      addBtn.dataset.wired = '1';
      addBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleSecMenu();
      });
    }
    const box = document.getElementById('pbCardSections');
    if (box && box.dataset.wired !== '1') {
      box.dataset.wired = '1';
      box.addEventListener('click', function (e) {
        const del = e.target.closest('[data-sec-del]');
        if (!del) return;
        const item = del.closest('.pb-sec-item');
        if (!item) return;
        const list = collectSections();
        list.splice(Number(item.dataset.i), 1);
        renderSections(list);
      });
    }
    const raw = document.getElementById('pbCardRawMode');
    if (raw && raw.dataset.wired !== '1') {
      raw.dataset.wired = '1';
      raw.addEventListener('change', function () {
        const textWrap = document.getElementById('pbCardTextWrap');
        const textEl = document.getElementById('pbCardText');
        if (raw.checked) {
          if (textEl) textEl.value = sectionsToText(collectSections());
          if (textWrap) textWrap.hidden = false;
        } else {
          if (textEl) renderSections(parseSongSections(textEl.value));
          if (textWrap) textWrap.hidden = true;
        }
      });
    }
  }
  function currentCardText() {
    const rawMode = document.getElementById('pbCardRawMode');
    const sectionsWrap = document.getElementById('pbCardSectionsWrap');
    const textEl = document.getElementById('pbCardText');
    if (sectionsWrap && !sectionsWrap.hidden && !(rawMode && rawMode.checked)) {
      return sectionsToText(collectSections());
    }
    return textEl ? textEl.value : '';
  }
  function showSectionsMode(text) {
    ensureFileCard();
    wireSections();
    const wrap = document.getElementById('pbCardSectionsWrap');
    const textWrap = document.getElementById('pbCardTextWrap');
    const raw = document.getElementById('pbCardRawMode');
    if (wrap) wrap.hidden = false;
    if (textWrap) textWrap.hidden = true;
    if (raw) raw.checked = false;
    const clean = String(text || '').trim();
    renderSections(clean ? parseSongSections(clean) : []);
  }
  function hideSectionsMode() {
    const wrap = document.getElementById('pbCardSectionsWrap');
    if (wrap) wrap.hidden = true;
    const raw = document.getElementById('pbCardRawMode');
    if (raw) raw.checked = false;
    closeSecMenu();
  }

  function ensureFileCard() {
    if (document.getElementById('pbFileCard')) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.id = 'pbFileCard';
    wrap.innerHTML = [
      '<div class="modal pb-song-modal" role="dialog" aria-modal="true" style="max-width:640px">',
      '<div class="pb-modal-title">Карточка файла</div>',
      '<p class="pb-modal-sub" id="pbCardMeta"></p>',
      '<div class="pb-card-preview" id="pbCardPreview" hidden></div>',
      '<div class="pb-song-head">',
      '<label class="pb-song-name">Название<input class="field" id="pbCardName" maxlength="140"></label>',
      '<div class="pb-song-icon"><span>Иконка</span><button type="button" class="pb-icon-btn" id="pbCardIconBtn"><span class="pb-icon-preview" id="pbCardIconPreview"></span><span class="pb-icon-name" id="pbCardIconName">Выбрать иконку</span></button></div>',
      '</div>',
      '<div id="pbCardSectionsWrap" class="pb-song-sections" hidden>',
      '<div class="pb-sec-list" id="pbCardSections"></div>',
      '<div class="pb-sec-add-wrap">',
      '<button type="button" class="btn ghost pb-sec-add" id="pbCardSecAdd">＋ Создать раздел</button>',
      '<div class="pb-sec-menu" id="pbCardSecMenu" hidden></div>',
      '</div>',
      '<label class="pb-sec-raw"><input type="checkbox" id="pbCardRawMode"> Редактировать как обычный текст</label>',
      '</div>',
      '<label class="pb-song-note">Заметка<textarea class="field" id="pbCardNote" rows="3" placeholder="Что это за файл, для чего, кому нужно"></textarea></label>',
      '<div id="pbCardTextWrap" hidden><label>Содержимое текста<textarea class="field" id="pbCardText" rows="10"></textarea></label></div>',
      '<div class="pb-modal-actions" style="justify-content:space-between">',
      '<div><button class="btn ghost" type="button" id="pbCardCancel">Отмена</button></div>',
      '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">',
      '<button class="btn ghost" type="button" id="pbCardOpen">Открыть</button>',
      '<button class="btn ghost" type="button" id="pbCardDelete" style="display:none">Удалить</button>',
      '<button class="btn red" type="button" id="pbCardSave">Сохранить</button>',
      '</div></div>',
      '</div>'
    ].join('');
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeFileCard(); });
    document.getElementById('pbCardCancel').onclick = closeFileCard;
    document.getElementById('pbCardIconBtn').onclick = function () {
      if (typeof window.pbPickIconGlobal !== 'function') { toast('Выбор иконок недоступен'); return; }
      window.pbPickIconGlobal('Иконка карточки', cardIcon, function (ic) { cardIcon = ic; paintCardIcon(); });
    };
    document.getElementById('pbCardSave').onclick = saveFileCard;
    document.getElementById('pbCardOpen').onclick = function () { if (cardCtx) openFile(cardCtx.item); };
    document.getElementById('pbCardDelete').onclick = deleteFromCard;
    wireSections();
  }

  function paintCardIcon() {
    const p = document.getElementById('pbCardIconPreview');
    const n = document.getElementById('pbCardIconName');
    if (p) p.innerHTML = icon(cardIcon || 'file');
    if (n) n.textContent = cardIcon || 'Выбрать иконку';
  }
  async function openFileCard(item) {
    ensureFileCard();
    let row = null;
    try {
      const { data } = await window.supabaseClient.from('bank_files').select('*').eq('yandex_path', item.path).maybeSingle();
      row = data;
    } catch (e) { }
    const me = window.__CURRENT_PROFILE__ || {};
    cardCtx = { item: item, row: row || {}, originalName: item.name, originalText: '' };
    cardIcon = (row && row.icon) || '';
    const folderPath = item.path.split('/').slice(0, -1).join(' / ');
    document.getElementById('pbCardMeta').textContent = [
      fmtSize(item.size),
      item.created ? fmtDate(item.created) : '',
      (row && row.owner_name) || '',
      folderPath
    ].filter(Boolean).join(' · ');
    document.getElementById('pbCardName').value = (row && row.name) || item.name;
    document.getElementById('pbCardNote').value = (row && row.note) || '';
    paintCardIcon();
    const isText = /\.(txt|md|csv|json)$/i.test(item.name) || String(item.mime || '').indexOf('text/') === 0;
    const lyrics = isText && isLyricsPath(item.path);
    const textWrap = document.getElementById('pbCardTextWrap');
    const textEl = document.getElementById('pbCardText');
    textWrap.hidden = !isText || lyrics;
    textEl.value = '';
    if (isText) {
      const u = await fileProxyUrl(item.path);
      if (u) {
        try {
          // свежий текст: обходим кэш браузера после правок
          const fresh = u + (u.indexOf('?') >= 0 ? '&' : '?') + 'r=' + Date.now();
          const r = await fetch(fresh);
          if (r.ok) { cardCtx.originalText = await r.text(); textEl.value = cardCtx.originalText; }
        } catch (e) { }
      }
    }
    if (lyrics) showSectionsMode(cardCtx.originalText); else hideSectionsMode();
    const prev = document.getElementById('pbCardPreview');
    if (kindOfFile(item.name, item.mime) === 'photos') {
      const u = await fileProxyUrl(item.path);
      prev.hidden = false;
      prev.innerHTML = u ? '<img src="' + esc(u) + '" alt="">' : '';
    } else {
      prev.hidden = true;
      prev.innerHTML = '';
    }
    const del = document.getElementById('pbCardDelete');
    const canDelete = state.isOwner || (row && row.uploaded_by && me.id && row.uploaded_by === me.id);
    del.style.display = (state.canWrite && canDelete) ? '' : 'none';
    document.getElementById('pbFileCard').classList.add('open');
  }
  function closeFileCard() {
    const el = document.getElementById('pbFileCard');
    if (el) el.classList.remove('open');
    cardCtx = null;
  }

  // Новая песня: та же карточка, что и при редактировании; сохраняется в облако как .txt
  function openNewLyric() {
    ensureFileCard();
    cardCtx = {
      isNew: true,
      item: { name: '', mime: 'text/plain', size: 0, path: '', preview: '' },
      row: {},
      originalName: '',
      originalText: ''
    };
    cardIcon = '';
    document.getElementById('pbCardMeta').textContent = 'Новая карточка песни · сохранится в «' + FOLDERS.lyrics + '» как .txt';
    document.getElementById('pbCardName').value = '';
    document.getElementById('pbCardNote').value = '';
    const textWrap = document.getElementById('pbCardTextWrap');
    textWrap.hidden = true;
    document.getElementById('pbCardText').value = '';
    showSectionsMode('');
    const prev = document.getElementById('pbCardPreview');
    prev.hidden = true;
    prev.innerHTML = '';
    paintCardIcon();
    document.getElementById('pbCardDelete').style.display = 'none';
    document.getElementById('pbFileCard').classList.add('open');
    setTimeout(function () { document.getElementById('pbCardName').focus(); }, 60);
  }

  async function saveNewLyric() {
    const nameEl = document.getElementById('pbCardName');
    const btn = document.getElementById('pbCardSave');
    const name = nameEl.value.trim();
    if (!name) { toast('Введите название песни'); nameEl.focus(); return; }
    const text = currentCardText();
    const note = document.getElementById('pbCardNote').value;
    const fileName = name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) + '.txt';
    const path = ROOT + '/' + FOLDERS.lyrics + '/' + fileName;
    btn.disabled = true;
    const oldLabel = btn.textContent;
    btn.textContent = 'Сохраняем…';
    try {
      const link = await callFn({ action: 'upload-link', path: path });
      if (link.error) { toast('Не сохранилось: ' + link.error.message); return; }
      const put = await fetch(link.data.href, {
        method: link.data.method || 'PUT',
        body: new Blob([text], { type: 'text/plain;charset=utf-8' })
      });
      if (!put.ok) { toast('Яндекс не принял файл'); return; }
      const me = window.__CURRENT_PROFILE__ || {};
      if (window.supabaseClient) {
        await window.supabaseClient.from('bank_files').upsert({
          yandex_path: path,
          name: fileName,
          mime: 'text/plain',
          kind: 'docs',
          size: new Blob([text]).size,
          folder: FOLDERS.lyrics,
          uploaded_by: me.id || null,
          owner_name: me.full_name || '',
          note: note,
          icon: cardIcon,
          preview_url: ''
        }, { onConflict: 'yandex_path' });
      }
      state.cache = {};
      state.albumCache = {};
      state.metaMap = {};
      closeFileCard();
      toast('Карточка песни создана');
      await render(true, 'lyrics');
    } finally {
      btn.disabled = false;
      btn.textContent = oldLabel;
    }
  }
  window.pbBankFileCard = function (path) {
    const item = (state.allItems || []).find(function (i) { return i.path === path; });
    if (item) openFileCard(item);
  };
  window.pbBankNewLyric = openNewLyric;

  async function saveFileCard() {
    if (!cardCtx) return;
    if (cardCtx.isNew) return saveNewLyric();
    const item = cardCtx.item;
    const btn = document.getElementById('pbCardSave');
    const nameEl = document.getElementById('pbCardName');
    const note = document.getElementById('pbCardNote').value;
    const textWrap = document.getElementById('pbCardTextWrap');
    const textEl = document.getElementById('pbCardText');
    const newName = nameEl.value.trim();
    if (!newName) { toast('Введите название'); nameEl.focus(); return; }
    btn.disabled = true;
    const oldLabel = btn.textContent;
    btn.textContent = 'Сохраняем…';
    try {
      let targetPath = item.path;
      if (newName !== cardCtx.originalName) {
        const safe = newName.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
        const dir = item.path.split('/').slice(0, -1).join('/');
        const to = dir + '/' + safe;
        const r = await callFn({ action: 'move', from: item.path, to: to });
        if (r.error) { toast(r.error.message); return; }
        targetPath = to;
      }
      const sectionsWrapEl = document.getElementById('pbCardSectionsWrap');
      const sectionsOn = !!(sectionsWrapEl && !sectionsWrapEl.hidden);
      const textForSave = currentCardText();
      if ((!textWrap.hidden || sectionsOn) && textForSave !== cardCtx.originalText) {
        const link = await callFn({ action: 'upload-link', path: targetPath });
        if (link.error) { toast('Текст не сохранён: ' + link.error.message); return; }
        const put = await fetch(link.data.href, { method: link.data.method || 'PUT', body: new Blob([textForSave], { type: 'text/plain;charset=utf-8' }) });
        if (!put.ok) { toast('Яндекс не принял текст'); return; }
      }
      const me = window.__CURRENT_PROFILE__ || {};
      const fileName = targetPath.split('/').pop();
      if (window.supabaseClient) {
        await window.supabaseClient.from('bank_files').upsert({
          yandex_path: targetPath,
          name: fileName,
          mime: item.mime || '',
          kind: kindOfFile(fileName, item.mime),
          size: Number(item.size || 0),
          folder: targetPath.split('/').slice(-2, -1)[0] || '',
          uploaded_by: (cardCtx.row && cardCtx.row.uploaded_by) || me.id || null,
          owner_name: (cardCtx.row && cardCtx.row.owner_name) || me.full_name || '',
          note: note,
          icon: cardIcon,
          preview_url: ''
        }, { onConflict: 'yandex_path' });
        if (targetPath !== item.path) {
          try { await window.supabaseClient.from('bank_files').delete().eq('yandex_path', item.path); } catch (e) { }
        }
      }
      state.cache = {};
      state.albumCache = {};
      state.metaMap = {};
      toast('Карточка сохранена');
      closeFileCard();
      await render(true, currentTab());
    } finally {
      btn.disabled = false;
      btn.textContent = oldLabel;
    }
  }

  async function deleteFromCard() {
    if (!cardCtx) return;
    const item = cardCtx.item;
    if (!confirm('Удалить «' + item.name + '» из облака? Файл удалится навсегда.')) return;
    const r = await callFn({ action: 'delete', path: item.path });
    if (r.error) { toast(r.error.message); return; }
    try {
      if (window.supabaseClient) await window.supabaseClient.from('bank_files').delete().eq('yandex_path', item.path);
    } catch (e) { }
    state.cache = {};
    state.albumCache = {};
    state.metaMap = {};
    closeFileCard();
    toast('Файл удалён');
    await render(true, currentTab());
  }

  // ---------- создание папки с иконкой ----------
  let folderDraftIcon = '';
  function ensureFolderModal() {
    if (document.getElementById('pbFolderModal')) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.id = 'pbFolderModal';
    wrap.innerHTML = [
      '<div class="modal" role="dialog" aria-modal="true">',
      '<div class="pb-modal-title">Новая папка в Банке</div>',
      '<p class="pb-modal-sub">Папка создастся в Яндекс.Диске внутри текущего раздела. Иконку можно выбрать из набора.</p>',
      '<div class="form">',
      '<label>Название<input class="field" id="pbFolderName" maxlength="60" placeholder="Например: Групповые"></label>',
      '<div class="pb-icon-field"><span>Иконка папки</span>',
      '<button type="button" class="pb-icon-btn" id="pbFolderIconBtn"><span class="pb-icon-preview" id="pbFolderIconPreview"></span><span class="pb-icon-name" id="pbFolderIconName">Выбрать иконку</span></button>',
      '</div>',
      '</div>',
      '<div class="pb-modal-actions"><button class="btn ghost" type="button" id="pbFolderCancel">Отмена</button><button class="btn red" type="button" id="pbFolderSave">Создать папку</button></div>',
      '</div>'
    ].join('');
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeFolderModal(); });
    document.getElementById('pbFolderCancel').onclick = closeFolderModal;
    document.getElementById('pbFolderIconBtn').onclick = function () {
      if (typeof window.pbPickIconGlobal !== 'function') { toast('Выбор иконок недоступен'); return; }
      window.pbPickIconGlobal('Иконка папки', folderDraftIcon, function (ic) { folderDraftIcon = ic; paintFolderIcon(); });
    };
    document.getElementById('pbFolderSave').onclick = saveFolder;
    document.getElementById('pbFolderName').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); saveFolder(); }
    });
  }
  function paintFolderIcon() {
    const p = document.getElementById('pbFolderIconPreview');
    const n = document.getElementById('pbFolderIconName');
    if (p) p.innerHTML = icon(folderDraftIcon || 'folder');
    if (n) n.textContent = folderDraftIcon || 'Выбрать иконку';
  }
  function openFolderModal() {
    ensureFolderModal();
    folderDraftIcon = '';
    document.getElementById('pbFolderName').value = '';
    paintFolderIcon();
    document.getElementById('pbFolderModal').classList.add('open');
    setTimeout(function () { document.getElementById('pbFolderName').focus(); }, 60);
  }
  function closeFolderModal() {
    const el = document.getElementById('pbFolderModal');
    if (el) el.classList.remove('open');
  }
  async function saveFolder() {
    const nameEl = document.getElementById('pbFolderName');
    const btn = document.getElementById('pbFolderSave');
    const name = nameEl.value.trim();
    if (!name) { toast('Введите название папки'); nameEl.focus(); return; }
    let parent;
    if (state.album) parent = state.album;
    else if (state.folder) parent = ROOT + '/' + state.folder;
    else if (currentTab() !== 'cloud' && FOLDERS[currentTab()]) parent = tabFolder(currentTab());
    else parent = ROOT;
    const rel = (parent.replace(ROOT, '').replace(/^\/+/, '') + '/' + name).replace(/^\/+/, '');
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = 'Создаём…';
    try {
      const r = await callFn({ action: 'mkdir', path: rel });
      if (r.error) { toast('Не удалось создать папку: ' + r.error.message); return; }
      const path = ROOT + '/' + rel;
      const me = window.__CURRENT_PROFILE__ || {};
      if (window.supabaseClient) {
        try {
          await window.supabaseClient.from('bank_folders').upsert({
            yandex_path: path,
            name: name,
            icon: folderDraftIcon,
            created_by: me.id || null,
            owner_name: me.full_name || ''
          }, { onConflict: 'yandex_path' });
        } catch (e) { }
      }
      state.cache = {};
      state.albumCache = {};
      state.page = {};
      toast('Папка создана');
      closeFolderModal();
      await render(true, currentTab());
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  }
  async function createFolder() { openFolderModal(); }

  // ---------- подключение Яндекс.Диска ----------
  function connectCard() {
    if (!state.isOwner) {
      return '<div class="pb-bank-connect"><h3>Облако ещё не подключено</h3>' +
        '<p>Файлы Банка хранятся в Яндекс.Диске группы. Подключить его может владелец — в разделе «Банк» у него будет кнопка подключения.</p></div>';
    }
    return '<div class="pb-bank-connect"><h3>Подключить Яндекс.Диск</h3>' +
      '<p>1. Нажмите «Открыть Яндекс» и разрешите доступ приложению.<br>2. Яндекс покажет код на странице подтверждения.<br>3. Скопируйте код и вставьте сюда.</p>' +
      '<div class="pb-bank-row"><button class="btn red" type="button" onclick="pbBankOpenAuth()">Открыть Яндекс</button></div>' +
      '<div class="pb-bank-row"><input class="field" id="pbBankCode" placeholder="Вставьте код со страницы Яндекса" autocomplete="off"><button class="btn" type="button" id="pbBankConnect" onclick="pbBankConnect()">Подключить Диск</button></div>' +
      '<div class="pb-bank-hint">Токен и секрет приложения в браузер не попадают: они хранятся только на сервере Supabase.</div></div>';
  }

  async function openAuth() {
    const r = await callFn({ action: 'auth-url' });
    if (r.error) { toast(r.error.message); return; }
    window.open(r.data.url, '_blank', 'noopener');
  }
  async function connectWithCode() {
    const input = document.getElementById('pbBankCode');
    if (!input) return;
    const code = input.value.trim();
    if (!code) { toast('Вставьте код со страницы Яндекса'); input.focus(); return; }
    const btn = document.getElementById('pbBankConnect');
    if (btn) { btn.disabled = true; btn.textContent = 'Подключаем…'; }
    const r = await callFn({ action: 'connect', code: code });
    if (btn) { btn.disabled = false; btn.textContent = 'Подключить Диск'; }
    if (r.error) { toast('Не удалось подключить: ' + r.error.message); return; }
    toast('Яндекс.Диск подключён');
    await render(true);
  }
  async function disconnect() {
    if (!confirm('Отключить Яндекс.Диск? Файлы останутся в Диске, но Банк перестанет их показывать.')) return;
    const r = await callFn({ action: 'disconnect' });
    if (r.error) { toast(r.error.message); return; }
    toast('Диск отключён');
    await render(true);
  }

  // ---------- отрисовка ----------
  function toolbar() {
    const tab = currentTab();
    return '<div class="pb-bank-bar">' +
      '<div class="pb-bank-status"><span class="pb-bank-dot on"></span>Облако подключено</div>' +
      '<span class="pb-bank-spacer"></span>' +
      (state.canWrite ? '<button class="btn ghost tiny" type="button" onclick="pbBankFolder()">＋ Папка</button>' +
        '<button class="btn red tiny" type="button" onclick="pbBankPick(\'' + esc(tab) + '\')">Загрузить в «' + esc(TAB_TITLES[tab] || 'облако') + '»</button>' : '') +
      '<button class="btn ghost tiny" type="button" onclick="pbBankReload()">↻ Обновить</button>' +
      (state.isOwner ? '<button class="btn ghost tiny" type="button" onclick="pbBankDisconnect()">Отключить</button>' : '') +
      '</div>';
  }

  function fileCard(item, tab) {
    const kind = kindOfFile(item.name, item.mime);
    const isPhoto = kind === 'photos';
    const thumb = isPhoto
      ? '<div class="pb-bank-thumb"><img src="' + esc(item.preview || '') + '" data-preview="' + esc(item.preview || '') + '" data-thumb="' + esc(item.path) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' + icon(iconForKind(kind), 'pb-icon-lg') + '</div>'
      : '<div class="pb-bank-thumb">' + icon(iconForKind(kind), 'pb-icon-lg') + '</div>';
    const meta = state.metaMap && state.metaMap[item.path];
    const author = meta && meta.owner_name ? '<span>· ' + esc(meta.owner_name) + '</span>' : '';
    return '<div class="pb-bank-card">' + thumb +
      '<div class="pb-bank-body"><div class="pb-bank-name">' + esc(item.name) + '</div>' +
      '<div class="pb-bank-sub"><span>' + fmtSize(item.size) + '</span>' + author + '</div>' +
      '<div class="pb-bank-actions"><button class="btn tiny" type="button" data-bank-card="' + esc(item.path) + '">Карточка</button>' +
      '<button class="btn tiny ghost" type="button" data-bank-open="' + esc(item.path) + '">Открыть</button></div></div></div>';
  }

  async function loadMeta(items) {
    try {
      const paths = items.map(function (i) { return i.path; });
      if (!paths.length || !window.supabaseClient) { state.metaMap = {}; return; }
      const { data } = await window.supabaseClient.from('bank_files').select('yandex_path, owner_name').in('yandex_path', paths);
      const map = {};
      (data || []).forEach(function (r) { map[r.yandex_path] = r; });
      state.metaMap = map;
    } catch (e) { state.metaMap = {}; }
  }

  function gridHTML(items, emptyText) {
    if (!items.length) {
      return '<div class="pb-bank-empty">' + icon('folder-open', 'pb-icon-lg') +
        '<div><b>Пока пусто</b><div class="pb-bank-hint">' + esc(emptyText) + '</div></div></div>';
    }
    return '<div class="pb-bank-grid">' + items.map(function (it) { return fileCard(it); }).join('') + '</div>';
  }

  // Если файлов нет, но есть альбомы — не показываем «Пока пусто».
  function filesArea(items, dirs, emptyText) {
    if (items.length) return gridHTML(items, emptyText);
    if (dirs && dirs.length) {
      return '<div class="pb-bank-hint" style="padding:6px 2px">Файлы лежат внутри альбомов — откройте нужную папку.</div>';
    }
    return gridHTML([], emptyText);
  }

  function albumCard(info) {
    const iconName = folderIconOf(info.dir.path);
    const inner = info.coverPath
      ? '<img src="' + esc(info.cover || '') + '" data-preview="' + esc(info.cover || '') + '" data-thumb="' + esc(info.coverPath) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
      : icon(iconName || 'images', 'pb-icon-lg');
    const badge = iconName ? '<span class="pb-album-badge">' + icon(iconName, 'pb-icon-sm') + '</span>' : '';
    const me = window.__CURRENT_PROFILE__ || {};
    const folderRow = state.folderMeta && state.folderMeta[info.dir.path];
    const canDeleteFolder = state.isOwner || (folderRow && folderRow.created_by && me.id && folderRow.created_by === me.id);
    const del = canDeleteFolder
      ? '<button class="btn tiny ghost" type="button" data-bank-rmdir="' + esc(info.dir.path) + '">Удалить</button>'
      : '';
    return '<div class="pb-bank-card">' +
      '<div class="pb-bank-thumb">' + badge + inner + '</div>' +
      '<div class="pb-bank-body"><div class="pb-bank-name">' + esc(info.dir.name) + '</div>' +
      '<div class="pb-bank-sub"><span>' + info.count + ' фото</span><span>· альбом</span></div>' +
      '<div class="pb-bank-actions"><button class="btn tiny" type="button" data-bank-album="' + esc(info.dir.path) + '">Открыть альбом</button>' + del + '</div></div></div>';
  }

  async function albumsHTML(dirs) {
    if (!dirs || !dirs.length) return '';
    await loadFolderMeta(dirs);
    await listFolderMany(dirs.map(function (d) { return d.path; }));
    const infos = dirs.map(function (d) { return albumInfoFromCache(d); });
    return '<div class="pb-bank-grid">' + infos.map(albumCard).join('') + '</div>';
  }

  function backBar(title, countText) {
    return '<div class="pb-bank-cloud-head">' +
      '<button class="btn ghost tiny" type="button" onclick="pbBankAlbumBack()">← Назад</button>' +
      '<h2 style="margin:0;font-size:17px">' + esc(title) + '</h2>' +
      '<span class="pb-bank-hint">' + esc(countText) + '</span>' +
      (state.canWrite ? '<button class="btn ghost tiny" type="button" onclick="pbBankPick()">＋ Загрузить в альбом</button>' : '') +
      '</div>';
  }

  // ---------- тексты песен → облако (.txt) ----------
  function lyricText(item) {
    if (item && Array.isArray(item.sections) && item.sections.length) {
      return item.sections.map(function (s) { return '[' + (s.type || 'Часть') + ']\n' + (s.text || ''); }).join('\n\n');
    }
    return (item && item.text) || '';
  }
  function textHash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return String(h);
  }
  function localLyrics() {
    try {
      if (typeof bank !== 'undefined' && Array.isArray(bank)) return bank.filter(function (x) { return x && x.type === 'lyrics'; });
    } catch (e) { }
    return [];
  }
  async function exportLyrics(force) {
    if (!state.connected || !state.canWrite) return 0;
    const items = localLyrics();
    if (!items.length) return 0;
    let exported = {};
    try { exported = JSON.parse(localStorage.getItem('pb24_lyrics_exported') || '{}') || {}; } catch (e) { exported = {}; }
    const me = window.__CURRENT_PROFILE__ || {};
    let count = 0;
    for (const item of items) {
      const title = String(item.title || '').trim();
      if (!title) continue;
      const body = lyricText(item).trim();
      if (!body) continue;
      const hash = textHash(body);
      if (!force && exported[title] === hash) continue;
      try {
        const safe = title.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 100) + '.txt';
        const path = ROOT + '/01_Тексты/' + safe;
        const link = await callFn({ action: 'upload-link', path: path });
        if (link.error) continue;
        const put = await fetch(link.data.href, { method: link.data.method || 'PUT', body: new Blob([body], { type: 'text/plain;charset=utf-8' }) });
        if (!put.ok) continue;
        const st = await callFn({ action: 'stat', path: path });
        const it = (st.data && st.data.item) || {};
        if (window.supabaseClient) {
          await window.supabaseClient.from('bank_files').upsert({
            yandex_path: path,
            name: safe,
            mime: 'text/plain',
            kind: 'docs',
            size: Number(it.size || body.length || 0),
            folder: '01_Тексты',
            uploaded_by: me.id || null,
            owner_name: me.full_name || '',
            preview_url: ''
          }, { onConflict: 'yandex_path' });
        }
        exported[title] = hash;
        count++;
      } catch (e) { console.warn('[bank] lyric export', e); }
    }
    if (count) {
      try { localStorage.setItem('pb24_lyrics_exported', JSON.stringify(exported)); } catch (e) { }
      state.cache = {};
    }
    return count;
  }

  // Сохранение карточки текста автоматически выгружает .txt в облако.
  function hookPersist() {
    const cur = window.persist;
    if (!cur || cur.__pbBankWrapped) return;
    const wrapped = function () {
      const res = cur.apply(this, arguments);
      if (state.connected && state.canWrite) setTimeout(function () { exportLyrics(false); }, 700);
      return res;
    };
    wrapped.__pbBankWrapped = true;
    window.persist = wrapped;
  }

  // ---------- вкладка «Облако» ----------
  async function renderCloudTab(tab) {
    const box = document.getElementById('bankContent');
    if (!box) return;
    const folders = (state.folders || []).slice();
    const chips = '<div class="pb-bank-folders">' +
      '<button type="button" class="pb-bank-folder' + (!state.folder ? ' active' : '') + '" data-bank-folder="">' + icon('folder') + ' Все файлы</button>' +
      folders.map(function (n) {
        return '<button type="button" class="pb-bank-folder' + (state.folder === n ? ' active' : '') + '" data-bank-folder="' + esc(n) + '">' + icon('folder') + ' ' + esc(n) + '</button>';
      }).join('') + '</div>';

    let html = '';
    if (state.album) {
      const key = 'album:' + state.album;
      const res = await listFolder(state.album);
      state.allItems = res.files;
      await loadMeta(res.files);
      html = backBar(state.albumName || 'Альбом', res.files.length + ' файлов') +
        gridHTML(pagedItems(res.files, key), 'В этом альбоме пока нет файлов.') +
        moreButton(res.files, key) +
        '<div class="pb-bank-drop" id="pbBankDrop">Перетащите файлы сюда — они загрузятся в альбом</div>' +
        '<input type="file" id="pbBankInput" multiple hidden>';
    } else if (state.folder) {
      const key = 'folder:' + state.folder;
      const res = await listFolder(ROOT + '/' + state.folder);
      state.allItems = res.files;
      await loadMeta(res.files);
      const albumsHtml = res.dirs.length ? '<div class="pb-bank-cloud-head"><h2 style="margin:0;font-size:16px">Альбомы (подпапки)</h2><span class="pb-bank-hint">Обложка — первое фото из папки</span></div>' + await albumsHTML(res.dirs) : '';
      html = albumsHtml + filesArea(pagedItems(res.files, key), res.dirs, 'В папке «' + state.folder + '» пока нет файлов.') + moreButton(res.files, key) +
        '<div class="pb-bank-drop" id="pbBankDrop">Перетащите файлы сюда — они загрузятся в «' + esc(state.folder) + '»</div>' +
        '<input type="file" id="pbBankInput" multiple hidden>';
    } else {
      const key = 'all';
      const rootRes = await listFolder(ROOT);
      let items = rootRes.files.slice();
      let albums = [];
      const stdPaths = [];
      for (const n of Object.keys(FOLDERS).map(function (k) { return FOLDERS[k]; })) {
        if (folders.indexOf(n) === -1) continue;
        stdPaths.push(ROOT + '/' + n);
      }
      await listFolderMany(stdPaths);
      for (const p of stdPaths) {
        const sub = await listFolder(p);
        for (const d of sub.dirs) albums.push(d);
        for (const it of sub.files) { it.folderName = p.split('/').pop(); items.push(it); }
      }
      await loadMeta(items);
      state.allItems = items;
      html = (albums.length ? '<div class="pb-bank-cloud-head"><h2 style="margin:0;font-size:16px">Альбомы</h2><span class="pb-bank-hint">' + albums.length + ' шт.</span></div>' + await albumsHTML(albums) : '') +
        gridHTML(pagedItems(items, key), 'Файлов пока нет. Нажмите «Загрузить», чтобы положить их в облако.') + moreButton(items, key) +
        '<div class="pb-bank-drop" id="pbBankDrop">Перетащите файлы сюда — они загрузятся в корень Банка</div>' +
        '<input type="file" id="pbBankInput" multiple hidden>';
    }
    box.innerHTML = '<div class="pb-bank-cloud" data-bank-mode="cloud">' + chips + html + '</div>';
    wire(box, tab || 'cloud');
    hydrateThumbs(box);
    syncLegacy(tab || 'cloud');
    if (!state.folders.length) {
      await ensureFolders();
      state.cache = {};
      await renderCloudTab(tab);
    }
  }

  // ---------- обычные вкладки: карточки сверху, облако снизу ----------
  async function decorateTab(tab) {
    const box = document.getElementById('bankContent');
    if (!box || tab === 'cloud') return;
    const folder = FOLDERS[tab];
    if (!folder) return;
    if (!state.folders.length) await ensureFolders();
    let section = document.getElementById('pbBankCloudSection');
    if (!section) {
      section = document.createElement('div');
      section.id = 'pbBankCloudSection';
      section.className = 'pb-bank-cloud';
      box.appendChild(section);
    }

    if (state.album) {
      const key = 'album:' + state.album;
      const res = await listFolder(state.album);
      state.allItems = res.files;
      await loadMeta(res.files);
      section.innerHTML = backBar(state.albumName || 'Альбом', res.files.length + ' файлов') +
        gridHTML(pagedItems(res.files, key), 'В этом альбоме пока нет файлов.') +
        moreButton(res.files, key) +
        '<div class="pb-bank-drop" id="pbBankDrop">Перетащите файлы сюда — они загрузятся в альбом</div>' +
        '<input type="file" id="pbBankInput" multiple hidden>';
      wire(box, tab);
      hydrateThumbs(box);
      syncLegacy(tab);
      return;
    }

    const path = tabFolder(tab);
    const key = 'folder:' + folder;
    const res = await listFolder(path);
    state.allItems = res.files;
    await loadMeta(res.files);

    let extra = '';
    if (tab === 'lyrics') {
      const pending = localLyrics().length;
      extra = '<button class="btn red tiny" type="button" onclick="pbBankNewLyric()">＋ Новая песня</button>' +
        '<button class="btn ghost tiny" type="button" onclick="pbBankExportLyrics()">↥ Старые тексты в облако' + (pending ? ' (' + pending + ')' : '') + '</button>';
    }
    const albumsHtml = res.dirs.length
      ? '<div class="pb-bank-cloud-head"><h2 style="margin:0;font-size:16px">Альбомы (подпапки)</h2><span class="pb-bank-hint">Обложка — первое фото из папки</span></div>' + await albumsHTML(res.dirs)
      : '';

    section.innerHTML = '<div class="pb-bank-cloud-head"><h2>Файлы в облаке</h2>' +
      '<span class="pb-bank-hint">Папка «' + esc(folder) + '» в Яндекс.Диске</span>' +
      extra +
      (state.canWrite ? '<button class="btn ghost tiny" type="button" onclick="pbBankPick(\'' + esc(tab) + '\')">＋ Загрузить</button>' : '') +
      '</div>' + albumsHtml +
      filesArea(pagedItems(res.files, key), res.dirs, 'В папке «' + folder + '» пока нет файлов.') +
      moreButton(res.files, key) +
      '<div class="pb-bank-drop" id="pbBankDrop">Перетащите файлы сюда — они загрузятся в «' + esc(folder) + '»</div>' +
      '<input type="file" id="pbBankInput" multiple hidden>';
    wire(box, tab);
    hydrateThumbs(box);
    syncLegacy(tab);

    if (tab === 'lyrics') {
      exportLyrics(false).then(function (n) { if (n) render(false, 'lyrics'); });
    }
  }

  function wire(box, tab) {
    const input = document.getElementById('pbBankInput');
    if (input) { input.dataset.tab = tab || currentTab(); input.dataset.album = state.album || ''; }
    const drop = document.getElementById('pbBankDrop');
    if (drop) {
      ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
      drop.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files) uploadFiles(e.dataTransfer.files, tab || currentTab(), state.album || null);
      });
    }
    box.querySelectorAll('[data-bank-folder]').forEach(function (b) {
      b.onclick = function () {
        state.folder = b.getAttribute('data-bank-folder');
        state.album = null; state.albumName = '';
        state.cache = {}; state.albumCache = {};
        render(true, 'cloud');
      };
    });
    box.querySelectorAll('[data-bank-album]').forEach(function (b) {
      b.onclick = function () {
        state.album = b.getAttribute('data-bank-album');
        state.albumName = state.album.split('/').pop();
        render(true, currentTab());
      };
    });
    box.querySelectorAll('[data-bank-card]').forEach(function (b) {
      b.onclick = function () { window.pbBankFileCard(b.getAttribute('data-bank-card')); };
    });
    box.querySelectorAll('[data-bank-open]').forEach(function (b) {
      b.onclick = function () {
        const path = b.getAttribute('data-bank-open');
        const item = (state.allItems || []).find(function (i) { return i.path === path; });
        if (item) openFile(item);
        else callFn({ action: 'download-link', path: path }).then(function (r) {
          if (r.error) toast(r.error.message); else window.open(r.data.href, '_blank', 'noopener');
        });
      };
    });
    box.querySelectorAll('[data-bank-more]').forEach(function (b) {
      b.onclick = function () {
        const key = b.getAttribute('data-bank-more');
        state.page[key] = (state.page[key] || 24) + 24;
        render(false, currentTab());
      };
    });
    box.querySelectorAll('[data-bank-rmdir]').forEach(function (b) {
      b.onclick = async function () {
        const path = b.getAttribute('data-bank-rmdir');
        const name = path.split('/').pop();
        if (!confirm('Удалить папку «' + name + '» со всеми файлами? Это необратимо.')) return;
        const r = await callFn({ action: 'delete', path: path });
        if (r.error) { toast(r.error.message); return; }
        try {
          if (window.supabaseClient) await window.supabaseClient.from('bank_folders').delete().eq('yandex_path', path);
        } catch (e) { }
        state.cache = {};
        state.albumCache = {};
        state.page = {};
        toast('Папка удалена');
        render(true, currentTab());
      };
    });
    box.querySelectorAll('[data-bank-del]').forEach(function (b) {
      b.onclick = function () {
        const path = b.getAttribute('data-bank-del');
        const item = (state.allItems || []).find(function (i) { return i.path === path; });
        if (item) deleteFile(item);
      };
    });
  }

  // Рендеры идут строго по очереди и без дублей: старая отрисовка не перекроет новую.
  let renderChain = Promise.resolve();
  function render(force, tabOverride) {
    const tab = tabOverride || currentTab();
    const now = Date.now();
    if (!force && state.reqTab === tab && now - (state.reqAt || 0) < 1500) return renderChain;
    if (!force && state.busyTab === tab) return renderChain;
    state.reqTab = tab;
    state.reqAt = now;
    state.busyTab = tab;
    const next = renderChain.then(function () { return renderInner(force, tab); }).catch(function (e) { console.warn('[bank] render', e); }).then(function () {
      if (state.busyTab === tab) state.busyTab = '';
    });
    renderChain = next;
    return next;
  }

  // прогреваем папки в фоне, чтобы вкладки открывались мгновенно
  function warmUp() {
    if (state.warmed) return;
    state.warmed = true;
    setTimeout(function () {
      const paths = [ROOT].concat(Object.keys(FOLDERS).map(function (k) { return ROOT + '/' + FOLDERS[k]; }));
      listFolderMany(paths).then(function () {
        // второй проход: обложки альбомов (подпапки стандартных разделов)
        const dirs = [];
        paths.forEach(function (p) {
          const entry = state.cache[p];
          if (entry && entry.dirs) entry.dirs.forEach(function (d) { dirs.push(d.path); });
        });
        if (dirs.length) return listFolderMany(dirs);
      }).catch(function () { });
    }, 700);
  }

  async function renderInner(force, tabOverride) {
    const host = ensureRoot();
    if (!host) return;
    if (force) state.cache = {};
    const tab = tabOverride || currentTab();
    state.tab = tab;
    if (!state.connected) {
      await loadStatus();
    }
    if (!state.connected) {
      host.innerHTML = (state.notice ? '<div class="pb-bank-notice">' + esc(state.notice) + '</div>' : '') + connectCard();
      return;
    }
    if (!state.folders.length || force) await ensureFolders();
    hookPersist();
    host.innerHTML = (state.notice ? '<div class="pb-bank-notice">' + esc(state.notice) + '</div>' : '') + toolbar();
    if (tab === 'cloud') await renderCloudTab(tab);
    else await decorateTab(tab);
    warmUp();
  }

  // ---------- публичные обработчики ----------
  window.pbBankOpenAuth = openAuth;
  window.pbBankConnect = connectWithCode;
  window.pbBankDisconnect = disconnect;
  window.pbBankFolder = createFolder;
  window.pbBankReload = function () { state.cache = {}; state.albumCache = {}; render(true); };
  window.__pbBankDebug = state;
  window.pbBankPick = function (tab) {
    const i = document.getElementById('pbBankInput');
    if (i) { i.dataset.tab = tab || currentTab(); i.dataset.album = state.album || ''; i.click(); }
  };
  window.pbBankAlbumBack = function () {
    state.album = null; state.albumName = '';
    render(true, currentTab());
  };
  window.pbBankExportLyrics = async function () {
    const n = await exportLyrics(true);
    toast(n ? 'Выгружено текстов: ' + n : 'Все тексты уже в облаке');
    if (n) render(true, 'lyrics');
  };

  // перехват выбора файлов: tab и альбом берём из data-атрибутов
  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'pbBankInput') {
      const tab = e.target.dataset.tab || currentTab();
      const album = e.target.dataset.album || null;
      if (e.target.files && e.target.files.length) { uploadFiles(e.target.files, tab, album); e.target.value = ''; }
    }
  }, true);

  // ---------- встраивание ----------
  let lastTab = null;
  let rendering = false;
  function onBankChanged() {
    const bank = document.getElementById('bank');
    if (!bank || !bank.classList.contains('active')) return;
    if (rendering) return;
    const tab = currentTab();
    const needRender = !state.started ||
      tab !== lastTab ||
      (tab === 'cloud' ? !document.querySelector('#bankContent [data-bank-mode="cloud"]') : !document.getElementById('pbBankCloudSection'));
    if (!needRender) return;
    state.started = true;
    lastTab = tab;
    rendering = true;
    render(false, tab).finally(function () { rendering = false; });
  }

  const prevRenderAll = window.renderAll;
  window.renderAll = function () {
    if (typeof prevRenderAll === 'function') prevRenderAll.apply(this, arguments);
    try { onBankChanged(); } catch (e) { console.warn('[bank]', e); }
  };

  // Старая отрисовка Банка иногда перезаписывает #bankContent целиком.
  // Следим за этим и возвращаем наш блок на место.
  function watchBankContent() {
    const bc = document.getElementById('bankContent');
    if (!bc || bc.dataset.pbWatched === '1') return;
    bc.dataset.pbWatched = '1';
    const obs = new MutationObserver(function () {
      const bank = document.getElementById('bank');
      if (!bank || !bank.classList.contains('active')) return;
      const tab = currentTab();
      const missing = tab === 'cloud'
        ? !document.querySelector('#bankContent [data-bank-mode="cloud"]')
        : !document.getElementById('pbBankCloudSection');
      if (missing) setTimeout(function () { render(false, tab); }, 90);
    });
    obs.observe(bc, { childList: true });
  }

  document.addEventListener('click', function (e) {
    const nav = e.target.closest('[data-page="bank"]');
    const tabBtn = e.target.closest('[data-bank]');
    if (nav) { state.started = false; setTimeout(function () { onBankChanged(); }, 60); }
    else if (tabBtn) {
      const tab = tabBtn.getAttribute('data-bank');
      state.album = null; state.albumName = '';
      lastTab = tab;
      setTimeout(function () { rendering = false; render(false, tab); }, 120);
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { watchBankContent(); onBankChanged(); });
  else { watchBankContent(); onBankChanged(); }

  // Тихо прогреваем папки Банка в фоне после входа — вкладки открываются мгновенно.
  setTimeout(function () {
    (async function () {
      try {
        if (!state.connected) await loadStatus();
        if (state.connected) warmUp();
      } catch (e) { }
    })();
  }, 2500);
})();
