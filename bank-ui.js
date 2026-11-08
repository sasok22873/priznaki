/* =========================================================================
   Банк на Яндекс.Диске — интерфейс.
   Файлы лежат в Диске. Токен и секрет приложения в браузер не попадают:
   все операции идут через Edge Function yandex-disk, браузер получает только
   временные ссылки на загрузку/скачивание.
   ========================================================================= */
(function () {
  const FN = 'yandex-disk';
  const ROOT = 'disk:/ПБ24';
  const KINDS = [
    { id: 'photos', title: 'Фото' },
    { id: 'audio', title: 'Аудио' },
    { id: 'docs', title: 'Документы' },
    { id: 'video', title: 'Видео' }
  ];

  const state = {
    ready: false,
    connected: false,
    isOwner: false,
    canWrite: false,
    path: ROOT,
    folders: [],
    items: [],
    meta: {},
    kind: '',
    query: '',
    busy: false,
    notice: ''
  };

  const css = document.createElement('style');
  css.id = 'pbBankStyle';
  css.textContent = [
    '#bank > .tabs, #bank > .bank-actions, #bank > #bankContent{display:none}',
    '#bankApp{display:grid;gap:18px}',
    '.pb-bank-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px}',
    '.pb-bank-bar .pb-bank-spacer{flex:1 1 auto}',
    '.pb-bank-status{display:flex;align-items:center;gap:8px;font-size:13px;color:#a8a3b3}',
    '.pb-bank-dot{width:8px;height:8px;border-radius:50%;background:#f59e0b}',
    '.pb-bank-dot.on{background:#34d399}',
    '.pb-bank-folders{display:flex;flex-wrap:wrap;gap:8px}',
    '.pb-bank-folder{display:flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:rgba(255,255,255,.03);color:#d9d4e4;font-size:13px;cursor:pointer;transition:background .15s,border-color .15s,color .15s}',
    '.pb-bank-folder:hover{border-color:rgba(167,139,250,.4);background:rgba(167,139,250,.08)}',
    '.pb-bank-folder.active{border-color:rgba(167,139,250,.65);background:rgba(167,139,250,.16);color:#f1ecff}',
    '.pb-bank-folder .pb-icon{width:16px;height:16px;color:#c4b5fd}',
    '.pb-bank-tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
    '.pb-bank-search{flex:1 1 220px;min-width:180px}',
    '.pb-bank-chips{display:flex;gap:6px;flex-wrap:wrap}',
    '.pb-bank-chip{padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:transparent;color:#a8a3b3;font-size:12.5px;cursor:pointer}',
    '.pb-bank-chip.active{background:rgba(167,139,250,.16);border-color:rgba(167,139,250,.5);color:#efe9ff}',
    '.pb-bank-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}',
    '.pb-bank-card{border:1px solid rgba(255,255,255,.07);border-radius:16px;background:#15151a;overflow:hidden;display:flex;flex-direction:column;transition:border-color .16s,transform .16s,box-shadow .16s}',
    '.pb-bank-card:hover{border-color:rgba(167,139,250,.35);transform:translateY(-2px);box-shadow:0 14px 34px #0007}',
    '.pb-bank-thumb{height:132px;display:grid;place-items:center;background:#101014;color:#8f8a9c;overflow:hidden}',
    '.pb-bank-thumb img{width:100%;height:100%;object-fit:cover;display:block}',
    '.pb-bank-thumb .pb-icon{width:34px;height:34px;color:#a78bfa}',
    '.pb-bank-body{padding:11px 13px 13px;display:grid;gap:6px;flex:1}',
    '.pb-bank-name{font-size:14px;font-weight:600;color:#eee9f7;line-height:1.35;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.pb-bank-sub{font-size:12px;color:#8f8a9c;display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
    '.pb-bank-actions{display:flex;gap:6px;margin-top:2px}',
    '.pb-bank-empty{border:1px dashed rgba(255,255,255,.12);border-radius:16px;padding:34px 22px;text-align:center;color:#a8a3b3;display:grid;gap:10px;justify-items:center}',
    '.pb-bank-empty .pb-icon{width:30px;height:30px;color:#a78bfa}',
    '.pb-bank-connect{border:1px solid rgba(167,139,250,.25);background:linear-gradient(180deg,rgba(167,139,250,.09),rgba(167,139,250,.02));border-radius:18px;padding:22px;display:grid;gap:14px}',
    '.pb-bank-connect h3{margin:0;font-size:17px;letter-spacing:-.01em}',
    '.pb-bank-connect p{margin:0;font-size:13.5px;color:#a8a3b3;line-height:1.55}',
    '.pb-bank-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
    '.pb-bank-code{flex:1 1 240px;font-family:ui-monospace,Consolas,monospace;letter-spacing:.02em}',
    '.pb-bank-hint{font-size:12px;color:#8f8a9c;line-height:1.5}',
    '.pb-bank-notice{border-radius:12px;padding:10px 13px;font-size:13px;border:1px solid rgba(248,113,113,.35);background:rgba(248,113,113,.08);color:#ffc9c9}',
    '.pb-bank-drop{border:1px dashed rgba(167,139,250,.3);border-radius:16px;padding:14px;text-align:center;font-size:13px;color:#a8a3b3}',
    '.pb-bank-drop.over{border-color:rgba(167,139,250,.8);background:rgba(167,139,250,.08);color:#efe9ff}',
    '@media (max-width:700px){.pb-bank-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.pb-bank-thumb{height:112px}}'
  ].join('');
  document.head.appendChild(css);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function icon(name, cls) {
    return (typeof window.pbIcon === 'function') ? window.pbIcon(name, cls) : '';
  }
  function fmtSize(bytes) {
    const n = Number(bytes || 0);
    if (!n) return '';
    if (n < 1024) return n + ' Б';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' КБ';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' МБ';
    return (n / 1024 / 1024 / 1024).toFixed(2) + ' ГБ';
  }
  function kindOf(name, mime) {
    const m = String(mime || '').toLowerCase();
    const n = String(name || '').toLowerCase();
    if (m.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|bmp|svg|tiff?)$/.test(n)) return 'photos';
    if (m.startsWith('audio/') || /\.(mp3|wav|flac|m4a|aac|ogg|opus)$/.test(n)) return 'audio';
    if (m.startsWith('video/') || /\.(mp4|mov|mkv|avi|webm)$/.test(n)) return 'video';
    return 'docs';
  }
  function iconFor(kind) {
    return ({ photos: 'image', audio: 'audio-lines', docs: 'file-text', video: 'video' })[kind] || 'file';
  }
  function fmtDate(v) {
    if (!v) return '';
    try {
      return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(v));
    } catch (e) { return ''; }
  }

  async function callFn(body) {
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

  function rootEl() {
    return document.getElementById('bankApp');
  }

  function ensureRoot() {
    const bank = document.getElementById('bank');
    if (!bank) return null;
    let host = document.getElementById('bankApp');
    if (!host) {
      host = document.createElement('div');
      host.id = 'bankApp';
      bank.appendChild(host);
    }
    return host;
  }

  function folderName(path) {
    if (!path || path === ROOT) return '';
    const parts = path.split('/');
    return parts[parts.length - 1] || '';
  }

  // ---------- загрузка данных ----------
  async function refresh(force) {
    const host = ensureRoot();
    if (!host) return;
    if (state.busy && !force) return;
    state.busy = true;
    render();
    const st = await callFn({ action: 'status' });
    if (st.error) {
      state.notice = st.error.message;
      state.connected = false;
      state.busy = false;
      render();
      return;
    }
    state.connected = !!st.data.connected;
    state.isOwner = !!st.data.is_owner;
    state.canWrite = !!st.data.can_write;
    state.notice = '';
    if (!state.connected) {
      state.busy = false;
      render();
      return;
    }
    const foldersRes = await callFn({ action: 'folders' });
    state.folders = (foldersRes.data && foldersRes.data.folders) ? foldersRes.data.folders : [];
    const listRes = await callFn({ action: 'list', path: state.path });
    if (listRes.error) {
      state.notice = listRes.error.message;
      state.items = [];
    } else {
      state.items = (listRes.data.items || []).filter(function (it) { return it.type === 'file'; });
      if (listRes.data.missing && state.path !== ROOT) state.path = ROOT;
    }
    // подтягиваем автора загрузки из базы
    try {
      const paths = state.items.map(function (i) { return i.path; });
      if (paths.length && window.supabaseClient) {
        const { data } = await window.supabaseClient.from('bank_files').select('yandex_path, owner_name, kind').in('yandex_path', paths);
        const map = {};
        (data || []).forEach(function (r) { map[r.yandex_path] = r; });
        state.meta = map;
      }
    } catch (e) { }
    state.busy = false;
    render();
  }

  // ---------- подключение ----------
  async function openAuth() {
    const r = await callFn({ action: 'auth-url' });
    if (r.error) { toast(r.error.message); return; }
    if (!r.data.url) { toast('Яндекс не выдал ссылку авторизации'); return; }
    window.open(r.data.url, '_blank', 'noopener');
    state.notice = '';
    render();
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
    await refresh(true);
  }

  async function disconnect() {
    if (!confirm('Отключить Яндекс.Диск? Файлы останутся в Диске, но Банк перестанет их показывать.')) return;
    const r = await callFn({ action: 'disconnect' });
    if (r.error) { toast(r.error.message); return; }
    toast('Диск отключён');
    await refresh(true);
  }

  // ---------- файлы ----------
  async function uploadFiles(files) {
    if (!files || !files.length) return;
    if (!state.canWrite) { toast('Загружать файлы может владелец или участник'); return; }
    let ok = 0;
    for (const file of Array.from(files)) {
      try {
        const safe = String(file.name).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
        const path = state.path.replace(/\/+$/, '') + '/' + safe;
        const link = await callFn({ action: 'upload-link', path: path });
        if (link.error) { toast('«' + file.name + '»: ' + link.error.message); continue; }
        const put = await fetch(link.data.href, { method: (link.data.method || 'PUT'), body: file });
        if (!put.ok) { toast('«' + file.name + '»: Яндекс не принял файл'); continue; }
        const st = await callFn({ action: 'stat', path: path });
        const item = (st.data && st.data.item) ? st.data.item : {};
        const kind = kindOf(safe, item.mime || file.type);
        const me = window.__CURRENT_PROFILE__ || {};
        if (window.supabaseClient) {
          await window.supabaseClient.from('bank_files').upsert({
            yandex_path: path,
            name: safe,
            mime: item.mime || file.type || '',
            kind: kind,
            size: Number(item.size || file.size || 0),
            folder: folderName(state.path),
            uploaded_by: me.id || null,
            owner_name: me.full_name || '',
            preview_url: item.preview || ''
          }, { onConflict: 'yandex_path' });
        }
        ok++;
      } catch (e) {
        toast('«' + file.name + '»: ' + ((e && e.message) || e));
      }
    }
    if (ok) { toast(ok === 1 ? 'Файл загружен' : 'Загружено файлов: ' + ok); await refresh(true); }
  }

  async function openItem(item) {
    const r = await callFn({ action: 'download-link', path: item.path });
    if (r.error) { toast(r.error.message); return; }
    window.open(r.data.href, '_blank', 'noopener');
  }

  async function removeItem(item) {
    if (!confirm('Удалить «' + item.name + '» из Диска? Файл удалится навсегда.')) return;
    const r = await callFn({ action: 'delete', path: item.path });
    if (r.error) { toast(r.error.message); return; }
    toast('Удалено');
    await refresh(true);
  }

  async function createFolder() {
    const name = (prompt('Название папки в Банке') || '').trim();
    if (!name) return;
    const r = await callFn({ action: 'mkdir', name: name });
    if (r.error) { toast(r.error.message); return; }
    toast('Папка создана');
    await refresh(true);
  }

  // ---------- отрисовка ----------
  function filteredItems() {
    const q = state.query.trim().toLowerCase();
    return state.items.filter(function (it) {
      if (state.kind && kindOf(it.name, it.mime) !== state.kind) return false;
      if (q && String(it.name).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  function renderConnectCard() {
    if (!state.isOwner) {
      return '<div class="pb-bank-connect"><h3>Диск ещё не подключён</h3>' +
        '<p>Банк хранит файлы в Яндекс.Диске группы. Подключить его может владелец — в разделе «Банк» у него будет кнопка подключения.</p></div>';
    }
    return '<div class="pb-bank-connect">' +
      '<h3>Подключить Яндекс.Диск</h3>' +
      '<p>1. Нажмите «Открыть Яндекс» и разрешите доступ приложению.<br>2. Яндекc покажет код на странице подтверждения.<br>3. Скопируйте код и вставьте сюда.</p>' +
      '<div class="pb-bank-row"><button class="btn red" type="button" onclick="pbBankOpenAuth()">Открыть Яндекс</button></div>' +
      '<div class="pb-bank-row"><input class="field pb-bank-code" id="pbBankCode" placeholder="Вставьте код со страницы Яндекса" autocomplete="off"><button class="btn" type="button" id="pbBankConnect" onclick="pbBankConnect()">Подключить Диск</button></div>' +
      '<div class="pb-bank-hint">Токен и секрет приложения в браузер не попадают: они хранятся только на сервере Supabase.</div>' +
      '</div>';
  }

  function renderCard(item) {
    const kind = kindOf(item.name, item.mime);
    const meta = state.meta[item.path] || {};
    const isPhoto = kind === 'photos' && item.preview;
    const thumb = isPhoto
      ? '<div class="pb-bank-thumb"><img src="' + esc(item.preview) + '" alt="" loading="lazy"></div>'
      : '<div class="pb-bank-thumb">' + icon(iconFor(kind), 'pb-icon-lg') + '</div>';
    const author = meta.owner_name ? ('<span>· ' + esc(meta.owner_name) + '</span>') : '';
    const del = state.canWrite ? '<button class="btn tiny ghost" type="button" data-bank-del="' + esc(item.path) + '">Удалить</button>' : '';
    return '<div class="pb-bank-card" data-bank-path="' + esc(item.path) + '">' + thumb +
      '<div class="pb-bank-body"><div class="pb-bank-name">' + esc(item.name) + '</div>' +
      '<div class="pb-bank-sub"><span>' + fmtSize(item.size) + '</span>' + author + '<span>' + fmtDate(item.created) + '</span></div>' +
      '<div class="pb-bank-actions"><button class="btn tiny" type="button" data-bank-open="' + esc(item.path) + '">Открыть</button>' + del + '</div></div></div>';
  }

  function render() {
    const host = ensureRoot();
    if (!host) return;
    if (!state.connected) {
      host.innerHTML = (state.notice ? '<div class="pb-bank-notice">' + esc(state.notice) + '</div>' : '') + renderConnectCard();
      return;
    }
    const items = filteredItems();
    const folderBar = '<div class="pb-bank-folders">' +
      '<button type="button" class="pb-bank-folder' + (state.path === ROOT ? ' active' : '') + '" data-bank-folder="' + esc(ROOT) + '">' + icon('folder') + ' Все файлы</button>' +
      state.folders.map(function (f) {
        return '<button type="button" class="pb-bank-folder' + (f.path === state.path ? ' active' : '') + '" data-bank-folder="' + esc(f.path) + '">' + icon('folder') + ' ' + esc(f.name) + '</button>';
      }).join('') + '</div>';

    const chips = '<div class="pb-bank-chips">' +
      '<button type="button" class="pb-bank-chip' + (state.kind === '' ? ' active' : '') + '" data-bank-kind="">Все</button>' +
      KINDS.map(function (k) {
        return '<button type="button" class="pb-bank-chip' + (state.kind === k.id ? ' active' : '') + '" data-bank-kind="' + k.id + '">' + k.title + '</button>';
      }).join('') + '</div>';

    const toolbar = '<div class="pb-bank-tools">' +
      '<input class="field pb-bank-search" id="pbBankSearch" placeholder="Поиск по файлам" value="' + esc(state.query) + '">' +
      chips +
      '<span class="pb-bank-spacer"></span>' +
      (state.canWrite ? '<button class="btn ghost tiny" type="button" onclick="pbBankFolder()">＋ Папка</button><button class="btn red small" type="button" onclick="pbBankPick()">Загрузить файлы</button>' : '') +
      '</div>';

    const body = items.length
      ? '<div class="pb-bank-grid">' + items.map(renderCard).join('') + '</div>'
      : '<div class="pb-bank-empty">' + icon('folder-open', 'pb-icon-lg') +
      '<div><b>Пока пусто</b><div class="pb-bank-hint">' + (state.canWrite ? 'Перетащите файлы сюда или нажмите «Загрузить файлы».' : 'Файлы появятся, когда владелец или участники что-то загрузят.') + '</div></div></div>';

    host.innerHTML =
      '<div class="pb-bank-bar"><div class="pb-bank-status"><span class="pb-bank-dot on"></span>Яндекс.Диск подключён</div>' +
      '<span class="pb-bank-spacer"></span>' +
      (state.isOwner ? '<button class="btn ghost tiny" type="button" onclick="pbBankDisconnect()">Отключить</button>' : '') +
      '</div>' +
      (state.notice ? '<div class="pb-bank-notice">' + esc(state.notice) + '</div>' : '') +
      folderBar + toolbar + body +
      '<div class="pb-bank-drop" id="pbBankDrop">Перетащите файлы в эту область — они загрузятся в Диск</div>' +
      '<input type="file" id="pbBankInput" multiple hidden>';
    wire();
  }

  function wire() {
    const host = rootEl();
    if (!host) return;
    const input = document.getElementById('pbBankInput');
    if (input) input.onchange = function () { uploadFiles(this.files); this.value = ''; };
    const drop = document.getElementById('pbBankDrop');
    if (drop) {
      ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
      drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) uploadFiles(e.dataTransfer.files); });
    }
    const search = document.getElementById('pbBankSearch');
    if (search) {
      search.addEventListener('input', function () { state.query = this.value; });
      search.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); render(); } });
    }
    host.querySelectorAll('[data-bank-folder]').forEach(function (b) {
      b.onclick = function () { state.path = b.getAttribute('data-bank-folder'); state.query = ''; state.kind = ''; refresh(true); };
    });
    host.querySelectorAll('[data-bank-kind]').forEach(function (b) {
      b.onclick = function () { state.kind = b.getAttribute('data-bank-kind'); searchState(); };
    });
    host.querySelectorAll('[data-bank-open]').forEach(function (b) {
      b.onclick = function () {
        const path = b.getAttribute('data-bank-open');
        const item = state.items.find(function (i) { return i.path === path; });
        if (item) openItem(item);
      };
    });
    host.querySelectorAll('[data-bank-del]').forEach(function (b) {
      b.onclick = function () {
        const path = b.getAttribute('data-bank-del');
        const item = state.items.find(function (i) { return i.path === path; });
        if (item) removeItem(item);
      };
    });
  }

  function searchState() {
    // сохранить текущий поиск при перерисовке фильтра
    const s = document.getElementById('pbBankSearch');
    if (s) state.query = s.value;
    render();
  }

  // ---------- публичные обработчики для inline-разметки ----------
  window.pbBankOpenAuth = openAuth;
  window.pbBankConnect = connectWithCode;
  window.pbBankDisconnect = disconnect;
  window.pbBankPick = function () { const i = document.getElementById('pbBankInput'); if (i) i.click(); };
  window.pbBankFolder = createFolder;

  // ---------- встраивание в страницу «Банк» ----------
  function onBankVisible() {
    if (!document.getElementById('bank')) return;
    if (!document.getElementById('bank').classList.contains('active')) return;
    ensureRoot();
    if (!state.ready) { state.ready = true; refresh(true); }
    else render();
  }

  const prevRenderAll = window.renderAll;
  window.renderAll = function () {
    if (typeof prevRenderAll === 'function') prevRenderAll.apply(this, arguments);
    try { onBankVisible(); } catch (e) { console.warn('[bank]', e); }
  };

  document.addEventListener('click', function (e) {
    const nav = e.target.closest('[data-page="bank"]');
    if (nav) setTimeout(function () { onBankVisible(); }, 60);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onBankVisible);
  else onBankVisible();
})();
