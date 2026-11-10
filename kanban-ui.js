/* =========================================================================
   Канбан: бэклог, перетаскивание, запрос срока при переносе в работу,
   фильтр по проекту. Работает поверх штатного канбана.
   ========================================================================= */
(function () {
  const WORK_STATUSES = ['В работе'];
  const DONE_STATUSES = ['Завершена'];

  const css = document.createElement('style');
  css.id = 'pbKanbanStyle';
  css.textContent = [
    '#boardView.pb-kanban{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;align-items:start}',
    '.pb-lane{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:10px;min-height:140px;transition:border-color .15s,background .15s}',
    '.pb-lane.drag-over{border-color:rgba(167,139,250,.7);background:rgba(167,139,250,.08)}',
    '.pb-lane-head{display:flex;align-items:center;gap:8px;margin:0 0 10px;padding:2px 2px 8px;border-bottom:1px solid rgba(255,255,255,.06)}',
    '.pb-lane-head b{font-size:12.5px;letter-spacing:.01em;color:#e7e2f2;flex:1 1 auto;min-width:0}',
    '.pb-lane-count{font-size:11px;color:#8f8a9c;background:rgba(255,255,255,.05);border-radius:999px;padding:1px 8px}',
    '.pb-lane--backlog .pb-lane-head b{color:#c4b5fd}',
    '.pb-card{background:#15151a;border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:9px 10px;margin:0 0 8px;cursor:grab;transition:border-color .14s,box-shadow .14s,transform .14s}',
    '.pb-card:hover{border-color:rgba(167,139,250,.5);box-shadow:0 8px 20px rgba(0,0,0,.35);transform:translateY(-1px)}',
    '.pb-card.dragging{opacity:.5}',
    '.pb-card b{display:block;font-size:12.5px;color:#e7e2f2;line-height:1.35;margin:0 0 4px;overflow-wrap:anywhere}',
    '.pb-card-meta{display:flex;flex-wrap:wrap;gap:6px;font-size:10.5px;color:#8f8a9c}',
    '.pb-card-meta .pb-chip{background:rgba(255,255,255,.05);border-radius:6px;padding:1px 6px}',
    '.pb-card.pb-overdue{border-color:rgba(248,113,113,.55)}',
    '.pb-card.pb-overdue .pb-card-nodate{color:#f87171}',
    '.pb-card-nodate{color:#c4b5fd}',
    '.pb-prio{font-weight:600}',
    '.pb-prio.high{color:#f87171}.pb-prio.medium{color:#fbbf24}.pb-prio.low{color:#93c5fd}',
    '.pb-lane-empty{font-size:11.5px;color:#6f6a7d;text-align:center;padding:10px 0}',
    '.pb-kanban-filter{display:flex;align-items:center;gap:8px}',
    '.pb-kanban-filter select{min-width:170px}',
    '#pbDatePrompt .modal{max-width:460px}',
    '.pb-date-presets{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}',
    '.pb-date-presets .btn{justify-content:center}',
    '.pb-date-custom{display:flex;gap:8px;align-items:center;margin-top:4px}'
  ].join('');
  document.head.appendChild(css);

  let projectFilter = '';
  let goalFilter = '';

  function st() { return (typeof window.pbState === 'function') ? window.pbState() : null; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function todayKey() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Krasnoyarsk' }).format(new Date()); }
  function plusDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Krasnoyarsk' }).format(d); }
  function shortDate(s) {
    if (!s) return 'без срока';
    try { return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(s + 'T12:00:00')); } catch (e) { return s; }
  }
  function toast(m) { if (typeof window.toast === 'function') window.toast(m); }

  function ensureFilter() {
    const bar = document.querySelector('#tasks .filterbar');
    if (!bar || bar.querySelector('[data-pb-kanban-filter]')) return;
    const s = st() || {};
    const projects = s.projects || [];
    const goals = s.goals || [];
    const wrap = document.createElement('div');
    wrap.className = 'pb-kanban-filter';
    wrap.setAttribute('data-pb-kanban-filter', '1');
    wrap.innerHTML = '<select class="field" id="pbKanbanProject"><option value="">Все проекты</option>' +
      projects.map(function (p) { return '<option value="' + esc(p.title) + '">' + esc(p.title) + '</option>'; }).join('') + '</select>' +
      '<select class="field" id="pbKanbanGoal"><option value="">Все цели</option>' +
      goals.map(function (g) { return '<option value="' + esc(g.title) + '">' + esc(g.title) + '</option>'; }).join('') + '</select>';
    bar.appendChild(wrap);
    wrap.querySelector('#pbKanbanProject').addEventListener('change', function (e) { projectFilter = e.target.value; renderBoard(); });
    wrap.querySelector('#pbKanbanGoal').addEventListener('change', function (e) { goalFilter = e.target.value; renderBoard(); });
  }

  function boardVisible() {
    const b = document.getElementById('boardView');
    if (!b) return false;
    if (b.style.display === 'none') return false;
    return document.getElementById('tasks') && document.getElementById('tasks').classList.contains('active');
  }

  function cardHTML(task, i) {
    const today = todayKey();
    const overdue = task.date && task.date < today && !DONE_STATUSES.includes(task.status);
    const priorityClass = task.priority === 'Высокий' ? 'high' : task.priority === 'Низкий' ? 'low' : 'medium';
    return '<div class="pb-card' + (overdue ? ' pb-overdue' : '') + '" draggable="true" data-kind="task" data-i="' + i + '">' +
      '<b>' + esc(task.title || '') + '</b>' +
      '<div class="pb-card-meta">' +
      (task.date ? '<span class="pb-chip">' + esc(shortDate(task.date)) + '</span>' : '<span class="pb-chip pb-card-nodate">без срока</span>') +
      (task.owner ? '<span class="pb-chip">' + esc(task.owner) + '</span>' : '') +
      (task.project ? '<span class="pb-chip">📁 ' + esc(task.project) + '</span>' : '') +
      (task.goal ? '<span class="pb-chip">◎ ' + esc(task.goal) + '</span>' : '') +
      '<span class="pb-prio ' + priorityClass + '">' + esc(task.priority || 'Средний') + '</span>' +
      '</div></div>';
  }

  function laneEl(title, tasks, opts) {
    const lane = document.createElement('div');
    lane.className = 'pb-lane' + (opts.backlog ? ' pb-lane--backlog' : '');
    lane.innerHTML = '<div class="pb-lane-head"><b>' + esc(title) + '</b><span class="pb-lane-count">' + tasks.length + '</span></div>';
    tasks.forEach(function (t) { lane.insertAdjacentHTML('beforeend', cardHTML(t.task, t.index)); });
    if (!tasks.length) lane.insertAdjacentHTML('beforeend', '<div class="pb-lane-empty">Пусто</div>');
    return lane;
  }

  function renderBoard() {
    if (!boardVisible()) return;
    ensureFilter();
    const box = document.getElementById('boardView');
    if (!box) return;
    const s = st();
    if (!s) return;
    const tasks = s.tasks || [];
    const statuses = s.statuses || ['Новая', 'Запланирована', 'В работе', 'На проверке', 'Завершена', 'Отменена'];
    const visible = [];
    tasks.forEach(function (t, i) {
      if (projectFilter && String(t.project || '') !== projectFilter) return;
      if (goalFilter && String(t.goal || '') !== goalFilter) return;
      visible.push({ task: t, index: i });
    });
    const backlog = visible.filter(function (x) { return !x.task.date && !DONE_STATUSES.includes(x.task.status); });
    const rest = visible.filter(function (x) { return !(!x.task.date && !DONE_STATUSES.includes(x.task.status)); });

    box.className = 'kanban pb-kanban';
    box.innerHTML = '';
    box.appendChild(laneEl('Бэклог · без срока', backlog, { backlog: true }));
    statuses.forEach(function (status) {
      const items = rest.filter(function (x) {
        const real = x.task.status || 'Новая';
        // задача с датой, но ещё «Новая» — по смыслу уже запланирована
        const shown = (x.task.date && real === 'Новая') ? 'Запланирована' : real;
        return shown === status;
      });
      box.appendChild(laneEl(status, items, { status: status }));
    });
    wireDrag(box);
  }

  function wireDrag(box) {
    box.querySelectorAll('.pb-card').forEach(function (card) {
      card.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', card.getAttribute('data-i'));
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', function () { card.classList.remove('dragging'); });
    });
    box.querySelectorAll('.pb-lane').forEach(function (lane, laneIndex) {
      lane.addEventListener('dragover', function (e) { e.preventDefault(); lane.classList.add('drag-over'); });
      lane.addEventListener('dragleave', function () { lane.classList.remove('drag-over'); });
      lane.addEventListener('drop', function (e) {
        e.preventDefault();
        lane.classList.remove('drag-over');
        const idx = Number(e.dataTransfer.getData('text/plain'));
        const s = st();
        if (!s || !s.tasks[idx]) return;
        const task = s.tasks[idx];
        if (laneIndex === 0) {
          // в бэклог: убираем срок, статус «Новая»
          task.date = '';
          task.status = 'Новая';
          persistAndRender();
          toast('Задача убрана в бэклог (без срока)');
          return;
        }
        const status = (lane.querySelector('.pb-lane-head b') || {}).textContent || 'Новая';
        const needsDate = WORK_STATUSES.indexOf(status) !== -1 && !task.date;
        if (needsDate) {
          askDate(task, status);
          return;
        }
        if (task.status !== status) {
          task.status = status;
          persistAndRender();
        }
      });
    });
  }

  function persistAndRender() {
    const s = st();
    if (s && typeof s.persist === 'function') s.persist();
    if (s && typeof s.renderAll === 'function') s.renderAll();
    setTimeout(renderBoard, 30);
  }

  // ---------- запрос срока ----------
  let dateCtx = null;
  function ensureDatePrompt() {
    if (document.getElementById('pbDatePrompt')) return;
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.id = 'pbDatePrompt';
    wrap.innerHTML = [
      '<div class="modal" role="dialog" aria-modal="true">',
      '<div class="modal-head"><h2>Поставьте срок</h2><button class="close" type="button" id="pbDateCancel2">×</button></div>',
      '<p class="sub" id="pbDateTaskTitle" style="margin:0 0 6px"></p>',
      '<p class="sub">Задача без срока не попадает в работу. Выберите дату — или верните её в бэклог.</p>',
      '<div class="pb-date-presets">',
      '<button class="btn ghost" type="button" data-pb-days="0">Сегодня</button>',
      '<button class="btn ghost" type="button" data-pb-days="1">Завтра</button>',
      '<button class="btn ghost" type="button" data-pb-days="3">Через 3 дня</button>',
      '<button class="btn ghost" type="button" data-pb-days="7">Через неделю</button>',
      '</div>',
      '<div class="pb-date-custom"><input class="field" type="date" id="pbDateCustom"><button class="btn red" type="button" id="pbDateApply">Поставить</button></div>',
      '<div class="form-actions"><button class="btn ghost" type="button" id="pbDateCancel">Отмена</button></div>',
      '</div>'
    ].join('');
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeDatePrompt(); });
    document.getElementById('pbDateCancel').onclick = closeDatePrompt;
    document.getElementById('pbDateCancel2').onclick = closeDatePrompt;
    wrap.querySelectorAll('[data-pb-days]').forEach(function (b) {
      b.addEventListener('click', function () {
        const days = Number(b.getAttribute('data-pb-days'));
        applyDate(days === 0 ? todayKey() : plusDays(days));
      });
    });
    document.getElementById('pbDateApply').onclick = function () {
      const v = document.getElementById('pbDateCustom').value;
      if (!v) { toast('Выберите дату'); return; }
      applyDate(v);
    };
  }
  function askDate(task, status) {
    ensureDatePrompt();
    dateCtx = { task: task, status: status };
    document.getElementById('pbDateTaskTitle').textContent = '«' + (task.title || 'Задача') + '» → ' + status;
    document.getElementById('pbDateCustom').value = '';
    document.getElementById('pbDatePrompt').classList.add('open');
  }
  function closeDatePrompt() {
    const el = document.getElementById('pbDatePrompt');
    if (el) el.classList.remove('open');
    dateCtx = null;
  }
  function applyDate(dateKey) {
    if (!dateCtx) return;
    dateCtx.task.date = dateKey;
    dateCtx.task.status = dateCtx.status;
    closeDatePrompt();
    persistAndRender();
    toast('Срок ' + shortDate(dateKey) + ' · статус «' + dateCtx.status + '»');
  }

  // Задача со сроком — сразу «Запланирована», «Новая» только если срок не задан.
  document.addEventListener('submit', function (e) {
    try {
      if (!e.target || e.target.id !== 'taskForm') return;
      const form = e.target;
      const dateEl = form.elements.date;
      const statusEl = form.elements.status;
      if (!dateEl || !statusEl) return;
      const hasDate = !!(dateEl.value && String(dateEl.value).trim());
      if (hasDate && (!statusEl.value || statusEl.value === 'Новая')) statusEl.value = 'Запланирована';
    } catch (_e) { }
  }, true);

  // ---------- встраивание ----------
  const prevRenderAll = window.renderAll;
  window.renderAll = function () {
    const res = (typeof prevRenderAll === 'function') ? prevRenderAll.apply(this, arguments) : undefined;
    try { renderBoard(); } catch (e) { console.warn('[kanban]', e); }
    return res;
  };

  document.addEventListener('click', function (e) {
    const tab = e.target.closest && e.target.closest('[data-taskview]');
    if (tab) setTimeout(function () { try { renderBoard(); } catch (_e) { } }, 60);
    const nav = e.target.closest && e.target.closest('[data-page="tasks"]');
    if (nav) setTimeout(function () { try { renderBoard(); } catch (_e) { } }, 120);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { try { renderBoard(); } catch (e) { } });
  else { try { renderBoard(); } catch (e) { } }
})();
