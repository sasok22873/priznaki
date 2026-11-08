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
    folderMeta: {}
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
      const { data } = await window.supabaseClient.from('bank_folders').select('yandex_path, icon, name').in('yandex_path', paths);
      (data || []).forEach(function (r) { state.folderMeta[r.yandex_path] = r; });
    } catch (e) { }
  }
  function folderIconOf(path) {
    const m = state.folderMeta && state.folderMeta[path];
    return m && m.icon ? m.icon : '';
  }

  // Скрываем устаревшие блоки старого Банка на облачных вкладках.
  function syncLegacy(tab) {
    const box = document.getElementById('bankContent');
    if (!box) return;
    const showLegacy = tab === 'lyrics';
    Array.prototype.forEach.call(box.children, function (el) {
      if (el.id === 'pbBankCloudSection' || el.getAttribute('data-bank-mode') === 'cloud') return;
      el.style.display = showLegacy ? '' : 'none';
    });
    const actions = document.querySelector('#bank > .bank-actions');
    if (actions) actions.style.display = showLegacy ? '' : 'none';
  }

  function pageLimit(key) { return state.page[key] || 24; }
  function pagedItems(items, key) { return items.slice(0, pageLimit(key)); }
  function moreButton(items, key) {
    const shown = pageLimit(key);
    if (items.length <= shown) return '';
    return '<div class="pb-bank-more"><button class="btn ghost tiny" type="button" data-bank-more="' + esc(key) + '">Показать ещё (' + (items.length - shown) + ')</button></div>';
  }
  async function hydrateThumbs(root) {
    const imgs = (root || document).querySelectorAll('img[data-thumb]');
    for (const img of Array.from(imgs)) {
      if (img.dataset.hydrated === '1') continue;
      img.dataset.hydrated = '1';
      const path = img.getAttribute('data-thumb');
      img.addEventListener('error', async function handler() {
        img.removeEventListener('error', handler);
        if (!path) { img.remove(); return; }
        const u = await thumbUrlFor(path);
        if (u) img.src = u; else img.remove();
      });
      if (img.dataset.preview && !img.getAttribute('src')) img.src = img.dataset.preview;
    }
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
    const res = await callFn({ action: 'list', path: path });
    const all = (res.error ? [] : (res.data.items || []));
    const entry = {
      files: all.filter(function (it) { return it.type === 'file'; }),
      dirs: all.filter(function (it) { return it.type === 'dir'; })
    };
    state.cache[path] = entry;
    return entry;
  }

  async function albumInfo(dir) {
    if (state.albumCache[dir.path]) return state.albumCache[dir.path];
    const res = await listFolder(dir.path);
    const photos = res.files.filter(function (f) { return kindOfFile(f.name, f.mime) === 'photos'; });
    const coverItem = photos.find(function (f) { return !!f.preview; }) || res.files.find(function (f) { return !!f.preview; }) || null;
    const info = { dir: dir, files: res.files, photos: photos, cover: coverItem ? coverItem.preview : '', coverPath: coverItem ? coverItem.path : '', count: photos.length || res.files.length };
    state.albumCache[dir.path] = info;
    return info;
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
            preview_url: item.preview || ''
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
    const u = await fileProxyUrl(item.path);
    if (!u) { toast('Нет доступа к файлу'); return; }
    window.open(u, '_blank', 'noopener');
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
      '<div class="pb-bank-actions"><button class="btn tiny" type="button" data-bank-open="' + esc(item.path) + '">Открыть</button>' +
      (state.canWrite ? '<button class="btn tiny ghost" type="button" data-bank-del="' + esc(item.path) + '">Удалить</button>' : '') +
      '</div></div></div>';
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

  function albumCard(info) {
    const iconName = folderIconOf(info.dir.path);
    const inner = info.coverPath
      ? '<img src="' + esc(info.cover || '') + '" data-preview="' + esc(info.cover || '') + '" data-thumb="' + esc(info.coverPath) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
      : icon(iconName || 'images', 'pb-icon-lg');
    const badge = iconName ? '<span class="pb-album-badge">' + icon(iconName, 'pb-icon-sm') + '</span>' : '';
    const del = state.isOwner
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
    const infos = [];
    const queue = dirs.slice();
    const workers = [];
    for (let w = 0; w < 3; w++) {
      workers.push((async function () {
        while (queue.length) {
          const d = queue.shift();
          infos.push(await albumInfo(d));
        }
      })());
    }
    await Promise.all(workers);
    const order = {};
    dirs.forEach(function (d, i) { order[d.path] = i; });
    infos.sort(function (a, b) { return order[a.dir.path] - order[b.dir.path]; });
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
      html = albumsHtml + gridHTML(pagedItems(res.files, key), 'В папке «' + state.folder + '» пока нет файлов.') + moreButton(res.files, key) +
        '<div class="pb-bank-drop" id="pbBankDrop">Перетащите файлы сюда — они загрузятся в «' + esc(state.folder) + '»</div>' +
        '<input type="file" id="pbBankInput" multiple hidden>';
    } else {
      const key = 'all';
      const rootRes = await listFolder(ROOT);
      let items = rootRes.files.slice();
      let albums = [];
      for (const n of Object.keys(FOLDERS).map(function (k) { return FOLDERS[k]; })) {
        if (folders.indexOf(n) === -1) continue;
        const sub = await listFolder(ROOT + '/' + n);
        for (const d of sub.dirs) albums.push(d);
        for (const it of sub.files) { it.folderName = n; items.push(it); }
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
      extra = '<button class="btn ghost tiny" type="button" onclick="pbBankExportLyrics()">↥ Выгрузить тексты в облако' + (pending ? ' (' + pending + ')' : '') + '</button>';
    }
    const albumsHtml = res.dirs.length
      ? '<div class="pb-bank-cloud-head"><h2 style="margin:0;font-size:16px">Альбомы (подпапки)</h2><span class="pb-bank-hint">Обложка — первое фото из папки</span></div>' + await albumsHTML(res.dirs)
      : '';

    section.innerHTML = '<div class="pb-bank-cloud-head"><h2>Файлы в облаке</h2>' +
      '<span class="pb-bank-hint">Папка «' + esc(folder) + '» в Яндекс.Диске</span>' +
      extra +
      (state.canWrite ? '<button class="btn ghost tiny" type="button" onclick="pbBankPick(\'' + esc(tab) + '\')">＋ Загрузить</button>' : '') +
      '</div>' + albumsHtml +
      gridHTML(pagedItems(res.files, key), 'В папке «' + folder + '» пока нет файлов.') +
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
    state.reqTab = tab;
    state.reqAt = now;
    const next = renderChain.then(function () { return renderInner(force, tab); }).catch(function (e) { console.warn('[bank] render', e); });
    renderChain = next;
    return next;
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
})();
