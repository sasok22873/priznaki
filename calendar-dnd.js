/* =========================================================================
   Календарь: перетаскивание событий между днями.
   Тянем чип события/задачи на другую ячейку месяца — меняется дата,
   сохраняется в localStorage и в Supabase через persist() + renderAll().
   ========================================================================= */
(function () {
  const MONTH_GRID = 'monthGrid';

  const css = document.createElement('style');
  css.id = 'pbCalDndStyle';
  css.textContent = [
    '.month-cell{position:relative;transition:background .15s,border-color .15s}',
    '.cal-chip[draggable="true"]{cursor:grab;user-select:none}',
    '.cal-chip.pb-dragging{opacity:.45}',
    '.month-cell.pb-drop-active{background:rgba(167,139,250,.18)!important;box-shadow:inset 0 0 0 2px rgba(167,139,250,.75);border-radius:12px}',
    '.pb-dnd-hint{display:flex;align-items:center;gap:8px;font-size:12px;color:#8f8a9c;margin:0 0 10px}',
    '.pb-dnd-hint .pb-icon{width:14px;height:14px;color:#a78bfa}',
    '@media (pointer:coarse){.pb-dnd-hint{display:none}}'
  ].join('');
  document.head.appendChild(css);

  function icon(name, cls) { return (typeof window.pbIcon === 'function') ? window.pbIcon(name, cls) : ''; }
  function toast(m) { if (typeof window.toast === 'function') window.toast(m); }
  // данные приложения живут в замыкании inline-скрипта; мостик pbState() из index.html
  function data() {
    try { return (typeof window.pbState === 'function') ? window.pbState() : null; } catch (e) { return null; }
  }
  function fmtRu(key) {
    try {
      return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(key + 'T12:00:00'));
    } catch (e) { return key; }
  }

  function ruTodayKey() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Krasnoyarsk', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  // дата, к которой относится ячейка: из её onclick="openDayModal('2026-11-09')"
  function cellDate(cell) {
    const handler = cell.getAttribute('onclick') || '';
    const m = handler.match(/openDayModal\('([\d-]+)'\)/);
    return m ? m[1] : '';
  }

  function decorate() {
    const grid = document.getElementById(MONTH_GRID);
    if (!grid) return;
    const all = (typeof window.allEvents === 'function') ? window.allEvents() : [];
    grid.querySelectorAll('.month-cell').forEach(function (cell) {
      const key = cellDate(cell);
      if (!key) return;
      const items = all.filter(function (e) { return e.date === key; });
      const chips = cell.querySelectorAll('.cal-chip');
      chips.forEach(function (chip, i) {
        const item = items[i];
        if (!item) return;
        chip.setAttribute('draggable', 'true');
        chip.dataset.pbKind = item.kind === 'task' ? 'task' : 'event';
        chip.dataset.pbIndex = String(item.kind === 'task' ? item.ti : item.ei);
        chip.dataset.pbDate = key;
        chip.title = (item.title || '') + ' — потяните на другой день';
      });
    });
  }

  function addHint() {
    const host = document.getElementById('monthCal');
    if (!host || host.querySelector('.pb-dnd-hint')) return;
    const hint = document.createElement('div');
    hint.className = 'pb-dnd-hint';
    hint.innerHTML = icon('arrow-right') + '<span>Перетащите событие на другой день, чтобы изменить дату</span>';
    const grid = document.getElementById(MONTH_GRID);
    if (grid && grid.parentNode === host) host.insertBefore(hint, grid);
    else host.appendChild(hint);
  }

  function moveItem(kind, index, newDate) {
    const i = Number(index);
    if (!Number.isFinite(i)) return false;
    const st = data();
    if (!st) { toast('Не удалось получить данные календаря'); return false; }
    if (kind === 'task') {
      if (!Array.isArray(st.tasks) || !st.tasks[i]) return false;
      st.tasks[i].date = newDate;
      if (typeof st.persist === 'function') st.persist();
      if (typeof st.renderAll === 'function') st.renderAll();
      toast('Задача перенесена на ' + fmtRu(newDate));
      return true;
    }
    if (!Array.isArray(st.events) || !st.events[i]) return false;
    st.events[i].date = newDate;
    if (typeof st.persist === 'function') st.persist();
    if (typeof st.renderAll === 'function') st.renderAll();
    toast('Событие перенесено на ' + fmtRu(newDate));
    return true;
  }

  let drag = null;

  function clearMarks() {
    document.querySelectorAll('.month-cell.pb-drop-active').forEach(function (c) { c.classList.remove('pb-drop-active'); });
    document.querySelectorAll('.cal-chip.pb-dragging').forEach(function (c) { c.classList.remove('pb-dragging'); });
  }

  document.addEventListener('dragstart', function (e) {
    const chip = e.target.closest && e.target.closest('.cal-chip');
    if (!chip || !chip.dataset.pbKind) return;
    drag = { kind: chip.dataset.pbKind, index: chip.dataset.pbIndex, from: chip.dataset.pbDate };
    chip.classList.add('pb-dragging');
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', chip.dataset.pbKind + ':' + chip.dataset.pbIndex);
    } catch (_e) { }
  });

  document.addEventListener('dragend', function () {
    drag = null;
    clearMarks();
  });

  document.addEventListener('dragover', function (e) {
    const cell = e.target.closest && e.target.closest('.month-cell');
    if (!cell || !drag) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch (_e) { }
    if (!cell.classList.contains('pb-drop-active')) {
      document.querySelectorAll('.month-cell.pb-drop-active').forEach(function (c) { c.classList.remove('pb-drop-active'); });
      cell.classList.add('pb-drop-active');
    }
  });

  document.addEventListener('drop', function (e) {
    const cell = e.target.closest && e.target.closest('.month-cell');
    if (!cell || !drag) return;
    e.preventDefault();
    const to = cellDate(cell);
    const d = drag;
    drag = null;
    clearMarks();
    if (!to || !d || to === d.from) return;
    const ok = moveItem(d.kind, d.index, to);
    if (ok) decorate();
  });

  // перехватываем рендер календаря, чтобы разметить чипы после каждой отрисовки
  function hookRender() {
    if (typeof window.renderCalendar !== 'function' || window.renderCalendar.__pbDnd) return;
    const orig = window.renderCalendar;
    const wrapped = function () {
      const r = orig.apply(this, arguments);
      try { addHint(); decorate(); } catch (e) { console.warn('[cal-dnd]', e); }
      return r;
    };
    wrapped.__pbDnd = true;
    window.renderCalendar = wrapped;
  }

  function boot() {
    hookRender();
    addHint();
    decorate();
    // календарь может отрисоваться и из renderAll, и при переключении месяца
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[onclick*="shiftMonth"], [data-calview]')) {
        setTimeout(function () { addHint(); decorate(); }, 60);
      }
    });
    const grid = document.getElementById(MONTH_GRID);
    if (grid) {
      const obs = new MutationObserver(function () { try { decorate(); } catch (_e) { } });
      obs.observe(grid, { childList: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
