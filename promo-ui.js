/* =========================================================================
   Продвижение: каналы, цифры, графики, ручной ввод.
   Автоподтяжка — через Edge Function social-stats (ключи только на сервере).
   ========================================================================= */
(function () {
  const FN = 'social-stats';
  const PLATFORM_ICONS = {
    youtube: 'video', vk: 'users', telegram: 'send', instagram: 'camera',
    tiktok: 'music-2', spotify: 'disc', apple: 'music', yandex: 'headphones', other: 'globe'
  };
  const AUTO = ['youtube', 'vk', 'telegram'];

  const state = {
    loaded: false,
    busy: false,
    channels: [],
    snapshots: [],
    configured: {},
    autoTry: false
  };

  const css = document.createElement('style');
  css.id = 'pbPromoStyle';
  css.textContent = [
    '#promoApp{display:grid;gap:16px}',
    '.pbpromo-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 14px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:rgba(255,255,255,.02)}',
    '.pbpromo-status{font-size:13px;color:#a8a3b3;display:flex;align-items:center;gap:8px}',
    '.pbpromo-dot{width:8px;height:8px;border-radius:50%;background:#f59e0b}',
    '.pbpromo-dot.on{background:#34d399}',
    '.pbpromo-spacer{flex:1 1 auto}',
    '.pbpromo-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}',
    '.pbpromo-metric{border:1px solid rgba(255,255,255,.07);border-radius:16px;background:#15151a;padding:16px 18px;display:grid;gap:6px}',
    '.pbpromo-metric span{font-size:12px;color:#8f8a9c}',
    '.pbpromo-metric b{font-size:26px;letter-spacing:-.02em;color:#f1ecff}',
    '.pbpromo-metric small{font-size:12px;color:#a8a3b3}',
    '.pbpromo-chart{border:1px solid rgba(255,255,255,.07);border-radius:16px;background:#15151a;padding:16px 18px 8px}',
    '.pbpromo-chart h3{margin:0 0 4px;font-size:15px;color:#e9e4f3}',
    '.pbpromo-chart .pbpromo-hint{font-size:12px;color:#8f8a9c;margin-bottom:8px}',
    '.pbpromo-chart svg{width:100%;height:170px;display:block;overflow:visible}',
    '.pbpromo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}',
    '.pbpromo-card{border:1px solid rgba(255,255,255,.07);border-radius:16px;background:#15151a;padding:14px 16px;display:grid;gap:8px}',
    '.pbpromo-card-head{display:flex;align-items:center;gap:9px}',
    '.pbpromo-card-head .pb-icon{width:20px;height:20px;color:#c4b5fd}',
    '.pbpromo-card-head b{font-size:14.5px;color:#eee9f7;flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.pbpromo-badge{font-size:10.5px;padding:2px 7px;border-radius:999px;border:1px solid rgba(167,139,250,.4);color:#cdbdfd;background:rgba(167,139,250,.12);white-space:nowrap}',
    '.pbpromo-badge.manual{border-color:rgba(255,255,255,.12);color:#a8a3b3;background:rgba(255,255,255,.03)}',
    '.pbpromo-nums{display:flex;gap:14px;flex-wrap:wrap}',
    '.pbpromo-num{display:grid;gap:1px}',
    '.pbpromo-num b{font-size:19px;color:#f1ecff;letter-spacing:-.01em}',
    '.pbpromo-num span{font-size:11px;color:#8f8a9c}',
    '.pbpromo-delta{font-size:12px}',
    '.pbpromo-delta.up{color:#34d399}',
    '.pbpromo-delta.down{color:#f87171}',
    '.pbpromo-delta.flat{color:#8f8a9c}',
    '.pbpromo-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}',
    '.pbpromo-link{font-size:12px;color:#a78bfa;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}',
    '.pbpromo-empty{border:1px dashed rgba(255,255,255,.12);border-radius:16px;padding:24px;text-align:center;color:#a8a3b3}',
    '.pbpromo-notice{border-radius:12px;padding:10px 13px;font-size:13px;border:1px solid rgba(248,113,113,.35);background:rgba(248,113,113,.08);color:#ffc9c9}',
    '@media (max-width:700px){.pbpromo-grid{grid-template-columns:1fr}.pbpromo-metric b{font-size:22px}}'
  ].join('');
  document.head.appendChild(css);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function icon(name, cls) { return (typeof window.pbIcon === 'function') ? window.pbIcon(name, cls) : ''; }
  function toast(m) { if (typeof window.toast === 'function') window.toast(m); }
  function nf(n) { return Number(n || 0).toLocaleString('ru-RU'); }
  function shortDate(s) {
    if (!s) return '';
    try { return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(s + 'T12:00:00')); }
    catch (e) { return s; }
  }
  function isAuto(platform) { return AUTO.indexOf(platform) !== -1; }

  function ensureRoot() {
    const page = document.getElementById('promotion');
    if (!page) return null;
    let host = document.getElementById('promoApp');
    if (!host) {
      host = document.createElement('div');
      host.id = 'promoApp';
      const tabs = page.querySelector('.tabs');
      if (tabs && tabs.parentNode === page) page.insertBefore(host, tabs);
      else page.appendChild(host);
    }
    return host;
  }

  function hideLegacy() {
    const page = document.getElementById('promotion');
    if (!page) return;
    Array.prototype.forEach.call(page.children, function (el) {
      if (el.id === 'promoApp') return;
      el.style.display = 'none';
    });
  }

  async function callFn(body) {
    const c = window.supabaseClient;
    if (!c || !c.functions) return { error: { message: 'Нет подключения к Supabase' } };
    const res = await c.functions.invoke(FN, { body: body });
    if (res.error) {
      let msg = res.error.message || 'Ошибка функции';
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

  async function loadData() {
    const c = window.supabaseClient;
    if (!c) return;
    const [chRes, snapRes] = await Promise.all([
      c.from('promo_channels').select('*').order('sort', { ascending: true }),
      c.from('promo_snapshots').select('channel_id, taken_on, followers, views, plays, likes, comments, notes').order('taken_on', { ascending: true }).limit(4000)
    ]);
    state.channels = chRes.data || [];
    state.snapshots = snapRes.data || [];
  }

  function latestByChannel() {
    const map = {};
    state.snapshots.forEach(function (s) {
      const cur = map[s.channel_id];
      if (!cur || s.taken_on > cur.taken_on) map[s.channel_id] = s;
      else if (s.taken_on === cur.taken_on) map[s.channel_id] = s;
    });
    return map;
  }
  function previousByChannel() {
    const latest = latestByChannel();
    const map = {};
    state.snapshots.forEach(function (s) {
      const l = latest[s.channel_id];
      if (!l || s.taken_on >= l.taken_on) return;
      const cur = map[s.channel_id];
      if (!cur || s.taken_on > cur.taken_on) map[s.channel_id] = s;
    });
    return map;
  }

  function totalAudience() {
    const latest = latestByChannel();
    return state.channels.reduce(function (sum, ch) {
      const s = latest[ch.id];
      return sum + (s ? Number(s.followers || 0) : 0);
    }, 0);
  }
  function totalViews() {
    const latest = latestByChannel();
    return state.channels.reduce(function (sum, ch) {
      const s = latest[ch.id];
      return sum + (s ? Number(s.views || 0) : 0);
    }, 0);
  }
  function audienceDelta() {
    const latest = latestByChannel(), prev = previousByChannel();
    let d = 0;
    state.channels.forEach(function (ch) {
      const a = latest[ch.id], b = prev[ch.id];
      if (a && b) d += Number(a.followers || 0) - Number(b.followers || 0);
    });
    return d;
  }

  function chartSeries() {
    const byDay = {};
    state.snapshots.forEach(function (s) {
      const day = s.taken_on;
      byDay[day] = byDay[day] || {};
      byDay[day][s.channel_id] = Number(s.followers || 0);
    });
    const days = Object.keys(byDay).sort().slice(-30);
    const series = [];
    let lastKnown = {};
    days.forEach(function (day) {
      Object.keys(byDay[day]).forEach(function (id) { lastKnown[id] = byDay[day][id]; });
      const total = state.channels.reduce(function (sum, ch) { return sum + (lastKnown[ch.id] || 0); }, 0);
      series.push({ day: day, value: total });
    });
    return series;
  }

  function chartSVG() {
    const series = chartSeries();
    if (series.length < 2) {
      return '<div class="pbpromo-hint">График появится, когда будет хотя бы два дня данных. Сейчас нажмите «Обновить из API» — будет первый снимок, завтра второй.</div>';
    }
    const w = 600, h = 150, pad = 6;
    const vals = series.map(function (p) { return p.value; });
    const max = Math.max.apply(null, vals);
    const min = Math.min.apply(null, vals);
    const span = Math.max(1, max - min);
    const x = function (i) { return pad + (i * (w - pad * 2)) / (series.length - 1); };
    const y = function (v) { return h - pad - ((v - min) / span) * (h - pad * 2); };
    const pts = series.map(function (p, i) { return x(i).toFixed(1) + ',' + y(p.value).toFixed(1); });
    const line = pts.join(' ');
    const area = line + ' ' + x(series.length - 1).toFixed(1) + ',' + (h - pad) + ' ' + x(0).toFixed(1) + ',' + (h - pad);
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="Аудитория по дням">' +
      '<defs><linearGradient id="pbpromoFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(167,139,250,.45)"/><stop offset="100%" stop-color="rgba(167,139,250,0)"/></linearGradient></defs>' +
      '<polygon points="' + area + '" fill="url(#pbpromoFill)"></polygon>' +
      '<polyline points="' + line + '" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>' +
      '</svg>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:#8f8a9c;margin-top:2px"><span>' + esc(shortDate(series[0].day)) + '</span><span>' + esc(shortDate(series[series.length - 1].day)) + ' · ' + nf(series[series.length - 1].value) + '</span></div>';
  }

  function metricCard(label, value, hint) {
    return '<div class="pbpromo-metric"><span>' + esc(label) + '</span><b>' + esc(value) + '</b><small>' + esc(hint || '') + '</small></div>';
  }

  function deltaHTML(d) {
    if (!d) return '<span class="pbpromo-delta flat">без изменений</span>';
    const cls = d > 0 ? 'up' : 'down';
    return '<span class="pbpromo-delta ' + cls + '">' + (d > 0 ? '+' : '') + nf(d) + ' за период</span>';
  }

  function channelCard(ch, latest, prev) {
    const nums = latest || {};
    const followers = Number(nums.followers || 0);
    const views = Number(nums.views || 0);
    const plays = Number(nums.plays || 0);
    const delta = (latest && prev) ? followers - Number(prev.followers || 0) : 0;
    const auto = isAuto(ch.platform);
    const configured = state.configured[ch.platform];
    const badge = auto
      ? '<span class="pbpromo-badge' + (configured ? '' : ' manual') + '">' + (configured ? 'авто' : 'нет ключа') + '</span>'
      : '<span class="pbpromo-badge manual">вручную</span>';
    const link = ch.url ? '<a class="pbpromo-link" href="' + esc(ch.url) + '" target="_blank" rel="noopener">' + esc(ch.url.replace(/^https?:\/\//, '')) + '</a>' : '<span class="pbpromo-link" style="color:#6f6a7d">ссылка не указана</span>';
    return '<div class="pbpromo-card">' +
      '<div class="pbpromo-card-head">' + icon(PLATFORM_ICONS[ch.platform] || 'globe') + '<b title="' + esc(ch.name) + '">' + esc(ch.name) + '</b>' + badge + '</div>' +
      link +
      '<div class="pbpromo-nums">' +
      '<div class="pbpromo-num"><b>' + (latest ? nf(followers) : '—') + '</b><span>подписчики</span></div>' +
      '<div class="pbpromo-num"><b>' + (latest && views ? nf(views) : '—') + '</b><span>просмотры</span></div>' +
      (plays || ch.platform === 'spotify' || ch.platform === 'apple' || ch.platform === 'yandex'
        ? '<div class="pbpromo-num"><b>' + (latest && plays ? nf(plays) : '—') + '</b><span>прослушивания</span></div>' : '') +
      '</div>' +
      '<div>' + (latest ? deltaHTML(delta) + ' <span style="font-size:11px;color:#6f6a7d">· ' + esc(shortDate(latest.taken_on)) + '</span>' : '<span class="pbpromo-delta flat">данных пока нет</span>') + '</div>' +
      '<div class="pbpromo-actions"><button class="btn ghost tiny" type="button" data-promo-entry="' + esc(ch.id) + '">Внести цифры</button>' +
      (auto && configured ? '' : '') + '</div>' +
      '</div>';
  }

  function render() {
    const host = ensureRoot();
    if (!host) return;
    hideLegacy();
    const latest = latestByChannel(), prev = previousByChannel();
    const d = audienceDelta();
    const host_metrics = '<div class="pbpromo-metrics">' +
      metricCard('Всего аудитории', nf(totalAudience()), state.channels.length + ' каналов') +
      metricCard('Просмотры', nf(totalViews()), 'сумма по каналам') +
      metricCard('Прирост', (d > 0 ? '+' : '') + nf(d), 'подписчики за период') +
      metricCard('Данных', state.snapshots.length + ' снимков', latest[state.channels[0] && state.channels[0].id] ? 'есть свежие' : 'нужен первый снимок') +
      '</div>';
    const autoCount = AUTO.filter(function (p) { return state.configured[p]; }).length;
    const bar = '<div class="pbpromo-bar">' +
      '<div class="pbpromo-status"><span class="pbpromo-dot' + (autoCount ? ' on' : '') + '"></span>' +
      (autoCount ? 'Автоподтяжка: ' + autoCount + ' из 3 (YouTube, ВК, Telegram)' : 'Автоподтяжка выключена — вносим вручную') + '</div>' +
      '<span class="pbpromo-spacer"></span>' +
      '<button class="btn ghost tiny" type="button" id="pbpromoRefresh">↻ Обновить из API</button>' +
      '<button class="btn red tiny" type="button" id="pbpromoAdd">＋ Внести цифры</button>' +
      '</div>';
    const chart = '<div class="pbpromo-chart"><h3>Аудитория по дням</h3><div class="pbpromo-hint">Сумма подписчиков по всем каналам, последние 30 дней с данными</div>' + chartSVG() + '</div>';
    const cards = state.channels.length
      ? '<div class="pbpromo-grid">' + state.channels.map(function (ch) { return channelCard(ch, latest[ch.id], prev[ch.id]); }).join('') + '</div>'
      : '<div class="pbpromo-empty">Каналы не заведены. Нажмите «Внести цифры», чтобы создать первый.</div>';
    host.innerHTML = bar + host_metrics + chart + cards;
    wire(host);
  }

  function wire(host) {
    const refresh = host.querySelector('#pbpromoRefresh');
    if (refresh) refresh.onclick = syncFromApi;
    const add = host.querySelector('#pbpromoAdd');
    if (add) add.onclick = function () { openEntryModal(null); };
    host.querySelectorAll('[data-promo-entry]').forEach(function (b) {
      b.onclick = function () { openEntryModal(b.getAttribute('data-promo-entry')); };
    });
  }

  async function syncFromApi() {
    const btn = document.getElementById('pbpromoRefresh');
    if (btn) { btn.disabled = true; btn.textContent = 'Забираем…'; }
    try {
      const r = await callFn({ action: 'sync' });
      if (r.error) { toast('Не удалось обновить: ' + r.error.message); return; }
      const saved = (r.data.saved || []).length;
      const errors = r.data.errors || [];
      toast(saved ? 'Обновлено каналов: ' + saved + (errors.length ? ', ошибок: ' + errors.length : '') : 'Новых данных нет');
      if (errors.length) console.warn('[promo] sync errors', errors);
      await loadData();
      render();
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '↻ Обновить из API'; }
    }
  }

  // ---------- модалка ручного ввода ----------
  let entryCtx = null;
  function ensureEntryModal() {
    if (document.getElementById('pbPromoEntry')) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.id = 'pbPromoEntry';
    wrap.innerHTML = [
      '<div class="modal" role="dialog" aria-modal="true" style="max-width:560px">',
      '<div class="pb-modal-title" id="pbPromoEntryTitle">Внести цифры</div>',
      '<p class="pb-modal-sub">Одна запись — один день. Если за этот день уже есть запись, она обновится.</p>',
      '<div class="form">',
      '<label>Канал<select class="field" id="pbPromoChannel"></select></label>',
      '<label>Дата<input class="field" type="date" id="pbPromoDate"></label>',
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">',
      '<label>Подписчики<input class="field" type="number" id="pbPromoFollowers" min="0" value="0"></label>',
      '<label>Просмотры<input class="field" type="number" id="pbPromoViews" min="0" value="0"></label>',
      '<label>Прослушивания<input class="field" type="number" id="pbPromoPlays" min="0" value="0"></label>',
      '<label>Лайки<input class="field" type="number" id="pbPromoLikes" min="0" value="0"></label>',
      '</div>',
      '<label>Заметка<input class="field" id="pbPromoNote" maxlength="200" placeholder="Например: данные из Spotify for Artists"></label>',
      '</div>',
      '<div class="pb-modal-actions"><button class="btn ghost" type="button" id="pbPromoCancel">Отмена</button><button class="btn red" type="button" id="pbPromoSave">Сохранить</button></div>',
      '</div>'
    ].join('');
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeEntryModal(); });
    document.getElementById('pbPromoCancel').onclick = closeEntryModal;
    document.getElementById('pbPromoSave').onclick = saveEntry;
  }

  function openEntryModal(channelId) {
    ensureEntryModal();
    entryCtx = { channelId: channelId };
    const sel = document.getElementById('pbPromoChannel');
    sel.innerHTML = state.channels.map(function (ch) {
      return '<option value="' + esc(ch.id) + '"' + (ch.id === channelId ? ' selected' : '') + '>' + esc(ch.name) + (isAuto(ch.platform) ? ' (авто)' : '') + '</option>';
    }).join('');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Krasnoyarsk' }).format(new Date());
    document.getElementById('pbPromoDate').value = today;
    ['pbPromoFollowers', 'pbPromoViews', 'pbPromoPlays', 'pbPromoLikes'].forEach(function (id) {
      document.getElementById(id).value = '0';
    });
    document.getElementById('pbPromoNote').value = '';
    document.getElementById('pbPromoEntry').classList.add('open');
  }
  function closeEntryModal() {
    const el = document.getElementById('pbPromoEntry');
    if (el) el.classList.remove('open');
    entryCtx = null;
  }

  async function saveEntry() {
    const c = window.supabaseClient;
    if (!c) { toast('Нет подключения'); return; }
    const channelId = document.getElementById('pbPromoChannel').value;
    const day = document.getElementById('pbPromoDate').value;
    if (!channelId || !day) { toast('Выберите канал и дату'); return; }
    const btn = document.getElementById('pbPromoSave');
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = 'Сохраняем…';
    try {
      const me = window.__CURRENT_PROFILE__ || {};
      const row = {
        channel_id: channelId,
        taken_on: day,
        followers: Number(document.getElementById('pbPromoFollowers').value || 0),
        views: Number(document.getElementById('pbPromoViews').value || 0),
        plays: Number(document.getElementById('pbPromoPlays').value || 0),
        likes: Number(document.getElementById('pbPromoLikes').value || 0),
        comments: 0,
        notes: String(document.getElementById('pbPromoNote').value || '').slice(0, 200),
        created_by: me.id || null
      };
      const { error } = await c.from('promo_snapshots').upsert(row, { onConflict: 'channel_id,taken_on' });
      if (error) { toast('Не сохранилось: ' + error.message); return; }
      toast('Цифры сохранены');
      closeEntryModal();
      await loadData();
      render();
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  }

  // ---------- встраивание ----------
  let rendering = false;
  async function onPromoVisible() {
    const page = document.getElementById('promotion');
    if (!page || !page.classList.contains('active')) return;
    if (rendering) return;
    ensureRoot();
    if (!state.loaded) {
      rendering = true;
      try {
        const st = await callFn({ action: 'status' });
        state.configured = (st.data && st.data.configured) || {};
        await loadData();
        state.loaded = true;
        render();
        if (!state.snapshots.length) syncFromApi();
      } finally { rendering = false; }
      return;
    }
    render();
  }

  const prevRenderAll = window.renderAll;
  window.renderAll = function () {
    if (typeof prevRenderAll === 'function') prevRenderAll.apply(this, arguments);
    try { onPromoVisible(); } catch (e) { console.warn('[promo]', e); }
  };

  document.addEventListener('click', function (e) {
    const nav = e.target.closest('[data-page="promotion"]');
    if (nav) setTimeout(function () { onPromoVisible(); }, 80);
  });

  // старая разметка иногда перерисовывает страницу — возвращаем дашборд
  function watchPromo() {
    const page = document.getElementById('promotion');
    if (!page || page.dataset.pbWatched === '1') return;
    page.dataset.pbWatched = '1';
    const obs = new MutationObserver(function () {
      if (!page.classList.contains('active')) return;
      if (!document.getElementById('promoApp')) setTimeout(function () { onPromoVisible(); }, 60);
    });
    obs.observe(page, { childList: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { watchPromo(); onPromoVisible(); });
  else { watchPromo(); onPromoVisible(); }
})();
