/* =========================================================================
   Подписка на календарь (ICS) для страницы «Календарь».
   Модуль сам подключается к секции #calendar и не меняет существующую
   разметку: блок «Подписка на календарь» добавляется в конец секции.
   Все секреты — на сервере: браузер получает только персональный URL.
   ========================================================================= */
(function () {
  'use strict';

  var FN = 'calendar-feed';

  var state = {
    userId: null,
    loaded: false,
    loading: false,
    busy: false,
    linked: false,
    url: '',
    notice: ''
  };

  // ---------- стили (только переменные проекта + префикс pbcal-) ----------
  var css = document.createElement('style');
  css.id = 'pbCalStyle';
  css.textContent = [
    '#pbCalApp{margin-top:20px;display:block}',
    '.pbcal-card{display:grid;gap:14px;padding:18px;border:1px solid var(--line);border-radius:var(--radius-l);background:var(--panel);box-shadow:var(--shadow-1)}',
    '.pbcal-head{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap}',
    '.pbcal-head h2{margin:0;font-size:17px;font-weight:650;letter-spacing:-.015em}',
    '.pbcal-sub{margin:4px 0 0;font-size:12.5px;line-height:1.5;color:var(--muted)}',
    '.pbcal-hint{margin:0;font-size:12.5px;line-height:1.55;color:var(--muted)}',
    '.pbcal-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
    '.pbcal-row .field{flex:1 1 280px;min-height:42px;font:400 12.5px/1.4 var(--font-num);color:var(--text-2)}',
    '.pbcal-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
    '.pbcal-actions .btn[disabled]{opacity:.45;cursor:default}',
    '.pbcal-danger{color:var(--red)}',
    '.pbcal-danger:hover{color:var(--red);border-color:rgba(255,107,107,.45);background:var(--red-soft)}',
    '.pbcal-notice{border:1px solid rgba(255,107,107,.32);background:var(--red-soft);color:#ffc9c9;border-radius:var(--radius);padding:10px 12px;font-size:13px;line-height:1.5}',
    '.pbcal-how{border-top:1px solid var(--line);padding-top:12px}',
    '.pbcal-how summary{cursor:pointer;font-size:13px;color:var(--text-2);transition:color 160ms var(--ease)}',
    '.pbcal-how summary:hover{color:var(--text)}',
    '.pbcal-steps{margin:10px 0 0;padding:0;list-style:none;display:grid;gap:8px}',
    '.pbcal-steps li{position:relative;padding-left:16px;font-size:13px;line-height:1.5;color:var(--muted)}',
    '.pbcal-steps li::before{content:"•";position:absolute;left:2px;top:0;color:var(--accent)}',
    '.pbcal-steps b{color:var(--text-2);font-weight:600}',
    '@media (max-width:700px){.pbcal-actions .btn{flex:1 1 auto}.pbcal-card{padding:16px}}',
    '@media (prefers-reduced-motion: reduce){.pbcal-how summary{transition:none}}'
  ].join('');
  document.head.appendChild(css);

  // ---------- утилиты ----------
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }
  function toast(message) {
    if (typeof window.toast === 'function') window.toast(message);
  }
  function section() {
    return document.getElementById('calendar');
  }
  function isActive() {
    var el = section();
    return !!(el && el.classList.contains('active'));
  }

  async function callFn(body) {
    var client = window.supabaseClient;
    if (!client || !client.functions) return { error: { message: 'Нет подключения к Supabase' } };
    try {
      var res = await client.functions.invoke(FN, { body: body });
      if (res.error) {
        var message = res.error.message || 'Ошибка Edge Function';
        try {
          var context = res.error.context;
          if (context && typeof context.json === 'function') {
            var payload = await context.json();
            if (payload && payload.error) message = payload.error;
          }
        } catch (e) { /* тело ответа не JSON — оставляем общий текст */ }
        return { error: { message: message } };
      }
      return { data: res.data || {} };
    } catch (e) {
      return { error: { message: (e && e.message) || 'Сеть недоступна' } };
    }
  }

  // ---------- разметка ----------
  function btnHtml(label, action, extraClass) {
    return '<button class="btn ghost' + (extraClass ? ' ' + extraClass : '') + '" type="button" data-pbcal="' +
      esc(action) + '"' + (state.busy ? ' disabled' : '') + '>' + esc(label) + '</button>';
  }

  function howHtml() {
    return '<details class="pbcal-how">' +
      '<summary>Как подключить</summary>' +
      '<ul class="pbcal-steps">' +
      '<li><b>Яндекс.Календарь</b> — «Добавить календарь по ссылке» и вставить адрес.</li>' +
      '<li><b>Google Calendar</b> — «Другие календари → Добавить по URL».</li>' +
      '<li><b>Apple / iPhone</b> — «Файл → Новая подписка на календарь».</li>' +
      '<li>Ссылка персональная: в календаре появятся события группы и ваши задачи. Обновление календарь получает сам, обычно в течение нескольких часов.</li>' +
      '</ul></details>';
  }

  function loadingHtml() {
    return '<div class="pbcal-card"><div class="pbcal-head"><div>' +
      '<h2>Подписка на календарь</h2>' +
      '<p class="pbcal-sub">События группы и ваши задачи в Яндекс.Календаре, Google Calendar или Apple.</p>' +
      '</div></div><p class="pbcal-hint">Загружаем состояние подписки…</p></div>';
  }

  function cardHtml() {
    var body;
    if (state.notice) {
      body = '<div class="pbcal-notice">' + esc(state.notice) + '</div>' +
        '<div class="pbcal-actions">' +
          '<button class="btn ghost" type="button" data-pbcal="retry"' + (state.busy ? ' disabled' : '') + '>Повторить</button>' +
        '</div>';
    } else if (state.linked) {
      body = '<div class="pbcal-row">' +
          '<input class="field" id="pbCalUrl" type="text" readonly value="' + esc(state.url) + '" aria-label="Ссылка для подписки">' +
        '</div>' +
        '<div class="pbcal-actions">' +
          btnHtml('Копировать', 'copy') +
          btnHtml('Скачать .ics', 'download') +
          btnHtml('Обновить ссылку', 'rotate') +
          btnHtml('Отключить', 'revoke', 'pbcal-danger') +
        '</div>' +
        '<p class="pbcal-hint">«Обновить ссылку» отключит старую и создаст новую. «Отключить» удалит подписку совсем.</p>';
    } else {
      body = '<div class="pbcal-actions">' +
          '<button class="btn red" type="button" data-pbcal="link"' + (state.busy ? ' disabled' : '') + '>Создать ссылку для календаря</button>' +
        '</div>';
    }
    return '<div class="pbcal-card">' +
      '<div class="pbcal-head"><div>' +
        '<h2>Подписка на календарь</h2>' +
        '<p class="pbcal-sub">События группы и ваши задачи в Яндекс.Календаре, Google Calendar или Apple.</p>' +
      '</div></div>' + body + howHtml() + '</div>';
  }

  function ensureHost() {
    var page = section();
    if (!page) return null;
    var host = document.getElementById('pbCalApp');
    if (!host) {
      host = document.createElement('div');
      host.id = 'pbCalApp';
      host.addEventListener('click', onHostClick);
      page.appendChild(host);
    }
    return host;
  }

  function render() {
    var host = ensureHost();
    if (!host) return;
    host.innerHTML = state.loaded ? cardHtml() : loadingHtml();
  }

  // ---------- действия ----------
  function applyLink(data) {
    var url = (data && data.url) || '';
    state.linked = !!url;
    state.url = url;
  }

  async function createLink() {
    if (state.busy) return;
    state.busy = true;
    render();
    var result = await callFn({ action: 'link' });
    state.busy = false;
    if (result.error) {
      state.loaded = true;
      state.notice = result.error.message;
      render();
      toast(result.error.message);
      return;
    }
    state.loaded = true;
    state.notice = '';
    applyLink(result.data);
    render();
    toast('Ссылка для календаря создана');
  }

  async function rotateLink() {
    if (state.busy) return;
    if (!window.confirm('Обновить ссылку? Старая перестанет работать, и календарь нужно будет подключить заново.')) return;
    state.busy = true;
    render();
    var result = await callFn({ action: 'rotate' });
    state.busy = false;
    if (result.error) {
      state.notice = result.error.message;
      render();
      toast(result.error.message);
      return;
    }
    state.loaded = true;
    state.notice = '';
    applyLink(result.data);
    render();
    toast('Ссылка обновлена');
  }

  async function revokeLink() {
    if (state.busy) return;
    if (!window.confirm('Отключить подписку? Ссылка перестанет работать, события пропадут из календаря.')) return;
    state.busy = true;
    render();
    var result = await callFn({ action: 'revoke' });
    state.busy = false;
    if (result.error) {
      state.notice = result.error.message;
      render();
      toast(result.error.message);
      return;
    }
    state.loaded = true;
    state.notice = '';
    state.linked = false;
    state.url = '';
    render();
    toast('Подписка отключена');
  }

  async function copyLink() {
    if (!state.url) return;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(state.url);
        toast('Ссылка скопирована');
        return;
      }
    } catch (e) { /* переходим к запасному способу */ }
    try {
      var area = document.createElement('textarea');
      area.value = state.url;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '-1000px';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
      toast('Ссылка скопирована');
    } catch (e) {
      toast('Не удалось скопировать — выделите ссылку вручную');
    }
  }

  function downloadIcs() {
    if (!state.url) return;
    var link = document.createElement('a');
    link.href = state.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.download = 'priznaki.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function onHostClick(event) {
    var trigger = event.target && event.target.closest ? event.target.closest('[data-pbcal]') : null;
    if (!trigger || state.busy) return;
    var action = trigger.getAttribute('data-pbcal');
    if (action === 'link') createLink();
    else if (action === 'rotate') rotateLink();
    else if (action === 'revoke') revokeLink();
    else if (action === 'copy') copyLink();
    else if (action === 'download') downloadIcs();
    else if (action === 'retry') { state.notice = ''; state.loaded = false; loadStatus(); }
  }

  // ---------- загрузка состояния ----------
  async function loadStatus() {
    if (state.loading) return;
    state.loading = true;
    render();
    var result = await callFn({ action: 'status' });
    state.loading = false;
    state.loaded = true;
    if (result.error) {
      state.linked = false;
      state.url = '';
      state.notice = result.error.message;
    } else {
      state.notice = '';
      applyLink(result.data);
    }
    render();
  }

  function resetForUser(userId) {
    state.userId = userId;
    state.loaded = false;
    state.loading = false;
    state.busy = false;
    state.linked = false;
    state.url = '';
    state.notice = '';
  }

  // ---------- встраивание в страницу ----------
  function onCalendarChanged() {
    if (!section()) return;
    ensureHost();
    var profile = window.__CURRENT_PROFILE__ || null;
    var userId = profile ? String(profile.id || '') : '';
    if (userId !== state.userId) {
      resetForUser(userId);
      if (isActive()) loadStatus();
      else render();
      return;
    }
    if (isActive() && !state.loaded && !state.loading) loadStatus();
  }

  var previousRenderAll = window.renderAll;
  window.renderAll = function () {
    if (typeof previousRenderAll === 'function') previousRenderAll.apply(this, arguments);
    try { onCalendarChanged(); } catch (e) { console.warn('[pbcal]', e); }
  };

  document.addEventListener('click', function (event) {
    var nav = event.target && event.target.closest ? event.target.closest('[data-page="calendar"]') : null;
    if (nav) setTimeout(onCalendarChanged, 60);
  });

  window.pbCalendarReload = function () { resetForUser(state.userId); onCalendarChanged(); };
  window.__pbCalendarDebug = state;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onCalendarChanged);
  else onCalendarChanged();
})();
